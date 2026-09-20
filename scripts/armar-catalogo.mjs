// Arma public/data/catalogo.json: lo ÚNICO que se publica de los productos.
//
//   datos/proveedor.json  (privado: costo en dólares, bulto)
//   datos/config-privada.json (privado: dólar, factor, márgenes, redondeo)
//        ↓  fórmula
//   public/data/catalogo.json  (público: precios ya calculados, sin costo)
//
// El costo del proveedor y los márgenes del negocio no salen de datos/, que
// está fuera del repositorio. Antes viajaban al navegador de cada clienta
// dentro de productos.json y del código de la página.
//
//   node scripts/armar-catalogo.mjs
//
// Se corre después de extraer.py (lista nueva del proveedor) o cuando
// cambia el dólar en datos/config-privada.json.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calcularPrecios } from "../src/compartido/formula.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROVEEDOR = resolve(RAIZ, "datos/proveedor.json");
const PRIVADA = resolve(RAIZ, "datos/config-privada.json");
const SALIDA = resolve(RAIZ, "public/data/catalogo.json");

const leer = (ruta, ayuda) => {
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (err) {
    console.error(`No se pudo leer ${ruta}\n  ${err.message}\n  ${ayuda}`);
    process.exit(1);
  }
};

const proveedor = leer(PROVEEDOR, "Corré extraer.py con el Excel del proveedor para generarlo.");
const privada = leer(PRIVADA, "Copiá datos.ejemplo/config-privada.json a datos/ y poné tus valores reales.");

const productos = [];
const fallados = [];
for (const p of proveedor.productos ?? []) {
  try {
    const { menor, mayor } = calcularPrecios(p.costo, privada);
    // Solo campos públicos: sin costo, sin bulto, sin nombre del Excel.
    productos.push({ id: p.id, cod: p.cod, nom: p.nom, desc: p.desc, rubro: p.rubro, img: p.img, menor, mayor });
  } catch (err) {
    fallados.push(`${p?.id ?? "(sin id)"}: ${err.message}`);
  }
}

if (!productos.length) {
  console.error("No quedó ningún producto con precio: revisá datos/config-privada.json.");
  process.exit(1);
}

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify({ productos }, null, 2) + "\n");

console.log(`Catálogo: ${productos.length} productos → ${SALIDA}`);
if (fallados.length) console.warn(`Sin precio (quedan fuera):\n- ${fallados.join("\n- ")}`);
const precios = productos.flatMap((p) => [p.menor, p.mayor]);
console.log(`Precios entre $${Math.min(...precios).toLocaleString("es-AR")} y $${Math.max(...precios).toLocaleString("es-AR")}`);
