// Rubros y búsqueda del catálogo.

// La lista vive en compartido/: el servidor valida contra la misma.
export { RUBROS as ORDEN_RUBROS } from "../compartido/producto";
import { RUBROS as ORDEN_RUBROS } from "../compartido/producto";

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

// Cómo se puede ordenar el listado. El id va en la URL (?orden=precio), así
// un orden se comparte y sobrevive a "Atrás". "" es el orden de la lista del
// proveedor, que agrupa las variantes de un mismo producto.
export const ORDENES = [
  { id: "", nom: "Catálogo" },
  { id: "precio", nom: "Menor precio" },
  { id: "-precio", nom: "Mayor precio" },
  { id: "ahorro", nom: "Más ahorro por mayor" },
];

// Ahorro exacto (sin redondear): con el porcentaje redondeado, dos
// productos de 27,4 % y 26,6 % empataban.
const ahorro = (p) => (p.menor > 0 && p.mayor < p.menor ? (p.menor - p.mayor) / p.menor : 0);

const COMPARAR = {
  precio: (a, b) => a.menor - b.menor,
  "-precio": (a, b) => b.menor - a.menor,
  ahorro: (a, b) => ahorro(b) - ahorro(a) || a.menor - b.menor,
};

// Devuelve una lista nueva; con un orden desconocido, la del catálogo. El
// sort es estable: a igual precio se respeta el orden del catálogo.
export const ordenarProductos = (productos, orden) => {
  const comparar = COMPARAR[orden];
  return comparar ? productos.slice().sort(comparar) : productos;
};
