import { HttpsError } from "firebase-functions/https";
import { puede } from "./permisos.js";
import { quienPide } from "./quien.js";
import { pausarProducto } from "./acciones/producto.js";

// Una sola puerta de entrada al panel: el navegador pide una acción por
// nombre y el servidor decide si puede. Tener la lista acá (y los permisos
// en permisos.js) hace que agregar una acción sea agregar una línea, y que
// se vea de un vistazo qué expone el servidor.
const ACCIONES = {
  "producto.pausar": pausarProducto,
};

export const atender = async ({ accion, datos }, auth) => {
  const manejar = ACCIONES[accion];
  if (!manejar) throw new HttpsError("not-found", "Esa acción no existe.");

  const quien = await quienPide(auth);

  if (!puede(quien.rol, accion)) {
    throw new HttpsError("permission-denied", "Tu cuenta no puede hacer esto.");
  }

  return manejar(datos, quien);
};
