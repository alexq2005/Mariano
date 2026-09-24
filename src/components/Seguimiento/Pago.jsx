import { useState } from "react";
import { llamarTienda, urlSeguimiento } from "../../services/tienda";
import { plata } from "../../utils/precios";
import { numeroWhatsAppValido, urlWhatsApp } from "../../utils/pedido";

// Un dato para copiar (alias, CBU, monto): en el celular, copiar y pegar en
// la app del banco es lo que hace cualquiera.
const Copiable = ({ etiqueta, valor, mostrar = valor, avisar }) => {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(valor));
      avisar(`${etiqueta} copiado.`);
    } catch {
      avisar(`${etiqueta}: ${valor}`);
    }
  };
  return (
    <div className="dato">
      <dt>{etiqueta}</dt>
      <dd>
        <span className="dato-valor">{mostrar}</span>
        <button type="button" className="btn-copiar" onClick={copiar} aria-label={`Copiar ${etiqueta.toLowerCase()}`}>
          Copiar
        </button>
      </dd>
    </div>
  );
};

// "Pagá tu pedido": aparece cuando el negocio lo confirma. Con Mercado Pago
// (tarjetas, dinero en cuenta, efectivo) se marca solo; por transferencia,
// la clienta manda el comprobante y el negocio lo marca.
export const Pago = ({ p, token, config, verificando }) => {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const cobro = p.cobro?.estado ?? "sin_pagar";
  const detalle = p.cobro?.detalle;
  const aCobrar = p.aCobrar ?? p.total;
  const wa = numeroWhatsAppValido(config.whatsapp);

  if (p.estado === "cancelado") {
    if (cobro === "aprobado") return <p className="pago-nota">Si ya pagaste, te devolvemos la plata. Cualquier duda, escribinos.</p>;
    if (cobro === "devuelto") {
      return <p className="pago-nota">Te devolvimos el pago. Según el medio, puede tardar unos días en verse en tu cuenta o resumen.</p>;
    }
    return null;
  }

  if (p.estado === "pendiente") {
    return (
      <section className="pago" aria-labelledby="pago-titulo">
        <h2 id="pago-titulo">Pago</h2>
        <p className="pago-nota">Cuando confirmemos tu pedido te mostramos acá el total con el envío y cómo pagarlo.</p>
      </section>
    );
  }

  const estadoPago = {
    aprobado: { clase: "ok", titulo: "Pagado", texto: detalle },
    pendiente: {
      clase: "espera",
      titulo: "Pago en proceso",
      texto: `${detalle ? `${detalle}. ` : ""}Si pagaste en efectivo, se acredita en unas horas: esta página se actualiza sola cuando entra.`,
    },
    reclamo: { clase: "espera", titulo: "Pago con un reclamo abierto", texto: "Lo estamos viendo con Mercado Pago. Si tenés dudas, escribinos." },
    devuelto: { clase: "espera", titulo: "Pago devuelto", texto: "Según el medio, puede tardar unos días en verse en tu cuenta o resumen." },
  }[cobro];

  if (verificando) {
    return (
      <section className="pago" aria-labelledby="pago-titulo">
        <h2 id="pago-titulo">Pago</h2>
        <p className="pago-estado" data-clase="espera" role="status">
          Estamos confirmando tu pago con Mercado Pago…
        </p>
      </section>
    );
  }

  if (estadoPago) {
    return (
      <section className="pago" aria-labelledby="pago-titulo">
        <h2 id="pago-titulo">Pago</h2>
        <p className="pago-estado" data-clase={estadoPago.clase} role="status">
          <b>
            {estadoPago.titulo}
            {cobro === "aprobado" && <span className="num"> · {plata(aCobrar)}</span>}
          </b>
          {estadoPago.texto && <span>{estadoPago.texto}</span>}
        </p>
      </section>
    );
  }

  // Sin pagar (o el último intento se rechazó): cómo pagar.
  const pagar = p.pagar ?? {};
  const t = pagar.transferencia;
  const irAMercadoPago = async () => {
    setYendo(true);
    setError("");
    try {
      const { url } = await llamarTienda("pago.iniciar", { token, volverA: urlSeguimiento(token) });
      window.location.assign(url);
    } catch (err) {
      setError(err.message);
      setYendo(false);
    }
  };
  const comprobante = urlWhatsApp(`Hola! Te mando el comprobante de la transferencia del pedido #${p.numero} (${plata(aCobrar)}).`, config);

  return (
    <section className="pago" aria-labelledby="pago-titulo">
      <h2 id="pago-titulo">Pagá tu pedido</h2>
      {cobro === "rechazado" && (
        <p className="pago-estado" data-clase="error" role="alert">
          <b>El último intento de pago no se aprobó.</b>
          <span>Probá con otra tarjeta u otro medio. No se te cobró nada.</span>
        </p>
      )}
      <dl className="pago-cuenta num">
        <div>
          <dt>Productos</dt>
          <dd>{plata(p.total)}</dd>
        </div>
        {p.envio > 0 && (
          <div>
            <dt>Envío</dt>
            <dd>{plata(p.envio)}</dd>
          </div>
        )}
        <div className="pago-total">
          <dt>Total a pagar</dt>
          <dd>{plata(aCobrar)}</dd>
        </div>
      </dl>

      {pagar.mercadopago && (
        <div className="pago-opcion">
          <button type="button" className="btn bg-primary" onClick={irAMercadoPago} disabled={yendo}>
            {yendo ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}
          </button>
          <p className="pago-medios">Tarjeta de crédito o débito, dinero en cuenta o efectivo en Rapipago / Pago Fácil.</p>
          {error && (
            <p className="pago-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {t && (
        <div className="pago-opcion">
          <h3>{pagar.mercadopago ? "O por transferencia" : "Por transferencia"}</h3>
          <p className="pago-medios">Desde cualquier banco o billetera (Mercado Pago, Ualá, Naranja X, Brubank…).</p>
          <dl className="datos">
            {t.alias && <Copiable etiqueta="Alias" valor={t.alias} avisar={setAviso} />}
            {/* Se lee en los dos bloques del CBU (8 + 14); se copia entero. */}
            {t.cbu && <Copiable etiqueta="CBU / CVU" valor={t.cbu} mostrar={`${t.cbu.slice(0, 8)} ${t.cbu.slice(8)}`} avisar={setAviso} />}
            <Copiable etiqueta="Monto" valor={aCobrar} mostrar={plata(aCobrar)} avisar={setAviso} />
            {t.titular && (
              <div className="dato">
                <dt>Titular</dt>
                <dd>{t.titular}</dd>
              </div>
            )}
            {t.banco && (
              <div className="dato">
                <dt>Banco</dt>
                <dd>{t.banco}</dd>
              </div>
            )}
          </dl>
          <p className="pago-aviso" role="status">
            {aviso}
          </p>
          {wa && (
            <a className="btn bg-success" href={comprobante} target="_blank" rel="noopener noreferrer">
              Mandar el comprobante por WhatsApp
            </a>
          )}
        </div>
      )}

      {!pagar.mercadopago && !t && <p className="pago-nota">Coordinamos el pago por WhatsApp.</p>}
    </section>
  );
};
