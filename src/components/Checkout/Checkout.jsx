import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { plata } from "../../utils/precios";
import {
  armarMensaje,
  DATOS_VACIOS,
  formaDeEntrega,
  numeroWhatsAppValido,
  sanearDatos,
  URL_LARGA,
  urlWhatsApp,
  validarDatos,
} from "../../utils/pedido";
import { hayServidor, llamarTienda, urlSeguimiento } from "../../services/tienda";
import { CONDICIONES_FISCALES, sanearFiscal, validarFiscal } from "../../compartido/fiscal";
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

const ORDEN_CAMPOS = ["nombre", "telefono", "email", "entrega", "direccion", "pago", "cuit", "razon_social"];
const ESPACIO_DURO = String.fromCharCode(160);

// El pedido ya quedó guardado: el número, el link de seguimiento y el aviso
// por WhatsApp (que ahora es opcional: la tienda ya lo tiene en el panel).
const PedidoRegistrado = ({ registro, config, titulo, refTitulo }) => {
  const [copiado, setCopiado] = useState("");
  const wa = numeroWhatsAppValido(config.whatsapp);
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(registro.seguimiento);
      setCopiado("Link copiado.");
    } catch {
      setCopiado(`El link es ${registro.seguimiento}`);
    }
  };
  return (
    <section className="registrado">
      {titulo}
      <div className="registrado-sello" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1 ref={refTitulo} tabIndex={-1}>
        ¡Recibimos tu pedido <span className="num">#{registro.numero}</span>!
      </h1>
      <p className="registrado-total num">Total {plata(registro.total)} (sin envío)</p>
      <p>
        Te vamos a escribir al <b>{registro.telefono}</b> para confirmar el stock, la entrega y el pago.
      </p>
      <div className="registrado-acciones">
        {wa && (
          <a className="btn bg-success" href={registro.urlWa} target="_blank" rel="noopener noreferrer">
            Avisar por WhatsApp
          </a>
        )}
        <Link to={`/pedido/${registro.token}`} className="btn bg-outline">
          Ver cómo va mi pedido
        </Link>
      </div>
      {wa && <p className="nota">Si nos avisás por WhatsApp lo vemos al toque: el mensaje ya va escrito.</p>}
      <p className="nota">
        Guardá el link de seguimiento: ahí ves si ya lo confirmamos y cómo pagarlo.{" "}
        <button type="button" className="btn-link" onClick={copiarLink}>
          Copiar link
        </button>
      </p>
      <p className="nota-estado" role="status">
        {copiado}
      </p>
      <Link to="/" className="volver">
        Seguir mirando el catálogo
      </Link>
    </section>
  );
};

export const Checkout = () => {
  const { resumen, config, productosListos, errorProductos, vaciar } = useCart();
  const [guardados, setDatos] = useState(leerGuardados);
  const [intentado, setIntentado] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [terminado, setTerminado] = useState(false);
  // Con servidor: el pedido se guarda antes de ir a WhatsApp.
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState(null);
  const [erroresServidor, setErroresServidor] = useState({});
  const [registro, setRegistro] = useState(null);
  const refRegistro = useRef(null);
  const refError = useRef(null);
  const refTelefono = useRef(null);
  const refEmail = useRef(null);
  const refNombre = useRef(null);
  const refEntrega = useRef(null);
  const refDireccion = useRef(null);
  const refPago = useRef(null);
  const refCuit = useRef(null);
  const refRazon = useRef(null);
  // Factura: consumidor final (lo común) o a nombre de un CUIT.
  const [factura, setFactura] = useState({ conCuit: false, condicion: "responsable_inscripto", cuit: "", nombre: "" });
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

  if (registro) {
    return <PedidoRegistrado registro={registro} config={config} titulo={titulo} refTitulo={refRegistro} />;
  }

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

  // Se ofrece solo si el negocio factura (y con servidor: sin él no hay factura).
  const pideFactura = hayServidor && Boolean(config.emite_factura);
  const fiscal = pideFactura && factura.conCuit ? sanearFiscal({ condicion: factura.condicion, cuit: factura.cuit, nombre: factura.nombre }) : null;
  const erroresLocales = { ...validarDatos(datos, config), ...(fiscal ? validarFiscal(fiscal) : {}) };
  const errores = { ...erroresServidor, ...erroresLocales };
  const valido = Object.keys(erroresLocales).length === 0;
  const mensaje = armarMensaje(resumen, datos, config);
  const url = urlWhatsApp(mensaje, config);
  const entrega = formaDeEntrega(datos.entrega, config);
  const error = (campo) => (intentado ? errores[campo] : undefined);
  const cambiar = (campo) => (e) => {
    setDatos({ ...datos, [campo]: e.target.value });
    // Lo que objetó el servidor sobre este campo deja de valer al corregirlo.
    if (erroresServidor[campo]) {
      setErroresServidor((previos) => {
        const resto = { ...previos };
        delete resto[campo];
        return resto;
      });
    }
  };

  const cambiarFactura = (campo) => (e) => {
    setFactura({ ...factura, [campo]: e.target.value });
    const clave = campo === "nombre" ? "razon_social" : campo;
    if (erroresServidor[clave]) {
      setErroresServidor((previos) => {
        const resto = { ...previos };
        delete resto[clave];
        return resto;
      });
    }
  };

  // Si falta algo, se muestran los errores y el foco va al primer campo mal.
  const revisar = () => {
    if (valido) return true;
    setIntentado(true);
    const campos = { nombre: refNombre, telefono: refTelefono, email: refEmail, entrega: refEntrega, direccion: refDireccion, pago: refPago, cuit: refCuit, razon_social: refRazon };
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

  // Con servidor: el pedido se guarda (el servidor recalcula los precios y le
  // pone número), el carrito se vacía y se ofrece avisar por WhatsApp.
  const hacerPedido = async () => {
    if (!revisar() || enviando) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      // Solo lo que entra en el total: sin lo pausado o agotado que haya
      // quedado en el carrito (el carrito lo muestra aparte).
      const carrito = resumen.items.map((i) => ({ id: i.p.id, cant: i.cant }));
      const r = await llamarTienda("pedido.crear", { carrito, cliente: datos, ...(fiscal ? { fiscal } : {}) });
      const seguimiento = urlSeguimiento(r.token);
      const conNumero = armarMensaje(resumen, datos, config, { numero: r.numero, seguimiento });
      flushSync(() => {
        setRegistro({ ...r, seguimiento, telefono: datos.telefono.trim(), urlWa: urlWhatsApp(conNumero, config) });
        vaciar();
        setDatos({ ...datos, comentarios: "" });
      });
      refRegistro.current?.focus();
    } catch (err) {
      const deCampos = err.detalle?.errores;
      if (deCampos) {
        setErroresServidor(deCampos);
        setIntentado(true);
      }
      flushSync(() => setErrorServidor(err));
      refError.current?.focus();
    } finally {
      setEnviando(false);
    }
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

      {/* Sin servidor, el pedido solo viaja por WhatsApp: con el número de
          ejemplo no le llega a nadie. Con servidor queda guardado en el panel. */}
      {!hayServidor && !numeroWhatsAppValido(config.whatsapp) && (
        <p className="checkout-config" role="note">
          ⚠️ El número de WhatsApp de la tienda todavía es el de ejemplo (en <code>src/config.js</code>): los
          pedidos no van a llegar a nadie.
        </p>
      )}

      <div className="checkout-layout">
        <form className="checkout-form" noValidate onSubmit={(e) => e.preventDefault()}>
          <p className="checkout-intro">
            {hayServidor ? "Tus datos solo los ve la tienda, para coordinar la entrega." : "Tus datos van en el mensaje, junto con el pedido."}
          </p>

          <div className="campo">
            <label htmlFor="c-nombre">
              Nombre <span className="req">(obligatorio)</span>
            </label>
            <input
              ref={refNombre}
              id="c-nombre"
              type="text"
              autoComplete="name"
              value={datos.nombre}
              onChange={cambiar("nombre")}
              aria-invalid={Boolean(error("nombre"))}
              aria-describedby={ayuda("nombre")}
            />
            {error("nombre") && <p id="error-nombre" className="error">{errores.nombre}</p>}
          </div>

          <div className="campo">
            <label htmlFor="c-telefono">
              Teléfono (WhatsApp) <span className="req">(obligatorio)</span>
            </label>
            <input
              ref={refTelefono}
              id="c-telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={datos.telefono}
              onChange={cambiar("telefono")}
              aria-invalid={Boolean(error("telefono"))}
              aria-describedby={[ayuda("telefono"), "nota-telefono"].filter(Boolean).join(" ")}
            />
            <p id="nota-telefono" className="nota-campo">Para coordinar la entrega. Ej.: 11 4567-8901.</p>
            {error("telefono") && <p id="error-telefono" className="error">{errores.telefono}</p>}
          </div>

          <div className="campo">
            <label htmlFor="c-email">
              Email <span className="opc">(opcional)</span>
            </label>
            <input
              ref={refEmail}
              id="c-email"
              type="email"
              inputMode="email"
              autoComplete="email"
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

          {pideFactura && (
            <fieldset className="campo">
              <legend>
                Factura <span className="opc">(sale sola cuando pagás)</span>
              </legend>
              <label className="opcion">
                <input type="radio" name="factura" checked={!factura.conCuit} onChange={() => setFactura({ ...factura, conCuit: false })} />
                Consumidor final
              </label>
              <label className="opcion">
                <input type="radio" name="factura" checked={factura.conCuit} onChange={() => setFactura({ ...factura, conCuit: true })} />
                Con CUIT (para tu negocio o para deducirla)
              </label>
              {factura.conCuit && (
                <div className="factura-cuit">
                  <div className="campo">
                    <label htmlFor="c-cuit">
                      CUIT <span className="req">(obligatorio)</span>
                    </label>
                    <input
                      ref={refCuit}
                      id="c-cuit"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={factura.cuit}
                      onChange={cambiarFactura("cuit")}
                      aria-invalid={Boolean(error("cuit"))}
                      aria-describedby={[ayuda("cuit"), "nota-cuit"].filter(Boolean).join(" ")}
                    />
                    <p id="nota-cuit" className="nota-campo">11 números. Ej.: 20-12345678-6.</p>
                    {error("cuit") && <p id="error-cuit" className="error">{errores.cuit}</p>}
                  </div>
                  <div className="campo">
                    <label htmlFor="c-condicion">Condición ante el IVA</label>
                    <select id="c-condicion" value={factura.condicion} onChange={cambiarFactura("condicion")}>
                      {Object.entries(CONDICIONES_FISCALES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor="c-razon">
                      Nombre o razón social <span className="req">(obligatorio)</span>
                    </label>
                    <input
                      ref={refRazon}
                      id="c-razon"
                      type="text"
                      autoComplete="organization"
                      value={factura.nombre}
                      onChange={cambiarFactura("nombre")}
                      aria-invalid={Boolean(error("razon_social"))}
                      aria-describedby={ayuda("razon_social")}
                    />
                    {error("razon_social") && <p id="error-razon_social" className="error">{errores.razon_social}</p>}
                  </div>
                </div>
              )}
            </fieldset>
          )}

          <div className="campo">
            <label htmlFor="c-comentarios">
              Comentarios <span className="opc">(opcional)</span>
            </label>
            <textarea
              id="c-comentarios"
              rows={3}
              maxLength={500}
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
          {errorServidor && (
            <div className="checkout-error" role="alert" ref={refError} tabIndex={-1}>
              <p>{errorServidor.message}</p>
              {errorServidor.detalle?.id && (
                <Link to="/cart" className="btn bg-outline">
                  Revisar el carrito
                </Link>
              )}
              {errorServidor.deConexion && numeroWhatsAppValido(config.whatsapp) && (
                <p>
                  Si sigue fallando, mandalo directo:{" "}
                  <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setEnviado(true)}>
                    enviar el pedido por WhatsApp
                  </a>
                  .
                </p>
              )}
            </div>
          )}
          <div className="acciones">
            {hayServidor ? (
              <button type="button" className="btn bg-success" onClick={hacerPedido} disabled={enviando} aria-busy={enviando}>
                {enviando ? "Enviando tu pedido…" : "Hacer el pedido"}
              </button>
            ) : (
              <a className="btn bg-success" href={url} target="_blank" rel="noopener noreferrer" onClick={enviar}>
                Enviar pedido por WhatsApp
              </a>
            )}
            <button type="button" className="btn bg-outline" onClick={copiar}>
              Copiar pedido
            </button>
          </div>
          <p className="nota-estado" role="status" aria-live="polite">
            {copiado}
          </p>
          <p className="nota">
            {hayServidor
              ? "Te damos un número de pedido y un link para seguirlo. Cuando confirmemos el stock y el envío, lo pagás desde ese link."
              : "Se abre WhatsApp con el mensaje ya escrito: solo tenés que apretar Enviar. El stock, el envío y el pago se confirman en el chat."}
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
