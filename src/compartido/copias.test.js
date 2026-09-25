import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archivosCompartidos, CABECERA, DESTINO, ORIGEN } from "../../scripts/copiar-compartido.mjs";

// El servidor usa una copia de compartido/ (Firebase solo despliega la
// carpeta functions/). Si la copia se separa del original, la tienda y el
// servidor calcularían totales distintos para el mismo pedido.
describe("la copia de compartido/ en functions/", () => {
  it("existe", () => {
    expect(existsSync(DESTINO)).toBe(true);
  });

  it("tiene exactamente los mismos archivos", () => {
    expect(readdirSync(DESTINO).sort()).toEqual(archivosCompartidos().sort());
  });

  it("cada archivo es idéntico al original (corré: node scripts/copiar-compartido.mjs)", () => {
    for (const archivo of archivosCompartidos()) {
      const copia = readFileSync(join(DESTINO, archivo), "utf8");
      expect(copia, archivo).toBe(CABECERA(archivo) + readFileSync(join(ORIGEN, archivo), "utf8"));
    }
  });
});
