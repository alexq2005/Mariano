import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido } from "../../utils/pedido";
import { enumerarFrase } from "../../utils/presentacion";
import { Sello } from "../Sello/Sello";
import "./Footer.css";

const Icono = ({ children }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// La franja de arriba del pie, como en las tiendas de Tiendanube: lo que da
// confianza antes de comprar. Todo sale de la config; nada de "envío gratis"
// ni "cuotas" que el negocio no ofrece.
const Beneficios = ({ config }) => {
  const entregas = (config.formas_entrega ?? []).map((f) => f.nombre);
  const pagos = config.formas_pago ?? [];
  return (
    <ul className="beneficios">
      {entregas.length > 0 && (
        <li>
          <Icono>
            <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </Icono>
          <span>
            <b>Entregas</b>
            {enumerarFrase(entregas, "o")}
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
            <b>Pagás como quieras</b>
            {enumerarFrase(pagos, "o")}
          </span>
        </li>
      )}
      <li>
        <Icono>
          <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </Icono>
        <span>
          <b>Por mayor desde {config.minimo_mayor} u.</b>
          Del mismo producto, el precio baja solo
        </span>
      </li>
    </ul>
  );
};

// Pie oscuro, como el de las tiendas de marca: cierra la página y junta lo
// que la clienta pregunta antes de comprar (cómo se pide, entregas, pagos).
export const Footer = () => {
  const { config } = useCart();

  // Todo lo del pie sale de la config, que viaja con el catálogo: hasta que
  // llega no se muestra nada, en vez de "Pedido mínimo $NaN" o "undefined".
  if (!config) return <footer className="footer" />;

  const wa = numeroWhatsAppValido(config.whatsapp);
  const hayContacto = wa || config.email_contacto || config.direccion_retiro || config.instagram;

  return (
    <>
      <Beneficios config={config} />
      <footer className="footer">
        <div className="footer-int">
          <div className="footer-marca">
            <Link to="/" className="footer-logo">
              <Sello />
              {config.nombre_negocio}
            </Link>
            <p>Maquillaje, cuidado de la piel y accesorios, por unidad o por mayor.</p>
            {config.instagram && (
              <a className="footer-instagram" href={`https://www.instagram.com/${config.instagram}/`} target="_blank" rel="noopener noreferrer">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>
                  <small>Seguinos en Instagram</small>@{config.instagram}
                </span>
              </a>
            )}
          </div>
          <div className="footer-col">
            <h2>Cómo comprar</h2>
            <ol className="footer-pasos">
              <li>Elegí los productos y cuántos querés de cada uno.</li>
              <li>Llevando {config.minimo_mayor} o más del mismo, pagás precio por mayor.</li>
              <li>Hacé el pedido: te damos un número y un link para seguirlo.</li>
              <li>Coordinamos la entrega y el pago por WhatsApp.</li>
            </ol>
          </div>
          <div className="footer-col">
            {hayContacto && (
              <>
                <h2>Contacto</h2>
                <ul className="footer-contacto">
                  {wa && (
                    <li>
                      <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer">
                        WhatsApp +{config.whatsapp}
                      </a>
                    </li>
                  )}
                  {config.email_contacto && (
                    <li>
                      <a href={`mailto:${config.email_contacto}`}>{config.email_contacto}</a>
                    </li>
                  )}
                  {config.direccion_retiro && <li>{config.direccion_retiro}</li>}
                </ul>
              </>
            )}
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
        <div className="footer-legal">
          <p>
            Precios en pesos, por unidad.
            {config.pedido_minimo ? ` Pedido mínimo ${plata(config.pedido_minimo)}.` : ""} Lista actualizada:{" "}
            {config.actualizado}. Sujetos a modificación sin previo aviso.
          </p>
          {/* Los dos enlaces que pide la ley para vender online en Argentina:
              Defensa del Consumidor (Res. 271/2020) y el botón de
              arrepentimiento (Disp. 954/2025). */}
          <p className="footer-ley">
            <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer">
              Defensa de las y los consumidores. Para reclamos ingresá acá
            </a>
            <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
          </p>
        </div>
      </footer>
    </>
  );
};
