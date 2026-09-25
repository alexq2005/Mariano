// Un ARCA de mentira, para probar la facturación en la compu sin
// certificado real. Lo levanta `npm run emu` junto con los emuladores, y las
// funciones le hablan a él (functions/.env.local → ARCA_WSAA_URL y
// ARCA_WSFE_URL). En producción no existe: ahí siempre es ARCA.
//
//   node scripts/arca-simulado.mjs      (puerto 8532)
//
// Hace lo que usa el sistema, con las validaciones que importan del real:
//   WSAA    loginCms: lee el pedido firmado (CMS) y da un ticket por 12 h;
//           si se pide otro con uno vigente, contesta como ARCA
//           ("coe.alreadyAuthenticated"): así se prueba que se reusa.
//   WSFEv1  FEDummy, FECompUltimoAutorizado, FECompConsultar y
//           FECAESolicitar: número correlativo, condición IVA del receptor
//           (obligatoria) y compatible con la letra, IVA solo en A y B,
//           importes que cierran, consumidor final identificado desde
//           $10.000.000, notas de crédito con su factura asociada.
//
// Para las pruebas automáticas:
//   POST /__simular/modo {modo}   "normal" | "rechazar" (el próximo) |
//                                 "cortar" (registra el próximo pero corta la
//                                 respuesta) | "caido" (503 hasta volver a normal)
//   GET  /__simular/comprobantes  lo emitido
//   GET  /__simular               (en el navegador) lo emitido y botones para que falle
//   POST /__simular/olvidar-ta    como si hubieran pasado 12 horas
//   POST /__simular/reiniciar     ARCA vacío (sin comprobantes ni tickets)

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import forge from "node-forge";

const PUERTO = Number(process.env.ARCA_SIMULADO_PUERTO ?? 8532);
const comprobantes = new Map(); // "cuit-ptoVta-tipo" → [{...}]
const tickets = new Map(); // token → {sign, cuit, expira, dn}
let modo = "normal";

const etiqueta = (xml, tag) => {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`).exec(xml ?? "");
  return m ? m[1] : null;
};
const num = (xml, tag) => Number(etiqueta(xml, tag));
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()).replaceAll("-", "");
const masDias = (aaaammdd, dias) => {
  const d = new Date(`${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
};

const LETRA = { 1: "A", 3: "A", 6: "B", 8: "B", 11: "C", 13: "C" };
const NC = new Set([3, 8, 13]);
// Qué condición IVA del receptor admite cada letra (tabla de ARCA).
const COND_A = new Set([1, 6, 13, 16]);
const COND_B = new Set([4, 5, 7, 8, 9, 10, 15]);

const leerCuerpo = (req) =>
  new Promise((ok) => {
    let t = "";
    req.on("data", (c) => (t += c));
    req.on("end", () => ok(t));
  });

const sobre = (cuerpo) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${cuerpo}</soap:Body></soap:Envelope>`;
const fault = (res, texto, status = 500) => {
  res.writeHead(status, { "Content-Type": "text/xml; charset=utf-8" });
  res.end(sobre(`<soap:Fault><faultcode>soap:Server</faultcode><faultstring>${esc(texto)}</faultstring></soap:Fault>`));
};
const responder = (res, cuerpo) => {
  res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
  res.end(sobre(cuerpo));
};
const errores = (lista) => (lista.length ? `<Errors>${lista.map(([c, m]) => `<Err><Code>${c}</Code><Msg>${esc(m)}</Msg></Err>`).join("")}</Errors>` : "");

// ── WSAA ────────────────────────────────────────────────────────────
const loginCms = (xml, res) => {
  const cms = etiqueta(xml, "in0");
  let tra, cert;
  try {
    // El CMS trae adentro el pedido (TRA), el certificado y la firma.
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(cms)));
    // content: [0] { OCTET STRING } (a veces en pedazos).
    const octetos = p7.rawCapture.content.value[0];
    const bytes = Array.isArray(octetos.value) ? octetos.value.map((x) => x.value).join("") : octetos.value;
    tra = forge.util.decodeUtf8(bytes);
    cert = p7.certificates?.[0];
    if (!p7.rawCapture?.signerInfos?.length) throw new Error("sin firma");
  } catch {
    return fault(res, "ns1:cms.bad: El CMS no es valido");
  }
  if (!cert) return fault(res, "ns1:cms.cert.notFound: No se encontro certificado en el CMS");
  if (!/<service>wsfe<\/service>/.test(tra ?? "")) return fault(res, "ns1:coe.notAuthorized: Servicio no autorizado");
  const exp = Date.parse(etiqueta(tra, "expirationTime") ?? "");
  const gen = Date.parse(etiqueta(tra, "generationTime") ?? "");
  if (!(gen < Date.now() && exp > Date.now())) return fault(res, "ns1:xml.generationTime.invalid: fechas del TRA invalidas");
  const dn = cert.subject.attributes.map((a) => `${a.shortName ?? a.name}=${a.value}`).join(",");
  const cuit = (cert.subject.getField({ name: "serialNumber" })?.value ?? "").replace(/\D/g, "");
  for (const t of tickets.values()) {
    if (t.dn === dn && t.expira > Date.now()) return fault(res, "ns1:coe.alreadyAuthenticated: El CEE ya posee un TA valido para el acceso al WSN solicitado");
  }
  const token = randomBytes(24).toString("base64");
  const sign = randomBytes(24).toString("base64");
  const expira = Date.now() + 12 * 3600e3;
  tickets.set(token, { sign, cuit, expira, dn });
  const ta =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><loginTicketResponse version="1.0"><header><source>CN=wsaahomo, O=AFIP, C=AR</source>` +
    `<destination>${esc(dn)}</destination><uniqueId>${Date.now()}</uniqueId><generationTime>${new Date().toISOString()}</generationTime>` +
    `<expirationTime>${new Date(expira).toISOString()}</expirationTime></header><credentials><token>${token}</token><sign>${sign}</sign></credentials></loginTicketResponse>`;
  responder(res, `<ns1:loginCmsResponse xmlns:ns1="http://wsaa.view.sua.dvadac.desein.afip.gov"><ns1:loginCmsReturn>${esc(ta)}</ns1:loginCmsReturn></ns1:loginCmsResponse>`);
};

// ── WSFEv1 ──────────────────────────────────────────────────────────
const validarAuth = (xml) => {
  const a = etiqueta(xml, "Auth") ?? "";
  const t = tickets.get(etiqueta(a, "Token"));
  if (!t || t.sign !== etiqueta(a, "Sign") || t.expira < Date.now()) return [[600, "ValidacionDeToken: No validaron las credenciales"]];
  if (t.cuit && t.cuit !== etiqueta(a, "Cuit")) return [[600, "ValidacionDeToken: No aparecio CUIT en lista de relaciones"]];
  return [];
};
const lista = (cuit, ptoVta, tipo) => {
  const k = `${cuit}-${ptoVta}-${tipo}`;
  if (!comprobantes.has(k)) comprobantes.set(k, []);
  return comprobantes.get(k);
};

const solicitar = (xml, res, req) => {
  const cuit = etiqueta(etiqueta(xml, "Auth"), "Cuit");
  const cab = etiqueta(xml, "FeCabReq");
  const det = etiqueta(xml, "FECAEDetRequest");
  const ptoVta = num(cab, "PtoVta");
  const tipo = num(cab, "CbteTipo");
  const desde = num(det, "CbteDesde");
  const cbtes = lista(cuit, ptoVta, tipo);
  const obs = [];
  const errs = [];
  const letra = LETRA[tipo];
  const total = num(det, "ImpTotal");
  const neto = num(det, "ImpNeto");
  const iva = num(det, "ImpIVA");
  const docTipo = num(det, "DocTipo");
  const cond = etiqueta(det, "CondicionIVAReceptorId");
  const ivaXml = etiqueta(det, "Iva");
  const fecha = etiqueta(det, "CbteFch");

  if (!letra) errs.push([10007, "El tipo de comprobante no es valido"]);
  if (desde !== cbtes.length + 1) errs.push([10016, `El numero o fecha del comprobante no se corresponde con el proximo a autorizar. Consultar metodo FECompUltimoAutorizado. Proximo: ${cbtes.length + 1}`]);
  if (!cond) obs.push([10242, "El campo Condicion Frente al IVA del receptor es obligatorio"]);
  else if (letra === "A" && !COND_A.has(Number(cond))) obs.push([10243, "La Condicion IVA del receptor no es valida para comprobantes clase A"]);
  else if (letra === "B" && !COND_B.has(Number(cond))) obs.push([10243, "La Condicion IVA del receptor no es valida para comprobantes clase B"]);
  if (letra === "A" && docTipo !== 80) obs.push([10013, "Para comprobantes clase A el DocTipo debe ser 80 (CUIT)"]);
  if (letra === "C" && (ivaXml || iva !== 0)) obs.push([10071, "Para comprobantes tipo C el objeto IVA no debe informarse"]);
  if ((letra === "A" || letra === "B") && !ivaXml) obs.push([10070, "Si ImpNeto es mayor a 0 el objeto IVA es obligatorio"]);
  if (ivaXml) {
    const base = num(ivaXml, "BaseImp");
    const imp = num(ivaXml, "Importe");
    if (Math.abs(base * 0.21 - imp) > 0.01 + 1e-9) obs.push([10051, "El importe de IVA no se corresponde con la alicuota"]);
    if (Math.abs(base - neto) > 0.001 || Math.abs(imp - iva) > 0.001) obs.push([10018, "La suma de las bases imponibles no coincide con ImpNeto/ImpIVA"]);
  }
  if (Math.abs(neto + iva + num(det, "ImpTrib") + num(det, "ImpOpEx") + num(det, "ImpTotConc") - total) > 0.001) obs.push([10048, "El ImpTotal no es la suma de los importes"]);
  if (docTipo === 99 && total >= 10_000_000) obs.push([10015, "Para montos iguales o superiores a $10.000.000 se debe identificar al receptor"]);
  // Productos: hasta 5 días antes o después de hoy.
  const aFecha = (s) => Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00Z`);
  if (!/^\d{8}$/.test(fecha ?? "") || Math.abs(aFecha(fecha) - aFecha(hoy())) > 5 * 864e5) obs.push([10036, "La fecha del comprobante esta fuera de rango"]);
  if (NC.has(tipo)) {
    const asoc = etiqueta(det, "CbteAsoc");
    if (!asoc) obs.push([10040, "Las notas de credito deben informar el comprobante asociado"]);
    else {
      const orig = lista(etiqueta(asoc, "Cuit"), num(asoc, "PtoVta"), num(asoc, "Tipo"))[num(asoc, "Nro") - 1];
      if (!orig) obs.push([10041, "El comprobante asociado no existe"]);
    }
  }
  if (modo === "rechazar") {
    obs.push([10000, "Rechazo de prueba (ARCA simulado)"]);
    modo = "normal";
  }

  const rechazado = errs.length || obs.length;
  let cae = null;
  let vto = null;
  if (!rechazado) {
    cae = `7${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`;
    vto = masDias(fecha, 10);
    cbtes.push({ numero: desde, fecha, total, docTipo, docNro: num(det, "DocNro"), cae, vto, cond: Number(cond) });
  }
  // "cortar": ARCA lo registró, pero la respuesta no llega.
  if (modo === "cortar" && !rechazado) {
    modo = "normal";
    req.socket.destroy();
    return;
  }
  const r = rechazado ? "R" : "A";
  responder(
    res,
    `<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Cuit>${cuit}</Cuit><PtoVta>${ptoVta}</PtoVta><CbteTipo>${tipo}</CbteTipo><FchProceso>${hoy()}</FchProceso><CantReg>1</CantReg><Resultado>${r}</Resultado><Reproceso>N</Reproceso></FeCabResp>` +
      `<FeDetResp><FECAEDetResponse><Concepto>1</Concepto><DocTipo>${docTipo}</DocTipo><DocNro>${num(det, "DocNro")}</DocNro><CbteDesde>${desde}</CbteDesde><CbteHasta>${desde}</CbteHasta><CbteFch>${fecha}</CbteFch><Resultado>${r}</Resultado>` +
      (obs.length ? `<Observaciones>${obs.map(([c, m]) => `<Obs><Code>${c}</Code><Msg>${esc(m)}</Msg></Obs>`).join("")}</Observaciones>` : "") +
      `<CAE>${cae ?? ""}</CAE><CAEFchVto>${vto ?? ""}</CAEFchVto></FECAEDetResponse></FeDetResp>${errores(errs)}</FECAESolicitarResult></FECAESolicitarResponse>`,
  );
};

const wsfe = async (req, res) => {
  const xml = await leerCuerpo(req);
  const accion = String(req.headers.soapaction ?? "").replace(/"/g, "").split("/").pop();
  if (modo === "caido") return fault(res, "Service Unavailable", 503);
  if (accion === "FEDummy") {
    return responder(res, `<FEDummyResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FEDummyResult><AppServer>OK</AppServer><DbServer>OK</DbServer><AuthServer>OK</AuthServer></FEDummyResult></FEDummyResponse>`);
  }
  const errs = validarAuth(xml);
  if (errs.length) return responder(res, `<${accion}Response xmlns="http://ar.gov.afip.dif.FEV1/"><${accion}Result>${errores(errs)}</${accion}Result></${accion}Response>`);
  const cuit = etiqueta(etiqueta(xml, "Auth"), "Cuit");
  if (accion === "FECompUltimoAutorizado") {
    const ptoVta = num(xml, "PtoVta");
    const tipo = num(xml, "CbteTipo");
    return responder(
      res,
      `<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>${ptoVta}</PtoVta><CbteTipo>${tipo}</CbteTipo><CbteNro>${lista(cuit, ptoVta, tipo).length}</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`,
    );
  }
  if (accion === "FECompConsultar") {
    const q = etiqueta(xml, "FeCompConsReq");
    const c = lista(cuit, num(q, "PtoVta"), num(q, "CbteTipo"))[num(q, "CbteNro") - 1];
    const cuerpo = c
      ? `<ResultGet><Concepto>1</Concepto><DocTipo>${c.docTipo}</DocTipo><DocNro>${c.docNro}</DocNro><CbteDesde>${c.numero}</CbteDesde><CbteHasta>${c.numero}</CbteHasta><CbteFch>${c.fecha}</CbteFch><ImpTotal>${c.total}</ImpTotal><CodAutorizacion>${c.cae}</CodAutorizacion><EmisionTipo>CAE</EmisionTipo><FchVto>${c.vto}</FchVto><Resultado>A</Resultado></ResultGet>`
      : errores([[602, "No existen datos en nuestros registros para los parametros ingresados"]]);
    return responder(res, `<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult>${cuerpo}</FECompConsultarResult></FECompConsultarResponse>`);
  }
  if (accion === "FECAESolicitar") return solicitar(xml, res, req);
  return fault(res, `Metodo no soportado por el simulador: ${accion}`);
};

const json = (res, status, cuerpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
  if (req.method === "POST" && url.pathname === "/ws/services/LoginCms") {
    if (modo === "caido") return fault(res, "Service Unavailable", 503);
    return loginCms(await leerCuerpo(req), res);
  }
  if (req.method === "POST" && url.pathname === "/wsfev1/service.asmx") return wsfe(req, res);
  if (req.method === "POST" && url.pathname === "/__simular/modo") {
    modo = JSON.parse((await leerCuerpo(req)) || "{}").modo ?? "normal";
    return json(res, 200, { modo });
  }
  if (req.method === "POST" && url.pathname === "/__simular/olvidar-ta") {
    tickets.clear();
    return json(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/__simular/reiniciar") {
    tickets.clear();
    comprobantes.clear();
    modo = "normal";
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname === "/__simular/comprobantes") return json(res, 200, Object.fromEntries(comprobantes));
  // Para probar a mano: lo emitido y botones para que ARCA falle.
  if (req.method === "GET" && url.pathname === "/__simular") {
    const filas = [...comprobantes.entries()]
      .flatMap(([k, lista]) => lista.map((c) => `<tr><td>${esc(k)}</td><td>${c.numero}</td><td>${c.fecha}</td><td>$ ${c.total}</td><td>${c.cae}</td></tr>`))
      .join("");
    const boton = (m, t) => `<form method="post" action="__simular/modo-form" style="display:inline"><input type="hidden" name="modo" value="${m}"><button>${t}</button></form> `;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ARCA simulado</title>` +
        `<body style="font-family:system-ui;padding:16px"><h1>ARCA simulado</h1><p>Solo en la compu. Ahora: <b>${modo}</b></p><p>` +
        boton("rechazar", "Rechazar la próxima") +
        boton("cortar", "Cortar la respuesta de la próxima") +
        boton("caido", "ARCA caído") +
        boton("normal", "Normal") +
        `</p><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>CUIT-pto-tipo</th><th>N.º</th><th>Fecha</th><th>Total</th><th>CAE</th></tr>${filas || '<tr><td colspan="5">Nada emitido todavía.</td></tr>'}</table></body></html>`,
    );
  }
  if (req.method === "POST" && url.pathname === "/__simular/modo-form") {
    modo = new URLSearchParams(await leerCuerpo(req)).get("modo") ?? "normal";
    // Relativo: anda igual directo (127.0.0.1:8532) que por la tienda (/__arca).
    res.writeHead(303, { Location: "../__simular" });
    return res.end();
  }
  json(res, 404, { message: "not found" });
}).listen(PUERTO, "127.0.0.1", () => console.log(`ARCA simulado en http://127.0.0.1:${PUERTO}`));
