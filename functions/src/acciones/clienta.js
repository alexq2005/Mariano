import { HttpsError } from "firebase-functions/https";
import { db } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";

// Borrar los datos de una clienta (Ley 25.326: tiene derecho a pedirlo). Su
// ficha se borra y sus pedidos quedan anónimos: los números de ventas siguen
// cerrando, pero ya no dicen de quién eran.
export const borrarClienta = async (datos, quien) => {
  const { id } = datos ?? {};
  if (typeof id !== "string" || !id.startsWith("tel-")) throw new HttpsError("invalid-argument", "Falta la clienta.");
  const ficha = await refs.clienta(id).get();
  if (!ficha.exists) throw new HttpsError("not-found", "Esa clienta ya no está.");

  const pedidos = await db.collection("pedidos").where("clientaId", "==", id).limit(450).get();
  const lote = db.batch();
  for (const p of pedidos.docs) {
    lote.update(p.ref, {
      clienta: { nombre: "Clienta borrada", telefono: null, email: null },
      "entrega.direccion": null,
      comentarios: null,
      clientaId: null,
    });
  }
  lote.delete(refs.clienta(id));
  anotarEnAuditoria(lote, db, {
    accion: "clienta.borrar",
    quien,
    cuando: new Date().toISOString(),
    detalle: { pedidosAnonimizados: pedidos.size },
  });
  await lote.commit();
  return { borrada: true, pedidosAnonimizados: pedidos.size };
};
