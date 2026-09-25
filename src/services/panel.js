import { getFunctions, httpsCallable } from "firebase/functions";
import { app, EMULADOR, usandoEmuladores } from "../firebase/app";
import { recargarProductos } from "./productos";

// Todo lo que el panel modifica pasa por el servidor: el navegador pide una
// acción por nombre y Cloud Functions decide si puede, valida los datos y
// escribe. Las reglas de Firestore no dejan escribir desde el navegador.

// Con los emuladores, por el servidor de la tienda (ver EMULADOR en app.js).
const funciones = getFunctions(app, usandoEmuladores ? EMULADOR.funciones : "us-central1");

const panel = httpsCallable(funciones, "panel");

// El servidor explica los problemas en castellano ("No alcanza el stock:
// Labial (hay 3, pide 12)"), y ese mensaje se muestra tal cual. Solo los
// errores internos o de conexión se reemplazan por uno que se entienda.
const GENERICOS = {
  unauthenticated: "Se cerró tu sesión. Entrá de nuevo.",
  unavailable: "No hay conexión con el servidor. Probá de nuevo.",
  "deadline-exceeded": "El servidor tardó demasiado. Probá de nuevo.",
  internal: "Hubo un problema en el servidor. Probá de nuevo en un rato.",
  unknown: "Hubo un problema en el servidor. Probá de nuevo en un rato.",
};

export const llamarPanel = async (accion, datos = {}) => {
  try {
    const { data } = await panel({ accion, datos });
    return data;
  } catch (err) {
    console.error(`Falló la acción ${accion}:`, err);
    const codigo = err.code?.replace("functions/", "");
    // El SDK le agrega al mensaje el código HTTP (" [400]"): a quien lo lee no le dice nada.
    const mensaje = typeof err.message === "string" ? err.message.replace(/\s*\[\d{3}\]$/, "") : "";
    const error = new Error(GENERICOS[codigo] ?? (mensaje || "No se pudo completar."));
    error.detalle = err.details ?? null;
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
