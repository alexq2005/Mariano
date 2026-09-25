import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../../firebase/panel";
import { nombreMes } from "../../admin/formato";
import { plata } from "../../utils/precios";
import { urlFactura } from "../../services/tienda";
import "../AdminProducts/AdminProducts.css";
import "../AdminPedidos/AdminPedidos.css";
import "../AdminVentas/AdminVentas.css";
import "./AdminFacturas.css";

// Los últimos 12 meses, en hora de Argentina: "2026-09", "2026-08"…
const ultimosMeses = () => {
  const [a, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};
const MESES = ultimosMeses();

const inicioDe = (mes) => new Date(`${mes}-01T00:00:00-03:00`);
const siguiente = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};

// Todas las del mes, de a 100 (las reglas no dejan pedir más por consulta).
const traerMes = async (mes) => {
  const todas = [];
  let ultimo = null;
  for (let pagina = 0; pagina < 30; pagina++) {
    const q = query(
      collection(db, "comprobantes"),
      where("fecha", ">=", inicioDe(mes)),
      where("fecha", "<", inicioDe(siguiente(mes))),
      orderBy("fecha"),
      ...(ultimo ? [startAfter(ultimo)] : []),
      limit(100),
    );
    const r = await getDocs(q);
    todas.push(...r.docs.map((d) => ({ token: d.id, ...d.data() })));
    if (r.docs.length < 100) break;
    ultimo = r.docs.at(-1);
  }
  return todas.sort((x, y) => x.fechaArca.localeCompare(y.fechaArca) || x.tipo - y.tipo || x.numero - y.numero);
};

const fechaCorta = (s) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
const signo = (c) => (c.clase === "nc" ? -1 : 1);

// Para el contador: separado con punto y coma y con coma decimal, como lo
// abre Excel en castellano.
const csv = (lista) => {
  const n = (x) => Number(x).toFixed(2).replace(".", ",");
  const celda = (t) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const filas = [
    ["Fecha", "Comprobante", "Punto de venta", "Número", "CAE", "Receptor", "Documento", "Condición IVA", "Neto", "IVA", "Total", "Pedido", "Ambiente"],
    ...lista.map((c) => [
      fechaCorta(c.fechaArca),
      c.nombre,
      c.ptoVta,
      c.numero,
      c.cae,
      c.receptor?.nombre,
      c.receptor?.doc,
      c.receptor?.condicion,
      n(signo(c) * c.neto),
      n(signo(c) * c.iva),
      n(signo(c) * c.total),
      c.pedido,
      c.ambiente === "homologacion" ? "prueba" : "producción",
    ]),
  ];
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
};

// Facturas y notas de crédito del mes: para revisar y para el contador.
export const AdminFacturas = () => {
  const [mes, setMes] = useState(MESES[0]);
  const [conPruebas, setConPruebas] = useState(false);
  const [leido, setLeido] = useState({ mes: null, lista: [], error: null });

  useEffect(() => {
    let vivo = true;
    traerMes(mes)
      .then((lista) => vivo && setLeido({ mes, lista, error: null }))
      .catch((err) => vivo && setLeido({ mes, lista: [], error: err.message }));
    return () => {
      vivo = false;
    };
  }, [mes]);

  const cargando = leido.mes !== mes;
  const pruebas = leido.lista.filter((c) => c.ambiente === "homologacion").length;
  // Si todo es de prueba (antes de pasar a producción), se muestra igual.
  const soloPruebas = pruebas > 0 && pruebas === leido.lista.length;
  const lista = leido.lista.filter((c) => conPruebas || soloPruebas || c.ambiente !== "homologacion");
  const suma = (campo) => lista.reduce((s, c) => s + signo(c) * c[campo], 0);
  const facturas = lista.filter((c) => c.clase === "factura").length;
  const notas = lista.length - facturas;

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([csv(lista)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprobantes-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <title>Facturas | Panel</title>
      <div className="admin-titulo">
        <h1>Facturas</h1>
        <label className="orden">
          <span>Mes</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {MESES.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="admin-intro">Lo que se emitió en ARCA en el mes. Las notas de crédito restan.</p>

      {leido.error && (
        <p className="estado" role="alert">
          {leido.error}
        </p>
      )}
      {cargando && <p className="estado">Cargando…</p>}

      {!cargando && !leido.error && (
        <>
          <div className="admin-tarjetas">
            <div className="admin-tarjeta">
              <div className="rotulo">Facturado</div>
              <div className="dato num">{plata(suma("total"))}</div>
              <div className="nota">
                {facturas} {facturas === 1 ? "factura" : "facturas"} · {notas} {notas === 1 ? "nota de crédito" : "notas de crédito"}
              </div>
            </div>
            <div className="admin-tarjeta">
              <div className="rotulo">Neto</div>
              <div className="dato num">{plata(suma("neto"))}</div>
            </div>
            <div className="admin-tarjeta">
              <div className="rotulo">IVA</div>
              <div className="dato num">{plata(suma("iva"))}</div>
              <div className="nota">discriminado en facturas A y B</div>
            </div>
          </div>

          <div className="pedido-acciones">
            <button type="button" className="btn bg-primary" onClick={descargar} disabled={!lista.length}>
              Descargar para el contador (CSV)
            </button>
            {soloPruebas && <p className="nota-campo">Son todos de prueba (homologación): no tienen validez fiscal.</p>}
            {pruebas > 0 && !soloPruebas && (
              <label className="facturas-pruebas">
                <input type="checkbox" checked={conPruebas} onChange={(e) => setConPruebas(e.target.checked)} /> Incluir los de prueba (homologación)
              </label>
            )}
          </div>

          {lista.length === 0 ? (
            <p className="admin-conteo">No hay comprobantes en {nombreMes(mes)}.</p>
          ) : (
            <div className="admin-tabla-marco" tabIndex={0} role="region" aria-label="Comprobantes del mes">
              <table className="admin-tabla">
                <caption className="solo-lector">Comprobantes de {nombreMes(mes)}</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Comprobante</th>
                    <th scope="col">Receptor</th>
                    <th scope="col">Total</th>
                    <th scope="col">Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.token}>
                      <td className="num">{fechaCorta(c.fechaArca)}</td>
                      <td>
                        <a href={urlFactura(c.token)} target="_blank" rel="noopener noreferrer">
                          {c.nombre} <span className="num">{c.numeroTexto}</span>
                        </a>
                        {c.ambiente === "homologacion" && <span className="admin-pastilla pausado"> prueba</span>}
                      </td>
                      <td>
                        {c.receptor?.nombre}
                        {c.receptor?.doc && <small className="num"> · {c.receptor.doc}</small>}
                      </td>
                      <td className="num">{plata(signo(c) * c.total)}</td>
                      <td className="num">#{c.pedido}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};
