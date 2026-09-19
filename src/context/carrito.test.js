import { describe, expect, it, vi } from "vitest";
import { CLAVE, TOPE, cargarCarrito, carritoReducer, guardarCarrito, leerGuardado, normalizar, sanear } from "./carrito";

const r = carritoReducer;
const base = [
  { id: "A", cant: 2 },
  { id: "B", cant: 5 },
  { id: "C", cant: 1 },
];

describe("sanear", () => {
  it("entero entre 0 y el tope; null si no es número", () => {
    expect(sanear(7)).toBe(7);
    expect(sanear("12")).toBe(12);
    expect(sanear(2.9)).toBe(2);
    expect(sanear(-3)).toBe(0);
    expect(sanear(99999)).toBe(TOPE);
    expect(sanear(NaN)).toBeNull();
    expect(sanear("abc")).toBeNull();
    expect(sanear("")).toBeNull();
    expect(sanear(null)).toBeNull();
    expect(sanear(undefined)).toBeNull();
  });
});

describe("carritoReducer", () => {
  it("sumar agrega al final y respeta el orden de carga", () => {
    expect(r(base, { type: "sumar", id: "D", paso: 1 }).map((x) => x.id)).toEqual(["A", "B", "C", "D"]);
    expect(r(base, { type: "sumar", id: "B", paso: 1 })[1]).toEqual({ id: "B", cant: 6 });
  });

  it("restar hasta 0 quita el producto", () => {
    expect(r(base, { type: "sumar", id: "C", paso: -1 }).map((x) => x.id)).toEqual(["A", "B"]);
  });

  it("fijar con NaN o vacío NO borra el producto (bug del contador viejo)", () => {
    expect(r(base, { type: "fijar", id: "B", cantidad: NaN })).toBe(base);
    expect(r(base, { type: "fijar", id: "B", cantidad: "" })).toBe(base);
  });

  it("fijar con 0 explícito sí quita el producto", () => {
    expect(r(base, { type: "fijar", id: "B", cantidad: 0 }).map((x) => x.id)).toEqual(["A", "C"]);
  });

  it("fijar respeta el tope", () => {
    expect(r(base, { type: "fijar", id: "A", cantidad: 99999 })[0].cant).toBe(TOPE);
    expect(r(base, { type: "sumar", id: "A", paso: TOPE + 5 })[0].cant).toBe(TOPE);
  });

  it("devuelve la misma referencia si nada cambia (evita renders de más)", () => {
    expect(r(base, { type: "fijar", id: "A", cantidad: 2 })).toBe(base);
    expect(r(base, { type: "quitar", id: "Z" })).toBe(base);
    expect(r([], { type: "vaciar" })).toEqual([]);
  });

  it("reponer (deshacer Quitar) vuelve a la posición original", () => {
    const sinB = r(base, { type: "quitar", id: "B" });
    expect(r(sinB, { type: "reponer", id: "B", cant: 5, posicion: 1 })).toEqual(base);
  });

  it("reponer no duplica si el producto ya volvió al carrito", () => {
    expect(r(base, { type: "reponer", id: "B", cant: 9, posicion: 0 })).toBe(base);
  });

  it("vaciar y restaurar (deshacer Vaciar)", () => {
    const vacio = r(base, { type: "vaciar" });
    expect(vacio).toEqual([]);
    expect(r(vacio, { type: "restaurar", items: base })).toEqual(base);
  });

  it("podar saca ids que ya no están en el catálogo", () => {
    expect(r(base, { type: "podar", validos: new Set(["A", "C"]) }).map((x) => x.id)).toEqual(["A", "C"]);
    expect(r(base, { type: "podar", validos: new Set(["A", "B", "C"]) })).toBe(base);
  });

  it("acción desconocida es un error, no un no-op silencioso", () => {
    expect(() => r(base, { type: "cualquiera" })).toThrow();
  });
});

describe("normalizar (datos que vienen de afuera)", () => {
  it("descarta basura, repetidos y cantidades inválidas", () => {
    const sucio = [{ id: "A", cant: 2 }, { id: "A", cant: 9 }, null, { id: 5, cant: 1 }, { id: "B", cant: "x" }, { id: "C", cant: 0 }, { id: "D", cant: 3.7 }];
    expect(normalizar(sucio)).toEqual([{ id: "A", cant: 2 }, { id: "D", cant: 3 }]);
    expect(normalizar({ A: 2 })).toEqual([]);
  });
});

describe("persistencia", () => {
  const memoria = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  };

  it("guarda solo ids y cantidades, y los recupera", () => {
    const s = memoria();
    guardarCarrito(base, s);
    expect(JSON.parse(s.getItem(CLAVE))).toEqual(base);
    expect(cargarCarrito(s)).toEqual(base);
  });

  it("sin nada guardado: carrito vacío", () => {
    expect(cargarCarrito(memoria())).toEqual([]);
  });

  it("JSON dañado: carrito vacío con aviso, sin romper", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(leerGuardado("{no es json")).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("almacenamiento que tira error (modo privado): no rompe", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const roto = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(cargarCarrito(roto)).toEqual([]);
    expect(() => guardarCarrito(base, roto)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sin localStorage disponible (null): no rompe", () => {
    expect(cargarCarrito(null)).toEqual([]);
    expect(() => guardarCarrito(base, null)).not.toThrow();
  });
});
