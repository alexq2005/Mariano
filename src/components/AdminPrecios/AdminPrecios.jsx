import { useState } from "react";
import { useDocumento } from "../../admin/vivo";
import { llamarPanel, llamarYRefrescar } from "../../services/panel";
import { plata } from "../../utils/precios";
import "../Checkout/Checkout.css";
import "../AdminProducto/AdminProducto.css";

const CAMPOS = [
  { id: "tipo_cambio", nom: "Dólar (pesos por USD)" },
  { id: "factor_importacion", nom: "Factor de importación" },
  { id: "margen_menor", nom: "Margen por menor" },
  { id: "margen_mayor", nom: "Margen por mayor" },
  { id: "redondeo", nom: "Redondeo ($)" },
];

const Formulario = ({ parametros }) => {
  const [f, setF] = useState(() => Object.fromEntries(CAMPOS.map((c) => [c.id, parametros?.[c.id] != null ? String(parametros[c.id]) : ""])));
  const [vista, setVista] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const numeros = () => Object.fromEntries(CAMPOS.map((c) => [c.id, Number(String(f[c.id]).replace(",", "."))]));

  const previsualizar = async (e) => {
    e.preventDefault();
    setTrabajando(true);
    setAviso({ tipo: "", texto: "" });
    try {
      setVista(await llamarPanel("precios.recalcular", { parametros: numeros() }));
    } catch (err) {
      setVista(null);
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setTrabajando(false);
    }
  };

  const aplicar = async () => {
    setTrabajando(true);
    try {
      const r = await llamarYRefrescar("precios.recalcular", { parametros: numeros(), aplicar: true });
      setAviso({ tipo: "ok", texto: `Listo: ${r.cambian} precios actualizados. La lista queda con fecha ${r.lista}.` });
      setVista(null);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <form className="producto-form" onSubmit={previsualizar} noValidate>
      <div className="producto-dos">
        {CAMPOS.map((c) => (
          <div className="campo" key={c.id}>
            <label htmlFor={`pr-${c.id}`}>{c.nom}</label>
            <input id={`pr-${c.id}`} inputMode="decimal" value={f[c.id]} onChange={(e) => { setF({ ...f, [c.id]: e.target.value }); setVista(null); }} />
          </div>
        ))}
      </div>
      <p className="nota-campo">precio = costo en USD × factor × dólar × margen, redondeado.</p>
      <button type="submit" className="btn bg-outline" disabled={trabajando}>
        {trabajando && !vista ? "Calculando…" : "Ver cómo quedan"}
      </button>

      {vista && (
        <div className="precios-vista">
          <p>
            Cambian <b>{vista.cambian}</b> de {vista.conCosto} productos con costo cargado.
            {vista.sinCosto === 1 && " 1 producto no tiene costo y conserva su precio."}
            {vista.sinCosto > 1 && ` ${vista.sinCosto} productos no tienen costo y conservan su precio.`}
          </p>
          {vista.ejemplos.length > 0 && (
            <div className="admin-tabla-marco" tabIndex={0} role="region" aria-label="Vista previa de los precios">
              <table className="admin-tabla">
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col" className="der">Por menor</th>
                    <th scope="col" className="der">Por mayor</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.ejemplos.map((x) => (
                    <tr key={x.id}>
                      <th scope="row">{x.nom}</th>
                      <td className="der num">
                        {plata(x.antes.menor)} → <b>{plata(x.despues.menor)}</b>
                      </td>
                      <td className="der num">
                        {plata(x.antes.mayor)} → <b>{plata(x.despues.mayor)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vista.cambian > 0 && (
            <button type="button" className="btn bg-primary" onClick={aplicar} disabled={trabajando}>
              {trabajando ? "Aplicando…" : `Aplicar a la tienda (${vista.cambian} precios)`}
            </button>
          )}
        </div>
      )}
      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>
    </form>
  );
};

// Solo el programador: el dólar, el factor de importación y los márgenes
// dicen cuánto gana el negocio. Recalcula los precios de los productos con
// costo cargado (lo sube npm run publicar desde datos/proveedor.json).
export const AdminPrecios = () => {
  const { datos, cargando, error } = useDocumento("privado/config");
  const { datos: costos } = useDocumento("privado/costos");
  if (cargando) return <p className="estado">Cargando…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;
  const cuantos = Object.keys(costos?.costos ?? {}).length;
  return (
    <section>
      <title>Precios | Panel</title>
      <h1>Precios</h1>
      <p className="admin-intro">
        Solo vos ves esta sección. Hay {cuantos} {cuantos === 1 ? "producto" : "productos"} con costo cargado.
        {cuantos === 0 && " Subí los costos desde tu compu con npm run publicar (lee datos/proveedor.json)."}
      </p>
      {/* key: se arma una vez, cuando llegan los parámetros guardados. Si se
          rearmara con cada cambio, al aplicar se perdería el aviso de éxito. */}
      <Formulario key={datos ? "con-parametros" : "sin-parametros"} parametros={datos?.parametros ?? null} />
    </section>
  );
};
