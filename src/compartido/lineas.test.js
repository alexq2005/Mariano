import { describe, expect, it } from "vitest";
import { lineaDeCarrito, resumirCarrito } from "./lineas";

const C = { minimo_mayor: 12, pedido_minimo: 10000 };
const L1 = { id: "L1", menor: 3000, mayor: 2200 };
const S1 = { id: "S1", menor: 9000, mayor: 6600, activo: false };

describe("lineaDeCarrito (compartido)", () => {
  it("sin minimo_mayor válido falla en vez de calcular con cualquier cosa", () => {
    expect(() => lineaDeCarrito(L1, 1, {})).toThrow(/minimo_mayor/);
    expect(() => lineaDeCarrito(L1, 1, { minimo_mayor: 0 })).toThrow(/minimo_mayor/);
  });

  it("aplica el precio por mayor desde el mínimo", () => {
    expect(lineaDeCarrito(L1, 11, C)).toMatchObject({ unit: 3000, faltan: 1, ahorro: 0 });
    expect(lineaDeCarrito(L1, 12, C)).toMatchObject({ unit: 2200, sub: 26400, ahorro: 9600 });
  });
});

describe("resumirCarrito (compartido)", () => {
  it("acepta un Map o un objeto por id (el servidor puede no usar Map)", () => {
    const lista = [{ id: "L1", cant: 2 }];
    const conMap = resumirCarrito(lista, new Map([["L1", L1]]), C);
    const conObjeto = resumirCarrito(lista, { L1 }, C);
    expect(conObjeto).toEqual(conMap);
    expect(conMap.total).toBe(6000);
    expect(conMap.faltaMinimo).toBe(4000);
  });

  it("los pausados no se cobran, se informan aparte", () => {
    const r = resumirCarrito([{ id: "L1", cant: 1 }, { id: "S1", cant: 3 }], { L1, S1 }, C);
    expect(r.total).toBe(3000);
    expect(r.noDisponibles).toEqual([{ p: S1, cant: 3 }]);
  });
});
