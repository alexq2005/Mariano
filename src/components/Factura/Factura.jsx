import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { renderSVG } from "uqr";
import { leerDocumentoPublico } from "../../services/firestoreRest";
import { hayServidor } from "../../services/tienda";
import { cuitConGuiones } from "../../compartido/fiscal";
import "./Factura.css";

// "20260924" → "24/09/2026"
const fecha = (aaaammdd) => (aaaammdd ? `${aaaammdd.slice(6, 8)}/${aaaammdd.slice(4, 6)}/${aaaammdd.slice(0, 4)}` : "");

// En una factura los importes van con centavos: el IVA discriminado los tiene.
const pesos = (n) => "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A un monotributista con factura A (RG 5003 / Ley 27.618).
const LEYENDA_MONOTRIBUTO =
  "El crédito fiscal discriminado en el presente comprobante sólo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley N° 27.618.";

// /factura/:token — la factura (o nota de crédito) para ver, imprimir o
// guardar en PDF. El token es la llave, como en el seguimiento.
export const Factura = () => {
  const { token } = useParams();
  const tokenValido = hayServidor && /^[0-9a-f]{32}$/.test(token);
  const [leido, setLeido] = useState({ cargando: true, c: null, error: null });
  const estado = tokenValido ? leido : { cargando: false, c: null, error: "no-existe" };

  useEffect(() => {
    if (!tokenValido) return undefined;
    const control = new AbortController();
    leerDocumentoPublico(`comprobantes/${token}`, { signal: control.signal })
      .then((c) => setLeido({ cargando: false, c, error: null }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLeido({ cargando: false, c: null, error: err.status === 404 || err.status === 403 ? "no-existe" : "red" });
      });
    return () => control.abort();
  }, [token, tokenValido]);

  if (estado.cargando) return <p className="estado">Buscando la factura…</p>;
  if (estado.error) {
    return (
      <section className="estado">
        <title>Factura</title>
        <h1>{estado.error === "red" ? "No pudimos cargar la factura" : "No encontramos esa factura"}</h1>
        <p>{estado.error === "red" ? "Revisá tu conexión y probá de nuevo." : "Revisá que el link esté completo."}</p>
        <Link to="/" className="btn bg-primary">
          Ir a la tienda
        </Link>
      </section>
    );
  }

  const c = estado.c;
  const discrimina = c.letra === "A";
  const qr = renderSVG(c.qr, { border: 1, pixelSize: 4 });

  return (
    <section className="factura-pagina">
      <title>{`${c.nombre} ${c.numeroTexto} | ${c.emisor.razon_social}`}</title>
      <meta name="robots" content="noindex, nofollow" />

      <div className="factura-acciones">
        <button type="button" className="btn bg-primary" onClick={() => window.print()}>
          Imprimir o guardar en PDF
        </button>
      </div>

      {c.ambiente === "homologacion" && (
        <p className="factura-prueba" role="note">
          Comprobante de PRUEBA (ambiente de homologación de ARCA): no tiene validez fiscal.
        </p>
      )}

      <article className="factura" aria-label={`${c.nombre} ${c.numeroTexto}`}>
        <p className="factura-original">ORIGINAL</p>
        <header className="factura-cabecera">
          <div className="factura-emisor">
            <p className="factura-razon">{c.emisor.razon_social}</p>
            <p>{c.emisor.domicilio}</p>
            <p>{c.emisor.condicion}</p>
          </div>
          <div className="factura-letra" aria-label={`Letra ${c.letra}, código ${c.codigo}`}>
            <span>{c.letra}</span>
            <small>COD. {c.codigo}</small>
          </div>
          <div className="factura-datos">
            <h1>{c.clase === "nc" ? "Nota de crédito" : "Factura"}</h1>
            <p className="num">
              <b>N.º {c.numeroTexto}</b>
            </p>
            <p>Fecha de emisión: {fecha(c.fechaArca)}</p>
            <p className="num">CUIT: {cuitConGuiones(c.emisor.cuit)}</p>
            {c.emisor.iibb && <p>Ingresos Brutos: {c.emisor.iibb}</p>}
            {c.emisor.inicio && <p>Inicio de actividades: {c.emisor.inicio}</p>}
          </div>
        </header>

        <div className="factura-receptor">
          <p>
            <b>{c.receptor.nombre}</b>
            {c.receptor.doc && <span className="num"> · {c.receptor.doc}</span>}
          </p>
          <p>Condición frente al IVA: {c.receptor.condicion}</p>
          <p>
            Condición de venta: contado · Pedido <span className="num">#{c.pedido}</span>
          </p>
          {c.asociado && (
            <p>
              Comprobante asociado: {c.asociado.nombre} del {fecha(c.asociado.fecha)}
            </p>
          )}
        </div>

        <table className="factura-items">
          <caption className="solo-lector">Detalle</caption>
          <thead>
            <tr>
              <th scope="col">Cant.</th>
              <th scope="col">Descripción</th>
              <th scope="col">Precio unit.</th>
              <th scope="col">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {c.items.map((i, n) => (
              <tr key={n}>
                <td className="num">{i.cant}</td>
                <td>
                  {i.desc}
                  {i.cod && <small className="num"> · {i.cod}</small>}
                </td>
                <td className="num">{pesos(i.unit)}</td>
                <td className="num">{pesos(i.sub)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="factura-totales num">
          {discrimina && (
            <>
              <div>
                <dt>Importe neto gravado</dt>
                <dd>{pesos(c.neto)}</dd>
              </div>
              <div>
                <dt>IVA {c.alicuota} %</dt>
                <dd>{pesos(c.iva)}</dd>
              </div>
            </>
          )}
          <div className="factura-total">
            <dt>Importe total</dt>
            <dd>{pesos(c.total)}</dd>
          </div>
        </dl>

        {c.letra === "B" && (
          // Ley 27.743: a consumidor final se informa el IVA contenido.
          <dl className="factura-transparencia num">
            <dt>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</dt>
            <dd>IVA contenido: {pesos(c.iva)}</dd>
            <dd>Otros impuestos nacionales indirectos: {pesos(0)}</dd>
          </dl>
        )}
        {discrimina && [6, 13, 16].includes(c.receptor.condicionId) && <p className="factura-leyenda">{LEYENDA_MONOTRIBUTO}</p>}

        <footer className="factura-pie">
          <div className="factura-qr" role="img" aria-label="Código QR para verificar el comprobante en ARCA" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <p className="factura-arca">Comprobante autorizado por ARCA</p>
            <p className="num">
              <b>CAE:</b> {c.cae}
            </p>
            <p>
              <b>Vencimiento del CAE:</b> {fecha(c.caeVto)}
            </p>
          </div>
        </footer>
      </article>

      <p className="factura-nota no-imprimir">
        El código QR lleva a ARCA, donde se puede verificar que el comprobante es válido.
      </p>
    </section>
  );
};
