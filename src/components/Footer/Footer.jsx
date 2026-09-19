import { CONFIG } from "../../config";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido } from "../../utils/pedido";
import "./Footer.css";

export const Footer = () => {
  return (
    <footer className="footer">
      <p>
        Precios en pesos, por unidad.
        {CONFIG.pedido_minimo ? ` Pedido mínimo ${plata(CONFIG.pedido_minimo)}.` : ""} Lista actualizada:{" "}
        {CONFIG.actualizado}. Sujetos a modificación sin previo aviso.
      </p>
      {numeroWhatsAppValido(CONFIG.whatsapp) && (
        <a href={`https://wa.me/${CONFIG.whatsapp}`} target="_blank" rel="noopener noreferrer">
          Consultas por WhatsApp
        </a>
      )}
    </footer>
  );
};
