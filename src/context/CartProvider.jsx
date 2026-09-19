import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CartContext } from "./CartContext";
import { CLAVE, cantidadEn, cargarCarrito, carritoReducer, guardarCarrito, leerGuardado } from "./carrito";
import { useProductos } from "../hooks/useProductos";
import { plural, resumirCarrito } from "../utils/precios";
import { CONFIG } from "../config";

const ESPACIO_DURO = String.fromCharCode(160);

export const CartProvider = ({ children }) => {
  const [items, dispatch] = useReducer(carritoReducer, undefined, () => cargarCarrito());
  const { productos, porId, loading, error } = useProductos();
  const [aviso, setAviso] = useState("");
  const temporizador = useRef(null);

  useEffect(() => {
    guardarCarrito(items);
  }, [items]);

  // Si el carrito se cambia en otra pestaña, esta se pone al día (si no,
  // la última pestaña en guardar pisaría lo que se agregó en la otra).
  useEffect(() => {
    const alCambiar = (e) => {
      if (e.key === CLAVE) dispatch({ type: "restaurar", items: leerGuardado(e.newValue) });
    };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  // Con una lista nueva del proveedor, los productos que ya no existen se
  // sacan del carrito guardado.
  useEffect(() => {
    if (!loading && productos.length) {
      dispatch({ type: "podar", validos: new Set(productos.map((p) => p.id)) });
    }
  }, [loading, productos]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  // Región "status" para lectores de pantalla (WCAG 4.1.3). El espacio
  // duro alternado hace que un mensaje repetido se vuelva a anunciar.
  const anunciar = useCallback((texto) => {
    clearTimeout(temporizador.current);
    setAviso((prev) => (prev === texto ? texto + ESPACIO_DURO : texto));
  }, []);

  // Los +/− y el tipeo se agrupan: se anuncia solo el valor final.
  const anunciarLuego = useCallback(
    (texto) => {
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => anunciar(texto), 800);
    },
    [anunciar],
  );

  const nombre = useCallback((id) => porId.get(id)?.nom || "el producto", [porId]);

  const avisarCantidad = useCallback(
    (id, cant) => {
      if (cant <= 0) return anunciar(`Quitaste ${nombre(id)} del carrito.`);
      const mayor = cant >= CONFIG.minimo_mayor ? ", precio por mayor" : "";
      anunciarLuego(`${nombre(id)}: ${plural(cant, "unidad", "unidades")}${mayor}.`);
    },
    [anunciar, anunciarLuego, nombre],
  );

  const agregar = useCallback(
    (id) => {
      dispatch({ type: "sumar", id, paso: 1 });
      anunciar(`Agregaste ${nombre(id)} al carrito.`);
    },
    [anunciar, nombre],
  );

  const cambiar = useCallback(
    (id, paso) => {
      dispatch({ type: "sumar", id, paso });
      avisarCantidad(id, cantidadEn(items, id) + paso);
    },
    [items, avisarCantidad],
  );

  const fijar = useCallback(
    (id, cantidad) => {
      dispatch({ type: "fijar", id, cantidad });
      avisarCantidad(id, cantidad);
    },
    [avisarCantidad],
  );

  // Devuelven lo necesario para deshacer.
  const quitar = useCallback(
    (id) => {
      const posicion = items.findIndex((x) => x.id === id);
      if (posicion < 0) return null;
      dispatch({ type: "quitar", id });
      anunciar(`Quitaste ${nombre(id)} del carrito.`);
      return { id, cant: items[posicion].cant, posicion };
    },
    [items, anunciar, nombre],
  );

  const reponer = useCallback(
    (quitado) => {
      dispatch({ type: "reponer", ...quitado });
      anunciar(`Volviste a agregar ${nombre(quitado.id)}.`);
    },
    [anunciar, nombre],
  );

  const vaciar = useCallback(() => {
    dispatch({ type: "vaciar" });
    anunciar("Vaciaste el carrito.");
    return items;
  }, [items, anunciar]);

  const restaurar = useCallback(
    (anteriores) => {
      dispatch({ type: "restaurar", items: anteriores });
      anunciar("Recuperaste el carrito.");
    },
    [anunciar],
  );

  const valor = useMemo(() => {
    const resumen = resumirCarrito(items, porId);
    return {
      items,
      resumen,
      productosListos: !loading,
      // Sin esto, un catálogo que no cargó se vería como "carrito vacío".
      errorProductos: error,
      // Antes de que carguen los productos no se pueden calcular precios,
      // pero el contador del ícono ya puede mostrarse.
      cantidadProductos: loading || error ? items.length : resumen.items.length,
      cantidadDe: (id) => cantidadEn(items, id),
      agregar,
      cambiar,
      fijar,
      quitar,
      reponer,
      vaciar,
      restaurar,
    };
  }, [items, porId, loading, error, agregar, cambiar, fijar, quitar, reponer, vaciar, restaurar]);

  return (
    <CartContext.Provider value={valor}>
      {children}
      <p className="solo-lector" role="status" aria-live="polite" aria-atomic="true">
        {aviso}
      </p>
    </CartContext.Provider>
  );
};
