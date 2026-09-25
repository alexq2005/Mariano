// Conexión con Firebase: SOLO la aplicación, sin Firestore ni Auth.
//
// Se parte en tres archivos a propósito, porque el peso importa:
//   app.js      esto (mínimo)
//   publico.js  Firestore "lite" para la tienda: solo leer el catálogo
//   panel.js    Firestore completo + Auth, únicamente para /admin
//
// Así una clienta que entra a ver productos no descarga el SDK de tiempo
// real ni el de autenticación, que no le sirven de nada.
//
// En desarrollo apunta a los EMULADORES de esta máquina (npm run emu): no
// toca datos reales ni gasta cuota. La apiKey es pública por diseño:
// identifica al proyecto, no da permisos. Lo que protege los datos son las
// reglas de firestore.rules.

import { initializeApp } from "firebase/app";

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const usandoEmuladores = env.DEV && env.VITE_FIREBASE_EMULADORES !== "no";

// Con los emuladores, el navegador les habla a través del mismo servidor
// de la tienda (vite.config.js los reenvía a sus puertos de firebase.json).
// Así anda igual en la compu que en una compu en la nube (GitHub
// Codespaces), donde el navegador no llega a 127.0.0.1.
const origen = typeof location === "undefined" ? "" : location.origin;
export const EMULADOR = {
  origen,
  // Firestore toma host y protocolo, sin ruta: el servidor reenvía
  // /google.firestore.v1.Firestore/… y /v1/projects/…
  host: typeof location === "undefined" ? "" : location.host,
  ssl: typeof location !== "undefined" && location.protocol === "https:",
  funciones: `${origen}/__fn/${env.VITE_FIREBASE_PROJECT_ID}/us-central1`,
};
