import { HttpsError } from "firebase-functions/https";
import { db } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { calcularPrecios, CAMPOS_PRIVADOS } from "../compartido/formula.js";
import { fechaCorta } from "../tiempo.js";

// Recalcular todos los precios con otro dólar, factor de importación o
// margen. Solo el programador: estos números dicen cuánto gana el negocio.
// Con `aplicar: false` devuelve una vista previa sin tocar nada.
//
// Solo cambian los productos con costo cargado (privado/costos, que sube
// npm run publicar). Los que se dieron de alta en el panel sin costo
// conservan el precio que se les puso a mano.
export const recalcularPrecios = async (datos, quien) => {
  const parametros = Object.fromEntries(CAMPOS_PRIVADOS.map((c) => [c, datos?.parametros?.[c]]));
  try {
    calcularPrecios(1, parametros); // valida: todos números mayores que 0
  } catch (err) {
    throw new HttpsError("invalid-argument", err.message.replace(/^formula: /, ""));
  }
  const aplicar = datos?.aplicar === true;
  const ahora = new Date();

  const calcular = (cat, costosSnap) => {
    if (!cat.exists) throw new HttpsError("failed-precondition", "Todavía no se publicó el catálogo.");
    const costos = costosSnap.exists ? (costosSnap.data().costos ?? {}) : {};
    const productos = cat.data().productos ?? [];
    const cambios = [];
    const nuevos = productos.map((p) => {
      const costo = costos[p.id];
      if (typeof costo !== "number") return p;
      const { menor, mayor } = calcularPrecios(costo, parametros);
      if (menor === p.menor && mayor === p.mayor) return p;
      cambios.push({ id: p.id, nom: p.nom, antes: { menor: p.menor, mayor: p.mayor }, despues: { menor, mayor } });
      return { ...p, menor, mayor };
    });
    const conCosto = productos.filter((p) => typeof costos[p.id] === "number").length;
    return { nuevos, cambios, conCosto, total: productos.length };
  };

  if (!aplicar) {
    const [cat, costos] = await db.getAll(refs.catalogo(), refs.costos());
    const { cambios, conCosto, total } = calcular(cat, costos);
    return { aplicado: false, total, conCosto, sinCosto: total - conCosto, cambian: cambios.length, ejemplos: cambios.slice(0, 12) };
  }

  return db.runTransaction(async (tx) => {
    const [cat, costos, previos] = await tx.getAll(refs.catalogo(), refs.costos(), refs.precios());
    const { nuevos, cambios, conCosto, total } = calcular(cat, costos);
    const lista = fechaCorta(ahora);
    tx.update(refs.catalogo(), { productos: nuevos, "config.actualizado": lista, version: ahora.toISOString() });
    tx.set(refs.precios(), { parametros, actualizado: ahora });
    tx.set(refs.respaldo(), { parametrosAnteriores: previos.exists ? (previos.data().parametros ?? null) : null, cuando: ahora });
    anotarEnAuditoria(tx, db, {
      accion: "precios.recalcular",
      quien,
      cuando: ahora.toISOString(),
      detalle: {
        antes: previos.exists ? (previos.data().parametros ?? null) : null,
        despues: parametros,
        cambian: cambios.length,
      },
    });
    return { aplicado: true, total, conCosto, sinCosto: total - conCosto, cambian: cambios.length, lista };
  });
};
