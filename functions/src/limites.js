import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/https";
import { refs } from "./refs.js";

// Freno contra el abuso de lo que la tienda deja hacer sin cuenta (hacer un
// pedido, pedir el arrepentimiento): cuántas veces por hora desde una misma
// conexión o con un mismo teléfono. La IP no se guarda: solo un resumen
// (hash) que no se puede volver atrás.
const HORA = 3600e3;

export const claveIp = (tipo, ip) => `${tipo}-ip-${createHash("sha256").update(`aurora|${ip ?? "sin-ip"}`).digest("hex").slice(0, 24)}`;

// Se usa en dos tiempos, porque en una transacción todas las lecturas van
// antes que las escrituras: `revisar` con el documento ya leído, y la
// escritura que devuelve se hace después.
export const revisarLimite = (snap, { max, ahora, mensaje }) => {
  const previo = snap.exists ? snap.data() : null;
  const vigente = previo && ahora - previo.desde < HORA;
  const n = vigente ? previo.n : 0;
  if (n >= max) throw new HttpsError("resource-exhausted", mensaje);
  return (tx) => tx.set(snap.ref, { desde: vigente ? previo.desde : ahora, n: n + 1 });
};

export const refLimite = (clave) => refs.limite(clave);
