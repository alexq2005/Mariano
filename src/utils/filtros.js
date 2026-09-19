// Rubros y búsqueda del catálogo.

export const ORDEN_RUBROS = ["labios", "ojos", "rostro", "cuidado", "uñas", "cabello", "accesorios", "otros"];

export const nombreRubro = (id) => id.charAt(0).toUpperCase() + id.slice(1);

export const contarRubros = (productos) => {
  const n = {};
  productos.forEach((p) => {
    n[p.rubro] = (n[p.rubro] || 0) + 1;
  });
  return ORDEN_RUBROS.filter((r) => n[r]).map((r) => ({ id: r, nom: nombreRubro(r), n: n[r] }));
};

// Sin acentos y en minúscula: en el celular casi nadie tipea "lápiz".
export const sinAcentos = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const filtrarProductos = (productos, { rubro, texto = "" }) => {
  const t = sinAcentos(texto.trim());
  return productos.filter((p) => {
    if (rubro && p.rubro !== rubro) return false;
    if (!t) return true;
    return sinAcentos(`${p.nom} ${p.desc} ${p.cod}`).includes(t);
  });
};
