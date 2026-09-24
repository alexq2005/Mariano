// COPIA de src/compartido/ hecha por scripts/copiar-compartido.mjs: NO editar acá.

// Los datos que deja la clienta al hacer el pedido: qué se pide, qué es
// obligatorio y cómo se limpia lo que llega.
//
// Vive en compartido/ porque valida en los dos lados: el navegador para
// avisarle a la clienta antes de enviar, y el servidor para no confiar en
// el navegador. La validación del servidor es la que manda.

export const DATOS_VACIOS = { nombre: "", telefono: "", email: "", entrega: "", direccion: "", pago: "", comentarios: "" };

export const LARGOS = { nombre: 80, telefono: 30, email: 120, direccion: 200, comentarios: 500 };

export const formaDeEntrega = (id, config) => (config.formas_entrega ?? []).find((f) => f.id === id);

// Un email "de formato razonable". No se valida más que esto a propósito:
// las reglas estrictas rechazan direcciones válidas, y el email real se
// confirma cuando llega (o no llega) el mensaje.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Teléfono argentino escrito como sea: 11 4567-8901, +54 9 11..., etc.
const TELEFONO = /^[\d\s()+-]{8,}$/;

export const validarDatosPedido = (d, config) => {
  const e = {};
  if (!d.nombre?.trim()) e.nombre = "Escribí tu nombre.";
  else if (d.nombre.trim().length > LARGOS.nombre) e.nombre = "Ese nombre es demasiado largo.";

  if (!d.telefono?.trim()) e.telefono = "Escribí un teléfono para coordinar.";
  else if (!TELEFONO.test(d.telefono.trim())) e.telefono = "Ese teléfono no parece válido.";

  if (!d.email?.trim()) e.email = "Escribí tu email para poder contactarte.";
  else if (!EMAIL.test(d.email.trim())) e.email = "Ese email no parece válido.";

  const entrega = formaDeEntrega(d.entrega, config);
  if (!entrega) e.entrega = "Elegí cómo querés recibir el pedido.";
  else if (entrega.pide_direccion && !d.direccion?.trim()) e.direccion = "Escribí la zona o la dirección para el envío.";

  if (!(config.formas_pago ?? []).includes(d.pago)) e.pago = "Elegí cómo vas a pagar.";

  if (d.comentarios && d.comentarios.length > LARGOS.comentarios) e.comentarios = "El comentario es demasiado largo.";

  return e;
};

// Deja solo las claves conocidas, como texto y recortadas. Lo que llega de
// afuera (un formulario guardado, un pedido armado a mano) no se usa crudo.
export const sanearDatosPedido = (g, config) => {
  const d = Object.fromEntries(
    Object.keys(DATOS_VACIOS).map((k) => [k, typeof g?.[k] === "string" ? g[k].trim().slice(0, LARGOS[k] ?? 200) : ""]),
  );
  if (!formaDeEntrega(d.entrega, config)) d.entrega = "";
  if (!(config.formas_pago ?? []).includes(d.pago)) d.pago = "";
  if (!formaDeEntrega(d.entrega, config)?.pide_direccion) d.direccion = "";
  return d;
};
