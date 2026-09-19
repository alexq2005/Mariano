import { useEffect, useMemo, useSyncExternalStore } from "react";
import { cargarProductos, estadoProductos, suscribirProductos } from "../services/productos";

export const useProductos = () => {
  const estado = useSyncExternalStore(suscribirProductos, estadoProductos);

  // Al montar: carga el catálogo, o lo reintenta si la última vez falló.
  useEffect(() => {
    cargarProductos();
  }, []);

  // Map y no objeto común: con un objeto, /product/constructor devolvía la
  // función heredada de Object.prototype y la app quedaba en blanco.
  const porId = useMemo(() => new Map(estado.productos.map((p) => [p.id, p])), [estado.productos]);

  return { ...estado, porId };
};
