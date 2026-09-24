import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDocumento } from "../../admin/vivo";
import { ESTADOS, fechaHora } from "../../admin/formato";
import { llamarPanel } from "../../services/panel";
import { plata } from "../../utils/precios";
import { rutaImagen } from "../../services/productos";
import { whatsappDeTelefono } from "../../compartido/clientas";
import { urlSeguimiento } from "../../services/tienda";
import { CobroPedido } from "./CobroPedido";
import "./AdminPedidos.css";

// El detalle de un pedido y lo que se puede hacer con él. El documento se
// escucha en vivo: al confirmar, el estado cambia solo en la pantalla.
export const AdminPedido = () => {
  const { id } = useParams();
  const { datos: p, cargando, error } = useDocumento(`pedidos/${id}`);
  const [trabajando, setTrabajando] = useState("");
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [envio, setEnvio] = useState("");

  if (cargando) return <p className="estado">Cargando el pedido…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;
  if (!p) {
    return (
      <div className="estado">
        <h1>Ese pedido no existe</h1>
        <Link to="/admin/pedidos" className="btn bg-primary">
          Volver a los pedidos
        </Link>
      </div>
    );
  }

  const hacer = async (accion, extra = {}, exito) => {
    setTrabajando(accion);
    setAviso({ tipo: "", texto: "" });
    try {
      const r = await llamarPanel(accion, { id, ...extra });
      setAviso({ tipo: "ok", texto: r.sinCambios ? "Ya estaba así." : exito });
      setCancelando(false);
      return true;
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
      return false;
    } finally {
      setTrabajando("");
    }
  };

  const wa = whatsappDeTelefono(p.clienta?.telefono);
  const saludo = `Hola ${p.clienta?.nombre ?? ""}! Te escribo por tu pedido #${p.numero}.`;

  return (
    <section className="pedido-detalle">
      <title>{`Pedido #${p.numero} | Panel`}</title>
      <Link to="/admin/pedidos" className="admin-volver">
        ← Pedidos
      </Link>
      <div className="pedido-cabecera">
        <h1>
          Pedido <span className="num">#{p.numero}</span>
        </h1>
        <span className={`estado-pastilla estado-${p.estado}`}>{ESTADOS[p.estado]?.nom}</span>
      </div>
      <p className="admin-intro">Hecho el {fechaHora(p.creado)}</p>

      <div className="pedido-acciones">
        {p.estado === "pendiente" && (
          <>
            {/* El envío se suma al confirmar: la clienta ve el total final
                y lo paga desde su link de seguimiento. */}
            <label className="campo-envio">
              Envío a cobrar $
              <input inputMode="numeric" placeholder="0" value={envio} onChange={(e) => setEnvio(e.target.value.replace(/\D/g, ""))} />
            </label>
            <button type="button" className="btn bg-success" disabled={Boolean(trabajando)}
              onClick={() =>
                hacer(
                  "pedido.confirmar",
                  envio ? { envio: Number(envio) } : {},
                  "Confirmado: se descontó el stock, ya cuenta como venta y la clienta ya puede pagar.",
                )
              }>
              {trabajando === "pedido.confirmar" ? "Confirmando…" : "Confirmar pedido"}
            </button>
          </>
        )}
        {p.estado === "confirmado" && (
          <button type="button" className="btn bg-success" disabled={Boolean(trabajando)}
            onClick={() => hacer("pedido.entregar", {}, "Marcado como entregado.")}>
            {trabajando === "pedido.entregar" ? "Guardando…" : "Marcar entregado"}
          </button>
        )}
        {(p.estado === "pendiente" || p.estado === "confirmado") && !cancelando && (
          <button type="button" className="btn bg-outline" disabled={Boolean(trabajando)} onClick={() => setCancelando(true)}>
            Cancelar pedido
          </button>
        )}
        {wa && (
          <a className="btn bg-outline" href={`https://wa.me/${wa}?text=${encodeURIComponent(saludo)}`} target="_blank" rel="noopener noreferrer">
            Escribirle por WhatsApp
          </a>
        )}
      </div>

      {cancelando && (
        <div className="pedido-cancelar">
          <label htmlFor="motivo">¿Por qué se cancela? (queda en el historial)</label>
          <textarea id="motivo" rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="nota-campo">
            {p.estado === "confirmado" ? "El stock vuelve y se resta de las ventas del mes." : "No toca el stock: todavía no se había descontado."}
            {p.cobro?.estado === "aprobado" && p.cobro?.medio === "mercadopago" && " Está pagado con Mercado Pago: después devolvé el pago desde «Cobro»."}
            {p.cobro?.estado === "aprobado" && p.cobro?.medio !== "mercadopago" && " Está marcado como pagado: devolvele la plata a la clienta."}
          </p>
          <div className="pedido-acciones">
            <button type="button" className="btn bg-primary" disabled={Boolean(trabajando)}
              onClick={() => hacer("pedido.cancelar", { motivo }, "Pedido cancelado.")}>
              {trabajando === "pedido.cancelar" ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button type="button" className="btn bg-outline" onClick={() => setCancelando(false)}>
              No
            </button>
          </div>
        </div>
      )}

      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>

      <CobroPedido p={p} hacer={hacer} trabajando={trabajando} />

      <div className="pedido-grilla">
        <div className="admin-tarjeta">
          <h2>Clienta</h2>
          <p>
            <b>{p.clienta?.nombre}</b>
            <br />
            {p.clienta?.telefono ?? "—"}
            {p.clienta?.email && (
              <>
                <br />
                <a href={`mailto:${p.clienta.email}`}>{p.clienta.email}</a>
              </>
            )}
          </p>
          <h2>Entrega</h2>
          <p>
            {p.entrega?.nombre}
            {p.entrega?.direccion && (
              <>
                <br />
                {p.entrega.direccion}
              </>
            )}
          </p>
          <h2>Cómo dijo que paga</h2>
          <p>{p.pago}</p>
          {p.comentarios && (
            <>
              <h2>Comentarios</h2>
              <p className="pedido-comentario">{p.comentarios}</p>
            </>
          )}
        </div>

        <div className="admin-tarjeta">
          <h2>Productos</h2>
          <ul className="pedido-items">
            {p.items.map((i) => (
              <li key={i.id}>
                <img src={rutaImagen(i.img)} alt="" width="40" height="40" loading="lazy" />
                <span>
                  <b>{i.nom}</b>
                  <small className="num">
                    {i.cod} · {i.cant} u. × {plata(i.unit)}
                    {i.esMayor ? " (por mayor)" : ""}
                  </small>
                </span>
                <span className="num">{plata(i.sub)}</span>
              </li>
            ))}
          </ul>
          <p className="pedido-total-linea num">
            Total <b>{plata(p.total)}</b>
          </p>
          {p.ahorro > 0 && <p className="nota-campo num">Ahorro por mayor: {plata(p.ahorro)}</p>}
          <p className="nota-campo">
            Lista {p.condiciones?.lista ?? "—"} · por mayor desde {p.condiciones?.minimo_mayor} u.
            {p.condiciones && !p.condiciones.precios_confirmados ? " · precios orientativos" : ""}
          </p>
        </div>
      </div>

      <div className="admin-tarjeta">
        <h2>Historial</h2>
        <ol className="pedido-historial">
          {(p.historial ?? []).map((h, n) => (
            <li key={n}>
              <b>{ESTADOS[h.estado]?.nom ?? h.estado}</b> · {fechaHora(h.cuando)} · {h.quien?.rol === "clienta" ? "la clienta" : h.quien?.nombre}
              {h.motivo && <span className="pedido-motivo"> — {h.motivo}</span>}
            </li>
          ))}
        </ol>
        {p.token && (
          <p className="nota-campo">
            Link de seguimiento de la clienta:{" "}
            <a href={urlSeguimiento(p.token)} target="_blank" rel="noopener noreferrer">
              abrir
            </a>
          </p>
        )}
      </div>
    </section>
  );
};
