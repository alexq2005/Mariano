# Catálogo Aurora

Tienda web de cosmética, por mayor y por menor. La clienta arma el carrito
y hace el pedido: el servidor lo registra con un número y le da un link para
seguirlo. Cuando el negocio lo confirma (con el envío), la clienta lo paga
desde ese link: con **Mercado Pago** (tarjetas, dinero en cuenta, efectivo)
o por **transferencia** al alias. Cada cobro sale con su **factura
electrónica de ARCA** (y cada devolución con su nota de crédito). El negocio
lo ve todo en el panel: pedidos, cobros y facturas en vivo, stock, ventas,
clientas, productos y precios.

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
| **Inicio** | pedidos pendientes, lo vendido en el mes, cuánto falta cobrar, productos sin stock |
| **Pedidos** | la lista en vivo (un pedido nuevo aparece solo) por estado y con su cobro; en cada uno: confirmar sumando el envío (descuenta el stock, cuenta como venta y la clienta ya puede pagar), marcar entregado, cancelar con motivo (si estaba confirmado, el stock vuelve), escribirle por WhatsApp a la clienta. **Cobro**: ver si pagó y cómo, marcar pagado (transferencia, efectivo), devolver un pago de Mercado Pago, corregir el envío |
| **Productos** | buscar, filtrar (sin stock, pausados), cargar stock en la misma fila, pausar, dar de alta y editar (nombre, código, rubro, foto, precios) |
| **Ventas** | por mes: vendido, pedidos, unidades, descuento por mayor, gráfico por día y lo más vendido |
| **Facturas** | las facturas y notas de crédito del mes, con neto, IVA y total, y la descarga en CSV para el contador |
| **Clientas** | se arma sola con cada pedido (por teléfono): compras, total, sus pedidos; «borrar sus datos» (Ley 25.326) deja los pedidos anónimos |
| **Arrepentimientos** | las solicitudes del botón de arrepentimiento, para marcar resueltas |
| **Historial** | quién hizo qué y cuándo; no se puede borrar ni modificar |
| **Configuración** | nombre, **WhatsApp**, mínimo por mayor, pedido mínimo, fecha de la lista, formas de entrega y de pago, Instagram, email y punto de retiro; **cómo cobrar** (Mercado Pago, alias, CBU/CVU); y la **facturación** (condición, CUIT, punto de venta, ambiente, «Probar conexión con ARCA») |
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

`npm run sembrar` deja 5 pedidos de ejemplo (pendientes, uno con CUIT,
confirmado sin pagar, entregado y pagado por transferencia con su factura C,
cancelado), stock en dos productos, un arrepentimiento y costos para probar
Precios. Los emuladores no guardan nada al cerrarse: hay que
sembrar cada vez.

`npm run emu` también levanta un **Mercado Pago simulado** (puerto 8531):
«Pagar con Mercado Pago» abre una pantalla de pago de mentira con botones
para aprobar, dejar pendiente (efectivo) o rechazar, y vuelve a la tienda
igual que el real, con aviso firmado incluido. Y un **ARCA simulado**
(puerto 8532), con un certificado de prueba que se genera solo: autoriza las
facturas con las mismas validaciones que ARCA (número correlativo, condición
IVA del receptor, IVA, tope de consumidor final). Nada sale de tu compu.
Cada simulado tiene una página para probar a mano: http://127.0.0.1:8531/__simular
(los pagos, con «Acreditar» para el efectivo) y http://127.0.0.1:8532/__simular
(lo emitido, y botones para que ARCA rechace, corte la respuesta o se caiga).

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

La primera vez pide cuatro secretos: `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`
(Mercado Pago, ver «Cobrar los pedidos») y `ARCA_CERT` y `ARCA_KEY` (ARCA,
ver «Facturar con ARCA»). Lo que todavía no tengas, cargalo como
`SIN-CONFIGURAR`: el resto anda igual y se conecta después.

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
servidor de punta a punta (192 casos, con cobros y facturas contra los
simulados de Mercado Pago y ARCA) contra los emuladores.

### Cobrar los pedidos

La clienta paga **después** de que confirmás el pedido: el stock ya está
separado y el envío, sumado. En su link de seguimiento ve «Pagá tu pedido»
con el total y:

- **Mercado Pago**: tarjeta de crédito (en cuotas) o de débito, dinero en
  cuenta o efectivo en Rapipago / Pago Fácil. Se marca pagado solo: lo
  avisa Mercado Pago y además se revisa cuando la clienta vuelve a la
  tienda. Un pago en efectivo queda «en proceso» hasta que se acredita.
- **Transferencia** al alias o CBU/CVU, desde cualquier banco o billetera
  (Mercado Pago, Ualá, Naranja X, Brubank, Cuenta DNI…), con botones para
  copiar alias, CBU y monto. Te manda el comprobante por WhatsApp y vos lo
  marcás en el pedido → «Marcar pagado».

En el panel, cada pedido muestra el cobro en vivo (sin pagar, en proceso,
pagado, rechazado, devuelto). Se puede **devolver** un pago de Mercado Pago
(la plata vuelve al mismo medio), anular un pago marcado por error y
corregir el envío mientras no haya un pago en curso. Si la clienta paga dos
veces, el segundo queda como «pago de más», con su botón para devolverlo.

Cómo está cuidado:

- El monto lo pone el servidor (productos + envío). El navegador no lo
  puede cambiar.
- Un pago se da por bueno solo leyéndolo de Mercado Pago con el token del
  negocio, y tiene que ser de ese pedido. Los avisos se verifican con la
  firma secreta; uno falso se rechaza.
- El token vive en Secret Manager de Google: nunca en el código, el
  repositorio ni la base.
- Cambiar el alias o el CBU queda en el historial con el antes y el
  después, a la vista de las dos cuentas.

#### Conectar Mercado Pago (una vez)

1. Con la cuenta de Mercado Pago del negocio, en
   mercadopago.com.ar/developers → **Tus integraciones** → Crear
   aplicación (pagos online, **Checkout Pro**).
2. En la aplicación → **Credenciales de producción** → el **Access Token**
   (empieza con `APP_USR-`). Es la llave de la cuenta: no lo pegues en
   ningún chat, mail ni archivo.
3. En la aplicación → **Webhooks** → modo productivo: URL
   `https://us-central1-<id-del-proyecto>.cloudfunctions.net/mercadopago`,
   evento **Pagos**. Guardá y copiá la **clave secreta** que muestra.
4. En tu compu (cada comando te pide el valor; pegalo ahí):

   ```
   npx firebase functions:secrets:set MP_ACCESS_TOKEN
   npx firebase functions:secrets:set MP_WEBHOOK_SECRET
   npm run desplegar
   ```

5. Panel → Configuración → tildá **Cobrar con Mercado Pago** y guardá: el
   servidor prueba el token y te avisa si no anda.

Para probar con Mercado Pago de verdad sin plata real: en Tus integraciones
→ **Cuentas de prueba**, creá un vendedor y un comprador; cargá el Access
Token del vendedor de prueba como `MP_ACCESS_TOKEN`, pagá con el comprador
de prueba y las tarjetas de prueba de su documentación, y al terminar volvé
a cargar el token real (paso 4).

### Facturar con ARCA

Con la facturación prendida, **la factura sale sola en el momento en que se
cobra** (el aviso de Mercado Pago o «Marcar pagado»), y si después se
devuelve el pago (o se anula uno marcado por error), sale sola la **nota de
crédito**. La clienta ve e imprime su factura (con el QR de ARCA) desde el
link del pedido; en el panel está en el pedido y en **Facturas** (el mes
entero, con el CSV para el contador).

Qué comprobante sale:

| El negocio es | Le vende a | Sale |
|---|---|---|
| Monotributo | cualquiera | Factura C |
| Responsable inscripto | inscripto o monotributista, con CUIT | Factura A (con el IVA discriminado) |
| Responsable inscripto | consumidor final o exento | Factura B (con el «IVA contenido», Ley 27.743) |

En el checkout, quien quiere la factura a su nombre elige «Con CUIT» y deja
el CUIT, la condición ante el IVA y la razón social. Si no, va a
«Consumidor final». Desde $10.000.000 a consumidor final ARCA pide
identificarlo (RG 5866/2026): esa factura queda con el aviso y se carga el
DNI en el pedido → «Datos para la factura» → Reintentar.

Si ARCA no la autoriza, el cobro queda guardado igual y el pedido muestra el
motivo con «Reintentar». Si fue algo pasajero (ARCA caído), se reintenta
solo cada 30 minutos. Si se corta la conexión justo cuando ARCA la autoriza,
el reintento la recupera: no se duplican números.

#### Conectar ARCA (una vez)

Lo hace quien tiene la clave fiscal del CUIT (o el contador). Conviene
probar primero en **homologación** (pruebas, sin validez fiscal) y después
repetir los pasos 2 a 5 en producción.

1. **Clave y pedido de certificado**, en tu compu (sin openssl, anda en
   Windows):

   ```
   npm run arca:certificado -- --cuit 20123456786 --nombre "Nombre o razón social"
   ```

   Deja `datos/arca/clave-privada.key` (no se comparte con nadie, ni con
   ARCA) y `datos/arca/pedido.csr`.
2. **El certificado**: en ARCA con clave fiscal → «Administración de
   Certificados Digitales» → agregar el alias `aurora` → subir `pedido.csr` →
   descargar el `.crt`. (Para homologación: «WSASS - Autogestión
   Certificados Homologación».)
3. **Autorizarlo a facturar**: «Administrador de Relaciones de Clave
   Fiscal» → Nueva relación → servicio **Facturación electrónica** (wsfe) →
   representante: el certificado `aurora`.
4. **Punto de venta**: «Administración de puntos de venta y domicilios» →
   uno nuevo del tipo **Factura electrónica – Web Services** (en monotributo:
   «Factura Electrónica - Monotributo - Web Services»). Anotá el número.
5. **Cargar el certificado en el servidor**:

   ```
   npx firebase functions:secrets:set ARCA_CERT --data-file certificado.crt
   npx firebase functions:secrets:set ARCA_KEY --data-file datos/arca/clave-privada.key
   npm run desplegar
   ```

6. **Panel → Configuración → Facturación electrónica**: condición,
   CUIT, razón social, domicilio comercial, Ingresos Brutos, inicio de
   actividades, punto de venta y ambiente. «Probar conexión con ARCA» y, si
   dice «Conectado», tildá «Facturar los cobros» y guardá.

Al pasar de homologación a producción: certificado de producción (pasos 2 y
3 en ARCA, con otro alias si querés), punto de venta real, los dos secretos
de nuevo y en el panel ambiente «Producción». El certificado vence: ARCA
avisa y se renueva con el mismo `pedido.csr` o uno nuevo.

**Lo que cuesta.** La transferencia no tiene comisión. Mercado Pago cobra un
porcentaje por venta que depende de cuándo querés la plata disponible (al
instante, a 14 o a 30 días: cuanto más esperás, menos cobra), y se elige en
tu cuenta de Mercado Pago. Como referencia, ronda el 6,4 % al instante, el
3,4 % a 14 días y el 1,8 % a 30 días, más IVA; los valores vigentes están
en mercadopago.com.ar/costs-section. Las cuotas sin interés, si las
ofrecés, las pagás vos. Mercado Pago además puede retener impuestos (IIBB,
IVA, Ganancias) según tu inscripción: consultalo con el contador.

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

- **No guarda datos de tarjetas.** La clienta los carga en Mercado Pago;
  la tienda solo recibe «pagado con tarjeta de crédito visa, 3 cuotas».
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
3. **Facturación: revisar con el contador** el tipo de punto de venta, la
   alícuota (todo al 21 %: si algún producto va con otra, hay que
   separarlo), y si el envío se factura junto con los productos (hoy va en
   la misma factura).
4. **Para consultar con un contador o abogado** antes de publicar:
   - La Res. SIC 4/2025 pide mostrar además el precio "sin impuestos
     nacionales" en ciertos casos; depende de la condición fiscal.
   - La Ley 24.240 (art. 7) pide que la oferta tenga fecha de vigencia
     precisa: la fecha de la lista se carga en el panel (Configuración), y
     al recalcular precios desde el panel queda la del día.
   - El botón de arrepentimiento (Disp. 954/2025) y el enlace a Defensa
     del Consumidor ya están en el pie; conviene que un abogado revise los
     textos.
