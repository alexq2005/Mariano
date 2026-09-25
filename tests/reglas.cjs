// Tests de las reglas de seguridad de Firestore.
//
//   npm run test:reglas
//
// Levanta el emulador, carga firestore.rules y prueba, actor por actor, qué
// puede leer y qué no: una clienta, un admin, un admin dado de baja, uno que
// entró con Google en vez de con contraseña, y el programador. El navegador
// NUNCA escribe: eso también se verifica acá.
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, limit, Timestamp,
} = require("firebase/firestore");

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-aurora",
    firestore: { rules: readFileSync(process.env.REGLAS || path.join(__dirname, "..", "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8519 },
  });
  const pw = { firebase: { sign_in_provider: "password" } };
  const ctx = (uid, prov = "password") => env.authenticatedContext(uid, { firebase: { sign_in_provider: prov } }).firestore();
  const actores = {
    anon: () => env.unauthenticatedContext().firestore(),
    clienta: () => ctx("cli1"),
    admin: () => ctx("adm1"),
    adminInactivo: () => ctx("admOff"),
    adminGoogle: () => ctx("admG", "google.com"),
    adminAnonimo: () => ctx("admA", "anonymous"),
    rolTypo: () => ctx("typo"),
    rolInventado: () => ctx("inventado"),
    programador: () => ctx("prog1"),
    progInactivo: () => ctx("progOff"),
  };
  const futuro = Timestamp.fromMillis(Date.now() + 864e5);
  const pasado = Timestamp.fromMillis(Date.now() - 864e5);

  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const s = (p, d) => setDoc(doc(db, p), d);
    await s("staff/adm1", { rol: "admin", activo: true });
    await s("staff/admOff", { rol: "admin", activo: false });
    await s("staff/admG", { rol: "admin", activo: true });
    await s("staff/admA", { rol: "admin", activo: true });
    await s("staff/typo", { rol: "Admin", activo: true });
    await s("staff/inventado", { rol: "superadmin", activo: true });
    await s("staff/prog1", { rol: "programador", activo: true });
    await s("staff/progOff", { rol: "programador", activo: false });
    await s("staff/adm1/dispositivos/f1", { fid: "f1" });
    await s("publico/catalogo", { version: 1, productos: { A: { nom: "Labial", menor: 3000, mayor: 2200 } } });
    await s("privado/costos", { costos: { A: { usd: 0.4 } } });
    await s("privado/config", { parametros: { tipoCambio: 1450 } });
    await s("privado/respaldo", { antes: {} });
    await s("interno/stock", { cantidades: { A: 10 } });
    await s("interno/tablero", { contadores: { pendiente: 1 } });
    await s("interno/config", { cobro: { alias: "aurora.mp" } });
    await s("interno/otro", { x: 1 });
    await s("pedidos/p1", { numero: 1001, clienta: { uid: "cli1", telefono: "11" }, estado: "pendiente" });
    await s("seguimiento/tokOK", { numero: 1001, uid: "cli1", expira: futuro });
    await s("seguimiento/tokViejo", { numero: 900, uid: null, expira: pasado });
    await s("seguimiento/tokOtra", { numero: 1002, uid: "cli2", expira: futuro });
    await s("comprobantes/tokF", { numero: 12, letra: "C", total: 45300 });
    await s("sistema/arca-ta-produccion", { token: "t", sign: "s" });
    await s("clientas/c1", { nombre: "María" });
    await s("stats/2026-09", { totales: { pedidos: 3 } });
    await s("arrepentimientos/a1", { numero: 1001 });
    await s("auditoria/g1", { nivel: "general", accion: "pedido.confirmar" });
    await s("auditoria/s1", { nivel: "sensible", accion: "precios.parametros" });
    await s("salida/g1", { nivel: "general", evento: "pedido.recibido" });
    await s("salida/s1", { nivel: "sensible", evento: "alerta.cbu" });
    await s("contadores/pedidos", { ultimo: 1001 });
    await s("limites/ip1", { n: 1 });
    await s("importaciones/sha1", { antes: {} });
  });

  let ok = 0, mal = 0;
  const caso = async (nombre, esperado, fn) => {
    try { await (esperado ? assertSucceeds(fn()) : assertFails(fn())); ok++; }
    catch (e) { mal++; console.log("FALLA:", nombre, "-", String(e.message).split("\n")[0]); }
  };

  // Matriz de lecturas directas (get): quién puede leer qué documento.
  const STAFF = ["admin", "programador"];
  const matriz = {
    "publico/catalogo": Object.keys(actores),
    "privado/costos": ["programador"],
    "privado/config": ["programador"],
    "privado/respaldo": ["programador"],
    "interno/stock": STAFF,
    "interno/tablero": STAFF,
    "interno/config": STAFF,
    "interno/otro": [],
    "pedidos/p1": STAFF,
    "seguimiento/tokOK": Object.keys(actores),
    "seguimiento/tokViejo": [],
    "seguimiento/noExiste": [],
    "comprobantes/tokF": Object.keys(actores),
    "comprobantes/noExiste": Object.keys(actores),
    "sistema/arca-ta-produccion": [],
    "clientas/c1": STAFF,
    "stats/2026-09": STAFF,
    "arrepentimientos/a1": STAFF,
    "auditoria/g1": STAFF,
    "auditoria/s1": ["programador"],
    "salida/g1": STAFF,
    "salida/s1": ["programador"],
    "staff/adm1": ["admin", "programador"],
    "staff/prog1": ["programador"],
    "staff/admOff": ["adminInactivo", "programador"],
    "staff/adm1/dispositivos/f1": [],
    "contadores/pedidos": [],
    "limites/ip1": [],
    "importaciones/sha1": [],
  };
  for (const [ruta, pueden] of Object.entries(matriz)) {
    for (const [actor, db] of Object.entries(actores)) {
      await caso(`get ${actor} ${ruta}`, pueden.includes(actor), () => getDoc(doc(db(), ruta)));
    }
  }

  // Nadie escribe nada desde un cliente (set / update / delete), ni siquiera el programador.
  const rutasEscritura = Object.keys(matriz).filter((r) => !r.endsWith("/noExiste"))
    .concat(["pedidos/nuevo", "staff/cli1", "auditoria/nueva", "salida/nueva"]);
  for (const ruta of rutasEscritura) {
    for (const [actor, db] of Object.entries(actores)) {
      await caso(`set ${actor} ${ruta}`, false, () => setDoc(doc(db(), ruta), { x: 1 }));
      await caso(`update ${actor} ${ruta}`, false, () => updateDoc(doc(db(), ruta), { x: 2 }));
      await caso(`delete ${actor} ${ruta}`, false, () => deleteDoc(doc(db(), ruta)));
    }
  }
  // Escaladas concretas
  await caso("clienta se autoasigna programador", false, () => setDoc(doc(actores.clienta(), "staff/cli1"), { rol: "programador", activo: true }));
  await caso("admin se asciende", false, () => updateDoc(doc(actores.admin(), "staff/adm1"), { rol: "programador" }));
  await caso("admin inactivo se reactiva", false, () => updateDoc(doc(actores.adminInactivo(), "staff/admOff"), { activo: true }));
  await caso("clienta cambia estado de su seguimiento", false, () => updateDoc(doc(actores.clienta(), "seguimiento/tokOK"), { estado: "entregado" }));
  await caso("clienta confirma su pedido", false, () => updateDoc(doc(actores.clienta(), "pedidos/p1"), { estado: "confirmado" }));
  await caso("admin cambia CBU directo", false, () => updateDoc(doc(actores.admin(), "interno/config"), { "cobro.alias": "estafa.mp" }));
  await caso("programador borra auditoría", false, () => deleteDoc(doc(actores.programador(), "auditoria/g1")));

  // Consultas (list)
  const Q = (db, col, ...c) => getDocs(query(collection(db, col), ...c));
  for (const col of ["pedidos", "clientas", "arrepentimientos"]) {
    await caso(`admin lista ${col} limit 25`, true, () => Q(actores.admin(), col, limit(25)));
    await caso(`admin lista ${col} SIN limit`, false, () => Q(actores.admin(), col));
    await caso(`admin lista ${col} limit 101`, false, () => Q(actores.admin(), col, limit(101)));
    await caso(`programador lista ${col} limit 100`, true, () => Q(actores.programador(), col, limit(100)));
    await caso(`clienta lista ${col}`, false, () => Q(actores.clienta(), col, limit(10)));
    await caso(`anon lista ${col}`, false, () => Q(actores.anon(), col, limit(10)));
    await caso(`admin inactivo lista ${col}`, false, () => Q(actores.adminInactivo(), col, limit(10)));
  }
  await caso("admin lista stats limit 12", true, () => Q(actores.admin(), "stats", limit(12)));
  await caso("admin lista stats limit 25", false, () => Q(actores.admin(), "stats", limit(25)));
  await caso("admin lista pedidos pendientes", true, () => Q(actores.admin(), "pedidos", where("estado", "==", "pendiente"), limit(25)));
  await caso("admin auditoría con filtro general", true, () => Q(actores.admin(), "auditoria", where("nivel", "==", "general"), limit(50)));
  await caso("admin auditoría SIN filtro", false, () => Q(actores.admin(), "auditoria", limit(50)));
  await caso("admin auditoría filtro sensible", false, () => Q(actores.admin(), "auditoria", where("nivel", "==", "sensible"), limit(50)));
  await caso("admin auditoría filtro 'in'", false, () => Q(actores.admin(), "auditoria", where("nivel", "in", ["general", "sensible"]), limit(50)));
  await caso("programador auditoría completa", true, () => Q(actores.programador(), "auditoria", limit(100)));
  await caso("programador auditoría sin limit", false, () => Q(actores.programador(), "auditoria"));
  await caso("admin salida con filtro general", true, () => Q(actores.admin(), "salida", where("nivel", "==", "general"), limit(50)));
  await caso("admin salida SIN filtro", false, () => Q(actores.admin(), "salida", limit(50)));
  await caso("anon lista seguimiento", false, () => Q(actores.anon(), "seguimiento", limit(10)));
  await caso("clienta lista seguimiento sin filtro", false, () => Q(actores.clienta(), "seguimiento", limit(10)));
  await caso("clienta lista SUS seguimientos", true, () => Q(actores.clienta(), "seguimiento", where("uid", "==", "cli1"), limit(10)));
  await caso("clienta lista seguimientos de otra", false, () => Q(actores.clienta(), "seguimiento", where("uid", "==", "cli2"), limit(10)));
  await caso("clienta lista SUS seguimientos sin limit", false, () => Q(actores.clienta(), "seguimiento", where("uid", "==", "cli1")));
  await caso("admin lista comprobantes limit 100", true, () => Q(actores.admin(), "comprobantes", limit(100)));
  await caso("admin lista comprobantes SIN limit", false, () => Q(actores.admin(), "comprobantes"));
  await caso("anon lista comprobantes", false, () => Q(actores.anon(), "comprobantes", limit(10)));
  await caso("clienta lista comprobantes", false, () => Q(actores.clienta(), "comprobantes", limit(10)));
  await caso("admin lista sistema", false, () => Q(actores.admin(), "sistema", limit(5)));
  await caso("programador lista staff", true, () => Q(actores.programador(), "staff", limit(50)));
  await caso("admin lista staff", false, () => Q(actores.admin(), "staff", limit(50)));
  await caso("anon lista publico", false, () => Q(actores.anon(), "publico", limit(5)));
  await caso("admin lista privado", false, () => Q(actores.admin(), "privado", limit(5)));

  // Revocación instantánea: activo:false corta el siguiente get con el mismo token.
  await caso("admin lee pedido antes de la baja", true, () => getDoc(doc(actores.admin(), "pedidos/p1")));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "staff/adm1"), { activo: false }));
  await caso("admin dado de baja NO lee pedido", false, () => getDoc(doc(actores.admin(), "pedidos/p1")));
  await caso("admin dado de baja NO lista pedidos", false, () => Q(actores.admin(), "pedidos", limit(10)));
  await caso("admin dado de baja NO lee tablero", false, () => getDoc(doc(actores.admin(), "interno/tablero")));

  console.log(`RESULTADO: ${ok} OK, ${mal} FALLAN, total ${ok + mal}`);
  await env.cleanup();
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
