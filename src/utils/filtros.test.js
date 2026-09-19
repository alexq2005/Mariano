import { describe, expect, it } from "vitest";
import { contarRubros, filtrarProductos, sinAcentos } from "./filtros";

const productos = [
  { id: "1", cod: "ZMA-20045", nom: "Lápiz labial /48", desc: "", rubro: "labios" },
  { id: "2", cod: "ZMA-77062", nom: "Bálsamo labial /24", desc: "", rubro: "labios" },
  { id: "3", cod: "ZMA-8108", nom: "Máscara de pestañas", desc: "", rubro: "ojos" },
  { id: "4", cod: "ZMA-X", nom: "Esmalte", desc: "Rojo", rubro: "uñas" },
];

describe("filtros", () => {
  it("busca sin importar acentos ni mayúsculas", () => {
    expect(filtrarProductos(productos, { texto: "lapiz" }).map((p) => p.id)).toEqual(["1"]);
    expect(filtrarProductos(productos, { texto: "BALSAMO" }).map((p) => p.id)).toEqual(["2"]);
    expect(filtrarProductos(productos, { texto: "pestanas" }).map((p) => p.id)).toEqual(["3"]);
  });

  it("busca por código y por descripción", () => {
    expect(filtrarProductos(productos, { texto: "zma-8108" }).map((p) => p.id)).toEqual(["3"]);
    expect(filtrarProductos(productos, { texto: "rojo" }).map((p) => p.id)).toEqual(["4"]);
  });

  it("combina rubro y texto", () => {
    expect(filtrarProductos(productos, { rubro: "labios", texto: "labial" })).toHaveLength(2);
    expect(filtrarProductos(productos, { rubro: "ojos", texto: "labial" })).toHaveLength(0);
  });

  it("rubro inexistente: ninguno", () => {
    expect(filtrarProductos(productos, { rubro: "joyas" })).toEqual([]);
  });

  it("cuenta rubros en el orden fijo, capitalizados", () => {
    expect(contarRubros(productos)).toEqual([
      { id: "labios", nom: "Labios", n: 2 },
      { id: "ojos", nom: "Ojos", n: 1 },
      { id: "uñas", nom: "Uñas", n: 1 },
    ]);
  });

  it("sinAcentos conserva la ñ como n (búsqueda tolerante)", () => {
    expect(sinAcentos("Uñas")).toBe("unas");
  });
});
