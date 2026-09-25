import { onCall, onRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { setGlobalOptions } from "firebase-functions";
import { atender, atenderTienda } from "./src/router.js";
import { recibirAviso } from "./src/acciones/cobro.js";
import { revisarFacturas } from "./src/acciones/factura.js";
import { MP_TOKEN, MP_WEBHOOK_SECRET } from "./src/mercadopago.js";
import { ARCA_CERT, ARCA_KEY } from "./src/arca/arca.js";

// us-central1: es donde está la base (elegido por el dueño; no se cambia
// después). maxInstances acota el gasto si algo se dispara.
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Las tres puertas que pueden registrar un cobro también emiten la factura
// en ese momento: por eso las tres llevan el certificado de ARCA.
const secretos = [MP_TOKEN, ARCA_CERT, ARCA_KEY];

// Todo lo que escribe el panel entra por acá. El navegador nunca escribe
// directo en Firestore: las reglas no se lo permiten.
export const panel = onCall({ secrets: secretos }, async (req) => atender(req.data ?? {}, req.auth));

// Lo que la clienta puede hacer sin cuenta: hacer el pedido, pagarlo y el
// botón de arrepentimiento. La IP solo se usa (resumida) para frenar el abuso.
export const tienda = onCall({ secrets: secretos }, async (req) => atenderTienda(req.data ?? {}, { ip: req.rawRequest?.ip ?? null }));

// Los avisos de Mercado Pago (webhook): "este pago cambió". Se verifica la
// firma y el pago se lee de Mercado Pago, nunca de lo que trae el aviso.
export const mercadopago = onRequest({ secrets: [...secretos, MP_WEBHOOK_SECRET] }, recibirAviso);

// Cada 30 minutos: reintenta lo que no se pudo facturar por algo pasajero
// (ARCA caído) y destraba lo que quedó a medias.
export const revisarFacturasPendientes = onSchedule(
  { schedule: "every 30 minutes", timeZone: "America/Argentina/Buenos_Aires", secrets: [ARCA_CERT, ARCA_KEY], timeoutSeconds: 300 },
  async () => {
    await revisarFacturas();
  },
);
