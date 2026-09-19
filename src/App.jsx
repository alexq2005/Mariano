import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header/Header";
import { Footer } from "./components/Footer/Footer";
import { ItemListContainer } from "./components/ItemListContainer/ItemListContainer";
import { ItemDetailContainer } from "./components/ItemDetailContainer/ItemDetailContainer";
import { Cart } from "./components/Cart/Cart";
import { Checkout } from "./components/Checkout/Checkout";
import { CartBar } from "./components/CartBar/CartBar";
import { ScrollToTop } from "./components/ScrollToTop/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { CONFIG } from "./config";

function App() {
  const { pathname } = useLocation();

  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        {/* key: al cambiar de página se limpia un error anterior */}
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<ItemListContainer />} />
            <Route path="/category/:category" element={<ItemListContainer />} />
            <Route path="/product/:id" element={<ItemDetailContainer />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route
              path="*"
              element={
                <div className="estado">
                  <title>{`Página no encontrada | ${CONFIG.nombre_negocio}`}</title>
                  <h1>Página no encontrada</h1>
                  <Link to="/" className="btn bg-primary">
                    Ver el catálogo
                  </Link>
                </div>
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <CartBar />
    </>
  );
}

export default App;
