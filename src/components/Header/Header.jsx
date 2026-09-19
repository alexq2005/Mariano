import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CONFIG } from "../../config";
import { Nav } from "../Nav/Nav";
import { SearchBar } from "../SearchBar/SearchBar";
import { CartWidget } from "../CartWidget/CartWidget";
import "./Header.css";

export const Header = () => {
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
          {CONFIG.nombre_negocio}
          <small>Cosmética por mayor y menor</small>
        </Link>
        <SearchBar />
        <CartWidget />
      </div>
      <Nav />
    </header>
  );
};
