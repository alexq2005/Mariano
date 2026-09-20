import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lineaDeCarrito, plata, plural, precioMayor, precioMenor, redondear, resumirCarrito } from "./precios";
import { CONFIG } from "../config";

const C = {
  tipo_cambio: 1000,
  factor_importacion: 2.5,
  margen_menor: 2.5,
  margen_mayor: 1.8,
  minimo_mayor: 12,
  pedido_minimo: 0,
  redondeo: 100,
};
// costo real = 0.4 × 2.6 × 1450 = 1508 → menor 3016 ≈ 3000, mayor 2186,6 ≈ 2200
const labial = { id: "L1", cod: "ZMA-1", nom: "Labial", costo: 0.4 };
const serum = { id: "S1", cod: "ZMA-2", nom: "Sérum", costo: 1.2 };
const porId = new Map([["L1", labial], ["S1", serum]]);

describe("precios", () => {
  it("calcula menor y mayor con la fórmula de config", () => {
    expect(precioMenor(labial, C)).toBe(3000);
    expect(precioMayor(labial, C)).toBe(2200);
  });

  it("redondea al paso de config y nunca devuelve menos que un paso", () => {
    expect(redondear(3049, C)).toBe(3000);
    expect(redondear(3050, C)).toBe(3100);
    expect(redondear(10, C)).toBe(100);
    expect(redondear(1234.4, { redondeo: 1 })).toBe(1234);
  });

  it("formatea pesos con separador de miles argentino", () => {
    expect(plata(1319986800)).toBe("$1.319.986.800");
    expect(plata(0)).toBe("$0");
  });

  it("pluraliza (no más '1 unidades')", () => {
    expect(plural(1, "unidad", "unidades")).toBe("1 unidad");
    expect(plural(2, "unidad", "unidades")).toBe("2 unidades");
  });

  // La config llega con el catálogo y se pasa siempre a mano: sin valor por
  // defecto, olvidarse revienta acá y no vende a cualquier precio.
  it("sin config falla en vez de calcular con valores viejos", () => {
    expect(() => precioMenor(labial)).toThrow();
    expect(() => resumirCarrito([{ id: "L1", cant: 1 }], porId)).toThrow();
  });
});

describe("lineaDeCarrito", () => {
  it("por debajo del mínimo: precio por menor y cuánto falta", () => {
    const l = lineaDeCarrito(labial, 5, C);
    expect(l).toMatchObject({ unit: 3000, sub: 15000, esMayor: false, faltan: 7, ahorro: 0 });
  });

  it("justo en el mínimo: precio por mayor y ahorro", () => {
    const l = lineaDeCarrito(labial, 12, C);
    expect(l).toMatchObject({ unit: 2200, sub: 26400, esMayor: true, faltan: 0, ahorro: 800 * 12 });
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
    expect(r.total).toBe(precioMenor(serum, C) + 26400);
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

describe("catálogo real con la config real", () => {
  const { productos } = JSON.parse(readFileSync("public/data/productos.json", "utf8"));

  it("266 productos, todos con id único", () => {
    expect(productos).toHaveLength(266);
    expect(new Set(productos.map((p) => p.id)).size).toBe(266);
  });

  it("todo precio es un número positivo y el mayor nunca supera al menor", () => {
    for (const p of productos) {
      const men = precioMenor(p, CONFIG);
      const may = precioMayor(p, CONFIG);
      expect(Number.isFinite(men) && men > 0, p.id).toBe(true);
      expect(may, p.id).toBeLessThanOrEqual(men);
    }
  });
});
