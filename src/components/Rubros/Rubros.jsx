import { useMemo } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { contarRubros, sinAcentos } from "../../utils/filtros";
import { portadaDeRubro } from "../../utils/presentacion";
import { rutaImagen } from "../../services/productos";
import "./Rubros.css";

// Los rubros como historias de Instagram: un círculo con una foto real y un
// aro del color del rubro (el rojo del labial, el violeta de la sombra). Es
// el formato que la clienta ya sabe usar con el celular en la mano, y sirve
// para navegar: no es un banner que empuja los productos para abajo.
//
// No va en el encabezado fijo: en el celular ese espacio es oro, y los
// círculos se van con el scroll como las historias.

const Circulo = ({ to, end, nombre, cantidad, aro, fotos }) => (
  <li>
    <NavLink to={to} end={end} className="rubro" style={{ "--aro": aro }}>
      <span className="rubro-aro" aria-hidden="true">
        <span className={`rubro-foto${fotos.length > 1 ? " mosaico" : ""}`}>
          {fotos.map((img) => (
            <img key={img} src={rutaImagen(img)} alt="" width="72" height="72" loading="lazy" decoding="async" />
          ))}
        </span>
      </span>
      <span className="rubro-nombre">{nombre}</span>
      <span className="rubro-n num">{cantidad}</span>
    </NavLink>
  </li>
);

export const Rubros = () => {
  const { productos, config } = useProductos();
  const [params] = useSearchParams();
  const activos = useMemo(() => productos.filter((p) => p.activo !== false), [productos]);
  const rubros = useMemo(() => contarRubros(activos), [activos]);

  const portadas = useMemo(() => {
    const elegidas = config?.portadas_rubros ?? {};
    return Object.fromEntries(rubros.map((r) => [r.id, portadaDeRubro(r.id, activos, elegidas)]));
  }, [rubros, activos, config]);

  if (!activos.length) return null;

  // Al cambiar de rubro se conserva lo que estaba buscando.
  const q = params.get("q");
  const search = q ? `?q=${encodeURIComponent(q)}` : "";

  // "Todo": un mosaico con las portadas de los primeros cuatro rubros.
  const mosaico = rubros.map((r) => portadas[r.id]).filter(Boolean).slice(0, 4);

  return (
    <nav className="rubros" aria-label="Rubros">
      <ul className="rubros-lista">
        <Circulo
          to={{ pathname: "/", search }}
          end
          nombre="Todo"
          cantidad={activos.length}
          aro="var(--r-todos)"
          fotos={mosaico}
        />
        {rubros.map((r) => (
          <Circulo
            key={r.id}
            to={{ pathname: `/category/${r.id}`, search }}
            nombre={r.nom}
            cantidad={r.n}
            aro={`var(--r-${sinAcentos(r.id)})`}
            fotos={portadas[r.id] ? [portadas[r.id]] : []}
          />
        ))}
      </ul>
    </nav>
  );
};
