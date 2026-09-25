import { useMemo } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { useAuth } from "../../context/AuthContext";
import { useConsulta } from "../../admin/vivo";
import { ACCIONES, COBROS, fechaHora } from "../../admin/formato";
import { plata } from "../../utils/precios";
import "../AdminPedidos/AdminPedidos.css";

// Un renglón legible del detalle de cada acción.
const resumen = (a) => {
  const d = a.detalle ?? {};
  switch (a.accion) {
    case "pedido.confirmar":
    case "pedido.entregar":
    case "pedido.cancelar":
      return `Pedido #${d.numero}${d.motivo ? ` — ${d.motivo}` : ""}`;
    case "stock.ajustar":
      return `${d.nombre}: ${d.antes ?? "sin control"} → ${d.despues ?? "sin control"}`;
    case "producto.pausar":
      return `${d.nombre}: ${d.activo ? "reactivado" : "pausado"}`;
    case "producto.guardar":
      return `${d.nombre}${d.nuevo ? " (nuevo)" : ` — ${(d.cambios ?? []).join(", ") || "sin cambios"}`}`;
    case "config.guardar":
      return Object.keys(d).join(", ");
    case "precios.recalcular":
      return `${d.cambian} precios cambiaron`;
    case "arrepentimiento.resolver":
      return `${d.codigo}${d.numero ? ` · pedido #${d.numero}` : ""}`;
    case "clienta.borrar":
      return `${d.pedidosAnonimizados} pedidos anonimizados`;
    case "pedido.envio":
      return `Pedido #${d.numero}: envío ${plata(d.antes)} → ${plata(d.despues)}`;
    case "pago.registrar":
    case "pago.anular":
      return `Pedido #${d.numero} · ${d.medio} · ${plata(d.monto)}`;
    case "pago.devolver":
    case "pago.mercadopago":
    case "pago.demas":
      return `Pedido #${d.numero} · ${plata(d.monto)}${d.estado ? ` · ${COBROS[d.estado] ?? d.estado}` : ""} · n.º ${d.referencia}`;
    case "factura.emitida":
    case "factura.anulada":
      return `Pedido #${d.numero} · ${d.comprobante} · ${plata(d.total)}${d.ambiente === "homologacion" ? " · prueba" : ""}${d.recuperado ? " · recuperado" : ""}`;
    case "factura.reintentar":
    case "factura.emitir":
      return `Pedido #${d.numero}`;
    case "pedido.fiscal":
      return `Pedido #${d.numero} · ${d.cuit ? `CUIT ${d.cuit}` : d.conDni ? "con DNI" : "consumidor final"}`;
    case "facturacion.guardar":
    case "cobro.guardar":
      // A dónde va la plata: se muestra el antes y el después.
      return Object.entries(d)
        .map(([k, v]) => `${k}: ${v.antes ?? "—"} → ${v.despues ?? "—"}`)
        .join(" · ");
    default:
      return "";
  }
};

// Quién hizo qué y cuándo. Lo escribe solo el servidor, en la misma
// operación que el cambio: no se puede falsear ni borrar. La admin ve lo
// general; lo sensible (dólar, márgenes) solo el programador.
export const AdminHistorial = () => {
  const { rol } = useAuth();
  const consulta = useMemo(() => {
    const base = collection(db, "auditoria");
    return rol === "programador"
      ? query(base, orderBy("cuando", "desc"), limit(100))
      : query(base, where("nivel", "==", "general"), orderBy("cuando", "desc"), limit(100));
  }, [rol]);
  const { docs, cargando, error } = useConsulta(consulta);

  if (cargando) return <p className="estado">Cargando el historial…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;

  return (
    <section>
      <title>Historial | Panel</title>
      <h1>Historial</h1>
      <p className="admin-intro">Las últimas 100 operaciones del panel. No se pueden borrar ni modificar.</p>
      {docs.length === 0 ? (
        <div className="estado">
          <h2>Todavía no hay operaciones</h2>
        </div>
      ) : (
        <div className="admin-tabla-marco" tabIndex={0} role="region" aria-label="Historial de operaciones">
          <table className="admin-tabla">
            <caption className="solo-lector">Historial de operaciones</caption>
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Quién</th>
                <th scope="col">Qué</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((a) => (
                <tr key={a.id}>
                  <td className="num">{fechaHora(a.cuando)}</td>
                  <td>
                    {a.quien?.email ?? (a.quien?.rol === "sistema" ? (a.quien?.uid === "arca" ? "ARCA" : "Mercado Pago") : "—")} <span className={`admin-rol admin-rol-${a.quien?.rol}`}>{a.quien?.rol}</span>
                  </td>
                  <td>
                    {ACCIONES[a.accion] ?? a.accion}
                    {a.nivel === "sensible" && <span className="admin-pastilla pausado"> sensible</span>}
                  </td>
                  <td>{resumen(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
