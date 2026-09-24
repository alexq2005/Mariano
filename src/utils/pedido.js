import { DATOS_VACIOS, formaDeEntrega, LARGOS } from "../compartido/datos-pedido";

// El número de ejemplo que viene en config.js: si sigue puesto, los
// pedidos no le llegan a nadie. El checkout avisa en vez de fallar callado.
export const NUMERO_EJEMPLO = "5491100000000";

// 54 + 9 + 10 dígitos (característica sin 0 + número sin 15).
export const numeroWhatsAppValido = (n) => /^549\d{10}$/.test(n) && n !== NUMERO_EJEMPLO;

// Qué datos se piden y cómo se validan vive en compartido/datos-pedido.js:
// el servidor va a validar con ESA misma función, y la del servidor manda.
export { DATOS_VACIOS, formaDeEntrega, LARGOS } from "../compartido/datos-pedido";
export { validarDatosPedido as validarDatos } from "../compartido/datos-pedido";

// Datos del formulario que vienen guardados (sessionStorage): solo las
// claves conocidas, solo texto, y sin opciones que ya no están en config
// (si se quitó una forma de pago, no puede seguir apareciendo elegida).
// A diferencia de sanearDatosPedido (compartido), NO recorta espacios: esto
// es el estado del formulario mientras se escribe, y recortar se comería el
// espacio entre nombre y apellido. El recorte se hace al validar y al armar
// el mensaje.
export const sanearDatos = (g, C) => {
  const d = Object.fromEntries(
    Object.keys(DATOS_VACIOS).map((k) => [k, typeof g?.[k] === "string" ? g[k].slice(0, LARGOS[k] ?? 200) : ""]),
  );
  if (!formaDeEntrega(d.entrega, C)) d.entrega = "";
  if (!C.formas_pago.includes(d.pago)) d.pago = "";
  return d;
};

// Link para abrir un chat con la tienda con un texto ya escrito.
export const urlWhatsApp = (mensaje, C) =>
  `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(mensaje)}`;
