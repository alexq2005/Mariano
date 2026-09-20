// Cuentas del carrito. Los precios de venta NO se calculan acá: cada
// producto ya llega con `menor` y `mayor` hechos (ver compartido/formula.js
// y services/productos.js). Así el precio que se muestra es exactamente el
// que se guarda en el pedido, sin recalcular en cada render.
//
// La config llega siempre por parámetro y NO tiene valor por defecto: viaja
// con el catálogo (useProductos().config) y mañana va a venir de la base.
// Olvidarse de pasarla tiene que fallar fuerte, no calcular con una config
// vieja escrita en el código.

export const plata = (n) => "$" + Math.round(n).toLocaleString("es-AR");

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const precioDe = (p, campo) => {
  const valor = p?.[campo];
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    throw new Error(`precios: el producto ${p?.id ?? "(sin id)"} no tiene precio "${campo}"`);
  }
  return valor;
};

// Una línea del carrito: qué precio le toca según la cantidad y cuánto le
// falta (o cuánto ahorra) respecto del precio por mayor. El precio por
// mayor es por producto: 12 u. del MISMO producto, no se suman distintos.
export const lineaDeCarrito = (p, cant, C) => {
  const menor = precioDe(p, "menor");
  const mayor = precioDe(p, "mayor");
  const esMayor = cant >= C.minimo_mayor;
  const unit = esMayor ? mayor : menor;
  return {
    p,
    cant,
    unit,
    menor,
    mayor,
    esMayor,
    sub: unit * cant,
    ahorro: esMayor ? (menor - mayor) * cant : 0,
    faltan: esMayor ? 0 : C.minimo_mayor - cant,
  };
};

// Todo el carrito resumido. `lista` es [{id, cant}] en el orden en que se
// fueron agregando; los ids que ya no existen en el catálogo (lista nueva
// del proveedor) se ignoran.
export const resumirCarrito = (lista, porId, C) => {
  const items = [];
  // Productos que la tienda pausó y que alguien ya tenía en el carrito: no
  // se cobran, pero tampoco desaparecen sin decir nada.
  const noDisponibles = [];
  for (const { id, cant } of lista) {
    const p = porId.get(id);
    if (!p || cant <= 0) continue;
    if (p.activo === false) noDisponibles.push({ p, cant });
    else items.push(lineaDeCarrito(p, cant, C));
  }
  const total = items.reduce((a, i) => a + i.sub, 0);
  return {
    items,
    noDisponibles,
    total,
    ahorro: items.reduce((a, i) => a + i.ahorro, 0),
    unidades: items.reduce((a, i) => a + i.cant, 0),
    faltaMinimo: Math.max(0, (C.pedido_minimo || 0) - total),
  };
};
