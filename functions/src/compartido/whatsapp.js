// GENERADO desde src/compartido/whatsapp.js por scripts/copiar-compartido.mjs.
// No editar acá: se pisa en cada `npm run emu` y en cada despliegue.

// El número al que llegan los pedidos.
//
// Vive en compartido/ porque lo revisan dos lados: el checkout, que avisa en
// vez de mandar pedidos a ningún lado, y scripts/publicar-catalogo.mjs, que
// no deja publicar la tienda con el número de ejemplo.
//
// No importa nada: es código portable, igual que el resto de compartido/.

// El número de ejemplo que viene en config.js: si sigue puesto, los
// pedidos no le llegan a nadie.
export const NUMERO_EJEMPLO = "5491100000000";

// 54 + 9 + 10 dígitos (característica sin 0 + número sin 15).
export const numeroWhatsAppValido = (n) => /^549\d{10}$/.test(n) && n !== NUMERO_EJEMPLO;
