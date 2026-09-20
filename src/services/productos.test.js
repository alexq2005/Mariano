import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG } from "../config";

// El módulo guarda estado propio: se reimporta limpio en cada test.
let svc;
beforeEach(async () => {
  vi.resetModules();
  svc = await import("./productos");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const respuesta = (productos) => Promise.resolve({ ok: true, json: () => Promise.resolve({ productos }) });
// Los productos del archivo traen el costo en dólares; el catálogo que se
// publica trae los precios calculados y NO el costo.
const crudo = { id: "A", cod: "ZMA-A", nom: "Labial", desc: "", rubro: "labios", img: "a.jpg", bulto: 100, costo: 0.4 };
const deTienda = { id: "A", cod: "ZMA-A", nom: "Labial", desc: "", rubro: "labios", img: "a.jpg", menor: 3000, mayor: 2200 };
const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("estado compartido del catálogo", () => {
  it("carga una sola vez aunque lo pidan varios componentes", async () => {
    const fetch = vi.fn(() => respuesta([crudo]));
    vi.stubGlobal("fetch", fetch);
    svc.cargarProductos();
    svc.cargarProductos();
    await esperar();
    svc.cargarProductos();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(svc.estadoProductos()).toEqual({ productos: [deTienda], config: CONFIG, loading: false, error: null });
  });

  // La config pública viaja con el catálogo (mañana, en el mismo documento):
  // los componentes la leen de acá y no importan src/config.js.
  it("publica la config junto con los productos", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta([crudo])));
    expect(svc.estadoProductos().config).toEqual(CONFIG);
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos().config).toEqual(CONFIG);
  });

  it("si falla, un reintento exitoso actualiza a TODOS los suscriptores", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockReturnValueOnce(Promise.reject(new Error("sin red"))).mockReturnValueOnce(respuesta([crudo]));
    vi.stubGlobal("fetch", fetch);
    const carrito = vi.fn();
    const menu = vi.fn();
    svc.suscribirProductos(carrito);
    svc.suscribirProductos(menu);

    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos().error).toMatch(/No se pudo cargar/);
    expect(svc.estadoProductos().config).toEqual(CONFIG);

    svc.cargarProductos(); // reintento desde cualquier pantalla
    await esperar();
    expect(svc.estadoProductos().productos).toEqual([deTienda]);
    expect(carrito.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(menu.mock.calls.length).toBe(carrito.mock.calls.length);
  });

  // La config también va en el estado de error, y no es un detalle: el
  // encabezado y el pie se dibujan igual con el catálogo caído, y es justo
  // ahí donde la clienta necesita el nombre del negocio y el WhatsApp.
  it("respuesta HTTP de error o JSON con otra forma: error, no catálogo vacío", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos()).toMatchObject({ loading: false, productos: [], config: CONFIG });
    expect(svc.estadoProductos().error).toBeTruthy();

    vi.resetModules();
    svc = await import("./productos");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })));
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos()).toMatchObject({ loading: false, productos: [], config: CONFIG });
    expect(svc.estadoProductos().error).toBeTruthy();
  });

  // Un costo roto no puede tirar abajo el catálogo entero, pero tampoco
  // puede pasar en silencio: el producto queda afuera y se avisa con su id.
  it("un producto con el costo roto queda fuera y se avisa; el resto entra", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => respuesta([crudo, { ...crudo, id: "B", costo: 0 }, { ...crudo, id: "C", costo: undefined }])));
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos().productos.map((p) => p.id)).toEqual(["A"]);
    expect(error.mock.calls[0][0]).toContain("B: ");
    expect(error.mock.calls[0][0]).toContain("C: ");
    expect(error.mock.calls[0][0]).toMatch(/costo/);
  });

  it("el catálogo publicado no lleva el costo en dólares ni el bulto", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta([crudo])));
    svc.cargarProductos();
    await esperar();
    const [p] = svc.estadoProductos().productos;
    expect(p).not.toHaveProperty("costo");
    expect(p).not.toHaveProperty("bulto");
    expect(JSON.stringify(svc.estadoProductos().productos)).not.toContain("0.4");
  });

  it("desuscribirse deja de recibir avisos", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta([])));
    const aviso = vi.fn();
    const baja = svc.suscribirProductos(aviso);
    baja();
    svc.cargarProductos();
    await esperar();
    expect(aviso).not.toHaveBeenCalled();
  });
});
