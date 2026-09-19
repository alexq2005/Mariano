import { CONFIG } from "../config";

// El Excel trae el COSTO de fábrica en dólares. Los dos precios de venta
// se calculan; el costo no se muestra nunca en pantalla.
//
// Todas las funciones reciben la config como último parámetro (con la
// real por defecto) para poder probarlas con números controlados.

export const redondear = (n, C = CONFIG) => {
  const paso = C.redondeo || 1;
  return Math.max(paso, Math.round(n / paso) * paso);
};

const costoReal = (p, C) => p.costo * (C.factor_importacion || 1) * C.tipo_cambio;

export const precioMenor = (p, C = CONFIG) => redondear(costoReal(p, C) * C.margen_menor, C);
export const precioMayor = (p, C = CONFIG) => redondear(costoReal(p, C) * C.margen_mayor, C);

export const plata = (n) => "$" + Math.round(n).toLocaleString("es-AR");

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Una línea del carrito: qué precio le toca según la cantidad y cuánto le
// falta (o cuánto ahorra) respecto del precio por mayor. El precio por
// mayor es por producto: 12 u. del MISMO producto, no se suman distintos.
export const lineaDeCarrito = (p, cant, C = CONFIG) => {
  const menor = precioMenor(p, C);
  const mayor = precioMayor(p, C);
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
export const resumirCarrito = (lista, porId, C = CONFIG) => {
  const items = [];
  for (const { id, cant } of lista) {
    const p = porId.get(id);
    if (p && cant > 0) items.push(lineaDeCarrito(p, cant, C));
  }
  const total = items.reduce((a, i) => a + i.sub, 0);
  return {
    items,
    total,
    ahorro: items.reduce((a, i) => a + i.ahorro, 0),
    unidades: items.reduce((a, i) => a + i.cant, 0),
    faltaMinimo: Math.max(0, (C.pedido_minimo || 0) - total),
  };
};
