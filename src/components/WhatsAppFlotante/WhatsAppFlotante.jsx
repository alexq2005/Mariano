import { useLocation } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import "./WhatsAppFlotante.css";

// El botón redondo de WhatsApp, abajo a la derecha, como en casi todas las
// tiendas: la consulta rápida sin buscar el número. Solo con un número real
// (con el de ejemplo, la consulta no le llegaría a nadie), y no en el
// checkout ni en el seguimiento, que ya tienen el suyo.
export const WhatsAppFlotante = () => {
  const { config } = useCart();
  const { pathname } = useLocation();
  if (!config || !numeroWhatsAppValido(config.whatsapp)) return null;
  if (pathname === "/checkout" || pathname.startsWith("/pedido/")) return null;
  return (
    <a
      className="wa-flotante"
      href={urlWhatsApp(`Hola ${config.nombre_negocio}! Quiero hacer una consulta.`, config)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.1A8 8 0 1 1 21 12Z" />
        <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.6-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2L9 9.5Z" fill="currentColor" strokeWidth="1" />
      </svg>
    </a>
  );
};
