// La ficha de una clienta se identifica por su teléfono: es el dato que
// siempre deja (sin él no se puede coordinar la entrega) y el que usa
// WhatsApp. Se normaliza para que "11 4567-8901", "+54 9 11 4567 8901" y
// "011 15 4567-8901" sean la misma persona.
export const claveClienta = (telefono) => {
  let d = String(telefono ?? "").replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2); // código de país
  if (d.startsWith("9") && d.length > 10) d = d.slice(1); // el 9 de los celulares desde afuera
  if (d.startsWith("0")) d = d.slice(1); // 011
  // El 15 de los celulares, en la forma más común (característica de 2
  // cifras, como 11): 11 15 4567-8901 → 11 4567-8901.
  if (d.length === 12 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
  return d.length >= 6 ? `tel-${d}` : null;
};
