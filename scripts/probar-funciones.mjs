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

// ── Cobros: Mercado Pago (simulado) y transferencia ─────────────────
// El Mercado Pago simulado (scripts/mercadopago-simulado.mjs) lo levanta
// `npm run emu`; las funciones le hablan a él en vez de al real.
const MP = "http://127.0.0.1:8531";
const mpSim = async (ruta, cuerpo) =>
  (await fetch(`${MP}${ruta}`, cuerpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) } : {})).json();
const volver = (tk) => `http://localhost:8518/pedido/${tk}`;
const pedidoDe = async (id) => leer(`pedidos/${id}`);
const segDe = async (tk) => leer(`seguimiento/${tk}`, {});
try {
  await mpSim("/__simular/avisos");
} catch {
  console.error("No está el Mercado Pago simulado. `npm run emu` lo levanta solo; si no: node scripts/mercadopago-simulado.mjs");
  process.exit(1);
}

check("cobro: la tienda no puede cambiar el alias", (await tienda("cobro.guardar", { alias: "robado.ok" })).error?.status === "NOT_FOUND");
check("cobro: alias inválido se rechaza", (await panel("cobro.guardar", { alias: "con espacios" }, admin)).error?.status === "INVALID_ARGUMENT");
check("cobro: CBU que no son 22 números se rechaza", (await panel("cobro.guardar", { cbu: "123" }, admin)).error?.status === "INVALID_ARGUMENT");
const gc = await panel(
  "cobro.guardar",
  { alias: "Aurora.Cosmetica", cbu: "0000003100 0123456789 01", titular: "Aurora Cosmética", banco: "Mercado Pago", mercadopago: true },
  admin,
);
check("el admin guarda alias, CBU y prende Mercado Pago (el servidor prueba el token)", gc.result?.cambiados?.length === 5, gc);
check("alias en minúscula y CBU sin espacios", (await leer("interno/config"))?.cobro?.cbu === "0000003100012345678901" && (await leer("interno/config"))?.cobro?.alias === "aurora.cosmetica");
check("la config de cobro no se lee sin cuenta", (await leer("interno/config", {}))?.__error === 403);

const pp = await hacerPedido([{ id: B.id, cant: 2 }], "11 4100-0001");
const segPend = await segDe(pp.result.token);
check("pedido nuevo: sin pagar y todavía sin datos para pagar", segPend?.cobro?.estado === "sin_pagar" && segPend?.pagar === null && segPend?.aCobrar === pp.result.total, segPend);
check("no se puede pagar un pedido sin confirmar", (await tienda("pago.iniciar", { token: pp.result.token, volverA: volver(pp.result.token) })).error?.status === "FAILED_PRECONDITION");
const ventasAntes = (await leer(`stats/${mes}`))?.totales?.total ?? 0;
check("envío negativo al confirmar: se rechaza", (await panel("pedido.confirmar", { id: pp.result.id, envio: -5 }, admin)).error?.status === "INVALID_ARGUMENT");
check("confirmar sumando $3.500 de envío", (await panel("pedido.confirmar", { id: pp.result.id, envio: 3500 }, admin)).result?.estado === "confirmado");
const aCobrar = pp.result.total + 3500;
const segConf = await segDe(pp.result.token);
check(
  "el seguimiento muestra productos + envío y cómo pagar",
  segConf?.aCobrar === aCobrar && segConf?.envio === 3500 && segConf?.pagar?.mercadopago === true && segConf?.pagar?.transferencia?.alias === "aurora.cosmetica",
  segConf,
);
check("las ventas del mes no cuentan el envío", (await leer(`stats/${mes}`))?.totales?.total === ventasAntes + pp.result.total);

check("volver a otro sitio después de pagar: no", (await tienda("pago.iniciar", { token: pp.result.token, volverA: "https://otro.com/pedido/x" })).error?.status === "INVALID_ARGUMENT");
check("link de pedido inventado: no", (await tienda("pago.iniciar", { token: "0".repeat(32), volverA: volver("0".repeat(32)) })).error?.status === "NOT_FOUND");
const ini = await tienda("pago.iniciar", { token: pp.result.token, volverA: volver(pp.result.token) });
check("pagar con Mercado Pago: devuelve el link de pago (por el servidor de la tienda)", (ini.result?.url ?? "").startsWith("http://localhost:8518/__mp/checkout/"), ini);
const pref = (await mpSim("/__simular/preferencias")).find((x) => x.external_reference === pp.result.id);
check("el monto lo pone el servidor (productos + envío) y el aviso va al webhook", pref?.items?.[0]?.unit_price === aCobrar && pref?.notification_url?.endsWith("/us-central1/mercadopago"), pref);
check("pedir el link dos veces reusa el mismo pago", (await tienda("pago.iniciar", { token: pp.result.token, volverA: volver(pp.result.token) })).result?.url === ini.result.url);

const rech = await mpSim("/__simular/pagar", { preferencia: pref.id, resultado: "rechazado" });
check("tarjeta rechazada: llega el aviso y queda rechazado", (await pedidoDe(pp.result.id))?.cobro?.estado === "rechazado");
const apr = await mpSim("/__simular/pagar", { preferencia: pref.id, resultado: "aprobado", sinAviso: true });
check("la vuelta de Mercado Pago trae el número de pago", new URL(apr.vuelta).searchParams.get("payment_id") === String(apr.pago.id), apr.vuelta);
check("sin el aviso todavía, sigue rechazado", (await pedidoDe(pp.result.id))?.cobro?.estado === "rechazado");
check("verificar con el link de OTRO pedido: no", (await tienda("pago.verificar", { token: p2.result.token, pagoId: String(apr.pago.id) })).error?.status === "PERMISSION_DENIED");
check("verificar un pago que no existe: no", (await tienda("pago.verificar", { token: pp.result.token, pagoId: "1" })).error?.status === "NOT_FOUND");
const ver = await tienda("pago.verificar", { token: pp.result.token, pagoId: String(apr.pago.id) });
check("la clienta vuelve de Mercado Pago: se verifica y queda pagado", ver.result?.estado === "aprobado", ver);
const cobro1 = (await pedidoDe(pp.result.id))?.cobro;
check(
  "el cobro guarda medio, detalle, monto y número de pago",
  cobro1?.medio === "mercadopago" && cobro1?.monto === aCobrar && cobro1?.referencia === String(apr.pago.id) && cobro1?.detalle === "Tarjeta de crédito visa, 3 cuotas",
  cobro1,
);
const segPag = await segDe(pp.result.token);
check("el seguimiento muestra pagado", segPag?.cobro?.estado === "aprobado" && segPag?.cobro?.detalle === "Tarjeta de crédito visa, 3 cuotas", segPag?.cobro);
await mpSim("/__simular/avisar", { id: apr.pago.id });
check("el aviso que llega después no cambia nada", (await pedidoDe(pp.result.id))?.cobro?.cuando === cobro1.cuando);
await mpSim("/__simular/avisar", { id: rech.pago.id });
const trasViejo = await pedidoDe(pp.result.id);
check("el aviso viejo del rechazado no pisa el pago", trasViejo?.cobro?.estado === "aprobado" && !trasViejo?.pagosDeMas, trasViejo?.cobro);
check("ya pagado: no se puede volver a pagar", (await tienda("pago.iniciar", { token: pp.result.token, volverA: volver(pp.result.token) })).error?.status === "FAILED_PRECONDITION");

const mala = await mpSim("/__simular/pagar", { preferencia: pref.id, resultado: "aprobado", firmaMala: true });
const avisos = await mpSim("/__simular/avisos");
check("un aviso con firma falsa se rechaza (401)", avisos.at(-1)?.pago === mala.pago.id && avisos.at(-1)?.respuesta === 401, avisos.at(-1));
check("y no toca el pedido", !(await pedidoDe(pp.result.id))?.pagosDeMas);
check("el webhook solo acepta POST", (await fetch(`${FN}/mercadopago`)).status === 405);
const ipn = await fetch(`${FN}/mercadopago?topic=payment&id=${mala.pago.id}`, { method: "POST" });
check("un aviso sin firma (formato viejo) se ignora sin error", ipn.status === 200 && !(await pedidoDe(pp.result.id))?.pagosDeMas);
check("avisos de otro tipo: se responde ok y se ignoran", (await fetch(`${FN}/mercadopago?type=merchant_order&data.id=5`, { method: "POST" })).status === 200);
await tienda("pago.verificar", { token: pp.result.token, pagoId: String(mala.pago.id) });
const conDeMas = await pedidoDe(pp.result.id);
check(
  "un segundo pago del mismo pedido queda como pago de más",
  conDeMas?.pagosDeMas?.[mala.pago.id]?.estado === "aprobado" && conDeMas?.cobro?.referencia === String(apr.pago.id),
  conDeMas?.pagosDeMas,
);
const devMas = await panel("pago.devolver", { id: pp.result.id, referencia: String(mala.pago.id) }, admin);
check("el admin devuelve el pago de más", !devMas.error && (await pedidoDe(pp.result.id))?.pagosDeMas?.[mala.pago.id]?.estado === "devuelto", devMas);
check("y el cobro del pedido sigue pagado", (await pedidoDe(pp.result.id))?.cobro?.estado === "aprobado");

check("un pago de Mercado Pago no se anula (se devuelve)", (await panel("pago.anular", { id: pp.result.id }, admin)).error?.status === "FAILED_PRECONDITION");
check("pagado: el envío ya no se cambia", (await panel("pedido.envio", { id: pp.result.id, envio: 100 }, admin)).error?.status === "FAILED_PRECONDITION");
check("la tienda no puede devolver", (await tienda("pago.devolver", { id: pp.result.id })).error?.status === "NOT_FOUND");
await panel("pedido.cancelar", { id: pp.result.id, motivo: "No llegó el tono" }, admin);
const dev = await panel("pago.devolver", { id: pp.result.id }, admin);
check("cancelado y pagado: el admin devuelve el pago", dev.result?.estado === "devuelto", dev);
check("el seguimiento muestra la devolución", (await segDe(pp.result.token))?.cobro?.estado === "devuelto");
check("devolver dos veces: no", (await panel("pago.devolver", { id: pp.result.id }, admin)).error?.status === "FAILED_PRECONDITION");

// Transferencia: la marca el negocio al ver el comprobante.
const pt = await hacerPedido([{ id: B.id, cant: 1 }], "11 4100-0002");
await panel("pedido.confirmar", { id: pt.result.id }, admin);
const env = await panel("pedido.envio", { id: pt.result.id, envio: 1200 }, admin);
check("cambiar el envío de un confirmado sin pagar", env.result?.aCobrar === pt.result.total + 1200, env);
check("el seguimiento ve el envío nuevo", (await segDe(pt.result.token))?.aCobrar === pt.result.total + 1200);
check("medio de pago inventado: no", (await panel("pago.registrar", { id: pt.result.id, medio: "cripto" }, admin)).error?.status === "INVALID_ARGUMENT");
const rp = await panel("pago.registrar", { id: pt.result.id, medio: "transferencia", nota: "Comprobante 4471" }, admin);
check("el admin marca pagado por transferencia", rp.result?.estado === "aprobado", rp);
const cobroT = (await pedidoDe(pt.result.id))?.cobro;
check("queda quién lo marcó, cuánto y la nota", cobroT?.quien?.rol === "admin" && cobroT?.monto === pt.result.total + 1200 && cobroT?.detalle === "Transferencia · Comprobante 4471", cobroT);
check("marcarlo dos veces: no", (await panel("pago.registrar", { id: pt.result.id, medio: "efectivo" }, admin)).error?.status === "FAILED_PRECONDITION");
check("anular un pago marcado por error", (await panel("pago.anular", { id: pt.result.id }, admin)).result?.estado === "sin_pagar");
check("el seguimiento vuelve a sin pagar", (await segDe(pt.result.token))?.cobro?.estado === "sin_pagar");

// Efectivo en Rapipago: queda pendiente hasta que se acredita.
const pe = await hacerPedido([{ id: B.id, cant: 3 }], "11 4100-0003");
await panel("pedido.confirmar", { id: pe.result.id }, admin);
await tienda("pago.iniciar", { token: pe.result.token, volverA: volver(pe.result.token) });
const prefE = (await mpSim("/__simular/preferencias")).find((x) => x.external_reference === pe.result.id);
const ef = await mpSim("/__simular/pagar", { preferencia: prefE.id, resultado: "pendiente", medio: "efectivo" });
const cobroE = (await pedidoDe(pe.result.id))?.cobro;
check("efectivo en Rapipago: queda pendiente", cobroE?.estado === "pendiente" && /Efectivo/.test(cobroE?.detalle), cobroE);
check("con un pago en curso, el envío no se cambia", (await panel("pedido.envio", { id: pe.result.id, envio: 500 }, admin)).error?.status === "FAILED_PRECONDITION");
await mpSim("/__simular/estado", { id: ef.pago.id, status: "approved" });
check("cuando se acredita, pasa a pagado solo", (await pedidoDe(pe.result.id))?.cobro?.estado === "aprobado");

// Cambiar el alias llega a los pedidos confirmados que faltan pagar.
const gc2 = await panel("cobro.guardar", { alias: "aurora.nueva" }, admin);
check("cambiar el alias: se actualizan los pedidos sin pagar", gc2.result?.actualizados >= 1 && (await segDe(pt.result.token))?.pagar?.transferencia?.alias === "aurora.nueva", gc2);
check("pero no los ya pagados", (await segDe(pe.result.token))?.pagar?.transferencia?.alias === "aurora.cosmetica");
await panel("cobro.guardar", { mercadopago: false }, admin);
check("con Mercado Pago apagado no se puede iniciar un pago", (await tienda("pago.iniciar", { token: pt.result.token, volverA: volver(pt.result.token) })).error?.status === "FAILED_PRECONDITION");
check("y el seguimiento deja de ofrecerlo", (await segDe(pt.result.token))?.pagar?.mercadopago === false);

const audPagos = new Set((await listar("auditoria")).map((a) => a.accion));
for (const a of ["cobro.guardar", "pago.mercadopago", "pago.demas", "pago.devolver", "pago.registrar", "pago.anular", "pedido.envio"]) {
  check(`historial: quedó anotado ${a}`, audPagos.has(a));
}

// ── Facturación electrónica (ARCA simulado) ─────────────────────────
// scripts/arca-simulado.mjs lo levanta `npm run emu`, con un certificado de
// prueba del CUIT 20-11111111-2.
const ARCA = "http://127.0.0.1:8532";
const arcaSim = async (ruta, cuerpo) =>
  (await fetch(`${ARCA}${ruta}`, cuerpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) } : {})).json();
try {
  await arcaSim("/__simular/comprobantes");
} catch {
  console.error("No está el ARCA simulado. `npm run emu` lo levanta solo; si no: node scripts/arca-simulado.mjs");
  process.exit(1);
}
// La base se borró al empezar: el ARCA simulado también arranca vacío (sin
// comprobantes ni el ticket de acceso, que el real no vuelve a dar por 12 h).
await arcaSim("/__simular/reiniciar", {});
// Los frenos contra el abuso cuentan pedidos por hora desde esta conexión:
// en las pruebas se hacen muchos seguidos.
const limpiarLimites = async () => {
  const docs = await listar("limites");
  await Promise.all(docs.map((d) => fetch(`${BASE}/limites/${d.id}`, { method: "DELETE", headers: DUENO })));
};
await limpiarLimites();
let telF = 5000;
const pedidoCon = async (fiscal, carrito = [{ id: B.id, cant: 2 }]) => {
  telF++;
  const r = await tienda("pedido.crear", { carrito, cliente: cliente(`11 4200-${telF}`), ...(fiscal ? { fiscal } : {}) });
  if (r.error) throw new Error(`pedido.crear: ${r.error.message}`);
  await panel("pedido.confirmar", { id: r.result.id }, admin);
  return r.result;
};
const cobrarAMano = (id) => panel("pago.registrar", { id, medio: "transferencia" }, admin);
const comprobanteDe = async (token) => leer(`comprobantes/${token}`, {});
const EMISOR = {
  activa: true,
  condicion: "monotributo",
  cuit: "20-11111111-2",
  razon_social: "Aurora Cosmética (prueba)",
  domicilio: "Av. Corrientes 1234, CABA",
  iibb: "Exento",
  inicio: "01/03/2024",
  ptoVta: 3,
  ambiente: "homologacion",
};

check("facturación: la tienda no puede configurarla", (await tienda("facturacion.guardar", { activa: true })).error?.status === "NOT_FOUND");
check("facturación: CUIT inválido se rechaza", (await panel("facturacion.guardar", { cuit: "20-11111111-3" }, admin)).error?.status === "INVALID_ARGUMENT");
const incompleta = await panel("facturacion.guardar", { activa: true, condicion: "monotributo" }, admin);
check("facturación: prenderla con datos incompletos dice qué falta", incompleta.error?.status === "FAILED_PRECONDITION" && /falta el CUIT/.test(incompleta.error?.message), incompleta);
const sinFacturar = await pedidoCon();
await cobrarAMano(sinFacturar.id);
check("con la facturación apagada, cobrar no factura", !(await pedidoDe(sinFacturar.id))?.factura);
const gf = await panel("facturacion.guardar", EMISOR, admin);
check("el admin guarda los datos de ARCA y prende la facturación", gf.result?.cambiados?.length === 9, gf);
check("la tienda sabe que se factura (para ofrecer factura con CUIT)", (await leer("publico/catalogo")).config?.emite_factura === true);
const prueba = await panel("factura.probar", {}, admin);
check("probar conexión: servidores OK, certificado aceptado, sin comprobantes todavía", prueba.result?.servidores?.app === "OK" && prueba.result?.ultimos?.[0]?.ultimo === "ninguno todavía", prueba);

// Monotributo → Factura C
const f1 = await pedidoCon();
const pag1 = await cobrarAMano(f1.id);
const ped1 = await pedidoDe(f1.id);
check("cobrado: la factura sale en el momento", pag1.result?.estado === "aprobado" && ped1?.factura?.estado === "emitida", ped1?.factura);
check("monotributo → Factura C n.º 1 del punto de venta 3, con CAE", ped1?.facturaVigente?.tipo === 11 && ped1?.facturaVigente?.numeroTexto === "00003-00000001" && /^\d{14}$/.test(ped1?.facturaVigente?.cae ?? ""), ped1?.facturaVigente);
const fc1 = await comprobanteDe(ped1.facturaVigente.token);
check("la factura se ve SIN cuenta, con su link", fc1?.nombre === "Factura C" && fc1?.receptor?.nombre === "Consumidor final" && fc1?.total === ped1.aCobrar, fc1);
check("lleva el QR de ARCA y los datos del negocio", fc1?.qr?.startsWith("https://www.arca.gob.ar/fe/qr/?p=") && fc1?.emisor?.cuit === "20111111112" && fc1?.emisor?.inicio === "01/03/2024");
check("en C no se discrimina IVA", fc1?.iva === 0 && fc1?.neto === fc1?.total && fc1?.alicuota === null);
check("el seguimiento de la clienta muestra la factura", (await segDe(f1.token))?.comprobantes?.[0]?.numeroTexto === "00003-00000001");
check("la lista de comprobantes NO se lee sin cuenta", (await fetch(`${BASE}/comprobantes?pageSize=5`)).status === 403);

const f2 = await pedidoCon();
await cobrarAMano(f2.id);
check("la segunda usa el mismo acceso a ARCA (no pide otro) y es la n.º 2", (await pedidoDe(f2.id))?.facturaVigente?.numero === 2);
await panel("pago.anular", { id: f2.id }, admin);
const ped2 = await pedidoDe(f2.id);
check("anular el pago → nota de crédito C que anula la factura", ped2?.factura?.estado === "anulada" && ped2?.facturaVigente === null && ped2?.comprobantes?.[1]?.tipo === 13, ped2?.factura);
const nc2 = await comprobanteDe(ped2.comprobantes[1].token);
check("la nota de crédito dice qué factura anula", nc2?.asociado?.nombre === "Factura C 00003-00000002" && nc2?.total === ped2.comprobantes[0].total, nc2?.asociado);

// Con CUIT
check("CUIT inválido al pedir: se rechaza y dice qué campo", (await tienda("pedido.crear", { carrito: [{ id: B.id, cant: 1 }], cliente: cliente("11 4300-0001"), fiscal: { condicion: "responsable_inscripto", cuit: "30712345670", nombre: "Sur SA" } })).error?.details?.errores?.cuit !== undefined);
const f3 = await pedidoCon({ condicion: "responsable_inscripto", cuit: "30-71234567-1", nombre: "Distribuidora Sur SA" });
await cobrarAMano(f3.id);
const fc3 = await comprobanteDe((await pedidoDe(f3.id)).facturaVigente.token);
check("con CUIT: la factura va a su nombre y CUIT", fc3?.receptor?.nombre === "Distribuidora Sur SA" && fc3?.receptor?.doc === "CUIT 30-71234567-1" && fc3?.receptor?.condicion === "IVA Responsable Inscripto", fc3?.receptor);

// Mercado Pago cobra y devuelve: factura y nota de crédito solas
await panel("cobro.guardar", { mercadopago: true }, admin);
const f4 = await pedidoCon();
await tienda("pago.iniciar", { token: f4.token, volverA: volver(f4.token) });
const pref4 = (await mpSim("/__simular/preferencias")).find((x) => x.external_reference === f4.id);
await mpSim("/__simular/pagar", { preferencia: pref4.id, resultado: "aprobado" });
check("pagado con Mercado Pago: el aviso trae la factura", (await pedidoDe(f4.id))?.factura?.estado === "emitida");
await panel("pago.devolver", { id: f4.id }, admin);
check("devuelto por Mercado Pago: sale la nota de crédito", (await pedidoDe(f4.id))?.factura?.estado === "anulada");

// Responsable inscripto → A o B
check("pasar a responsable inscripto", (await panel("facturacion.guardar", { condicion: "responsable_inscripto" }, admin)).result?.cambiados?.[0] === "condicion");
const f5 = await pedidoCon();
await cobrarAMano(f5.id);
const fc5 = await comprobanteDe((await pedidoDe(f5.id)).facturaVigente.token);
check("a consumidor final: Factura B con el IVA discriminado", fc5?.tipo === 6 && fc5?.alicuota === 21 && Math.abs(fc5.neto + fc5.iva - fc5.total) < 0.001 && fc5.iva === Math.round((fc5.total - Math.round((fc5.total / 1.21) * 100) / 100) * 100) / 100, fc5);
const f6 = await pedidoCon({ condicion: "monotributo", cuit: "20123456786", nombre: "Ana Revende" });
await cobrarAMano(f6.id);
check("a un monotributista con CUIT: Factura A", (await pedidoDe(f6.id))?.facturaVigente?.tipo === 1);
await panel("pago.anular", { id: f6.id }, admin);
check("y su anulación es nota de crédito A", (await pedidoDe(f6.id))?.comprobantes?.[1]?.tipo === 3);

// Cuando ARCA falla
await limpiarLimites();
await arcaSim("/__simular/modo", { modo: "rechazar" });
const f7 = await pedidoCon();
const pag7 = await cobrarAMano(f7.id);
const ped7 = await pedidoDe(f7.id);
check("ARCA rechaza: el cobro se guarda igual y la factura queda con el motivo", pag7.result?.estado === "aprobado" && ped7?.factura?.estado === "error" && /Rechazo de prueba/.test(ped7?.factura?.error) && ped7?.factura?.temporal === false, ped7?.factura);
check("reintentar desde el panel: sale la factura", (await panel("factura.reintentar", { id: f7.id }, admin)).result?.resultado?.estado === "emitida");
check("reintentar sin nada pendiente: no", (await panel("factura.reintentar", { id: f7.id }, admin)).error?.status === "FAILED_PRECONDITION");

const antesCorte = Object.values(await arcaSim("/__simular/comprobantes")).flat().length;
await arcaSim("/__simular/modo", { modo: "cortar" });
const f8 = await pedidoCon();
await cobrarAMano(f8.id);
const ped8 = await pedidoDe(f8.id);
check("se corta la respuesta de ARCA: queda en error pasajero", ped8?.factura?.estado === "error" && ped8?.factura?.temporal === true, ped8?.factura);
await panel("factura.reintentar", { id: f8.id }, admin);
const ped8b = await pedidoDe(f8.id);
const despuesCorte = Object.values(await arcaSim("/__simular/comprobantes")).flat().length;
check("al reintentar recupera el comprobante que ARCA sí registró: no hay duplicado", ped8b?.factura?.estado === "emitida" && despuesCorte === antesCorte + 1, { factura: ped8b?.factura, antesCorte, despuesCorte });

await arcaSim("/__simular/modo", { modo: "caido" });
const f9 = await pedidoCon();
await cobrarAMano(f9.id);
check("ARCA caído: error pasajero (se reintenta solo cada 30 minutos)", (await pedidoDe(f9.id))?.factura?.temporal === true);
await arcaSim("/__simular/modo", { modo: "normal" });
check("vuelve ARCA: reintentar la emite", (await panel("factura.reintentar", { id: f9.id }, admin)).result?.resultado?.estado === "emitida");

// Desde $10.000.000 a consumidor final hay que identificarlo
await limpiarLimites();
const grande = await pedidoCon(null, [{ id: B.id, cant: Math.ceil(10_000_000 / B.mayor) + 1 }]);
await cobrarAMano(grande.id);
check("desde $10.000.000 sin identificar: no factura y explica", /10\.000\.000/.test((await pedidoDe(grande.id))?.factura?.error ?? ""));
check("datos para la factura: DNI inválido se rechaza", (await panel("pedido.fiscal", { id: grande.id, fiscal: { condicion: "consumidor_final", dni: "12", nombre: "Ana" } }, admin)).error?.status === "INVALID_ARGUMENT");
await panel("pedido.fiscal", { id: grande.id, fiscal: { condicion: "consumidor_final", dni: "30.123.456", nombre: "Ana Prueba" } }, admin);
await panel("factura.reintentar", { id: grande.id }, admin);
const fcg = await comprobanteDe((await pedidoDe(grande.id))?.facturaVigente?.token ?? "x");
check("con el DNI cargado, sale", fcg?.receptor?.doc === "DNI 30123456", fcg?.receptor);
check("ya facturado: los datos no se cambian", (await panel("pedido.fiscal", { id: grande.id, fiscal: { condicion: "consumidor_final" } }, admin)).error?.status === "FAILED_PRECONDITION");

// Un pedido cobrado antes de prender la facturación
check("emitir a mano el que se cobró con la facturación apagada", (await panel("factura.emitir", { id: sinFacturar.id }, admin)).result?.resultado?.estado === "emitida");
check("emitirla dos veces: no", (await panel("factura.emitir", { id: sinFacturar.id }, admin)).error?.status === "FAILED_PRECONDITION");

const audF = new Set((await listar("auditoria")).map((a) => a.accion));
for (const a of ["facturacion.guardar", "factura.emitida", "factura.anulada", "factura.reintentar", "factura.emitir", "pedido.fiscal"]) {
  check(`historial: quedó anotado ${a}`, audF.has(a));
}
check("el historial no guarda el DNI", !JSON.stringify(await listar("auditoria")).includes("30123456"));

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
