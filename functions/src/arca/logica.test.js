import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  armarComprobante,
  coincide,
  ErrorFactura,
  fechaArca,
  importes,
  leerCAE,
  leerConsulta,
  leerErrores,
  leerTA,
  leerUltimo,
  numeroTexto,
  receptorArca,
  tipoComprobante,
  traXml,
  urlQR,
  xmlSolicitar,
} from "./logica.js";
import { cuitValido, sanearFiscal, validarFiscal } from "../compartido/fiscal.js";

describe("qué comprobante corresponde", () => {
  it("monotributo: siempre C", () => {
    expect(tipoComprobante("monotributo", "consumidor_final")).toBe(11);
    expect(tipoComprobante("monotributo", "responsable_inscripto")).toBe(11);
  });
  it("responsable inscripto: A a inscriptos y monotributistas, B al resto", () => {
    expect(tipoComprobante("responsable_inscripto", "responsable_inscripto")).toBe(1);
    expect(tipoComprobante("responsable_inscripto", "monotributo")).toBe(1);
    expect(tipoComprobante("responsable_inscripto", "consumidor_final")).toBe(6);
    expect(tipoComprobante("responsable_inscripto", "exento")).toBe(6);
  });
  it("sin la condición del negocio: no factura", () => {
    expect(() => tipoComprobante(undefined, "consumidor_final")).toThrow(ErrorFactura);
  });
});

describe("importes", () => {
  it("C: todo es neto, sin IVA", () => {
    expect(importes(45300, "C")).toEqual({ total: 45300, neto: 45300, iva: 0 });
  });
  it("A y B: el 21 % está adentro del precio y cierra al centavo", () => {
    const i = importes(45300, "B");
    expect(i.neto).toBe(37438.02);
    expect(i.iva).toBe(7861.98);
    expect(Math.round((i.neto + i.iva) * 100)).toBe(4530000);
  });
  it("$0 no se factura", () => {
    expect(() => importes(0, "C")).toThrow(ErrorFactura);
  });
});

describe("quién recibe", () => {
  it("consumidor final sin datos: 99 / 0 / condición 5", () => {
    expect(receptorArca({ condicion: "consumidor_final" }, 50000)).toMatchObject({ DocTipo: 99, DocNro: 0, CondicionIVAReceptorId: 5 });
  });
  it("con CUIT: 80 y la condición que eligió", () => {
    expect(receptorArca({ condicion: "monotributo", cuit: "20123456786", nombre: "Ana" }, 1)).toMatchObject({ DocTipo: 80, DocNro: 20123456786, CondicionIVAReceptorId: 6 });
  });
  it("desde $10.000.000 hay que identificar al consumidor final", () => {
    expect(() => receptorArca({ condicion: "consumidor_final" }, 10_000_000)).toThrow(/10\.000\.000/);
    expect(receptorArca({ condicion: "consumidor_final", dni: "30123456", nombre: "Ana" }, 10_000_000)).toMatchObject({ DocTipo: 96, DocNro: 30123456 });
  });
  it("inscripto sin CUIT: no se puede", () => {
    expect(() => receptorArca({ condicion: "responsable_inscripto" }, 1000)).toThrow(/CUIT/);
  });
});

describe("CUIT y datos fiscales", () => {
  it("dígito verificador", () => {
    expect(cuitValido("20-12345678-6")).toBe(true);
    expect(cuitValido("20123456787")).toBe(false);
    expect(cuitValido("2012345678")).toBe(false);
  });
  it("consumidor final sin datos no guarda nada de más", () => {
    expect(sanearFiscal({ condicion: "consumidor_final", nombre: "Ana" })).toEqual({ condicion: "consumidor_final", cuit: "", dni: "", nombre: "" });
    expect(sanearFiscal({ condicion: "inventada" }).condicion).toBe("consumidor_final");
  });
  it("con CUIT pide número válido y razón social", () => {
    expect(validarFiscal(sanearFiscal({ condicion: "monotributo", cuit: "123" }))).toMatchObject({ cuit: expect.any(String), razon_social: expect.any(String) });
    expect(validarFiscal(sanearFiscal({ condicion: "monotributo", cuit: "20-12345678-6", nombre: "Ana SRL" }))).toEqual({});
  });
});

describe("el comprobante para ARCA", () => {
  const cf = receptorArca({ condicion: "consumidor_final" }, 45300);
  it("C sin IVA; B con el IVA discriminado", () => {
    const c = armarComprobante({ tipo: 11, ptoVta: 3, fecha: "20260924", total: 45300, receptor: cf });
    expect(c.Iva).toBeNull();
    expect(c.ImpNeto).toBe(45300);
    const b = armarComprobante({ tipo: 6, ptoVta: 3, fecha: "20260924", total: 45300, receptor: cf });
    expect(b.Iva).toEqual([{ Id: 5, BaseImp: 37438.02, Importe: 7861.98 }]);
  });
  it("el XML lleva los campos en el orden del esquema, con la condición del receptor", () => {
    const c = armarComprobante({
      tipo: 13,
      ptoVta: 3,
      fecha: "20260924",
      total: 100,
      receptor: cf,
      asociado: { Tipo: 11, PtoVta: 3, Nro: 7, Cuit: 20123456786, CbteFch: "20260920" },
    });
    const x = xmlSolicitar({ token: "t", sign: "s", cuit: 20123456786 }, c, 8);
    const orden = ["CbteDesde", "CbteFch", "ImpTotal", "ImpIVA", "MonId", "MonCotiz", "CondicionIVAReceptorId", "CbtesAsoc"].map((t) => x.indexOf(`<ar:${t}>`));
    expect(orden.every((v, i) => v > 0 && (i === 0 || v > orden[i - 1]))).toBe(true);
    expect(x).toContain("<ar:CbteDesde>8</ar:CbteDesde>");
    expect(x).toContain("<ar:ImpTotal>100.00</ar:ImpTotal>");
  });
  it("coincide: mismo total y mismo receptor", () => {
    const c = armarComprobante({ tipo: 11, ptoVta: 3, fecha: "20260924", total: 45300, receptor: cf });
    expect(coincide({ ImpTotal: 45300, DocTipo: 99, DocNro: 0 }, c)).toBe(true);
    expect(coincide({ ImpTotal: 45301, DocTipo: 99, DocNro: 0 }, c)).toBe(false);
    expect(coincide(null, c)).toBe(false);
  });
});

describe("fechas, números y QR", () => {
  it("la fecha es la de Argentina", () => {
    expect(fechaArca(new Date("2026-10-01T01:30:00Z"))).toBe("20260930");
  });
  it("número con punto de venta", () => {
    expect(numeroTexto(3, 12)).toBe("00003-00000012");
  });
  it("QR: la dirección de ARCA con los datos en base64", () => {
    const url = urlQR({ fecha: "20260924", cuit: "20123456786", ptoVta: 3, tipo: 11, numero: 12, total: 45300, docTipo: 99, docNro: 0, cae: "76123456789012" });
    expect(url.startsWith("https://www.arca.gob.ar/fe/qr/?p=")).toBe(true);
    const datos = JSON.parse(Buffer.from(url.split("?p=")[1], "base64").toString());
    expect(datos).toMatchObject({ ver: 1, fecha: "2026-09-24", cuit: 20123456786, tipoCmp: 11, nroCmp: 12, importe: 45300, tipoCodAut: "E", codAut: 76123456789012 });
    expect(datos.tipoDocRec).toBeUndefined();
  });
  it("el pedido de acceso vence a los 10 minutos", () => {
    const t = traXml("wsfe", new Date("2026-09-24T12:00:00Z"));
    expect(t).toContain("<service>wsfe</service>");
    expect(t).toContain("<expirationTime>2026-09-24T12:10:00Z</expirationTime>");
  });
});

describe("leer las respuestas de ARCA", () => {
  it("ticket de acceso (viene escapado adentro del SOAP)", () => {
    const xml = `<soapenv:Envelope><soapenv:Body><ns1:loginCmsResponse><ns1:loginCmsReturn>&lt;loginTicketResponse&gt;&lt;header&gt;&lt;expirationTime&gt;2026-09-25T00:00:00-03:00&lt;/expirationTime&gt;&lt;/header&gt;&lt;credentials&gt;&lt;token&gt;TOK&lt;/token&gt;&lt;sign&gt;SIG&lt;/sign&gt;&lt;/credentials&gt;&lt;/loginTicketResponse&gt;</ns1:loginCmsReturn></ns1:loginCmsResponse></soapenv:Body></soapenv:Envelope>`;
    expect(leerTA(xml)).toMatchObject({ token: "TOK", sign: "SIG" });
    expect(leerTA("<soapenv:Fault><faultstring>ns1:coe.alreadyAuthenticated</faultstring></soapenv:Fault>").fault).toMatch(/alreadyAuthenticated/);
  });
  it("CAE aprobado y rechazado", () => {
    const ok = `<FECAESolicitarResult><FeCabResp><Resultado>A</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CAE>76123456789012</CAE><CAEFchVto>20261004</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult>`;
    expect(leerCAE(ok)).toMatchObject({ resultado: "A", cae: "76123456789012", caeVto: "20261004" });
    const mal = `<FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10242</Code><Msg>Condicion IVA receptor invalida</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp><Errors><Err><Code>10016</Code><Msg>Numero incorrecto</Msg></Err></Errors></FECAESolicitarResult>`;
    const r = leerCAE(mal);
    expect(r.resultado).toBe("R");
    expect(r.observaciones[0].codigo).toBe(10242);
    expect(leerErrores(mal)[0]).toEqual({ codigo: 10016, mensaje: "Numero incorrecto" });
  });
  it("último número y consulta", () => {
    expect(leerUltimo("<FECompUltimoAutorizadoResult><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><CbteNro>41</CbteNro></FECompUltimoAutorizadoResult>").numero).toBe(41);
    const c = leerConsulta("<ResultGet><CbteFch>20260924</CbteFch><ImpTotal>45300</ImpTotal><DocTipo>99</DocTipo><DocNro>0</DocNro><CodAutorizacion>761</CodAutorizacion><FchVto>20261004</FchVto><Resultado>A</Resultado></ResultGet>");
    expect(c).toMatchObject({ ImpTotal: 45300, DocTipo: 99, CodAutorizacion: "761" });
    expect(leerConsulta("<FECompConsultarResult><Errors/></FECompConsultarResult>")).toBeNull();
  });
});
