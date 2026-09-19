import { cargarProductos } from "../../services/productos";

// Si el catálogo no cargó (sin conexión, por ejemplo). "Reintentar" vuelve
// a pedirlo y, si funciona, se actualizan todas las pantallas juntas.
export const CatalogError = ({ mensaje }) => {
  return (
    <div className="estado" role="alert">
      <h1>No se pudo cargar el catálogo</h1>
      <p>{mensaje}</p>
      <button type="button" className="btn bg-primary" onClick={cargarProductos}>
        Reintentar
      </button>
    </div>
  );
};
