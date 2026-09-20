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
const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("estado compartido del catálogo", () => {
  it("carga una sola vez aunque lo pidan varios componentes", async () => {
    const fetch = vi.fn(() => respuesta([{ id: "A" }]));
    vi.stubGlobal("fetch", fetch);
    svc.cargarProductos();
    svc.cargarProductos();
    await esperar();
    svc.cargarProductos();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(svc.estadoProductos()).toEqual({ productos: [{ id: "A" }], config: CONFIG, loading: false, error: null });
  });

  // La config pública viaja con el catálogo (mañana, en el mismo documento):
  // los componentes la leen de acá y no importan src/config.js.
  it("publica la config junto con los productos", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta([{ id: "A" }])));
    expect(svc.estadoProductos().config).toEqual(CONFIG);
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos().config).toEqual(CONFIG);
  });

  it("si falla, un reintento exitoso actualiza a TODOS los suscriptores", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockReturnValueOnce(Promise.reject(new Error("sin red"))).mockReturnValueOnce(respuesta([{ id: "A" }]));
    vi.stubGlobal("fetch", fetch);
    const carrito = vi.fn();
    const menu = vi.fn();
    svc.suscribirProductos(carrito);
    svc.suscribirProductos(menu);

    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos().error).toMatch(/No se pudo cargar/);

    svc.cargarProductos(); // reintento desde cualquier pantalla
    await esperar();
    expect(svc.estadoProductos().productos).toEqual([{ id: "A" }]);
    expect(carrito.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(menu.mock.calls.length).toBe(carrito.mock.calls.length);
  });

  it("respuesta HTTP de error o JSON con otra forma: error, no catálogo vacío", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos()).toMatchObject({ loading: false, productos: [] });
    expect(svc.estadoProductos().error).toBeTruthy();

    vi.resetModules();
    svc = await import("./productos");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })));
    svc.cargarProductos();
    await esperar();
    expect(svc.estadoProductos().error).toBeTruthy();
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
