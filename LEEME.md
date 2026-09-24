# Catálogo Aurora

Tienda web de cosmética, por mayor y por menor. La clienta arma el carrito
y hace el pedido: el servidor lo registra con un número y le da un link para
seguirlo, y después se coordina por WhatsApp. El negocio lo ve todo en el
panel: pedidos en vivo, stock, ventas, clientas, productos y precios. **No
cobra**: el envío y el pago se cierran conversando.

Hecho con **Vite + React 19 + react-router-dom**, con la misma estructura
que el proyecto del curso (C26242).

## Cómo verlo

Hace falta [Node.js](https://nodejs.org) 22 o más nuevo.

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
| `npm run test:funciones` | prueba el servidor contra los emuladores (83 casos) |
| `npm test`        | tests (Vitest): precios, carrito, pedido, servidor, búsqueda |
| `npm run publicar`| sube el catálogo a Firestore (producción o emulador)        |
| `npm run cuenta`  | alta, baja o nueva contraseña de una cuenta del panel       |
| `npm run desplegar` | sube reglas, índices y Cloud Functions a Firebase         |
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
  compartido/              lo que usan la tienda Y el servidor (se copia a functions/):
                           fórmula de precios, cuenta del carrito, datos del pedido,
                           productos y rubros, teléfonos de clientas, WhatsApp
  index.css                colores (fucsia y violeta, claro/oscuro) y estilos generales
  context/                 carrito: CartContext + CartProvider + useCart (reparte la config)
  services/productos.js    carga el catálogo (Firestore → caché → archivo)
  services/firestoreRest.js lee Firestore con fetch, sin el SDK
  services/tienda.js       hace el pedido y el arrepentimiento (función "tienda")
  services/panel.js        las acciones del panel (función "panel")
  firebase/                 app.js (mínimo) · publico/panel según quién lo use
  admin/AdminArea.jsx       el panel, que se descarga aparte
  admin/vivo.js             escuchar Firestore en vivo desde el panel
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
functions/                 el servidor (Cloud Functions): TODAS las escrituras
  index.js                 dos puertas: "panel" (con cuenta) y "tienda" (sin cuenta)
  src/router.js            la lista de acciones de cada puerta
  src/permisos.js          quién puede hacer qué
  src/acciones/            pedidos, stock, productos, precios, config, clientas…
  src/logica-pedido.js     cuentas del pedido, estados, stock y ventas (con tests)
scripts/
  armar-catalogo.mjs       datos/ + fórmula → public/data/catalogo.json
  copiar-compartido.mjs    src/compartido → functions/src/compartido
  probar-funciones.mjs     prueba el servidor de punta a punta en los emuladores
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

| Sección | Qué se hace |
|---|---|
| **Inicio** | pedidos pendientes, lo vendido en el mes, productos sin stock |
| **Pedidos** | la lista en vivo (un pedido nuevo aparece solo) por estado; en cada uno: confirmar (descuenta el stock y cuenta como venta), marcar entregado, cancelar con motivo (si estaba confirmado, el stock vuelve), escribirle por WhatsApp a la clienta |
| **Productos** | buscar, filtrar (sin stock, pausados), cargar stock en la misma fila, pausar, dar de alta y editar (nombre, código, rubro, foto, precios) |
| **Ventas** | por mes: vendido, pedidos, unidades, descuento por mayor, gráfico por día y lo más vendido |
| **Clientas** | se arma sola con cada pedido (por teléfono): compras, total, sus pedidos; «borrar sus datos» (Ley 25.326) deja los pedidos anónimos |
| **Arrepentimientos** | las solicitudes del botón de arrepentimiento, para marcar resueltas |
| **Historial** | quién hizo qué y cuándo; no se puede borrar ni modificar |
| **Configuración** | nombre, **WhatsApp**, mínimo por mayor, pedido mínimo, fecha de la lista, formas de entrega y de pago, Instagram, email y punto de retiro |
| **Precios** | solo el programador: dólar, factor de importación y márgenes, con vista previa antes de aplicar |

| Rol | Qué ve |
|---|---|
| `admin` | todo lo de arriba menos Precios, y en el historial solo lo general |
| `programador` | todo, incluidos costos, dólar y márgenes |

Si a alguien le dan de baja (`activo: false`), se le cierra la sesión en el
momento y el login le explica por qué.

#### Probarlo en tu compu (emuladores)

Hace falta **Java 21 o más nuevo** (los emuladores de Firebase lo usan; por
ejemplo Temurin, de adoptium.net). Una sola vez:

```
copy .env.example .env.local        (en Mac/Linux: cp)
cd functions && npm install && cd ..
```

Y cada vez:

```
npm run emu        # terminal 1: Firestore, Auth y Functions locales
npm run sembrar    # terminal 2: cuentas, catálogo y datos de ejemplo
npm run dev        # terminal 2: la tienda y el panel
```

`npm run sembrar` deja 5 pedidos de ejemplo (pendientes, confirmado,
entregado, cancelado), stock en dos productos, un arrepentimiento y costos
para probar Precios. Los emuladores no guardan nada al cerrarse: hay que
sembrar cada vez.

Cuentas de prueba (solo en los emuladores): `admin@aurora.test`,
`programador@aurora.test` y `exempleada@aurora.test` (dada de baja), todas
con la contraseña `aurora123`.

### En producción: la primera vez

Sin Firebase la tienda igual anda: lee `public/data/catalogo.json` y el
pedido va solo por WhatsApp. Con Firebase se suman el registro de pedidos,
el seguimiento, el stock y el panel. Los pasos, en orden:

**1. Crear el proyecto de Firebase** (console.firebase.google.com)

- Firestore Database → Crear, en `us-central1` (la región del servidor).
- Authentication → Método de acceso → **Correo electrónico/contraseña**.
- Configuración del proyecto → Tus apps → Web (`</>`): ahí están los datos
  de `VITE_FIREBASE_*`.

**2. Plan Blaze.** Las Cloud Functions lo necesitan. Es de pago por uso,
pide tarjeta, y con el volumen de una tienda así normalmente no pasa de lo
gratis. Conviene poner una alerta de presupuesto (Google Cloud → Facturación
→ Presupuestos) de, por ejemplo, USD 5.

**3. Subir reglas, índices y servidor**

```
npx firebase login
npx firebase use --add          # elegí el proyecto
npm run desplegar               # reglas + índices + Cloud Functions
```

**4. Conectar la tienda.** En Vercel → Settings → Environment Variables,
las mismas `VITE_FIREBASE_*` de `.env.example` con los valores del paso 1
(son públicas por diseño). Después, Deployments → Redeploy.

**5. Publicar el catálogo y crear las cuentas**, desde tu compu, con tus
credenciales de Google (una sola vez: `gcloud auth application-default
login`, o `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un service account;
ese archivo nunca va al repositorio):

```
npm run catalogo                               # si tenés datos/: recalcula precios
npm run publicar -- --proyecto <id> --forzar   # --forzar: el WhatsApp se carga en el panel
npm run cuenta -- --proyecto <id> --email vos@gmail.com --nombre "Alex" --rol programador
npm run cuenta -- --proyecto <id> --email mariano@gmail.com --nombre "Mariano" --rol admin
```

**6. En el panel → Configuración**: el WhatsApp real, el nombre, Instagram y
lo que haga falta. Se ve en la tienda en la próxima visita.

**7. (Opcional) Limpieza automática.** En Firestore → TTL, dos políticas:
`seguimiento` por el campo `expira` (los links vencen a los 90 días) y
`limites` por `desde`. Sin esto no pasa nada: son documentos chicos.

Sobre `npm run publicar`:

- Se niega con productos incompletos o ids repetidos, y si el WhatsApp
  (el del panel, o si no el de `src/config.js`) es el de ejemplo, salvo con
  `--forzar`.
- **Lo que se hizo en el panel manda sobre el Excel:** lo pausado sigue
  pausado, lo agotado sigue agotado, lo dado de alta en el panel no
  desaparece, lo editado en el panel no se pisa y la configuración es la
  del panel (`--config-del-codigo` vuelve a la de `src/config.js`).
- Si en tu compu está `datos/`, sube los costos y el dólar a `privado/`
  para la sección Precios, y avisa si el dólar del panel era otro.

Sobre las cuentas: la contraseña **nunca pasa por la terminal**. El script
crea la cuenta con una clave al azar e imprime un link para que la persona
elija la suya. Si vence: `--nueva-clave`. Para dar de baja: `--baja` (se
cierra la sesión en el momento; la ficha queda para el historial). Los
scripts piden tipear el id del proyecto antes de escribir en la base real
(`--si` saltea la pregunta).

Las reglas de seguridad están en `firestore.rules` y se prueban con
`npm run test:reglas`: 1182 casos que verifican, actor por actor, qué puede
leer cada uno. El navegador **nunca escribe** en Firestore: todo pasa por
las Cloud Functions, que validan, recalculan los precios y dejan el cambio
en el historial en la misma operación. `npm run test:funciones` prueba el
servidor de punta a punta (83 casos) contra los emuladores.

## Rutas

| Ruta                   | Página                               |
|------------------------|--------------------------------------|
| `/`                    | catálogo completo                    |
| `/category/:category`  | un rubro (labios, ojos, rostro…)     |
| `/product/:id`         | detalle de un producto               |
| `/cart`                | el carrito                           |
| `/checkout`            | datos de la clienta y el pedido      |
| `/pedido/:token`       | seguimiento del pedido (el link que recibe la clienta) |
| `/arrepentimiento`     | botón de arrepentimiento (Disp. 954/2025) |
| `/admin/login`         | ingreso al panel                     |
| `/admin/...`           | panel: pedidos, productos, ventas, clientas, arrepentimientos, historial, configuración, precios |

La búsqueda y el orden van en la URL (`/?q=labial&orden=precio`), así que
se pueden compartir.

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
- **`/checkout`** pide nombre, teléfono, email (opcional), retiro o envío
  (con zona si es envío), forma de pago y comentarios opcionales. Con
  servidor, **«Hacer el pedido»** lo registra: el servidor recalcula los
  precios, le pone número, vacía el carrito y le da a la clienta un link de
  seguimiento (`/pedido/...`) y un botón para avisar por WhatsApp. Sin
  servidor, abre WhatsApp con el texto escrito, como antes. Si el pedido es
  muy largo para el link, ofrece "Copiar pedido".
- Un producto con stock en 0 (lo carga el panel) se ve «Sin stock» y no se
  puede agregar; si ya estaba en un carrito, queda aparte y no se cobra.
- El carrito **se guarda en el navegador** (`localStorage`, clave
  `aurora.carrito.v1`) y sigue ahí si se cierra la página. Se guardan
  solo códigos y cantidades, **nunca precios**: si cambia el dólar, el
  carrito guardado se recalcula con los precios nuevos.
- Si una lista nueva del proveedor saca un producto, ese producto
  desaparece solo de los carritos guardados.
- Hay un tope de 9999 unidades por producto, para que un número tipeado
  de más no llegue como pedido real.

Las formas de entrega y de pago se configuran en el panel →
Configuración (los valores de arranque están en `src/config.js`).

## Cuando el proveedor manda una lista nueva

```
python extraer.py "lista-nueva.xlsx"
```

Regenera `datos/proveedor.json` (privado, con los costos) y las fotos en
`public/img/`. Después: `npm run catalogo` para recalcular los precios y
`npm run publicar` para subirlo (respeta lo que se cambió en el panel).
Necesita `pip install openpyxl Pillow`.

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
  viven en `datos/`, que no se sube ni se commitea, y (para la sección
  Precios) en `privado/` de Firestore, que las reglas solo le dejan leer al
  programador: a la página solo llegan los precios de venta ya calculados. `npm run build` corre `check:dist` y
  **falla** si algo privado se coló en lo que se publica.

## Pendientes conocidos

1. **El WhatsApp real.** El de `src/config.js` es de ejemplo. Se carga en
   el panel → Configuración (o en `src/config.js` antes de publicar). Sin
   él, los pedidos llegan igual al panel, pero la clienta no puede avisar
   por WhatsApp.
2. **Las fotos son las del proveedor**: muestran el exhibidor completo,
   con leyendas tipo "QTY: 1728pcs". Para vender por menor confunden;
   fotos propias del producto suelto es la mejora que más va a mover la
   aguja. En el panel, la foto de un producto puede ser un link https.
3. **Para consultar con un contador o abogado** antes de publicar:
   - La Res. SIC 4/2025 pide mostrar además el precio "sin impuestos
     nacionales" en ciertos casos; depende de la condición fiscal.
   - La Ley 24.240 (art. 7) pide que la oferta tenga fecha de vigencia
     precisa: la fecha de la lista se carga en el panel (Configuración), y
     al recalcular precios desde el panel queda la del día.
   - El botón de arrepentimiento (Disp. 954/2025) y el enlace a Defensa
     del Consumidor ya están en el pie; conviene que un abogado revise los
     textos.
