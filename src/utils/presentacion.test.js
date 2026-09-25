import { describe, expect, it } from "vitest";
import { enumerar, enumerarFrase, partirNombre, porcentajeAhorro, portadaDeRubro, relacionados } from "./presentacion";

describe("portadaDeRubro", () => {
  const productos = [
    { id: "A", rubro: "labios", img: "A.jpg" },
    { id: "B", rubro: "labios", img: "B.jpg" },
    { id: "C", rubro: "ojos", img: null },
    { id: "D", rubro: "ojos", img: "D.jpg" },
  ];

  it("usa la foto elegida en la config", () => {
    expect(portadaDeRubro("labios", productos, { labios: "B" })).toBe("B.jpg");
  });

  it("si el elegido ya no está (lista nueva), usa el primero con foto", () => {
    expect(portadaDeRubro("labios", productos, { labios: "YA-NO-EXISTE" })).toBe("A.jpg");
    expect(portadaDeRubro("ojos", productos, {})).toBe("D.jpg");
  });

  it("un id de otro rubro no se cuela", () => {
    expect(portadaDeRubro("ojos", productos, { ojos: "A" })).toBe("D.jpg");
  });

  it("rubro sin fotos: null, y el círculo muestra su color", () => {
    expect(portadaDeRubro("cabello", productos, {})).toBeNull();
  });
});

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

describe("enumerarFrase", () => {
  it("solo la primera con mayúscula", () => {
    expect(enumerarFrase(["Retiro en persona", "Envío a domicilio"], "o")).toBe("Retiro en persona o envío a domicilio");
    expect(enumerarFrase(["Transferencia", "Efectivo", "A convenir"], "o")).toBe("Transferencia, efectivo o a convenir");
  });
});

describe("enumerar", () => {
  it("arma la frase con comas y el conector al final", () => {
    expect(enumerar(["Transferencia", "Efectivo", "A convenir"], "o")).toBe("Transferencia, Efectivo o A convenir");
    expect(enumerar(["Retiro en persona", "Envío a domicilio"], "o")).toBe("Retiro en persona o Envío a domicilio");
  });

  it("con uno solo o ninguno no agrega conector", () => {
    expect(enumerar(["Efectivo"])).toBe("Efectivo");
    expect(enumerar([])).toBe("");
  });
});

describe("relacionados", () => {
  const lista = [
    { id: "l1", rubro: "labios" },
    { id: "o1", rubro: "ojos" },
    { id: "l2", rubro: "labios" },
    { id: "l3", rubro: "labios", activo: false },
    { id: "l4", rubro: "labios" },
    { id: "l5", rubro: "labios" },
  ];
  const ids = (l) => l.map((p) => p.id);

  it("los que siguen en el mismo rubro, dando la vuelta al final", () => {
    expect(ids(relacionados(lista, { id: "l4", rubro: "labios" }))).toEqual(["l5", "l1", "l2"]);
  });

  it("sin el producto mismo, sin otros rubros y sin pausados", () => {
    const r = ids(relacionados(lista, { id: "l1", rubro: "labios" }));
    expect(r).toEqual(["l2", "l4", "l5"]);
  });

  it("respeta el máximo pedido", () => {
    expect(relacionados(lista, { id: "l1", rubro: "labios" }, 2)).toHaveLength(2);
  });

  it("solo en su rubro: lista vacía", () => {
    expect(relacionados(lista, { id: "o1", rubro: "ojos" })).toEqual([]);
  });
});
