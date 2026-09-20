import { Link } from "react-router-dom";
import { Item } from "../Item/Item";
import { AddToCart } from "../AddToCart/AddToCart";
import { useCart } from "../../context/CartContext";
import { nombreRubro } from "../../utils/filtros";
import "./ItemDetail.css";

export const ItemDetail = ({ producto: p, config }) => {
  const { cantidadDe } = useCart();

  return (
    <section className="detail-wrapper">
      <title>{`${p.nom} | ${config.nombre_negocio}`}</title>
      <nav className="migas" aria-label="Ubicación">
        <Link to="/">Catálogo</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/category/${p.rubro}`}>{nombreRubro(p.rubro)}</Link>
      </nav>
      <Item producto={p} cant={cantidadDe(p.id)} config={config} detalle>
        <AddToCart producto={p} />
      </Item>
    </section>
  );
};
