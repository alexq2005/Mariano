import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./context/CartProvider";

// Sin red ni navegador: el catálogo se simula ya cargado (y vacío).
vi.mock("./hooks/useProductos", () => {
  const estado = { productos: [], porId: new Map(), loading: false, error: null };
  return { useProductos: () => estado };
});

const dibujar = (ruta) =>
  renderToString(
    <MemoryRouter initialEntries={[ruta]}>
      <CartProvider>
        <App />
      </CartProvider>
    </MemoryRouter>,
  );

// Parte el HTML en lo que queda antes, dentro y después de <main>.
const partes = (html) => {
  const abre = html.indexOf("<main>");
  const cierra = html.indexOf("</main>");
  return { antes: html.slice(0, abre), main: html.slice(abre, cierra), despues: html.slice(cierra) };
};

describe("rutas de la tienda dentro de PublicLayout", () => {
  // Se busca el <h1> y no solo el texto: React 19 sube el <title> de la
  // página al principio del HTML, antes del encabezado.
  it.each([
    ["/cart", "<h1>Tu carrito</h1>"],
    ["/ruta/que-no-existe", "<h1>Página no encontrada</h1>"],
  ])("%s: la página va en <main>, entre el encabezado y el pie", (ruta, titulo) => {
    const { antes, main, despues } = partes(dibujar(ruta));
    expect(main).toContain(titulo);
    expect(antes).toContain('<header class="header"');
    expect(antes).not.toContain("<h1");
    expect(despues).toContain('<footer class="footer"');
    expect(despues).not.toContain("<h1");
  });

  it("el encabezado y el pie aparecen una sola vez", () => {
    const html = dibujar("/cart");
    expect(html.split("<header").length - 1).toBe(1);
    expect(html.split("<footer").length - 1).toBe(1);
    expect(html.split("<main>").length - 1).toBe(1);
  });
});
