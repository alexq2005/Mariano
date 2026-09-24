import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { SearchBar } from "../SearchBar/SearchBar";
import { CartWidget } from "../CartWidget/CartWidget";
import { Sello } from "../Sello/Sello";
import "./Header.css";

// Los rubros ya no van acá: son los círculos de arriba del listado
// (Rubros.jsx). El encabezado queda fijo con lo que se usa todo el tiempo,
// marca, buscador y carrito; en el celular ese lugar es oro.
export const Header = () => {
  const { config } = useCart();
  const header = useRef(null);

  // La altura real del header fijo (cambia con el ancho) se publica en
  // --alto-header: así el navegador no deja un elemento enfocado debajo.
  useLayoutEffect(() => {
    const el = header.current;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--alto-header", `${el.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <header ref={header} className="header">
      <div className="header-barra">
        <Link to="/" className="marca">
          <Sello />
          <span className="marca-texto">
            {/* El nombre sale de la config, que viaja con el catálogo: hasta
                que llega no se dibuja (mejor vacío que "undefined"). */}
            {config?.nombre_negocio}
            <small>Cosmética por mayor y menor</small>
          </span>
        </Link>
        <SearchBar />
        <CartWidget />
      </div>
    </header>
  );
};
