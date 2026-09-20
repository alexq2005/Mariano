import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { app, EMULADOR, usandoEmuladores } from "../firebase/app";
import { recargarProductos } from "./productos";

// Todo lo que el panel modifica pasa por el servidor: el navegador pide una
// acción por nombre y Cloud Functions decide si puede, valida los datos y
// escribe. Las reglas de Firestore no dejan escribir desde el navegador.

const funciones = getFunctions(app, "us-central1");
if (usandoEmuladores) connectFunctionsEmulator(funciones, EMULADOR.host, EMULADOR.functions);

const panel = httpsCallable(funciones, "panel");

// Los códigos del servidor no se le muestran a nadie: se traducen.
const MENSAJES = {
  unauthenticated: "Se cerró tu sesión. Entrá de nuevo.",
  "permission-denied": "Tu cuenta no puede hacer esto.",
  "not-found": "Eso ya no existe. Actualizá la página.",
  "failed-precondition": "No se puede hacer ahora mismo.",
  "invalid-argument": "Faltan datos o están mal.",
  unavailable: "No hay conexión con el servidor. Probá de nuevo.",
};

export const llamarPanel = async (accion, datos = {}) => {
  try {
    const { data } = await panel({ accion, datos });
    return data;
  } catch (err) {
    console.error(`Falló la acción ${accion}:`, err);
    const error = new Error(MENSAJES[err.code?.replace("functions/", "")] ?? err.message ?? "No se pudo completar.");
    error.codigo = err.code;
    throw error;
  }
};

// Después de cambiar algo, el panel vuelve a leer el catálogo para mostrar
// el estado real y no una suposición del navegador.
export const llamarYRefrescar = async (accion, datos) => {
  const resultado = await llamarPanel(accion, datos);
  await recargarProductos();
  return resultado;
};
