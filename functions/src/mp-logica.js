// Lo de Mercado Pago que no toca la red ni la base: verificar la firma de
// sus avisos (webhooks) y traducir un pago a lo que ve el negocio. Separado
// para probarlo sin emuladores (mp-logica.test.js).

import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

// Los avisos traen la cabecera x-signature: "ts=1704908010,v1=<hmac>". El
// hmac es SHA-256, con la clave secreta del webhook, de este texto:
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// (si falta alguno, esa parte no va; un data.id con letras va en minúscula).
export const firmaValida = ({ firma, requestId, dataId, secreto }) => {
  if (!firma || !secreto) return false;
  const partes = Object.fromEntries(
    String(firma)
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()]),
  );
  if (!partes.ts || !partes.v1) return false;
  let manifiesto = "";
  if (dataId) manifiesto += `id:${/[a-z]/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (requestId) manifiesto += `request-id:${requestId};`;
  manifiesto += `ts:${partes.ts};`;
  const esperado = Buffer.from(createHmac("sha256", secreto).update(manifiesto).digest("hex"));
  const recibido = Buffer.from(partes.v1);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
};

// El estado de Mercado Pago → el del cobro del pedido.
export const estadoCobroDe = (status) =>
  ({
    approved: "aprobado",
    authorized: "pendiente",
    pending: "pendiente",
    in_process: "pendiente",
    in_mediation: "reclamo",
    rejected: "rechazado",
    cancelled: "rechazado",
    refunded: "devuelto",
    charged_back: "devuelto",
  })[status] ?? "pendiente";

const TIPOS = {
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  prepaid_card: "Tarjeta prepaga",
  account_money: "Dinero en Mercado Pago",
  ticket: "Efectivo (Rapipago / Pago Fácil)",
  bank_transfer: "Transferencia",
  digital_wallet: "Billetera virtual",
  digital_currency: "Mercado Crédito",
};

// "Tarjeta de crédito visa, 3 cuotas"
export const detallePago = (pago) => {
  const tipo = TIPOS[pago?.payment_type_id] ?? "Mercado Pago";
  const marca = pago?.payment_method_id && !["account_money", "debmaster", "debvisa"].includes(pago.payment_method_id) ? ` ${pago.payment_method_id}` : "";
  const cuotas = pago?.installments > 1 ? `, ${pago.installments} cuotas` : "";
  return `${tipo}${pago?.payment_type_id === "credit_card" ? marca : ""}${cuotas}`;
};

// Del peor al mejor, para cuando hay más de un intento de pago.
const ORDEN = { sin_pagar: 0, rechazado: 1, pendiente: 2, aprobado: 3, reclamo: 4, devuelto: 5 };
export const avanzaCobro = (actual, nuevo) => (ORDEN[nuevo] ?? 0) > (ORDEN[actual] ?? 0) || (actual === "rechazado" && nuevo === "pendiente");

// Qué hacer con un pago que llega (por aviso o porque la clienta volvió de
// Mercado Pago):
//
//   "cobro"  pasa a ser el cobro del pedido
//   "demas"  el pedido ya estaba pagado: es un pago de más, queda a la vista
//            para devolverlo
//   "nada"   no cambia nada (aviso repetido o viejo)
//
// Los avisos llegan repetidos y desordenados. Para el MISMO pago manda la
// fecha de su última actualización: un "pendiente" viejo no pisa un
// "aprobado" nuevo, pero un pendiente que después se rechaza sí se ve. Entre
// pagos DISTINTOS (la clienta probó con otra tarjeta) gana el mejor intento.
export const decidirCobro = (actual, pago, deMas = {}) => {
  const ref = String(pago?.id ?? "");
  const nuevo = estadoCobroDe(pago?.status);
  const cuando = Date.parse(pago?.date_last_updated ?? "") || 0;
  const estado = actual?.estado ?? "sin_pagar";
  if (actual?.referencia === ref) {
    if (cuando && actual.mpActualizado) return cuando > actual.mpActualizado ? "cobro" : "nada";
    return avanzaCobro(estado, nuevo) ? "cobro" : "nada";
  }
  if (estado === "aprobado" || estado === "reclamo") {
    // Ya estaba pagado. Un intento rechazado no importa; cualquier otro es
    // plata de más (o por entrar) que hay que devolver.
    const previo = deMas?.[ref];
    if (previo) return previo.estado === nuevo ? "nada" : "demas";
    return nuevo === "rechazado" ? "nada" : "demas";
  }
  const base = estado === "devuelto" ? "sin_pagar" : estado;
  return (ORDEN[nuevo] ?? 0) >= (ORDEN[base] ?? 0) ? "cobro" : "nada";
};

// ¿El pago cubre exactamente lo que se debía? (en pesos, sin centavos de diferencia)
export const montoCorrecto = (pago, esperado) =>
  pago?.currency_id === "ARS" && Math.abs(Number(pago?.transaction_amount) - esperado) < 0.5;
