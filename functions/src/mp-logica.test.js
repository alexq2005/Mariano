import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { avanzaCobro, decidirCobro, detallePago, estadoCobroDe, firmaValida, montoCorrecto } from "./mp-logica.js";

const firmar = (manifiesto, secreto) => createHmac("sha256", secreto).update(manifiesto).digest("hex");

describe("firma de los avisos de Mercado Pago", () => {
  const secreto = "clave-del-webhook";
  const ts = "1704908010";
  const v1 = firmar(`id:123456;request-id:abc-1;ts:${ts};`, secreto);

  it("acepta la firma correcta", () => {
    expect(firmaValida({ firma: `ts=${ts},v1=${v1}`, requestId: "abc-1", dataId: "123456", secreto })).toBe(true);
  });
  it("rechaza si cambia el pago, la cabecera, el momento o la clave", () => {
    expect(firmaValida({ firma: `ts=${ts},v1=${v1}`, requestId: "abc-1", dataId: "999", secreto })).toBe(false);
    expect(firmaValida({ firma: `ts=${ts},v1=${v1}`, requestId: "otro", dataId: "123456", secreto })).toBe(false);
    expect(firmaValida({ firma: `ts=1,v1=${v1}`, requestId: "abc-1", dataId: "123456", secreto })).toBe(false);
    expect(firmaValida({ firma: `ts=${ts},v1=${v1}`, requestId: "abc-1", dataId: "123456", secreto: "otra" })).toBe(false);
  });
  it("sin firma o con basura: no", () => {
    expect(firmaValida({ firma: "", requestId: "abc-1", dataId: "123456", secreto })).toBe(false);
    expect(firmaValida({ firma: "cualquier cosa", requestId: "abc-1", dataId: "123456", secreto })).toBe(false);
  });
  it("un id con letras va en minúscula", () => {
    const v = firmar(`id:abc123;request-id:r;ts:${ts};`, secreto);
    expect(firmaValida({ firma: `ts=${ts},v1=${v}`, requestId: "r", dataId: "ABC123", secreto })).toBe(true);
  });
});

describe("el pago, traducido", () => {
  it("estados", () => {
    expect(estadoCobroDe("approved")).toBe("aprobado");
    expect(estadoCobroDe("in_process")).toBe("pendiente");
    expect(estadoCobroDe("rejected")).toBe("rechazado");
    expect(estadoCobroDe("refunded")).toBe("devuelto");
  });
  it("detalle", () => {
    expect(detallePago({ payment_type_id: "credit_card", payment_method_id: "visa", installments: 3 })).toBe("Tarjeta de crédito visa, 3 cuotas");
    expect(detallePago({ payment_type_id: "account_money", payment_method_id: "account_money", installments: 1 })).toBe("Dinero en Mercado Pago");
  });
  it("un aviso viejo no pisa uno nuevo", () => {
    expect(avanzaCobro("aprobado", "pendiente")).toBe(false);
    expect(avanzaCobro("pendiente", "aprobado")).toBe(true);
    expect(avanzaCobro("aprobado", "devuelto")).toBe(true);
    expect(avanzaCobro("rechazado", "pendiente")).toBe(true);
    expect(avanzaCobro("sin_pagar", "rechazado")).toBe(true);
  });
  it("el monto tiene que coincidir, en pesos", () => {
    expect(montoCorrecto({ currency_id: "ARS", transaction_amount: 45300 }, 45300)).toBe(true);
    expect(montoCorrecto({ currency_id: "ARS", transaction_amount: 100 }, 45300)).toBe(false);
    expect(montoCorrecto({ currency_id: "USD", transaction_amount: 45300 }, 45300)).toBe(false);
  });
});

describe("qué hacer con un pago que llega", () => {
  const pago = (id, status, fecha) => ({ id, status, date_last_updated: fecha });
  const t1 = "2026-09-24T10:00:00.000-03:00";
  const t2 = "2026-09-24T10:05:00.000-03:00";

  it("el primer pago pasa a ser el cobro, aunque venga rechazado", () => {
    expect(decidirCobro({ estado: "sin_pagar" }, pago(1, "approved", t1))).toBe("cobro");
    expect(decidirCobro(undefined, pago(1, "rejected", t1))).toBe("cobro");
  });
  it("mismo pago: manda la fecha, no el orden de llegada", () => {
    const actual = { estado: "aprobado", referencia: "1", mpActualizado: Date.parse(t2) };
    expect(decidirCobro(actual, pago(1, "pending", t1))).toBe("nada");
    expect(decidirCobro(actual, pago(1, "approved", t2))).toBe("nada");
    expect(decidirCobro(actual, pago(1, "refunded", "2026-09-25T10:00:00.000-03:00"))).toBe("cobro");
  });
  it("un efectivo pendiente que vence sí se ve como rechazado", () => {
    const actual = { estado: "pendiente", referencia: "1", mpActualizado: Date.parse(t1) };
    expect(decidirCobro(actual, pago(1, "cancelled", t2))).toBe("cobro");
  });
  it("sin fecha, un aviso viejo no pisa uno nuevo", () => {
    expect(decidirCobro({ estado: "aprobado", referencia: "1" }, pago(1, "pending"))).toBe("nada");
  });
  it("otro intento: gana el mejor", () => {
    expect(decidirCobro({ estado: "rechazado", referencia: "1" }, pago(2, "approved", t2))).toBe("cobro");
    expect(decidirCobro({ estado: "pendiente", referencia: "1" }, pago(2, "rejected", t2))).toBe("nada");
    expect(decidirCobro({ estado: "devuelto", referencia: "1" }, pago(2, "approved", t2))).toBe("cobro");
  });
  it("si ya estaba pagado (con Mercado Pago o a mano), el nuevo es un pago de más", () => {
    expect(decidirCobro({ estado: "aprobado", referencia: "1" }, pago(2, "approved", t2))).toBe("demas");
    expect(decidirCobro({ estado: "aprobado", medio: "transferencia", referencia: null }, pago(2, "approved", t2))).toBe("demas");
    expect(decidirCobro({ estado: "aprobado", referencia: "1" }, pago(2, "approved", t2), { 2: { estado: "aprobado" } })).toBe("nada");
    expect(decidirCobro({ estado: "aprobado", referencia: "1" }, pago(2, "refunded", t2), { 2: { estado: "aprobado" } })).toBe("demas");
    // un intento rechazado de antes, que avisa tarde: no es plata de más
    expect(decidirCobro({ estado: "aprobado", referencia: "1" }, pago(2, "rejected", t1))).toBe("nada");
  });
  it("un reclamo de la clienta se ve", () => {
    expect(estadoCobroDe("in_mediation")).toBe("reclamo");
  });
});
