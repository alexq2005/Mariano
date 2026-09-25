import { HttpsError } from "firebase-functions/https";
import { db, FieldValue } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { TOPE_UNIDADES } from "../logica-pedido.js";

// Cargar cuántas unidades hay de un producto. `cantidad: null` deja de
// controlarlo (se vende sin tope, como hasta ahora). Las cantidades viven en
// interno/stock, que solo ve el equipo; la tienda solo se entera de si un
// producto está agotado.
export const ajustarStock = async (datos, quien) => {
  const { id, cantidad } = datos ?? {};
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta el producto.");
  if (cantidad !== null && (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > TOPE_UNIDADES)) {
    throw new HttpsError("invalid-argument", `La cantidad tiene que ser un número entero entre 0 y ${TOPE_UNIDADES}.`);
  }
  const ahora = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const [cat, st] = await tx.getAll(refs.catalogo(), refs.stock());
    if (!cat.exists) throw new HttpsError("failed-precondition", "Todavía no se publicó el catálogo.");
    const productos = cat.data().productos ?? [];
    const i = productos.findIndex((p) => p.id === id);
    if (i < 0) throw new HttpsError("not-found", "Ese producto ya no está en el catálogo.");
    const antes = st.exists ? (st.data().cantidades?.[id] ?? null) : null;
    if (antes === cantidad) return { id, cantidad, sinCambios: true };

    tx.set(refs.stock(), { cantidades: { [id]: cantidad === null ? FieldValue.delete() : cantidad } }, { merge: true });
    const agotado = cantidad === 0;
    if (Boolean(productos[i].agotado) !== agotado) {
      const nuevos = productos.slice();
      nuevos[i] = { ...productos[i], agotado };
      tx.update(refs.catalogo(), { productos: nuevos, version: ahora });
    }
    anotarEnAuditoria(tx, db, {
      accion: "stock.ajustar",
      quien,
      cuando: ahora,
      detalle: { id, nombre: productos[i].nom, antes, despues: cantidad },
    });
    return { id, cantidad, agotado, sinCambios: false };
  });
};
