import { CONFIG } from "../config";
import { calcularPrecios } from "../compartido/formula";

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

// Del producto del archivo sale el producto que ve la tienda: con los dos
// precios ya calculados y SIN el costo en dólares ni el bulto del
// proveedor. Los precios se calculan una sola vez acá, no en cada render.
//
// Paso siguiente: el archivo va a venir con los precios ya hechos y el
// costo no va a viajar al navegador; esta función se queda sin fórmula.
const aProductoDeTienda = (p) => {
  const { menor, mayor } = calcularPrecios(p.costo, CONFIG);
  return { id: p.id, cod: p.cod, nom: p.nom, desc: p.desc, rubro: p.rubro, img: p.img, menor, mayor };
};

// Un producto con el costo roto no puede tirar abajo el catálogo entero,
// pero tampoco puede pasar en silencio: queda afuera y se avisa con su id.
const prepararCatalogo = (crudos) => {
  const productos = [];
  const fallados = [];
  for (const p of crudos) {
    try {
      productos.push(aProductoDeTienda(p));
    } catch (err) {
      fallados.push(`${p?.id ?? "(sin id)"}: ${err.message}`);
    }
  }
  if (fallados.length) console.error(`Productos sin precio, quedan fuera del catálogo:\n- ${fallados.join("\n- ")}`);
  return productos;
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
      publicar({ productos: prepararCatalogo(data.productos), config: CONFIG, loading: false, error: null });
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
