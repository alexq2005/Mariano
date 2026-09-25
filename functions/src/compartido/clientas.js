// GENERADO desde src/compartido/clientas.js por scripts/copiar-compartido.mjs.
// No editar acá: se pisa en cada `npm run emu` y en cada despliegue.

// Teléfonos de clientas: cómo se identifican y cómo se les escribe.
//
// Vive en compartido/ porque lo usan los dos lados: el servidor, para
// saber si un pedido es de una clienta que ya compró, y el panel, para
// abrir WhatsApp con ella. No importa nada: es código portable.

// Los dígitos del número sin país, sin 0 y sin 15, para que
// "11 4567-8901", "+54 9 11 4567 8901" y "011 15 4567-8901" sean lo mismo.
const nacional = (telefono) => {
  let d = String(telefono ?? "").replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2); // código de país
  if (d.startsWith("9") && d.length > 10) d = d.slice(1); // el 9 de los celulares desde afuera
  if (d.startsWith("0")) d = d.slice(1); // 011
  // El 15 de los celulares, en la forma más común (característica de 2
  // cifras, como 11): 11 15 4567-8901 → 11 4567-8901.
  if (d.length === 12 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
  return d;
};

// La ficha de una clienta se identifica por su teléfono: es el dato que
// siempre deja (sin él no se coordina la entrega) y el que usa WhatsApp.
export const claveClienta = (telefono) => {
  const d = nacional(telefono);
  return d.length >= 6 ? `tel-${d}` : null;
};

// El número para wa.me: 549 + característica + número. Solo si tiene los
// 10 dígitos de un número argentino; si no, null (se muestra el teléfono
// tal cual y se llama a mano).
export const whatsappDeTelefono = (telefono) => {
  const d = nacional(telefono);
  return d.length === 10 ? `549${d}` : null;
};
