import { HttpsError } from "firebase-functions/https";
import { db } from "./firebase.js";

// Quién está pidiendo la acción.
//
// El rol NO viene en el pedido: se lee de staff/{uid} en el servidor. Si
// viniera del navegador, cualquiera se pondría "programador" y listo.
export const quienPide = async (auth) => {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Entrá con tu cuenta para hacer esto.");

  // Cuenta de email y contraseña: no alcanza con una anónima o de Google.
  if (auth.token?.firebase?.sign_in_provider !== "password") {
    throw new HttpsError("permission-denied", "Entrá con el email y la contraseña que te dieron.");
  }

  const snap = await db.collection("staff").doc(auth.uid).get();
  const ficha = snap.exists ? snap.data() : null;

  if (!ficha?.activo) throw new HttpsError("permission-denied", "Tu cuenta no tiene acceso al panel.");

  return { uid: auth.uid, email: auth.token?.email ?? ficha.email ?? null, rol: ficha.rol, nombre: ficha.nombre };
};
