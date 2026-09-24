// Llena los emuladores con datos de prueba para desarrollar el panel.
//
//   npm run emu          (en otra terminal)
//   npm run sembrar
//
// Crea las cuentas del equipo con sus fichas de rol y sube el catálogo
// público. Todo queda en esta máquina: los emuladores no tocan nada real.
//
// Escribe con la API REST del emulador usando el token "owner", que saltea
// las reglas de seguridad. Es la única forma de sembrar sin Admin SDK, y
// funciona SOLO contra emuladores.

const AUTH = "http://127.0.0.1:8520/identitytoolkit.googleapis.com/v1";
const FS = "http://127.0.0.1:8519/v1/projects/demo-aurora/databases/(default)/documents";

const CUENTAS = [
  { email: "admin@aurora.test", clave: "aurora123", rol: "admin", nombre: "Ana", activo: true },
  { email: "programador@aurora.test", clave: "aurora123", rol: "programador", nombre: "Programador", activo: true },
  // Para probar que una cuenta dada de baja no entra aunque sepa la clave.
  { email: "exempleada@aurora.test", clave: "aurora123", rol: "admin", nombre: "Ex empleada", activo: false },
];

const crearUsuario = async ({ email, clave }) => {
  const res = await fetch(`${AUTH}/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: clave, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.localId) return data.localId;
  if (data.error?.message === "EMAIL_EXISTS") {
    const login = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: clave, returnSecureToken: true }),
    });
    return (await login.json()).localId;
  }
  throw new Error(`No se pudo crear ${email}: ${JSON.stringify(data.error ?? data)}`);
};

const escribir = async (ruta, campos) => {
  const res = await fetch(`${FS}/${ruta}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: campos }),
  });
  if (!res.ok) throw new Error(`No se pudo escribir ${ruta}: ${await res.text()}`);
};

const texto = (v) => ({ stringValue: v });
const bool = (v) => ({ booleanValue: v });

// Convierte cualquier valor de JavaScript al formato que pide la API REST
// de Firestore ({stringValue}, {mapValue}, {arrayValue}…).
const aValor = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return texto(v);
  if (typeof v === "boolean") return bool(v);
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aValor(x)])) } };
};

try {
  await fetch(`${AUTH}/accounts:signUp?key=demo-api-key`, { method: "OPTIONS" });
} catch {
  console.error("No hay emuladores escuchando. Levantalos en otra terminal con: npm run emu");
  process.exit(1);
}

for (const cuenta of CUENTAS) {
  const uid = await crearUsuario(cuenta);
  await escribir(`staff/${uid}`, {
    rol: texto(cuenta.rol),
    nombre: texto(cuenta.nombre),
    email: texto(cuenta.email),
    activo: bool(cuenta.activo),
  });
  console.log(`${cuenta.email} (${cuenta.clave}) → ${cuenta.rol}${cuenta.activo ? "" : " [dada de baja]"}`);
}

// El catálogo público: un solo documento, para que cada visita a la tienda
// cueste UNA lectura. Sale del mismo archivo que genera npm run catalogo.
const { readFileSync } = await import("node:fs");
const { productos } = JSON.parse(readFileSync("public/data/catalogo.json", "utf8"));
const { CONFIG } = await import("../src/config.js");

await escribir("publico/catalogo", {
  productos: aValor(productos),
  config: aValor(CONFIG),
  version: texto(new Date().toISOString()),
});
console.log(`\npublico/catalogo: ${productos.length} productos publicados en el emulador`);

// ── Datos de ejemplo para probar el panel ──────────────────────────
// Pedidos hechos como los haría una clienta (por la función "tienda", con
// los precios que calcula el servidor), algunos ya confirmados, entregados
// o cancelados; stock cargado en algunos productos; y costos para probar
// Precios. Con --sin-ejemplos (lo usa npm run test:funciones) no se crea nada.
if (!process.argv.includes("--sin-ejemplos")) {
  const FN = "http://127.0.0.1:8522/demo-aurora/us-central1";
  const llamar = async (funcion, accion, datos, idToken) => {
    const res = await fetch(`${FN}/${funcion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ data: { accion, datos } }),
    });
    const r = await res.json();
    if (r.error) throw new Error(`${accion}: ${r.error.message}`);
    return r.result;
  };
  const entrar = async (email) => {
    const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "aurora123", returnSecureToken: true }),
    });
    return (await res.json()).idToken;
  };

  try {
    const admin = await entrar("admin@aurora.test");
    const [a, b, c, d, e] = productos;
    // Stock: dos productos controlados, uno casi agotado.
    await llamar("panel", "stock.ajustar", { id: a.id, cantidad: 60 }, admin);
    await llamar("panel", "stock.ajustar", { id: b.id, cantidad: 3 }, admin);

    const clientas = [
      { nombre: "Ana Gómez", telefono: "11 4567-8901", entrega: "envio", direccion: "Caballito", pago: "Transferencia" },
      { nombre: "Lucía Pérez", telefono: "11 5555-1234", entrega: "retiro", direccion: "", pago: "Efectivo" },
      { nombre: "Sofía Díaz", telefono: "351 555-6789", entrega: "envio", direccion: "Córdoba capital", pago: "A convenir", email: "sofi@ejemplo.com" },
      { nombre: "Martina López", telefono: "11 4444-2222", entrega: "retiro", direccion: "", pago: "Transferencia", comentarios: "Paso a retirar el sábado" },
    ];
    const cliente = (x) => ({ email: "", comentarios: "", ...x });
    const hechos = [];
    hechos.push(await llamar("tienda", "pedido.crear", { carrito: [{ id: a.id, cant: 12 }, { id: c.id, cant: 2 }], cliente: cliente(clientas[0]) }));
    hechos.push(await llamar("tienda", "pedido.crear", { carrito: [{ id: d.id, cant: 24 }], cliente: cliente(clientas[1]) }));
    hechos.push(await llamar("tienda", "pedido.crear", { carrito: [{ id: e.id, cant: 1 }, { id: b.id, cant: 1 }], cliente: cliente(clientas[2]) }));
    hechos.push(await llamar("tienda", "pedido.crear", { carrito: [{ id: a.id, cant: 12 }, { id: e.id, cant: 12 }], cliente: cliente(clientas[3]) }));
    hechos.push(await llamar("tienda", "pedido.crear", { carrito: [{ id: c.id, cant: 3 }], cliente: cliente(clientas[0]) }));

    // Cobro: Mercado Pago (el simulado, en la compu) y un alias de ejemplo.
    await llamar("panel", "cobro.guardar", { alias: "aurora.ejemplo", titular: "Aurora (ejemplo)", banco: "Mercado Pago", mercadopago: true }, admin);

    await llamar("panel", "pedido.confirmar", { id: hechos[0].id, envio: 2500 }, admin);
    await llamar("panel", "pago.registrar", { id: hechos[0].id, medio: "transferencia", nota: "Comprobante 0012" }, admin);
    await llamar("panel", "pedido.entregar", { id: hechos[0].id }, admin);
    await llamar("panel", "pedido.confirmar", { id: hechos[1].id }, admin);
    await llamar("panel", "pedido.confirmar", { id: hechos[3].id }, admin);
    await llamar("panel", "pedido.cancelar", { id: hechos[3].id, motivo: "La clienta cambió de idea" }, admin);
    await llamar("tienda", "arrepentimiento.crear", { nombre: "Lucía Pérez", contacto: "11 5555-1234", numero: hechos[1].numero, motivo: "El tono no era el que esperaba" });
    console.log(`\nEjemplos: ${hechos.length} pedidos (#${hechos[0].numero} a #${hechos.at(-1).numero}), uno pagado, uno por cobrar, stock en 2 productos y un arrepentimiento.`);

    // Costos para probar Precios (solo programador): los reales si está
    // datos/ en esta máquina; si no, unos de mentira sacados del precio.
    let costos = {};
    let parametros = JSON.parse(readFileSync("datos.ejemplo/config-privada.json", "utf8"));
    try {
      costos = Object.fromEntries(JSON.parse(readFileSync("datos/proveedor.json", "utf8")).productos.map((p) => [p.id, p.costo]));
      parametros = JSON.parse(readFileSync("datos/config-privada.json", "utf8"));
    } catch {
      const divisor = parametros.tipo_cambio * parametros.factor_importacion * parametros.margen_menor;
      costos = Object.fromEntries(productos.map((p) => [p.id, Math.round((p.menor / divisor) * 100) / 100]));
    }
    await escribir("privado/costos", { costos: aValor(costos) });
    await escribir("privado/config", { parametros: aValor(parametros) });
    console.log(`Costos cargados para ${Object.keys(costos).length} productos (sección Precios).`);
  } catch (err) {
    console.warn(`\nNo se pudieron crear los ejemplos (¿están las funciones en el emulador?): ${err.message}`);
  }
}

console.log("\nEntrá en http://localhost:8518/admin/login con cualquiera de esas cuentas.");
