import { useMemo } from "react";
import { Link } from "react-router-dom";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { useConsulta, useDocumento } from "../../admin/vivo";
import { fechaHora, nombreMes } from "../../admin/formato";
import { numeroWhatsAppValido } from "../../utils/pedido";
import { plata } from "../../utils/precios";
import "../AdminPedidos/AdminPedidos.css";
import "../AdminVentas/AdminVentas.css";

const mesActual = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

// Inicio del panel: lo que hay que mirar primero. Todo en vivo.
export const AdminHome = () => {
  const { productos, config, loading } = useProductos();
  const { nombre, rol } = useAuth();
  const { datos: tablero } = useDocumento("interno/tablero");
  const mes = mesActual();
  const { datos: ventas } = useDocumento(`stats/${mes}`);
  const pendientesQ = useMemo(() => query(collection(db, "pedidos"), where("estado", "==", "pendiente"), orderBy("creado", "desc"), limit(5)), []);
  const { docs: pendientes } = useConsulta(pendientesQ);
  // Confirmados que faltan cobrar (transferencias por marcar, pagos en curso).
  const confirmadosQ = useMemo(() => query(collection(db, "pedidos"), where("estado", "==", "confirmado"), orderBy("creado", "desc"), limit(50)), []);
  const { docs: confirmados } = useConsulta(confirmadosQ);
  const porCobrar = confirmados.filter((p) => !["aprobado", "reclamo"].includes(p.cobro?.estado));
  const montoPorCobrar = porCobrar.reduce((s, p) => s + (p.aCobrar ?? p.total), 0);

  const agotados = productos.filter((p) => p.agotado && p.activo !== false).length;
  const pausados = productos.filter((p) => p.activo === false).length;
  const pend = tablero?.porEstado?.pendiente ?? 0;

  return (
    <section>
      <title>{`Panel | ${config.nombre_negocio}`}</title>
      <h1>Hola, {nombre}</h1>
      <p className="admin-intro">
        Entraste como <b>{rol}</b>.{" "}
        {rol === "programador" ? "Ves todo, incluidos los costos y los márgenes." : "Los costos y los márgenes son del programador."}
      </p>

      {!loading && !numeroWhatsAppValido(config.whatsapp) && (
        <p className="aviso" role="note">
          <b>Falta el WhatsApp real de la tienda.</b> Los pedidos llegan igual al panel, pero la clienta no puede avisarte por
          WhatsApp. <Link to="/admin/configuracion">Cargalo en Configuración</Link>.
        </p>
      )}

      <div className="admin-tarjetas">
        <Link to="/admin/pedidos" className="admin-tarjeta admin-tarjeta-link">
          <div className="rotulo">Pedidos pendientes</div>
          <div className="dato num">{pend}</div>
          <div className="nota">{pend ? "para confirmar con la clienta" : "nada para hacer"}</div>
        </Link>
        <Link to="/admin/ventas" className="admin-tarjeta admin-tarjeta-link">
          <div className="rotulo">Vendido en {nombreMes(mes)}</div>
          <div className="dato num">{plata(ventas?.totales?.total ?? 0)}</div>
          <div className="nota">{ventas?.totales?.pedidos ?? 0} pedidos confirmados</div>
        </Link>
        <Link to="/admin/pedidos?estado=confirmado" className="admin-tarjeta admin-tarjeta-link">
          <div className="rotulo">Por cobrar</div>
          <div className="dato num">{plata(montoPorCobrar)}</div>
          <div className="nota">
            {porCobrar.length ? `${porCobrar.length} ${porCobrar.length === 1 ? "pedido confirmado" : "pedidos confirmados"} sin pagar` : "todo cobrado"}
          </div>
        </Link>
        <Link to="/admin/productos" className="admin-tarjeta admin-tarjeta-link">
          <div className="rotulo">Productos en la tienda</div>
          <div className="dato num">{productos.length - pausados}</div>
          <div className="nota">
            {agotados} sin stock · {pausados} pausados
          </div>
        </Link>
        <div className="admin-tarjeta">
          <div className="rotulo">Lista de precios</div>
          <div className="dato" style={{ fontSize: "19px" }}>{config.actualizado}</div>
          <div className="nota">{config.precios_confirmados ? "precios confirmados" : "precios orientativos"}</div>
        </div>
      </div>

      <div className="admin-titulo">
        <h2 className="ventas-subtitulo">Últimos pedidos pendientes</h2>
        <Link to="/admin/pedidos">Ver todos</Link>
      </div>
      {pendientes.length === 0 ? (
        <p className="admin-conteo">No hay pedidos pendientes. Cuando entre uno, aparece acá solo.</p>
      ) : (
        <ul className="pedidos-lista">
          {pendientes.map((p) => (
            <li key={p.id}>
              <Link to={`/admin/pedidos/${p.id}`} className="pedido-fila">
                <span className="pedido-num num">#{p.numero}</span>
                <span className="pedido-quien">
                  <b>{p.clienta?.nombre}</b>
                  <small>
                    {fechaHora(p.creado)} · {p.unidades} u.
                  </small>
                </span>
                <span className="pedido-total num">{plata(p.total)}</span>
                <span className="estado-pastilla estado-pendiente">Pendiente</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
