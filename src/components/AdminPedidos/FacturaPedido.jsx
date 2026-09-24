import { useState } from "react";
import { fechaHora } from "../../admin/formato";
import { plata } from "../../utils/precios";
import { CONDICIONES_FISCALES, cuitConGuiones } from "../../compartido/fiscal";
import { urlFactura } from "../../services/tienda";

const ESTADOS = {
  pendiente: { texto: "Emitiéndose", clase: "cobro-pendiente" },
  emitiendo: { texto: "Emitiéndose", clase: "cobro-pendiente" },
  emitida: { texto: "Facturado", clase: "cobro-aprobado" },
  anular: { texto: "Anulándose", clase: "cobro-pendiente" },
  anulando: { texto: "Anulándose", clase: "cobro-pendiente" },
  anulada: { texto: "Anulada (nota de crédito)", clase: "cobro-devuelto" },
  error: { texto: "No se pudo facturar", clase: "cobro-rechazado" },
  cancelada: { texto: "Sin factura", clase: "cobro-devuelto" },
};

const fechaCorta = (aaaammdd) => (aaaammdd ? `${aaaammdd.slice(6, 8)}/${aaaammdd.slice(4, 6)}/${aaaammdd.slice(0, 4)}` : "");

const textoFiscal = (f) => {
  if (f?.cuit) return `${f.nombre} · CUIT ${cuitConGuiones(f.cuit)} · ${CONDICIONES_FISCALES[f.condicion]?.nombre ?? ""}`;
  if (f?.dni) return `${f.nombre} · DNI ${f.dni} · Consumidor final`;
  return "Consumidor final";
};

// La tarjeta "Factura" del pedido: el estado, los comprobantes (para ver e
// imprimir), el error si ARCA no la aceptó, y los datos para facturar.
export const FacturaPedido = ({ p, hacer, trabajando }) => {
  const f = p.factura ?? null;
  const comprobantes = p.comprobantes ?? [];
  const pagado = ["aprobado", "reclamo"].includes(p.cobro?.estado);
  const ocupado = Boolean(trabajando);
  const estado = f ? ESTADOS[f.estado] : null;
  // Emitir tarda segundos: si se ve "emitiéndose", puede haber quedado
  // trabado (el servidor deja reintentar pasados 5 minutos).
  const trabado = ["emitiendo", "anulando"].includes(f?.estado);
  const editable = !p.facturaVigente && !["emitiendo", "anulando"].includes(f?.estado);

  const [editando, setEditando] = useState(false);
  const [modo, setModo] = useState(p.fiscal?.cuit ? "cuit" : p.fiscal?.dni ? "dni" : "final");
  const [datos, setDatos] = useState({
    condicion: p.fiscal?.cuit ? p.fiscal.condicion : "responsable_inscripto",
    cuit: p.fiscal?.cuit ?? "",
    dni: p.fiscal?.dni ?? "",
    nombre: p.fiscal?.nombre ?? "",
  });
  const campo = (k) => (e) => setDatos({ ...datos, [k]: e.target.value });

  const guardarFiscal = (e) => {
    e.preventDefault();
    const fiscal =
      modo === "cuit"
        ? { condicion: datos.condicion, cuit: datos.cuit, nombre: datos.nombre }
        : modo === "dni"
          ? { condicion: "consumidor_final", dni: datos.dni, nombre: datos.nombre }
          : { condicion: "consumidor_final" };
    hacer("pedido.fiscal", { fiscal }, "Datos para la factura guardados.").then((ok) => ok && setEditando(false));
  };

  return (
    <div className="admin-tarjeta tarjeta-factura">
      <div className="cobro-cabecera">
        <h2>Factura</h2>
        {estado && <span className={`estado-pastilla ${estado.clase}`}>{estado.texto}</span>}
      </div>

      <p className="cobro-detalle">
        Para: {textoFiscal(p.fiscal)}
        {editable && !editando && (
          <button type="button" className="btn-link" onClick={() => setEditando(true)}>
            Cambiar
          </button>
        )}
      </p>

      {!f && !comprobantes.length && (
        <p className="nota-campo">{pagado ? "Cobrado sin factura (por ejemplo, se cobró con la facturación apagada)." : "Se factura sola cuando se cobra."}</p>
      )}
      {f?.estado === "cancelada" && <p className="nota-campo">Se anuló el cobro antes de facturar.</p>}
      {f?.nota && <p className="nota-campo">{f.nota}</p>}
      {f?.estado === "error" && (
        <div className="cobro-alerta" role="alert">
          <p>
            <b>ARCA: </b>
            {f.error}
          </p>
          {f.temporal && <p className="nota-campo">Es un problema pasajero: se reintenta solo cada 30 minutos.</p>}
        </div>
      )}

      {comprobantes.length > 0 && (
        <ul className="factura-lista">
          {comprobantes.map((c) => (
            <li key={c.token}>
              <a href={urlFactura(c.token)} target="_blank" rel="noopener noreferrer">
                {c.nombre} <span className="num">{c.numeroTexto}</span>
              </a>
              <span className="num">
                {fechaCorta(c.fecha)} · {plata(c.total)}
              </span>
              <small className="num">
                CAE {c.cae}
                {c.ambiente === "homologacion" ? " · prueba" : ""}
              </small>
            </li>
          ))}
        </ul>
      )}

      <div className="pedido-acciones">
        {(f?.estado === "error" || trabado) && (
          <button type="button" className="btn bg-primary" disabled={ocupado} onClick={() => hacer("factura.reintentar", {}, "Listo: se volvió a intentar con ARCA.")}>
            {trabajando === "factura.reintentar" ? "Reintentando…" : "Reintentar"}
          </button>
        )}
        {pagado && !p.facturaVigente && (!f || f.estado === "cancelada") && (
          <button type="button" className="btn bg-outline" disabled={ocupado} onClick={() => hacer("factura.emitir", {}, "Factura pedida a ARCA.")}>
            {trabajando === "factura.emitir" ? "Emitiendo…" : "Emitir factura"}
          </button>
        )}
      </div>
      {f?.cuando && <p className="nota-campo">Último movimiento: {fechaHora(f.cuando)}</p>}

      {editando && (
        <form className="cobro-form" onSubmit={guardarFiscal}>
          <fieldset>
            <legend>Datos para la factura</legend>
            {[
              ["final", "Consumidor final"],
              ["cuit", "Con CUIT"],
              ["dni", "Consumidor final con DNI (desde $10.000.000)"],
            ].map(([k, t]) => (
              <label key={k} className="cobro-opcion">
                <input type="radio" name="modo-fiscal" checked={modo === k} onChange={() => setModo(k)} /> {t}
              </label>
            ))}
          </fieldset>
          {modo === "cuit" && (
            <>
              <label htmlFor="fp-cuit">CUIT</label>
              <input id="fp-cuit" inputMode="numeric" value={datos.cuit} onChange={campo("cuit")} maxLength={13} />
              <label htmlFor="fp-cond">Condición ante el IVA</label>
              <select id="fp-cond" value={datos.condicion} onChange={campo("condicion")}>
                {Object.entries(CONDICIONES_FISCALES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </>
          )}
          {modo === "dni" && (
            <>
              <label htmlFor="fp-dni">DNI</label>
              <input id="fp-dni" inputMode="numeric" value={datos.dni} onChange={campo("dni")} maxLength={10} />
            </>
          )}
          {modo !== "final" && (
            <>
              <label htmlFor="fp-nombre">{modo === "cuit" ? "Nombre o razón social" : "Nombre y apellido"}</label>
              <input id="fp-nombre" value={datos.nombre} onChange={campo("nombre")} maxLength={80} />
            </>
          )}
          <div className="pedido-acciones">
            <button type="submit" className="btn bg-primary" disabled={ocupado}>
              {trabajando === "pedido.fiscal" ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="btn bg-outline" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
