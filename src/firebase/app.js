// Conexión con Firebase.
//
// En desarrollo (npm run dev) apunta a los EMULADORES que corren en esta
// máquina: no toca datos reales ni gasta cuota. En producción usa el
// proyecto de verdad, con los datos de .env.local (ver .env.example).
//
// La apiKey de Firebase es pública por diseño: identifica al proyecto, no
// da permisos. Lo que protege los datos son firestore.rules.

import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

// Los puertos son los de firebase.json.
export const usandoEmuladores = env.DEV && env.VITE_FIREBASE_EMULADORES !== "no";
if (usandoEmuladores) {
  connectAuthEmulator(auth, "http://127.0.0.1:8520", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8519);
}
