import process from "node:process";
import { defineSecret } from "firebase-functions/params";
import { HttpsError } from "firebase-functions/https";

// Las credenciales de Mercado Pago viven en Secret Manager, nunca en el
// código ni en Firestore. `npm run desplegar` las pide la primera vez; hasta
// tener cuenta se carga SIN-CONFIGURAR y el cobro online queda apagado.
//
//   MP_ACCESS_TOKEN     Tus integraciones → Credenciales de producción
//   MP_WEBHOOK_SECRET   Tus integraciones → Webhooks → Clave secreta
export const MP_TOKEN = defineSecret("MP_ACCESS_TOKEN");
export const MP_WEBHOOK_SECRET = defineSecret("MP_WEBHOOK_SECRET");

const SIN_CONFIGURAR = "SIN-CONFIGURAR";
const configurado = (v) => Boolean(v) && v.trim() !== SIN_CONFIGURAR;

export const hayMercadoPago = () => configurado(MP_TOKEN.value());
export const secretoWebhook = () => (configurado(MP_WEBHOOK_SECRET.value()) ? MP_WEBHOOK_SECRET.value().trim() : null);

// En el emulador se habla con el Mercado Pago simulado
// (scripts/mercadopago-simulado.mjs); en producción, siempre con el de verdad.
const emulador = process.env.FUNCTIONS_EMULATOR === "true";
const API = emulador && process.env.MP_API_URL ? process.env.MP_API_URL : "https://api.mercadopago.com";

// Dónde quedan publicadas las funciones: ahí manda Mercado Pago sus avisos.
export const urlFunciones = () => {
  const proyecto = process.env.GCLOUD_PROJECT;
  return emulador ? `http://127.0.0.1:8522/${proyecto}/us-central1` : `https://us-central1-${proyecto}.cloudfunctions.net`;
};

export class ErrorMercadoPago extends Error {
  constructor(status, cuerpo) {
    super(`Mercado Pago respondió ${status}: ${JSON.stringify(cuerpo).slice(0, 300)}`);
    this.status = status;
    this.cuerpo = cuerpo;
  }
}

export const mp = async (ruta, { method = "GET", body, idempotencia } = {}) => {
  if (!hayMercadoPago()) {
    throw new HttpsError("failed-precondition", "Mercado Pago todavía no está conectado (falta el token en el servidor).");
  }
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      Authorization: `Bearer ${MP_TOKEN.value().trim()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencia ? { "X-Idempotency-Key": idempotencia } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const texto = await res.text();
  let cuerpo;
  try {
    cuerpo = texto ? JSON.parse(texto) : {};
  } catch {
    cuerpo = { texto: texto.slice(0, 300) };
  }
  if (!res.ok) throw new ErrorMercadoPago(res.status, cuerpo);
  return cuerpo;
};
