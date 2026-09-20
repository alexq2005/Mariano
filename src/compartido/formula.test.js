import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { calcularPrecios, redondearPrecio } from "./formula";

// Números inventados a propósito: los reales del negocio viven en
// datos/config-privada.json, que no se commitea.
const PRIVADA = { tipo_cambio: 1000, factor_importacion: 2, margen_menor: 3, margen_mayor: 2, redondeo: 100 };

describe("calcularPrecios", () => {
  it("aplica la fórmula y redondea (0,4 × 2 × 1000 = 800 → 2.400 y 1.600)", () => {
    expect(calcularPrecios(0.4, PRIVADA)).toEqual({ menor: 2400, mayor: 1600 });
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
    expect(calcularPrecios(1.234, { ...PRIVADA, redondeo: 1 })).toEqual({ menor: 7404, mayor: 4936 });
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

// Lo que se publica no puede traer el costo de fábrica: con eso y el precio
// de venta, cualquiera saca el margen del negocio.
describe("catálogo publicado", () => {
  const texto = readFileSync("public/data/catalogo.json", "utf8");
  const { productos } = JSON.parse(texto);

  it("266 productos con id único y los dos precios", () => {
    expect(productos).toHaveLength(266);
    expect(new Set(productos.map((p) => p.id)).size).toBe(266);
    for (const p of productos) {
      expect(p.menor, p.id).toBeGreaterThan(0);
      expect(p.mayor, p.id).toBeLessThanOrEqual(p.menor);
    }
  });

  it("no lleva costo, bulto ni el nombre del Excel del proveedor", () => {
    for (const rastro of ['"costo"', '"bulto"', "generado_de", ".xlsx"]) {
      expect(texto, rastro).not.toContain(rastro);
    }
  });
});

// Con los datos del proveedor a mano (no están en el repositorio: traen el
// costo), se verifica que los precios publicados salgan EXACTAMENTE de la
// fórmula. Si alguno cambiara un peso, es un producto que se vende a otro
// precio. En una copia recién clonada, sin datos/, este bloque no corre.
const hayDatosPrivados = existsSync("datos/proveedor.json") && existsSync("datos/config-privada.json");
describe.skipIf(!hayDatosPrivados)("precios publicados vs. datos del proveedor", () => {
  it("cada precio del catálogo sale de la fórmula con la config privada", () => {
    const privada = JSON.parse(readFileSync("datos/config-privada.json", "utf8"));
    const { productos: crudos } = JSON.parse(readFileSync("datos/proveedor.json", "utf8"));
    const publicados = new Map(
      JSON.parse(readFileSync("public/data/catalogo.json", "utf8")).productos.map((p) => [p.id, p]),
    );
    const distintos = crudos.filter((p) => {
      const esperado = calcularPrecios(p.costo, privada);
      const real = publicados.get(p.id);
      return !real || real.menor !== esperado.menor || real.mayor !== esperado.mayor;
    });
    expect(distintos.map((p) => p.id)).toEqual([]);
  });

  it("la fórmula estricta aguanta los 266 costos reales", () => {
    const privada = JSON.parse(readFileSync("datos/config-privada.json", "utf8"));
    const { productos } = JSON.parse(readFileSync("datos/proveedor.json", "utf8"));
    for (const p of productos) expect(() => calcularPrecios(p.costo, privada), p.id).not.toThrow();
  });
});
