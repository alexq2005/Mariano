import { HttpsError } from "firebase-functions/https";
import { puede } from "./permisos.js";
import { quienPide } from "./quien.js";
import { pausarProducto } from "./acciones/producto.js";
import { guardarProducto } from "./acciones/producto-guardar.js";
import { ajustarStock } from "./acciones/stock.js";
import { cancelarPedido, confirmarPedido, crearPedido, entregarPedido } from "./acciones/pedido.js";
import { recalcularPrecios } from "./acciones/precios.js";
import { guardarConfig } from "./acciones/config.js";
import { borrarClienta } from "./acciones/clienta.js";
import { crearArrepentimiento, resolverArrepentimiento } from "./acciones/arrepentimiento.js";

// Dos puertas de entrada, cada una con su lista de acciones a la vista:
//
//   panel   el equipo, con cuenta. El rol sale de staff/{uid} en el servidor
//           y cada acción se cruza con la tabla de permisos.js.
//   tienda  la clienta, sin cuenta: solo hacer un pedido y el botón de
//           arrepentimiento, con freno contra el abuso (limites.js).
const ACCIONES_PANEL = {
  "producto.pausar": pausarProducto,
  "producto.guardar": guardarProducto,
  "stock.ajustar": ajustarStock,
  "pedido.confirmar": confirmarPedido,
  "pedido.entregar": entregarPedido,
  "pedido.cancelar": cancelarPedido,
  "precios.recalcular": recalcularPrecios,
  "config.guardar": guardarConfig,
  "clienta.borrar": borrarClienta,
  "arrepentimiento.resolver": resolverArrepentimiento,
};

const ACCIONES_TIENDA = {
  "pedido.crear": crearPedido,
  "arrepentimiento.crear": crearArrepentimiento,
};

export const atender = async ({ accion, datos }, auth) => {
  const manejar = ACCIONES_PANEL[accion];
  if (!manejar) throw new HttpsError("not-found", "Esa acción no existe.");

  const quien = await quienPide(auth);

  if (!puede(quien.rol, accion)) {
    throw new HttpsError("permission-denied", "Tu cuenta no puede hacer esto.");
  }

  return manejar(datos, quien);
};

export const atenderTienda = async ({ accion, datos }, contexto) => {
  const manejar = ACCIONES_TIENDA[accion];
  if (!manejar) throw new HttpsError("not-found", "Esa acción no existe.");
  return manejar(datos, contexto);
};
