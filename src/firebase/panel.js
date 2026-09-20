// Firestore completo + Auth: SOLO para el panel (/admin), que necesita
// sesión y escuchar cambios en vivo (pedidos que entran, fichas del equipo).
// Este archivo no se importa desde la tienda.

import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { app, EMULADOR, usandoEmuladores } from "./app";

export const auth = getAuth(app);
export const db = getFirestore(app);

if (usandoEmuladores) {
  connectAuthEmulator(auth, `http://${EMULADOR.host}:${EMULADOR.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULADOR.host, EMULADOR.firestore);
}
