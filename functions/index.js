import { onCall } from "firebase-functions/https";
import { setGlobalOptions } from "firebase-functions";
import { atender } from "./src/router.js";

// us-central1: es donde está la base (elegido por el dueño; no se cambia
// después). maxInstances acota el gasto si algo se dispara.
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Todo lo que escribe el panel entra por acá. El navegador nunca escribe
// directo en Firestore: las reglas no se lo permiten.
export const panel = onCall(async (req) => atender(req.data ?? {}, req.auth));
