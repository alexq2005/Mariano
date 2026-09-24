import { HttpsError } from "firebase-functions/https";
import { esPublica, puede } from "./permisos.js";
import { quienPide } from "./quien.js";
import { pausarProducto } from "./acciones/producto.js";
import { crearPedido } from "./acciones/pedido.js";

// Una sola puerta de entrada al panel: el navegador pide una acción por
// nombre y el servidor decide si puede. Tener la lista acá (y los permisos
// en permisos.js) hace que agregar una acción sea agregar una línea, y que
// se vea de un vistazo qué expone el servidor.
const ACCIONES = {
  "producto.pausar": pausarProducto,
  "pedido.crear": crearPedido,
};

export const atender = async ({ accion, datos }, auth, contexto = {}) => {
  // hasOwn: "constructor" o "toString" no son acciones aunque existan en
  // cualquier objeto de JavaScript.
  const manejar = Object.hasOwn(ACCIONES, accion) ? ACCIONES[accion] : null;
  if (!manejar) throw new HttpsError("not-found", "Esa acción no existe.");

  // Las acciones de la clienta no piden cuenta: validan todo por su cuenta.
  if (esPublica(accion)) return manejar(datos, null, contexto);

  const quien = await quienPide(auth);

  if (!puede(quien.rol, accion)) {
    throw new HttpsError("permission-denied", "Tu cuenta no puede hacer esto.");
  }

  return manejar(datos, quien, contexto);
};
