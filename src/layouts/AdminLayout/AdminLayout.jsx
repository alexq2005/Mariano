import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usandoEmuladores } from "../../firebase/app";
import "./AdminLayout.css";

// Secciones del panel. `soloProgramador` marca lo sensible: costos, dólar,
// márgenes y datos de cobro. La admin no las ve ni en el menú, y las reglas
// de Firestore tampoco se lo permitirían.
const SECCIONES = [
  { a: "/admin", texto: "Inicio", exacta: true },
  { a: "/admin/productos", texto: "Productos" },
];

export const AdminLayout = () => {
  const { nombre, rol, salir } = useAuth();
  const navegar = useNavigate();

  const cerrarSesion = async () => {
    await salir();
    navegar("/admin/login", { replace: true });
  };

  return (
    <div className="admin">
      {/* Que el panel no aparezca en Google. */}
      <meta name="robots" content="noindex, nofollow" />

      <header className="admin-barra">
        <Link to="/admin" className="admin-marca">
          Aurora <small>panel</small>
        </Link>
        <nav className="admin-nav" aria-label="Secciones del panel">
          {SECCIONES.filter((s) => !s.soloProgramador || rol === "programador").map((s) => (
            <NavLink key={s.a} to={s.a} end={s.exacta} className="admin-link">
              {s.texto}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sesion">
          <span className="admin-quien">
            {nombre} <span className={`admin-rol admin-rol-${rol}`}>{rol}</span>
          </span>
          <button type="button" className="btn bg-outline admin-salir" onClick={cerrarSesion}>
            Salir
          </button>
        </div>
      </header>

      {usandoEmuladores && (
        <p className="admin-emulador" role="note">
          Estás en los <b>emuladores</b> de esta máquina: los datos son de prueba y no salen de acá.
        </p>
      )}

      <main className="admin-cuerpo">
        <Outlet />
      </main>
    </div>
  );
};
