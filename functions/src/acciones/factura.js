import { randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/https";
import { db, FieldValue } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { cuitValido, sanearFiscal, validarFiscal } from "../compartido/fiscal.js";
import {
  armarComprobante,
  coincide,
  CONDICIONES_EMISOR,
  ErrorFactura,
  fechaArca,
  fechaDeArca,
  importes,
  mesDeArca,
  NC_DE,
  numeroTexto,
  receptorArca,
  TIPOS,
  tipoComprobante,
  urlQR,
} from "../arca/logica.js";
import { consultarComprobante, estadoServidores, hayCertificado, obtenerTA, solicitarCAE, ultimoAutorizado } from "../arca/arca.js";

// La factura se hace sola al cobrar, y la nota de crédito al devolver.
//
// Quien cambia el cobro (el aviso de Mercado Pago, "Marcar pagado",
// "Devolver") deja marcado el trabajo en pedido.factura.estado, en la misma
// transacción del cobro:
//
//   pendiente   hay que facturar          anular      hay que hacer la nota de crédito
//   emitiendo   se está pidiendo el CAE   anulando    ídem, para la nota de crédito
//   emitida     listo                     anulada     listo
//   error       no se pudo (con el motivo; se reintenta solo si es pasajero)
//   cancelada   se anuló el cobro antes de facturar
//
// Apenas se guarda el cobro, la misma función hace el trabajo contra ARCA
// (facturarSiHaceFalta), de a un comprobante por vez en todo el sistema
// (un candado en sistema/): ARCA numera en orden y dos a la vez pedirían el
// mismo número. Si no sale (ARCA caído), queda el error y cada 30 minutos se
// reintenta solo.

const SISTEMA = { uid: "arca", email: null, rol: "sistema" };
const PAGADO = ["aprobado", "reclamo"];
const pagado = (estadoCobro) => PAGADO.includes(estadoCobro);
const aCobrarDe = (p) => p.aCobrar ?? p.total + (p.envio ?? 0);
const texto = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// ── Lo que cambia en la factura cuando cambia el cobro ──────────────
// Lo usan las acciones de cobro (cobro.js), dentro de su transacción.
export const cambiosFactura = (p, estadoCobro, facturacion) => {
  const f = p.factura ?? null;
  // Si justo se está emitiendo, lo resuelve quien emite al terminar.
  if (["emitiendo", "anulando"].includes(f?.estado)) return {};
  const ahora = new Date();
  if (pagado(estadoCobro) && !p.facturaVigente) {
    if (!facturacion?.activa) return {};
    return { factura: { estado: "pendiente", error: null, intentos: 0, cuando: ahora } };
  }
  if (!pagado(estadoCobro) && p.facturaVigente) return { factura: { estado: "anular", error: null, intentos: 0, cuando: ahora } };
  if (!pagado(estadoCobro) && ["pendiente", "error"].includes(f?.estado)) return { factura: { estado: "cancelada", error: null, cuando: ahora } };
  return {};
};

// ── Emitir ──────────────────────────────────────────────────────────
const validarEmisor = (conf, { paraAnular = false } = {}) => {
  if (!conf?.activa && !paraAnular) throw new ErrorFactura("La facturación está apagada (panel → Configuración → Facturación).");
  if (!CONDICIONES_EMISOR[conf?.condicion]) throw new ErrorFactura("Falta la condición del negocio ante el IVA (Configuración → Facturación).");
  if (!cuitValido(conf.cuit)) throw new ErrorFactura("El CUIT del negocio no es válido (Configuración → Facturación).");
  if (!Number.isInteger(conf.ptoVta) || conf.ptoVta < 1) throw new ErrorFactura("Falta el punto de venta (Configuración → Facturación).");
  if (!["homologacion", "produccion"].includes(conf.ambiente)) throw new ErrorFactura("Falta elegir el ambiente de ARCA (Configuración → Facturación).");
};

// Qué comprobante, por cuánto y a quién.
const planear = (p, conf, clase) => {
  if (clase === "factura") {
    const total = aCobrarDe(p);
    return { clase, tipo: tipoComprobante(conf.condicion, p.fiscal?.condicion ?? "consumidor_final"), total, receptor: receptorArca(p.fiscal, total), asociado: null };
  }
  const v = p.facturaVigente;
  if (!v) throw new ErrorFactura("No hay factura para anular.");
  return {
    clase,
    tipo: NC_DE[v.tipo],
    total: v.total,
    receptor: v.receptor,
    asociado: { Tipo: v.tipo, PtoVta: v.ptoVta, Nro: v.numero, Cuit: Number(conf.cuit), CbteFch: v.fecha },
  };
};

// La reserva del número: se guarda ANTES de pedir el CAE. Si la respuesta de
// ARCA se corta, en el próximo intento se consulta ese número: si ARCA lo
// registró, se usa ese comprobante y no se emite otro.
const refReserva = (conf, tipo) => db.collection("sistema").doc(`arca-reserva-${conf.ambiente}-${conf.ptoVta}-${tipo}`);
const RESERVA_FRESCA = 2 * 60e3;

const emitirConReserva = async (id, conf, ta, plan) => {
  const ref = refReserva(conf, plan.tipo);
  const fecha = fechaArca(new Date());
  const comp = armarComprobante({ tipo: plan.tipo, ptoVta: conf.ptoVta, fecha, total: plan.total, receptor: plan.receptor, asociado: plan.asociado });
  let ultimo = await ultimoAutorizado(conf, ta, plan.tipo);

  const previa = (await ref.get()).data();
  if (previa) {
    const esMia = previa.pedidoId === id;
    if (!esMia && Date.now() - previa.cuando < RESERVA_FRESCA) {
      throw new ErrorFactura("Hay otro comprobante emitiéndose. Se reintenta.", { temporal: true });
    }
    if (ultimo >= previa.numero) {
      const ya = await consultarComprobante(conf, ta, plan.tipo, previa.numero);
      if (ya && coincide(ya, previa.comp)) {
        const recuperado = { numero: previa.numero, fecha: ya.CbteFch, cae: ya.CodAutorizacion, caeVto: ya.FchVto, recuperado: true };
        if (esMia) return recuperado;
        // Era de otro pedido que se quedó sin respuesta: se lo guarda a él.
        await guardarEmitido(previa.pedidoId, conf, previa.plan, recuperado);
        ultimo = await ultimoAutorizado(conf, ta, plan.tipo);
      } else {
        await ref.delete();
      }
    } else {
      // Nunca llegó a ARCA: el número sigue libre.
      await ref.delete();
    }
  }

  const numero = ultimo + 1;
  await ref.set({ pedidoId: id, numero, cuando: Date.now(), plan, comp: { ImpTotal: comp.ImpTotal, DocTipo: comp.DocTipo, DocNro: comp.DocNro } });
  try {
    const r = await solicitarCAE(conf, ta, comp, numero);
    return { numero, fecha, cae: r.cae, caeVto: r.caeVto };
  } catch (err) {
    // Rechazado: el número no se usó y queda libre. Incierto: se deja la
    // reserva para averiguarlo en el próximo intento.
    if (!err.incierto) await ref.delete();
    throw err;
  }
};

// Guarda el comprobante: la vista pública (comprobantes/{token}, la que ve
// e imprime la clienta), el resumen en el pedido y en su seguimiento, y el
// historial. Todo junto.
const guardarEmitido = async (id, conf, plan, hecho) => {
  const ahora = new Date();
  const token = randomBytes(16).toString("hex");
  const info = TIPOS[plan.tipo];
  const imp = importes(plan.total, info.letra);
  const nt = numeroTexto(conf.ptoVta, hecho.numero);
  const asociadoTexto = plan.asociado ? `${TIPOS[plan.asociado.Tipo].nombre} ${numeroTexto(plan.asociado.PtoVta, plan.asociado.Nro)}` : null;

  await db.runTransaction(async (tx) => {
    const [ped, res] = await tx.getAll(refs.pedido(id), refReserva(conf, plan.tipo));
    const p = ped.data();
    const items =
      plan.clase === "factura"
        ? [
            ...p.items.map((i) => ({ desc: i.nom, cod: i.cod ?? null, cant: i.cant, unit: i.unit, sub: i.sub })),
            ...(p.envio ? [{ desc: "Envío", cod: null, cant: 1, unit: p.envio, sub: p.envio }] : []),
          ]
        : [{ desc: `Anulación de ${asociadoTexto}`, cod: null, cant: 1, unit: imp.total, sub: imp.total }];

    tx.create(refs.comprobante(token), {
      pedidoId: id,
      pedido: p.numero,
      clase: plan.clase,
      tipo: plan.tipo,
      letra: info.letra,
      nombre: info.nombre,
      codigo: info.codigo,
      ptoVta: conf.ptoVta,
      numero: hecho.numero,
      numeroTexto: nt,
      fecha: fechaDeArca(hecho.fecha),
      fechaArca: hecho.fecha,
      mes: mesDeArca(hecho.fecha),
      emisor: {
        razon_social: conf.razon_social ?? "",
        cuit: conf.cuit,
        domicilio: conf.domicilio ?? "",
        condicion: CONDICIONES_EMISOR[conf.condicion],
        iibb: conf.iibb ?? "",
        inicio: conf.inicio ?? "",
      },
      receptor: {
        nombre: plan.receptor.nombre || (plan.receptor.DocTipo === 99 ? "Consumidor final" : ""),
        condicion: plan.receptor.condicion,
        condicionId: plan.receptor.CondicionIVAReceptorId,
        doc: plan.receptor.doc ?? "",
      },
      items,
      total: imp.total,
      neto: imp.neto,
      iva: imp.iva,
      alicuota: info.letra === "C" ? null : 21,
      cae: hecho.cae,
      caeVto: hecho.caeVto,
      qr: urlQR({
        fecha: hecho.fecha,
        cuit: conf.cuit,
        ptoVta: conf.ptoVta,
        tipo: plan.tipo,
        numero: hecho.numero,
        total: imp.total,
        docTipo: plan.receptor.DocTipo,
        docNro: plan.receptor.DocNro,
        cae: hecho.cae,
      }),
      asociado: plan.asociado ? { nombre: asociadoTexto, fecha: plan.asociado.CbteFch } : null,
      ambiente: conf.ambiente,
      creado: ahora,
    });

    const resumen = { token, clase: plan.clase, tipo: plan.tipo, nombre: info.nombre, numeroTexto: nt, fecha: hecho.fecha, total: imp.total, cae: hecho.cae, ambiente: conf.ambiente };
    const cambios = { comprobantes: FieldValue.arrayUnion(resumen), actualizado: ahora };
    const sigue = pagado(p.cobro?.estado);
    if (plan.clase === "factura") {
      cambios.facturaVigente = { ...resumen, ptoVta: conf.ptoVta, numero: hecho.numero, receptor: plan.receptor };
      // Si mientras se emitía se devolvió el pago, ahora va la nota de crédito.
      cambios.factura = { estado: sigue ? "emitida" : "anular", error: null, intentos: 0, cuando: ahora };
    } else {
      cambios.facturaVigente = null;
      cambios.factura = { estado: sigue ? "pendiente" : "anulada", error: null, intentos: 0, cuando: ahora };
    }
    tx.update(ped.ref, cambios);
    tx.set(
      refs.seguimiento(p.token),
      { comprobantes: FieldValue.arrayUnion({ token, nombre: info.nombre, numeroTexto: nt, fecha: hecho.fecha, total: imp.total, ambiente: conf.ambiente }) },
      { merge: true },
    );
    if (res.exists && res.data().pedidoId === id && res.data().numero === hecho.numero) tx.delete(res.ref);
    anotarEnAuditoria(tx, db, {
      accion: plan.clase === "factura" ? "factura.emitida" : "factura.anulada",
      quien: SISTEMA,
      cuando: ahora.toISOString(),
      detalle: { id, numero: p.numero, comprobante: `${info.nombre} ${nt}`, total: imp.total, cae: hecho.cae, ambiente: conf.ambiente, ...(hecho.recuperado ? { recuperado: true } : {}) },
    });
  });
  return token;
};

const guardarError = async (id, clase, err) => {
  await refs.pedido(id).update({
    "factura.estado": "error",
    "factura.reintentar": clase === "factura" ? "pendiente" : "anular",
    "factura.error": String(err?.message ?? err).slice(0, 500),
    "factura.temporal": Boolean(err?.temporal),
    "factura.cuando": new Date(),
  });
};

// Un pedido marcado: toma el trabajo, lo hace y guarda el resultado.
const procesarFactura = async (id) => {
  const ahora = new Date();
  const t = await db.runTransaction(async (tx) => {
    const [ped, cfg] = await tx.getAll(refs.pedido(id), refs.config());
    if (!ped.exists) return null;
    const p = ped.data();
    const estado = p.factura?.estado;
    if (estado !== "pendiente" && estado !== "anular") return null;
    const clase = estado === "pendiente" ? "factura" : "nc";
    tx.update(ped.ref, {
      "factura.estado": clase === "factura" ? "emitiendo" : "anulando",
      "factura.desde": ahora,
      "factura.intentos": FieldValue.increment(1),
      "factura.error": null,
    });
    return { p, conf: cfg.data()?.facturacion ?? {}, clase };
  });
  if (!t) return { nada: true };
  const { p, conf, clase } = t;

  try {
    // Una factura de prueba (homologación) no necesita nota de crédito real.
    if (clase === "nc" && p.facturaVigente?.ambiente === "homologacion" && conf.ambiente !== "homologacion") {
      await refs.pedido(id).update({ facturaVigente: null, factura: { estado: "anulada", error: null, nota: "Era una factura de prueba: no hizo falta nota de crédito.", cuando: new Date() } });
      return { estado: "anulada" };
    }
    validarEmisor(conf, { paraAnular: clase === "nc" });
    const plan = planear(p, conf, clase);
    const ta = await obtenerTA(conf.ambiente);
    const hecho = await emitirConReserva(id, conf, ta, plan);
    await guardarEmitido(id, conf, plan, hecho);
    return { estado: clase === "factura" ? "emitida" : "anulada", numero: hecho.numero };
  } catch (err) {
    if (!(err instanceof ErrorFactura)) console.error("Error inesperado al facturar el pedido", id, err);
    await guardarError(id, clase, err);
    return { error: err.message };
  }
};

// ── De a uno por vez ────────────────────────────────────────────────
// Un candado con vencimiento: si la función se corta con el candado tomado,
// a los 90 segundos se libera solo.
const refCandado = () => db.collection("sistema").doc("arca-candado");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const conCandado = async (fn) => {
  const yo = randomBytes(8).toString("hex");
  for (let intento = 0; intento < 30; intento++) {
    const tomado = await db.runTransaction(async (tx) => {
      const [c] = await tx.getAll(refCandado());
      if (c.exists && c.data().hasta > Date.now()) return false;
      tx.set(refCandado(), { yo, hasta: Date.now() + 90e3 });
      return true;
    });
    if (tomado) {
      try {
        return await fn();
      } finally {
        await db.runTransaction(async (tx) => {
          const [c] = await tx.getAll(refCandado());
          if (c.exists && c.data().yo === yo) tx.delete(c.ref);
        });
      }
    }
    await esperar(400 + Math.random() * 400);
  }
  return null; // ocupado: queda marcado y lo toma el próximo intento
};

// Lo llaman las acciones de cobro después de guardar: si el pedido quedó
// marcado para facturar (o anular), lo hace ya. Nunca falla hacia afuera: el
// cobro ya se guardó y un problema con ARCA queda escrito en el pedido.
export const facturarSiHaceFalta = async (id) => {
  try {
    const marcado = (p) => ["pendiente", "anular"].includes(p?.factura?.estado);
    if (!id || !marcado((await refs.pedido(id).get()).data())) return null;
    return await conCandado(async () => {
      let r = null;
      // Hasta 3 vueltas: si mientras se facturaba se devolvió el pago, en la
      // misma pasada sale también la nota de crédito.
      for (let i = 0; i < 3 && marcado((await refs.pedido(id).get()).data()); i++) r = await procesarFactura(id);
      return r;
    });
  } catch (err) {
    console.error("No se pudo facturar el pedido", id, err);
    return null;
  }
};

// Cada 30 minutos: reintenta lo que falló por algo pasajero (ARCA caído) y
// destraba lo que quedó a medias (la función se cortó emitiendo).
export const revisarFacturas = async () => {
  const q = await db.collection("pedidos").where("factura.estado", "in", ["pendiente", "anular", "error", "emitiendo", "anulando"]).limit(50).get();
  const ahora = Date.now();
  let n = 0;
  for (const d of q.docs) {
    const f = d.data().factura;
    const desde = f.desde?.toMillis?.() ?? 0;
    if (f.estado === "error" && f.temporal && (f.intentos ?? 0) < 20) {
      await d.ref.update({ "factura.estado": f.reintentar });
    } else if (["emitiendo", "anulando"].includes(f.estado) && ahora - desde > 10 * 60e3) {
      await d.ref.update({ "factura.estado": f.estado === "emitiendo" ? "pendiente" : "anular" });
    } else if (!["pendiente", "anular"].includes(f.estado)) {
      continue;
    }
    if (await facturarSiHaceFalta(d.id)) n++;
  }
  return { procesados: n };
};

// ── El panel ────────────────────────────────────────────────────────
const quienCorto = (quien) => ({ nombre: quien.nombre ?? quien.email ?? "", rol: quien.rol });

const conPedido = (id, fn) => {
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta el pedido.");
  return db.runTransaction(async (tx) => {
    const [ped, cfg] = await tx.getAll(refs.pedido(id), refs.config());
    if (!ped.exists) throw new HttpsError("not-found", "Ese pedido no existe.");
    return fn(tx, ped, ped.data(), cfg.data()?.facturacion ?? {});
  });
};

// "Reintentar": lo que quedó con error, o trabado emitiendo hace rato.
export const reintentarFactura = async (datos, quien) => {
  const r = await conPedido(datos?.id, (tx, ped, p) => {
    const f = p.factura ?? {};
    const trabado = ["emitiendo", "anulando"].includes(f.estado) && Date.now() - (f.desde?.toMillis?.() ?? 0) > 5 * 60e3;
    let estado;
    if (f.estado === "error") estado = f.reintentar;
    else if (trabado) estado = f.estado === "emitiendo" ? "pendiente" : "anular";
    else throw new HttpsError("failed-precondition", "No hay nada para reintentar.");
    tx.update(ped.ref, { "factura.estado": estado, "factura.intentos": 0 });
    anotarEnAuditoria(tx, db, { accion: "factura.reintentar", quien, cuando: new Date().toISOString(), detalle: { id: ped.id, numero: p.numero } });
    return { estado };
  });
  return { ...r, resultado: await facturarSiHaceFalta(datos.id) };
};

// "Emitir factura": un pedido pagado sin factura (por ejemplo, cobrado antes
// de prender la facturación).
export const emitirFactura = async (datos, quien) => {
  const r = await conPedido(datos?.id, (tx, ped, p, conf) => {
    if (!conf.activa) throw new HttpsError("failed-precondition", "La facturación está apagada (Configuración → Facturación).");
    if (!pagado(p.cobro?.estado)) throw new HttpsError("failed-precondition", "Se factura lo cobrado: este pedido todavía no figura pagado.");
    if (p.facturaVigente) throw new HttpsError("failed-precondition", "Este pedido ya tiene factura.");
    if (["pendiente", "emitiendo", "anular", "anulando"].includes(p.factura?.estado)) throw new HttpsError("failed-precondition", "La factura ya se está emitiendo.");
    tx.update(ped.ref, { factura: { estado: "pendiente", error: null, intentos: 0, cuando: new Date(), pedidaPor: quienCorto(quien) } });
    anotarEnAuditoria(tx, db, { accion: "factura.emitir", quien, cuando: new Date().toISOString(), detalle: { id: ped.id, numero: p.numero } });
    return { estado: "pendiente" };
  });
  return { ...r, resultado: await facturarSiHaceFalta(datos.id) };
};

// "Datos para la factura": CUIT y condición, o DNI (antes de facturar).
export const guardarFiscalPedido = async (datos, quien) => {
  const fiscal = sanearFiscal(datos?.fiscal);
  const errores = validarFiscal(fiscal);
  if (Object.keys(errores).length) throw new HttpsError("invalid-argument", Object.values(errores)[0], { errores });
  return conPedido(datos?.id, (tx, ped, p) => {
    if (p.facturaVigente || ["emitiendo", "anulando"].includes(p.factura?.estado)) {
      throw new HttpsError("failed-precondition", "El pedido ya está facturado: para cambiar los datos hay que anular esa factura.");
    }
    tx.update(ped.ref, { fiscal, actualizado: new Date() });
    anotarEnAuditoria(tx, db, {
      accion: "pedido.fiscal",
      quien,
      cuando: new Date().toISOString(),
      // Sin el DNI: el historial no guarda datos personales de más.
      detalle: { id: ped.id, numero: p.numero, condicion: fiscal.condicion, ...(fiscal.cuit ? { cuit: fiscal.cuit } : {}), ...(fiscal.dni ? { conDni: true } : {}) },
    });
    return { fiscal };
  });
};

// ── Configuración de la facturación ─────────────────────────────────
const CAMPOS = {
  activa: (v) => {
    if (typeof v !== "boolean") throw new HttpsError("invalid-argument", "Facturación: sí o no.");
    return v;
  },
  condicion: (v) => {
    if (!CONDICIONES_EMISOR[v]) throw new HttpsError("invalid-argument", "Elegí monotributo o responsable inscripto.");
    return v;
  },
  cuit: (v) => {
    const c = typeof v === "string" ? v.replace(/\D/g, "") : "";
    if (c && !cuitValido(c)) throw new HttpsError("invalid-argument", "El CUIT del negocio no es válido: son 11 números.");
    return c;
  },
  razon_social: (v) => texto(v, 80),
  domicilio: (v) => texto(v, 120),
  iibb: (v) => texto(v, 40),
  inicio: (v) => {
    const t = texto(v, 10);
    if (t && !/^\d{2}\/\d{2}\/\d{4}$/.test(t)) throw new HttpsError("invalid-argument", "El inicio de actividades va como dd/mm/aaaa.");
    return t;
  },
  ptoVta: (v) => {
    if (!Number.isInteger(v) || v < 1 || v > 99998) throw new HttpsError("invalid-argument", "El punto de venta es un número entre 1 y 99998.");
    return v;
  },
  ambiente: (v) => {
    if (!["homologacion", "produccion"].includes(v)) throw new HttpsError("invalid-argument", "El ambiente es homologación (pruebas) o producción.");
    return v;
  },
};
const OBLIGATORIOS = { condicion: "la condición ante el IVA", cuit: "el CUIT", razon_social: "la razón social", domicilio: "el domicilio comercial", inicio: "el inicio de actividades", ptoVta: "el punto de venta", ambiente: "el ambiente" };

export const guardarFacturacion = async (datos, quien) => {
  const cambios = {};
  for (const [campo, validar] of Object.entries(CAMPOS)) {
    if (datos?.[campo] !== undefined) cambios[campo] = validar(datos[campo]);
  }
  if (!Object.keys(cambios).length) throw new HttpsError("invalid-argument", "No hay nada para guardar.");
  const ahora = new Date();
  return db.runTransaction(async (tx) => {
    const [cfg, cat] = await tx.getAll(refs.config(), refs.catalogo());
    const actual = cfg.data()?.facturacion ?? {};
    const nueva = { ...actual, ...cambios };
    if (nueva.activa) {
      const falta = Object.entries(OBLIGATORIOS).find(([k]) => !nueva[k]);
      if (falta) throw new HttpsError("failed-precondition", `Para prender la facturación falta ${falta[1]}.`);
      if (!hayCertificado()) {
        throw new HttpsError("failed-precondition", "Falta el certificado de ARCA en el servidor. Mirá el LEEME, «Facturar con ARCA».");
      }
    }
    const distintos = Object.keys(cambios).filter((k) => actual[k] !== cambios[k]);
    if (!distintos.length) return { cambiados: [] };
    tx.set(refs.config(), { facturacion: nueva }, { merge: true });
    // La tienda solo sabe si se factura (para ofrecer "factura con CUIT").
    if (cat.exists && Boolean(cat.data().config?.emite_factura) !== Boolean(nueva.activa)) {
      tx.update(refs.catalogo(), { "config.emite_factura": Boolean(nueva.activa), version: ahora.toISOString() });
    }
    anotarEnAuditoria(tx, db, {
      accion: "facturacion.guardar",
      quien,
      cuando: ahora.toISOString(),
      detalle: Object.fromEntries(distintos.map((k) => [k, { antes: actual[k] ?? null, despues: cambios[k] }])),
    });
    return { cambiados: distintos };
  });
};

// "Probar conexión": servidores de ARCA, el certificado y el último número
// de cada comprobante. No emite nada.
export const probarArca = async () => {
  const conf = (await refs.config().get()).data()?.facturacion ?? {};
  try {
    validarEmisor(conf, { paraAnular: true });
    const servidores = await estadoServidores(conf.ambiente);
    const ta = await obtenerTA(conf.ambiente);
    const tipos = conf.condicion === "monotributo" ? [11] : [1, 6];
    const ultimos = [];
    for (const tipo of tipos) {
      const n = await ultimoAutorizado(conf, ta, tipo);
      ultimos.push({ nombre: TIPOS[tipo].nombre, ultimo: n ? numeroTexto(conf.ptoVta, n) : "ninguno todavía" });
    }
    return { ok: true, ambiente: conf.ambiente, servidores, ultimos };
  } catch (err) {
    if (err instanceof ErrorFactura) throw new HttpsError("failed-precondition", err.message);
    throw err;
  }
};
