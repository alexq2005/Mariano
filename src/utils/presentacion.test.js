import { describe, expect, it } from "vitest";
import { partirNombre, porcentajeAhorro } from "./presentacion";

describe("porcentajeAhorro", () => {
  it("redondea al entero: $3.000 → $2.200 es 27%", () => {
    expect(porcentajeAhorro({ menor: 3000, mayor: 2200 })).toBe(27);
  });

  it("sin ahorro real no hay insignia", () => {
    expect(porcentajeAhorro({ menor: 3000, mayor: 3000 })).toBe(0);
    expect(porcentajeAhorro({ menor: 2200, mayor: 3000 })).toBe(0);
  });

  it("con datos rotos no inventa un porcentaje", () => {
    expect(porcentajeAhorro({ menor: 0, mayor: 2200 })).toBe(0);
    expect(porcentajeAhorro({ menor: 3000 })).toBe(0);
    expect(porcentajeAhorro(null)).toBe(0);
  });
});

describe("partirNombre", () => {
  it("separa el dato de empaque del final", () => {
    expect(partirNombre("Lápiz labial /48")).toEqual({ principal: "Lápiz labial", extra: "/48" });
    expect(partirNombre("Iluminador en polvo /12 unid.")).toEqual({ principal: "Iluminador en polvo", extra: "/12 unid." });
  });

  it("separa la traducción entre paréntesis", () => {
    expect(partirNombre("Exfoliante de frutilla 500 g (STRAWBERRY SCRUB)")).toEqual({
      principal: "Exfoliante de frutilla 500 g",
      extra: "(STRAWBERRY SCRUB)",
    });
  });

  it("no pierde información: la cola se muestra, solo en segundo plano", () => {
    const { principal, extra } = partirNombre("Antifaz térmico de vapor (precio por caja de 12 unid.)");
    expect(`${principal} ${extra}`).toBe("Antifaz térmico de vapor (precio por caja de 12 unid.)");
  });

  it("deja tranquilos los nombres sin cola", () => {
    expect(partirNombre("Sombras de ojos, 24 unid./caja")).toEqual({ principal: "Sombras de ojos, 24 unid./caja", extra: "" });
    expect(partirNombre("Base líquida")).toEqual({ principal: "Base líquida", extra: "" });
  });

  it("nunca deja el nombre vacío", () => {
    expect(partirNombre("(SOLO INGLÉS)")).toEqual({ principal: "(SOLO INGLÉS)", extra: "" });
    expect(partirNombre("")).toEqual({ principal: "", extra: "" });
  });
});
