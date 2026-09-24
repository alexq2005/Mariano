import { db } from "./firebase.js";

// Dónde vive cada cosa en Firestore (ver el mapa en firestore.rules).
export const refs = {
  catalogo: () => db.collection("publico").doc("catalogo"),
  stock: () => db.collection("interno").doc("stock"),
  tablero: () => db.collection("interno").doc("tablero"),
  config: () => db.collection("interno").doc("config"),
  contador: () => db.collection("contadores").doc("pedidos"),
  pedido: (id) => db.collection("pedidos").doc(id),
  seguimiento: (token) => db.collection("seguimiento").doc(token),
  comprobante: (token) => db.collection("comprobantes").doc(token),
  clienta: (id) => db.collection("clientas").doc(id),
  stats: (mes) => db.collection("stats").doc(mes),
  limite: (clave) => db.collection("limites").doc(clave),
  costos: () => db.collection("privado").doc("costos"),
  precios: () => db.collection("privado").doc("config"),
  respaldo: () => db.collection("privado").doc("respaldo"),
};
