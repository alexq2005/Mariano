// Firestore completo + Auth: SOLO para el panel (/admin), que necesita
// sesión y escuchar cambios en vivo (pedidos que entran, fichas del equipo).
// Este archivo no se importa desde la tienda.

import { connectAuthEmulator, getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { app, EMULADOR, usandoEmuladores } from "./app";

export const auth = getAuth(app);
// Con los emuladores, Firestore y Auth van por el servidor de la tienda
// (ver EMULADOR en app.js).
export const db = usandoEmuladores ? initializeFirestore(app, { host: EMULADOR.host, ssl: EMULADOR.ssl }) : getFirestore(app);

if (usandoEmuladores) connectAuthEmulator(auth, EMULADOR.origen, { disableWarnings: true });
