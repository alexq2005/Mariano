import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { ItemCount } from "../ItemCount/ItemCount";
import { rutaImagen } from "../../services/productos";
import { plata } from "../../utils/precios";
import "./CartItem.css";

export const CartItem = ({ linea, onQuitar, enfocar }) => {
  const { p, cant, unit, sub, esMayor, faltan, ahorro, mayor } = linea;
  const { cambiar, fijar } = useCart();
  const nombre = useRef(null);
  const ruta = `/product/${p.id}`;

  // Al deshacer un "Quitar", el foco vuelve a la fila recuperada.
  useEffect(() => {
    if (enfocar) nombre.current?.focus();
  }, [enfocar]);

  return (
    <li className="cart-item">
      <Link to={ruta} className="cart-item-foto" tabIndex={-1} aria-hidden="true">
        <img src={rutaImagen(p.img)} alt="" width="76" height="76" loading="lazy" decoding="async" />
      </Link>

      <div className="cart-item-info">
        <h2 className="cart-item-nombre">
          <Link ref={nombre} to={ruta}>
            {p.nom}
          </Link>
        </h2>
        <p className="cart-item-cod">{p.cod}</p>
        <p className="cart-item-precio num">
          <span className={`tarifa-chip ${esMayor ? "mayor" : "menor"}`}>{esMayor ? "Por mayor" : "Por menor"}</span>{" "}
          {plata(unit)} c/u
        </p>
      </div>

      <div className="cart-item-cantidad">
        <ItemCount
          cantidad={cant}
          nombre={p.nom}
          // Bajar a 0 desde el carrito es lo mismo que "Quitar": deja deshacer.
          onCambiar={(paso) => (cant + paso <= 0 ? onQuitar() : cambiar(p.id, paso))}
          onFijar={(n) => (n === 0 ? onQuitar() : fijar(p.id, n))}
        />
      </div>

      <p className="cart-item-sub num">
        <span className="solo-lector">Subtotal: </span>
        {plata(sub)}
      </p>

      <p className={`cart-item-pista num${esMayor ? " ok" : ""}`}>
        {esMayor
          ? `Ahorrás ${plata(ahorro)} por comprar por mayor`
          : `Te ${faltan === 1 ? "falta 1 u." : `faltan ${faltan} u.`} de este producto para el precio por mayor (${plata(mayor)} c/u)`}
      </p>

      <button type="button" className="btn-link cart-item-quitar" onClick={onQuitar} aria-label={`Quitar ${p.nom} del carrito`}>
        Quitar
      </button>
    </li>
  );
};
