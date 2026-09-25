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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { certificadoDePrueba } from "./certificado-prueba.mjs";

// Las funciones usan una copia de src/compartido (ver copiar-compartido.mjs).
execFileSync("node", ["scripts/copiar-compartido.mjs"], { stdio: "inherit" });

// Mercado Pago y ARCA, en la compu: credenciales de mentira y los simulados
// (scripts/mercadopago-simulado.mjs y scripts/arca-simulado.mjs). Los dos
// archivos están en .gitignore y el emulador los lee solo; en producción no
// se usan. A un archivo que ya existe se le agrega solo lo que le falta.
const asegurar = (archivo, variables) => {
  const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";
  const tiene = new Set(actual.split(/\r?\n/).map((l) => l.split("=")[0].trim()));
  const faltan = Object.entries(variables).filter(([k]) => !tiene.has(k));
  if (!faltan.length) return;
  const base = actual && !actual.endsWith("\n") ? `${actual}\n` : actual;
  writeFileSync(archivo, base + faltan.map(([k, v]) => `${k}=${typeof v === "function" ? v() : v}`).join("\n") + "\n");
};
let cert;
const deCert = (campo) => () => {
  cert ??= certificadoDePrueba();
  return Buffer.from(cert[campo]).toString("base64");
};
asegurar("functions/.secret.local", {
  MP_ACCESS_TOKEN: "TEST-simulado",
  MP_WEBHOOK_SECRET: "simulado",
  ARCA_CERT: deCert("certificado"),
  ARCA_KEY: deCert("clave"),
});
asegurar("functions/.env.local", {
  MP_API_URL: "http://127.0.0.1:8531",
  ARCA_WSAA_URL: "http://127.0.0.1:8532/ws/services/LoginCms",
  ARCA_WSFE_URL: "http://127.0.0.1:8532/wsfev1/service.asmx",
});
const simulados = ["scripts/mercadopago-simulado.mjs", "scripts/arca-simulado.mjs"].map((s) => spawn("node", [s], { stdio: "inherit" }));

const argumentos = ["firebase", "emulators:start", "--project", "demo-aurora", ...process.argv.slice(2)];

const hijo = spawn("npx", argumentos, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: "60" },
});

hijo.on("exit", (codigo) => {
  for (const s of simulados) s.kill();
  process.exit(codigo ?? 0);
});
