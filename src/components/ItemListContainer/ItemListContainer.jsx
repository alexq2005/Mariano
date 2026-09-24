import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { filtrarProductos, nombreRubro } from "../../utils/filtros";
import { ItemList } from "../ItemList/ItemList";
import { CatalogError } from "../CatalogError/CatalogError";
import { Rubros } from "../Rubros/Rubros";
import { Portada } from "../Portada/Portada";
import "./ItemListContainer.css";

const describirResultado = (n) =>
  n === 0 ? "Sin resultados" : `${n} ${n === 1 ? "producto encontrado" : "productos encontrados"}`;

// La condición de compra que más vende, dicha a quien más le sirve: la
// revendedora. Compacta a propósito: con dos párrafos arriba, en el celular
// no se veía ni un producto en la primera pantalla.
const Promo = ({ config }) => (
  <div className="promo">
    <svg className="promo-icono" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
    <div>
      <p>
        <b>¿Revendés?</b> Llevando {config.minimo_mayor} o más del mismo producto pagás{" "}
        <b>precio por mayor</b>.
      </p>
      {!config.precios_confirmados && <p className="promo-nota">Precios orientativos: se confirman con el pedido.</p>}
    </div>
  </div>
);

export const ItemListContainer = () => {
  const { category } = useParams();
  const [params] = useSearchParams();
  const texto = params.get("q") ?? "";
  const { productos, config, loading, error } = useProductos();

  // Los productos pausados desde el panel no se muestran en la tienda.
  const activos = useMemo(() => productos.filter((p) => p.activo !== false), [productos]);
  const filtrados = useMemo(
    () => filtrarProductos(activos, { rubro: category, texto }),
    [activos, category, texto],
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
  // En el inicio, la portada; buscando o dentro de un rubro, la clienta ya
  // está comprando y alcanza con la promo compacta.
  const inicio = !category && !texto;

  return (
    <section>
      <title>{`${titulo} | ${config.nombre_negocio}`}</title>
      {inicio && <Portada productos={activos} config={config} />}
      <Rubros />
      <h1 id="productos" className="titulo-lista">
        {titulo}
      </h1>
      {!inicio && <Promo config={config} />}
      {region}
      {/* key: al cambiar rubro o búsqueda, la paginación vuelve a empezar */}
      <ItemList key={`${category}|${texto}`} productos={filtrados} total={productos.length} config={config} />
    </section>
  );
};
