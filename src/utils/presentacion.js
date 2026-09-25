// Cómo se muestra un producto: cuentas y recortes que no cambian ningún
// dato, solo lo que se ve primero.

// Cuánto más barato sale por mayor, en porcentaje entero. Es la insignia de
// la tarjeta: el mismo recurso que usa Mercado Libre con "precio por
// cantidad", que es el formato que las clientas ya conocen.
export const porcentajeAhorro = (p) => {
  if (!(p?.menor > 0) || !(p?.mayor > 0) || p.mayor >= p.menor) return 0;
  return Math.round(((p.menor - p.mayor) / p.menor) * 100);
};

// Los nombres vienen del Excel del proveedor y arrastran datos de empaque
// ("Lápiz labial /48") o la traducción al inglés entre paréntesis
// ("Exfoliante de frutilla 500 g (STRAWBERRY SCRUB)"). No se borran: a veces
// dicen algo importante ("precio por caja de 12 unid."). Se separan para
// mostrarlos en segundo plano y que el nombre se lea de un vistazo.
const COLA = /\s*(\/\s*\d[^/]*|\([^()]*\))\s*$/;

// La foto de cada rubro en los círculos de arriba. Sale de la config
// (portadas_rubros, elegidas a mano: la primera de cada rubro suele ser un
// exhibidor con texto en chino). Si el producto elegido ya no está, porque
// llegó una lista nueva del proveedor, se usa el primero con foto.
export const portadaDeRubro = (rubro, productos, portadas = {}) => {
  const delRubro = productos.filter((p) => p.rubro === rubro && p.img);
  const elegido = delRubro.find((p) => p.id === portadas[rubro]) ?? delRubro[0];
  return elegido?.img ?? null;
};

export const partirNombre = (nom) => {
  const texto = String(nom ?? "").trim();
  const m = texto.match(COLA);
  // Si recortar dejaría el nombre vacío, se muestra entero.
  if (!m || m.index === 0) return { principal: texto, extra: "" };
  return { principal: texto.slice(0, m.index).trim(), extra: m[1].trim() };
};

// "a, b o c": para decir en una frase las formas de entrega o de pago.
export const enumerar = (items, conector = "y") =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${conector} ${items.at(-1)}`;

// La misma lista como frase: "Retiro en persona o envío a domicilio".
export const enumerarFrase = (items, conector = "y") => {
  const t = enumerar(items, conector).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// "Más de Labios" en el detalle: los que siguen en la lista del proveedor,
// que suele poner juntas las variantes de una misma línea. Da la vuelta al
// final del rubro y nunca incluye al producto mismo ni a los pausados.
export const relacionados = (productos, p, n = 8) => {
  const delRubro = productos.filter((x) => x.rubro === p.rubro && x.activo !== false);
  const i = delRubro.findIndex((x) => x.id === p.id);
  const siguientes = i < 0 ? delRubro : [...delRubro.slice(i + 1), ...delRubro.slice(0, i)];
  return siguientes.filter((x) => x.id !== p.id).slice(0, n);
};
