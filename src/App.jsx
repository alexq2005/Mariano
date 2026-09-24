import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout/PublicLayout";
import { ItemListContainer } from "./components/ItemListContainer/ItemListContainer";
import { ItemDetailContainer } from "./components/ItemDetailContainer/ItemDetailContainer";
import { Cart } from "./components/Cart/Cart";
import { Checkout } from "./components/Checkout/Checkout";
import { Seguimiento } from "./components/Seguimiento/Seguimiento";
import { ScrollToTop } from "./components/ScrollToTop/ScrollToTop";
import { useProductos } from "./hooks/useProductos";

// El panel se descarga aparte, solo cuando alguien entra a /admin.
const AdminArea = lazy(() => import("./admin/AdminArea"));

function App() {
  // El nombre del negocio para el <title> del 404 sale de la config, que
  // viaja con el catálogo: esta página se puede abrir antes de que llegue.
  const { config } = useProductos();

  return (
    <>
      {/* Afuera del layout: volver arriba al cambiar de página es cosa de
          la navegación, no de cómo se ve la tienda. */}
      <ScrollToTop />
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<p className="estado">Cargando el panel…</p>}>
              <AdminArea />
            </Suspense>
          }
        />
        <Route element={<PublicLayout />}>
          <Route path="/" element={<ItemListContainer />} />
          <Route path="/category/:category" element={<ItemListContainer />} />
          <Route path="/product/:id" element={<ItemDetailContainer />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pedido/:token" element={<Seguimiento />} />
          <Route
            path="*"
            element={
              <div className="estado">
                <title>
                  {config ? `Página no encontrada | ${config.nombre_negocio}` : "Página no encontrada"}
                </title>
                <h1>Página no encontrada</h1>
                <Link to="/" className="btn bg-primary">
                  Ver el catálogo
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;
