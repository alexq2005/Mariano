import { useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { useConsulta } from "../../admin/vivo";
import { nombreMes } from "../../admin/formato";
import { plata } from "../../utils/precios";
import "./AdminVentas.css";

// Un tope "redondo" para el eje: 0 / mitad / tope, con números limpios.
const topeRedondo = (max) => {
  if (max <= 0) return 1;
  const paso = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / paso) * paso;
};
const compacto = (n) =>
  n >= 1e6 ? `$${(n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} mil` : plata(n);

// Ventas por día: una sola serie (lo vendido), así que no lleva leyenda: el
// título dice qué es. Barras finas con la punta redondeada, el día más alto
// con su valor, y el detalle de cada día al pasar el mouse o en la tabla.
const GraficoDias = ({ mes, dias }) => {
  const [a, m] = mes.split("-").map(Number);
  const cantidad = new Date(a, m, 0).getDate();
  const valores = Array.from({ length: cantidad }, (_, i) => {
    const d = dias?.[String(i + 1).padStart(2, "0")];
    return { dia: i + 1, total: d?.total ?? 0, pedidos: d?.pedidos ?? 0, unidades: d?.unidades ?? 0 };
  });
  const max = Math.max(...valores.map((v) => v.total));
  const tope = topeRedondo(max);
  const [sobre, setSobre] = useState(null);

  const ancho = 640;
  const alto = 200;
  const izq = 56;
  const arriba = 22;
  const abajo = 24;
  const alturaUtil = alto - arriba - abajo;
  const franja = (ancho - izq - 4) / cantidad;
  const barra = Math.min(24, franja - 2);
  const y = (v) => arriba + alturaUtil - (v / tope) * alturaUtil;
  const mayor = valores.reduce((a2, v) => (v.total > a2.total ? v : a2), valores[0]);

  // Columna con la punta redondeada (4px) y la base recta.
  const columna = (x, y0, h) => {
    const r = Math.min(4, h, barra / 2);
    const base = y0 + h;
    return `M${x},${base} V${y0 + r} Q${x},${y0} ${x + r},${y0} H${x + barra - r} Q${x + barra},${y0} ${x + barra},${y0 + r} V${base} Z`;
  };

  return (
    <figure className="grafico">
      <figcaption>Vendido por día · {nombreMes(mes)}</figcaption>
      <div className="grafico-marco">
        <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Ventas por día de ${nombreMes(mes)}. El día de más ventas fue el ${mayor.dia}, con ${plata(mayor.total)}. El detalle está en la tabla de abajo.`}>
          {[0, tope / 2, tope].map((t) => (
            <g key={t} className="grafico-grilla">
              <line x1={izq} x2={ancho} y1={y(t)} y2={y(t)} />
              <text x={izq - 8} y={y(t) + 4} textAnchor="end">
                {compacto(t)}
              </text>
            </g>
          ))}
          {valores.map((v, i) => {
            const x = izq + 2 + i * franja + (franja - barra) / 2;
            const h = Math.max(0, alto - abajo - y(v.total));
            return (
              <g key={v.dia} onMouseEnter={() => setSobre(v)} onMouseLeave={() => setSobre(null)}>
                {/* El área sensible es toda la franja del día, no solo la barra. */}
                <rect x={izq + 2 + i * franja} y={arriba} width={franja} height={alturaUtil} className="grafico-zona" />
                {h > 0 && <path d={columna(x, alto - abajo - h, h)} className={`grafico-barra ${sobre?.dia === v.dia ? "activa" : ""}`} />}
                {(v.dia === 1 || v.dia % 5 === 0) && (
                  <text x={x + barra / 2} y={alto - 6} textAnchor="middle" className="grafico-eje">
                    {v.dia}
                  </text>
                )}
              </g>
            );
          })}
          {max > 0 && (
            <text x={izq + 2 + (mayor.dia - 1) * franja + franja / 2} y={y(mayor.total) - 6} textAnchor="middle" className="grafico-valor">
              {compacto(mayor.total)}
            </text>
          )}
        </svg>
        {sobre && (
          <div className="grafico-tooltip" style={{ left: `${((izq + 2 + (sobre.dia - 0.5) * franja) / ancho) * 100}%` }} role="status">
            <b>Día {sobre.dia}</b>
            <span className="num">{plata(sobre.total)}</span>
            <small>
              {sobre.pedidos} {sobre.pedidos === 1 ? "pedido" : "pedidos"} · {sobre.unidades} u.
            </small>
          </div>
        )}
      </div>
      <details className="grafico-tabla">
        <summary>Ver los días en una tabla</summary>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col" className="der">Pedidos</th>
              <th scope="col" className="der">Unidades</th>
              <th scope="col" className="der">Vendido</th>
            </tr>
          </thead>
          <tbody>
            {valores.filter((v) => v.pedidos || v.total).map((v) => (
              <tr key={v.dia}>
                <th scope="row">{v.dia}</th>
                <td className="der num">{v.pedidos}</td>
                <td className="der num">{v.unidades}</td>
                <td className="der num">{plata(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
};

// Ventas: lo confirmado, por mes. Un pedido cuenta como venta al
// confirmarse; si después se cancela, se resta.
export const AdminVentas = () => {
  const consulta = useMemo(() => query(collection(db, "stats"), orderBy("mes", "desc"), limit(12)), []);
  const { docs: meses, cargando, error } = useConsulta(consulta);
  const [elegido, setElegido] = useState("");
  const actual = meses.find((m) => m.id === elegido) ?? meses[0];

  const productos = useMemo(
    () =>
      Object.entries(actual?.productos ?? {})
        .map(([id, p]) => ({ id, ...p }))
        .filter((p) => p.unidades > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15),
    [actual],
  );

  if (cargando) return <p className="estado">Cargando ventas…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;

  if (!actual) {
    return (
      <section>
        <title>Ventas | Panel</title>
        <h1>Ventas</h1>
        <div className="estado">
          <h2>Todavía no hay ventas</h2>
          <p>Un pedido cuenta como venta cuando lo confirmás en Pedidos.</p>
        </div>
      </section>
    );
  }

  const t = actual.totales ?? {};
  return (
    <section>
      <title>Ventas | Panel</title>
      <div className="admin-titulo">
        <h1>Ventas</h1>
        <label className="orden">
          <span>Mes</span>
          <select value={actual.id} onChange={(e) => setElegido(e.target.value)}>
            {meses.map((m) => (
              <option key={m.id} value={m.id}>
                {nombreMes(m.id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-tarjetas">
        <div className="admin-tarjeta">
          <div className="rotulo">Vendido</div>
          <div className="dato num">{plata(t.total ?? 0)}</div>
          <div className="nota">pedidos confirmados, sin envío</div>
        </div>
        <div className="admin-tarjeta">
          <div className="rotulo">Pedidos</div>
          <div className="dato num">{t.pedidos ?? 0}</div>
          <div className="nota">ticket promedio {plata(t.pedidos ? t.total / t.pedidos : 0)}</div>
        </div>
        <div className="admin-tarjeta">
          <div className="rotulo">Unidades</div>
          <div className="dato num">{t.unidades ?? 0}</div>
        </div>
        <div className="admin-tarjeta">
          <div className="rotulo">Descuento por mayor</div>
          <div className="dato num">{plata(t.ahorro ?? 0)}</div>
          <div className="nota">lo que ahorraron las clientas</div>
        </div>
      </div>

      <div className="admin-tarjeta">
        <GraficoDias mes={actual.id} dias={actual.dias} />
      </div>

      <h2 className="ventas-subtitulo">Lo más vendido</h2>
      {productos.length === 0 ? (
        <p className="admin-conteo">Sin productos vendidos este mes.</p>
      ) : (
        <div className="admin-tabla-marco">
          <table className="admin-tabla">
            <caption className="solo-lector">Productos más vendidos de {nombreMes(actual.id)}</caption>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col" className="der">Unidades</th>
                <th scope="col" className="der">Vendido</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.nom}</th>
                  <td className="der num">{p.unidades}</td>
                  <td className="der num">{plata(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
