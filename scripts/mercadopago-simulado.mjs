// Un Mercado Pago de mentira, para probar el cobro en la compu sin cuenta
// ni plata. Lo levanta `npm run emu` junto con los emuladores, y las
// funciones le hablan a él (functions/.env.local → MP_API_URL) en vez de al
// de verdad. En producción no existe: ahí siempre es api.mercadopago.com.
//
//   node scripts/mercadopago-simulado.mjs      (puerto 8531)
//
// Hace lo mismo que el real en lo que usa la tienda:
//   POST /checkout/preferences        armar el pago → link al "checkout"
//   GET  /checkout/:id                la pantalla de pago, con botones para
//                                     aprobar, dejar pendiente o rechazar
//   GET  /v1/payments/:id             leer un pago
//   POST /v1/payments/:id/refunds     devolverlo
//   GET  /users/me                    ¿el token anda?
// y avisa cada cambio al webhook con la misma firma que el real.
//
// Para las pruebas automáticas (scripts/probar-funciones.mjs):
//   POST /__simular/pagar   { preferencia, resultado, medio, sinAviso }
//   POST /__simular/estado  { id, status }   (ej.: el efectivo se acreditó)
//   POST /__simular/avisar  { id }           repite el aviso (llega tarde o dos veces)
//   GET  /__simular/avisos                   los avisos que mandó y qué le respondieron
//   GET  /__simular                          (en el navegador) los pagos, con "Acreditar"

import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const PUERTO = Number(process.env.MP_SIMULADO_PUERTO ?? 8531);
const TOKEN = process.env.MP_SIMULADO_TOKEN ?? "TEST-simulado";
const SECRETO = process.env.MP_SIMULADO_SECRETO ?? "simulado";
const BASE = `http://127.0.0.1:${PUERTO}`;

const preferencias = new Map();
const pagos = new Map();
const avisos = [];
let ultimoPago = 90_000_000;

const MEDIOS = {
  credito: { payment_type_id: "credit_card", payment_method_id: "visa", installments: 3, nombre: "Tarjeta de crédito Visa, 3 cuotas" },
  debito: { payment_type_id: "debit_card", payment_method_id: "debvisa", installments: 1, nombre: "Tarjeta de débito" },
  cuenta: { payment_type_id: "account_money", payment_method_id: "account_money", installments: 1, nombre: "Dinero en la cuenta" },
  efectivo: { payment_type_id: "ticket", payment_method_id: "rapipago", installments: 1, nombre: "Efectivo en Rapipago" },
};
const RESULTADOS = {
  aprobado: { status: "approved", status_detail: "accredited" },
  pendiente: { status: "pending", status_detail: "pending_waiting_payment" },
  rechazado: { status: "rejected", status_detail: "cc_rejected_insufficient_amount" },
};

const json = (res, status, cuerpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};
const leerCuerpo = (req) =>
  new Promise((ok) => {
    let t = "";
    req.on("data", (c) => (t += c));
    req.on("end", () => {
      if (!t) return ok({});
      try {
        ok(JSON.parse(t));
      } catch {
        ok(Object.fromEntries(new URLSearchParams(t)));
      }
    });
  });
const autorizado = (req) => req.headers.authorization === `Bearer ${TOKEN}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// El aviso, firmado como el real: HMAC-SHA256 de "id:..;request-id:..;ts:..;"
const avisar = async (pago, { firma = true } = {}) => {
  const pref = preferencias.get(pago.preference_id);
  if (!pref?.notification_url) return;
  const requestId = randomUUID();
  const ts = String(Date.now());
  const v1 = createHmac("sha256", firma ? SECRETO : "otra-clave").update(`id:${pago.id};request-id:${requestId};ts:${ts};`).digest("hex");
  const url = `${pref.notification_url}?data.id=${pago.id}&type=payment`;
  const registro = { pago: pago.id, status: pago.status, respuesta: null };
  avisos.push(registro);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
      body: JSON.stringify({ action: "payment.updated", api_version: "v1", type: "payment", live_mode: false, data: { id: String(pago.id) } }),
    });
    registro.respuesta = r.status;
  } catch (err) {
    registro.respuesta = `error: ${err.message}`;
  }
};

const ahoraIso = () => new Date().toISOString();

const pagar = (prefId, resultado = "aprobado", medio = "credito") => {
  const pref = preferencias.get(prefId);
  if (!pref) return null;
  const item = pref.items?.[0] ?? {};
  const monto = (pref.items ?? []).reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity ?? 1), 0);
  const m = MEDIOS[medio] ?? MEDIOS.credito;
  const r = RESULTADOS[resultado] ?? RESULTADOS.aprobado;
  const pago = {
    id: ++ultimoPago,
    ...r,
    transaction_amount: monto,
    currency_id: item.currency_id ?? "ARS",
    external_reference: pref.external_reference,
    payment_type_id: m.payment_type_id,
    payment_method_id: m.payment_method_id,
    installments: m.installments,
    description: item.title,
    date_created: ahoraIso(),
    date_last_updated: ahoraIso(),
    date_approved: r.status === "approved" ? ahoraIso() : null,
    preference_id: prefId,
    live_mode: false,
  };
  pagos.set(pago.id, pago);
  return pago;
};

const vuelta = (pago) => {
  const pref = preferencias.get(pago.preference_id);
  const clave = { approved: "success", pending: "pending" }[pago.status] ?? "failure";
  const destino = pref.back_urls?.[clave];
  if (!destino) return null;
  const q = new URLSearchParams({
    collection_id: String(pago.id),
    collection_status: pago.status,
    payment_id: String(pago.id),
    status: pago.status,
    external_reference: pago.external_reference ?? "",
    payment_type: pago.payment_type_id,
    preference_id: pago.preference_id,
    site_id: "MLA",
  });
  return `${destino}?${q}`;
};

const pantallaDePago = (pref) => {
  const item = pref.items?.[0] ?? {};
  const monto = Number(item.unit_price).toLocaleString("es-AR");
  const boton = (resultado, medio, texto) =>
    `<form method="post" action="${pref.id}/pagar"><input type="hidden" name="resultado" value="${resultado}"><input type="hidden" name="medio" value="${medio}"><button data-resultado="${resultado}" data-medio="${medio}">${esc(texto)}</button></form>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pago simulado</title>
<style>
body{font-family:system-ui,sans-serif;background:#eef1f5;margin:0;padding:24px 16px;color:#1d2330}
main{max-width:420px;margin:0 auto;background:#fff;border-radius:14px;padding:22px;box-shadow:0 6px 24px #0001}
.aviso{background:#fff4d6;border:1px solid #e8c768;border-radius:10px;padding:10px 12px;font-size:14px;margin-bottom:16px}
h1{font-size:18px;margin:0 0 4px}.monto{font-size:32px;font-weight:800;margin:6px 0 18px}
form{margin:0 0 10px}button{width:100%;padding:13px;border-radius:10px;border:1px solid #c9d1de;background:#f7f9fc;font-size:15px;cursor:pointer;text-align:left}
button[data-resultado=aprobado]{border-color:#3a8a4d}button[data-resultado=rechazado]{border-color:#b33a3a}
</style></head><body><main>
<p class="aviso"><b>Mercado Pago SIMULADO.</b> No se cobra nada: sirve para probar la tienda en la compu.</p>
<h1>${esc(item.title)}</h1><p>${esc(item.description ?? "")}</p>
<p class="monto">$ ${monto}</p>
${boton("aprobado", "credito", "Pagar con tarjeta de crédito (3 cuotas) — se aprueba")}
${boton("aprobado", "cuenta", "Pagar con dinero en la cuenta — se aprueba")}
${boton("pendiente", "efectivo", "Pagar en efectivo en Rapipago — queda pendiente")}
${boton("rechazado", "credito", "Tarjeta sin fondos — se rechaza")}
</main></body></html>`;
};

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const partes = url.pathname.split("/").filter(Boolean);

  // ── API (con token) ───────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/users/me") {
    if (!autorizado(req)) return json(res, 401, { message: "invalid access token", status: 401 });
    return json(res, 200, { id: 123456789, nickname: "TIENDA-SIMULADA", site_id: "MLA" });
  }
  if (req.method === "POST" && url.pathname === "/checkout/preferences") {
    if (!autorizado(req)) return json(res, 401, { message: "invalid access token", status: 401 });
    const cuerpo = await leerCuerpo(req);
    const item = cuerpo.items?.[0];
    if (!item || !(Number(item.unit_price) > 0)) return json(res, 400, { message: "unit_price invalid", status: 400 });
    if (cuerpo.auto_return && !cuerpo.back_urls?.success) return json(res, 400, { message: "auto_return invalid. back_url.success must be defined", status: 400 });
    const id = `123456789-${randomUUID()}`;
    // El link de pago, por el mismo servidor de la tienda (el que manda en
    // back_urls: vite.config.js reenvía /__mp a este simulado). Así lo abre
    // el navegador también en una compu en la nube, donde 127.0.0.1 no llega.
    let pagina = `${BASE}/checkout/${id}`;
    try {
      pagina = `${new URL(cuerpo.back_urls.success).origin}/__mp/checkout/${id}`;
    } catch {
      /* sin back_urls: directo al simulado */
    }
    const pref = { ...cuerpo, id, init_point: pagina, sandbox_init_point: pagina, date_created: ahoraIso() };
    preferencias.set(id, pref);
    return json(res, 201, pref);
  }
  if (partes[0] === "v1" && partes[1] === "payments" && partes[2]) {
    if (!autorizado(req)) return json(res, 401, { message: "invalid access token", status: 401 });
    const pago = pagos.get(Number(partes[2]));
    if (!pago) return json(res, 404, { message: "Payment not found", status: 404 });
    if (req.method === "GET" && partes.length === 3) return json(res, 200, pago);
    if (req.method === "POST" && partes[3] === "refunds") {
      if (!req.headers["x-idempotency-key"]) return json(res, 400, { message: "X-Idempotency-Key required", status: 400 });
      if (pago.status === "refunded") return json(res, 201, { id: pago.devolucion, payment_id: pago.id, amount: pago.transaction_amount, status: "approved" });
      if (pago.status !== "approved") return json(res, 400, { message: "Payment not approved", status: 400 });
      Object.assign(pago, { status: "refunded", status_detail: "refunded", date_last_updated: ahoraIso(), devolucion: ++ultimoPago });
      setTimeout(() => avisar(pago), 150);
      return json(res, 201, { id: pago.devolucion, payment_id: pago.id, amount: pago.transaction_amount, status: "approved" });
    }
  }

  // ── La pantalla de pago (la ve la clienta, sin token) ─────────────
  if (partes[0] === "checkout" && partes[1] && preferencias.has(partes[1])) {
    const pref = preferencias.get(partes[1]);
    if (req.method === "GET" && partes.length === 2) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(pantallaDePago(pref));
    }
    if (req.method === "POST" && partes[2] === "pagar") {
      const { resultado, medio } = await leerCuerpo(req);
      const pago = pagar(pref.id, resultado, medio);
      setTimeout(() => avisar(pago), 300);
      const destino = vuelta(pago);
      res.writeHead(destino ? 303 : 200, destino ? { Location: destino } : { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(destino ? "" : `Pago ${pago.id}: ${pago.status}`);
    }
  }

  // ── Para las pruebas automáticas ──────────────────────────────────
  if (req.method === "POST" && url.pathname === "/__simular/pagar") {
    const { preferencia, resultado, medio, sinAviso, firmaMala } = await leerCuerpo(req);
    const pago = pagar(preferencia, resultado, medio);
    if (!pago) return json(res, 404, { message: "no existe esa preferencia" });
    if (!sinAviso) await avisar(pago, { firma: !firmaMala });
    return json(res, 200, { pago, vuelta: vuelta(pago) });
  }
  if (req.method === "POST" && url.pathname === "/__simular/estado") {
    const { id, status, sinAviso } = await leerCuerpo(req);
    const pago = pagos.get(Number(id));
    if (!pago) return json(res, 404, { message: "no existe ese pago" });
    Object.assign(pago, { status, status_detail: status === "approved" ? "accredited" : status, date_last_updated: ahoraIso() });
    if (!sinAviso) await avisar(pago);
    return json(res, 200, { pago });
  }
  if (req.method === "POST" && url.pathname === "/__simular/avisar") {
    const { id } = await leerCuerpo(req);
    const pago = pagos.get(Number(id));
    if (!pago) return json(res, 404, { message: "no existe ese pago" });
    await avisar(pago);
    return json(res, 200, { pago });
  }
  if (req.method === "GET" && url.pathname === "/__simular/avisos") return json(res, 200, avisos);
  // Para probar a mano: los pagos, con un botón para acreditar los
  // pendientes (el efectivo que se paga en Rapipago horas después).
  if (req.method === "GET" && url.pathname === "/__simular") {
    const filas = [...pagos.values()]
      .reverse()
      .map(
        (p) =>
          `<tr><td>${p.id}</td><td>${esc(p.description)}</td><td>$ ${Number(p.transaction_amount).toLocaleString("es-AR")}</td><td>${p.status}</td><td>` +
          (p.status === "pending"
            ? `<form method="post" action="__simular/acreditar"><input type="hidden" name="id" value="${p.id}"><button>Acreditar</button></form>`
            : "") +
          `</td></tr>`,
      )
      .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mercado Pago simulado</title>` +
        `<body style="font-family:system-ui;padding:16px"><h1>Mercado Pago simulado: pagos</h1><p>Solo en la compu. «Acreditar» hace de cuenta que se pagó en Rapipago / Pago Fácil.</p>` +
        `<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>N.º</th><th>Pedido</th><th>Monto</th><th>Estado</th><th></th></tr>${filas || '<tr><td colspan="5">Todavía no hay pagos.</td></tr>'}</table></body></html>`,
    );
  }
  if (req.method === "POST" && url.pathname === "/__simular/acreditar") {
    const { id } = await leerCuerpo(req);
    const pago = pagos.get(Number(id));
    if (pago?.status === "pending") {
      Object.assign(pago, { status: "approved", status_detail: "accredited", date_last_updated: ahoraIso(), date_approved: ahoraIso() });
      await avisar(pago);
    }
    // Relativo: anda igual directo (127.0.0.1:8531) que por la tienda (/__mp).
    res.writeHead(303, { Location: "../__simular" });
    return res.end();
  }
  if (req.method === "GET" && url.pathname === "/__simular/preferencias") return json(res, 200, [...preferencias.values()]);

  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }
  json(res, 404, { message: "not found", status: 404 });
});

servidor.listen(PUERTO, "127.0.0.1", () => console.log(`Mercado Pago simulado en ${BASE}`));
