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

export const partirNombre = (nom) => {
  const texto = String(nom ?? "").trim();
  const m = texto.match(COLA);
  // Si recortar dejaría el nombre vacío, se muestra entero.
  if (!m || m.index === 0) return { principal: texto, extra: "" };
  return { principal: texto.slice(0, m.index).trim(), extra: m[1].trim() };
};
