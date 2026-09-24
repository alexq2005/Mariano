// COPIA de src/compartido/ hecha por scripts/copiar-compartido.mjs: NO editar acá.

// Las cuentas del carrito y del pedido.
//
// Vive en compartido/ porque las usan los dos lados: el navegador para
// mostrar el total, y el servidor para recalcularlo antes de guardar el
// pedido. Tienen que dar EXACTAMENTE lo mismo; si cada uno tuviera su
// copia, con el tiempo se separan y el pedido queda con otro total.
//
// No importa nada: así se puede copiar tal cual a las Cloud Functions.

const precioDe = (p, campo) => {
  const valor = p?.[campo];
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    throw new Error(`precios: el producto ${p?.id ?? "(sin id)"} no tiene precio "${campo}"`);
  }
  return valor;
};

// Una línea: qué precio le toca según la cantidad y cuánto le falta (o
// cuánto ahorra) respecto del precio por mayor. El precio por mayor es por
// producto: 12 u. del MISMO producto, no se suman distintos.
export const lineaDeCarrito = (p, cant, config) => {
  const menor = precioDe(p, "menor");
  const mayor = precioDe(p, "mayor");
  const minimo = config.minimo_mayor;
  if (typeof minimo !== "number" || minimo < 1) throw new Error("precios: falta minimo_mayor en la config");
  const esMayor = cant >= minimo;
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
    faltan: esMayor ? 0 : minimo - cant,
  };
};

// Todo el carrito resumido. `lista` es [{id, cant}] en el orden en que se
// fueron agregando; los ids que ya no existen en el catálogo (lista nueva
// del proveedor) se ignoran, y los pausados se informan aparte.
export const resumirCarrito = (lista, porId, config) => {
  const items = [];
  const noDisponibles = [];
  for (const { id, cant } of lista) {
    const p = typeof porId.get === "function" ? porId.get(id) : porId[id];
    if (!p || cant <= 0) continue;
    if (p.activo === false) noDisponibles.push({ p, cant });
    else items.push(lineaDeCarrito(p, cant, config));
  }
  const total = items.reduce((a, i) => a + i.sub, 0);
  return {
    items,
    noDisponibles,
    total,
    ahorro: items.reduce((a, i) => a + i.ahorro, 0),
    unidades: items.reduce((a, i) => a + i.cant, 0),
    faltaMinimo: Math.max(0, (config.pedido_minimo || 0) - total),
  };
};
