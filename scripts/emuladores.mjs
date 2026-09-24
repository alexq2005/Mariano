// Levanta los emuladores de Firebase (Firestore, Auth y Functions).
//
//   npm run emu
//
// Por qué un script y no el comando pelado: en Windows, el emulador le da
// 10 segundos a Cloud Functions para describir qué funciones exporta, y
// arrancar Node ahí tarda más. Cuando no llega, falla con "Cannot determine
// backend specification" y las funciones quedan sin cargar. Con 60 segundos
// no pasa, y esta variable de entorno no se puede setear desde un script de
// npm de forma que ande igual en Windows y en Linux.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

// Las funciones usan una copia de src/compartido (ver copiar-compartido.mjs).
execFileSync("node", ["scripts/copiar-compartido.mjs"], { stdio: "inherit" });

// Mercado Pago, en la compu: credenciales de mentira y el simulado
// (scripts/mercadopago-simulado.mjs). Los dos archivos están en .gitignore y
// el emulador los lee solo; en producción no se usan.
if (!existsSync("functions/.secret.local")) {
  writeFileSync("functions/.secret.local", "MP_ACCESS_TOKEN=TEST-simulado\nMP_WEBHOOK_SECRET=simulado\n");
}
if (!existsSync("functions/.env.local")) {
  writeFileSync("functions/.env.local", "MP_API_URL=http://127.0.0.1:8531\n");
}
const simulado = spawn("node", ["scripts/mercadopago-simulado.mjs"], { stdio: "inherit" });

const argumentos = ["firebase", "emulators:start", "--project", "demo-aurora", ...process.argv.slice(2)];

const hijo = spawn("npx", argumentos, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: "60" },
});

hijo.on("exit", (codigo) => {
  simulado.kill();
  process.exit(codigo ?? 0);
});
