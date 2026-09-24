// Cuentas del carrito. Los precios de venta NO se calculan acá: cada
// producto ya llega con `menor` y `mayor` hechos (ver compartido/formula.js
// y services/productos.js). Así el precio que se muestra es exactamente el
// que se guarda en el pedido, sin recalcular en cada render.
//
// La config llega siempre por parámetro y NO tiene valor por defecto: viaja
// con el catálogo (useProductos().config) y mañana va a venir de la base.
// Olvidarse de pasarla tiene que fallar fuerte, no calcular con una config
// vieja escrita en el código.

export const plata = (n) => "$" + Math.round(n).toLocaleString("es-AR");

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Las cuentas del carrito viven en compartido/lineas.js: el servidor las usa
// para recalcular el total antes de guardar el pedido, y tienen que dar
// exactamente lo mismo que vio la clienta.
export { lineaDeCarrito, resumirCarrito } from "../compartido/lineas";
