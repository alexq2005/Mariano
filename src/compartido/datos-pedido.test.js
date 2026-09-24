import { describe, expect, it } from "vitest";
import { DATOS_VACIOS, sanearDatosPedido, validarDatosPedido } from "./datos-pedido";

const C = {
  formas_entrega: [
    { id: "retiro", nombre: "Retiro en persona", pide_direccion: false },
    { id: "envio", nombre: "Envío a domicilio", pide_direccion: true },
  ],
  formas_pago: ["Transferencia", "Efectivo"],
};
const completos = {
  ...DATOS_VACIOS,
  nombre: "Ana Pérez",
  telefono: "+54 9 11 4567-8901",
  email: "ana@ejemplo.com",
  entrega: "envio",
  direccion: "Caballito",
  pago: "Efectivo",
};

describe("validarDatosPedido", () => {
  it("completo: sin errores", () => {
    expect(validarDatosPedido(completos, C)).toEqual({});
  });

  it("acepta teléfonos escritos de distintas formas", () => {
    for (const telefono of ["11 4567-8901", "(011) 4567-8901", "+5491145678901"]) {
      expect(validarDatosPedido({ ...completos, telefono }, C), telefono).toEqual({});
    }
  });

  it("rechaza teléfonos cortos o con letras", () => {
    for (const telefono of ["1234", "11-CASA-12", "   "]) {
      expect(validarDatosPedido({ ...completos, telefono }, C), telefono).toHaveProperty("telefono");
    }
  });

  it("rechaza emails sin dominio", () => {
    for (const email of ["ana", "ana@", "ana@ejemplo", "ana @ejemplo.com"]) {
      expect(validarDatosPedido({ ...completos, email }, C), email).toHaveProperty("email");
    }
  });

  it("nombre y comentarios demasiado largos", () => {
    expect(validarDatosPedido({ ...completos, nombre: "a".repeat(81) }, C)).toHaveProperty("nombre");
    expect(validarDatosPedido({ ...completos, comentarios: "a".repeat(501) }, C)).toHaveProperty("comentarios");
  });

  it("envío sin dirección la pide; retiro no", () => {
    expect(validarDatosPedido({ ...completos, direccion: " " }, C)).toHaveProperty("direccion");
    expect(validarDatosPedido({ ...completos, entrega: "retiro", direccion: "" }, C)).toEqual({});
  });

  it("claves faltantes no rompen: se informan como error", () => {
    expect(Object.keys(validarDatosPedido({}, C)).sort()).toEqual(["email", "entrega", "nombre", "pago", "telefono"]);
  });
});

describe("sanearDatosPedido (lo que llega al servidor)", () => {
  it("recorta, descarta claves desconocidas y lo que no es texto", () => {
    const d = sanearDatosPedido({ ...completos, nombre: "  Ana  ", telefono: 1234, hack: "x" }, C);
    expect(d.nombre).toBe("Ana");
    expect(d.telefono).toBe("");
    expect(d).not.toHaveProperty("hack");
  });

  it("corta los textos al largo máximo", () => {
    expect(sanearDatosPedido({ ...completos, comentarios: "a".repeat(900) }, C).comentarios).toHaveLength(500);
  });

  it("borra la dirección si la entrega no la pide, y opciones fuera de config", () => {
    const d = sanearDatosPedido({ ...completos, entrega: "retiro", pago: "Bitcoin" }, C);
    expect(d.direccion).toBe("");
    expect(d.pago).toBe("");
  });
});
