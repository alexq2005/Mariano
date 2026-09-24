// Publica el catálogo en Firestore (publico/catalogo): el documento que lee
// la tienda y el que modifica el panel al pausar un producto.
//
// Hace falta porque en producción nada lo creaba: lo escribía solo
// npm run sembrar, contra los emuladores. Sin ese documento la tienda cae a
// la red de seguridad (public/data/catalogo.json) y el panel no puede pausar
// nada: la acción falla con "Todavía no se publicó el catálogo".
//
//   npm run catalogo      primero: recalcula precios → public/data/catalogo.json
//   npm run publicar      después: sube ese archivo y la config pública
//
// Respeta lo que se pausó desde el panel. catalogo.json no sabe qué productos
// están pausados; publicarlo encima sin cuidado volvería a mostrar todo lo
// que alguien sacó de la tienda a propósito.
//
// Conexión y credenciales: ver scripts/admin-sdk.mjs.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { esProductoValido } from "../src/compartido/producto.js";
import { numeroWhatsAppValido } from "../src/compartido/whatsapp.js";
import { CONFIG } from "../src/config.js";
import { bandera, conectar, explicarError, salir } from "./admin-sdk.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVO = resolve(RAIZ, "public/data/catalogo.json");

// ── Antes de conectar: que lo que se va a publicar esté sano ─────────

let productos;
try {
  ({ productos } = JSON.parse(readFileSync(ARCHIVO, "utf8")));
} catch (err) {
  salir(`No se pudo leer ${ARCHIVO}\n  ${err.message}\n  Generalo con: npm run catalogo`);
}

if (!Array.isArray(productos) || !productos.length) salir("catalogo.json no tiene productos.");

// La misma regla que usa la tienda para mostrar un producto.
const rotos = productos.filter((p) => !esProductoValido(p)).map((p) => p?.id ?? "(sin id)");
if (rotos.length) salir(`Hay productos incompletos, no se publica nada:\n- ${rotos.join("\n- ")}`);

const ids = productos.map((p) => p.id);
const repetidos = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (repetidos.length) {
  // El carrito guarda cantidades por id: dos productos con el mismo id
  // comparten cantidad y se cobran doble.
  salir(`Hay ids repetidos, no se publica nada: ${repetidos.join(", ")}`);
}

if (!numeroWhatsAppValido(CONFIG.whatsapp) && !bandera("forzar")) {
  salir(
    `El WhatsApp de src/config.js (${CONFIG.whatsapp}) es el de ejemplo o no es válido:\n` +
      "los pedidos no le llegarían a nadie. Poné el número real y volvé a correrlo.\n" +
      "(Para publicar igual, por ejemplo para una prueba: --forzar)",
  );
}

// ── Publicar ────────────────────────────────────────────────────────

try {
  const { db } = await conectar(`Publicar ${productos.length} productos en publico/catalogo`);
  const ref = db.collection("publico").doc("catalogo");

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const anteriores = snap.exists ? (snap.data().productos ?? []) : [];

    // Lo pausado desde el panel sigue pausado.
    const pausados = new Set(anteriores.filter((p) => p.activo === false).map((p) => p.id));
    const nuevos = productos.map((p) => (pausados.has(p.id) ? { ...p, activo: false } : p));

    const nuevosIds = new Set(ids);
    const desaparecidos = anteriores.filter((p) => !nuevosIds.has(p.id)).map((p) => p.id);

    tx.set(ref, { productos: nuevos, config: CONFIG, version: new Date().toISOString() });

    return {
      existia: snap.exists,
      pausadosRespetados: nuevos.filter((p) => p.activo === false).length,
      desaparecidos,
    };
  });

  console.log(`✓ ${productos.length} productos publicados${resultado.existia ? " (reemplaza la versión anterior)" : " por primera vez"}.`);
  if (resultado.pausadosRespetados) {
    console.log(`  ${resultado.pausadosRespetados} siguen pausados, como estaban en el panel.`);
  }
  if (resultado.desaparecidos.length) {
    console.log(`  Ya no están en la lista nueva: ${resultado.desaparecidos.join(", ")}`);
  }
  console.log(
    CONFIG.precios_confirmados
      ? "  Precios: CONFIRMADOS."
      : "  Precios: ORIENTATIVOS (la tienda y cada pedido lo avisan hasta que confirmes el costo real).",
  );
  process.exit(0);
} catch (err) {
  salir(`✗ ${explicarError(err)}`);
}
