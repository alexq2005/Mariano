import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Al entrar a otra página se arranca desde arriba. Con "Atrás" (POP) no:
// ahí el navegador devuelve a la posición donde estaba la clienta.
export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const tipo = useNavigationType();

  useEffect(() => {
    if (tipo !== "POP") window.scrollTo(0, 0);
  }, [pathname, tipo]);

  return null;
};
