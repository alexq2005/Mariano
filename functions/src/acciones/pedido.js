import { createHash, randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { resumirCarrito } from "../compartido/lineas.js";
import { formaDeEntrega, sanearDatosPedido, validarDatosPedido } from "../compartido/datos-pedido.js";

// La clienta confirma el pedido en la página. Es la única acción que se
// puede llamar sin cuenta, así que NO se confía en nada de lo que manda:
//
//   - los precios se recalculan acá con el catálogo vigente y el MISMO
//     código que usó la página (compartido/). Si no da el total que vio la
//     clienta, se rechaza y la página le muestra los precios nuevos: nunca
//     se guarda un pedido con un total que ella no aceptó.
//   - sus datos se sanean y validan con compartido/datos-pedido.js.
//   - todo (número, pedido, seguimiento, historial, email pendiente y el
//     límite de pedidos) se escribe en UNA transacción: o queda todo, o nada.
//
// El stock todavía no se descuenta: se va a mover acá mismo, en esta
// transacción, cuando el panel permita cargarlo.

export const TOPE = 9999; // el mismo tope por producto que el carrito
export const MAX_LINEAS = 100;
export const LIMITE_POR_HORA = 10;
const HORA = 60 * 60 * 1000;
const DIAS_SEGUIMIENTO = 90;

const invalido = (mensaje, detalles) => new HttpsError("invalid-argument", mensaje, detalles);

// [{id, cant}] con ids de texto, cantidades enteras y sin repetidos.
const leerLineas = (items) => {
  if (!Array.isArray(items) || !items.length) throw invalido("El pedido está vacío.");
  if (items.length > MAX_LINEAS) throw invalido("El pedido tiene demasiados productos.");
  const vistos = new Set();
  return items.map((x) => {
    const id = x?.id;
    const cant = x?.cant;
    if (typeof id !== "string" || !id || id.length > 100) throw invalido("Hay un producto sin código.");
    if (!Number.isInteger(cant) || cant < 1 || cant > TOPE) throw invalido(`Cantidad inválida para ${id}.`);
    if (vistos.has(id)) throw invalido(`El producto ${id} está repetido.`);
    vistos.add(id);
    return { id, cant };
  });
};

// La página genera un código al azar por intento de compra. Si el mismo
// pedido llega dos veces (doble clic, se cortó la red y reintentó), se
// devuelve el que ya estaba en vez de crear otro. El id del pedido es un
// hash del código, así el id que ve el panel no sirve para reclamarlo.
const leerSolicitud = (s) => {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(s)) throw invalido("Falta el código del pedido.");
  return createHash("sha256").update(`pedido:${s}`).digest("hex").slice(0, 32);
};

// El límite es por conexión, sin guardar la IP: se guarda su hash.
const claveLimite = (ip) => `pedidos-${createHash("sha256").update(`ip:${ip ?? "?"}`).digest("hex").slice(0, 32)}`;

export const crearPedido = async (datos, _quien, contexto = {}) => {
  const lineas = leerLineas(datos?.items);
  const idPedido = leerSolicitud(datos?.solicitud);
  const totalVisto = datos?.totalVisto;
  if (typeof totalVisto !== "number" || !Number.isFinite(totalVisto)) throw invalido("Falta el total.");

  const refCatalogo = db.collection("publico").doc("catalogo");
  const refPedido = db.collection("pedidos").doc(idPedido);
  const refContador = db.collection("contadores").doc("pedidos");
  const refLimite = db.collection("limites").doc(claveLimite(contexto.ip));

  return db.runTransaction(async (tx) => {
    // En una transacción, todas las lecturas van antes que las escrituras.
    const [snapPedido, snapCatalogo, snapContador, snapLimite] = await Promise.all([
      tx.get(refPedido),
      tx.get(refCatalogo),
      tx.get(refContador),
      tx.get(refLimite),
    ]);

    if (snapPedido.exists) {
      const ya = snapPedido.data();
      return { numero: ya.numero, seguimiento: ya.seguimiento, total: ya.total, repetido: true };
    }
    if (!snapCatalogo.exists) throw new HttpsError("failed-precondition", "La tienda todavía no tiene catálogo.");

    const ahora = Date.now();
    const limite = snapLimite.exists ? snapLimite.data() : null;
    const enVentana = limite && ahora - limite.desde < HORA;
    if (enVentana && limite.n >= LIMITE_POR_HORA) {
      throw new HttpsError("resource-exhausted", "Se hicieron muchos pedidos seguidos. Probá de nuevo en un rato.");
    }

    const { productos = [], config = {}, version = null } = snapCatalogo.data();
    const cliente = sanearDatosPedido(datos?.cliente, config);
    const errores = validarDatosPedido(cliente, config);
    if (Object.keys(errores).length) throw invalido("Revisá tus datos.", { errores });

    const porId = new Map(productos.map((p) => [p.id, p]));
    const faltan = lineas.filter((l) => !porId.has(l.id)).map((l) => l.id);
    const resumen = resumirCarrito(lineas, porId, config);
    const pausados = resumen.noDisponibles.map((x) => x.p.id);
    if (faltan.length || pausados.length) {
      throw new HttpsError("failed-precondition", "Algunos productos ya no están disponibles.", {
        noDisponibles: [...faltan, ...pausados],
      });
    }
    if (resumen.faltaMinimo > 0) {
      throw new HttpsError("failed-precondition", "El pedido no llega al mínimo.", { faltaMinimo: resumen.faltaMinimo });
    }
    if (resumen.total !== totalVisto) {
      throw new HttpsError("failed-precondition", "Los precios cambiaron.", { total: resumen.total });
    }

    const numero = (snapContador.exists ? snapContador.data().ultimo : 0) + 1;
    const seguimiento = randomBytes(16).toString("hex"); // 128 bits: el link ES la llave
    const creado = Timestamp.fromMillis(ahora);
    const entrega = formaDeEntrega(cliente.entrega, config);
    const items = resumen.items.map((i) => ({
      id: i.p.id,
      cod: i.p.cod,
      nom: i.p.nom,
      cant: i.cant,
      unit: i.unit,
      sub: i.sub,
      esMayor: i.esMayor,
    }));

    tx.set(refContador, { ultimo: numero });
    tx.set(refLimite, enVentana ? { desde: limite.desde, n: limite.n + 1 } : { desde: ahora, n: 1 });

    tx.create(refPedido, {
      numero,
      estado: "nuevo",
      creado,
      cliente,
      entrega: { id: entrega.id, nombre: entrega.nombre },
      items,
      total: resumen.total,
      ahorro: resumen.ahorro,
      unidades: resumen.unidades,
      versionCatalogo: version,
      seguimiento,
    });

    // Lo que ve quien tenga el link: el pedido, sin datos personales.
    tx.create(db.collection("seguimiento").doc(seguimiento), {
      numero,
      estado: "nuevo",
      creado,
      expira: Timestamp.fromMillis(ahora + DIAS_SEGUIMIENTO * 24 * HORA),
      entrega: entrega.nombre,
      pago: cliente.pago,
      items: items.map(({ nom, cant, unit, sub }) => ({ nom, cant, unit, sub })),
      total: resumen.total,
    });

    // Email de confirmación: queda pendiente en la salida; lo manda el
    // proceso de envíos cuando esté configurado el servicio de email.
    tx.create(db.collection("salida").doc(), {
      tipo: "pedido.confirmacion",
      nivel: "general",
      estado: "pendiente",
      para: cliente.email,
      pedido: idPedido,
      numero,
      creado,
    });

    anotarEnAuditoria(tx, db, {
      accion: "pedido.crear",
      quien: { uid: null, email: null, rol: "clienta" },
      cuando: new Date(ahora).toISOString(),
      detalle: { numero, total: resumen.total, unidades: resumen.unidades },
    });

    return { numero, seguimiento, total: resumen.total, repetido: false };
  });
};
