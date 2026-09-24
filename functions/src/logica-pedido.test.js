import { describe, expect, it } from "vitest";
import { armarLineas, deltaVenta, ErrorPedido, moverStock, puedePasar } from "./logica-pedido.js";
import { claveClienta } from "./clientas.js";
import { claveDia, claveMes, fechaCorta } from "./tiempo.js";

const config = { minimo_mayor: 12, pedido_minimo: 0 };
const productos = [
  { id: "A", cod: "ZMA-A", nom: "Labial", img: "a.jpg", menor: 3000, mayor: 2200 },
  { id: "B", cod: "ZMA-B", nom: "Sombra", img: "b.jpg", menor: 5000, mayor: 3600 },
  { id: "P", cod: "ZMA-P", nom: "Pausado", img: "p.jpg", menor: 1000, mayor: 900, activo: false },
  { id: "S", cod: "ZMA-S", nom: "Agotado", img: "s.jpg", menor: 1000, mayor: 900, agotado: true },
];

describe("armarLineas: el servidor cobra con los precios del catálogo", () => {
  it("precio por menor y por mayor según la cantidad, con el total y el ahorro", () => {
    const r = armarLineas([{ id: "A", cant: 12 }, { id: "B", cant: 2 }], productos, config);
    expect(r.items.map((i) => [i.id, i.unit, i.sub, i.esMayor])).toEqual([
      ["A", 2200, 26400, true],
      ["B", 5000, 10000, false],
    ]);
    expect(r.total).toBe(36400);
    expect(r.ahorro).toBe(9600);
    expect(r.unidades).toBe(14);
  });

  it("ignora cualquier precio o nombre que mande el navegador", () => {
    const r = armarLineas([{ id: "A", cant: 1, unit: 1, nom: "Gratis" }], productos, config);
    expect(r.items[0]).toMatchObject({ nom: "Labial", unit: 3000 });
  });

  it("rechaza carritos vacíos, cantidades raras y productos repetidos", () => {
    for (const carrito of [[], null, [{ id: "A", cant: 0 }], [{ id: "A", cant: 1.5 }], [{ id: "A", cant: 10000 }], [{ id: 5, cant: 1 }]]) {
      expect(() => armarLineas(carrito, productos, config)).toThrow(ErrorPedido);
    }
    expect(() => armarLineas([{ id: "A", cant: 1 }, { id: "A", cant: 2 }], productos, config)).toThrow(/repetido/);
  });

  it("rechaza lo que no existe, lo pausado y lo agotado, diciendo cuál", () => {
    expect(() => armarLineas([{ id: "X", cant: 1 }], productos, config)).toThrow(/ya no está en el catálogo/);
    expect(() => armarLineas([{ id: "P", cant: 1 }], productos, config)).toThrow(/Pausado ya no está disponible/);
    expect(() => armarLineas([{ id: "S", cant: 1 }], productos, config)).toThrow(/Agotado está sin stock/);
  });

  it("con stock cargado, no deja pedir más de lo que hay", () => {
    expect(() => armarLineas([{ id: "A", cant: 5 }], productos, config, { A: 3 })).toThrow(/quedan 3 u/);
    expect(armarLineas([{ id: "A", cant: 3 }], productos, config, { A: 3 }).unidades).toBe(3);
  });

  it("respeta el pedido mínimo", () => {
    expect(() => armarLineas([{ id: "A", cant: 1 }], productos, { ...config, pedido_minimo: 50000 })).toThrow(/mínimo/);
  });

  it("no acepta más de 100 productos distintos", () => {
    const muchos = Array.from({ length: 101 }, (_, i) => ({ id: `id${i}`, cant: 1 }));
    expect(() => armarLineas(muchos, productos, config)).toThrow(/hasta 100/);
  });
});

describe("estados del pedido", () => {
  it("pendiente → confirmado → entregado, y cancelar antes de entregar", () => {
    expect(puedePasar("pendiente", "confirmado")).toBe(true);
    expect(puedePasar("confirmado", "entregado")).toBe(true);
    expect(puedePasar("pendiente", "cancelado")).toBe(true);
    expect(puedePasar("confirmado", "cancelado")).toBe(true);
  });
  it("no se saltea pasos ni se revive lo cerrado", () => {
    expect(puedePasar("pendiente", "entregado")).toBe(false);
    expect(puedePasar("entregado", "cancelado")).toBe(false);
    expect(puedePasar("cancelado", "confirmado")).toBe(false);
    expect(puedePasar("inventado", "confirmado")).toBe(false);
  });
});

describe("moverStock", () => {
  const items = [{ id: "A", nom: "Labial", cant: 5 }, { id: "B", nom: "Sombra", cant: 2 }];
  it("descuenta solo lo que tiene stock cargado", () => {
    expect(moverStock({ A: 10 }, items, -1)).toEqual({ nuevas: { A: 5 }, faltantes: [] });
  });
  it("avisa lo que no alcanza", () => {
    expect(moverStock({ A: 3, B: 9 }, items, -1).faltantes).toEqual([{ id: "A", nom: "Labial", pide: 5, hay: 3 }]);
  });
  it("devuelve al cancelar", () => {
    expect(moverStock({ A: 5, B: 0 }, items, 1).nuevas).toEqual({ A: 10, B: 2 });
  });
});

describe("deltaVenta", () => {
  const pedido = { unidades: 14, total: 36400, ahorro: 9600, items: [{ id: "A", nom: "Labial", cant: 12, sub: 26400 }] };
  it("suma al mes, al día y a cada producto", () => {
    const d = deltaVenta(pedido, "07", 1, (n) => n);
    expect(d.totales).toEqual({ pedidos: 1, unidades: 14, total: 36400, ahorro: 9600 });
    expect(d.dias["07"]).toEqual({ pedidos: 1, unidades: 14, total: 36400 });
    expect(d.productos.A).toEqual({ nom: "Labial", unidades: 12, total: 26400 });
  });
  it("con signo -1 resta lo mismo", () => {
    expect(deltaVenta(pedido, "07", -1, (n) => n).totales).toEqual({ pedidos: -1, unidades: -14, total: -36400, ahorro: -9600 });
  });
});

describe("claveClienta: el mismo teléfono escrito de distintas formas", () => {
  it("es la misma clienta", () => {
    const claves = ["11 4567-8901", "+54 9 11 4567-8901", "011 15 4567-8901", "(011) 4567 8901", "5491145678901"].map(claveClienta);
    expect(new Set(claves)).toEqual(new Set(["tel-1145678901"]));
  });
  it("sin teléfono usable no hay clave", () => {
    expect(claveClienta("")).toBe(null);
    expect(claveClienta("123")).toBe(null);
  });
});

describe("fechas en hora argentina", () => {
  it("las 22:30 del 30/9 en Argentina todavía son septiembre (en UTC ya es octubre)", () => {
    const f = new Date("2026-10-01T01:30:00Z");
    expect(claveMes(f)).toBe("2026-09");
    expect(claveDia(f)).toBe("30");
    expect(fechaCorta(f)).toBe("30/09/2026");
  });
});
