// Prueba el servidor de verdad: llama a las funciones igual que el
// navegador (la tienda sin cuenta, el panel con una sesión real del
// emulador de Auth) y después mira qué quedó escrito en Firestore.
//
//   npm run emu              (en otra terminal)
//   npm run test:funciones   (borra la base del emulador y la vuelve a sembrar)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROYECTO = "demo-aurora";
const AUTH = "http://127.0.0.1:8520/identitytoolkit.googleapis.com/v1";
const FN = `http://127.0.0.1:8522/${PROYECTO}/us-central1`;
const BASE = `http://127.0.0.1:8519/v1/projects/${PROYECTO}/databases/(default)/documents`;
const DUENO = { Authorization: "Bearer owner" };

const casos = [];
const check = (nombre, ok, detalle = "") => {
  casos.push({ ok, nombre });
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre}${ok || !detalle ? "" : `  → ${typeof detalle === "string" ? detalle : JSON.stringify(detalle)}`}`);
};

// ── Firestore por REST ──────────────────────────────────────────────
const deValor = (v) => {
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(deValor);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, deValor(x)]));
  return undefined;
};
const aValor = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aValor(x)])) } };
};
const leer = async (ruta, cabeceras = DUENO) => {
  const res = await fetch(`${BASE}/${ruta}`, { headers: cabeceras });
  if (res.status === 404) return null;
  const d = await res.json();
  if (!res.ok) return { __error: res.status, ...d };
  return deValor({ mapValue: { fields: d.fields ?? {} } });
};
const listar = async (col) => {
  const res = await fetch(`${BASE}/${col}?pageSize=300`, { headers: DUENO });
  const d = await res.json();
  return (d.documents ?? []).map((doc) => ({ id: doc.name.split("/").pop(), ...deValor({ mapValue: { fields: doc.fields ?? {} } }) }));
};
const escribir = (ruta, datos) =>
  fetch(`${BASE}/${ruta}`, {
    method: "PATCH",
    headers: { ...DUENO, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: aValor(datos).mapValue.fields }),
  });

// ── Llamar a las funciones ──────────────────────────────────────────
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
const llamar = async (funcion, accion, datos, idToken) => {
  const res = await fetch(`${FN}/${funcion}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data: { accion, datos } }),
  });
  return res.json();
};
const panel = (accion, datos, idToken) => llamar("panel", accion, datos, idToken);
const tienda = (accion, datos) => llamar("tienda", accion, datos);

// ── Base limpia ─────────────────────────────────────────────────────
try {
  await fetch(`${AUTH}/accounts:lookup?key=demo-api-key`, { method: "POST", body: "{}" });
} catch {
  console.error("No hay emuladores escuchando. Levantalos en otra terminal con: npm run emu");
  process.exit(1);
}
await fetch(`http://127.0.0.1:8519/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: "DELETE" });
execFileSync("node", ["scripts/sembrar-emulador.mjs", "--sin-ejemplos"], { stdio: "ignore" });

const catalogo = JSON.parse(readFileSync("public/data/catalogo.json", "utf8")).productos;
const [A, B, C] = catalogo;
const cliente = (tel, extra = {}) => ({
  nombre: "Ana Prueba",
  telefono: tel,
  email: "",
  entrega: "envio",
  direccion: "Caballito",
  pago: "Transferencia",
  comentarios: "",
  ...extra,
});
const hacerPedido = (carrito, tel = "11 4000-0001", extra) => tienda("pedido.crear", { carrito, cliente: cliente(tel, extra) });

const admin = await token("admin@aurora.test");
const prog = await token("programador@aurora.test");
const baja = await token("exempleada@aurora.test");

// ── Quién puede llamar al panel ─────────────────────────────────────
check("panel sin sesión: no", (await panel("producto.pausar", { id: A.id, pausar: true })).error?.status === "UNAUTHENTICATED");
check("panel con cuenta dada de baja: no", (await panel("producto.pausar", { id: A.id, pausar: true }, baja)).error?.status === "PERMISSION_DENIED");
check("acción inventada: no existe", (await panel("pedido.regalar", {}, admin)).error?.status === "NOT_FOUND");
check("la tienda no puede usar acciones del panel", (await tienda("pedido.confirmar", { id: "x" })).error?.status === "NOT_FOUND");

// ── La clienta hace un pedido ───────────────────────────────────────
const sinTel = await hacerPedido([{ id: A.id, cant: 1 }], "");
check("sin teléfono: se rechaza y dice qué falta", sinTel.error?.status === "INVALID_ARGUMENT" && Boolean(sinTel.error?.details?.errores?.telefono), sinTel);

const p1 = await hacerPedido([{ id: A.id, cant: 12, unit: 1 }, { id: B.id, cant: 1, sub: 1 }], "11 4000-0001", { comentarios: "Tocar 2B" });
const esperado = 12 * A.mayor + B.menor;
check("pedido válido: número y link de seguimiento", Number.isInteger(p1.result?.numero) && p1.result.numero > 1000 && /^[0-9a-f]{32}$/.test(p1.result?.token), p1);
check("el total lo calcula el servidor con los precios del catálogo (ignora lo que manda el navegador)", p1.result?.total === esperado, { total: p1.result?.total, esperado });

const doc1 = await leer(`pedidos/${p1.result.id}`);
check("queda guardado como pendiente, con los datos de la clienta", doc1?.estado === "pendiente" && doc1?.clienta?.telefono === "11 4000-0001" && doc1?.items?.length === 2);
check("guarda con qué condiciones se armó", doc1?.condiciones?.minimo_mayor === 12);

const seg = await leer(`seguimiento/${p1.result.token}`, {});
check("el link de seguimiento se lee SIN cuenta", seg?.numero === p1.result.numero && seg?.estado === "pendiente", seg);
check("el seguimiento no tiene datos personales", !JSON.stringify(seg).includes("4000-0001") && !JSON.stringify(seg).includes("Caballito"));
check("el pedido completo NO se lee sin cuenta", (await leer(`pedidos/${p1.result.id}`, {}))?.__error === 403);

const p2 = await hacerPedido([{ id: A.id, cant: 12 }], "+54 9 11 4000-0001");
check("mismo teléfono escrito distinto: misma clienta", p2.result?.numero === p1.result.numero + 1);
const ficha = await leer("clientas/tel-1140000001");
check("ficha de la clienta con sus 2 pedidos", ficha?.pedidos === 2 && ficha?.compras === 0, ficha);
check("tablero: 2 pendientes", (await leer("interno/tablero"))?.porEstado?.pendiente === 2);

check("producto que no existe: se rechaza", (await hacerPedido([{ id: "NO-EXISTE", cant: 1 }], "11 4000-0002")).error?.status === "FAILED_PRECONDITION");

// ── Stock ───────────────────────────────────────────────────────────
check("stock: la tienda no puede cargarlo", (await tienda("stock.ajustar", { id: A.id, cantidad: 5 })).error?.status === "NOT_FOUND");
check("stock: cantidad negativa se rechaza", (await panel("stock.ajustar", { id: A.id, cantidad: -1 }, admin)).error?.status === "INVALID_ARGUMENT");
const st = await panel("stock.ajustar", { id: A.id, cantidad: 20 }, admin);
check("el admin carga 20 u. de stock", st.result?.cantidad === 20, st);
const demasiado = await hacerPedido([{ id: A.id, cant: 25 }], "11 4000-0003");
check("pedir más de lo que hay: se rechaza y dice cuánto queda", demasiado.error?.status === "FAILED_PRECONDITION" && /quedan 20/.test(demasiado.error?.message), demasiado);

// ── Confirmar: stock, ventas y ficha ────────────────────────────────
check("la tienda no puede confirmar", (await tienda("pedido.confirmar", { id: p1.result.id })).error?.status === "NOT_FOUND");
check("no se puede entregar sin confirmar", (await panel("pedido.entregar", { id: p1.result.id }, admin)).error?.status === "FAILED_PRECONDITION");
const c1 = await panel("pedido.confirmar", { id: p1.result.id }, admin);
check("el admin confirma el pedido", c1.result?.estado === "confirmado", c1);
check("se descuenta el stock (20 − 12 = 8)", (await leer("interno/stock"))?.cantidades?.[A.id] === 8);
const mes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const stats1 = await leer(`stats/${mes}`);
check("suma a las ventas del mes", stats1?.totales?.pedidos === 1 && stats1?.totales?.total === esperado, stats1?.totales);
check("suma al producto vendido", stats1?.productos?.[A.id]?.unidades === 12);
check("la ficha suma una compra", (await leer("clientas/tel-1140000001"))?.compras === 1);
check("el seguimiento muestra confirmado", (await leer(`seguimiento/${p1.result.token}`, {}))?.estado === "confirmado");
check("confirmar dos veces no descuenta dos veces", (await panel("pedido.confirmar", { id: p1.result.id }, admin)).result?.sinCambios === true && (await leer("interno/stock"))?.cantidades?.[A.id] === 8);

const c2 = await panel("pedido.confirmar", { id: p2.result.id }, admin);
check("confirmar sin stock suficiente: se rechaza y explica", c2.error?.status === "FAILED_PRECONDITION" && /No alcanza el stock/.test(c2.error?.message), c2);

// ── Agotado ─────────────────────────────────────────────────────────
await panel("stock.ajustar", { id: A.id, cantidad: 0 }, admin);
const enTienda = (await leer("publico/catalogo")).productos.find((p) => p.id === A.id);
check("con stock 0 la tienda lo ve agotado", enTienda?.agotado === true);
check("la tienda no deja pedir un agotado", /sin stock/.test((await hacerPedido([{ id: A.id, cant: 1 }], "11 4000-0004")).error?.message ?? ""));

// ── Cancelar lo confirmado devuelve todo ────────────────────────────
const x1 = await panel("pedido.cancelar", { id: p1.result.id, motivo: "La clienta se arrepintió" }, prog);
check("el programador cancela el pedido confirmado", x1.result?.estado === "cancelado", x1);
check("el stock vuelve (0 + 12 = 12)", (await leer("interno/stock"))?.cantidades?.[A.id] === 12);
check("y deja de estar agotado", (await leer("publico/catalogo")).productos.find((p) => p.id === A.id)?.agotado === false);
const stats2 = await leer(`stats/${mes}`);
check("se resta de las ventas", stats2?.totales?.pedidos === 0 && stats2?.totales?.total === 0, stats2?.totales);
check("la ficha resta la compra", (await leer("clientas/tel-1140000001"))?.compras === 0);
check("un cancelado no se puede reabrir", (await panel("pedido.confirmar", { id: p1.result.id }, admin)).error?.status === "FAILED_PRECONDITION");
const hist = (await leer(`pedidos/${p1.result.id}`))?.historial ?? [];
check("el historial del pedido cuenta quién hizo qué y por qué", hist.map((h) => h.estado).join(">") === "pendiente>confirmado>cancelado" && hist[2]?.motivo === "La clienta se arrepintió", hist);

check("ahora sí alcanza: confirmar el otro", (await panel("pedido.confirmar", { id: p2.result.id }, admin)).result?.estado === "confirmado");
check("y entregarlo", (await panel("pedido.entregar", { id: p2.result.id }, admin)).result?.estado === "entregado");
check("un entregado no se cancela", (await panel("pedido.cancelar", { id: p2.result.id }, admin)).error?.status === "FAILED_PRECONDITION");
const tablero = (await leer("interno/tablero"))?.porEstado;
check("tablero al día: 0 pendientes, 1 entregado, 1 cancelado", tablero?.pendiente === 0 && tablero?.entregado === 1 && tablero?.cancelado === 1, tablero);

// ── Productos: alta y edición ───────────────────────────────────────
const nuevo = { cod: "NUE-001", nom: "Rubor en crema", desc: "Tono durazno", rubro: "rostro", img: "https://ejemplo.com/rubor.jpg", menor: 4500, mayor: 3300 };
const alta = await panel("producto.guardar", nuevo, admin);
check("alta de un producto", alta.result?.id === "NUE-001" && alta.result?.nuevo === true, alta);
check("aparece en el catálogo de la tienda", (await leer("publico/catalogo")).productos.some((p) => p.id === "NUE-001" && p.origen === "panel"));
check("código repetido: se rechaza", (await panel("producto.guardar", nuevo, admin)).error?.status === "ALREADY_EXISTS");
check("mayor más caro que menor: se rechaza", (await panel("producto.guardar", { ...nuevo, cod: "NUE-002", mayor: 9999 }, admin)).error?.status === "INVALID_ARGUMENT");
check("rubro inventado: se rechaza", (await panel("producto.guardar", { ...nuevo, cod: "NUE-003", rubro: "joyas" }, admin)).error?.status === "INVALID_ARGUMENT");
check("la admin no puede cargar costos", (await panel("producto.guardar", { ...nuevo, id: "NUE-001", costoUsd: 1.2 }, admin)).error?.status === "PERMISSION_DENIED");
const edit = await panel("producto.guardar", { ...nuevo, id: "NUE-001", menor: 4900 }, admin);
check("edición de precio", edit.result?.nuevo === false && (await leer("publico/catalogo")).productos.find((p) => p.id === "NUE-001")?.menor === 4900, edit);
const pedidoNuevo = await hacerPedido([{ id: "NUE-001", cant: 2 }], "11 4000-0005");
check("se puede pedir el producto nuevo con su precio nuevo", pedidoNuevo.result?.total === 9800, pedidoNuevo);

// ── Configuración ───────────────────────────────────────────────────
check("WhatsApp inválido: se rechaza", (await panel("config.guardar", { whatsapp: "12345" }, admin)).error?.status === "INVALID_ARGUMENT");
const cfg = await panel("config.guardar", { whatsapp: "54 9 11 5555-6666", nombre_negocio: "Aurora Cosmética", minimo_mayor: 10 }, admin);
check("el admin guarda WhatsApp, nombre y mínimo", cfg.result?.cambiados?.length === 3, cfg);
const cfgTienda = (await leer("publico/catalogo")).config;
check("la tienda ve la config nueva", cfgTienda.whatsapp === "5491155556666" && cfgTienda.minimo_mayor === 10 && cfgTienda.formas_pago?.length === 3, cfgTienda);
const conMinimo10 = await hacerPedido([{ id: B.id, cant: 10 }], "11 4000-0006");
check("el mínimo nuevo ya cobra por mayor con 10 u.", conMinimo10.result?.total === 10 * B.mayor, conMinimo10);
await panel("config.guardar", { minimo_mayor: 12 }, admin);

// ── Precios (solo programador) ──────────────────────────────────────
const params = { tipo_cambio: 1500, factor_importacion: 2.5, margen_menor: 2, margen_mayor: 1.5, redondeo: 100 };
check("la admin no puede recalcular precios", (await panel("precios.recalcular", { parametros: params }, admin)).error?.status === "PERMISSION_DENIED");
check("parámetros inválidos: se rechaza", (await panel("precios.recalcular", { parametros: { ...params, tipo_cambio: 0 } }, prog)).error?.status === "INVALID_ARGUMENT");
await escribir("privado/costos", { costos: { [C.id]: 1 } });
const previa = await panel("precios.recalcular", { parametros: params }, prog);
check("vista previa: cuántos cambian, sin tocar nada", previa.result?.aplicado === false && previa.result?.conCosto === 1 && previa.result?.cambian === 1, previa);
check("la vista previa no cambió el precio", (await leer("publico/catalogo")).productos.find((p) => p.id === C.id)?.menor === C.menor);
const aplicado = await panel("precios.recalcular", { parametros: params, aplicar: true }, prog);
const cNuevo = (await leer("publico/catalogo")).productos.find((p) => p.id === C.id);
check("aplicar: 1 × 2,5 × 1500 × 2 = $7.500 y × 1,5 = $5.600", aplicado.result?.aplicado === true && cNuevo.menor === 7500 && cNuevo.mayor === 5600, cNuevo);
check("los productos sin costo quedan como estaban", (await leer("publico/catalogo")).productos.find((p) => p.id === B.id)?.menor === B.menor);
check("la lista de precios pasa a tener la fecha de hoy", /^\d{2}\/\d{2}\/\d{4}$/.test((await leer("publico/catalogo")).config.actualizado));

// ── Arrepentimiento ─────────────────────────────────────────────────
check("arrepentimiento sin contacto: se rechaza", (await tienda("arrepentimiento.crear", { nombre: "Ana" })).error?.status === "INVALID_ARGUMENT");
const arr = await tienda("arrepentimiento.crear", { nombre: "Ana", contacto: "11 4000-0001", numero: p2.result.numero, motivo: "Me equivoqué de tono" });
check("arrepentimiento: la clienta recibe un código", /^ARR-[0-9A-F]{6}$/.test(arr.result?.codigo ?? ""), arr);
const arrs = await listar("arrepentimientos");
check("queda asociado a su pedido", arrs[0]?.pedidoId === p2.result.id && arrs[0]?.estado === "nuevo");
check("el admin lo resuelve", (await panel("arrepentimiento.resolver", { id: arrs[0].id, nota: "Se cambió el tono" }, admin)).result?.sinCambios === false);

// ── Borrar los datos de una clienta ─────────────────────────────────
const borrada = await panel("clienta.borrar", { id: "tel-1140000001" }, admin);
check("borrar clienta: anonimiza sus pedidos", borrada.result?.pedidosAnonimizados === 2, borrada);
const anon = await leer(`pedidos/${p1.result.id}`);
check("el pedido queda sin nombre, teléfono ni dirección", anon?.clienta?.telefono === null && anon?.entrega?.direccion === null && anon?.clientaId === null);
check("la ficha ya no existe", (await leer("clientas/tel-1140000001")) === null);

// ── Freno contra el abuso ───────────────────────────────────────────
let ultimo;
for (let i = 0; i < 6; i++) ultimo = await hacerPedido([{ id: B.id, cant: 1 }], "11 4999-0000");
check("el 6.º pedido en una hora con el mismo teléfono se frena", ultimo.error?.status === "RESOURCE_EXHAUSTED", ultimo);

// ── Historial de operaciones ────────────────────────────────────────
const aud = await listar("auditoria");
const acciones = new Set(aud.map((a) => a.accion));
for (const a of ["stock.ajustar", "pedido.confirmar", "pedido.cancelar", "pedido.entregar", "producto.guardar", "config.guardar", "precios.recalcular", "arrepentimiento.resolver", "clienta.borrar"]) {
  check(`historial: quedó anotado ${a}`, acciones.has(a));
}
check("recalcular precios queda como sensible (la admin no lo ve)", aud.find((a) => a.accion === "precios.recalcular")?.nivel === "sensible");
check("el costo nunca aparece en el historial", !JSON.stringify(aud).includes("costoUsd"));

// ── Pausar (lo que ya existía) ──────────────────────────────────────
const pausa = await panel("producto.pausar", { id: B.id, pausar: true }, admin);
check("pausar sigue funcionando", pausa.result?.activo === false, pausa);
check("un pausado no se puede pedir", /ya no está disponible/.test((await hacerPedido([{ id: B.id, cant: 1 }], "11 4000-0007")).error?.message ?? ""));
await panel("producto.pausar", { id: B.id, pausar: false }, prog);

const fallan = casos.filter((c) => !c.ok).length;
console.log(`\n${casos.length - fallan}/${casos.length} OK`);
process.exit(fallan ? 1 : 0);
