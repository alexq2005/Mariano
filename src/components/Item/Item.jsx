import { Link } from "react-router-dom";
import { plata, precioMayor, precioMenor } from "../../utils/precios";
import { rutaImagen } from "../../services/productos";
import "./Item.css";

const Tarifa = ({ tipo, etiqueta, precio, activa }) => (
  <div className={`tarifa ${tipo}`} data-activa={activa ? "si" : "no"}>
    <span className="et">{etiqueta}</span>
    <span className="pr num">{plata(precio)}</span>
  </div>
);

// Tarjeta de producto. Como en el repo del curso, las acciones llegan por
// `children`: la misma tarjeta sirve en el listado y en el detalle. Es
// presentacional: la config (mínimo por mayor y los factores del precio) se
// la pasa quien la dibuja.
export const Item = ({ producto: p, cant = 0, config, detalle = false, children }) => {
  const esMayor = cant >= config.minimo_mayor;
  const ruta = `/product/${p.id}`;
  const Titulo = detalle ? "h1" : "h2";
  const foto = (
    <img
      className="card-foto"
      src={rutaImagen(p.img)}
      alt={detalle ? p.nom : ""}
      width="340"
      height="340"
      loading={detalle ? "eager" : "lazy"}
      decoding="async"
    />
  );

  return (
    <article className={`card${detalle ? " card-detalle" : ""}`} data-elegido={cant > 0 ? "si" : "no"}>
      {detalle ? (
        foto
      ) : (
        // La foto también lleva al detalle, pero fuera del tab y del lector
        // de pantalla: para eso ya está el nombre, y no se lee dos veces.
        <Link to={ruta} className="card-foto-link" tabIndex={-1} aria-hidden="true">
          {foto}
        </Link>
      )}
      <div className="card-cuerpo">
        <div className="card-cod">{p.cod}</div>
        <Titulo className="card-nombre">{detalle ? p.nom : <Link to={ruta}>{p.nom}</Link>}</Titulo>
        {p.desc && <p className="card-desc">{p.desc}</p>}
        <div className="tarifas">
          <Tarifa tipo="menor" etiqueta="Por menor" precio={precioMenor(p, config)} activa={cant > 0 && !esMayor} />
          <Tarifa
            tipo="mayor"
            etiqueta={`Desde ${config.minimo_mayor} u.`}
            precio={precioMayor(p, config)}
            activa={esMayor}
          />
        </div>
        {children}
      </div>
    </article>
  );
};
