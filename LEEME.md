# Catálogo Aurora

Catálogo web de cosmética, por mayor y por menor, con carrito. La clienta
arma el pedido y lo manda por WhatsApp con el detalle ya escrito. **No
cobra**: el precio final, el envío y el pago se cierran conversando.

Hecho con **Vite + React 19 + react-router-dom**, con la misma estructura
que el proyecto del curso (C26242).

## Cómo verlo

Hace falta [Node.js](https://nodejs.org) 20 o más nuevo.

```
npm install        # solo la primera vez
npm run dev        # abre en http://localhost:8518
```

| Comando           | Qué hace                                                    |
|-------------------|-------------------------------------------------------------|
| `npm run dev`     | servidor de desarrollo, se recarga solo al guardar          |
| `npm run build`   | arma la versión para publicar en `dist/`                    |
| `npm run preview` | sirve `dist/` para probar la versión final antes de subirla |
| `npm test`        | tests (Vitest): precios, carrito, pedido, búsqueda y rutas  |
| `npm run lint`    | revisa el código con ESLint                                 |

> Ya no se abre con doble clic en `index.html`: el navegador bloquea la
> carga de módulos desde `file://`. Para compartirlo hay que publicarlo.

### Publicar

`npm run build` y subir la carpeta `dist/` a Vercel o Netlify (o conectar
el repositorio y que lo hagan solos). `vercel.json` y `public/_redirects`
ya están configurados para que recargar `/cart` o `/product/...` no dé 404.

## Qué hay acá

```
index.html                 página base (Vite)
src/
  main.jsx                 arranque: router + CartProvider
  App.jsx                  rutas (con su test: cada página va dentro del layout)
  layouts/PublicLayout/    encabezado, pie y barra del carrito alrededor de cada página
  config.js                ← EL ARCHIVO PARA CAMBIAR PRECIOS Y DATOS DEL NEGOCIO
  index.css                colores (pastel claro/oscuro) y estilos generales
  context/                 carrito: CartContext + CartProvider + useCart (reparte la config)
  services/productos.js    carga public/data/productos.json y publica la config (una sola vez)
  hooks/useProductos.js
  utils/                   precios, armado del pedido, búsqueda (con sus tests)
  components/<Nombre>/     un componente por carpeta, con su .jsx y su .css
public/
  data/productos.json      los 266 productos (generado, no editar a mano)
  img/                     266 fotos de producto
extraer.py                 regenera public/data/productos.json y public/img/
```

Ninguna pantalla importa `config.js`: la config del negocio viaja con el
catálogo (`useProductos().config`, y de ahí al contexto del carrito) y las
funciones de precios y de pedido la reciben por parámetro. Así, el día que
la config y el catálogo vengan de otro lado, no hay que tocar los
componentes: se cambia solo `services/productos.js`.

### Rutas

| Ruta                   | Página                               |
|------------------------|--------------------------------------|
| `/`                    | catálogo completo                    |
| `/category/:category`  | un rubro (labios, ojos, rostro…)     |
| `/product/:id`         | detalle de un producto               |
| `/cart`                | el carrito                           |
| `/checkout`            | datos de la clienta y envío por WhatsApp |

La búsqueda va en la URL (`/?q=labial`), así que se puede compartir.

## Cambiar los precios

Los precios **no están escritos** en ningún lado. Se calculan:

```
precio = costo_USD × factor_importacion × tipo_cambio × margen
```

Para actualizar los 266 productos se abre `src/config.js`, se cambia
`tipo_cambio`, se guarda y se vuelve a publicar.

Hay dos márgenes: `margen_menor` y `margen_mayor`. La clienta que lleva
`minimo_mayor` unidades o más **del mismo producto** paga el precio por
mayor automáticamente, y la página le muestra cuánto ahorra. No se suman
productos distintos.

## ⚠️ Antes de publicar precios

El precio del Excel es de **fábrica (FOB)**. No incluye flete, aduana,
impuestos ni costos locales. Vender con margen sobre ese número es vender
a pérdida.

`factor_importacion` lo convierte en el costo real puesto en el depósito.
El valor que viene (2.6) es una **suposición**. Después de la primera
importación real hay que reemplazarlo por:

```
factor_importacion = (mercadería + flete + aduana + impuestos + despachante) / mercadería
```

## El carrito

- Se agrega desde la tarjeta o el detalle. Desde ahí mismo se cambia la
  cantidad con − / + o escribiendo el número.
- **`/cart`** muestra cada producto con foto, precio c/u, subtotal y
  cuánto falta para el precio por mayor (o cuánto ahorra). "Quitar" y
  "Vaciar" se pueden deshacer, y "Vaciar" pide confirmación.
- **`/checkout`** pide nombre, retiro o envío (con zona si es envío),
  forma de pago y comentarios opcionales. Muestra el mensaje tal cual va a
  llegar y abre WhatsApp con el texto escrito. Si el pedido es muy largo
  para el link, ofrece "Copiar pedido".
- El carrito **se guarda en el navegador** (`localStorage`, clave
  `aurora.carrito.v1`) y sigue ahí si se cierra la página. Se guardan
  solo códigos y cantidades, **nunca precios**: si cambia el dólar, el
  carrito guardado se recalcula con los precios nuevos.
- Si una lista nueva del proveedor saca un producto, ese producto
  desaparece solo de los carritos guardados.
- Hay un tope de 9999 unidades por producto, para que un número tipeado
  de más no llegue como pedido real.

Las formas de entrega y de pago se configuran en `src/config.js`
(`formas_entrega`, `formas_pago`).

## Cuando el proveedor manda una lista nueva

```
python extraer.py "lista-nueva.xlsx"
```

Regenera `public/data/productos.json` y las fotos en `public/img/`.
`src/config.js` no se toca. Necesita `pip install openpyxl Pillow`.

- Cada producto recibe un `id` único aunque el proveedor repita el código
  (pasa con `ZMA-CQK-5002` y `ZMA-RS-8003`). El `id` es la clave del
  carrito y de la URL, y el código original se sigue mostrando.
- Los códigos de barra que Excel convierte a `7E+12` se descartan como
  descripción.
- Las fotos de productos que ya no están quedan en `public/img/`. Si
  molestan, se borra la carpeta antes de correr el script.

## Lo que NO hace, a propósito

- **No cobra.** Los pedidos llegan por WhatsApp y el pago se arregla
  hablando. Así queda fuera la única parte con plata real circulando.
- **No muestra el costo en dólares.** Está en `productos.json` porque
  hace falta para la cuenta, pero no aparece en pantalla, ni en el
  carrito guardado, ni en el mensaje. Ojo: quien sepa mirar el código
  fuente de la página publicada **sí puede verlo**. Si eso importa, la
  solución es que `extraer.py` escriba los precios ya calculados en vez
  del costo.

## Pendientes conocidos

1. **`whatsapp` en `src/config.js` es un número de ejemplo.** Mientras no
   se cambie, el checkout muestra un aviso y los pedidos no llegan.
2. **Las fotos son las del proveedor**: muestran el exhibidor completo,
   con leyendas tipo "QTY: 1728pcs". Para vender por menor confunden;
   fotos propias del producto suelto es la mejora que más va a mover la
   aguja.
3. **Los rubros se adivinaron del nombre.** Hay 14 productos en "Otros"
   que conviene reclasificar (en `RUBROS` de `extraer.py`).
4. **Para consultar con un contador o abogado** antes de publicar:
   - La Res. SIC 4/2025 pide mostrar además el precio "sin impuestos
     nacionales" en ciertos casos; depende de la condición fiscal.
   - La Ley 24.240 (art. 7) pide que la oferta tenga fecha de vigencia
     precisa: conviene que `actualizado` diga una fecha ("19/09/2026") y
     no solo el mes.
   - La Disp. 954/2025 exige un "botón de arrepentimiento" en ventas a
     distancia por web a consumidores finales (las compras para reventa
     están exceptuadas).
