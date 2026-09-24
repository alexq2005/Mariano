import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./context/CartProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* basename: en GitHub Pages la tienda vive en /Mariano/ y no en la raíz. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
);
