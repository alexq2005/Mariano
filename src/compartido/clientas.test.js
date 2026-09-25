import { describe, expect, it } from "vitest";
import { claveClienta, whatsappDeTelefono } from "./clientas";

describe("teléfonos de clientas", () => {
  const formas = ["11 4567-8901", "+54 9 11 4567-8901", "011 15 4567-8901", "(011) 4567 8901", "5491145678901"];

  it("el mismo teléfono escrito de distintas formas es la misma clienta", () => {
    expect(new Set(formas.map(claveClienta))).toEqual(new Set(["tel-1145678901"]));
  });

  it("y el mismo número de WhatsApp", () => {
    expect(new Set(formas.map(whatsappDeTelefono))).toEqual(new Set(["5491145678901"]));
  });

  it("sin un número usable no hay clave ni WhatsApp", () => {
    expect(claveClienta("")).toBe(null);
    expect(claveClienta("123")).toBe(null);
    expect(whatsappDeTelefono("4567-8901")).toBe(null);
  });
});
