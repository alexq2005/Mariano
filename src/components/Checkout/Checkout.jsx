import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plata } from "../../utils/precios";
import { DATOS_VACIOS, formaDeEntrega, LARGOS, sanearDatos, validarDatos } from "../../utils/pedido";
import { crearPedido, nuevaSolicitud } from "../../services/pedidos";
import { recargarProductos } from "../../services/productos";
import { CatalogError } from "../CatalogError/CatalogError";
import "./Checkout.css";

// Los datos del formulario sobreviven a ir y volver del carrito (solo en
// esta pestaña: sessionStorage se borra al cerrarla). Se leen tal cual y se
// sanean más abajo, cuando ya está la config: las formas de entrega y de
// pago vigentes salen de ella, y puede llegar después que el formulario.
const CLAVE_DATOS = "aurora.checkout.v1";
const leerGuardados = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_DATOS) ?? "{}");
  } catch {
    // Copia, no la constante compartida: lo que sale de acá va al estado del
    // componente, y DATOS_VACIOS lo usan también pedido.js y sus tests.
    return { ...DATOS_VACIOS };
  }
};

// El código de este intento de compra. Se guarda en la pestaña: si se corta
// la red justo después de confirmar y la clienta reintenta, el servidor
// reconoce el código y devuelve el pedido que ya había hecho, en vez de
// crear otro igual.
const CLAVE_SOLICITUD = "aurora.checkout.solicitud.v1";
const leerSolicitud = () => {
  try {
    const guardada = sessionStorage.getItem(CLAVE_SOLICITUD);
    if (guardada) return guardada;
    const nueva = nuevaSolicitud();
    sessionStorage.setItem(CLAVE_SOLICITUD, nueva);
    return nueva;
  } catch {
    return nuevaSolicitud();
  }
};
const olvidarCheckout = () => {
  try {
    sessionStorage.removeItem(CLAVE_DATOS);
    sessionStorage.removeItem(CLAVE_SOLICITUD);
  } catch {
    /* sin almacenamiento: no había nada guardado */
  }
};

const ORDEN_CAMPOS = ["nombre", "telefono", "email", "entrega", "direccion", "pago"];

export const Checkout = () => {
  const { resumen, config, productosListos, errorProductos, vaciar } = useCart();
  const navigate = useNavigate();
  const [guardados, setDatos] = useState(leerGuardados);
  const [solicitud] = useState(leerSolicitud);
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [erroresServidor, setErroresServidor] = useState({});
  const refNombre = useRef(null);
  const refTelefono = useRef(null);
  const refEmail = useRef(null);
  const refEntrega = useRef(null);
  const refDireccion = useRef(null);
  const refPago = useRef(null);
  const refAviso = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_DATOS, JSON.stringify(guardados));
    } catch {
      /* sin almacenamiento: el formulario funciona igual */
    }
  }, [guardados]);

  if (!productosListos) return <p className="estado">Cargando…</p>;
  if (errorProductos) return <CatalogError mensaje={errorProductos} />;

  // De acá para abajo la config ya llegó: viaja junto con el catálogo.
  const titulo = <title>{`Finalizar pedido | ${config.nombre_negocio}`}</title>;
  const datos = sanearDatos(guardados, config);

  if (!resumen.items.length) {
    return (
      <section className="estado">
        {titulo}
        <h1>Tu carrito está vacío</h1>
        <p>Agregá productos antes de hacer el pedido.</p>
        <Link to="/" className="btn bg-primary">
          Ver el catálogo
        </Link>
      </section>
    );
  }
  if (resumen.faltaMinimo > 0) {
    return (
      <section className="estado">
        {titulo}
        <h1>Todavía no llegás al pedido mínimo</h1>
        <p>
          Te faltan {plata(resumen.faltaMinimo)} para el mínimo de {plata(config.pedido_minimo)}.
        </p>
        <Link to="/cart" className="btn bg-primary">
          Volver al carrito
        </Link>
      </section>
    );
  }

  // Los errores del servidor mandan (su validación es la que vale), pero se
  // borran apenas la clienta toca el campo.
  const errores = { ...validarDatos(datos, config), ...erroresServidor };
  const valido = Object.keys(errores).length === 0;
  const entrega = formaDeEntrega(datos.entrega, config);
  const error = (campo) => (intentado ? errores[campo] : undefined);
  const cambiar = (campo) => (e) => {
    setDatos({ ...datos, [campo]: e.target.value });
    if (erroresServidor[campo]) {
      setErroresServidor((previos) => Object.fromEntries(Object.entries(previos).filter(([c]) => c !== campo)));
    }
  };

  // Si falta algo, se muestran los errores y el foco va al primer campo mal.
  const revisar = () => {
    if (valido) return true;
    setIntentado(true);
    const campos = {
      nombre: refNombre,
      telefono: refTelefono,
      email: refEmail,
      entrega: refEntrega,
      direccion: refDireccion,
      pago: refPago,
    };
    const primero = ORDEN_CAMPOS.find((c) => errores[c]);
    campos[primero]?.current?.focus();
    return false;
  };

  const avisar = (texto) => {
    setErrorEnvio(texto);
    // Al próximo render el aviso ya está en pantalla: se le lleva el foco.
    setTimeout(() => refAviso.current?.focus(), 0);
  };

  // El pedido se guarda en el servidor, que recalcula todo. Si algo cambió
  // desde que la clienta cargó la página (precios, un producto pausado), se
  // recarga el catálogo, el resumen se pone al día solo y se le avisa.
  const confirmar = async (e) => {
    e.preventDefault();
    if (enviando || !revisar()) return;
    setEnviando(true);
    setErrorEnvio("");
    try {
      const pedido = await crearPedido({
        items: resumen.items.map((i) => ({ id: i.p.id, cant: i.cant })),
        cliente: datos,
        totalVisto: resumen.total,
        solicitud,
      });
      olvidarCheckout();
      navigate(`/pedido/${pedido.seguimiento}`, { replace: true, state: { recien: true } });
      vaciar();
    } catch (err) {
      setEnviando(false);
      if (err.detalles?.errores) {
        setErroresServidor(err.detalles.errores);
        setIntentado(true);
        avisar("Revisá los datos marcados.");
      } else if (err.detalles?.noDisponibles || err.detalles?.total !== undefined) {
        await recargarProductos();
        avisar(
          err.detalles.noDisponibles
            ? "Algunos productos se agotaron o ya no están: los sacamos del pedido. Revisá el total y confirmá de nuevo."
            : "Los precios se actualizaron recién. Revisá el total y confirmá de nuevo.",
        );
      } else {
        avisar(err.message || "No se pudo hacer el pedido. Probá de nuevo.");
      }
    }
  };

  const ayuda = (campo) => (error(campo) ? `error-${campo}` : undefined);

  return (
    <section className="checkout">
      {titulo}
      <h1>Finalizar pedido</h1>

      <div className="checkout-layout">
        <form id="checkout-form" className="checkout-form" noValidate onSubmit={confirmar}>
          <p className="checkout-intro">Usamos tus datos solo para este pedido: para confirmarlo y coordinar la entrega.</p>

          <div className="campo">
            <label htmlFor="c-nombre">
              Nombre <span className="req">(obligatorio)</span>
            </label>
            <input
              ref={refNombre}
              id="c-nombre"
              type="text"
              autoComplete="name"
              maxLength={LARGOS.nombre}
              value={datos.nombre}
              onChange={cambiar("nombre")}
              aria-invalid={Boolean(error("nombre"))}
              aria-describedby={ayuda("nombre")}
            />
            {error("nombre") && <p id="error-nombre" className="error">{errores.nombre}</p>}
          </div>

          <div className="campo">
            <label htmlFor="c-telefono">
              Teléfono <span className="req">(obligatorio)</span>
            </label>
            <input
              ref={refTelefono}
              id="c-telefono"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={LARGOS.telefono}
              value={datos.telefono}
              onChange={cambiar("telefono")}
              aria-invalid={Boolean(error("telefono"))}
              aria-describedby={ayuda("telefono")}
            />
            {error("telefono") && <p id="error-telefono" className="error">{errores.telefono}</p>}
          </div>

          <div className="campo">
            <label htmlFor="c-email">
              Email <span className="req">(obligatorio)</span>
            </label>
            <input
              ref={refEmail}
              id="c-email"
              type="email"
              autoComplete="email"
              maxLength={LARGOS.email}
              value={datos.email}
              onChange={cambiar("email")}
              aria-invalid={Boolean(error("email"))}
              aria-describedby={ayuda("email")}
            />
            {error("email") && <p id="error-email" className="error">{errores.email}</p>}
          </div>

          <fieldset className="campo" aria-describedby={ayuda("entrega")}>
            <legend>
              ¿Cómo lo recibís? <span className="req">(obligatorio)</span>
            </legend>
            {config.formas_entrega.map((f, i) => (
              <label key={f.id} className="opcion">
                <input
                  ref={i === 0 ? refEntrega : undefined}
                  type="radio"
                  name="entrega"
                  value={f.id}
                  checked={datos.entrega === f.id}
                  onChange={cambiar("entrega")}
                  aria-invalid={Boolean(error("entrega"))}
                />
                {f.nombre}
              </label>
            ))}
            {error("entrega") && <p id="error-entrega" className="error">{errores.entrega}</p>}
          </fieldset>

          {entrega?.pide_direccion && (
            <div className="campo">
              <label htmlFor="c-direccion">
                Zona o dirección <span className="req">(obligatorio)</span>
              </label>
              <input
                ref={refDireccion}
                id="c-direccion"
                type="text"
                autoComplete="street-address"
                maxLength={LARGOS.direccion}
                value={datos.direccion}
                onChange={cambiar("direccion")}
                aria-invalid={Boolean(error("direccion"))}
                aria-describedby={[ayuda("direccion"), "nota-envio"].filter(Boolean).join(" ")}
              />
              <p id="nota-envio" className="nota-campo">El costo del envío se cotiza según la zona, antes de pagar.</p>
              {error("direccion") && <p id="error-direccion" className="error">{errores.direccion}</p>}
            </div>
          )}

          <fieldset className="campo" aria-describedby={ayuda("pago")}>
            <legend>
              ¿Cómo pagás? <span className="req">(obligatorio)</span>
            </legend>
            {config.formas_pago.map((f, i) => (
              <label key={f} className="opcion">
                <input
                  ref={i === 0 ? refPago : undefined}
                  type="radio"
                  name="pago"
                  value={f}
                  checked={datos.pago === f}
                  onChange={cambiar("pago")}
                  aria-invalid={Boolean(error("pago"))}
                />
                {f}
              </label>
            ))}
            {error("pago") && <p id="error-pago" className="error">{errores.pago}</p>}
          </fieldset>

          <div className="campo">
            <label htmlFor="c-comentarios">
              Comentarios <span className="opc">(opcional)</span>
            </label>
            <textarea
              id="c-comentarios"
              rows={3}
              maxLength={LARGOS.comentarios}
              value={datos.comentarios}
              onChange={cambiar("comentarios")}
              placeholder="Horario para retirar, tonos que preferís, etc."
            />
          </div>
        </form>

        <div className="checkout-pedido">
          <h2>Tu pedido</h2>
          <ul className="checkout-items">
            {resumen.items.map((i) => (
              <li key={i.p.id}>
                <span>
                  {i.cant} × {i.p.nom}
                  {i.esMayor && <span className="checkout-mayor"> · por mayor</span>}
                </span>
                <span className="num">{plata(i.sub)}</span>
              </li>
            ))}
          </ul>
          <p className="checkout-total">
            <span>Total</span>
            <strong className="num">{plata(resumen.total)}</strong>
          </p>
          {resumen.ahorro > 0 && <p className="nota">Ahorrás {plata(resumen.ahorro)} por comprar por mayor.</p>}
          <p className="nota">No incluye el envío: se cotiza según la zona.</p>

          {errorEnvio && (
            <p ref={refAviso} tabIndex={-1} className="checkout-aviso" role="alert">
              {errorEnvio}
            </p>
          )}
          <div className="acciones">
            <button type="submit" form="checkout-form" className="btn bg-success" disabled={enviando}>
              {enviando ? "Enviando pedido…" : "Confirmar pedido"}
            </button>
          </div>
          <p className="nota">
            Te damos un número de pedido y un link para seguirlo. Stock, envío y pago se confirman después, antes de
            pagar nada.
          </p>
          <Link to="/cart" className="volver">
            Volver al carrito
          </Link>
        </div>
      </div>
    </section>
  );
};
