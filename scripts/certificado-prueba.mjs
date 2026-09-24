// Un certificado de mentira (autofirmado) para firmar el acceso al ARCA
// simulado en los emuladores. No sirve para ARCA de verdad: ese lo da ARCA
// (ver scripts/arca-certificado.mjs y el LEEME).

import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

// El CUIT de prueba que usan los emuladores (dígito verificador correcto).
export const CUIT_PRUEBA = "20111111112";

export const certificadoDePrueba = (cuit = CUIT_PRUEBA) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 864e5);
  cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 864e5);
  const sujeto = [
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: "Aurora (prueba)" },
    { name: "commonName", value: "aurora-emulador" },
    { name: "serialNumber", value: `CUIT ${cuit}` },
  ];
  cert.setSubject(sujeto);
  cert.setIssuer(sujeto);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
  return { certificado: forge.pki.certificateToPem(cert), clave: privateKey };
};
