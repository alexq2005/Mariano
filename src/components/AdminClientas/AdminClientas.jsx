import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { useConsulta } from "../../admin/vivo";
import { ESTADOS, fechaHora } from "../../admin/formato";
import { llamarPanel } from "../../services/panel";
import { plata } from "../../utils/precios";
import { sinAcentos } from "../../utils/filtros";
import { whatsappDeTelefono } from "../../compartido/clientas";
import "../AdminPedidos/AdminPedidos.css";

// Los pedidos de una clienta, al abrir su ficha.
const PedidosDe = ({ id }) => {
  const consulta = useMemo(() => query(collection(db, "pedidos"), where("clientaId", "==", id), orderBy("creado", "desc"), limit(20)), [id]);
  const { docs, cargando, error } = useConsulta(consulta);
  if (cargando) return <p className="admin-conteo">Cargando sus pedidos…</p>;
  if (error) return <p className="admin-conteo" role="alert">{error}</p>;
  return (
    <ul className="clienta-pedidos">
      {docs.map((p) => (
        <li key={p.id}>
          <Link to={`/admin/pedidos/${p.id}`}>#{p.numero}</Link> · {fechaHora(p.creado)} · <span className="num">{plata(p.total)}</span> ·{" "}
          <span className={`estado-pastilla estado-${p.estado}`}>{ESTADOS[p.estado]?.nom}</span>
        </li>
      ))}
    </ul>
  );
};

export const AdminClientas = () => {
  const consulta = useMemo(() => query(collection(db, "clientas"), orderBy("ultima", "desc"), limit(100)), []);
  const { docs: clientas, cargando, error } = useConsulta(consulta);
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(null);
  const [borrando, setBorrando] = useState(null);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });

  const filtradas = useMemo(() => {
    const t = sinAcentos(texto.trim());
    return t ? clientas.filter((c) => sinAcentos(`${c.nombre} ${c.telefono} ${c.email ?? ""}`).includes(t)) : clientas;
  }, [clientas, texto]);

  const borrar = async (c) => {
    setAviso({ tipo: "", texto: "" });
    try {
      const r = await llamarPanel("clienta.borrar", { id: c.id });
      setAviso({ tipo: "ok", texto: `Datos de ${c.nombre} borrados. ${r.pedidosAnonimizados} pedidos quedaron anónimos.` });
      setBorrando(null);
      setAbierta(null);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  };

  if (cargando) return <p className="estado">Cargando clientas…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;

  return (
    <section>
      <title>Clientas | Panel</title>
      <h1>Clientas</h1>
      <p className="admin-intro">
        Se arma sola con cada pedido, por teléfono. «Compras» cuenta solo los pedidos confirmados.
      </p>
      <div className="admin-herramientas">
        <input type="search" className="admin-buscar" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email…" aria-label="Buscar clientas" />
        <p className="admin-conteo" role="status">
          {filtradas.length} {filtradas.length === 1 ? "clienta" : "clientas"}
        </p>
      </div>
      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>

      {filtradas.length === 0 ? (
        <div className="estado">
          <h2>{clientas.length ? "Sin resultados" : "Todavía no hay clientas"}</h2>
          <p>{clientas.length ? "Probá con otro nombre o teléfono." : "Aparecen solas cuando alguien hace un pedido."}</p>
        </div>
      ) : (
        <ul className="pedidos-lista">
          {filtradas.map((c) => {
            const wa = whatsappDeTelefono(c.telefono);
            return (
              <li key={c.id} className="clienta">
                <button type="button" className="pedido-fila clienta-fila" aria-expanded={abierta === c.id}
                  onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
                  <span className="pedido-quien">
                    <b>{c.nombre}</b>
                    <small>
                      {c.telefono} · última {fechaHora(c.ultima)}
                    </small>
                  </span>
                  <span className="pedido-total num">{plata(c.total ?? 0)}</span>
                  <span className="clienta-cuenta">
                    {c.compras ?? 0} {c.compras === 1 ? "compra" : "compras"} / {c.pedidos ?? 0} pedidos
                  </span>
                </button>
                {abierta === c.id && (
                  <div className="clienta-ficha">
                    <p>
                      {c.email && (
                        <>
                          <a href={`mailto:${c.email}`}>{c.email}</a> ·{" "}
                        </>
                      )}
                      Cliente desde {fechaHora(c.primera)}
                      {wa && (
                        <>
                          {" "}·{" "}
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                            WhatsApp
                          </a>
                        </>
                      )}
                    </p>
                    <PedidosDe id={c.id} />
                    {borrando === c.id ? (
                      <div className="pedido-cancelar">
                        <p>
                          ¿Borrar los datos de {c.nombre}? Sus pedidos quedan, pero sin nombre, teléfono ni dirección. No se puede
                          deshacer.
                        </p>
                        <div className="pedido-acciones">
                          <button type="button" className="btn bg-primary" onClick={() => borrar(c)}>
                            Sí, borrar sus datos
                          </button>
                          <button type="button" className="btn bg-outline" onClick={() => setBorrando(null)}>
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="btn-link" onClick={() => setBorrando(c.id)}>
                        Borrar sus datos (lo pidió la clienta)
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
