import { describe, expect, it } from "vitest";
import { archivosCompartidos, desactualizados } from "../../scripts/copiar-compartido.mjs";

// El servidor calcula el pedido con una COPIA de esta carpeta (Firebase sube
// solo functions/). Si alguien cambia un lado y no el otro, la clienta ve un
// total y el servidor cobra otro.
describe("copias del servidor", () => {
  it("functions/src/compartido/ es igual a src/compartido/", () => {
    expect(archivosCompartidos().length).toBeGreaterThan(0);
    expect(desactualizados(), "Corré: npm run compartido").toEqual([]);
  });
});
