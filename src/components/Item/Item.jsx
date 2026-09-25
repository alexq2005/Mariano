import { Link } from "react-router-dom";
import { plata } from "../../utils/precios";
import { partirNombre, porcentajeAhorro } from "../../utils/presentacion";
import { rutaImagen } from "../../services/productos";
import { PistaMayor } from "../AddToCart/AddToCart";
import "./Item.css";

// El nombre con la cola del proveedor ("/48", "(STRAWBERRY SCRUB)") en
// segundo plano: se sigue leyendo, pero no compite con lo que es el producto.
const Nombre = ({ nom }) => {
  const { principal, extra } = partirNombre(nom);
  return (
    <>
      {principal}
      {extra && <span className="card-nombre-extra"> {extra}</span>}
    </>
  );
};

// En el listado, los dos precios van en dos renglones y sin recuadros: en
// tarjetas de 165px los recuadros no entraban y el precio se cortaba
// ("$13.70" en vez de "$13.700").
const Precios = ({ p, minimo, cant }) => {
  const esMayor = cant >= minimo;
  return (
    <div className="precios">
      {/* Llegando al mínimo, el precio por menor se tacha: la clienta ve
          bajar el precio en la tarjeta misma. */}
      <p className="precio-menor num" data-activa={cant > 0 && !esMayor ? "si" : "no"} data-superado={esMayor ? "si" : "no"}>
        {plata(p.menor)}
      </p>
      <p className="precio-mayor num" data-activa={esMayor ? "si" : "no"}>
        {/* "desde 12 u." va junto: si no, el "12+" quedaba solo en otro renglón */}
        <b>{plata(p.mayor)}</b> <span className="junto">desde {minimo} u.</span>
      </p>
    </div>
  );
};

// En el detalle, la tabla de tramos: el mismo formato que "precio por
// cantidad" de Mercado Libre, que es el que las clientas ya saben leer.
const Tramos = ({ p, minimo, cant, ahorro }) => {
  const esMayor = cant >= minimo;
  const tuyo = <span className="tramo-tuyo">tu precio</span>;
  return (
    <table className="tramos">
      <caption>Precio por cantidad (del mismo producto)</caption>
      <tbody>
        <tr data-activa={cant > 0 && !esMayor ? "si" : "no"}>
          <th scope="row">
            {minimo === 2 ? "1 u." : `1 a ${minimo - 1} u.`}
            {cant > 0 && !esMayor && tuyo}
          </th>
          <td className="num">{plata(p.menor)} c/u</td>
        </tr>
        <tr data-activa={esMayor ? "si" : "no"}>
          <th scope="row">
            {minimo} u. o más
            {esMayor && tuyo}
          </th>
          <td className="num">
            {plata(p.mayor)} c/u{ahorro > 0 && <span className="tramo-ahorro"> −{ahorro}%</span>}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

// Tarjeta de producto. Como en el repo del curso, las acciones llegan por
// `children`: la misma tarjeta sirve en el listado y en el detalle. Es
// presentacional: la config (mínimo por mayor) se la pasa quien la dibuja.
//
// En el listado la acción va última en el HTML, después del precio: así la
// recorren el teclado y el lector de pantalla (nombre, precio, agregar). El
// CSS la dibuja sobre la foto, en la misma celda de la grilla.
export const Item = ({ producto: p, cant = 0, config, detalle = false, nivel = "h2", children }) => {
  const minimo = config.minimo_mayor;
  const ahorro = porcentajeAhorro(p);
  // Muchas descripciones del Excel repiten el nombre sin la cola
  // ("Mascarilla de ácido kójico" bajo "Mascarilla de ácido kójico /50").
  const desc = p.desc?.trim();
  const repite = desc && desc.toLowerCase() === partirNombre(p.nom).principal.toLowerCase();
  const ruta = `/product/${p.id}`;
  // nivel: h2 en el listado, h3 bajo "Más de Labios" en el detalle.
  const Titulo = detalle ? "h1" : nivel;
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
    <article
      className={`card${detalle ? " card-detalle" : ""}`}
      data-elegido={cant > 0 ? "si" : "no"}
      data-agotado={p.agotado ? "si" : "no"}
    >
      <div className="card-foto-marco">
        {detalle ? (
          foto
        ) : (
          // La foto también lleva al detalle, pero fuera del tab y del lector
          // de pantalla: para eso ya está el nombre, y no se lee dos veces.
          <Link to={ruta} className="card-foto-link" tabIndex={-1} aria-hidden="true">
            {foto}
          </Link>
        )}
        {!detalle && ahorro > 0 && (
          // Dice "x12" a propósito: el precio grande de la tarjeta es el de
          // menor, y un "−27%" suelto se leería como una oferta que no es.
          // Para el lector de pantalla ya está el renglón "llevando 12+".
          <span className="insignia num" aria-hidden="true">
            −{ahorro}%<small>x{minimo}</small>
          </span>
        )}
      </div>
      <div className="card-cuerpo">
        {detalle && <p className="card-cod">Código {p.cod}</p>}
        {detalle && p.agotado && <p className="card-agotado">Sin stock por ahora</p>}
        <Titulo className="card-nombre">
          {detalle ? (
            p.nom
          ) : (
            <Link to={ruta}>
              <Nombre nom={p.nom} />
            </Link>
          )}
        </Titulo>
        {desc && !repite && <p className="card-desc">{desc}</p>}
        {detalle ? (
          <Tramos p={p} minimo={minimo} cant={cant} ahorro={ahorro} />
        ) : (
          <Precios p={p} minimo={minimo} cant={cant} />
        )}
        {!detalle && cant > 0 && <PistaMayor producto={p} cant={cant} minimo={minimo} />}
        {detalle && children}
      </div>
      {!detalle && children && <div className="card-accion">{children}</div>}
    </article>
  );
};
