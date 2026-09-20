import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { CONFIG } from "../../config";
import "./AdminLogin.css";

// Los códigos de Firebase no se le muestran a nadie: se traducen.
const MENSAJES = {
  "auth/invalid-credential": "El email o la contraseña no coinciden.",
  "auth/invalid-login-credentials": "El email o la contraseña no coinciden.",
  "auth/wrong-password": "El email o la contraseña no coinciden.",
  "auth/user-not-found": "El email o la contraseña no coinciden.",
  "auth/missing-password": "Escribí tu contraseña.",
  "auth/invalid-email": "Ese email no tiene un formato válido.",
  "auth/user-disabled": "Esa cuenta está deshabilitada.",
  "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  "auth/network-request-failed": "No hay conexión con el servidor. Revisá tu internet.",
};

export const AdminLogin = () => {
  const { usuario, rol, entrar, avisoSalida } = useAuth();
  const donde = useLocation();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  // Ya tiene sesión con acceso: al panel.
  if (usuario && rol) return <Navigate to={donde.state?.volverA ?? "/admin"} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEntrando(true);
    try {
      await entrar(email, clave);
    } catch (err) {
      // El código sin traducir queda en la consola para poder diagnosticar.
      if (!MENSAJES[err.code]) console.error("Error de ingreso sin traducir:", err.code, err.message);
      setError(MENSAJES[err.code] ?? "No se pudo entrar. Probá de nuevo.");
      setEntrando(false);
    }
  };

  return (
    <main className="login">
      <title>{`Panel | ${CONFIG.nombre_negocio}`}</title>
      <meta name="robots" content="noindex, nofollow" />

      <form className="login-caja" onSubmit={enviar}>
        <h1 className="login-marca">
          {CONFIG.nombre_negocio} <small>panel</small>
        </h1>
        <p className="login-intro">Entrá con la cuenta que te dieron para administrar la tienda.</p>

        <div className="campo">
          <label htmlFor="l-email">Email</label>
          <input
            id="l-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="l-clave">Contraseña</label>
          <input
            id="l-clave"
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>

        <p className="login-error" role="alert">
          {/* Si la sesión se cerró sola (cuenta dada de baja), se explica
              por qué: sin esto, la persona vuelve al login sin entender. */}
          {error || avisoSalida}
        </p>

        <button type="submit" className="btn bg-primary login-boton" disabled={entrando}>
          {entrando ? "Entrando…" : "Entrar"}
        </button>

        <Link to="/" className="login-volver">
          Volver a la tienda
        </Link>
      </form>
    </main>
  );
};
