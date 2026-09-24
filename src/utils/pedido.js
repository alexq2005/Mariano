import { DATOS_VACIOS, formaDeEntrega, LARGOS } from "../compartido/datos-pedido";
import { plata } from "./precios";

// El número de ejemplo que viene en config.js: si sigue puesto, los
// pedidos no le llegan a nadie. El checkout avisa en vez de fallar callado.
export const NUMERO_EJEMPLO = "5491100000000";

// 54 + 9 + 10 dígitos (característica sin 0 + número sin 15).
export const numeroWhatsAppValido = (n) => /^549\d{10}$/.test(n) && n !== NUMERO_EJEMPLO;

// No hay límite oficial para el texto de wa.me; pasando este largo algunos
// celulares viejos lo cortan, así que se sugiere "Copiar pedido".
export const URL_LARGA = 2000;

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

// Mensaje que le llega al comercio. Separadores ASCII a propósito: "•" o
// "—" ocupan 9 caracteres cada uno dentro de la URL y la alargan de más.
// *texto* es negrita en WhatsApp.
export const armarMensaje = (resumen, d, C) => {
  const l = [`Hola ${C.nombre_negocio}! Te hago este pedido:`, ""];

  resumen.items.forEach((i, n) => {
    l.push(`${n + 1}) ${i.cant} u. x ${i.p.nom} (${i.p.cod})`);
    l.push(`   ${plata(i.unit)} c/u${i.esMayor ? " (por mayor)" : ""} = ${plata(i.sub)}`);
  });

  l.push("", `*Total: ${plata(resumen.total)}* (sin envío)`);
  if (resumen.ahorro > 0) l.push(`Ahorro por mayor: ${plata(resumen.ahorro)}`);

  const entrega = formaDeEntrega(d.entrega, C);
  l.push("", `*Nombre:* ${d.nombre.trim()}`);
  if (d.telefono.trim()) l.push(`*Teléfono:* ${d.telefono.trim()}`);
  if (d.email.trim()) l.push(`*Email:* ${d.email.trim()}`);
  if (entrega) {
    const donde = entrega.pide_direccion && d.direccion.trim() ? ` - ${d.direccion.trim()}` : "";
    l.push(`*Entrega:* ${entrega.nombre}${donde}`);
  }
  if (C.formas_pago.includes(d.pago)) l.push(`*Pago:* ${d.pago}`);
  if (d.comentarios.trim()) l.push(`*Comentarios:* ${d.comentarios.trim()}`);

  l.push("", `Precios de la lista de ${C.actualizado}.`);
  return l.join("\n");
};

export const urlWhatsApp = (mensaje, C) =>
  `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(mensaje)}`;
