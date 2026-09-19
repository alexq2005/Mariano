import { useMatch, useNavigate, useSearchParams } from "react-router-dom";
import "./SearchBar.css";

// La búsqueda vive en la URL (?q=...), así se puede compartir o volver
// atrás. Dentro de un rubro busca en ese rubro; desde otra página (un
// producto, el carrito) lleva al catálogo con los resultados.
export const SearchBar = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const enInicio = useMatch("/");
  const enRubro = useMatch("/category/:category");
  const texto = params.get("q") ?? "";

  const buscar = (valor) => {
    navigate(
      { pathname: enRubro ? enRubro.pathname : "/", search: valor ? `?q=${encodeURIComponent(valor)}` : "" },
      // Mientras tipea no se llena el historial con una entrada por letra.
      { replace: Boolean(enInicio || enRubro) },
    );
  };

  return (
    <form
      className="buscar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        e.currentTarget.querySelector("input").blur(); // cierra el teclado del celular
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={texto}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar producto o código…"
        aria-label="Buscar en el catálogo"
        enterKeyHint="search"
      />
    </form>
  );
};
