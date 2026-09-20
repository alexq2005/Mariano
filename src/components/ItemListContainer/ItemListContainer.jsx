import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { filtrarProductos, nombreRubro } from "../../utils/filtros";
import { ItemList } from "../ItemList/ItemList";
import { CatalogError } from "../CatalogError/CatalogError";
import "./ItemListContainer.css";

const describirResultado = (n) =>
  n === 0 ? "Sin resultados" : `${n} ${n === 1 ? "producto encontrado" : "productos encontrados"}`;

export const ItemListContainer = () => {
  const { category } = useParams();
  const [params] = useSearchParams();
  const texto = params.get("q") ?? "";
  const { productos, config, loading, error } = useProductos();

  const filtrados = useMemo(
    () => filtrarProductos(productos, { rubro: category, texto }),
    [productos, category, texto],
  );

  // Aviso para lectores de pantalla: vive siempre montado (una región que
  // aparece ya con texto no se anuncia) y espera a que termine de tipear.
  const resultado = describirResultado(filtrados.length);
  const [anuncio, setAnuncio] = useState("");
  useEffect(() => {
    if (loading || (!texto && !category)) return undefined;
    const t = setTimeout(() => setAnuncio(resultado), 600);
    return () => clearTimeout(t);
  }, [resultado, texto, category, loading]);

  const region = (
    <p className="solo-lector" role="status" aria-live="polite" aria-atomic="true">
      {anuncio}
    </p>
  );

  if (loading) return <p className="estado">Cargando productos…</p>;
  if (error) return <CatalogError mensaje={error} />;

  const titulo = category ? nombreRubro(category) : "Catálogo";

  return (
    <section>
      <title>{`${titulo} | ${config.nombre_negocio}`}</title>
      <h1>{titulo}</h1>
      <p className="aviso">
        Llevando <b>{config.minimo_mayor} unidades o más del mismo producto</b> pagás <b>precio por mayor</b>. No
        se suman productos distintos. El precio se ajusta solo cuando cargás la cantidad.
      </p>
      {region}
      {/* key: al cambiar rubro o búsqueda, la paginación vuelve a empezar */}
      <ItemList key={`${category}|${texto}`} productos={filtrados} total={productos.length} config={config} />
    </section>
  );
};
