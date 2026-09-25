import { plata } from "./precios";

// Viven en compartido/ porque también las usa scripts/publicar-catalogo.mjs.
// Se reexportan para que el resto de la app las siga importando de acá.
export { NUMERO_EJEMPLO, numeroWhatsAppValido } from "../compartido/whatsapp";

// No hay límite oficial para el texto de wa.me; pasando este largo algunos
// celulares viejos lo cortan, así que se sugiere "Copiar pedido".
export const URL_LARGA = 2000;

// Qué datos se piden y cómo se validan: lo mismo que revisa el servidor
// antes de guardar el pedido (compartido/datos-pedido.js).
export { DATOS_VACIOS, formaDeEntrega, LARGOS } from "../compartido/datos-pedido";
import { DATOS_VACIOS, formaDeEntrega, validarDatosPedido } from "../compartido/datos-pedido";

// Datos del formulario que vienen guardados (sessionStorage): solo las
// claves conocidas, solo texto, y sin opciones que ya no están en config
// (si se quitó una forma de pago, no puede seguir apareciendo elegida).
export const sanearDatos = (g, C) => {
  const d = Object.fromEntries(
    Object.keys(DATOS_VACIOS).map((k) => [k, typeof g?.[k] === "string" ? g[k] : ""]),
  );
  if (!formaDeEntrega(d.entrega, C)) d.entrega = "";
  if (!C.formas_pago.includes(d.pago)) d.pago = "";
  return d;
};

// Devuelve {campo: mensaje} con los errores; vacío si está todo bien.
export const validarDatos = (d, C) => validarDatosPedido(d, C);

// Mensaje que le llega al comercio. Separadores ASCII a propósito: "•" o
// "—" ocupan 9 caracteres cada uno dentro de la URL y la alargan de más.
// *texto* es negrita en WhatsApp.
// `registro` es lo que devuelve el servidor al guardar el pedido: su número
// y el link de seguimiento. Sin servidor (o si falló), el mensaje sale igual.
export const armarMensaje = (resumen, d, C, registro = null) => {
  const l = [
    registro
      ? `Hola ${C.nombre_negocio}! Te mando mi pedido *#${registro.numero}*:`
      : `Hola ${C.nombre_negocio}! Te hago este pedido:`,
    "",
  ];

  resumen.items.forEach((i, n) => {
    l.push(`${n + 1}) ${i.cant} u. x ${i.p.nom} (${i.p.cod})`);
    l.push(`   ${plata(i.unit)} c/u${i.esMayor ? " (por mayor)" : ""} = ${plata(i.sub)}`);
  });

  l.push("", `*Total: ${plata(resumen.total)}* (sin envío)`);
  if (resumen.ahorro > 0) l.push(`Ahorro por mayor: ${plata(resumen.ahorro)}`);

  const entrega = formaDeEntrega(d.entrega, C);
  l.push("", `*Nombre:* ${d.nombre.trim()}`);
  if (d.telefono?.trim()) l.push(`*Teléfono:* ${d.telefono.trim()}`);
  if (entrega) {
    const donde = entrega.pide_direccion && d.direccion.trim() ? ` - ${d.direccion.trim()}` : "";
    l.push(`*Entrega:* ${entrega.nombre}${donde}`);
  }
  if (C.formas_pago.includes(d.pago)) l.push(`*Pago:* ${d.pago}`);
  if (d.comentarios.trim()) l.push(`*Comentarios:* ${d.comentarios.trim()}`);

  l.push("", `Precios de la lista de ${C.actualizado}.`);
  // Sin esto, un pedido armado con precios provisorios se lee como un
  // presupuesto cerrado, y la diferencia se discute después.
  if (!C.precios_confirmados) l.push("Precios orientativos, a confirmar.");
  if (registro?.seguimiento) l.push("", `Seguimiento del pedido: ${registro.seguimiento}`);
  return l.join("\n");
};

export const urlWhatsApp = (mensaje, C) =>
  `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(mensaje)}`;
