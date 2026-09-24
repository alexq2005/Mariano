import { Link } from "react-router-dom";
import { Item } from "../Item/Item";
import { AddToCart } from "../AddToCart/AddToCart";
import { useCart } from "../../context/CartContext";
import { nombreRubro } from "../../utils/filtros";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import { enumerar } from "../../utils/presentacion";
import "./ItemDetail.css";

const Icono = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Lo que se pregunta antes de comprar, sacado de la config: nada que el
// negocio no haya dicho.
const Condiciones = ({ config }) => {
  const entregas = (config.formas_entrega ?? []).map((f) => f.nombre);
  const pagos = config.formas_pago ?? [];
  if (!entregas.length && !pagos.length) return null;
  return (
    <ul className="detalle-info">
      {entregas.length > 0 && (
        <li>
          <Icono>
            <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </Icono>
          <span>
            <b>Entrega:</b> {enumerar(entregas, "o").toLowerCase()}
          </span>
        </li>
      )}
      {pagos.length > 0 && (
        <li>
          <Icono>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18M7 15h3" />
          </Icono>
          <span>
            <b>Pago:</b> {enumerar(pagos, "o").toLowerCase()}
          </span>
        </li>
      )}
    </ul>
  );
};

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
        <AddToCart producto={p} etiqueta="Agregar al carrito" />
        {/* Con el número de ejemplo no se muestra: la consulta no le
            llegaría a nadie. */}
        {numeroWhatsAppValido(config.whatsapp) && (
          <a
            className="btn bg-outline consulta"
            href={urlWhatsApp(`¡Hola! Quiero consultar por este producto: ${p.nom} (código ${p.cod}).`, config)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icono>
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.1A8 8 0 1 1 21 12Z" />
            </Icono>
            Consultar por WhatsApp
          </a>
        )}
        <Condiciones config={config} />
      </Item>
    </section>
  );
};
