import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { leerDocumentoPublico } from "../../services/firestoreRest";
import { hayServidor } from "../../services/tienda";
import { useProductos } from "../../hooks/useProductos";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import { rutaImagen } from "../../services/productos";
import "./Seguimiento.css";

// Los pasos que ve la clienta. "Cancelado" no es un paso: reemplaza a los
// que faltaban.
const PASOS = [
  { estado: "pendiente", texto: "Recibido", ayuda: "La tienda ya tiene tu pedido." },
  { estado: "confirmado", texto: "Confirmado", ayuda: "Se acordó el stock, la entrega y el pago." },
  { estado: "entregado", texto: "Entregado", ayuda: "¡Listo! Que lo disfrutes." },
];

const fecha = (iso) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

// /pedido/:token — cómo va un pedido. El token del link es la llave: no se
// puede adivinar, y el documento no tiene datos personales.
export const Seguimiento = () => {
  const { token } = useParams();
  const { config } = useProductos();
  // Un token con otra forma no existe: ni se consulta.
  const tokenValido = hayServidor && /^[0-9a-f]{32}$/.test(token);
  const [leido, setEstado] = useState({ cargando: true, pedido: null, error: null });
  const estado = tokenValido ? leido : { cargando: false, pedido: null, error: "no-existe" };

  useEffect(() => {
    if (!tokenValido) return undefined;
    const control = new AbortController();
    leerDocumentoPublico(`seguimiento/${token}`, { signal: control.signal })
      .then((pedido) => setEstado({ cargando: false, pedido, error: null }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        const error = err.status === 404 ? "no-existe" : err.status === 403 ? "vencido" : "red";
        setEstado({ cargando: false, pedido: null, error });
      });
    return () => control.abort();
  }, [token, tokenValido]);

  const titulo = <title>{`Tu pedido | ${config.nombre_negocio}`}</title>;
  if (estado.cargando) return <p className="estado">Buscando tu pedido…</p>;

  if (estado.error) {
    const textos = {
      "no-existe": ["No encontramos ese pedido", "Revisá que el link esté completo."],
      // Las reglas responden igual a un link que no existe y a uno vencido.
      vencido: ["Este link no está disponible", "Puede que esté incompleto o que haya vencido: duran 90 días. Si necesitás algo, escribinos."],
      red: ["No pudimos cargar tu pedido", "Revisá tu conexión y probá de nuevo."],
    };
    const [h, p] = textos[estado.error];
    return (
      <section className="estado">
        {titulo}
        <h1>{h}</h1>
        <p>{p}</p>
        <Link to="/" className="btn bg-primary">
          Ver el catálogo
        </Link>
      </section>
    );
  }

  const p = estado.pedido;
  const cancelado = p.estado === "cancelado";
  const alcanzado = PASOS.findIndex((x) => x.estado === p.estado);
  const cuando = Object.fromEntries((p.historial ?? []).map((h) => [h.estado, h.cuando]));
  const consulta = urlWhatsApp(`Hola! Te escribo por mi pedido #${p.numero}.`, config);

  return (
    <section className="seguimiento">
      {titulo}
      <p className="seguimiento-negocio">{p.negocio || config.nombre_negocio}</p>
      <h1>
        Pedido <span className="num">#{p.numero}</span>
      </h1>
      <p className="seguimiento-fecha">Hecho el {fecha(p.creado)}</p>

      {cancelado ? (
        <p className="seguimiento-cancelado" role="status">
          Este pedido se canceló{cuando.cancelado ? ` el ${fecha(cuando.cancelado)}` : ""}. Si no sabés por qué, escribinos.
        </p>
      ) : (
        <ol className="pasos">
          {PASOS.map((paso, i) => (
            <li key={paso.estado} data-hecho={i <= alcanzado ? "si" : "no"} aria-current={i === alcanzado ? "step" : undefined}>
              <span className="paso-punto" aria-hidden="true" />
              <span className="paso-texto">
                <b>{paso.texto}</b>
                {i <= alcanzado && cuando[paso.estado] && <small>{fecha(cuando[paso.estado])}</small>}
                {i === alcanzado && <span className="paso-ayuda">{paso.ayuda}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <h2>Qué pediste</h2>
      <ul className="seguimiento-items">
        {p.items.map((i, n) => (
          <li key={n}>
            <img src={rutaImagen(i.img)} alt="" width="48" height="48" loading="lazy" />
            <span className="seguimiento-nom">
              {i.nom}
              <small className="num">
                {i.cant} u. × {plata(i.unit)}
                {i.esMayor ? " (por mayor)" : ""}
              </small>
            </span>
            <span className="num seguimiento-sub">{plata(i.sub)}</span>
          </li>
        ))}
      </ul>
      <p className="seguimiento-total num">
        Total <b>{plata(p.total)}</b> <small>(sin envío)</small>
      </p>
      {p.ahorro > 0 && <p className="seguimiento-ahorro num">Ahorraste {plata(p.ahorro)} por comprar por mayor</p>}
      <p className="seguimiento-datos">
        Entrega: {p.entrega} · Pago: {p.pago}
      </p>

      {numeroWhatsAppValido(config.whatsapp) && (
        <a className="btn bg-success" href={consulta} target="_blank" rel="noopener noreferrer">
          Consultar por este pedido
        </a>
      )}
    </section>
  );
};
