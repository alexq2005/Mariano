// Facturación electrónica de ARCA: lo que no toca la red ni la base. Qué
// comprobante corresponde, los importes, el QR y los mensajes SOAP que se
// mandan (y cómo se leen las respuestas). Separado para probarlo sin
// emuladores (logica.test.js).
//
// Referencias: Manual del desarrollador WSFEv1 (ARCA), especificación WSAA,
// RG 4892/2020 (QR), RG 5616/2024 (condición IVA del receptor, obligatoria
// desde 09/2026) y RG 5866/2026 (identificar al consumidor final desde
// $10.000.000).

import { Buffer } from "node:buffer";
import { CONDICIONES_FISCALES, cuitConGuiones } from "../compartido/fiscal.js";

export class ErrorFactura extends Error {
  // temporal: se puede reintentar tal cual (ARCA caído, sin conexión).
  // incierto: no se sabe si ARCA llegó a registrar el comprobante.
  constructor(mensaje, { temporal = false, incierto = false } = {}) {
    super(mensaje);
    this.temporal = temporal;
    this.incierto = incierto;
  }
}

// ── Qué comprobante corresponde ─────────────────────────────────────
export const TIPOS = {
  1: { letra: "A", clase: "factura", nombre: "Factura A", codigo: "001" },
  3: { letra: "A", clase: "nc", nombre: "Nota de crédito A", codigo: "003" },
  6: { letra: "B", clase: "factura", nombre: "Factura B", codigo: "006" },
  8: { letra: "B", clase: "nc", nombre: "Nota de crédito B", codigo: "008" },
  11: { letra: "C", clase: "factura", nombre: "Factura C", codigo: "011" },
  13: { letra: "C", clase: "nc", nombre: "Nota de crédito C", codigo: "013" },
};
export const NC_DE = { 1: 3, 6: 8, 11: 13 };

export const CONDICIONES_EMISOR = {
  monotributo: "Responsable Monotributo",
  responsable_inscripto: "IVA Responsable Inscripto",
};

// Monotributo: siempre C. Responsable inscripto: A si quien compra es
// inscripto o monotributista (con CUIT), B para consumidor final o exento.
export const tipoComprobante = (emisor, condicionReceptor) => {
  if (emisor === "monotributo") return 11;
  if (emisor !== "responsable_inscripto") {
    throw new ErrorFactura("Falta la condición del negocio ante el IVA (monotributo o responsable inscripto).");
  }
  return ["responsable_inscripto", "monotributo"].includes(condicionReceptor) ? 1 : 6;
};

// ── Importes ────────────────────────────────────────────────────────
// Los precios de la tienda son finales (con IVA). En A y B se discrimina
// el 21 %; en C no hay IVA que discriminar.
export const ALICUOTA_IVA = { id: 5, porcentaje: 21 };
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const importes = (total, letra) => {
  if (!(total > 0)) throw new ErrorFactura("El comprobante no puede ser de $0.");
  if (letra === "C") return { total: r2(total), neto: r2(total), iva: 0 };
  const neto = r2(total / 1.21);
  return { total: r2(total), neto, iva: r2(total - neto) };
};

// ── Quién recibe la factura ─────────────────────────────────────────
export const UMBRAL_IDENTIFICAR = 10_000_000;

// DocTipo 80 = CUIT, 96 = DNI, 99 = sin identificar (consumidor final).
export const receptorArca = (fiscal, total) => {
  const f = fiscal ?? {};
  const cond = CONDICIONES_FISCALES[f.condicion] ?? CONDICIONES_FISCALES.consumidor_final;
  if (f.cuit) {
    return { DocTipo: 80, DocNro: Number(f.cuit), CondicionIVAReceptorId: cond.arca, nombre: f.nombre ?? "", condicion: cond.nombre, doc: `CUIT ${cuitConGuiones(f.cuit)}` };
  }
  if (f.condicion && f.condicion !== "consumidor_final") {
    throw new ErrorFactura(`Para facturarle a un ${cond.nombre.toLowerCase()} hace falta su CUIT. Cargalo en «Datos para la factura».`);
  }
  if (f.dni) {
    return { DocTipo: 96, DocNro: Number(f.dni), CondicionIVAReceptorId: 5, nombre: f.nombre ?? "", condicion: "Consumidor final", doc: `DNI ${f.dni}` };
  }
  if (total >= UMBRAL_IDENTIFICAR) {
    throw new ErrorFactura("Desde $10.000.000, a consumidor final hay que identificarlo (DNI o CUIT). Cargalo en «Datos para la factura» y reintentá.");
  }
  return { DocTipo: 99, DocNro: 0, CondicionIVAReceptorId: 5, nombre: "", condicion: "Consumidor final", doc: "" };
};

// ── Fechas y números ────────────────────────────────────────────────
const formatoAR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" });

// "20260924", como las pide ARCA (en hora de Argentina).
export const fechaArca = (d) => formatoAR.format(d).replaceAll("-", "");
// "20260924" → Date al mediodía de Argentina (para ordenar y agrupar por mes).
export const fechaDeArca = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00-03:00`);
export const mesDeArca = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}`;

// "00003-00000012"
export const numeroTexto = (ptoVta, numero) => `${String(ptoVta).padStart(5, "0")}-${String(numero).padStart(8, "0")}`;

// ── El comprobante, como lo pide FECAESolicitar ─────────────────────
export const armarComprobante = ({ tipo, ptoVta, fecha, total, receptor, asociado }) => {
  const { letra } = TIPOS[tipo];
  const imp = importes(total, letra);
  return {
    CbteTipo: tipo,
    PtoVta: ptoVta,
    Concepto: 1, // productos
    DocTipo: receptor.DocTipo,
    DocNro: receptor.DocNro,
    CbteFch: fecha,
    ImpTotal: imp.total,
    ImpTotConc: 0,
    ImpNeto: imp.neto,
    ImpOpEx: 0,
    ImpTrib: 0,
    ImpIVA: imp.iva,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: receptor.CondicionIVAReceptorId,
    CbtesAsoc: asociado ? [asociado] : null,
    Iva: letra === "C" ? null : [{ Id: ALICUOTA_IVA.id, BaseImp: imp.neto, Importe: imp.iva }],
  };
};

// ¿Lo que dice ARCA que se registró es este mismo comprobante? (para no
// emitir dos veces si se cortó la respuesta)
export const coincide = (registrado, comp) =>
  Boolean(registrado) &&
  Math.abs(Number(registrado.ImpTotal) - comp.ImpTotal) < 0.01 &&
  Number(registrado.DocTipo) === comp.DocTipo &&
  Number(registrado.DocNro) === comp.DocNro;

// ── QR (RG 4892/2020) ───────────────────────────────────────────────
export const urlQR = ({ fecha, cuit, ptoVta, tipo, numero, total, docTipo, docNro, cae }) => {
  const datos = {
    ver: 1,
    fecha: `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`,
    cuit: Number(cuit),
    ptoVta,
    tipoCmp: tipo,
    nroCmp: numero,
    importe: total,
    moneda: "PES",
    ctz: 1,
    ...(docTipo !== 99 ? { tipoDocRec: docTipo, nroDocRec: docNro } : {}),
    tipoCodAut: "E",
    codAut: Number(cae),
  };
  return `https://www.arca.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(datos)).toString("base64")}`;
};

// ── Mensajes SOAP ───────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
const plata = (n) => Number(n).toFixed(2);

// El pedido de acceso (TRA) que se firma con el certificado.
export const traXml = (servicio, ahora = new Date()) => {
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  return (
    `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${iso(ahora.getTime() - 10 * 60e3)}</generationTime>` +
    `<expirationTime>${iso(ahora.getTime() + 10 * 60e3)}</expirationTime>` +
    `</header><service>${esc(servicio)}</service></loginTicketRequest>`
  );
};

export const soapLoginCms = (cms) =>
  `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
  `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;

const sobreWsfe = (metodo, cuerpo) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">` +
  `<soap:Body><ar:${metodo}>${cuerpo}</ar:${metodo}></soap:Body></soap:Envelope>`;

const auth = ({ token, sign, cuit }) => `<ar:Auth><ar:Token>${esc(token)}</ar:Token><ar:Sign>${esc(sign)}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;

export const xmlDummy = () => sobreWsfe("FEDummy", "");

export const xmlUltimo = (a, ptoVta, tipo) => sobreWsfe("FECompUltimoAutorizado", `${auth(a)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo>`);

export const xmlConsultar = (a, ptoVta, tipo, numero) =>
  sobreWsfe(
    "FECompConsultar",
    `${auth(a)}<ar:FeCompConsReq><ar:CbteTipo>${tipo}</ar:CbteTipo><ar:CbteNro>${numero}</ar:CbteNro><ar:PtoVta>${ptoVta}</ar:PtoVta></ar:FeCompConsReq>`,
  );

// El orden de los campos es el del esquema de ARCA: importa.
export const xmlSolicitar = (a, c, numero) => {
  const asoc = c.CbtesAsoc
    ? `<ar:CbtesAsoc>${c.CbtesAsoc.map(
        (x) => `<ar:CbteAsoc><ar:Tipo>${x.Tipo}</ar:Tipo><ar:PtoVta>${x.PtoVta}</ar:PtoVta><ar:Nro>${x.Nro}</ar:Nro><ar:Cuit>${x.Cuit}</ar:Cuit><ar:CbteFch>${x.CbteFch}</ar:CbteFch></ar:CbteAsoc>`,
      ).join("")}</ar:CbtesAsoc>`
    : "";
  const iva = c.Iva
    ? `<ar:Iva>${c.Iva.map((x) => `<ar:AlicIva><ar:Id>${x.Id}</ar:Id><ar:BaseImp>${plata(x.BaseImp)}</ar:BaseImp><ar:Importe>${plata(x.Importe)}</ar:Importe></ar:AlicIva>`).join("")}</ar:Iva>`
    : "";
  return sobreWsfe(
    "FECAESolicitar",
    `${auth(a)}<ar:FeCAEReq>` +
      `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${c.PtoVta}</ar:PtoVta><ar:CbteTipo>${c.CbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
      `<ar:FeDetReq><ar:FECAEDetRequest>` +
      `<ar:Concepto>${c.Concepto}</ar:Concepto><ar:DocTipo>${c.DocTipo}</ar:DocTipo><ar:DocNro>${c.DocNro}</ar:DocNro>` +
      `<ar:CbteDesde>${numero}</ar:CbteDesde><ar:CbteHasta>${numero}</ar:CbteHasta><ar:CbteFch>${c.CbteFch}</ar:CbteFch>` +
      `<ar:ImpTotal>${plata(c.ImpTotal)}</ar:ImpTotal><ar:ImpTotConc>${plata(c.ImpTotConc)}</ar:ImpTotConc><ar:ImpNeto>${plata(c.ImpNeto)}</ar:ImpNeto>` +
      `<ar:ImpOpEx>${plata(c.ImpOpEx)}</ar:ImpOpEx><ar:ImpTrib>${plata(c.ImpTrib)}</ar:ImpTrib><ar:ImpIVA>${plata(c.ImpIVA)}</ar:ImpIVA>` +
      `<ar:MonId>${c.MonId}</ar:MonId><ar:MonCotiz>${c.MonCotiz}</ar:MonCotiz>` +
      `<ar:CondicionIVAReceptorId>${c.CondicionIVAReceptorId}</ar:CondicionIVAReceptorId>` +
      asoc +
      iva +
      `</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`,
  );
};

// ── Leer las respuestas ─────────────────────────────────────────────
// Sin librería de XML: las respuestas son chicas y de forma fija. Se toleran
// los prefijos de espacio de nombres (soap:, ns1:…).
const patron = (tag) => new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "g");
export const etiqueta = (xml, tag) => {
  const m = patron(tag).exec(xml ?? "");
  return m ? m[1] : null;
};
const todas = (xml, tag) => [...(xml ?? "").matchAll(patron(tag))].map((m) => m[1]);
const desescapar = (s) =>
  String(s ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export const leerFault = (xml) => {
  const f = etiqueta(xml, "faultstring");
  return f === null ? null : desescapar(f).trim();
};

// El ticket de acceso: token y sign, válidos ~12 horas.
export const leerTA = (xml) => {
  const fault = leerFault(xml);
  if (fault) return { fault };
  const ret = etiqueta(xml, "loginCmsReturn");
  if (!ret) return { fault: "Respuesta sin ticket de acceso." };
  const t = desescapar(ret);
  const token = etiqueta(t, "token");
  const sign = etiqueta(t, "sign");
  const expira = Date.parse(etiqueta(t, "expirationTime") ?? "");
  if (!token || !sign || !expira) return { fault: "El ticket de acceso vino incompleto." };
  return { token, sign, expira };
};

const leerLista = (xml, contenedor, item) =>
  todas(etiqueta(xml, contenedor) ?? "", item).map((e) => ({ codigo: Number(etiqueta(e, "Code")), mensaje: desescapar(etiqueta(e, "Msg") ?? "").trim() }));

export const leerErrores = (xml) => leerLista(xml, "Errors", "Err");
export const leerObservaciones = (xml) => leerLista(xml, "Observaciones", "Obs");

export const textoErrores = (lista) => lista.map((e) => `${e.mensaje} (${e.codigo})`).join(" · ");

export const leerUltimo = (xml) => ({ numero: Number(etiqueta(xml, "CbteNro") ?? NaN), errores: leerErrores(xml) });

export const leerCAE = (xml) => {
  const det = etiqueta(xml, "FECAEDetResponse") ?? "";
  return {
    resultado: etiqueta(det, "Resultado") ?? etiqueta(xml, "Resultado"),
    cae: etiqueta(det, "CAE") || null,
    caeVto: etiqueta(det, "CAEFchVto") || null,
    errores: leerErrores(xml),
    observaciones: leerObservaciones(det),
  };
};

export const leerConsulta = (xml) => {
  const r = etiqueta(xml, "ResultGet");
  if (!r) return null;
  return {
    CbteFch: etiqueta(r, "CbteFch"),
    ImpTotal: Number(etiqueta(r, "ImpTotal")),
    DocTipo: Number(etiqueta(r, "DocTipo")),
    DocNro: Number(etiqueta(r, "DocNro")),
    CodAutorizacion: etiqueta(r, "CodAutorizacion"),
    FchVto: etiqueta(r, "FchVto"),
    Resultado: etiqueta(r, "Resultado"),
  };
};

export const leerDummy = (xml) => ({
  app: etiqueta(xml, "AppServer"),
  db: etiqueta(xml, "DbServer"),
  auth: etiqueta(xml, "AuthServer"),
});

// Errores de ARCA que se arreglan solos reintentando: el número ya lo
// usó otro comprobante (10016) o el servicio está saturado.
export const ERRORES_TEMPORALES = new Set([10016, 500, 501, 502]);
