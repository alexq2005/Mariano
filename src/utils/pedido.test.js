import { describe, expect, it } from "vitest";
import { DATOS_VACIOS, numeroWhatsAppValido, sanearDatos, urlWhatsApp, validarDatos } from "./pedido";

const C = {
  nombre_negocio: "Aurora",
  whatsapp: "5491145678901",
  minimo_mayor: 12,
  pedido_minimo: 0,
  actualizado: "septiembre 2026",
  formas_entrega: [
    { id: "retiro", nombre: "Retiro en persona", pide_direccion: false },
    { id: "envio", nombre: "Envío a domicilio", pide_direccion: true },
  ],
  formas_pago: ["Transferencia", "Efectivo", "A convenir"],
};
const completos = { ...DATOS_VACIOS, nombre: " Ana ", telefono: "11 4567-8901", email: "ana@ejemplo.com", entrega: "envio", direccion: "Caballito", pago: "Transferencia" };

describe("validarDatos", () => {
  it("todo vacío: pide nombre, teléfono, email, entrega y pago", () => {
    expect(Object.keys(validarDatos(DATOS_VACIOS, C)).sort()).toEqual(["email", "entrega", "nombre", "pago", "telefono"]);
  });

  it("teléfono y email con formato inválido", () => {
    expect(validarDatos({ ...completos, telefono: "abc" }, C)).toHaveProperty("telefono");
    expect(validarDatos({ ...completos, email: "ana@" }, C)).toHaveProperty("email");
  });

  it("nombre con solo espacios no cuenta", () => {
    expect(validarDatos({ ...completos, nombre: "   " }, C)).toHaveProperty("nombre");
  });

  it("envío sin dirección: la pide; retiro no la necesita", () => {
    expect(validarDatos({ ...completos, direccion: "" }, C)).toHaveProperty("direccion");
    expect(validarDatos({ ...completos, entrega: "retiro", direccion: "" }, C)).toEqual({});
  });

  it("rechaza valores que no están en config (entrega o pago inventados)", () => {
    expect(validarDatos({ ...completos, entrega: "drone" }, C)).toHaveProperty("entrega");
    expect(validarDatos({ ...completos, pago: "Bitcoin" }, C)).toHaveProperty("pago");
  });

  it("completo: sin errores (comentarios es opcional)", () => {
    expect(validarDatos(completos, C)).toEqual({});
  });
});

describe("la config llega por parámetro", () => {
  // Las formas de entrega y de pago vigentes salen de la config que viaja con
  // el catálogo: sin ella tiene que fallar, no validar contra una lista vieja.
  it("sin config falla en vez de usar una escrita en el código", () => {
    expect(() => validarDatos(completos)).toThrow();
    expect(() => sanearDatos(completos)).toThrow();
  });
});

describe("sanearDatos (formulario guardado en sessionStorage)", () => {
  it("campos que no son texto no rompen: quedan vacíos", () => {
    const d = sanearDatos({ nombre: 123, comentarios: {}, direccion: null, entrega: "envio", pago: "Efectivo" }, C);
    expect(d).toEqual({ ...DATOS_VACIOS, entrega: "envio", pago: "Efectivo" });
    expect(() => validarDatos(d, C)).not.toThrow();
  });

  it("descarta claves desconocidas y opciones que ya no están en config", () => {
    const d = sanearDatos({ nombre: "Ana", entrega: "drone", pago: "Bitcoin", hack: "x" }, C);
    expect(d).toEqual({ ...DATOS_VACIOS, nombre: "Ana" });
  });

  it("no recorta espacios mientras se escribe (nombre y apellido)", () => {
    expect(sanearDatos({ nombre: "Ana " }, C).nombre).toBe("Ana ");
  });

  it("null o basura: formulario vacío", () => {
    expect(sanearDatos(null, C)).toEqual(DATOS_VACIOS);
    expect(sanearDatos("texto", C)).toEqual(DATOS_VACIOS);
  });
});

describe("WhatsApp", () => {
  it("valida el formato argentino y rechaza el número de ejemplo", () => {
    expect(numeroWhatsAppValido("5491145678901")).toBe(true);
    expect(numeroWhatsAppValido("5491100000000")).toBe(false);
    expect(numeroWhatsAppValido("+54 9 11 4567-8901")).toBe(false);
    expect(numeroWhatsAppValido("541145678901")).toBe(false);
  });

  it("codifica el texto (saltos de línea, $, # y &)", () => {
    const url = urlWhatsApp("Hola\n#1 & $2", C);
    expect(url).toBe("https://wa.me/5491145678901?text=Hola%0A%231%20%26%20%242");
  });
});
