import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plata } from "../../utils/precios";
import {
  armarMensaje,
  DATOS_VACIOS,
  formaDeEntrega,
  LARGOS,
  numeroWhatsAppValido,
  sanearDatos,
  URL_LARGA,
  urlWhatsApp,
  validarDatos,
} from "../../utils/pedido";
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

const ORDEN_CAMPOS = ["nombre", "telefono", "email", "entrega", "direccion", "pago"];
const ESPACIO_DURO = String.fromCharCode(160);

export const Checkout = () => {
  const { resumen, config, productosListos, errorProductos, vaciar } = useCart();
  const [guardados, setDatos] = useState(leerGuardados);
  const [intentado, setIntentado] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const refNombre = useRef(null);
  const refTelefono = useRef(null);
  const refEmail = useRef(null);
  const refEntrega = useRef(null);
  const refDireccion = useRef(null);
  const refPago = useRef(null);
  const vistaPrevia = useRef(null);
  const gracias = useRef(null);

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

  if (terminado) {
    return (
      <section className="estado">
        {titulo}
        <h1 ref={gracias} tabIndex={-1}>
          ¡Gracias por tu pedido!
        </h1>
        <p>Te respondemos por WhatsApp para confirmar stock, envío y pago.</p>
        <Link to="/" className="btn bg-primary">
          Volver al catálogo
        </Link>
      </section>
    );
  }
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

  const errores = validarDatos(datos, config);
  const valido = Object.keys(errores).length === 0;
  const mensaje = armarMensaje(resumen, datos, config);
  const url = urlWhatsApp(mensaje, config);
  const entrega = formaDeEntrega(datos.entrega, config);
  const error = (campo) => (intentado ? errores[campo] : undefined);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

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

  const enviar = (e) => {
    if (!revisar()) {
      e.preventDefault();
      return;
    }
    setEnviado(true);
  };

  // Mismo texto dos veces seguidas no se re-anuncia: se alterna un espacio duro.
  const avisarCopia = (texto) => setCopiado((prev) => (prev === texto ? texto + ESPACIO_DURO : texto));

  const copiar = async () => {
    if (!revisar()) return;
    try {
      await navigator.clipboard.writeText(mensaje);
      avisarCopia("Pedido copiado. Pegalo en el chat de WhatsApp de la tienda.");
    } catch {
      // Sin permiso de portapapeles: se deja el texto seleccionado.
      const rango = document.createRange();
      rango.selectNodeContents(vistaPrevia.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rango);
      avisarCopia("No se pudo copiar solo: el texto quedó seleccionado para que lo copies.");
    }
  };

  const ayuda = (campo) => (error(campo) ? `error-${campo}` : undefined);

  return (
    <section className="checkout">
      {titulo}
      <h1>Finalizar pedido</h1>

      {!numeroWhatsAppValido(config.whatsapp) && (
        <p className="checkout-config" role="note">
          ⚠️ El número de WhatsApp de la tienda todavía es el de ejemplo (en <code>src/config.js</code>): los
          pedidos no van a llegar a nadie.
        </p>
      )}

      <div className="checkout-layout">
        <form className="checkout-form" noValidate onSubmit={(e) => e.preventDefault()}>
          <p className="checkout-intro">Tus datos van en el mensaje, junto con el pedido.</p>

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
              <p id="nota-envio" className="nota-campo">El costo del envío se cotiza por WhatsApp según la zona.</p>
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
          <h2>Así va a llegar tu pedido</h2>
          <pre ref={vistaPrevia} className="mensaje num">
            {mensaje}
          </pre>
          {url.length > URL_LARGA && (
            <p className="nota">
              Tu pedido es largo: si WhatsApp no muestra el mensaje completo, usá «Copiar pedido» y pegalo en el chat.
            </p>
          )}
          <div className="acciones">
            <a className="btn bg-success" href={url} target="_blank" rel="noopener noreferrer" onClick={enviar}>
              Enviar pedido por WhatsApp
            </a>
            <button type="button" className="btn bg-outline" onClick={copiar}>
              Copiar pedido
            </button>
          </div>
          <p className="nota-estado" role="status" aria-live="polite">
            {copiado}
          </p>
          <p className="nota">
            Se abre WhatsApp con el mensaje ya escrito: solo tenés que apretar Enviar. El stock, el envío y el pago se
            confirman en el chat.
          </p>
          {enviado && (
            <div className="post-envio">
              <p>¿Ya mandaste el pedido por WhatsApp?</p>
              <button
                type="button"
                className="btn bg-primary"
                onClick={() => {
                  flushSync(() => {
                    vaciar();
                    setTerminado(true);
                  });
                  gracias.current?.focus();
                }}
              >
                Sí, vaciar el carrito
              </button>
            </div>
          )}
          <Link to="/cart" className="volver">
            Volver al carrito
          </Link>
        </div>
      </div>
    </section>
  );
};
