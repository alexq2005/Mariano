import { useMemo } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { contarRubros, productosVisibles } from "../../utils/filtros";
import "./Nav.css";

export const Nav = () => {
  const { productos: todos } = useProductos();
  const productos = useMemo(() => productosVisibles(todos), [todos]);
  const [params] = useSearchParams();
  const rubros = useMemo(() => contarRubros(productos), [productos]);

  if (!productos.length) return null;

  // Al cambiar de rubro se conserva lo que estaba buscando.
  const q = params.get("q");
  const search = q ? `?q=${encodeURIComponent(q)}` : "";

  return (
    <nav className="nav" aria-label="Rubros">
      <ul className="nav-list">
        <li>
          <NavLink to={{ pathname: "/", search }} end className="chip">
            Todo el catálogo ({productos.length})
          </NavLink>
        </li>
        {rubros.map((r) => (
          <li key={r.id}>
            <NavLink to={{ pathname: `/category/${r.id}`, search }} className="chip">
              {r.nom} ({r.n})
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
