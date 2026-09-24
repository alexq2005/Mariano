import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider";
import { ProtectedRoute } from "../components/ProtectedRoute/ProtectedRoute";
import { AdminLayout } from "../layouts/AdminLayout/AdminLayout";
import { AdminLogin } from "../components/AdminLogin/AdminLogin";
import { AdminHome } from "../components/AdminHome/AdminHome";
import { AdminProducts } from "../components/AdminProducts/AdminProducts";
import { AdminProducto } from "../components/AdminProducto/AdminProducto";
import { AdminPedidos } from "../components/AdminPedidos/AdminPedidos";
import { AdminPedido } from "../components/AdminPedidos/AdminPedido";
import { AdminVentas } from "../components/AdminVentas/AdminVentas";
import { AdminFacturas } from "../components/AdminFacturas/AdminFacturas";
import { AdminClientas } from "../components/AdminClientas/AdminClientas";
import { AdminHistorial } from "../components/AdminHistorial/AdminHistorial";
import { AdminArrepentimientos } from "../components/AdminArrepentimientos/AdminArrepentimientos";
import { AdminConfig } from "../components/AdminConfig/AdminConfig";
import { AdminPrecios } from "../components/AdminPrecios/AdminPrecios";

// Todo el panel vive acá adentro y se carga aparte (React.lazy en App.jsx):
// una clienta que entra a la tienda no descarga ni el panel ni el SDK de
// Firebase, que pesa bastante y no le sirve de nada.
export default function AdminArea() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="pedidos" element={<AdminPedidos />} />
            <Route path="pedidos/:id" element={<AdminPedido />} />
            <Route path="productos" element={<AdminProducts />} />
            <Route path="productos/nuevo" element={<AdminProducto />} />
            <Route path="productos/:id" element={<AdminProducto />} />
            <Route path="ventas" element={<AdminVentas />} />
            <Route path="facturas" element={<AdminFacturas />} />
            <Route path="clientas" element={<AdminClientas />} />
            <Route path="arrepentimientos" element={<AdminArrepentimientos />} />
            <Route path="historial" element={<AdminHistorial />} />
            <Route path="configuracion" element={<AdminConfig />} />
            {/* Precios: solo el programador (las reglas tampoco dejan leer
                privado/ a la admin). Adentro del layout: si la admin llega
                acá, ve el aviso con el menú, y puede seguir. */}
            <Route element={<ProtectedRoute roles={["programador"]} />}>
              <Route path="precios" element={<AdminPrecios />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  );
}
