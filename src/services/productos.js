import { CONFIG } from "../config";

// Estado compartido del catálogo (public/data/productos.json). Todos los
// componentes que usan useProductos ven EL MISMO estado: si una carga
// falla y después un reintento funciona (desde cualquier pantalla), se
// actualizan todos juntos — el carrito, el menú de rubros y el listado.

// La config pública (nombre del negocio, mínimo por mayor, formas de pago,
// fecha de la lista) viaja en ese mismo estado: los componentes la leen de
// useProductos().config o del contexto del carrito, y ninguno importa
// src/config.js. Hoy sale de ese módulo local, así que está desde el
// arranque; cuando venga junto con el catálogo va a llegar recién con los
// productos, y por eso todo lo que la usa contempla que todavía no esté.
const INICIAL = { productos: [], config: CONFIG, loading: true, error: null };
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

// Pide el catálogo si todavía no está, o reintenta si la última vez falló.
// Si ya está cargado o cargando, no hace nada.
export const cargarProductos = () => {
  if (cargando || (!estado.loading && !estado.error)) return;
  cargando = true;
  if (estado.error) publicar(INICIAL);
  fetch(`${import.meta.env.BASE_URL}data/productos.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data?.productos)) throw new Error("formato inesperado");
      publicar({ productos: data.productos, config: CONFIG, loading: false, error: null });
    })
    .catch((err) => {
      console.error("No se pudo cargar el catálogo:", err);
      publicar({ productos: [], config: CONFIG, loading: false, error: "No se pudo cargar el catálogo. Revisá tu conexión y probá de nuevo." });
    })
    .finally(() => {
      cargando = false;
    });
};

export const rutaImagen = (archivo) => `${import.meta.env.BASE_URL}img/${archivo}`;
