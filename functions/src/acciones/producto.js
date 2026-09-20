import { HttpsError } from "firebase-functions/https";
import { db } from "../firebase.js";
import { anotarEnAuditoria } from "../auditoria.js";

// Pausar un producto = sacarlo de la tienda sin borrarlo. Sirve cuando se
// acabó, cuando el proveedor lo discontinuó o cuando hay que corregir algo
// antes de seguir vendiéndolo. Reactivarlo lo vuelve a mostrar.
//
// El catálogo es UN documento con todos los productos (así cada visita a la
// tienda cuesta una lectura), así que el cambio se hace en una transacción:
// si dos personas pausan productos distintos al mismo tiempo, no se pisan.
export const pausarProducto = async (datos, quien) => {
  const { id, pausar } = datos ?? {};
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta el producto.");
  if (typeof pausar !== "boolean") throw new HttpsError("invalid-argument", "Falta decir si se pausa o se reactiva.");

  const ref = db.collection("publico").doc("catalogo");
  const cuando = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("failed-precondition", "Todavía no se publicó el catálogo.");

    const productos = snap.data().productos ?? [];
    const indice = productos.findIndex((p) => p.id === id);
    if (indice < 0) throw new HttpsError("not-found", "Ese producto ya no está en el catálogo.");

    const producto = productos[indice];
    const estabaActivo = producto.activo !== false;
    if (estabaActivo === !pausar) {
      // Ya estaba así: no se escribe ni se anota nada.
      return { id, activo: estabaActivo, sinCambios: true };
    }

    const nuevos = productos.slice();
    nuevos[indice] = { ...producto, activo: !pausar };

    tx.update(ref, { productos: nuevos, version: cuando });
    anotarEnAuditoria(tx, db, {
      accion: "producto.pausar",
      quien,
      cuando,
      detalle: { id, nombre: producto.nom, activo: !pausar },
    });

    return { id, activo: !pausar, sinCambios: false };
  });
};
