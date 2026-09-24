import { randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/https";
import { db, FieldValue } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { claveClienta } from "../clientas.js";
import { claveIp, refLimite, revisarLimite } from "../limites.js";
import { claveDia, claveMes } from "../tiempo.js";
import { armarLineas, deltaVenta, ErrorPedido, moverStock, puedePasar } from "../logica-pedido.js";
import { formaDeEntrega, sanearDatosPedido, validarDatosPedido } from "../compartido/datos-pedido.js";

export const LIMITES_PEDIDO = { ip: 20, telefono: 5 };
const DIAS_SEGUIMIENTO = 90;
const inc = (n) => FieldValue.increment(n);

// Lo que ve la clienta con su link de seguimiento: el estado y qué pidió.
// Sin nombre, teléfono ni dirección: el link se reenvía, y quien lo tenga
// no tiene por qué ver datos personales.
const vistaSeguimiento = (pedido, config, expira) => ({
  numero: pedido.numero,
  estado: pedido.estado,
  creado: pedido.creado,
  actualizado: pedido.actualizado,
  negocio: config.nombre_negocio ?? "",
  items: pedido.items.map((i) => ({ nom: i.nom, img: i.img, cant: i.cant, unit: i.unit, sub: i.sub, esMayor: i.esMayor })),
  total: pedido.total,
  ahorro: pedido.ahorro,
  entrega: pedido.entrega.nombre,
  pago: pedido.pago,
  historial: [{ estado: pedido.estado, cuando: pedido.creado }],
  expira,
});

// ── La clienta hace el pedido (sin cuenta) ──────────────────────────
// Del navegador llegan SOLO el carrito ([{id, cant}]) y sus datos. Los
// precios, el número de pedido y el total los pone el servidor.
export const crearPedido = async (datos, { ip }) => {
  const previa = await refs.catalogo().get();
  if (!previa.exists) throw new HttpsError("failed-precondition", "La tienda todavía no está publicada.");
  const configPrevia = previa.data().config ?? {};

  const cliente = sanearDatosPedido(datos?.cliente, configPrevia);
  const errores = validarDatosPedido(cliente, configPrevia);
  if (Object.keys(errores).length) {
    throw new HttpsError("invalid-argument", Object.values(errores)[0], { errores });
  }
  const clientaId = claveClienta(cliente.telefono);
  if (!clientaId) {
    throw new HttpsError("invalid-argument", "Ese teléfono no parece válido.", { errores: { telefono: "Ese teléfono no parece válido." } });
  }

  const ahora = new Date();
  const token = randomBytes(16).toString("hex");
  const pedidoRef = db.collection("pedidos").doc();
  const expira = new Date(ahora.getTime() + DIAS_SEGUIMIENTO * 864e5);

  return db.runTransaction(async (tx) => {
    const [cat, st, cont, cli, limIp, limTel] = await tx.getAll(
      refs.catalogo(),
      refs.stock(),
      refs.contador(),
      refs.clienta(clientaId),
      refLimite(claveIp("pedido", ip)),
      refLimite(`pedido-${clientaId}`),
    );
    const anotarIp = revisarLimite(limIp, {
      max: LIMITES_PEDIDO.ip,
      ahora: ahora.getTime(),
      mensaje: "Se hicieron muchos pedidos desde esta conexión en la última hora. Probá más tarde o escribinos por WhatsApp.",
    });
    const anotarTel = revisarLimite(limTel, {
      max: LIMITES_PEDIDO.telefono,
      ahora: ahora.getTime(),
      mensaje: "Ya hiciste varios pedidos en la última hora. Si necesitás cambiar algo, escribinos por WhatsApp.",
    });

    const config = cat.data().config ?? {};
    let lineas;
    try {
      lineas = armarLineas(datos?.carrito, cat.data().productos ?? [], config, st.exists ? (st.data().cantidades ?? {}) : {});
    } catch (err) {
      if (err instanceof ErrorPedido) throw new HttpsError("failed-precondition", err.message, err.detalle);
      throw err;
    }

    const numero = (cont.exists ? cont.data().ultimo : 1000) + 1;
    const entrega = formaDeEntrega(cliente.entrega, config);
    const pedido = {
      numero,
      estado: "pendiente",
      creado: ahora,
      actualizado: ahora,
      confirmado: null,
      clienta: { nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email || null },
      clientaId,
      entrega: { id: entrega.id, nombre: entrega.nombre, direccion: entrega.pide_direccion ? cliente.direccion : null },
      pago: cliente.pago,
      comentarios: cliente.comentarios || null,
      ...lineas,
      // Las condiciones con las que se armó: si mañana cambia el mínimo por
      // mayor, este pedido sigue explicándose solo.
      condiciones: {
        minimo_mayor: config.minimo_mayor,
        lista: config.actualizado ?? null,
        precios_confirmados: Boolean(config.precios_confirmados),
      },
      token,
      historial: [{ estado: "pendiente", cuando: ahora, quien: { nombre: cliente.nombre, rol: "clienta" } }],
    };

    tx.create(pedidoRef, pedido);
    tx.create(refs.seguimiento(token), vistaSeguimiento(pedido, config, expira));
    tx.set(refs.contador(), { ultimo: numero });
    tx.set(
      refs.clienta(clientaId),
      {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        ...(cliente.email ? { email: cliente.email } : {}),
        pedidos: inc(1),
        ultima: ahora,
        ultimoNumero: numero,
        ...(cli.exists ? {} : { primera: ahora, compras: 0, total: 0 }),
      },
      { merge: true },
    );
    tx.set(refs.tablero(), { porEstado: { pendiente: inc(1) }, ultimo: { numero, creado: ahora } }, { merge: true });
    anotarIp(tx);
    anotarTel(tx);
    return { id: pedidoRef.id, numero, token, total: lineas.total };
  });
};

// ── El panel mueve el pedido de estado ──────────────────────────────
const VERBO = { confirmado: "confirmar", entregado: "entregar", cancelado: "cancelar" };

const cambiarEstado = (hacia) => async (datos, quien) => {
  const { id } = datos ?? {};
  const motivo = typeof datos?.motivo === "string" ? datos.motivo.trim().slice(0, 300) : "";
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta el pedido.");
  const ahora = new Date();

  return db.runTransaction(async (tx) => {
    const [ped, st, cat] = await tx.getAll(refs.pedido(id), refs.stock(), refs.catalogo());
    if (!ped.exists) throw new HttpsError("not-found", "Ese pedido no existe.");
    const p = ped.data();
    if (p.estado === hacia) return { id, numero: p.numero, estado: hacia, sinCambios: true };
    if (!puedePasar(p.estado, hacia)) {
      throw new HttpsError("failed-precondition", `El pedido #${p.numero} está ${p.estado}: no se puede ${VERBO[hacia]}.`);
    }

    // Stock: se descuenta al confirmar y vuelve si se cancela lo confirmado.
    const cantidades = st.exists ? (st.data().cantidades ?? {}) : {};
    let nuevas = {};
    if (hacia === "confirmado") {
      const mov = moverStock(cantidades, p.items, -1);
      if (mov.faltantes.length) {
        const cuales = mov.faltantes.map((f) => `${f.nom} (hay ${f.hay}, pide ${f.pide})`).join(", ");
        throw new HttpsError("failed-precondition", `No alcanza el stock: ${cuales}. Ajustá el stock o hablá con la clienta.`, {
          faltantes: mov.faltantes,
        });
      }
      nuevas = mov.nuevas;
    } else if (hacia === "cancelado" && p.estado === "confirmado") {
      nuevas = moverStock(cantidades, p.items, 1).nuevas;
    }

    if (Object.keys(nuevas).length) {
      tx.set(refs.stock(), { cantidades: nuevas }, { merge: true });
      // La tienda no ve cantidades, solo si está agotado.
      const productos = cat.exists ? (cat.data().productos ?? []) : [];
      let cambio = false;
      const actualizados = productos.map((pr) => {
        if (!(pr.id in nuevas)) return pr;
        const agotado = nuevas[pr.id] <= 0;
        if (Boolean(pr.agotado) === agotado) return pr;
        cambio = true;
        return { ...pr, agotado };
      });
      if (cambio) tx.update(refs.catalogo(), { productos: actualizados, version: ahora.toISOString() });
    }

    // Ventas y ficha de la clienta: cuenta como venta al confirmarse, en el
    // mes y el día en que se confirmó; si después se cancela, se resta de ahí.
    if (hacia === "confirmado" || (hacia === "cancelado" && p.estado === "confirmado")) {
      const signo = hacia === "confirmado" ? 1 : -1;
      const fecha = hacia === "confirmado" ? ahora : p.confirmado.toDate();
      const mes = claveMes(fecha);
      tx.set(refs.stats(mes), { mes, ...deltaVenta(p, claveDia(fecha), signo, inc) }, { merge: true });
      if (p.clientaId) {
        tx.set(refs.clienta(p.clientaId), { compras: inc(signo), total: inc(signo * p.total) }, { merge: true });
      }
    }

    const entrada = { estado: hacia, cuando: ahora, quien: { nombre: quien.nombre ?? quien.email ?? "", rol: quien.rol } };
    if (motivo) entrada.motivo = motivo;
    tx.update(refs.pedido(id), {
      estado: hacia,
      actualizado: ahora,
      historial: FieldValue.arrayUnion(entrada),
      ...(hacia === "confirmado" ? { confirmado: ahora } : {}),
    });
    tx.set(
      refs.seguimiento(p.token),
      { estado: hacia, actualizado: ahora, historial: FieldValue.arrayUnion({ estado: hacia, cuando: ahora }) },
      { merge: true },
    );
    tx.set(refs.tablero(), { porEstado: { [p.estado]: inc(-1), [hacia]: inc(1) } }, { merge: true });
    anotarEnAuditoria(tx, db, {
      accion: `pedido.${VERBO[hacia]}`,
      quien,
      cuando: ahora.toISOString(),
      detalle: { id, numero: p.numero, de: p.estado, a: hacia, total: p.total, ...(motivo ? { motivo } : {}) },
    });
    return { id, numero: p.numero, estado: hacia, sinCambios: false };
  });
};

export const confirmarPedido = cambiarEstado("confirmado");
export const entregarPedido = cambiarEstado("entregado");
export const cancelarPedido = cambiarEstado("cancelado");
