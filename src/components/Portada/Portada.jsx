import { useMemo } from "react";
import { portadaDeRubro } from "../../utils/presentacion";
import { rutaImagen } from "../../services/productos";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import "./Portada.css";

// La portada del inicio, como el banner de las tiendas de marca: lo primero
// que ve la clienta. Dice a quién le vende (a la que se maquilla y a la que
// revende) y la condición que más vende: el precio por mayor.
//
// Las fotos son productos reales del catálogo, las mismas portadas de los
// rubros: no hay fotos de campaña y no se inventan. Tampoco se promete nada
// que la config no diga (ni envío gratis ni cuotas).
export const Portada = ({ productos, config }) => {
  const fotos = useMemo(() => {
    const portadas = config.portadas_rubros ?? {};
    return Object.keys(portadas)
      .map((rubro) => portadaDeRubro(rubro, productos, portadas))
      .filter(Boolean)
      .slice(0, 3);
  }, [productos, config]);

  return (
    <section className="portada" aria-labelledby="portada-titulo">
      {config.actualizado && <p className="portada-kicker">Lista {config.actualizado}</p>}
      <p id="portada-titulo" className="portada-titulo">
        Maquillaje para lucirte y para revender
      </p>
      {fotos.length > 0 && (
        <div className="portada-fotos" aria-hidden="true">
          {fotos.map((img) => (
            <img key={img} src={rutaImagen(img)} alt="" width="160" height="160" decoding="async" />
          ))}
        </div>
      )}
      <p className="portada-bajada">
        Llevando <b>{config.minimo_mayor} o más</b> del mismo producto pagás <b>precio por mayor</b>.
      </p>
      {!config.precios_confirmados && (
        <p className="portada-nota">Precios orientativos: se confirman con el pedido.</p>
      )}
      <div className="portada-acciones">
        <a href="#productos" className="btn portada-btn">
          Ver productos
        </a>
        {numeroWhatsAppValido(config.whatsapp) && (
          <a
            href={urlWhatsApp("¡Hola! Quiero hacer una consulta.", config)}
            className="btn portada-btn-sec"
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultanos
          </a>
        )}
      </div>
    </section>
  );
};
