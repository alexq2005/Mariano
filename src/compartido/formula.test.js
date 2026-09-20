import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calcularPrecios, redondearPrecio } from "./formula";
import { CONFIG } from "../config";

const PRIVADA = { tipo_cambio: 1000, factor_importacion: 2.5, margen_menor: 2.5, margen_mayor: 1.8, redondeo: 100 };

describe("calcularPrecios", () => {
  it("aplica la fórmula y redondea (0,4 USD → 3.016 y 2.186,6 → 3.000 y 2.200)", () => {
    expect(calcularPrecios(0.4, PRIVADA)).toEqual({ menor: 3000, mayor: 2200 });
  });

  it("el precio por mayor nunca supera al de menor", () => {
    for (const costo of [0.01, 0.4, 1.2, 2.5, 13]) {
      const { menor, mayor } = calcularPrecios(costo, PRIVADA);
      expect(mayor, `costo ${costo}`).toBeLessThanOrEqual(menor);
    }
  });

  it("ningún producto queda en $0: el mínimo es un paso de redondeo", () => {
    expect(calcularPrecios(0.000001, PRIVADA)).toEqual({ menor: 100, mayor: 100 });
  });

  it("sin redondeo (paso 1) devuelve el entero", () => {
    expect(calcularPrecios(1, { ...PRIVADA, redondeo: 1 })).toEqual({ menor: 7540, mayor: 5467 });
  });
});

// Lo que antes se colaba: con un dato faltante o en 0, la versión vieja
// calculaba igual (factor_importacion || 1) y vendía barato.
describe("calcularPrecios: entradas inválidas explotan, no calculan", () => {
  const casos = [
    ["sin config", 1, undefined],
    ["config vacía", 1, {}],
    ["falta el factor", 1, { ...PRIVADA, factor_importacion: undefined }],
    ["factor en 0", 1, { ...PRIVADA, factor_importacion: 0 }],
    ["tipo de cambio como texto", 1, { ...PRIVADA, tipo_cambio: "1000" }],
    ["margen NaN", 1, { ...PRIVADA, margen_menor: NaN }],
    ["redondeo en 0", 1, { ...PRIVADA, redondeo: 0 }],
    ["costo sin cargar", undefined, PRIVADA],
    ["costo en 0", 0, PRIVADA],
    ["costo negativo", -1, PRIVADA],
    ["costo como texto", "1.2", PRIVADA],
  ];
  for (const [nombre, costo, privada] of casos) {
    it(nombre, () => expect(() => calcularPrecios(costo, privada)).toThrow(/formula:/));
  }
});

describe("redondearPrecio", () => {
  it("redondea al paso y respeta el mínimo", () => {
    expect(redondearPrecio(3049, 100)).toBe(3000);
    expect(redondearPrecio(3050, 100)).toBe(3100);
    expect(redondearPrecio(10, 100)).toBe(100);
    expect(redondearPrecio(1234.4, 1)).toBe(1234);
  });
  it("paso inválido explota", () => {
    expect(() => redondearPrecio(100, 0)).toThrow(/redondeo/);
  });
});

// Red de seguridad del refactor: la fórmula nueva tiene que dar EXACTAMENTE
// los mismos precios que la vieja para los 266 productos reales. Si alguno
// cambiara un peso, es un producto que se vende a otro precio.
describe("paridad con la fórmula anterior (266 productos reales)", () => {
  const anterior = (p, C) => {
    const paso = C.redondeo || 1;
    const redondear = (n) => Math.max(paso, Math.round(n / paso) * paso);
    const costoReal = p.costo * (C.factor_importacion || 1) * C.tipo_cambio;
    return { menor: redondear(costoReal * C.margen_menor), mayor: redondear(costoReal * C.margen_mayor) };
  };

  it("mismos precios, producto por producto", () => {
    const { productos } = JSON.parse(readFileSync("public/data/productos.json", "utf8"));
    expect(productos).toHaveLength(266);
    const distintos = productos.filter((p) => {
      const viejo = anterior(p, CONFIG);
      const nuevo = calcularPrecios(p.costo, CONFIG);
      return viejo.menor !== nuevo.menor || viejo.mayor !== nuevo.mayor;
    });
    expect(distintos.map((p) => p.id)).toEqual([]);
  });

  it("los costos reales del catálogo no rompen la fórmula estricta", () => {
    const { productos } = JSON.parse(readFileSync("public/data/productos.json", "utf8"));
    for (const p of productos) {
      const { menor, mayor } = calcularPrecios(p.costo, CONFIG);
      expect(menor, p.id).toBeGreaterThan(0);
      expect(mayor, p.id).toBeLessThanOrEqual(menor);
    }
  });
});
