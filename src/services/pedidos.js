import { leerDocumentoPublico } from "./firestoreRest";

// Pedidos de la clienta: crearlo en el servidor y leer su seguimiento.
//
// Sin el SDK de Firebase, igual que el catálogo: la tienda solo necesita
// UNA llamada a la función y UNA lectura. El protocolo de las funciones
// "callable" es HTTP común: POST con {data} y respuesta {result} o {error}.

const env = import.meta.env;
const enEmuladores = env.DEV && env.VITE_FIREBASE_EMULADORES !== "no";
const proyecto = env.VITE_FIREBASE_PROJECT_ID;

const URL_PANEL = enEmuladores
  ? `http://127.0.0.1:8522/${proyecto}/us-central1/panel`
  : `https://us-central1-${proyecto}.cloudfunctions.net/panel`;

// Lo que el servidor contesta cuando rechaza, traducido para la clienta.
const MENSAJES = {
  "resource-exhausted": "Se hicieron muchos pedidos seguidos desde esta conexión. Probá de nuevo en un rato.",
  "invalid-argument": "Revisá tus datos.",
  unavailable: "No hay conexión con la tienda. Revisá tu internet y probá de nuevo.",
};

export class ErrorPedido extends Error {
  constructor(codigo, mensaje, detalles) {
    super(mensaje);
    this.codigo = codigo;
    this.detalles = detalles ?? {};
  }
}

// Código al azar por intento de compra: si el pedido llega dos veces (doble
// clic, se cortó la red y se reintentó), el servidor devuelve el mismo.
export const nuevaSolicitud = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const crearPedido = async ({ items, cliente, totalVisto, solicitud }) => {
  let res;
  try {
    res = await fetch(URL_PANEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { accion: "pedido.crear", datos: { items, cliente, totalVisto, solicitud } } }),
    });
  } catch {
    throw new ErrorPedido("unavailable", MENSAJES.unavailable);
  }

  const respuesta = await res.json().catch(() => ({}));
  if (respuesta.result) return respuesta.result;

  const codigo = (respuesta.error?.status ?? "unavailable").toLowerCase().replace(/_/g, "-");
  const mensaje = MENSAJES[codigo] ?? respuesta.error?.message ?? "No se pudo hacer el pedido. Probá de nuevo.";
  throw new ErrorPedido(codigo, mensaje, respuesta.error?.details);
};

// El link de seguimiento: 32 caracteres hexadecimales (128 bits al azar).
export const seguimientoValido = (token) => /^[0-9a-f]{32}$/.test(token ?? "");

// Devuelve el seguimiento, o null si no existe o ya venció (las reglas
// responden 403 a un seguimiento vencido: para la clienta es lo mismo).
export const leerSeguimiento = async (token) => {
  if (!seguimientoValido(token)) return null;
  try {
    return await leerDocumentoPublico(`seguimiento/${token}`);
  } catch (err) {
    if (/todavía no se publicó|HTTP 403/.test(err.message)) return null;
    throw err;
  }
};

export const ESTADOS = {
  nuevo: { nombre: "Recibido", detalle: "Lo vamos a revisar y te escribimos para confirmar stock, envío y pago." },
};

export const estadoDe = (id) => ESTADOS[id] ?? { nombre: id, detalle: "" };
