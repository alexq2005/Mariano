// Corre después del build y FALLA si algo privado se coló en dist/.
//
// Cualquiera puede leer el código y los datos de una página publicada. El
// costo de fábrica, el dólar al que se compró y los márgenes no pueden
// estar ahí: con eso, una competidora (o una clienta mayorista) calcula
// exactamente cuánto gana el negocio en cada producto.
//
//   node scripts/check-dist.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const REVISAR = new Set([".js", ".json", ".html", ".css", ".map", ".txt", ".svg"]);

// Cada patrón busca el DATO, no la palabra: "costo" aparece legítimamente en
// comentarios y nombres de variables, pero `"costo":` en un JSON publicado
// es el costo de un producto.
const PROHIBIDO = [
  [/"costo"\s*:/, "el costo en dólares de un producto"],
  [/\bcosto\s*:\s*[0-9]/, "un costo en dólares"],
  [/tipo_cambio"?\s*:\s*[0-9]/, "el valor del tipo de cambio"],
  [/factor_importacion"?\s*:\s*[0-9]/, "el valor del factor de importación"],
  [/margen_(menor|mayor)"?\s*:\s*[0-9]/, "el valor de un margen de venta"],
  [/\.xlsx/i, "el nombre del Excel del proveedor"],
  [/"bulto"\s*:/, "el bulto del proveedor"],
];

// La tienda ni siquiera nombra estos datos. El panel sí (el programador los
// edita en Precios, con los valores que lee de Firestore y que las reglas
// solo le muestran a él), así que en su código se admiten los NOMBRES; los
// valores siguen prohibidos en todos lados (arriba).
const SOLO_EN_EL_PANEL = [
  [/tipo_cambio/, "el tipo de cambio del negocio"],
  [/factor_importacion/, "el factor de importación"],
  [/margen_(menor|mayor)/, "los márgenes de venta"],
];
const esDelPanel = (ruta) => /[\\/]assets[\\/]AdminArea-[\w-]+\.(js|map)$/.test(ruta);

const archivos = [];
const recorrer = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if (REVISAR.has(extname(ruta))) archivos.push(ruta);
  }
};

try {
  recorrer(DIST);
} catch {
  console.error("No hay dist/: corré primero npm run build.");
  process.exit(1);
}

const hallazgos = [];
for (const ruta of archivos) {
  const texto = readFileSync(ruta, "utf8");
  for (const [patron, que] of esDelPanel(ruta) ? PROHIBIDO : PROHIBIDO.concat(SOLO_EN_EL_PANEL)) {
    const m = texto.match(patron);
    if (m) hallazgos.push(`${ruta.replace(DIST, "dist")}: ${que} (${JSON.stringify(m[0])})`);
  }
}

if (hallazgos.length) {
  console.error(`Se filtraron datos privados a lo que se publica:\n- ${hallazgos.join("\n- ")}`);
  process.exit(1);
}
console.log(`check:dist OK — ${archivos.length} archivos revisados, nada privado.`);
