import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Puerta del panel. Ojo: esto es comodidad, no seguridad. Lo que de verdad
// protege los datos son las reglas de Firestore: aunque alguien fuerce la
// ruta en el navegador, sin el rol correcto no puede leer ni escribir nada.
export const ProtectedRoute = ({ roles }) => {
  const { cargando, usuario, rol, error } = useAuth();
  const donde = useLocation();

  if (cargando) return <p className="estado">Verificando tu sesión…</p>;

  if (!usuario) return <Navigate to="/admin/login" state={{ volverA: donde.pathname }} replace />;

  if (!rol) {
    return (
      <div className="estado" role="alert">
        <h1>Tu cuenta no tiene acceso al panel</h1>
        <p>{error ?? "Pedile al programador que te habilite."}</p>
        <Link to="/" className="btn bg-primary">
          Ir a la tienda
        </Link>
      </div>
    );
  }

  if (roles && !roles.includes(rol)) {
    return (
      <div className="estado" role="alert">
        <h1>Esta sección es solo para el programador</h1>
        <p>Tu cuenta entra como {rol}.</p>
        <Link to="/admin" className="btn bg-primary">
          Volver al panel
        </Link>
      </div>
    );
  }

  return <Outlet />;
};
