import { describe, expect, it } from "vitest";
import { armarMensaje, DATOS_VACIOS, numeroWhatsAppValido, sanearDatos, urlWhatsApp, validarDatos } from "./pedido";
import { resumirCarrito } from "./precios";

const C = {
  nombre_negocio: "Aurora",
  whatsapp: "5491145678901",
  tipo_cambio: 1000,
  factor_importacion: 2.5,
  margen_menor: 2.5,
  margen_mayor: 1.8,
  minimo_mayor: 12,
  pedido_minimo: 0,
  redondeo: 100,
  actualizado: "septiembre 2026",
  formas_entrega: [
    { id: "retiro", nombre: "Retiro en persona", pide_direccion: false },
    { id: "envio", nombre: "Envío a domicilio", pide_direccion: true },
  ],
  formas_pago: ["Transferencia", "Efectivo", "A convenir"],
};
// Los productos llegan con los precios ya calculados (0,4 y 1,2 USD).
const porId = new Map(Object.entries({
  L1: { id: "L1", cod: "ZMA-20045", nom: "Lápiz labial /48", menor: 3000, mayor: 2200 },
  S1: { id: "S1", cod: "ZMA-CQK-5002", nom: "Sérum de seda", menor: 9000, mayor: 6600 },
}));
const resumen = resumirCarrito([{ id: "L1", cant: 12 }, { id: "S1", cant: 1 }], porId, C);
const completos = { ...DATOS_VACIOS, nombre: " Ana ", entrega: "envio", direccion: "Caballito", pago: "Transferencia" };

describe("validarDatos", () => {
  it("todo vacío: pide nombre, entrega y pago", () => {
    expect(Object.keys(validarDatos(DATOS_VACIOS, C)).sort()).toEqual(["entrega", "nombre", "pago"]);
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
    expect(() => armarMensaje(resumen, completos)).toThrow();
    expect(() => sanearDatos(completos)).toThrow();
  });
});

describe("armarMensaje", () => {
  const m = armarMensaje(resumen, { ...completos, comentarios: "Tocar timbre 2B" }, C);

  it("lista numerada con cantidad, nombre, código, precio c/u y subtotal", () => {
    expect(m).toContain("1) 12 u. x Lápiz labial /48 (ZMA-20045)");
    expect(m).toContain("$2.200 c/u (por mayor) = $26.400");
    expect(m).toContain("2) 1 u. x Sérum de seda (ZMA-CQK-5002)");
  });

  it("total en negrita y aclarando que no incluye envío", () => {
    expect(m).toContain(`*Total: $${(26400 + resumen.items[1].sub).toLocaleString("es-AR")}* (sin envío)`);
    expect(m).toContain("Ahorro por mayor: $9.600");
  });

  it("datos de la clienta sin espacios de más", () => {
    expect(m).toContain("*Nombre:* Ana\n");
    expect(m).toContain("*Entrega:* Envío a domicilio - Caballito");
    expect(m).toContain("*Pago:* Transferencia");
    expect(m).toContain("*Comentarios:* Tocar timbre 2B");
  });

  it("retiro no agrega dirección aunque haya quedado escrita", () => {
    const r = armarMensaje(resumen, { ...completos, entrega: "retiro" }, C);
    expect(r).toContain("*Entrega:* Retiro en persona\n");
    expect(r).not.toContain("Caballito");
  });

  it("nunca incluye costo en dólares, tipo de cambio ni márgenes", () => {
    expect(m).not.toMatch(/USD|u\$s|1450|costo|margen|factor/i);
  });

  it("sin viñetas unicode que inflen la URL", () => {
    expect(m).not.toMatch(/[•—·]/);
  });
});

describe("sanearDatos (formulario guardado en sessionStorage)", () => {
  it("campos que no son texto no rompen: quedan vacíos", () => {
    const d = sanearDatos({ nombre: 123, comentarios: {}, direccion: null, entrega: "envio", pago: "Efectivo" }, C);
    expect(d).toEqual({ nombre: "", entrega: "envio", direccion: "", pago: "Efectivo", comentarios: "" });
    expect(() => validarDatos(d, C)).not.toThrow();
  });

  it("descarta claves desconocidas y opciones que ya no están en config", () => {
    const d = sanearDatos({ nombre: "Ana", entrega: "drone", pago: "Bitcoin", hack: "x" }, C);
    expect(d).toEqual({ ...DATOS_VACIOS, nombre: "Ana" });
  });

  it("null o basura: formulario vacío", () => {
    expect(sanearDatos(null, C)).toEqual(DATOS_VACIOS);
    expect(sanearDatos("texto", C)).toEqual(DATOS_VACIOS);
  });

  it("una forma de pago que ya no existe no aparece en el mensaje", () => {
    expect(armarMensaje(resumen, { ...completos, pago: "Cheque" }, C)).not.toContain("Cheque");
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

  it("un emoji en los comentarios no rompe la URL", () => {
    const conEmoji = armarMensaje(resumen, { ...completos, comentarios: "Gracias 💄" }, C);
    expect(() => urlWhatsApp(conEmoji, C)).not.toThrow();
  });
});
