import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { useConsulta, useDocumento } from "../../admin/vivo";
import { ESTADOS, fechaHora } from "../../admin/formato";
import { plata } from "../../utils/precios";
import "./AdminPedidos.css";

const PESTANAS = ["pendiente", "confirmado", "entregado", "cancelado", "todos"];

// Los pedidos en vivo: uno nuevo aparece solo, sin recargar. Se trae de a
// 50 (las reglas no dejan pedir más de 100 por consulta).
export const AdminPedidos = () => {
  const [params, setParams] = useSearchParams();
  const pestana = PESTANAS.includes(params.get("estado")) ? params.get("estado") : "pendiente";
  const { datos: tablero } = useDocumento("interno/tablero");

  const consulta = useMemo(() => {
    const base = collection(db, "pedidos");
    return pestana === "todos"
      ? query(base, orderBy("creado", "desc"), limit(50))
      : query(base, where("estado", "==", pestana), orderBy("creado", "desc"), limit(50));
  }, [pestana]);
  const { docs: pedidos, cargando, error } = useConsulta(consulta);
  const cuenta = (e) => tablero?.porEstado?.[e] ?? 0;

  return (
    <section>
      <title>Pedidos | Panel</title>
      <h1>Pedidos</h1>

      <div className="admin-pestanas" role="tablist" aria-label="Estado de los pedidos">
        {PESTANAS.map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={pestana === e}
            className="admin-pestana"
            onClick={() => setParams(e === "pendiente" ? {} : { estado: e })}
          >
            {e === "todos" ? "Todos" : ESTADOS[e].plural}
            {e !== "todos" && <span className="admin-cuenta num">{cuenta(e)}</span>}
          </button>
        ))}
      </div>

      {cargando && <p className="estado">Cargando pedidos…</p>}
      {error && <p className="estado" role="alert">{error}</p>}
      {!cargando && !error && pedidos.length === 0 && (
        <div className="estado">
          <h2>{pestana === "pendiente" ? "No hay pedidos pendientes" : "No hay pedidos acá"}</h2>
          <p>{pestana === "pendiente" ? "Cuando una clienta haga un pedido, aparece acá solo." : "Probá con otra pestaña."}</p>
        </div>
      )}

      {pedidos.length > 0 && (
        <ul className="pedidos-lista">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link to={`/admin/pedidos/${p.id}`} className="pedido-fila">
                <span className="pedido-num num">#{p.numero}</span>
                <span className="pedido-quien">
                  <b>{p.clienta?.nombre}</b>
                  <small>
                    {fechaHora(p.creado)} · {p.unidades} u. · {p.entrega?.nombre}
                  </small>
                </span>
                <span className="pedido-total num">{plata(p.total)}</span>
                <span className={`estado-pastilla estado-${p.estado}`}>{ESTADOS[p.estado]?.nom ?? p.estado}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pedidos.length === 50 && <p className="admin-conteo">Se muestran los 50 más recientes.</p>}
    </section>
  );
};
