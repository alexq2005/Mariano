import { Link, useParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { ItemDetail } from "../ItemDetail/ItemDetail";
import { CatalogError } from "../CatalogError/CatalogError";

export const ItemDetailContainer = () => {
  const { id } = useParams();
  const { porId, config, loading, error } = useProductos();

  if (loading) return <p className="estado">Cargando…</p>;
  if (error) return <CatalogError mensaje={error} />;

  const producto = porId.get(id);
  if (!producto) {
    return (
      <div className="estado">
        <title>{`Producto no encontrado | ${config.nombre_negocio}`}</title>
        <h1>Producto no encontrado</h1>
        <p>Puede que ya no esté en la lista.</p>
        <Link to="/" className="btn bg-primary">
          Ver el catálogo
        </Link>
      </div>
    );
  }

  return <ItemDetail producto={producto} config={config} />;
};
