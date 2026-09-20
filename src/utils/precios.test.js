import { describe, expect, it } from "vitest";
import { lineaDeCarrito, plata, plural, resumirCarrito } from "./precios";

// Los productos llegan al carrito con los precios ya calculados (la fórmula
// y su paridad con los 266 productos reales se prueban en
// compartido/formula.test.js). Estos son los precios de 0,4 y 1,2 USD.
const C = { minimo_mayor: 12, pedido_minimo: 0 };
const labial = { id: "L1", cod: "ZMA-1", nom: "Labial", menor: 3000, mayor: 2200 };
const serum = { id: "S1", cod: "ZMA-2", nom: "Sérum", menor: 9000, mayor: 6600 };
const porId = new Map([["L1", labial], ["S1", serum]]);

describe("formatos", () => {
  it("formatea pesos con separador de miles argentino", () => {
    expect(plata(1319986800)).toBe("$1.319.986.800");
    expect(plata(0)).toBe("$0");
  });

  it("pluraliza (no más '1 unidades')", () => {
    expect(plural(1, "unidad", "unidades")).toBe("1 unidad");
    expect(plural(2, "unidad", "unidades")).toBe("2 unidades");
  });
});

describe("lineaDeCarrito", () => {
  it("por debajo del mínimo: precio por menor y cuánto falta", () => {
    expect(lineaDeCarrito(labial, 5, C)).toMatchObject({ unit: 3000, sub: 15000, esMayor: false, faltan: 7, ahorro: 0 });
  });

  it("justo en el mínimo: precio por mayor y ahorro", () => {
    expect(lineaDeCarrito(labial, 12, C)).toMatchObject({ unit: 2200, sub: 26400, esMayor: true, faltan: 0, ahorro: 9600 });
  });

  // Un producto sin precio (alta sin costo, dato roto) no puede entrar al
  // carrito con precio 0 ni NaN: tiene que explotar antes de cobrarse.
  it("producto sin precios válidos: error, no precio 0", () => {
    for (const roto of [{ id: "X" }, { id: "X", menor: 0, mayor: 0 }, { id: "X", menor: "3000", mayor: 2200 }, { id: "X", menor: NaN, mayor: 1 }]) {
      expect(() => lineaDeCarrito(roto, 1, C), JSON.stringify(roto)).toThrow(/no tiene precio/);
    }
  });

  it("sin config explota (no asume el mínimo por mayor)", () => {
    expect(() => lineaDeCarrito(labial, 5)).toThrow();
  });
});

describe("resumirCarrito", () => {
  it("el mínimo por mayor es por producto: no se suman productos distintos", () => {
    const r = resumirCarrito([{ id: "L1", cant: 6 }, { id: "S1", cant: 6 }], porId, C);
    expect(r.items.every((i) => !i.esMayor)).toBe(true);
    expect(r.unidades).toBe(12);
  });

  it("suma total, ahorro y unidades, en el orden en que se agregaron", () => {
    const r = resumirCarrito([{ id: "S1", cant: 1 }, { id: "L1", cant: 12 }], porId, C);
    expect(r.items.map((i) => i.p.id)).toEqual(["S1", "L1"]);
    expect(r.total).toBe(9000 + 26400);
    expect(r.ahorro).toBe(9600);
  });

  it("ignora ids que ya no existen en el catálogo", () => {
    const r = resumirCarrito([{ id: "VIEJO", cant: 3 }, { id: "L1", cant: 1 }], porId, C);
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(3000);
  });

  it("informa cuánto falta para el pedido mínimo", () => {
    const r = resumirCarrito([{ id: "L1", cant: 1 }], porId, { ...C, pedido_minimo: 20000 });
    expect(r.faltaMinimo).toBe(17000);
    expect(resumirCarrito([], porId, C).faltaMinimo).toBe(0);
  });
});
