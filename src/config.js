/* ─────────────────────────────────────────────────────────────────────
   CONFIG PÚBLICA — lo que la tienda muestra y cualquiera puede leer.

   Acá NO van el costo de los productos, el dólar al que se compró, el
   factor de importación ni los márgenes: eso vive en
   datos/config-privada.json, que queda fuera del repositorio y NUNCA
   llega al navegador. Con esos números, cualquiera que mire el código de
   la página publicada calcula exactamente cuánto gana el negocio.

   Para cambiar precios se edita datos/config-privada.json y se corre:

       npm run catalogo

   que vuelve a generar public/data/catalogo.json con los precios ya
   calculados. El build después verifica (npm run check:dist) que nada
   privado se haya colado en lo que se publica.
   ───────────────────────────────────────────────────────────────────── */

export const CONFIG = {

  nombre_negocio: "Aurora",

  // Número al que llegan los pedidos. Formato internacional, sin + ni
  // espacios ni guiones: 54 + 9 + característica sin 0 + número sin 15.
  // Ej.: 11 4567-8901 en CABA  ->  "5491145678901"
  // Mientras quede el de ejemplo, el checkout muestra un aviso.
  whatsapp: "5491100000000",

  // A partir de cuántas unidades del MISMO producto entra el precio por
  // mayor. La página lo aplica sola y le muestra a la clienta cuánto
  // ahorra. Ojo: esto NO es el bulto del proveedor (que puede ser de
  // 768 o 2880 unidades), es tu corte de venta.
  minimo_mayor: 12,

  // Monto mínimo para poder cerrar un pedido. 0 = sin mínimo.
  pedido_minimo: 0,

  // ── Pedido por WhatsApp ────────────────────────────────────────────
  // Opciones que ve la clienta en el formulario antes de mandar el
  // pedido. `pide_direccion` hace aparecer el campo de zona/dirección.

  formas_entrega: [
    { id: "retiro", nombre: "Retiro en persona", pide_direccion: false },
    { id: "envio", nombre: "Envío a domicilio", pide_direccion: true },
  ],

  formas_pago: ["Transferencia", "Efectivo", "A convenir"],

  // Se muestra al pie y va en el mensaje. Actualizar cuando se cambian
  // precios: es lo que le dice a la clienta que la lista está vigente.
  actualizado: "septiembre 2026",
};
