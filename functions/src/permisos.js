// Quién puede hacer qué. Una sola tabla, en un solo archivo: para saber si
// alguien puede una acción no hay que leer el código de la acción.
//
//   admin        el negocio: productos, stock, pedidos, clientas y datos
//   programador  todo lo anterior + costos, dólar y márgenes
//
// `nivel` es para el historial de operaciones: las entradas "sensibles"
// (dólar, factor, márgenes, costos) las ve solo el programador.

const EQUIPO = ["admin", "programador"];

export const PERMISOS = {
  "producto.pausar": { roles: EQUIPO, nivel: "general" },
  "producto.guardar": { roles: EQUIPO, nivel: "general" },
  "stock.ajustar": { roles: EQUIPO, nivel: "general" },
  "pedido.confirmar": { roles: EQUIPO, nivel: "general" },
  "pedido.entregar": { roles: EQUIPO, nivel: "general" },
  "pedido.cancelar": { roles: EQUIPO, nivel: "general" },
  "clienta.borrar": { roles: EQUIPO, nivel: "general" },
  "arrepentimiento.resolver": { roles: EQUIPO, nivel: "general" },
  "config.guardar": { roles: EQUIPO, nivel: "general" },
  "precios.recalcular": { roles: ["programador"], nivel: "sensible" },
};

export const ROLES = ["admin", "programador"];

export const puede = (rol, accion) => Boolean(rol) && (PERMISOS[accion]?.roles ?? []).includes(rol);

export const nivelDe = (accion) => PERMISOS[accion]?.nivel ?? "sensible";
