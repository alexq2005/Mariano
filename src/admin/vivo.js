import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/panel";

// Escuchar Firestore en vivo desde el panel: un pedido que entra aparece
// solo, sin recargar. El navegador solo LEE; las reglas de firestore.rules
// deciden qué puede ver cada rol.

const explicar = (err) => {
  console.error("Firestore:", err);
  if (err?.code === "permission-denied") return "Tu cuenta no puede ver esto.";
  if (err?.code === "failed-precondition") return "Falta crear un índice en Firestore (ver el LEEME: firebase deploy --only firestore).";
  return "No se pudo cargar. Revisá la conexión.";
};

// Un documento por ruta ("interno/tablero"). null = no escuchar nada.
export const useDocumento = (ruta) => {
  const [estado, setEstado] = useState({ ruta: null, datos: null, error: null });
  useEffect(() => {
    if (!ruta) return undefined;
    return onSnapshot(
      doc(db, ruta),
      (snap) => setEstado({ ruta, datos: snap.exists() ? { id: snap.id, ...snap.data() } : null, error: null }),
      (err) => setEstado({ ruta, datos: null, error: explicar(err) }),
    );
  }, [ruta]);
  // Mientras llega lo de la ruta nueva, no se muestra lo de la anterior.
  const vigente = estado.ruta === ruta;
  return { cargando: Boolean(ruta) && !vigente, datos: vigente ? estado.datos : null, error: vigente ? estado.error : null };
};

// Una consulta. `consulta` tiene que venir de un useMemo con sus
// dependencias: si cambia en cada render, se re-suscribe en cada render.
export const useConsulta = (consulta) => {
  const [estado, setEstado] = useState({ consulta: null, docs: [], error: null });
  useEffect(() => {
    if (!consulta) return undefined;
    return onSnapshot(
      consulta,
      (snap) => setEstado({ consulta, docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
      (err) => setEstado({ consulta, docs: [], error: explicar(err) }),
    );
  }, [consulta]);
  const vigente = estado.consulta === consulta;
  return { cargando: Boolean(consulta) && !vigente, docs: vigente ? estado.docs : [], error: vigente ? estado.error : null };
};
