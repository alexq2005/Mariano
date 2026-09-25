import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout/PublicLayout";
import { ItemListContainer } from "./components/ItemListContainer/ItemListContainer";
import { ItemDetailContainer } from "./components/ItemDetailContainer/ItemDetailContainer";
import { Cart } from "./components/Cart/Cart";
import { Checkout } from "./components/Checkout/Checkout";
import { Seguimiento } from "./components/Seguimiento/Seguimiento";
import { Arrepentimiento } from "./components/Arrepentimiento/Arrepentimiento";
import { ScrollToTop } from "./components/ScrollToTop/ScrollToTop";
import { useProductos } from "./hooks/useProductos";

// El panel se descarga aparte, solo cuando alguien entra a /admin.
const AdminArea = lazy(() => import("./admin/AdminArea"));
// La factura también: lleva el generador del QR, que el resto no necesita.
const Factura = lazy(() => import("./components/Factura/Factura").then((m) => ({ default: m.Factura })));

// Sin las variables de Firebase (por ejemplo, recién publicado en Vercel) el
// panel no tiene a dónde conectarse: Firebase Auth ni siquiera arranca sin
// apiKey. En vez de una pantalla rota, se explica qué falta.
const panelConectado = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_API_KEY);

const PanelSinConectar = () => (
  <main className="estado">
    <title>Panel sin conectar</title>
    <meta name="robots" content="noindex, nofollow" />
    <h1>El panel todavía no está conectado</h1>
    <p>Faltan los datos del proyecto de Firebase (las variables VITE_FIREBASE_* del sitio).</p>
    <p>Los pasos están en el LEEME del proyecto, en «En producción: la primera vez».</p>
    <Link to="/" className="btn bg-primary">
      Ir a la tienda
    </Link>
  </main>
);

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
            panelConectado ? (
              <Suspense fallback={<p className="estado">Cargando el panel…</p>}>
                <AdminArea />
              </Suspense>
            ) : (
              <PanelSinConectar />
            )
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
            path="/factura/:token"
            element={
              <Suspense fallback={<p className="estado">Buscando la factura…</p>}>
                <Factura />
              </Suspense>
            }
          />
          <Route path="/arrepentimiento" element={<Arrepentimiento />} />
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
