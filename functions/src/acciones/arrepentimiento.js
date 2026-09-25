import { randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/https";
import { db } from "../firebase.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { claveIp, refLimite, revisarLimite } from "../limites.js";

const texto = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// Botón de arrepentimiento (Disp. 954/2025): la clienta avisa que se
// arrepiente de una compra y recibe un código de trámite. El negocio lo ve
// en el panel y lo resuelve.
export const crearArrepentimiento = async (datos, { ip }) => {
  const nombre = texto(datos?.nombre, 80);
  const contacto = texto(datos?.contacto, 120);
  const motivo = texto(datos?.motivo, 500);
  const numero = datos?.numero === undefined || datos?.numero === null || datos?.numero === "" ? null : Number(datos.numero);
  if (!nombre) throw new HttpsError("invalid-argument", "Escribí tu nombre.", { errores: { nombre: "Escribí tu nombre." } });
  if (contacto.length < 6) {
    throw new HttpsError("invalid-argument", "Dejanos un teléfono o un email para responderte.", {
      errores: { contacto: "Dejanos un teléfono o un email para responderte." },
    });
  }
  if (numero !== null && (!Number.isInteger(numero) || numero < 1)) {
    throw new HttpsError("invalid-argument", "El número de pedido son solo números.", { errores: { numero: "El número de pedido son solo números." } });
  }

  const ahora = new Date();
  const codigo = `ARR-${randomBytes(3).toString("hex").toUpperCase()}`;
  const pedido = numero ? await db.collection("pedidos").where("numero", "==", numero).limit(1).get() : null;
  const ref = db.collection("arrepentimientos").doc();

  await db.runTransaction(async (tx) => {
    const [lim] = await tx.getAll(refLimite(claveIp("arrepentimiento", ip)));
    const anotar = revisarLimite(lim, {
      max: 5,
      ahora: ahora.getTime(),
      mensaje: "Ya enviaste varias solicitudes en la última hora. Escribinos por WhatsApp.",
    });
    tx.create(ref, {
      codigo,
      creado: ahora,
      estado: "nuevo",
      nombre,
      contacto,
      motivo: motivo || null,
      numero,
      pedidoId: pedido && !pedido.empty ? pedido.docs[0].id : null,
    });
    anotar(tx);
  });
  return { codigo };
};

export const resolverArrepentimiento = async (datos, quien) => {
  const { id } = datos ?? {};
  const nota = texto(datos?.nota, 300);
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Falta la solicitud.");
  const ref = db.collection("arrepentimientos").doc(id);
  const ahora = new Date();
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Esa solicitud no existe.");
    if (snap.data().estado === "resuelto") return { id, sinCambios: true };
    tx.update(ref, { estado: "resuelto", resuelto: ahora, nota: nota || null, quien: { nombre: quien.nombre ?? quien.email ?? "", rol: quien.rol } });
    anotarEnAuditoria(tx, db, {
      accion: "arrepentimiento.resolver",
      quien,
      cuando: ahora.toISOString(),
      detalle: { codigo: snap.data().codigo, numero: snap.data().numero ?? null },
    });
    return { id, sinCambios: false };
  });
};
