import process from "node:process";
import { HttpsError } from "firebase-functions/https";
import { db, FieldPath } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { claveIp, refLimite, revisarLimite } from "../limites.js";
import { ErrorMercadoPago, hayMercadoPago, mp, secretoWebhook, urlFunciones } from "../mercadopago.js";
import { decidirCobro, detallePago, estadoCobroDe, firmaValida } from "../mp-logica.js";
import { cambiosFactura, facturarSiHaceFalta } from "./factura.js";

// Cobrar un pedido. Se paga DESPUÉS de que el negocio lo confirma (con el
// stock separado y el envío sumado), de dos maneras:
//
//   Mercado Pago   tarjetas de crédito y débito, dinero en cuenta, efectivo
//                  en Rapipago / Pago Fácil. Se marca solo: lo avisa Mercado
//                  Pago (webhook) y lo revisa la tienda cuando la clienta vuelve.
//   Transferencia  al alias o CBU/CVU del negocio, desde cualquier banco o
//                  billetera. La marca el negocio a mano al ver el comprobante.
//
// pedido.cobro = { estado, medio, detalle, monto, referencia, cuando, ... }
//   estado: sin_pagar | pendiente | aprobado | rechazado | reclamo | devuelto

const COBRABLES = ["confirmado", "entregado"];
const SISTEMA = { uid: "mercadopago", email: null, rol: "sistema" };
const MEDIOS_A_MANO = { transferencia: "Transferencia", efectivo: "Efectivo", otro: "Otro medio" };

const texto = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
export const aCobrarDe = (p) => p.aCobrar ?? p.total + (p.envio ?? 0);

// Lo que ve la clienta para pagar. Solo datos del negocio, nada de ella.
export const vistaPagar = (cobro) => {
  const c = cobro ?? {};
  const transferencia = c.alias || c.cbu ? { alias: c.alias || null, cbu: c.cbu || null, titular: c.titular || null, banco: c.banco || null } : null;
  return { mercadopago: Boolean(c.mercadopago), transferencia };
};

const frenar = (tipo, ip, max, mensaje) =>
  db.runTransaction(async (tx) => {
    const [lim] = await tx.getAll(refLimite(claveIp(tipo, ip)));
    revisarLimite(lim, { max, ahora: Date.now(), mensaje })(tx);
  });

const pedidoPorToken = async (token) => {
  if (typeof token !== "string" || !/^[0-9a-f]{32}$/.test(token)) throw new HttpsError("invalid-argument", "Ese link de pedido no es válido.");
  const q = await db.collection("pedidos").where("token", "==", token).limit(1).get();
  if (q.empty) throw new HttpsError("not-found", "No encontramos ese pedido.");
  return q.docs[0];
};

// A dónde vuelve la clienta después de pagar: su propio link de seguimiento.
// https en producción; http solo en la compu (desarrollo).
// En producción, https (o la compu, en http). En los emuladores también
// cualquier http: la tienda de prueba puede abrirse por la IP de la red o
// desde una compu en la nube.
const enEmulador = process.env.FUNCTIONS_EMULATOR === "true";
const volverValido = (url, token) => {
  try {
    const u = new URL(url);
    const local = u.protocol === "http:" && (enEmulador || ["localhost", "127.0.0.1"].includes(u.hostname));
    return (u.protocol === "https:" || local) && u.pathname.endsWith(`/pedido/${token}`) && !u.search && !u.hash;
  } catch {
    return false;
  }
};

const noRespondio = (err) => {
  if (err instanceof ErrorMercadoPago) {
    console.error(err.message);
    return new HttpsError("unavailable", "Mercado Pago no respondió. Probá de nuevo en un rato.");
  }
  return err;
};

// ── La clienta: "Pagar con Mercado Pago" ────────────────────────────
// Arma el pago en Mercado Pago (una "preferencia") por lo que se debe y
// devuelve el link al que va la clienta. El monto lo pone el servidor.
export const iniciarPago = async (datos, { ip }) => {
  const token = datos?.token;
  const volverA = typeof datos?.volverA === "string" ? datos.volverA.slice(0, 500) : "";
  const snap = await pedidoPorToken(token);
  if (!volverValido(volverA, token)) throw new HttpsError("invalid-argument", "No se puede volver a ese lugar después de pagar.");
  const p = snap.data();
  if (p.estado === "pendiente") {
    throw new HttpsError("failed-precondition", "Todavía no confirmamos tu pedido: vas a poder pagarlo cuando lo confirmemos.");
  }
  if (!COBRABLES.includes(p.estado)) throw new HttpsError("failed-precondition", "Este pedido está cancelado.");
  if (["aprobado", "reclamo"].includes(p.cobro?.estado)) throw new HttpsError("failed-precondition", "Este pedido ya está pagado.");

  const [cfg, cat] = await db.getAll(refs.config(), refs.catalogo());
  if (!cfg.data()?.cobro?.mercadopago || !hayMercadoPago()) {
    throw new HttpsError("failed-precondition", "El pago con Mercado Pago no está disponible. Podés pagar por transferencia o escribirnos por WhatsApp.");
  }
  await frenar("pago", ip, 30, "Probaste pagar muchas veces en la última hora. Esperá un rato o escribinos por WhatsApp.");

  const monto = aCobrarDe(p);
  const previa = p.cobro?.preferencia;
  if (previa?.url && previa.monto === monto && previa.volverA === volverA) return { url: previa.url };

  const negocio = cat.data()?.config?.nombre_negocio ?? "";
  const unidades = p.items.reduce((s, i) => s + i.cant, 0);
  let pref;
  try {
    pref = await mp("/checkout/preferences", {
      method: "POST",
      body: {
        // Un solo renglón por el total: los precios por mayor ya están
        // aplicados y no hay redondeos que no cierren.
        items: [
          {
            id: `pedido-${p.numero}`,
            title: `Pedido #${p.numero}${negocio ? ` · ${negocio}` : ""}`,
            description: `${unidades} ${unidades === 1 ? "producto" : "productos"}${p.envio ? " + envío" : ""}`,
            quantity: 1,
            unit_price: monto,
            currency_id: "ARS",
          },
        ],
        external_reference: snap.id,
        notification_url: `${urlFunciones()}/mercadopago`,
        back_urls: { success: volverA, pending: volverA, failure: volverA },
        // Mercado Pago solo vuelve solo a una dirección https.
        ...(volverA.startsWith("https://") ? { auto_return: "approved" } : {}),
        metadata: { numero: p.numero },
      },
    });
  } catch (err) {
    throw noRespondio(err);
  }
  await snap.ref.update({ "cobro.preferencia": { id: pref.id, url: pref.init_point, monto, volverA, creada: new Date() } });
  return { url: pref.init_point };
};

// ── Un pago de Mercado Pago llega al pedido ─────────────────────────
// Lo usan el aviso de Mercado Pago y la tienda cuando la clienta vuelve: lo
// que pase primero. El pago siempre se lee de Mercado Pago con el token del
// negocio, nunca de lo que diga el navegador.
export const aplicarPago = async (pago) => {
  const pedidoId = typeof pago?.external_reference === "string" ? pago.external_reference : "";
  if (!pedidoId || pedidoId.includes("/")) return { ignorado: true };
  const ref = String(pago.id);
  const nuevo = estadoCobroDe(pago.status);
  const ahora = new Date();

  const r = await db.runTransaction(async (tx) => {
    const [ped, cfg] = await tx.getAll(refs.pedido(pedidoId), refs.config());
    if (!ped.exists) return { ignorado: true };
    const p = ped.data();
    const actual = p.cobro ?? { estado: "sin_pagar" };
    const decision = decidirCobro(actual, pago, p.pagosDeMas);
    if (decision === "nada") return { estado: actual.estado, sinCambios: true };

    const registro = {
      estado: nuevo,
      medio: "mercadopago",
      detalle: detallePago(pago),
      monto: Number(pago.transaction_amount) || 0,
      referencia: ref,
      cuando: ahora,
      mpActualizado: Date.parse(pago.date_last_updated ?? "") || null,
      motivo: pago.status_detail ? String(pago.status_detail).slice(0, 80) : null,
    };
    const auditar = (accion) =>
      anotarEnAuditoria(tx, db, {
        accion,
        quien: SISTEMA,
        cuando: ahora.toISOString(),
        detalle: { id: pedidoId, numero: p.numero, estado: nuevo, monto: registro.monto, referencia: ref },
      });

    if (decision === "demas") {
      // Ya estaba pagado: este es un pago de más. No toca el cobro; queda a
      // la vista en el panel para devolverlo.
      tx.update(ped.ref, new FieldPath("pagosDeMas", ref), registro);
      auditar("pago.demas");
      return { estado: actual.estado, deMas: true };
    }

    const cobro = { ...registro, quien: null, preferencia: actual.preferencia ?? null };
    // Cobrado: se factura solo. Devuelto: sale la nota de crédito.
    tx.update(ped.ref, { cobro, actualizado: ahora, ...cambiosFactura(p, nuevo, cfg.data()?.facturacion) });
    tx.set(refs.seguimiento(p.token), { cobro: { estado: nuevo, detalle: registro.detalle } }, { merge: true });
    auditar("pago.mercadopago");
    return { estado: nuevo };
  });
  // Cobrado o devuelto: la factura (o la nota de crédito) sale ya.
  if (!r.ignorado && !r.sinCambios && !r.deMas) await facturarSiHaceFalta(pedidoId);
  return r;
};

// ── La clienta vuelve de Mercado Pago ───────────────────────────────
// La tienda manda el número de pago que trae la dirección de vuelta. Si el
// aviso ya llegó, no cambia nada; si todavía no, la clienta no espera.
export const verificarPago = async (datos, { ip }) => {
  const snap = await pedidoPorToken(datos?.token);
  const pagoId = String(datos?.pagoId ?? "").trim();
  if (!/^\d{1,20}$/.test(pagoId)) throw new HttpsError("invalid-argument", "Ese número de pago no es válido.");
  await frenar("verificar", ip, 60, "Demasiados intentos en la última hora. Esperá un rato.");
  let pago;
  try {
    pago = await mp(`/v1/payments/${pagoId}`);
  } catch (err) {
    if (err instanceof ErrorMercadoPago && err.status === 404) throw new HttpsError("not-found", "Mercado Pago no encuentra ese pago.");
    throw noRespondio(err);
  }
  if (String(pago.external_reference) !== snap.id) throw new HttpsError("permission-denied", "Ese pago no es de este pedido.");
  const r = await aplicarPago(pago);
  return { estado: r.estado };
};

// ── El aviso de Mercado Pago (webhook) ──────────────────────────────
// Llega a https://us-central1-<proyecto>.cloudfunctions.net/mercadopago.
// Responder 200 le dice "recibido"; con un error, Mercado Pago reintenta.
export const recibirAviso = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("");
    return;
  }
  const q = req.query ?? {};
  const cuerpo = req.body ?? {};
  const tipo = q.type ?? q.topic ?? cuerpo.type ?? cuerpo.topic;
  const idEnQuery = q["data.id"] ?? q.data?.id ?? q.id;
  const dataId = String(idEnQuery ?? cuerpo.data?.id ?? "");
  // Otros avisos (órdenes, contracargos): no hacen falta, el pago los refleja.
  if (tipo !== "payment" || !/^\d{1,20}$/.test(dataId) || !hayMercadoPago()) {
    res.status(200).send("ok");
    return;
  }
  const secreto = secretoWebhook();
  // Mercado Pago manda cada aviso dos veces: el formato nuevo (firmado) y el
  // viejo ("IPN", sin firma). Con la clave cargada, el viejo se ignora: el
  // firmado del mismo pago también llega.
  if (secreto && !req.get("x-signature")) {
    res.status(200).send("ok");
    return;
  }
  if (secreto && !firmaValida({ firma: req.get("x-signature"), requestId: req.get("x-request-id"), dataId, secreto })) {
    console.warn("Aviso de Mercado Pago con firma inválida", { dataId });
    res.status(401).send("firma");
    return;
  }
  try {
    await aplicarPago(await mp(`/v1/payments/${dataId}`));
    res.status(200).send("ok");
  } catch (err) {
    if (err instanceof ErrorMercadoPago && err.status === 404) {
      res.status(200).send("no existe");
      return;
    }
    console.error("No se pudo procesar el aviso de Mercado Pago", err);
    res.status(500).send("error");
  }
};

// ── El panel: pagos a mano, anular y devolver ───────────────────────
const quienCorto = (quien) => ({ nombre: quien.nombre ?? quien.email ?? "", rol: quien.rol });

const leerPedido = async (tx, id) => {
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta el pedido.");
  const [ped] = await tx.getAll(refs.pedido(id));
  if (!ped.exists) throw new HttpsError("not-found", "Ese pedido no existe.");
  return ped;
};

// "Ya me pagó": transferencia, efectivo al entregar, etc.
export const registrarPago = async (datos, quien) => {
  const medio = datos?.medio;
  if (!MEDIOS_A_MANO[medio]) throw new HttpsError("invalid-argument", "Elegí cómo pagó: transferencia, efectivo u otro.");
  const nota = texto(datos?.nota, 120);
  const ahora = new Date();
  const r = await db.runTransaction(async (tx) => {
    const ped = await leerPedido(tx, datos?.id);
    const [cfg] = await tx.getAll(refs.config());
    const p = ped.data();
    if (p.estado === "cancelado") throw new HttpsError("failed-precondition", `El pedido #${p.numero} está cancelado.`);
    if (["aprobado", "reclamo"].includes(p.cobro?.estado)) throw new HttpsError("failed-precondition", `El pedido #${p.numero} ya figura pagado.`);
    const detalle = `${MEDIOS_A_MANO[medio]}${nota ? ` · ${nota}` : ""}`;
    const monto = aCobrarDe(p);
    tx.update(ped.ref, {
      cobro: { estado: "aprobado", medio, detalle, monto, referencia: null, cuando: ahora, quien: quienCorto(quien), preferencia: p.cobro?.preferencia ?? null },
      actualizado: ahora,
      ...cambiosFactura(p, "aprobado", cfg.data()?.facturacion),
    });
    tx.set(refs.seguimiento(p.token), { cobro: { estado: "aprobado", detalle: MEDIOS_A_MANO[medio] } }, { merge: true });
    anotarEnAuditoria(tx, db, { accion: "pago.registrar", quien, cuando: ahora.toISOString(), detalle: { id: ped.id, numero: p.numero, medio, monto } });
    return { id: ped.id, numero: p.numero, estado: "aprobado" };
  });
  await facturarSiHaceFalta(r.id);
  return r;
};

// Deshacer un pago marcado a mano por error. Los de Mercado Pago no: esos
// se devuelven (y la plata vuelve a la clienta).
export const anularPago = async (datos, quien) => {
  const ahora = new Date();
  const r = await db.runTransaction(async (tx) => {
    const ped = await leerPedido(tx, datos?.id);
    const [cfg] = await tx.getAll(refs.config());
    const p = ped.data();
    const c = p.cobro ?? {};
    if (c.estado !== "aprobado" || c.medio === "mercadopago") {
      throw new HttpsError("failed-precondition", c.medio === "mercadopago" ? "Un pago de Mercado Pago no se anula: se devuelve." : "No hay un pago marcado a mano para anular.");
    }
    // Si ya estaba facturado, sale la nota de crédito.
    tx.update(ped.ref, { cobro: { estado: "sin_pagar", preferencia: c.preferencia ?? null }, actualizado: ahora, ...cambiosFactura(p, "sin_pagar", cfg.data()?.facturacion) });
    tx.set(refs.seguimiento(p.token), { cobro: { estado: "sin_pagar", detalle: null } }, { merge: true });
    anotarEnAuditoria(tx, db, {
      accion: "pago.anular",
      quien,
      cuando: ahora.toISOString(),
      detalle: { id: ped.id, numero: p.numero, medio: c.medio, monto: c.monto },
    });
    return { id: ped.id, numero: p.numero, estado: "sin_pagar" };
  });
  await facturarSiHaceFalta(r.id);
  return r;
};

// Devolver un pago de Mercado Pago (el del pedido, o uno de más). La plata
// vuelve al medio con que pagó la clienta; Mercado Pago lo confirma y el
// cobro pasa a "devuelto" con el mismo circuito de los avisos.
export const devolverPago = async (datos, quien) => {
  const id = datos?.id;
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta el pedido.");
  const snap = await refs.pedido(id).get();
  if (!snap.exists) throw new HttpsError("not-found", "Ese pedido no existe.");
  const p = snap.data();
  const pedida = datos?.referencia ? String(datos.referencia) : null;
  const cual = pedida ? p.pagosDeMas?.[pedida] : p.cobro;
  if (!cual || cual.medio !== "mercadopago" || cual.estado !== "aprobado") {
    throw new HttpsError("failed-precondition", "No hay un pago de Mercado Pago aprobado para devolver.");
  }
  try {
    await mp(`/v1/payments/${cual.referencia}/refunds`, { method: "POST", body: {}, idempotencia: `devolucion-${cual.referencia}` });
  } catch (err) {
    if (err instanceof ErrorMercadoPago) {
      console.error(err.message);
      const motivo = err.cuerpo?.message ? ` (${String(err.cuerpo.message).slice(0, 120)})` : "";
      throw new HttpsError("failed-precondition", `Mercado Pago no hizo la devolución${motivo}. Probá desde tu cuenta de Mercado Pago.`);
    }
    throw err;
  }
  const lote = db.batch();
  anotarEnAuditoria(lote, db, {
    accion: "pago.devolver",
    quien,
    cuando: new Date().toISOString(),
    detalle: { id, numero: p.numero, monto: cual.monto, referencia: cual.referencia },
  });
  await lote.commit();
  // Lo que diga Mercado Pago después de devolver.
  let estado = "devuelto";
  try {
    estado = (await aplicarPago(await mp(`/v1/payments/${cual.referencia}`))).estado ?? estado;
  } catch (err) {
    console.error("Devuelto, pero no se pudo releer el pago (lo va a traer el aviso)", err);
  }
  return { id, numero: p.numero, estado };
};

// El envío se suma al confirmar; si cambió (o se olvidó), se corrige
// mientras no haya un pago en curso.
export const cambiarEnvio = async (datos, quien) => {
  const envio = datos?.envio;
  if (!Number.isInteger(envio) || envio < 0 || envio > 10_000_000) throw new HttpsError("invalid-argument", "El envío es un monto en pesos, sin centavos.");
  const ahora = new Date();
  return db.runTransaction(async (tx) => {
    const ped = await leerPedido(tx, datos?.id);
    const p = ped.data();
    if (p.estado !== "confirmado") throw new HttpsError("failed-precondition", "El envío se cambia con el pedido confirmado y antes de entregarlo.");
    if (["pendiente", "aprobado", "reclamo"].includes(p.cobro?.estado)) {
      throw new HttpsError("failed-precondition", "Ya hay un pago en curso o hecho: el envío no se puede cambiar.");
    }
    const antes = p.envio ?? 0;
    if (antes === envio) return { id: ped.id, numero: p.numero, envio, sinCambios: true };
    const aCobrar = p.total + envio;
    tx.update(ped.ref, { envio, aCobrar, actualizado: ahora });
    tx.set(refs.seguimiento(p.token), { envio, aCobrar }, { merge: true });
    anotarEnAuditoria(tx, db, { accion: "pedido.envio", quien, cuando: ahora.toISOString(), detalle: { id: ped.id, numero: p.numero, antes, despues: envio } });
    return { id: ped.id, numero: p.numero, envio, aCobrar, sinCambios: false };
  });
};

// ── Configuración del cobro ─────────────────────────────────────────
const CAMPOS_COBRO = {
  alias: (v) => {
    const t = texto(v, 30);
    if (t && !/^[a-zA-Z0-9.-]{6,20}$/.test(t)) throw new HttpsError("invalid-argument", "El alias va de 6 a 20 letras, números, puntos o guiones.");
    return t.toLowerCase();
  },
  cbu: (v) => {
    const t = typeof v === "string" ? v.replace(/[\s-]/g, "") : "";
    if (t && !/^\d{22}$/.test(t)) throw new HttpsError("invalid-argument", "El CBU o CVU son 22 números.");
    return t;
  },
  titular: (v) => texto(v, 60),
  banco: (v) => texto(v, 40),
  mercadopago: (v) => {
    if (typeof v !== "boolean") throw new HttpsError("invalid-argument", "Mercado Pago: sí o no.");
    return v;
  },
};

// Qué ve la clienta para pagar. Queda en interno/config (solo el equipo) y
// se copia al seguimiento de cada pedido confirmado.
export const guardarCobro = async (datos, quien) => {
  const cambios = {};
  for (const [campo, validar] of Object.entries(CAMPOS_COBRO)) {
    if (datos?.[campo] !== undefined) cambios[campo] = validar(datos[campo]);
  }
  if (!Object.keys(cambios).length) throw new HttpsError("invalid-argument", "No hay nada para guardar.");

  if (cambios.mercadopago) {
    if (!hayMercadoPago()) {
      throw new HttpsError("failed-precondition", "Falta conectar la cuenta de Mercado Pago en el servidor (el token). Mirá el LEEME, «Cobrar con Mercado Pago».");
    }
    try {
      await mp("/users/me");
    } catch (err) {
      if (err instanceof ErrorMercadoPago && [401, 403].includes(err.status)) {
        throw new HttpsError("failed-precondition", "Mercado Pago no acepta el token cargado en el servidor. Revisá que sea el Access Token de producción.");
      }
      throw noRespondio(err);
    }
  }
  const ahora = new Date();

  const resultado = await db.runTransaction(async (tx) => {
    const [cfg] = await tx.getAll(refs.config());
    const actual = cfg.data()?.cobro ?? {};
    const distintos = Object.keys(cambios).filter((k) => (actual[k] ?? (k === "mercadopago" ? false : "")) !== cambios[k]);
    if (!distintos.length) return { cambiados: [], cobro: actual };
    const cobro = { ...actual, ...cambios };
    tx.set(refs.config(), { cobro }, { merge: true });
    anotarEnAuditoria(tx, db, {
      accion: "cobro.guardar",
      quien,
      cuando: ahora.toISOString(),
      detalle: Object.fromEntries(distintos.map((k) => [k, { antes: actual[k] ?? null, despues: cambios[k] }])),
    });
    return { cambiados: distintos, cobro };
  });
  if (!resultado.cambiados.length) return { cambiados: [] };

  // Los pedidos confirmados que todavía no se pagaron ven los datos nuevos.
  const abiertos = await db.collection("pedidos").where("estado", "in", COBRABLES).limit(450).get();
  const lote = db.batch();
  let n = 0;
  for (const d of abiertos.docs) {
    const p = d.data();
    if (["aprobado", "reclamo", "devuelto"].includes(p.cobro?.estado) || !p.token) continue;
    lote.set(refs.seguimiento(p.token), { pagar: vistaPagar(resultado.cobro) }, { merge: true });
    n++;
  }
  if (n) await lote.commit();
  return { cambiados: resultado.cambiados, actualizados: n };
};
