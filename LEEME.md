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
| `npm run catalogo`| recalcula los precios y genera `public/data/catalogo.json`   |
| `npm run emu`     | emuladores de Firebase en esta máquina (Firestore, Auth)    |
| `npm run sembrar` | carga datos y cuentas de prueba en los emuladores           |
| `npm run test:reglas` | prueba las reglas de seguridad (1182 casos)             |
| `npm test`        | tests (Vitest): precios, carrito, pedido, búsqueda y rutas  |
| `npm run lint`    | revisa el código con ESLint                                 |
| `npm run check:dist` | avisa si algo privado se coló en lo que se publica       |

> Ya no se abre con doble clic en `index.html`: el navegador bloquea la
> carga de módulos desde `file://`. Para compartirlo hay que publicarlo.

### Publicar

**La tienda en producción está en Vercel**, conectado al repositorio: cada
push a `main` (por ejemplo, el merge de un PR) se publica solo en
<https://mariano-theta.vercel.app>, y cada PR recibe su propio link de vista
previa. `vercel.json` hace que recargar `/cart` o `/product/...` no dé 404
(`public/_redirects` hace lo mismo en Netlify).

Sin las variables `VITE_FIREBASE_*` en Vercel (Settings → Environment
Variables), la tienda lee `public/data/catalogo.json` y el panel `/admin`
no funciona. Con ellas, lee el catálogo de Firestore.

La imagen que aparece al compartir el link por WhatsApp es `public/og.jpg`
(1200 × 630). Si cambia el nombre del negocio o la estética, hay que
reemplazarla.

#### En GitHub Pages (opcional)

El workflow `.github/workflows/pages.yml` la publica en
`https://<usuario>.github.io/<repo>/`. Corre solo a mano, para no dejar una
cruz roja en cada commit mientras Pages no esté activado.

1. **Requisito**: con el repositorio privado, Pages necesita GitHub Pro
   (gratis para estudiantes con el Student Developer Pack de GitHub
   Education). Con el repositorio público, no.
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**. Se hace una sola vez.
3. **Actions → Publicar en GitHub Pages → Run workflow**. En un par de
   minutos queda la dirección en Settings → Pages.

Sin las variables de Firebase la tienda se ve completa (lee
`public/data/catalogo.json`), pero el panel `/admin` no funciona. Para
conectarla con Firestore: **Settings → Secrets and variables → Actions →
Variables**, las mismas `VITE_FIREBASE_*` de `.env.example` con los valores
del proyecto real.

## Qué hay acá

```
index.html                 página base (Vite)
src/
  main.jsx                 arranque: router + CartProvider
  App.jsx                  rutas (con su test: cada página va dentro del layout)
  layouts/PublicLayout/    encabezado, pie y barra del carrito alrededor de cada página
  config.js                datos públicos del negocio (nombre, WhatsApp, mínimos)
  compartido/formula.js    la fórmula de precios (también la usará el servidor)
  index.css                colores (pastel claro/oscuro) y estilos generales
  context/                 carrito: CartContext + CartProvider + useCart (reparte la config)
  services/productos.js    carga el catálogo (Firestore → caché → archivo)
  services/firestoreRest.js lee Firestore con fetch, sin el SDK
  firebase/                 app.js (mínimo) · publico/panel según quién lo use
  admin/AdminArea.jsx       el panel, que se descarga aparte
  layouts/AdminLayout/      encabezado y menú del panel
  hooks/useProductos.js
  utils/                   precios, armado del pedido, búsqueda (con sus tests)
  components/<Nombre>/     un componente por carpeta, con su .jsx y su .css
public/
  data/catalogo.json       los 266 productos CON PRECIOS y sin costos (generado)
  img/                     266 fotos de producto
datos/                     ← PRIVADO, fuera del repositorio
  proveedor.json           la lista del proveedor, con el costo en dólares
  config-privada.json      ← EL ARCHIVO PARA CAMBIAR PRECIOS (dólar, márgenes)
scripts/
  armar-catalogo.mjs       datos/ + fórmula → public/data/catalogo.json
  check-dist.mjs           falla el build si algo privado llegó a dist/
extraer.py                 Excel del proveedor → datos/proveedor.json + public/img/
```

`datos/` no está en el repositorio (ver `.gitignore`). Si clonás el proyecto
en otra máquina, copiá `datos.ejemplo/config-privada.json` a `datos/`, poné
tus valores y corré `npm run catalogo`.

Ninguna pantalla importa `config.js`: la config del negocio viaja con el
catálogo (`useProductos().config`, y de ahí al contexto del carrito) y las
funciones de precios y de pedido la reciben por parámetro. Así, el día que
la config y el catálogo vengan de otro lado, no hay que tocar los
componentes: se cambia solo `services/productos.js`.

### El panel de administración

En `/admin`. Se entra con una cuenta de Firebase y el rol sale de un
documento en Firestore (`staff/{uid}`) que **solo el programador puede
escribir**: cambiarlo desde el navegador no sirve de nada, porque las reglas
del servidor rechazan lo que no corresponde.

| Rol | Qué ve |
|---|---|
| `admin` | productos, stock y (pronto) pedidos |
| `programador` | todo lo anterior más costos, dólar y márgenes |

Si a alguien le dan de baja (`activo: false`), se le cierra la sesión en el
momento y el login le explica por qué.

Para trabajar en el panel hacen falta los emuladores:

```
npm run emu        # en una terminal: Firestore y Auth locales
npm run sembrar    # una vez: cuentas de prueba y catálogo
npm run dev        # en otra terminal
```

Cuentas de prueba (solo en los emuladores): `admin@aurora.test`,
`programador@aurora.test` y `exempleada@aurora.test` (dada de baja), todas
con la contraseña `aurora123`.

### En producción: la primera vez

Las cuentas de arriba **existen solo en los emuladores**. En el sitio real
no hay ninguna, y no se pueden crear desde el navegador: las fichas
`staff/{uid}` no tienen regla de escritura para nadie, a propósito. Tampoco
existe `publico/catalogo` hasta que alguien lo publica, y sin él el panel no
puede pausar nada ("Todavía no se publicó el catálogo").

Para las dos cosas hay scripts que corren con permisos de administrador
desde la computadora del programador. Necesitan tus credenciales de Google,
una sola vez:

```
gcloud auth application-default login
```

(o `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un service account; ese
archivo nunca va al repositorio, `.gitignore` ya lo excluye). El proyecto se
pasa con `--proyecto <id>` o en `FIREBASE_PROJECT_ID`.

**1. Publicar el catálogo**

```
npm run catalogo                               # recalcula precios
npm run publicar -- --proyecto <id>
```

Se niega si el WhatsApp de `src/config.js` sigue siendo el de ejemplo, si
hay productos incompletos o ids repetidos. Al republicar **respeta lo que se
pausó desde el panel**: `catalogo.json` no sabe qué está pausado, y sin ese
cuidado todo volvería a la tienda.

**2. Dar de alta las cuentas**

```
npm run cuenta -- --proyecto <id> --email vos@gmail.com --nombre "Alex" --rol programador
npm run cuenta -- --proyecto <id> --email mariano@gmail.com --nombre "Mariano" --rol admin
```

La contraseña **nunca pasa por la terminal**: el script crea la cuenta con
una clave al azar que nadie conoce e imprime un link para que la persona
elija la suya. Mandalo por un canal privado. Si vence:

```
npm run cuenta -- --proyecto <id> --email mariano@gmail.com --nueva-clave
```

Para dar de baja (se cierra la sesión en el momento; la ficha queda para
el historial):

```
npm run cuenta -- --proyecto <id> --email ex@gmail.com --baja
```

Los dos scripts piden confirmar tipeando el id del proyecto antes de
escribir en la base real. Con `--si` se saltea la pregunta. Contra los
emuladores funcionan igual y sin preguntar.

Las reglas de seguridad están en `firestore.rules` y se prueban con
`npm run test:reglas`: 1182 casos que verifican, actor por actor, qué puede
leer cada uno. El navegador **nunca escribe** en Firestore; eso va a pasar
por Cloud Functions.

## Rutas

| Ruta                   | Página                               |
|------------------------|--------------------------------------|
| `/`                    | catálogo completo                    |
| `/category/:category`  | un rubro (labios, ojos, rostro…)     |
| `/product/:id`         | detalle de un producto               |
| `/cart`                | el carrito                           |
| `/checkout`            | datos de la clienta y envío por WhatsApp |
| `/admin/login`         | ingreso al panel                     |
| `/admin`               | panel: inicio y productos            |

La búsqueda va en la URL (`/?q=labial`), así que se puede compartir.

## De dónde salen los productos

La tienda busca el catálogo en este orden:

1. **Caché del navegador**: al volver a entrar se ve al instante lo de la
   última visita, mientras se busca lo nuevo.
2. **Firestore** (`publico/catalogo`): la fuente real. Es **un solo
   documento** con los 266 productos y la config, así cada visita cuesta
   **una lectura**. Se lee con un `fetch` a la API REST, sin el SDK: son
   26 KB menos por visita.
3. **`public/data/catalogo.json`**: red de seguridad. Si Firestore no
   responde, la tienda sigue funcionando con el archivo.

Mientras el panel no pueda editar productos, Firestore se carga con
`npm run sembrar` (emuladores) desde ese mismo archivo.

## Cambiar los precios

Los precios **no están escritos** en ningún lado. Se calculan:

```
precio = costo_USD × factor_importacion × tipo_cambio × margen
```

Para actualizar los 266 productos se abre **`datos/config-privada.json`**,
se cambia `tipo_cambio`, y se corre:

```
npm run catalogo     # recalcula los 266 precios
npm run build        # y verifica que no se publique nada privado
```

Ese archivo **no está en el repositorio**: el dólar al que comprás, el
factor de importación y tus márgenes no viajan al navegador de nadie.

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

Regenera `datos/proveedor.json` (privado, con los costos) y las fotos en
`public/img/`. Después hay que correr `npm run catalogo` para recalcular los
precios publicados. Necesita `pip install openpyxl Pillow`.

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
- **No publica el costo en dólares.** Los costos, el dólar y los márgenes
  viven en `datos/`, que no se sube ni se commitea: a la página solo llegan
  los precios de venta ya calculados. `npm run build` corre `check:dist` y
  **falla** si algo privado se coló en lo que se publica.

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
