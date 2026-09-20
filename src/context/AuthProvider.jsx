import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/app";
import { AuthContext } from "./AuthContext";

// Quién entró y qué puede hacer.
//
// El rol NO sale del navegador: sale de staff/{uid} en Firestore, que solo
// el programador puede escribir (firestore.rules). Y se escucha en vivo: si
// a alguien le dan de baja (activo: false), se le cierra la sesión en el
// momento, sin esperar a que venza el token.
export const AuthProvider = ({ children }) => {
  const [estado, setEstado] = useState({ cargando: true, usuario: null, ficha: null, error: null });
  // Por qué se cerró la sesión sola, para explicarlo en la pantalla de
  // ingreso en vez de devolver a la persona al login sin decirle nada.
  const [avisoSalida, setAvisoSalida] = useState("");

  useEffect(() => {
    let dejarDeMirarFicha = null;

    const dejarDeMirarSesion = onAuthStateChanged(auth, (usuario) => {
      dejarDeMirarFicha?.();
      dejarDeMirarFicha = null;

      if (!usuario) {
        setEstado({ cargando: false, usuario: null, ficha: null, error: null });
        return;
      }

      setEstado({ cargando: true, usuario, ficha: null, error: null });
      dejarDeMirarFicha = onSnapshot(
        doc(db, "staff", usuario.uid),
        (snap) => {
          const ficha = snap.exists() ? snap.data() : null;
          setEstado({ cargando: false, usuario, ficha, error: null });
          // Cuenta dada de baja: afuera, aunque el token siga vigente.
          if (ficha?.activo === false) {
            setAvisoSalida("Tu cuenta ya no tiene acceso al panel. Hablá con el programador.");
            signOut(auth);
          }
        },
        (err) => {
          console.error("No se pudo leer la ficha del equipo:", err);
          setEstado({ cargando: false, usuario, ficha: null, error: "No se pudo verificar tu acceso." });
        },
      );
    });

    return () => {
      dejarDeMirarSesion();
      dejarDeMirarFicha?.();
    };
  }, []);

  const entrar = useCallback((email, clave) => {
    setAvisoSalida("");
    return signInWithEmailAndPassword(auth, email.trim(), clave);
  }, []);
  const salir = useCallback(() => signOut(auth), []);

  const valor = useMemo(
    () => ({
      ...estado,
      // Sin ficha activa no hay rol, aunque la sesión exista.
      rol: estado.ficha?.activo ? estado.ficha.rol : null,
      nombre: estado.ficha?.nombre ?? estado.usuario?.email ?? "",
      avisoSalida,
      entrar,
      salir,
    }),
    [estado, avisoSalida, entrar, salir],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};
