import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../../components/Header/Header";
import { Footer } from "../../components/Footer/Footer";
import { CartBar } from "../../components/CartBar/CartBar";
import { ErrorBoundary } from "../../components/ErrorBoundary/ErrorBoundary";

// Lo que rodea a todas las páginas de la tienda: el encabezado (con el menú
// de rubros), el pie y la barra del carrito. La página de cada ruta se
// dibuja en el <Outlet />. Como es una ruta de layout, al pasar de una
// página a otra esto no se vuelve a montar: la búsqueda y la barra siguen
// en su lugar.
export const PublicLayout = () => {
  const { pathname } = useLocation();

  return (
    <>
      <Header />
      <main>
        {/* key: al cambiar de página se limpia un error anterior */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <CartBar />
    </>
  );
};
