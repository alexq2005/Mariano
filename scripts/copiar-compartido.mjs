// Copia src/compartido/ a functions/src/compartido/.
//
//   npm run compartido              copia
//   npm run compartido -- --verificar   falla si las copias están viejas
//
// Por qué una copia y no un import: Firebase sube SOLO la carpeta functions/
// al servidor, así que el servidor no puede importar nada de src/. La copia
// se commitea (así el deploy no depende de acordarse de correr esto) y un
// test (src/compartido/copias.test.js) falla si alguien cambia un lado sin
// el otro: el precio que ve la clienta y el que cobra el servidor tienen que
// salir del MISMO código.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN = join(RAIZ, "src/compartido");
const DESTINO = join(RAIZ, "functions/src/compartido");

export const AVISO = "// COPIA de src/compartido/ hecha por scripts/copiar-compartido.mjs: NO editar acá.\n\n";

export const archivosCompartidos = () =>
  readdirSync(ORIGEN).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));

export const esperado = (archivo) => AVISO + readFileSync(join(ORIGEN, archivo), "utf8");

export const desactualizados = () =>
  archivosCompartidos().filter((f) => {
    const destino = join(DESTINO, f);
    return !existsSync(destino) || readFileSync(destino, "utf8") !== esperado(f);
  });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--verificar")) {
    const viejos = desactualizados();
    if (viejos.length) {
      console.error(`functions/src/compartido/ está desactualizado (${viejos.join(", ")}). Corré: npm run compartido`);
      process.exit(1);
    }
    console.log("compartido: las copias del servidor están al día.");
  } else {
    mkdirSync(DESTINO, { recursive: true });
    for (const f of archivosCompartidos()) writeFileSync(join(DESTINO, f), esperado(f));
    console.log(`compartido: ${archivosCompartidos().length} archivos copiados a functions/src/compartido/`);
  }
}
