import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido } from "../../utils/pedido";
import { Sello } from "../Sello/Sello";
import "./Footer.css";

// Pie oscuro, como el de las tiendas de marca: cierra la página y junta lo
// que la clienta pregunta antes de comprar (cómo se pide, entregas, pagos).
export const Footer = () => {
  const { config } = useCart();

  // Todo lo del pie sale de la config, que viaja con el catálogo: hasta que
  // llega no se muestra nada, en vez de "Pedido mínimo $NaN" o "undefined".
  if (!config) return <footer className="footer" />;

  return (
    <footer className="footer">
      <div className="footer-int">
        <div className="footer-marca">
          <Link to="/" className="footer-logo">
            <Sello />
            {config.nombre_negocio}
          </Link>
          <p>Maquillaje, cuidado de la piel y accesorios, por unidad o por mayor.</p>
          {numeroWhatsAppValido(config.whatsapp) && (
            <a className="btn bg-success footer-wa" href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer">
              Consultas por WhatsApp
            </a>
          )}
        </div>
        <div className="footer-col">
          <h2>Cómo comprar</h2>
          <ol className="footer-pasos">
            <li>Elegí los productos y cuántos querés de cada uno.</li>
            <li>Llevando {config.minimo_mayor} o más del mismo, pagás precio por mayor.</li>
            <li>Mandá el pedido por WhatsApp y coordinamos la entrega y el pago.</li>
          </ol>
        </div>
        <div className="footer-col">
          <h2>Entregas</h2>
          <ul>
            {(config.formas_entrega ?? []).map((f) => (
              <li key={f.id}>{f.nombre}</li>
            ))}
          </ul>
          <h2>Pagos</h2>
          <ul>
            {(config.formas_pago ?? []).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="footer-legal">
        Precios en pesos, por unidad.
        {config.pedido_minimo ? ` Pedido mínimo ${plata(config.pedido_minimo)}.` : ""} Lista actualizada:{" "}
        {config.actualizado}. Sujetos a modificación sin previo aviso.
      </p>
    </footer>
  );
};
