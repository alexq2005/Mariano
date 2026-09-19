/* ─────────────────────────────────────────────────────────────────────
   CONFIG — el único archivo que se toca para cambiar precios.

   Los precios NO están escritos en ningún lado: se calculan a partir del
   costo en dólares que vino en el Excel del proveedor. La cuenta es:

       precio = costo_USD × factor_importacion × tipo_cambio × margen

   Eso significa que cuando se mueve el dólar, se cambia UN número acá
   y los 266 productos quedan actualizados. No hay que tocar la página.

   ⚠️  LO MÁS IMPORTANTE, LEER ANTES DE PUBLICAR PRECIOS  ⚠️

   El precio del Excel es el de FÁBRICA (FOB). NO incluye flete, aduana,
   impuestos, ni ningún costo local. Poner precio de venta sobre ese
   número es vender a pérdida.

   `factor_importacion` es lo que convierte el precio de fábrica en tu
   costo real puesto en el depósito. El 2.6 de abajo es una SUPOSICIÓN
   para que el catálogo arranque: hay que reemplazarlo por el número que
   salga de la primera importación real, dividiendo lo que pagaste en
   total (mercadería + flete + aduana + impuestos + despachante) por lo
   que suma la mercadería sola.
   ───────────────────────────────────────────────────────────────────── */

export const CONFIG = {

  nombre_negocio: "Aurora",

  // Número al que llegan los pedidos. Formato internacional, sin + ni
  // espacios ni guiones: 54 + 9 + característica sin 0 + número sin 15.
  // Ej.: 11 4567-8901 en CABA  ->  "5491145678901"
  // Mientras quede el de ejemplo, el checkout muestra un aviso.
  whatsapp: "5491100000000",

  // ── Costos ─────────────────────────────────────────────────────────

  // Cuántos pesos vale un dólar PARA VOS: el que efectivamente pagaste
  // al importar, no el que sale en el diario. Es el número que más se
  // desactualiza, y por eso el mantenimiento de esto es mensual.
  tipo_cambio: 1000,

  // Cuánto multiplica el precio de fábrica hasta tenerlo en tu depósito.
  // 2.6 significa "me sale 2,6 veces lo que dice el Excel". SUPOSICIÓN:
  // cambiar por el número real de la primera importación.
  factor_importacion: 2.5,

  // ── Márgenes ───────────────────────────────────────────────────────
  // Se aplican sobre el costo real (ya con factor_importacion adentro).

  margen_menor: 2.5,   // venta de a poco: 2.0 = el doble del costo
  margen_mayor: 1.8,  // venta por cantidad: menos margen, más volumen

  // A partir de cuántas unidades del MISMO producto entra el precio por
  // mayor. La página lo aplica sola y le muestra a la clienta cuánto
  // ahorra. Ojo: esto NO es el bulto del proveedor (que puede ser de
  // 768 o 2880 unidades), es tu corte de venta.
  minimo_mayor: 12,

  // Monto mínimo para poder cerrar un pedido. 0 = sin mínimo.
  pedido_minimo: 0,

  // Redondeo del precio final, para que no queden números raros.
  // 100 = termina en $00. Poner 1 para no redondear.
  redondeo: 100,

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
