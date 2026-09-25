import process from "node:process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import forge from "node-forge";
import { defineSecret } from "firebase-functions/params";
import { db } from "../firebase.js";
import {
  ErrorFactura,
  ERRORES_TEMPORALES,
  leerCAE,
  leerConsulta,
  leerDummy,
  leerErrores,
  leerFault,
  leerTA,
  leerUltimo,
  soapLoginCms,
  textoErrores,
  traXml,
  xmlConsultar,
  xmlDummy,
  xmlSolicitar,
  xmlUltimo,
} from "./logica.js";

// El certificado de ARCA y su clave privada viven en Secret Manager, nunca en
// el código ni en la base. Hasta tenerlos se carga SIN-CONFIGURAR.
//   npx firebase functions:secrets:set ARCA_CERT --data-file certificado.crt
//   npx firebase functions:secrets:set ARCA_KEY  --data-file datos/arca/clave-privada.key
export const ARCA_CERT = defineSecret("ARCA_CERT");
export const ARCA_KEY = defineSecret("ARCA_KEY");

// PEM tal cual, o en base64 (así lo guarda el emulador, en una sola línea).
const pem = (v) => {
  const t = (v ?? "").trim();
  if (!t || t === "SIN-CONFIGURAR") return null;
  return t.includes("-----BEGIN") ? t : Buffer.from(t, "base64").toString("utf8");
};
export const hayCertificado = () => Boolean(pem(ARCA_CERT.value()) && pem(ARCA_KEY.value()));

// En el emulador se habla con el ARCA simulado (scripts/arca-simulado.mjs).
const emulador = process.env.FUNCTIONS_EMULATOR === "true";
const URLS = {
  homologacion: { wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms", wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx" },
  produccion: { wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms", wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx" },
};
const urls = (ambiente) => {
  if (emulador && process.env.ARCA_WSAA_URL) return { wsaa: process.env.ARCA_WSAA_URL, wsfe: process.env.ARCA_WSFE_URL };
  const u = URLS[ambiente];
  if (!u) throw new ErrorFactura("Falta elegir el ambiente de ARCA (homologación o producción).");
  return u;
};

const enviar = async (url, xml, accion) => {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: accion },
      body: xml,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const motivo = err?.name === "TimeoutError" ? "tardó demasiado" : "no se pudo conectar";
    // No se sabe si llegó: quien llama decide si eso importa.
    throw new ErrorFactura(`ARCA no respondió (${motivo}). Se reintenta.`, { temporal: true, incierto: true });
  }
  const texto = await res.text().catch(() => "");
  if (res.status >= 500 && !texto.includes("faultstring")) {
    throw new ErrorFactura(`ARCA respondió con un error (${res.status}). Se reintenta.`, { temporal: true, incierto: true });
  }
  return texto;
};

// ── WSAA: el ticket de acceso ───────────────────────────────────────
// Se firma el pedido (TRA) con el certificado, como CMS/PKCS#7 con SHA-256.
const firmar = (tra, certPem, keyPem) => {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
};

// El ticket dura ~12 horas y ARCA no da otro mientras esté vigente: se
// guarda en la base (sistema/, que nadie lee desde afuera) y se reusa.
export const obtenerTA = async (ambiente) => {
  const certPem = pem(ARCA_CERT.value());
  const keyPem = pem(ARCA_KEY.value());
  if (!certPem || !keyPem) {
    throw new ErrorFactura("Falta el certificado de ARCA en el servidor. Mirá el LEEME, «Facturar con ARCA».");
  }
  const huella = createHash("sha256").update(certPem).digest("hex").slice(0, 16);
  const ref = db.collection("sistema").doc(`arca-ta-${ambiente}`);
  const guardado = (await ref.get()).data();
  if (guardado?.huella === huella && guardado.expira > Date.now() + 10 * 60e3) return guardado;

  let cms;
  try {
    cms = firmar(traXml("wsfe"), certPem, keyPem);
  } catch {
    throw new ErrorFactura("El certificado o la clave de ARCA no son válidos, o no son pareja.");
  }
  const ta = leerTA(await enviar(urls(ambiente).wsaa, soapLoginCms(cms), ""));
  if (ta.fault) {
    if (/alreadyAuthenticated/i.test(ta.fault)) {
      throw new ErrorFactura("ARCA todavía tiene vigente un acceso anterior de este certificado (dura hasta 12 horas). Se reintenta solo.", { temporal: true });
    }
    throw new ErrorFactura(`ARCA no aceptó el certificado: ${ta.fault}`);
  }
  const nuevo = { token: ta.token, sign: ta.sign, expira: ta.expira, huella, ambiente, obtenido: Date.now() };
  await ref.set(nuevo);
  return nuevo;
};

// ── WSFEv1 ──────────────────────────────────────────────────────────
const wsfe = async (ambiente, metodo, xml) => {
  const texto = await enviar(urls(ambiente).wsfe, xml, `http://ar.gov.afip.dif.FEV1/${metodo}`);
  const fault = leerFault(texto);
  if (fault) throw new ErrorFactura(`ARCA: ${fault}`, { temporal: true, incierto: true });
  return texto;
};

const credenciales = (ta, conf) => ({ token: ta.token, sign: ta.sign, cuit: conf.cuit });

const siHayErrores = (errores) => {
  if (errores.length) throw new ErrorFactura(`ARCA: ${textoErrores(errores)}`, { temporal: errores.some((e) => ERRORES_TEMPORALES.has(e.codigo)) });
};

export const estadoServidores = async (ambiente) => leerDummy(await wsfe(ambiente, "FEDummy", xmlDummy()));

export const ultimoAutorizado = async (conf, ta, tipo) => {
  const r = leerUltimo(await wsfe(conf.ambiente, "FECompUltimoAutorizado", xmlUltimo(credenciales(ta, conf), conf.ptoVta, tipo)));
  siHayErrores(r.errores);
  if (!Number.isInteger(r.numero)) throw new ErrorFactura("ARCA no devolvió el último número de comprobante.", { temporal: true });
  return r.numero;
};

export const consultarComprobante = async (conf, ta, tipo, numero) => {
  const xml = await wsfe(conf.ambiente, "FECompConsultar", xmlConsultar(credenciales(ta, conf), conf.ptoVta, tipo, numero));
  const r = leerConsulta(xml);
  if (!r && !leerErrores(xml).length) throw new ErrorFactura("ARCA no respondió la consulta.", { temporal: true });
  return r;
};

// Pide el CAE. Si la respuesta se corta, no se sabe si ARCA lo registró:
// el error sale "incierto" y el reintento lo averigua antes de emitir otro.
export const solicitarCAE = async (conf, ta, comp, numero) => {
  const r = leerCAE(await wsfe(conf.ambiente, "FECAESolicitar", xmlSolicitar(credenciales(ta, conf), comp, numero)));
  if (r.resultado === "A" && r.cae) return r;
  const problemas = [...r.observaciones, ...r.errores];
  throw new ErrorFactura(`ARCA rechazó el comprobante: ${textoErrores(problemas) || "sin detalle"}`, {
    temporal: problemas.some((e) => ERRORES_TEMPORALES.has(e.codigo)),
  });
};
