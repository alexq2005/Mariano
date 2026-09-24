import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { estadoDe, leerSeguimiento } from "../../services/pedidos";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import "./Seguimiento.css";

// /pedido/:token — lo que ve la clienta después de confirmar, y cada vez que
// vuelva a abrir el link. El token (128 bits al azar) es la llave: quien no
// lo tiene no puede ver el pedido, y acá no hay datos personales.

const fecha = (iso) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export const Seguimiento = () => {
  const { token } = useParams();
  const { state, pathname } = useLocation();
  const navigate = useNavigate();
  // "¡Gracias!" solo la vez que llega desde el checkout. El navegador guarda
  // el estado de la navegación al recargar, así que se lee una vez y se borra.
  const [recien] = useState(() => state?.recien === true);
  const { config } = useProductos();
  const [carga, setCarga] = useState({ estado: "cargando" });
  const titulo = useRef(null);

  useEffect(() => {
    if (state?.recien) navigate(pathname, { replace: true, state: null });
  }, [state, pathname, navigate]);

  useEffect(() => {
    let vigente = true;
    leerSeguimiento(token)
      .then((pedido) => vigente && setCarga(pedido ? { estado: "listo", pedido } : { estado: "no-existe" }))
      .catch(() => vigente && setCarga({ estado: "error" }));
    return () => {
      vigente = false;
    };
  }, [token]);

  // Recién confirmado: el foco va al título, que es lo primero que se lee.
  useEffect(() => {
    if (carga.estado === "listo") titulo.current?.focus();
  }, [carga.estado]);

  const tienda = config?.nombre_negocio ?? "la tienda";

  if (carga.estado === "cargando") return <p className="estado">Buscando tu pedido…</p>;

  if (carga.estado !== "listo") {
    return (
      <section className="estado">
        <title>{`Pedido | ${tienda}`}</title>
        <h1>{carga.estado === "error" ? "No pudimos cargar el pedido" : "No encontramos ese pedido"}</h1>
        <p>
          {carga.estado === "error"
            ? "Revisá tu conexión y volvé a abrir el link."
            : "Puede que el link esté incompleto o que ya haya vencido (duran 90 días)."}
        </p>
        <Link to="/" className="btn bg-primary">
          Ver el catálogo
        </Link>
      </section>
    );
  }

  const { pedido } = carga;
  const estado = estadoDe(pedido.estado);
  const whatsapp = config && numeroWhatsAppValido(config.whatsapp);

  return (
    <section className="seguimiento">
      <title>{`Pedido N° ${pedido.numero} | ${tienda}`}</title>
      <h1 ref={titulo} tabIndex={-1}>
        {recien ? "¡Gracias! Recibimos tu pedido" : `Pedido N° ${pedido.numero}`}
      </h1>

      <div className="seguimiento-tarjeta">
        <p className="seguimiento-cabecera">
          <span>
            Pedido <strong className="num">N° {pedido.numero}</strong> · {fecha(pedido.creado)}
          </span>
          <span className="seguimiento-estado">{estado.nombre}</span>
        </p>
        {estado.detalle && <p className="seguimiento-detalle">{estado.detalle}</p>}

        <ul className="seguimiento-items">
          {pedido.items.map((i, n) => (
            <li key={n}>
              <span>
                {i.cant} × {i.nom}
              </span>
              <span className="num">{plata(i.sub)}</span>
            </li>
          ))}
        </ul>
        <p className="seguimiento-total">
          <span>Total</span>
          <strong className="num">{plata(pedido.total)}</strong>
        </p>
        <p className="nota">Sin envío. Entrega: {pedido.entrega}. Pago: {pedido.pago}.</p>
      </div>

      <p className="seguimiento-guardar">
        <strong>Guardá este link</strong> (o agregalo a favoritos): con él podés ver cómo va tu pedido.
      </p>

      <div className="acciones">
        {whatsapp && (
          <a
            className="btn bg-success"
            href={urlWhatsApp(`Hola ${tienda}! Te escribo por mi pedido N° ${pedido.numero}.`, config)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultar por WhatsApp
          </a>
        )}
        <Link to="/" className="btn bg-outline">
          Seguir mirando el catálogo
        </Link>
      </div>
    </section>
  );
};
