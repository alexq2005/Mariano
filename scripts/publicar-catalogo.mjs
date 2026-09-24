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

// Costos y parámetros privados (dólar, factor, márgenes): si están en esta
// máquina, se suben a privado/ para que el programador pueda recalcular los
// precios desde el panel (Precios). Las reglas no dejan que nadie más los lea.
const leerPrivado = (ruta) => {
  try {
    return JSON.parse(readFileSync(resolve(RAIZ, ruta), "utf8"));
  } catch {
    return null;
  }
};
const proveedor = leerPrivado("datos/proveedor.json");
const privada = leerPrivado("datos/config-privada.json");
const costos = proveedor
  ? Object.fromEntries((proveedor.productos ?? []).filter((p) => typeof p.costo === "number").map((p) => [p.id, p.costo]))
  : null;

// ── Publicar ────────────────────────────────────────────────────────
// Lo que se cambió en el panel manda sobre el Excel:
//   - lo pausado sigue pausado y lo agotado sigue agotado;
//   - los productos dados de alta en el panel no desaparecen;
//   - los editados en el panel (nombre, precio, foto…) no se pisan;
//   - la configuración (WhatsApp, mínimos, formas de pago) es la del panel.
//     Con --config-del-codigo se vuelve a la de src/config.js.
try {
  const { db } = await conectar(`Publicar ${productos.length} productos en publico/catalogo`);
  const ref = db.collection("publico").doc("catalogo");
  const refParametros = db.collection("privado").doc("config");
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const parametrosPanel = (await tx.get(refParametros)).data()?.parametros ?? null;
    const previo = snap.exists ? snap.data() : {};
    const anteriores = previo.productos ?? [];
    const porId = new Map(anteriores.map((p) => [p.id, p]));

    const nuevos = productos.map((p) => {
      const antes = porId.get(p.id);
      if (!antes) return p;
      if (antes.editadoEnPanel) return antes;
      return { ...p, ...(antes.activo === false ? { activo: false } : {}), ...(antes.agotado ? { agotado: true } : {}) };
    });
    const nuevosIds = new Set(ids);
    const delPanel = anteriores.filter((p) => p.origen === "panel" && !nuevosIds.has(p.id));
    const desaparecidos = anteriores.filter((p) => p.origen !== "panel" && !nuevosIds.has(p.id)).map((p) => p.id);

    const config = bandera("config-del-codigo") ? CONFIG : { ...CONFIG, ...(previo.config ?? {}) };
    if (!numeroWhatsAppValido(config.whatsapp) && !bandera("forzar")) {
      throw new Error(
        `El WhatsApp (${config.whatsapp}) es el de ejemplo o no es válido: los pedidos no le llegarían a nadie.\n` +
          "  Poné el número real en src/config.js, o publicá con --forzar y cargalo después en el panel (Configuración).",
      );
    }

    tx.set(ref, { productos: nuevos.concat(delPanel), config, version: new Date().toISOString() });
    if (costos && privada) {
      tx.set(db.collection("privado").doc("costos"), { costos });
      tx.set(db.collection("privado").doc("config"), { parametros: privada, actualizado: new Date() });
    }
    return {
      existia: snap.exists,
      pausados: nuevos.filter((p) => p.activo === false).length,
      editados: nuevos.filter((p) => p.editadoEnPanel).length,
      delPanel: delPanel.length,
      desaparecidos,
      configDelPanel: Boolean(previo.config) && !bandera("config-del-codigo"),
      // El dólar o los márgenes se cambiaron desde el panel (Precios) y en
      // esta máquina hay otros: mandan los de acá, pero que se sepa.
      parametrosPisados:
        costos && privada && parametrosPanel && JSON.stringify(parametrosPanel) !== JSON.stringify(privada) ? parametrosPanel : null,
    };
  });
  console.log(`✓ ${productos.length} productos publicados${resultado.existia ? " (reemplaza la versión anterior)" : " por primera vez"}.`);
  if (resultado.pausados) console.log(`  ${resultado.pausados} siguen pausados, como estaban en el panel.`);
  if (resultado.editados) console.log(`  ${resultado.editados} editados en el panel quedaron como estaban.`);
  if (resultado.delPanel) console.log(`  ${resultado.delPanel} dados de alta en el panel se conservaron.`);
  if (resultado.desaparecidos.length) console.log(`  Ya no están en la lista nueva: ${resultado.desaparecidos.join(", ")}`);
  if (resultado.configDelPanel) console.log("  Configuración: la del panel (para usar la de src/config.js: --config-del-codigo).");
  if (resultado.parametrosPisados) {
    console.warn(
      `  OJO: en el panel el dólar era ${resultado.parametrosPisados.tipo_cambio} y el factor ${resultado.parametrosPisados.factor_importacion};\n` +
        `  quedaron los de datos/config-privada.json (${privada.tipo_cambio} y ${privada.factor_importacion}). Si no era la idea,\n` +
        "  actualizá ese archivo, corré npm run catalogo y volvé a publicar.",
    );
  }
  console.log(costos && privada ? `  Costos subidos para ${Object.keys(costos).length} productos (sección Precios).` : "  Sin datos/ en esta máquina: no se subieron costos.");
  console.log(
    CONFIG.precios_confirmados
      ? "  Precios: CONFIRMADOS."
      : "  Precios: ORIENTATIVOS (la tienda y cada pedido lo avisan hasta que confirmes el costo real).",
  );
  process.exit(0);
} catch (err) {
  salir(`✗ ${explicarError(err)}`);
}
