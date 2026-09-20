// Prueba el servidor de verdad: llama a la función igual que la llamaría el
// navegador, con una sesión real del emulador de Auth.
//
//   npm run emu          (en otra terminal)
//   npm run sembrar
//   npm run test:funciones

const AUTH = "http://127.0.0.1:8520/identitytoolkit.googleapis.com/v1";
const PANEL = "http://127.0.0.1:8522/demo-aurora/us-central1/panel";
const FS = "http://127.0.0.1:8519/v1/projects/demo-aurora/databases/(default)/documents";

const casos = [];
const check = (nombre, ok, detalle = "") => {
  casos.push({ ok, nombre, detalle });
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre}${ok || !detalle ? "" : `  → ${detalle}`}`);
};

const token = async (email, clave = "aurora123") => {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: clave, returnSecureToken: true }),
  });
  const datos = await res.json();
  if (!datos.idToken) throw new Error(`No se pudo entrar como ${email}: ${JSON.stringify(datos.error ?? datos)}`);
  return datos.idToken;
};

const llamar = async (accion, datos, idToken) => {
  const res = await fetch(PANEL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data: { accion, datos } }),
  });
  return res.json();
};

const leerCatalogo = async () => {
  const res = await fetch(`${FS}/publico/catalogo`, { headers: { Authorization: "Bearer owner" } });
  const datos = await res.json();
  return datos.fields.productos.arrayValue.values.map((v) => ({
    id: v.mapValue.fields.id.stringValue,
    activo: v.mapValue.fields.activo?.booleanValue ?? true,
  }));
};

const auditoria = async () => {
  const res = await fetch(`${FS}/auditoria?pageSize=100`, { headers: { Authorization: "Bearer owner" } });
  const datos = await res.json();
  return (datos.documents ?? []).map((d) => ({
    accion: d.fields.accion.stringValue,
    rol: d.fields.quien.mapValue.fields.rol.stringValue,
    detalle: d.fields.detalle.mapValue.fields,
  }));
};

const ID = "ZMA-1310-07L";

// ── Quién puede llamar ──────────────────────────────────────────────
const sinSesion = await llamar("producto.pausar", { id: ID, pausar: true }, null);
check("sin sesión no puede", sinSesion.error?.status === "UNAUTHENTICATED", JSON.stringify(sinSesion));

const tokenBaja = await token("exempleada@aurora.test");
const conBaja = await llamar("producto.pausar", { id: ID, pausar: true }, tokenBaja);
check("cuenta dada de baja no puede", conBaja.error?.status === "PERMISSION_DENIED", JSON.stringify(conBaja));

const tokenAdmin = await token("admin@aurora.test");

const inventada = await llamar("producto.inventada", {}, tokenAdmin);
check("acción que no existe se rechaza", inventada.error?.status === "NOT_FOUND", JSON.stringify(inventada));

const sinDatos = await llamar("producto.pausar", { id: ID }, tokenAdmin);
check("faltan datos: se rechaza", sinDatos.error?.status === "INVALID_ARGUMENT", JSON.stringify(sinDatos));

const inexistente = await llamar("producto.pausar", { id: "NO-EXISTE", pausar: true }, tokenAdmin);
check("producto inexistente: se rechaza", inexistente.error?.status === "NOT_FOUND", JSON.stringify(inexistente));

// ── Pausar de verdad ────────────────────────────────────────────────
const antes = await leerCatalogo();
check("antes: el producto se ve en la tienda", antes.find((p) => p.id === ID)?.activo === true);

const pausado = await llamar("producto.pausar", { id: ID, pausar: true }, tokenAdmin);
check("el admin puede pausar", pausado.result?.activo === false, JSON.stringify(pausado));

const despues = await leerCatalogo();
check("queda pausado en el catálogo", despues.find((p) => p.id === ID)?.activo === false);
check("no toca a los demás productos", despues.filter((p) => !p.activo).length === 1);

const otraVez = await llamar("producto.pausar", { id: ID, pausar: true }, tokenAdmin);
check("pausar lo ya pausado no escribe de nuevo", otraVez.result?.sinCambios === true, JSON.stringify(otraVez));

const anotado = await auditoria();
const entrada = anotado.find((a) => a.detalle?.id?.stringValue === ID);
check("quedó anotado en el historial, con quién lo hizo", entrada?.accion === "producto.pausar" && entrada?.rol === "admin", JSON.stringify(entrada));
check("el historial no se duplicó", anotado.filter((a) => a.detalle?.id?.stringValue === ID).length === 1);

// ── Reactivar ───────────────────────────────────────────────────────
const tokenProg = await token("programador@aurora.test");
const reactivado = await llamar("producto.pausar", { id: ID, pausar: false }, tokenProg);
check("el programador puede reactivar", reactivado.result?.activo === true, JSON.stringify(reactivado));
check("vuelve a verse en la tienda", (await leerCatalogo()).find((p) => p.id === ID)?.activo === true);

const fallan = casos.filter((c) => !c.ok).length;
console.log(`\n${casos.length - fallan}/${casos.length} OK`);
process.exit(fallan ? 1 : 0);
