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

console.log("\nEntrá en http://localhost:8518/admin/login con cualquiera de esas cuentas.");
