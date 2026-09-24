import { useState } from "react";
import { COBROS, fechaHora } from "../../admin/formato";
import { plata } from "../../utils/precios";

export const PastillaCobro = ({ estado }) => <span className={`estado-pastilla cobro-${estado}`}>{COBROS[estado] ?? estado}</span>;

const MEDIOS = [
  { id: "transferencia", nom: "Transferencia" },
  { id: "efectivo", nom: "Efectivo" },
  { id: "otro", nom: "Otro medio" },
];

const aEntero = (t) => {
  const limpio = String(t).replace(/\D/g, "");
  return limpio ? Number(limpio) : 0;
};

// La tarjeta "Cobro" del detalle del pedido: cuánto se cobra, si ya se
// pagó y cómo, y lo que se puede hacer (marcar una transferencia, devolver
// un pago de Mercado Pago, corregir el envío).
export const CobroPedido = ({ p, hacer, trabajando }) => {
  const [abierto, setAbierto] = useState(""); // "registrar" | "envio" | "devolver" | "anular"
  const [medio, setMedio] = useState("transferencia");
  const [nota, setNota] = useState("");
  const [envio, setEnvio] = useState(String(p.envio ?? ""));
  const c = p.cobro ?? { estado: "sin_pagar" };
  const aCobrar = p.aCobrar ?? p.total + (p.envio ?? 0);
  const pagado = c.estado === "aprobado" || c.estado === "reclamo";
  const deMas = Object.entries(p.pagosDeMas ?? {});
  const ocupado = Boolean(trabajando);
  const cerrar = () => setAbierto("");
  // Si falla, el formulario queda abierto con lo que se escribió.
  const accion = (nombre, extra, exito) => hacer(nombre, extra, exito).then((ok) => ok && cerrar());

  return (
    <div className="admin-tarjeta cobro">
      <div className="cobro-cabecera">
        <h2>Cobro</h2>
        <PastillaCobro estado={c.estado} />
      </div>
      <dl className="cobro-cuenta num">
        <div>
          <dt>Productos</dt>
          <dd>{plata(p.total)}</dd>
        </div>
        <div>
          <dt>Envío</dt>
          <dd>{p.envio ? plata(p.envio) : "—"}</dd>
        </div>
        <div className="cobro-total">
          <dt>A cobrar</dt>
          <dd>{plata(aCobrar)}</dd>
        </div>
      </dl>

      {c.detalle && (
        <p className="cobro-detalle">
          {c.detalle}
          {c.monto ? <span className="num"> · {plata(c.monto)}</span> : null}
          {c.cuando && <> · {fechaHora(c.cuando)}</>}
          {c.referencia && (
            <small className="num">
              Mercado Pago, operación n.º {c.referencia}
              {c.motivo && c.estado !== "aprobado" ? ` (${c.motivo})` : ""}
            </small>
          )}
          {c.quien && <small>Lo marcó {c.quien.nombre || c.quien.rol}</small>}
        </p>
      )}

      {pagado && c.monto && Math.abs(c.monto - aCobrar) >= 1 && (
        <p className="cobro-alerta" role="alert">
          Pagó {plata(c.monto)} y el pedido es de {plata(aCobrar)}: revisalo con la clienta.
        </p>
      )}
      {p.estado === "cancelado" && pagado && c.medio === "mercadopago" && (
        <p className="cobro-alerta" role="alert">
          El pedido está cancelado pero sigue pagado: devolvé el pago.
        </p>
      )}
      {deMas.length > 0 && (
        <div className="cobro-alerta" role="alert">
          <p>
            <b>La clienta pagó de más.</b> Hay {deMas.length === 1 ? "otro pago" : `${deMas.length} pagos más`} de Mercado Pago para este pedido:
          </p>
          <ul>
            {deMas.map(([ref, x]) => (
              <li key={ref} className="num">
                n.º {ref} · {plata(x.monto)} · {COBROS[x.estado] ?? x.estado}
                {x.estado === "aprobado" && (
                  <button type="button" className="btn-link" disabled={ocupado}
                    onClick={() => hacer("pago.devolver", { referencia: ref }, `Se devolvió el pago n.º ${ref}.`)}>
                    Devolver
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pedido-acciones">
        {!pagado && p.estado !== "cancelado" && (
          <button type="button" className="btn bg-success" disabled={ocupado} onClick={() => setAbierto(abierto === "registrar" ? "" : "registrar")}>
            Marcar pagado
          </button>
        )}
        {p.estado === "confirmado" && ["sin_pagar", "rechazado"].includes(c.estado) && (
          <button type="button" className="btn bg-outline" disabled={ocupado} onClick={() => setAbierto(abierto === "envio" ? "" : "envio")}>
            Cambiar envío
          </button>
        )}
        {c.estado === "aprobado" && c.medio === "mercadopago" && (
          <button type="button" className="btn bg-outline" disabled={ocupado} onClick={() => setAbierto("devolver")}>
            Devolver el pago
          </button>
        )}
        {c.estado === "aprobado" && c.medio !== "mercadopago" && (
          <button type="button" className="btn bg-outline" disabled={ocupado} onClick={() => setAbierto("anular")}>
            Anular el pago
          </button>
        )}
      </div>

      {abierto === "registrar" && (
        <form
          className="cobro-form"
          onSubmit={(e) => {
            e.preventDefault();
            accion("pago.registrar", { medio, nota }, `Marcado pagado: ${plata(aCobrar)}.`);
          }}
        >
          <fieldset>
            <legend>¿Cómo pagó?</legend>
            {MEDIOS.map((m) => (
              <label key={m.id} className="cobro-opcion">
                <input type="radio" name="medio" value={m.id} checked={medio === m.id} onChange={() => setMedio(m.id)} /> {m.nom}
              </label>
            ))}
          </fieldset>
          <label htmlFor="cobro-nota">Nota (opcional: n.º de comprobante, banco…)</label>
          <input id="cobro-nota" maxLength={120} value={nota} onChange={(e) => setNota(e.target.value)} />
          <p className="nota-campo">Revisá que la plata haya entrado antes de marcarlo: la clienta lo ve como pagado.</p>
          <div className="pedido-acciones">
            <button type="submit" className="btn bg-success" disabled={ocupado}>
              {trabajando === "pago.registrar" ? "Guardando…" : `Sí, pagó ${plata(aCobrar)}`}
            </button>
            <button type="button" className="btn bg-outline" onClick={cerrar}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {abierto === "envio" && (
        <form
          className="cobro-form"
          onSubmit={(e) => {
            e.preventDefault();
            accion("pedido.envio", { envio: aEntero(envio) }, "Envío actualizado: la clienta ya ve el total nuevo.");
          }}
        >
          <label htmlFor="cobro-envio">Costo del envío, en pesos</label>
          <input id="cobro-envio" inputMode="numeric" value={envio} onChange={(e) => setEnvio(e.target.value)} placeholder="0" />
          <div className="pedido-acciones">
            <button type="submit" className="btn bg-primary" disabled={ocupado}>
              {trabajando === "pedido.envio" ? "Guardando…" : "Guardar envío"}
            </button>
            <button type="button" className="btn bg-outline" onClick={cerrar}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {abierto === "devolver" && (
        <div className="cobro-form">
          <p>
            Se le devuelven <b className="num">{plata(c.monto)}</b> a la clienta, al mismo medio con que pagó. Mercado Pago no lo deja deshacer.
          </p>
          <div className="pedido-acciones">
            <button type="button" className="btn bg-primary" disabled={ocupado}
              onClick={() => accion("pago.devolver", {}, "Pago devuelto. La clienta lo ve en su link de seguimiento.")}>
              {trabajando === "pago.devolver" ? "Devolviendo…" : "Sí, devolver"}
            </button>
            <button type="button" className="btn bg-outline" onClick={cerrar}>
              No
            </button>
          </div>
        </div>
      )}

      {abierto === "anular" && (
        <div className="cobro-form">
          <p>El pedido vuelve a figurar sin pagar. Usalo si lo marcaste por error.</p>
          <div className="pedido-acciones">
            <button type="button" className="btn bg-primary" disabled={ocupado}
              onClick={() => accion("pago.anular", {}, "Pago anulado: el pedido figura sin pagar.")}>
              {trabajando === "pago.anular" ? "Anulando…" : "Sí, anular"}
            </button>
            <button type="button" className="btn bg-outline" onClick={cerrar}>
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
