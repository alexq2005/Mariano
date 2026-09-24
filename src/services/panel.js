import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { app, EMULADOR, usandoEmuladores } from "../firebase/app";
import { recargarProductos } from "./productos";

// Todo lo que el panel modifica pasa por el servidor: el navegador pide una
// acción por nombre y Cloud Functions decide si puede, valida los datos y
// escribe. Las reglas de Firestore no dejan escribir desde el navegador.

const funciones = getFunctions(app, "us-central1");
if (usandoEmuladores) connectFunctionsEmulator(funciones, EMULADOR.host, EMULADOR.functions);

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
    const error = new Error(GENERICOS[codigo] ?? err.message ?? "No se pudo completar.");
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
