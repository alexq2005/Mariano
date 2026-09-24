// Cuándo un producto está completo como para mostrarse en la tienda.
//
// Vive en compartido/ porque se usa en dos lados: el navegador, para no
// mostrar un producto a medio escribir con precio 0 o sin nombre, y
// scripts/publicar-catalogo.mjs, para no publicarlo en primer lugar. Con una
// copia en cada lado, tarde o temprano uno acepta lo que el otro rechaza.
//
// No importa nada: es código portable, igual que el resto de compartido/.

export const CAMPOS_PRODUCTO = ["id", "cod", "nom", "rubro", "img"];

export const esProductoValido = (p) =>
  CAMPOS_PRODUCTO.every((c) => typeof p?.[c] === "string" && p[c].length > 0) &&
  [p.menor, p.mayor].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
