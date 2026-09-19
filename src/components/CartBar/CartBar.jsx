import { useLayoutEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plata, plural } from "../../utils/precios";
import "./CartBar.css";

// Barra fija abajo: el carrito siempre a la vista mientras se compra.
// En /cart (solo celular) lleva al checkout; en /checkout no aparece.
export const CartBar = () => {
  const { resumen } = useCart();
  const { pathname } = useLocation();
  const barra = useRef(null);
  const enCarrito = pathname === "/cart";
  const visible = resumen.items.length > 0 && pathname !== "/checkout";

  // La altura real de la barra (cambia con el ancho y con las notas) se
  // publica en --alto-barra, para que la página deje ese espacio abajo.
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const el = barra.current;
    if (!visible || !el) return undefined;
    const medir = () => raiz.style.setProperty("--alto-barra", `${el.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--alto-barra");
    };
  }, [visible, enCarrito]);

  if (!visible) return null;

  const { total, ahorro, unidades, faltaMinimo } = resumen;
  const n = resumen.items.length;

  let nota = null;
  if (faltaMinimo > 0) nota = <div className="cart-bar-nota alerta num">Faltan {plata(faltaMinimo)} para el pedido mínimo</div>;
  else if (ahorro > 0) nota = <div className="cart-bar-nota num">Ahorrás {plata(ahorro)} por comprar por mayor</div>;

  let accion;
  if (!enCarrito) {
    accion = (
      <Link to="/cart" className="btn bg-primary">
        Ver carrito
      </Link>
    );
  } else if (faltaMinimo > 0) {
    accion = (
      <button type="button" className="btn" disabled>
        Continuar
      </button>
    );
  } else {
    accion = (
      <Link to="/checkout" className="btn bg-success">
        Continuar con el pedido
      </Link>
    );
  }

  return (
    <div ref={barra} className={`cart-bar${enCarrito ? " cart-bar-en-carrito" : ""}`}>
      <div className="cart-bar-int">
        <div className="cart-bar-resumen">
          <div className="cart-bar-conteo">
            {plural(n, "producto", "productos")} · {plural(unidades, "unidad", "unidades")}
          </div>
          <div className="cart-bar-total num">{plata(total)}</div>
          {nota}
        </div>
        {accion}
      </div>
    </div>
  );
};
