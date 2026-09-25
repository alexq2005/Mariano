// Copia src/compartido/*.js (sin los tests) a functions/src/compartido/.
//
// Firebase despliega SOLO la carpeta functions/: el servidor no puede
// importar de ../src. Pero la validación de un pedido y la cuenta del total
// tienen que ser EXACTAMENTE las mismas en la tienda y en el servidor, así
// que se copian en vez de reescribirse. Corre solo antes de `npm run emu` y
// antes de desplegar (firebase.json → predeploy), y el test
// src/compartido/copias.test.js falla si alguien edita una copia a mano.
//
//   node scripts/copiar-compartido.mjs

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ORIGEN = join(RAIZ, "src/compartido");
export const DESTINO = join(RAIZ, "functions/src/compartido");
export const CABECERA = (archivo) =>
  `// GENERADO desde src/compartido/${archivo} por scripts/copiar-compartido.mjs.\n` +
  "// No editar acá: se pisa en cada `npm run emu` y en cada despliegue.\n\n";

export const archivosCompartidos = () => readdirSync(ORIGEN).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));

const copiar = () => {
  rmSync(DESTINO, { recursive: true, force: true });
  mkdirSync(DESTINO, { recursive: true });
  const archivos = archivosCompartidos();
  for (const archivo of archivos) {
    writeFileSync(join(DESTINO, archivo), CABECERA(archivo) + readFileSync(join(ORIGEN, archivo), "utf8"));
  }
  console.log(`compartido/ → functions/src/compartido/ (${archivos.length} archivos)`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) copiar();
