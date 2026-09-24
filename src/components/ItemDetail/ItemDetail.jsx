import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Item } from "../Item/Item";
import { AddToCart } from "../AddToCart/AddToCart";
import { useCart } from "../../context/CartContext";
import { useProductos } from "../../hooks/useProductos";
import { nombreRubro } from "../../utils/filtros";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import { enumerar, relacionados } from "../../utils/presentacion";
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

// Compartir el producto: la revendedora se lo manda a sus clientas. En el
// celular abre el menú del sistema (WhatsApp, Instagram…); donde no existe,
// copia el link.
const Compartir = ({ p, config }) => {
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(""), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  const compartir = async () => {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: p.nom, text: `${p.nom} en ${config.nombre_negocio}`, url });
      } catch {
        /* cerró el menú sin elegir: no pasa nada */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado: pegalo donde quieras.");
    } catch {
      setAviso(`No se pudo copiar. El link es ${url}`);
    }
  };

  return (
    <>
      <button type="button" className="btn bg-outline accion-secundaria" onClick={compartir}>
        <Icono>
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
        </Icono>
        Compartir
      </button>
      {/* Siempre montada: una región que aparece con texto no se anuncia. */}
      <p className="nota-estado detalle-aviso" role="status">
        {aviso}
      </p>
    </>
  );
};

// "Más de Labios": para seguir mirando sin volver al listado.
const MasDelRubro = ({ p, config }) => {
  const { productos } = useProductos();
  const { cantidadDe } = useCart();
  const otros = useMemo(() => relacionados(productos, p), [productos, p]);
  if (!otros.length) return null;
  const rubro = nombreRubro(p.rubro);
  return (
    <section className="relacionados" aria-labelledby="relacionados-titulo">
      <div className="relacionados-cabecera">
        <h2 id="relacionados-titulo">Más de {rubro}</h2>
        <Link to={`/category/${p.rubro}`}>
          Ver todo<span className="solo-lector"> {rubro}</span>
        </Link>
      </div>
      <ul className="relacionados-lista">
        {otros.map((o) => (
          <li key={o.id}>
            <Item producto={o} cant={cantidadDe(o.id)} config={config} nivel="h3">
              <AddToCart producto={o} compacto />
            </Item>
          </li>
        ))}
      </ul>
    </section>
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
        <div className="acciones-detalle">
          <Compartir p={p} config={config} />
          {/* Con el número de ejemplo no se muestra: la consulta no le
              llegaría a nadie. */}
          {numeroWhatsAppValido(config.whatsapp) && (
            <a
              className="btn bg-outline accion-secundaria"
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
        </div>
        <Condiciones config={config} />
      </Item>
      <MasDelRubro p={p} config={config} />
    </section>
  );
};
