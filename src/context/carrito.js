// Lógica del carrito, sin React: el estado es una lista [{id, cant}] en el
// orden en que se fueron agregando los productos. Se guardan SOLO ids y
// cantidades; los precios se recalculan siempre con la config vigente, así un
// carrito guardado nunca queda con precios viejos si cambia el dólar.

// Tope de cordura por producto (no es regla de negocio): evita que un
// "99999" tipeado de más llegue como pedido real.
export const TOPE = 9999;

// Entero entre 0 y TOPE, o null si no es un número. Ojo: Number("") da 0,
// y un campo vacío a mitad de tipeo NO puede significar "quitar".
export const sanear = (n) => {
  if (n === "" || n === null || n === undefined) return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(TOPE, Math.max(0, Math.trunc(x)));
};

// Limpia una lista que viene de afuera (localStorage, otra pestaña):
// descarta basura, ids repetidos y cantidades inválidas.
export const normalizar = (lista) => {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const items = [];
  for (const x of lista) {
    if (!x || typeof x.id !== "string" || vistos.has(x.id)) continue;
    const cant = sanear(x.cant);
    if (!cant) continue;
    vistos.add(x.id);
    items.push({ id: x.id, cant });
  }
  return items;
};

// Devuelve la MISMA lista si no cambia nada, para que React no re-renderice.
const conCantidad = (items, id, cant) => {
  const i = items.findIndex((x) => x.id === id);
  if (cant <= 0) return i < 0 ? items : items.filter((x) => x.id !== id);
  if (i < 0) return [...items, { id, cant }];
  if (items[i].cant === cant) return items;
  const copia = items.slice();
  copia[i] = { id, cant };
  return copia;
};

export const cantidadEn = (items, id) => items.find((x) => x.id === id)?.cant || 0;

export const carritoReducer = (items, accion) => {
  switch (accion.type) {
    case "sumar":
      return conCantidad(items, accion.id, sanear(cantidadEn(items, accion.id) + accion.paso));
    case "fijar": {
      const cant = sanear(accion.cantidad);
      return cant === null ? items : conCantidad(items, accion.id, cant);
    }
    case "quitar":
      return conCantidad(items, accion.id, 0);
    case "reponer": {
      // Deshacer un "Quitar": vuelve a su lugar original en la lista.
      const cant = sanear(accion.cant);
      if (!cant || items.some((x) => x.id === accion.id)) return items;
      const pos = Math.min(Math.max(0, accion.posicion ?? items.length), items.length);
      return [...items.slice(0, pos), { id: accion.id, cant }, ...items.slice(pos)];
    }
    case "vaciar":
      return items.length ? [] : items;
    case "restaurar":
      return normalizar(accion.items);
    case "podar": {
      // Saca productos que ya no están en el catálogo (lista nueva del proveedor).
      const quedan = items.filter((x) => accion.validos.has(x.id));
      return quedan.length === items.length ? items : quedan;
    }
    default:
      throw new Error(`Acción de carrito desconocida: ${accion.type}`);
  }
};

// ── Persistencia ─────────────────────────────────────────────────────
// localStorage puede no existir o tirar error (modo privado, datos de
// sitios bloqueados). En ese caso el carrito sigue andando en memoria.

export const CLAVE = "aurora.carrito.v1";

const almacen = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const leerGuardado = (texto) => {
  try {
    return normalizar(JSON.parse(texto ?? "[]"));
  } catch {
    console.warn("El carrito guardado estaba dañado; se empieza de cero.");
    return [];
  }
};

export const cargarCarrito = (s = almacen()) => {
  try {
    return leerGuardado(s?.getItem(CLAVE));
  } catch {
    return [];
  }
};

export const guardarCarrito = (items, s = almacen()) => {
  try {
    s?.setItem(CLAVE, JSON.stringify(items));
  } catch (err) {
    console.warn("No se pudo guardar el carrito; sigue en memoria.", err);
  }
};
