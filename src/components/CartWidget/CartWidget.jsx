import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plural } from "../../utils/precios";
import "./CartWidget.css";

export const CartWidget = () => {
  const { cantidadProductos: n } = useCart();

  return (
    <Link
      to="/cart"
      className="cart-widget"
      aria-label={n ? `Carrito: ${plural(n, "producto", "productos")}` : "Carrito vacío"}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 7h14l-1.5 8.5a2 2 0 0 1-2 1.5H9.3a2 2 0 0 1-2-1.6L5 3H2" />
        <circle cx="9.5" cy="20.5" r="1.3" />
        <circle cx="17" cy="20.5" r="1.3" />
      </svg>
      <span className="cart-widget-texto">Carrito</span>
      {/* key={n}: el contador se vuelve a montar con cada cambio, y eso
          dispara la animación de "pop" (apagada con prefers-reduced-motion). */}
      {n > 0 && (
        <span key={n} className="incart num">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
};
