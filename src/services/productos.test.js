import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG } from "../config";

// Firestore y la conexión se reemplazan por dobles: estos tests prueban la
// lógica del servicio (de dónde saca los datos y qué hace cuando algo
// falla), no el SDK de Firebase.
const getDoc = vi.fn();
vi.mock("firebase/firestore/lite", () => ({ doc: (...r) => r, getDoc: (...a) => getDoc(...a) }));
vi.mock("../firebase/publico", () => ({ dbPublico: {} }));

const producto = { id: "A", cod: "ZMA-A", nom: "Labial", desc: "", rubro: "labios", img: "a.jpg", menor: 3000, mayor: 2200 };
const enFirestore = (datos) => Promise.resolve({ exists: () => true, data: () => datos });
const esperar = () => new Promise((r) => setTimeout(r, 0));

let svc;
let almacen;
beforeEach(async () => {
  vi.resetModules();
  getDoc.mockReset();
  almacen = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
      setItem: (k, v) => almacen.set(k, String(v)),
    },
  });
  svc = await import("./productos");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("de dónde salen los productos", () => {
  it("los lee de Firestore y publica también la config del documento", async () => {
    getDoc.mockReturnValue(enFirestore({ productos: [producto], config: { nombre_negocio: "Aurora 2", minimo_mayor: 6 } }));
    await svc.cargarProductos();
    const estado = svc.estadoProductos();
    expect(estado).toMatchObject({ productos: [producto], loading: false, error: null, desde: "firestore" });
    // La config del documento pisa la del código, y lo que falte se completa.
    expect(estado.config.nombre_negocio).toBe("Aurora 2");
    expect(estado.config.minimo_mayor).toBe(6);
    expect(estado.config.formas_pago).toEqual(CONFIG.formas_pago);
  });

  it("una sola lectura aunque lo pidan varias pantallas", async () => {
    getDoc.mockReturnValue(enFirestore({ productos: [producto] }));
    await Promise.all([svc.cargarProductos(), svc.cargarProductos()]);
    await svc.cargarProductos();
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it("si Firestore falla, cae al archivo publicado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getDoc.mockRejectedValue(new Error("sin red"));
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ productos: [producto] }) })));
    await svc.cargarProductos();
    expect(svc.estadoProductos()).toMatchObject({ productos: [producto], error: null, desde: "archivo" });
  });

  it("si falla todo y no hay nada guardado: error claro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getDoc.mockRejectedValue(new Error("sin red"));
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 500 })));
    await svc.cargarProductos();
    expect(svc.estadoProductos().error).toMatch(/No se pudo cargar/);
    expect(svc.estadoProductos().productos).toEqual([]);
  });

  it("si falla todo pero hay caché, muestra lo guardado en vez de dejar la tienda vacía", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    almacen.set("aurora.catalogo.v1", JSON.stringify({ productos: [producto], config: CONFIG }));
    getDoc.mockRejectedValue(new Error("sin red"));
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("tampoco"))));
    await svc.cargarProductos();
    expect(svc.estadoProductos()).toMatchObject({ productos: [producto], error: null, desde: "cache" });
  });

  it("guarda en caché lo que trae Firestore, para la próxima visita", async () => {
    getDoc.mockReturnValue(enFirestore({ productos: [producto] }));
    await svc.cargarProductos();
    expect(JSON.parse(almacen.get("aurora.catalogo.v1")).productos).toEqual([producto]);
  });
});

describe("datos rotos", () => {
  it("un producto incompleto queda afuera y se avisa; el resto entra", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getDoc.mockReturnValue(
      enFirestore({
        productos: [
          producto,
          { ...producto, id: "B", menor: 0 },
          { ...producto, id: "C", nom: "" },
          { ...producto, id: "D", mayor: "2200" },
        ],
      }),
    );
    await svc.cargarProductos();
    expect(svc.estadoProductos().productos.map((p) => p.id)).toEqual(["A"]);
    const aviso = error.mock.calls.map((c) => c[0]).find((t) => String(t).includes("quedan fuera"));
    for (const id of ["B", "C", "D"]) expect(aviso).toContain(id);
  });

  it("documento vacío o con otra forma: se trata como falla y se usa el archivo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getDoc.mockReturnValue(enFirestore({ productos: [] }));
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ productos: [producto] }) })));
    await svc.cargarProductos();
    expect(svc.estadoProductos()).toMatchObject({ productos: [producto], desde: "archivo" });
  });

  it("caché dañada: se ignora sin romper", async () => {
    almacen.set("aurora.catalogo.v1", "{no es json");
    getDoc.mockReturnValue(enFirestore({ productos: [producto] }));
    await svc.cargarProductos();
    expect(svc.estadoProductos()).toMatchObject({ productos: [producto], desde: "firestore" });
  });
});

describe("suscriptores", () => {
  it("todos se enteran del mismo estado", async () => {
    getDoc.mockReturnValue(enFirestore({ productos: [producto] }));
    const carrito = vi.fn();
    const menu = vi.fn();
    svc.suscribirProductos(carrito);
    svc.suscribirProductos(menu);
    await svc.cargarProductos();
    await esperar();
    expect(carrito.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(menu.mock.calls.length).toBe(carrito.mock.calls.length);
  });

  it("desuscribirse deja de recibir avisos", async () => {
    getDoc.mockReturnValue(enFirestore({ productos: [producto] }));
    const aviso = vi.fn();
    svc.suscribirProductos(aviso)();
    await svc.cargarProductos();
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe("rutaImagen", () => {
  it("arma la ruta de la foto y usa el reemplazo si no hay", () => {
    expect(svc.rutaImagen("ZMA-1.jpg")).toContain("img/ZMA-1.jpg");
    expect(svc.rutaImagen(null)).toContain("img/sin-foto.svg");
  });
});
