import { plata } from "./precios";

// Viven en compartido/ porque también las usa scripts/publicar-catalogo.mjs.
// Se reexportan para que el resto de la app las siga importando de acá.
export { NUMERO_EJEMPLO, numeroWhatsAppValido } from "../compartido/whatsapp";

// No hay límite oficial para el texto de wa.me; pasando este largo algunos
// celulares viejos lo cortan, así que se sugiere "Copiar pedido".
export const URL_LARGA = 2000;

export const DATOS_VACIOS = { nombre: "", entrega: "", direccion: "", pago: "", comentarios: "" };

export const formaDeEntrega = (id, C) => C.formas_entrega.find((f) => f.id === id);

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
export const validarDatos = (d, C) => {
  const e = {};
  if (!d.nombre.trim()) e.nombre = "Escribí tu nombre.";
  const entrega = formaDeEntrega(d.entrega, C);
  if (!entrega) e.entrega = "Elegí cómo querés recibir el pedido.";
  else if (entrega.pide_direccion && !d.direccion.trim())
    e.direccion = "Escribí la zona o la dirección para el envío.";
  if (!C.formas_pago.includes(d.pago)) e.pago = "Elegí cómo vas a pagar.";
  return e;
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
  return l.join("\n");
};

export const urlWhatsApp = (mensaje, C) =>
  `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(mensaje)}`;
