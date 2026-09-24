import { onCall, onRequest } from "firebase-functions/https";
import { setGlobalOptions } from "firebase-functions";
import { atender, atenderTienda } from "./src/router.js";
import { recibirAviso } from "./src/acciones/cobro.js";
import { MP_TOKEN, MP_WEBHOOK_SECRET } from "./src/mercadopago.js";

// us-central1: es donde está la base (elegido por el dueño; no se cambia
// después). maxInstances acota el gasto si algo se dispara.
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Todo lo que escribe el panel entra por acá. El navegador nunca escribe
// directo en Firestore: las reglas no se lo permiten.
export const panel = onCall({ secrets: [MP_TOKEN] }, async (req) => atender(req.data ?? {}, req.auth));

// Lo que la clienta puede hacer sin cuenta: hacer el pedido, pagarlo y el
// botón de arrepentimiento. La IP solo se usa (resumida) para frenar el abuso.
export const tienda = onCall({ secrets: [MP_TOKEN] }, async (req) => atenderTienda(req.data ?? {}, { ip: req.rawRequest?.ip ?? null }));

// Los avisos de Mercado Pago (webhook): "este pago cambió". Se verifica la
// firma y el pago se lee de Mercado Pago, nunca de lo que trae el aviso.
export const mercadopago = onRequest({ secrets: [MP_TOKEN, MP_WEBHOOK_SECRET] }, recibirAviso);
