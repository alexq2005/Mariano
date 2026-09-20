import { leerDocumentoPublico } from "./firestoreRest";
import { CONFIG } from "../config";

// Estado compartido del catálogo. Todos los componentes que usan
// useProductos ven EL MISMO estado: si una carga falla y después un
// reintento funciona (desde cualquier pantalla), se actualizan todos juntos
// — el carrito, el menú de rubros y el listado.
//
// De dónde salen los datos, en orden:
//   1. Caché del navegador: se pinta al instante lo de la última visita.
//   2. Firestore (publico/catalogo): la fuente real. UNA lectura por visita,
//      leída con un fetch a su API REST: sin el SDK, que pesaba 27 KB
//      comprimidos en cada visita para leer un solo documento.
//   3. public/data/catalogo.json: red de seguridad si Firestore no responde.
//      Es el archivo que genera npm run catalogo, así que sirve igual.
//
// La config pública (nombre, WhatsApp, mínimo por mayor, formas de pago)
// viaja en el mismo documento: cambiarla desde el panel no requiere volver
// a publicar el sitio.

const CLAVE_CACHE = "aurora.catalogo.v1";
const INICIAL = { productos: [], config: CONFIG, loading: true, error: null, desde: null };

let estado = INICIAL;
let cargando = false;
const suscriptores = new Set();

const publicar = (nuevo) => {
  estado = nuevo;
  suscriptores.forEach((avisar) => avisar());
};

export const suscribirProductos = (avisar) => {
  suscriptores.add(avisar);
  return () => suscriptores.delete(avisar);
};

export const estadoProductos = () => estado;

// ── Validación ──────────────────────────────────────────────────────
// Lo que llega de afuera se revisa antes de mostrarlo: un producto a medio
// escribir no puede quedar en la tienda con precio 0 o sin nombre.

const CAMPOS = ["id", "cod", "nom", "rubro", "img"];
const esProductoValido = (p) =>
  CAMPOS.every((c) => typeof p?.[c] === "string" && p[c].length > 0) &&
  [p.menor, p.mayor].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);

// Un producto con datos rotos no puede tirar abajo el catálogo entero,
// pero tampoco puede pasar en silencio: queda afuera y se avisa con su id.
const prepararCatalogo = (crudos) => {
  if (!Array.isArray(crudos)) throw new Error("el catálogo no es una lista");
  const productos = crudos.filter(esProductoValido);
  const fallados = crudos.filter((p) => !esProductoValido(p)).map((p) => p?.id ?? "(sin id)");
  if (fallados.length) {
    console.error(`Productos con datos incompletos, quedan fuera del catálogo: ${fallados.join(", ")}`);
  }
  if (!productos.length) throw new Error("el catálogo llegó vacío");
  return productos;
};

// La config del documento manda, pero si le falta algo se completa con la
// que viene en el código: así un campo nuevo no rompe la tienda.
const prepararConfig = (config) => ({ ...CONFIG, ...(config && typeof config === "object" ? config : {}) });

// ── Caché del navegador ─────────────────────────────────────────────

const leerCache = () => {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(CLAVE_CACHE) ?? "null");
    if (!guardado) return null;
    return { productos: prepararCatalogo(guardado.productos), config: prepararConfig(guardado.config) };
  } catch {
    return null;
  }
};

const guardarCache = (productos, config) => {
  try {
    window.localStorage.setItem(CLAVE_CACHE, JSON.stringify({ productos, config }));
  } catch {
    /* sin espacio o sin permiso: la tienda anda igual, solo tarda más */
  }
};

// ── Carga ───────────────────────────────────────────────────────────

const desdeFirestore = async () => {
  const datos = await leerDocumentoPublico("publico/catalogo");
  return { productos: prepararCatalogo(datos.productos), config: prepararConfig(datos.config) };
};

const desdeArchivo = async () => {
  const res = await fetch(`${import.meta.env.BASE_URL}data/catalogo.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const datos = await res.json();
  return { productos: prepararCatalogo(datos.productos), config: prepararConfig(datos.config) };
};

// Pide el catálogo si todavía no está, o reintenta si la última vez falló.
export const cargarProductos = async () => {
  if (cargando || (!estado.loading && !estado.error)) return;
  cargando = true;

  // Lo de la última visita se muestra ya mismo, mientras se busca lo nuevo.
  if (!estado.productos.length) {
    const cache = leerCache();
    if (cache) publicar({ ...cache, loading: true, error: null, desde: "cache" });
  }

  try {
    const { productos, config } = await desdeFirestore();
    guardarCache(productos, config);
    publicar({ productos, config, loading: false, error: null, desde: "firestore" });
  } catch (err) {
    console.error("No se pudo leer el catálogo de Firestore:", err);
    try {
      const { productos, config } = await desdeArchivo();
      publicar({ productos, config, loading: false, error: null, desde: "archivo" });
    } catch (err2) {
      console.error("Tampoco se pudo leer el catálogo del archivo:", err2);
      // Con datos de la caché, mejor mostrarlos que dejar la tienda vacía.
      publicar(
        estado.productos.length
          ? { ...estado, loading: false, error: null, desde: "cache" }
          : { ...INICIAL, loading: false, error: "No se pudo cargar el catálogo. Revisá tu conexión y probá de nuevo." },
      );
    }
  } finally {
    cargando = false;
  }
};

export const rutaImagen = (archivo) =>
  archivo ? `${import.meta.env.BASE_URL}img/${archivo}` : `${import.meta.env.BASE_URL}img/sin-foto.svg`;
