import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { hayServidor, llamarTienda } from "../../services/tienda";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";
import "../Checkout/Checkout.css";
import "./Arrepentimiento.css";

const VACIO = { numero: "", nombre: "", contacto: "", motivo: "" };

// Botón de arrepentimiento (Disp. 954/2025): quien compró como consumidora
// final puede arrepentirse dentro de los 10 días de recibir el pedido, sin
// dar explicaciones. Se pide en un paso y se recibe un código de trámite.
export const Arrepentimiento = () => {
  const { config } = useProductos();
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const refNombre = useRef(null);
  const refContacto = useRef(null);
  const refNumero = useRef(null);
  const hecho = useRef(null);

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    const locales = {};
    if (!datos.nombre.trim()) locales.nombre = "Escribí tu nombre.";
    if (datos.contacto.trim().length < 6) locales.contacto = "Dejanos un teléfono o un email para responderte.";
    if (datos.numero.trim() && !/^\d+$/.test(datos.numero.trim())) locales.numero = "El número de pedido son solo números.";
    setErrores(locales);
    const campos = { nombre: refNombre, contacto: refContacto, numero: refNumero };
    const primero = ["nombre", "contacto", "numero"].find((c) => locales[c]);
    if (primero) return campos[primero].current?.focus();

    setEnviando(true);
    setError("");
    try {
      const r = await llamarTienda("arrepentimiento.crear", {
        nombre: datos.nombre,
        contacto: datos.contacto,
        motivo: datos.motivo,
        numero: datos.numero.trim() ? Number(datos.numero.trim()) : null,
      });
      flushSync(() => setCodigo(r.codigo));
      hecho.current?.focus();
    } catch (err) {
      if (err.detalle?.errores) setErrores(err.detalle.errores);
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const titulo = <title>{`Botón de arrepentimiento | ${config.nombre_negocio}`}</title>;
  const wa = numeroWhatsAppValido(config.whatsapp);

  if (codigo) {
    return (
      <section className="arrepentimiento">
        {titulo}
        <h1 ref={hecho} tabIndex={-1}>
          Recibimos tu solicitud
        </h1>
        <p>
          Tu código de trámite es <b className="num arrepentimiento-codigo">{codigo}</b>. Guardalo: te vamos a contactar para
          coordinar la devolución.
        </p>
        <Link to="/" className="btn bg-primary">
          Volver a la tienda
        </Link>
      </section>
    );
  }

  const ayuda = (campo) => (errores[campo] ? `err-${campo}` : undefined);

  return (
    <section className="arrepentimiento">
      {titulo}
      <h1>Botón de arrepentimiento</h1>
      <p>
        Si compraste como consumidora final, podés arrepentirte de la compra dentro de los 10 días corridos desde que
        recibiste el pedido, sin dar explicaciones. Completá tus datos y te contactamos.
      </p>

      {!hayServidor ? (
        <p className="aviso">
          Para arrepentirte de una compra, escribinos
          {wa ? (
            <>
              {" "}por{" "}
              <a href={urlWhatsApp("Hola! Quiero arrepentirme de mi compra.", config)} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </>
          ) : null}
          {" "}con tu nombre y el número de pedido.
        </p>
      ) : (
        <form className="arrepentimiento-form" noValidate onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="a-nombre">
              Nombre <span className="req">(obligatorio)</span>
            </label>
            <input ref={refNombre} id="a-nombre" type="text" autoComplete="name" value={datos.nombre} onChange={cambiar("nombre")}
              aria-invalid={Boolean(errores.nombre)} aria-describedby={ayuda("nombre")} />
            {errores.nombre && <p id="err-nombre" className="error">{errores.nombre}</p>}
          </div>
          <div className="campo">
            <label htmlFor="a-contacto">
              Teléfono o email <span className="req">(obligatorio)</span>
            </label>
            <input ref={refContacto} id="a-contacto" type="text" autoComplete="tel" value={datos.contacto} onChange={cambiar("contacto")}
              aria-invalid={Boolean(errores.contacto)} aria-describedby={ayuda("contacto")} />
            {errores.contacto && <p id="err-contacto" className="error">{errores.contacto}</p>}
          </div>
          <div className="campo">
            <label htmlFor="a-numero">
              Número de pedido <span className="opc">(si lo tenés)</span>
            </label>
            <input ref={refNumero} id="a-numero" type="text" inputMode="numeric" value={datos.numero} onChange={cambiar("numero")}
              aria-invalid={Boolean(errores.numero)} aria-describedby={ayuda("numero")} />
            {errores.numero && <p id="err-numero" className="error">{errores.numero}</p>}
          </div>
          <div className="campo">
            <label htmlFor="a-motivo">
              Comentario <span className="opc">(opcional)</span>
            </label>
            <textarea id="a-motivo" rows={3} maxLength={500} value={datos.motivo} onChange={cambiar("motivo")} />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn bg-primary" disabled={enviando} aria-busy={enviando}>
            {enviando ? "Enviando…" : "Enviar solicitud"}
          </button>
        </form>
      )}
    </section>
  );
};
