// La lógica del pedido que no toca la base: qué se cobra, qué estados
// existen, cómo se mueve el stock y cuánto suma a las ventas. Separada de
// las acciones para poder probarla sin emuladores (logica-pedido.test.js).

import { resumirCarrito } from "./compartido/lineas.js";

export const TOPE_UNIDADES = 9999; // el mismo tope que el carrito
export const MAX_LINEAS = 100;

// Un problema del pedido que la clienta tiene que leer tal cual.
export class ErrorPedido extends Error {
  constructor(mensaje, detalle = {}) {
    super(mensaje);
    this.detalle = detalle;
  }
}

// Lo que manda el navegador es SOLO [{id, cant}]: los nombres y los precios
// salen del catálogo publicado, nunca del navegador. Así nadie puede
// mandarse un pedido con el precio que quiera.
export const armarLineas = (carrito, productos, config, stock = {}) => {
  if (!Array.isArray(carrito) || carrito.length === 0) throw new ErrorPedido("El carrito está vacío.");
  if (carrito.length > MAX_LINEAS) throw new ErrorPedido(`Un pedido puede tener hasta ${MAX_LINEAS} productos distintos.`);

  const porId = new Map(productos.map((p) => [p.id, p]));
  const vistos = new Set();
  const lista = [];
  for (const linea of carrito) {
    const { id, cant } = linea ?? {};
    if (typeof id !== "string" || !Number.isInteger(cant) || cant < 1 || cant > TOPE_UNIDADES) {
      throw new ErrorPedido("Hay una cantidad que no es válida en el carrito.");
    }
    if (vistos.has(id)) throw new ErrorPedido("Hay un producto repetido en el carrito.");
    vistos.add(id);

    const p = porId.get(id);
    if (!p) throw new ErrorPedido("Un producto del carrito ya no está en el catálogo. Actualizá la página.", { id });
    if (p.activo === false) throw new ErrorPedido(`${p.nom} ya no está disponible. Sacalo del carrito.`, { id });
    if (p.agotado) throw new ErrorPedido(`${p.nom} está sin stock. Sacalo del carrito.`, { id });
    const hay = stock[id];
    if (typeof hay === "number" && cant > hay) {
      throw new ErrorPedido(`De ${p.nom} quedan ${hay} u. Bajá la cantidad en el carrito.`, { id, hay });
    }
    lista.push({ id, cant });
  }

  const r = resumirCarrito(lista, porId, config);
  if (r.faltaMinimo > 0) throw new ErrorPedido("El pedido no llega al monto mínimo.");
  return {
    items: r.items.map((i) => ({
      id: i.p.id,
      cod: i.p.cod,
      nom: i.p.nom,
      img: i.p.img,
      cant: i.cant,
      unit: i.unit,
      menor: i.menor,
      esMayor: i.esMayor,
      sub: i.sub,
    })),
    total: r.total,
    ahorro: r.ahorro,
    unidades: r.unidades,
  };
};

// ── Estados ─────────────────────────────────────────────────────────
// pendiente: llegó y nadie lo miró. confirmado: se habló con la clienta y
// sale (acá se descuenta el stock y cuenta como venta). entregado: listo.
// cancelado: no sale; si estaba confirmado, el stock vuelve.
export const ESTADOS = ["pendiente", "confirmado", "entregado", "cancelado"];

export const TRANSICIONES = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["entregado", "cancelado"],
  entregado: [],
  cancelado: [],
};

export const puedePasar = (desde, hacia) => (TRANSICIONES[desde] ?? []).includes(hacia);

// ── Stock ───────────────────────────────────────────────────────────
// Solo se controla el stock de los productos que tienen una cantidad
// cargada; los demás se venden sin tope (el stock se confirma por WhatsApp).
// signo -1 descuenta (confirmar), +1 devuelve (cancelar lo confirmado).
export const moverStock = (cantidades, items, signo) => {
  const nuevas = {};
  const faltantes = [];
  for (const i of items) {
    const hay = cantidades[i.id];
    if (typeof hay !== "number") continue;
    const queda = hay + signo * i.cant;
    if (queda < 0) faltantes.push({ id: i.id, nom: i.nom, pide: i.cant, hay });
    nuevas[i.id] = queda;
  }
  return { nuevas, faltantes };
};

// ── Ventas ──────────────────────────────────────────────────────────
// Lo que un pedido suma (signo 1) o resta (signo -1, al cancelarlo después
// de confirmado) al resumen del mes. `inc` es FieldValue.increment en el
// servidor: sumas atómicas, sin leer el documento antes.
export const deltaVenta = (pedido, dia, signo, inc) => {
  const productos = {};
  for (const i of pedido.items) {
    productos[i.id] = { nom: i.nom, unidades: inc(signo * i.cant), total: inc(signo * i.sub) };
  }
  return {
    totales: {
      pedidos: inc(signo),
      unidades: inc(signo * pedido.unidades),
      total: inc(signo * pedido.total),
      ahorro: inc(signo * pedido.ahorro),
    },
    dias: { [dia]: { pedidos: inc(signo), unidades: inc(signo * pedido.unidades), total: inc(signo * pedido.total) } },
    productos,
  };
};
