import { useCart } from "../../context/CartContext";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido } from "../../utils/pedido";
import "./Footer.css";

export const Footer = () => {
  const { config } = useCart();

  // Todo lo del pie sale de la config, que viaja con el catálogo: hasta que
  // llega no se muestra nada, en vez de "Pedido mínimo $NaN" o "undefined".
  return (
    <footer className="footer">
      {config && (
        <>
          <p>
            Precios en pesos, por unidad.
            {config.pedido_minimo ? ` Pedido mínimo ${plata(config.pedido_minimo)}.` : ""} Lista actualizada:{" "}
            {config.actualizado}. Sujetos a modificación sin previo aviso.
          </p>
          {numeroWhatsAppValido(config.whatsapp) && (
            <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer">
              Consultas por WhatsApp
            </a>
          )}
        </>
      )}
    </footer>
  );
};
