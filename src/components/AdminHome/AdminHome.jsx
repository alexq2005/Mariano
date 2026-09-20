import { Link } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { plata } from "../../utils/precios";
import { CONFIG } from "../../config";

// Inicio del panel. Hoy muestra el estado del catálogo; los pedidos, el
// resumen de ventas y el historial llegan en los pasos siguientes del plan.
export const AdminHome = () => {
  const { productos, loading, error } = useProductos();
  const { nombre, rol } = useAuth();

  const rubros = new Set(productos.map((p) => p.rubro)).size;
  const precios = productos.flatMap((p) => [p.menor, p.mayor]);

  return (
    <section>
      <title>{`Panel | ${CONFIG.nombre_negocio}`}</title>
      <h1>Hola, {nombre}</h1>
      <p className="admin-intro">
        Entraste como <b>{rol}</b>.{" "}
        {rol === "programador"
          ? "Ves todo, incluidos los costos y los márgenes."
          : "Ves los productos y el stock; los costos y los márgenes son del programador."}
      </p>

      {loading && <p className="estado">Cargando el catálogo…</p>}
      {error && <p className="estado" role="alert">{error}</p>}

      {!loading && !error && (
        <div className="admin-tarjetas">
          <div className="admin-tarjeta">
            <div className="rotulo">Productos publicados</div>
            <div className="dato num">{productos.length}</div>
            <div className="nota">en {rubros} rubros</div>
          </div>
          <div className="admin-tarjeta">
            <div className="rotulo">Precio más bajo</div>
            <div className="dato num">{plata(Math.min(...precios))}</div>
            <div className="nota">por mayor</div>
          </div>
          <div className="admin-tarjeta">
            <div className="rotulo">Precio más alto</div>
            <div className="dato num">{plata(Math.max(...precios))}</div>
            <div className="nota">por menor</div>
          </div>
          <div className="admin-tarjeta">
            <div className="rotulo">Lista vigente</div>
            <div className="dato" style={{ fontSize: "19px" }}>{CONFIG.actualizado}</div>
            <div className="nota">se cambia al recalcular precios</div>
          </div>
        </div>
      )}

      <div className="admin-tarjeta">
        <h2 style={{ marginTop: 0 }}>Lo que viene</h2>
        <p style={{ color: "var(--tenue)", fontSize: "14px" }}>
          Este panel se está construyendo por partes. Ya funcionan el ingreso con tu cuenta y los permisos por
          rol. Siguen: <b>pedidos en tiempo real</b>, alta y edición de productos, stock, precios, resumen de
          ventas, historial de operaciones y clientas.
        </p>
        <Link to="/admin/productos" className="btn bg-primary">
          Ver los productos
        </Link>
      </div>
    </section>
  );
};
