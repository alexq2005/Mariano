import { HttpsError } from "firebase-functions/https";
import { db } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { numeroWhatsAppValido } from "../compartido/whatsapp.js";

const texto = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const entero = (v, min, max, que) => {
  if (!Number.isInteger(v) || v < min || v > max) throw new HttpsError("invalid-argument", `${que}: un número entero entre ${min} y ${max}.`);
  return v;
};

// Cada campo que se puede cambiar desde el panel, con su validación. Lo que
// no está acá no se toca (por ejemplo, las fotos de portada de los rubros).
const CAMPOS = {
  nombre_negocio: (v) => {
    const t = texto(v, 40);
    if (!t) throw new HttpsError("invalid-argument", "Falta el nombre del negocio.");
    return t;
  },
  whatsapp: (v) => {
    const n = typeof v === "string" ? v.replace(/\D/g, "") : "";
    if (!numeroWhatsAppValido(n)) {
      throw new HttpsError("invalid-argument", "El WhatsApp va con 549 + característica sin 0 + número sin 15. Ej.: 5491145678901.");
    }
    return n;
  },
  minimo_mayor: (v) => entero(v, 2, 1000, "El mínimo por mayor"),
  pedido_minimo: (v) => entero(v, 0, 100_000_000, "El pedido mínimo"),
  actualizado: (v) => {
    const t = texto(v, 40);
    if (!t) throw new HttpsError("invalid-argument", "Falta la fecha de la lista de precios.");
    return t;
  },
  precios_confirmados: (v) => {
    if (typeof v !== "boolean") throw new HttpsError("invalid-argument", "Precios confirmados: sí o no.");
    return v;
  },
  formas_entrega: (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 6) throw new HttpsError("invalid-argument", "Entre 1 y 6 formas de entrega.");
    const ids = new Set();
    return v.map((f) => {
      const nombre = texto(f?.nombre, 60);
      const id = texto(f?.id, 30).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!nombre || !id) throw new HttpsError("invalid-argument", "Cada forma de entrega necesita un nombre.");
      if (ids.has(id)) throw new HttpsError("invalid-argument", "Hay dos formas de entrega iguales.");
      ids.add(id);
      return { id, nombre, pide_direccion: f?.pide_direccion === true };
    });
  },
  instagram: (v) => {
    const t = texto(v, 40).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
    if (t && !/^[a-zA-Z0-9._]{1,30}$/.test(t)) throw new HttpsError("invalid-argument", "El usuario de Instagram solo lleva letras, números, puntos y guiones bajos.");
    return t;
  },
  email_contacto: (v) => {
    const t = texto(v, 120);
    if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) throw new HttpsError("invalid-argument", "El email de contacto no parece válido.");
    return t;
  },
  direccion_retiro: (v) => texto(v, 120),
  formas_pago: (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 8) throw new HttpsError("invalid-argument", "Entre 1 y 8 formas de pago.");
    const lista = v.map((f) => texto(f, 40)).filter(Boolean);
    if (lista.length !== v.length) throw new HttpsError("invalid-argument", "Hay una forma de pago vacía.");
    if (new Set(lista).size !== lista.length) throw new HttpsError("invalid-argument", "Hay dos formas de pago iguales.");
    return lista;
  },
};

// Los datos del negocio que ve la tienda: nombre, WhatsApp, mínimo por
// mayor, formas de entrega y de pago. Viajan con el catálogo, así que el
// cambio se ve en la próxima visita sin volver a publicar el sitio.
export const guardarConfig = async (datos, quien) => {
  const cambios = {};
  for (const [campo, validar] of Object.entries(CAMPOS)) {
    if (datos?.[campo] !== undefined) cambios[campo] = validar(datos[campo]);
  }
  if (!Object.keys(cambios).length) throw new HttpsError("invalid-argument", "No hay nada para guardar.");
  const ahora = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const [cat] = await tx.getAll(refs.catalogo());
    if (!cat.exists) throw new HttpsError("failed-precondition", "Todavía no se publicó el catálogo.");
    const actual = cat.data().config ?? {};
    const distintos = Object.keys(cambios).filter((k) => JSON.stringify(actual[k]) !== JSON.stringify(cambios[k]));
    if (!distintos.length) return { cambiados: [] };
    tx.update(refs.catalogo(), { config: { ...actual, ...cambios }, version: ahora });
    anotarEnAuditoria(tx, db, {
      accion: "config.guardar",
      quien,
      cuando: ahora,
      detalle: Object.fromEntries(distintos.map((k) => [k, { antes: actual[k] ?? null, despues: cambios[k] }])),
    });
    return { cambiados: distintos };
  });
};
