// Conexión con permisos de administrador (Admin SDK) para los scripts que
// preparan producción: alta-cuenta.mjs y publicar-catalogo.mjs.
//
// El Admin SDK SALTEA las reglas de firestore.rules. Por eso vive acá, en
// scripts que corre el programador desde su computadora, y nunca en el
// código de la tienda.
//
// A dónde se conecta:
//
//   Emuladores   si están definidas FIRESTORE_EMULATOR_HOST y
//                FIREBASE_AUTH_EMULATOR_HOST (las define npm run emu).
//   Producción   con tus credenciales de Google, de una de estas formas:
//                  gcloud auth application-default login      (recomendado)
//                  GOOGLE_APPLICATION_CREDENTIALS=ruta/al/service-account.json
//                y el proyecto en FIREBASE_PROJECT_ID o con --proyecto <id>.
//
// El archivo de service account NUNCA va al repositorio: .gitignore ya
// excluye *service-account*.json.

import { createInterface } from "node:readline/promises";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
export const bandera = (nombre) => process.argv.includes(`--${nombre}`);

export const enEmulador = () =>
  Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);

export const salir = (mensaje) => {
  console.error(mensaje);
  process.exit(1);
};

// Conecta y, si es producción, pide confirmar tipeando el id del proyecto.
// Un script que escribe en la base real no se tiene que poder correr por
// accidente: con --si se saltea la pregunta (para quien sabe lo que hace).
export const conectar = async (queVaAHacer) => {
  const emulador = enEmulador();
  const proyecto =
    argumento("proyecto") ?? process.env.FIREBASE_PROJECT_ID ?? (emulador ? "demo-aurora" : undefined);

  if (!proyecto) {
    salir(
      "¿En qué proyecto? Pasalo con --proyecto <id> o en FIREBASE_PROJECT_ID.\n" +
        "Lo ves en la Consola de Firebase → Configuración del proyecto.",
    );
  }

  const destino = emulador ? `EMULADOR (${proyecto})` : `PRODUCCIÓN: ${proyecto}`;
  console.log(`\n→ ${queVaAHacer}\n  en ${destino}\n`);

  if (!emulador && !bandera("si")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const escrito = (await rl.question(`Esto escribe en la base REAL. Para seguir, escribí el id del proyecto (${proyecto}): `)).trim();
    rl.close();
    if (escrito !== proyecto) salir("No coincide. No se hizo nada.");
  }

  const app = initializeApp({ projectId: proyecto });
  return { auth: getAuth(app), db: getFirestore(app), proyecto, emulador };
};

// Los errores de credenciales del Admin SDK son largos y en inglés; este es
// el que más va a aparecer la primera vez, así que se explica en castellano.
export const explicarError = (err) => {
  const texto = String(err?.message ?? err);
  if (/default credentials|could not load the default|credential/i.test(texto)) {
    return (
      "No encontré tus credenciales de Google.\n" +
      "  Corré: gcloud auth application-default login\n" +
      "  o definí GOOGLE_APPLICATION_CREDENTIALS con la ruta al service account."
    );
  }
  if (/PERMISSION_DENIED|permission/i.test(texto)) {
    return "Tus credenciales no tienen permiso sobre ese proyecto. ¿Es el proyecto correcto?";
  }
  return texto;
};
