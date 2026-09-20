import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider";
import { ProtectedRoute } from "../components/ProtectedRoute/ProtectedRoute";
import { AdminLayout } from "../layouts/AdminLayout/AdminLayout";
import { AdminLogin } from "../components/AdminLogin/AdminLogin";
import { AdminHome } from "../components/AdminHome/AdminHome";
import { AdminProducts } from "../components/AdminProducts/AdminProducts";

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
            <Route path="productos" element={<AdminProducts />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  );
}
