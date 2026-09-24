// Fechas en hora de Argentina. El servidor corre en UTC: un pedido de las
// 22:30 del 30 de septiembre, en UTC ya es 1 de octubre, y caería en el mes
// equivocado del resumen de ventas.

const ZONA = "America/Argentina/Buenos_Aires";
const formato = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

const partes = (fecha) => Object.fromEntries(formato.formatToParts(fecha).map((p) => [p.type, p.value]));

// "2026-09": el id del documento stats/{mes}.
export const claveMes = (fecha) => {
  const p = partes(fecha);
  return `${p.year}-${p.month}`;
};

// "07": el día dentro del mes, para las ventas por día.
export const claveDia = (fecha) => partes(fecha).day;

// "24/09/2026": la fecha de la lista de precios que ve la clienta.
export const fechaCorta = (fecha) => {
  const p = partes(fecha);
  return `${p.day}/${p.month}/${p.year}`;
};
