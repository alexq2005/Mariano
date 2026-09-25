// Cómo se muestran las cosas en el panel: fechas, estados y acciones.

// Firestore devuelve Timestamp; la auditoría guarda texto ISO.
export const aFecha = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const f = new Date(v);
  return Number.isNaN(f.getTime()) ? null : f;
};

export const fechaHora = (v) => {
  const f = aFecha(v);
  return f ? f.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
};

export const fechaLarga = (v) => {
  const f = aFecha(v);
  return f ? f.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "";
};

// "2026-09" → "septiembre 2026"
export const nombreMes = (clave) => {
  const [a, m] = String(clave).split("-").map(Number);
  if (!a || !m) return clave;
  return new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
};

export const ESTADOS = {
  pendiente: { nom: "Pendiente", plural: "Pendientes" },
  confirmado: { nom: "Confirmado", plural: "Confirmados" },
  entregado: { nom: "Entregado", plural: "Entregados" },
  cancelado: { nom: "Cancelado", plural: "Cancelados" },
};

export const COBROS = {
  sin_pagar: "Sin pagar",
  pendiente: "Pago en proceso",
  aprobado: "Pagado",
  rechazado: "Pago rechazado",
  reclamo: "Reclamo abierto",
  devuelto: "Pago devuelto",
};

export const ACCIONES = {
  "producto.pausar": "Pausó o reactivó un producto",
  "producto.guardar": "Guardó un producto",
  "stock.ajustar": "Cambió el stock",
  "pedido.confirmar": "Confirmó un pedido",
  "pedido.entregar": "Marcó un pedido entregado",
  "pedido.cancelar": "Canceló un pedido",
  "clienta.borrar": "Borró los datos de una clienta",
  "arrepentimiento.resolver": "Resolvió un arrepentimiento",
  "config.guardar": "Cambió la configuración",
  "precios.recalcular": "Recalculó los precios",
  "pedido.envio": "Cambió el envío de un pedido",
  "pago.registrar": "Marcó un pedido pagado",
  "pago.anular": "Anuló un pago marcado a mano",
  "pago.devolver": "Devolvió un pago de Mercado Pago",
  "pago.mercadopago": "Mercado Pago avisó un pago",
  "pago.demas": "Mercado Pago avisó un pago de más",
  "cobro.guardar": "Cambió los datos para cobrar",
  "facturacion.guardar": "Cambió los datos de facturación",
  "factura.emitida": "ARCA autorizó una factura",
  "factura.anulada": "ARCA autorizó una nota de crédito",
  "factura.reintentar": "Reintentó una factura",
  "factura.emitir": "Pidió emitir una factura",
  "pedido.fiscal": "Cambió los datos de facturación de un pedido",
};
