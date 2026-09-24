// Lo que la tienda le pide al servidor: guardar el pedido y el botón de
// arrepentimiento (Cloud Function "tienda", ver functions/src/router.js).
//
// Con fetch y no con el SDK de Firebase: el SDK de funciones pesa, y una
// clienta que entra a mirar productos no tiene por qué descargarlo. El
// protocolo de las funciones "callable" es JSON común: {data} de ida,
// {result} o {error} de vuelta.

const env = import.meta.env;
const enEmuladores = env.DEV && env.VITE_FIREBASE_EMULADORES !== "no";
const proyecto = env.VITE_FIREBASE_PROJECT_ID;

// Sin proyecto de Firebase (por ejemplo, la vista previa en GitHub Pages sin
// variables), el pedido va solo por WhatsApp, como antes.
export const hayServidor = Boolean(proyecto);

const URL_TIENDA = enEmuladores
  ? `http://127.0.0.1:8522/${proyecto}/us-central1/tienda`
  : `https://us-central1-${proyecto}.cloudfunctions.net/tienda`;

export class ErrorTienda extends Error {
  constructor(mensaje, codigo, detalle) {
    super(mensaje);
    this.codigo = codigo;
    this.detalle = detalle ?? null;
    // Si el problema es de conexión o del servidor (no de los datos), la
    // clienta puede mandar el pedido igual por WhatsApp.
    this.deConexion = ["sin-conexion", "http", "INTERNAL", "UNAVAILABLE", "DEADLINE_EXCEEDED", "UNKNOWN"].includes(codigo);
  }
}

export const llamarTienda = async (accion, datos) => {
  if (!hayServidor) throw new ErrorTienda("La tienda no está conectada al servidor.", "sin-servidor");
  let res;
  try {
    res = await fetch(URL_TIENDA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { accion, datos } }),
    });
  } catch {
    throw new ErrorTienda("No hay conexión. Revisá internet y probá de nuevo.", "sin-conexion");
  }
  const respuesta = await res.json().catch(() => null);
  if (respuesta?.error) {
    const { status, message, details } = respuesta.error;
    const interno = ["INTERNAL", "UNKNOWN"].includes(status);
    throw new ErrorTienda(interno ? "Hubo un problema del lado de la tienda. Probá de nuevo en un rato." : message, status, details);
  }
  if (!res.ok || !respuesta || !("result" in respuesta)) {
    throw new ErrorTienda("El servidor no respondió bien. Probá de nuevo.", "http");
  }
  return respuesta.result;
};

// El link que se le da a la clienta para ver cómo va su pedido.
export const urlSeguimiento = (token) => `${window.location.origin}${import.meta.env.BASE_URL}pedido/${token}`;
