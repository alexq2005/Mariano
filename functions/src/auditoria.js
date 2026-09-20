import { nivelDe } from "./permisos.js";

// Historial de operaciones: quién hizo qué y cuándo.
//
// Se escribe DENTRO de la misma transacción que el cambio. Si se hiciera
// después, un corte de red en el medio dejaría el cambio sin registrar y el
// historial mentiría. Y como solo lo escribe el servidor, desde el panel no
// se puede falsear ni borrar (firestore.rules no permite escribir acá).
export const anotarEnAuditoria = (tx, db, { accion, quien, detalle, cuando }) => {
  const ref = db.collection("auditoria").doc();
  tx.create(ref, {
    accion,
    nivel: nivelDe(accion),
    cuando,
    quien: { uid: quien.uid, email: quien.email ?? null, rol: quien.rol },
    detalle: detalle ?? {},
  });
  return ref.id;
};
