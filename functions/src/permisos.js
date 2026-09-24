// Quién puede hacer qué. Una sola tabla, en un solo archivo: para saber si
// alguien puede una acción no hay que leer el código de la acción.
//
//   admin        el negocio: productos, stock y pedidos
//   programador  todo lo anterior + costos, dólar, márgenes y datos de cobro
//
// `nivel` es para el historial de operaciones: las entradas "sensibles"
// (precios, costos, datos de cobro) las ve solo el programador.

//
// `publico: true` = se puede llamar sin cuenta (la clienta). Esas acciones
// no pueden confiar en nada de lo que llega y tienen su propio límite.

export const PERMISOS = {
  "producto.pausar": { roles: ["admin", "programador"], nivel: "general" },
  "pedido.crear": { publico: true, nivel: "general" },
};

export const ROLES = ["admin", "programador"];

export const puede = (rol, accion) => Boolean(rol) && (PERMISOS[accion]?.roles ?? []).includes(rol);

export const esPublica = (accion) => PERMISOS[accion]?.publico === true;

export const nivelDe = (accion) => PERMISOS[accion]?.nivel ?? "sensible";
