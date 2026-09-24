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

// ── Pedido de la clienta (sin cuenta) ─────────────────────────────
// El límite por hora vive en limites/: se limpia para que la prueba se
// pueda correr varias veces seguidas.
const borrarColeccion = async (col) => {
  const res = await fetch(`${FS}/${col}?pageSize=300`, { headers: { Authorization: "Bearer owner" } });
  for (const d of (await res.json()).documents ?? []) {
    await fetch(`http://127.0.0.1:8519/v1/${d.name}`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
  }
};
await borrarColeccion("limites");

const leerDoc = async (ruta, auth = "Bearer owner") => {
  const res = await fetch(`${FS}/${ruta}`, { headers: auth ? { Authorization: auth } : {} });
  return { status: res.status, datos: await res.json() };
};

const { productos: catalogo } = (await import("../public/data/catalogo.json", { with: { type: "json" } })).default;
const [P1, P2] = catalogo;
const cliente = {
  nombre: "  Ana Pérez ",
  telefono: "11 4567-8901",
  email: "ana@ejemplo.com",
  entrega: "envio",
  direccion: "Caballito",
  pago: "Transferencia",
  comentarios: "",
};
const items = [{ id: P1.id, cant: 12 }, { id: P2.id, cant: 1 }];
const total = P1.mayor * 12 + P2.menor;
const solicitud = () => `prueba-${Math.random().toString(36).slice(2)}${Date.now()}`;
const pedir = (cambios = {}, idToken = null) =>
  llamar("pedido.crear", { items, cliente, totalVisto: total, solicitud: solicitud(), ...cambios }, idToken);

const rechazo = (r, status) => r.error?.status === status;

check("pedido vacío: se rechaza", rechazo(await pedir({ items: [] }), "INVALID_ARGUMENT"));
check("cantidad con decimales: se rechaza", rechazo(await pedir({ items: [{ id: P1.id, cant: 1.5 }] }), "INVALID_ARGUMENT"));
check("producto repetido: se rechaza", rechazo(await pedir({ items: [items[0], items[0]] }), "INVALID_ARGUMENT"));
check("sin código de solicitud: se rechaza", rechazo(await pedir({ solicitud: "corto" }), "INVALID_ARGUMENT"));

const sinEmail = await pedir({ cliente: { ...cliente, email: "ana@" } });
check(
  "datos inválidos: se rechaza y dice qué campo",
  rechazo(sinEmail, "INVALID_ARGUMENT") && sinEmail.error?.details?.errores?.email,
  JSON.stringify(sinEmail),
);

const inventado = await pedir({ items: [{ id: "NO-EXISTE", cant: 1 }], totalVisto: 1 });
check(
  "producto inexistente: se rechaza y lo nombra",
  rechazo(inventado, "FAILED_PRECONDITION") && inventado.error?.details?.noDisponibles?.includes("NO-EXISTE"),
  JSON.stringify(inventado),
);

const barato = await pedir({ totalVisto: total - 100 });
check(
  "total que no coincide con el servidor: se rechaza y manda el real",
  rechazo(barato, "FAILED_PRECONDITION") && barato.error?.details?.total === total,
  JSON.stringify(barato),
);

// Un producto pausado entre que la clienta lo agregó y confirmó.
await llamar("producto.pausar", { id: P2.id, pausar: true }, tokenAdmin);
const conPausado = await pedir();
check(
  "producto pausado: se rechaza y lo nombra",
  rechazo(conPausado, "FAILED_PRECONDITION") && conPausado.error?.details?.noDisponibles?.includes(P2.id),
  JSON.stringify(conPausado),
);
await llamar("producto.pausar", { id: P2.id, pausar: false }, tokenAdmin);

const idem = solicitud();
const ok = await pedir({ solicitud: idem });
check("pedido válido sin cuenta: se crea con número y link", ok.result?.numero > 0 && /^[0-9a-f]{32}$/.test(ok.result?.seguimiento ?? ""), JSON.stringify(ok));
check("el total es el que calculó el servidor", ok.result?.total === total);

const repetido = await pedir({ solicitud: idem });
check(
  "el mismo pedido dos veces (doble clic): devuelve el mismo, no crea otro",
  repetido.result?.repetido === true && repetido.result?.numero === ok.result?.numero,
  JSON.stringify(repetido),
);

const otro = await pedir();
check("el siguiente pedido lleva el número siguiente", otro.result?.numero === ok.result?.numero + 1, JSON.stringify(otro));

const seg = await leerDoc(`seguimiento/${ok.result?.seguimiento}`, null);
const segCampos = seg.datos.fields ?? {};
check("el link de seguimiento se lee sin cuenta", seg.status === 200, JSON.stringify(seg.datos).slice(0, 200));
check(
  "el seguimiento no tiene datos personales",
  !JSON.stringify(segCampos).match(/Ana|4567|ejemplo\.com|Caballito/),
  JSON.stringify(segCampos).slice(0, 300),
);

const res = await fetch(`${FS}/pedidos?pageSize=50`, { headers: { Authorization: "Bearer owner" } });
const guardado = ((await res.json()).documents ?? []).find(
  (d) => Number(d.fields.numero.integerValue) === ok.result?.numero,
);
check(
  "el pedido guarda los datos recortados",
  guardado?.fields.cliente.mapValue.fields.nombre.stringValue === "Ana Pérez",
  JSON.stringify(guardado?.fields.cliente).slice(0, 200),
);

const ajeno = await leerDoc(`pedidos/${guardado?.name.split("/").pop()}`, null);
check("el pedido completo NO se lee sin cuenta", ajeno.status === 403, String(ajeno.status));

const historial = await auditoria();
check("el pedido quedó en el historial", historial.some((a) => a.accion === "pedido.crear"));

let ultimo;
for (let i = 0; i < 12; i++) ultimo = await pedir();
check("muchos pedidos seguidos desde la misma conexión: se frena", rechazo(ultimo, "RESOURCE_EXHAUSTED"), JSON.stringify(ultimo));
await borrarColeccion("limites");

const accionHeredada = await llamar("constructor", {}, tokenAdmin);
check("'constructor' no es una acción", rechazo(accionHeredada, "NOT_FOUND"), JSON.stringify(accionHeredada));

const fallan = casos.filter((c) => !c.ok).length;
console.log(`\n${casos.length - fallan}/${casos.length} OK`);
process.exit(fallan ? 1 : 0);
