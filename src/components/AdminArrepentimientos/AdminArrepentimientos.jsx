import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { useConsulta } from "../../admin/vivo";
import { fechaHora } from "../../admin/formato";
import { llamarPanel } from "../../services/panel";
import "../AdminPedidos/AdminPedidos.css";

// Las solicitudes del botón de arrepentimiento (Disp. 954/2025). Hay que
// responderlas: el plazo lo corre la clienta desde que recibió el pedido.
export const AdminArrepentimientos = () => {
  const consulta = useMemo(() => query(collection(db, "arrepentimientos"), orderBy("creado", "desc"), limit(100)), []);
  const { docs, cargando, error } = useConsulta(consulta);
  const [notas, setNotas] = useState({});
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });

  const resolver = async (a) => {
    setAviso({ tipo: "", texto: "" });
    try {
      await llamarPanel("arrepentimiento.resolver", { id: a.id, nota: notas[a.id] ?? "" });
      setAviso({ tipo: "ok", texto: `${a.codigo}: marcado como resuelto.` });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  };

  if (cargando) return <p className="estado">Cargando…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;

  return (
    <section>
      <title>Arrepentimientos | Panel</title>
      <h1>Arrepentimientos</h1>
      <p className="admin-intro">Pedidos de devolución que llegan por el botón de arrepentimiento de la tienda.</p>
      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>
      {docs.length === 0 ? (
        <div className="estado">
          <h2>No hay solicitudes</h2>
        </div>
      ) : (
        <ul className="pedidos-lista">
          {docs.map((a) => (
            <li key={a.id} className="admin-tarjeta arrepentimiento-item">
              <p>
                <b className="num">{a.codigo}</b> · {fechaHora(a.creado)} ·{" "}
                <span className={`estado-pastilla ${a.estado === "resuelto" ? "estado-entregado" : "estado-pendiente"}`}>
                  {a.estado === "resuelto" ? "Resuelto" : "Nuevo"}
                </span>
              </p>
              <p>
                <b>{a.nombre}</b> · {a.contacto}
                {a.numero && (
                  <>
                    {" "}· pedido{" "}
                    {a.pedidoId ? <Link to={`/admin/pedidos/${a.pedidoId}`}>#{a.numero}</Link> : `#${a.numero} (no encontrado)`}
                  </>
                )}
              </p>
              {a.motivo && <p className="pedido-comentario">«{a.motivo}»</p>}
              {a.estado === "resuelto" ? (
                <p className="admin-conteo">
                  Resuelto {fechaHora(a.resuelto)} por {a.quien?.nombre}
                  {a.nota ? ` — ${a.nota}` : ""}
                </p>
              ) : (
                <div className="pedido-acciones">
                  <input className="admin-buscar" placeholder="Nota (opcional): cómo se resolvió" aria-label={`Nota para ${a.codigo}`}
                    value={notas[a.id] ?? ""} onChange={(e) => setNotas({ ...notas, [a.id]: e.target.value })} maxLength={300} />
                  <button type="button" className="btn bg-success" onClick={() => resolver(a)}>
                    Marcar resuelto
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
