import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./context/CartProvider";
import { CONFIG } from "./config";

// Sin red ni navegador: el catálogo se simula ya cargado (y vacío). La config
// pública viaja con él, igual que en services/productos.js.
const catalogo = vi.hoisted(() => ({ estado: null }));
vi.mock("./hooks/useProductos", () => ({ useProductos: () => catalogo.estado }));

beforeEach(() => {
  catalogo.estado = { productos: [], porId: new Map(), config: CONFIG, loading: false, error: null };
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

// La config viaja con el catálogo: cuando venga de la base va a tardar lo que
// tarde la red, y mientras tanto ninguna pantalla puede mostrar basura.
describe("catálogo (y config) que todavía no llegaron", () => {
  beforeEach(() => {
    catalogo.estado = { productos: [], porId: new Map(), config: null, loading: true, error: null };
  });

  it.each(["/", "/cart", "/checkout", "/product/ZMA-1", `/pedido/${"a".repeat(32)}`, "/ruta/que-no-existe"])(
    "%s: se dibuja sin 'undefined' ni 'NaN'",
    (ruta) => {
      const html = dibujar(ruta);
      expect(html).not.toMatch(/undefined|NaN/);
      expect(html).toContain('<header class="header"');
      expect(html).toContain('<footer class="footer"');
    },
  );
});

// El otro extremo: el catálogo no cargó, pero la config igual viaja en ese
// estado (services/productos.js la publica también al fallar). El encabezado
// tiene que seguir con el nombre y el pie con el WhatsApp, que es justo lo
// que la clienta necesita cuando la página no le anda.
describe("catálogo que no cargó", () => {
  // El número que trae config.js es el de ejemplo y el pie lo esconde a
  // propósito; acá va uno con forma válida para ver el enlace.
  const CONFIG_REAL = { ...CONFIG, whatsapp: "5491145678901" };

  beforeEach(() => {
    catalogo.estado = {
      productos: [],
      porId: new Map(),
      config: CONFIG_REAL,
      loading: false,
      error: "No se pudo cargar el catálogo. Revisá tu conexión y probá de nuevo.",
    };
  });

  it.each(["/", "/cart", "/checkout", "/product/ZMA-1"])(
    "%s: el encabezado y el pie siguen mostrando los datos del negocio",
    (ruta) => {
      const { antes, main, despues } = partes(dibujar(ruta));
      // Desde <header> y no todo "antes": el <title> que React 19 sube al
      // principio también nombra el negocio y taparía un encabezado vacío.
      expect(antes.slice(antes.indexOf("<header"))).toContain(CONFIG.nombre_negocio);
      expect(despues).toContain(`https://wa.me/${CONFIG_REAL.whatsapp}`);
      expect(despues).toContain(CONFIG.actualizado);
      expect(main).toContain("No se pudo cargar el catálogo");
    },
  );
});
