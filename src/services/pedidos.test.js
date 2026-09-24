import { afterEach, describe, expect, it, vi } from "vitest";
import { crearPedido, ErrorPedido, estadoDe, leerSeguimiento, nuevaSolicitud, seguimientoValido } from "./pedidos";

const responder = (cuerpo, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => cuerpo });

afterEach(() => vi.unstubAllGlobals());

const pedido = { items: [{ id: "L1", cant: 2 }], cliente: {}, totalVisto: 6000, solicitud: "x".repeat(20) };

describe("crearPedido", () => {
  it("manda la acción con el formato de las funciones callable y devuelve el resultado", async () => {
    const fetch = responder({ result: { numero: 7, seguimiento: "a".repeat(32), total: 6000 } });
    vi.stubGlobal("fetch", fetch);
    await expect(crearPedido(pedido)).resolves.toMatchObject({ numero: 7 });
    const [, opciones] = fetch.mock.calls[0];
    expect(JSON.parse(opciones.body)).toEqual({ data: { accion: "pedido.crear", datos: pedido } });
  });

  it("un rechazo del servidor llega con su código y sus detalles", async () => {
    vi.stubGlobal(
      "fetch",
      responder({ error: { status: "FAILED_PRECONDITION", message: "Los precios cambiaron.", details: { total: 6600 } } }, 400),
    );
    const err = await crearPedido(pedido).catch((e) => e);
    expect(err).toBeInstanceOf(ErrorPedido);
    expect(err.codigo).toBe("failed-precondition");
    expect(err.detalles).toEqual({ total: 6600 });
  });

  it("el límite de pedidos se explica en castellano", async () => {
    vi.stubGlobal("fetch", responder({ error: { status: "RESOURCE_EXHAUSTED", message: "x" } }, 429));
    await expect(crearPedido(pedido)).rejects.toThrow(/muchos pedidos seguidos/);
  });

  it("sin conexión: error 'unavailable', no una excepción cruda", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await crearPedido(pedido).catch((e) => e);
    expect(err.codigo).toBe("unavailable");
    expect(err.message).toMatch(/conexión/);
  });

  it("respuesta que no es JSON: error entendible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => JSON.parse("<html>") }));
    await expect(crearPedido(pedido)).rejects.toBeInstanceOf(ErrorPedido);
  });
});

describe("seguimiento", () => {
  it("solo acepta tokens de 32 caracteres hexadecimales (no se consulta basura)", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(seguimientoValido("a".repeat(32))).toBe(true);
    expect(seguimientoValido("../pedidos/x")).toBe(false);
    await expect(leerSeguimiento("../pedidos/x")).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("vencido (403) o inexistente (404): null", async () => {
    vi.stubGlobal("fetch", responder({}, 403));
    await expect(leerSeguimiento("a".repeat(32))).resolves.toBeNull();
    vi.stubGlobal("fetch", responder({}, 404));
    await expect(leerSeguimiento("a".repeat(32))).resolves.toBeNull();
  });

  it("un estado desconocido no rompe la página", () => {
    expect(estadoDe("nuevo").nombre).toBe("Recibido");
    expect(estadoDe("otro")).toEqual({ nombre: "otro", detalle: "" });
  });

  it("cada intento de compra tiene un código distinto que el servidor acepta", () => {
    const a = nuevaSolicitud();
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(nuevaSolicitud()).not.toBe(a);
  });
});
