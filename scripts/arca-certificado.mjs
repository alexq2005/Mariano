// Genera la clave privada y el pedido de certificado (CSR) para facturar
// con ARCA por web service. Sin openssl: anda igual en Windows.
//
//   npm run arca:certificado -- --cuit 20123456786 --nombre "Mariano Pérez"
//
// Deja en datos/arca/ (que NUNCA se sube al repositorio):
//   clave-privada.key   la llave: no se comparte con nadie, ni con ARCA
//   pedido.csr          lo que se sube a ARCA para que dé el certificado
//
// Los pasos que siguen están en el LEEME, «Facturar con ARCA».

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";
import { cuitValido } from "../src/compartido/fiscal.js";

const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const cuit = (arg("cuit") ?? "").replace(/\D/g, "");
const nombre = (arg("nombre") ?? "").trim();
// El "alias" del certificado: con él se lo reconoce en ARCA.
const alias = (arg("alias") ?? "aurora").trim().replace(/[^a-zA-Z0-9-]/g, "") || "aurora";

if (!cuitValido(cuit) || !nombre) {
  console.error('Uso: npm run arca:certificado -- --cuit 20123456786 --nombre "Nombre y apellido o razón social"');
  if (cuit && !cuitValido(cuit)) console.error("Ese CUIT no es válido.");
  process.exit(1);
}
const DIR = "datos/arca";
if (existsSync(`${DIR}/clave-privada.key`) && !process.argv.includes("--reemplazar")) {
  console.error(`Ya hay una clave en ${DIR}/clave-privada.key. Si querés hacer otra (y pedir otro certificado), agregá --reemplazar.`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const csr = forge.pki.createCertificationRequest();
csr.publicKey = forge.pki.publicKeyFromPem(publicKey);
csr.setSubject([
  { name: "countryName", value: "AR" },
  { name: "organizationName", value: nombre },
  { name: "commonName", value: alias },
  { name: "serialNumber", value: `CUIT ${cuit}` },
]);
csr.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

mkdirSync(DIR, { recursive: true });
writeFileSync(`${DIR}/clave-privada.key`, privateKey, { mode: 0o600 });
writeFileSync(`${DIR}/pedido.csr`, forge.pki.certificationRequestToPem(csr));

console.log(`
Listo:
  ${DIR}/clave-privada.key   NO la compartas ni la subas a ningún lado.
  ${DIR}/pedido.csr          esto es lo que se sube a ARCA.

Qué sigue (detalle en el LEEME, «Facturar con ARCA»):
  1. En ARCA, con la clave fiscal del CUIT ${cuit}: «Administración de
     Certificados Digitales» → agregar alias "${alias}" → subir pedido.csr →
     descargar el certificado (.crt). Para probar primero: «WSASS -
     Autogestión Certificados Homologación».
  2. «Administrador de Relaciones de Clave Fiscal» → nueva relación → servicio
     «Facturación electrónica» (wsfe) → representante: el certificado "${alias}".
  3. Cargarlos en el servidor:
       npx firebase functions:secrets:set ARCA_CERT --data-file certificado.crt
       npx firebase functions:secrets:set ARCA_KEY --data-file ${DIR}/clave-privada.key
       npm run desplegar
`);
