import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { useDocumento } from "../../admin/vivo";
import { llamarYRefrescar } from "../../services/panel";
import { rutaImagen } from "../../services/productos";
import { RUBROS } from "../../compartido/producto";
import { calcularPrecios } from "../../compartido/formula";
import { nombreRubro } from "../../utils/filtros";
import { plata } from "../../utils/precios";
import "../Checkout/Checkout.css";
import "./AdminProducto.css";

const VACIO = { cod: "", nom: "", desc: "", rubro: "labios", img: "", menor: "", mayor: "" };
const entero = (v) => (v === "" ? NaN : Number(String(v).replace(/\D/g, "")));

// El formulario, separado para que arranque con los datos del producto ya
// cargados (con `key` en el padre, al cambiar de producto se reinicia).
const Formulario = ({ producto, rol, parametros }) => {
  const navegar = useNavigate();
  const nuevo = !producto;
  const [f, setF] = useState(
    producto
      ? { cod: producto.cod, nom: producto.nom, desc: producto.desc ?? "", rubro: producto.rubro, img: producto.img, menor: String(producto.menor), mayor: String(producto.mayor) }
      : VACIO,
  );
  const [costo, setCosto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  let sugerido = null;
  const costoNum = Number(costo.replace(",", "."));
  if (rol === "programador" && parametros && costoNum > 0) {
    try {
      sugerido = calcularPrecios(costoNum, parametros);
    } catch {
      sugerido = null;
    }
  }

  const guardar = async (e) => {
    e.preventDefault();
    const menor = entero(f.menor);
    const mayor = entero(f.mayor);
    if (!(menor > 0) || !(mayor > 0)) return setAviso({ tipo: "error", texto: "Los dos precios son números enteros, mayores que 0." });
    if (mayor > menor) return setAviso({ tipo: "error", texto: "El precio por mayor no puede ser más alto que el precio por menor." });
    setGuardando(true);
    setAviso({ tipo: "", texto: "" });
    try {
      const r = await llamarYRefrescar("producto.guardar", {
        ...(nuevo ? {} : { id: producto.id }),
        ...f,
        menor,
        mayor,
        ...(rol === "programador" && costoNum > 0 ? { costoUsd: costoNum } : {}),
      });
      if (nuevo) navegar(`/admin/productos/${encodeURIComponent(r.id)}`, { replace: true, state: { creado: true } });
      else setAviso({ tipo: "ok", texto: "Guardado. La tienda ya muestra los cambios." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="producto-form" onSubmit={guardar} noValidate>
      <div className="producto-grilla">
        <div>
          <div className="campo">
            <label htmlFor="p-nom">Nombre</label>
            <input id="p-nom" value={f.nom} onChange={cambiar("nom")} maxLength={120} required />
          </div>
          <div className="campo">
            <label htmlFor="p-desc">
              Descripción <span className="opc">(opcional)</span>
            </label>
            <input id="p-desc" value={f.desc} onChange={cambiar("desc")} maxLength={300} />
          </div>
          <div className="producto-dos">
            <div className="campo">
              <label htmlFor="p-cod">Código</label>
              <input id="p-cod" value={f.cod} onChange={cambiar("cod")} maxLength={40} required aria-describedby="p-cod-nota" />
              {nuevo && <p id="p-cod-nota" className="nota-campo">También arma la dirección del producto en la tienda.</p>}
            </div>
            <div className="campo">
              <label htmlFor="p-rubro">Rubro</label>
              <select id="p-rubro" value={f.rubro} onChange={cambiar("rubro")}>
                {RUBROS.map((r) => (
                  <option key={r} value={r}>
                    {nombreRubro(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="producto-dos">
            <div className="campo">
              <label htmlFor="p-menor">Precio por menor ($)</label>
              <input id="p-menor" inputMode="numeric" value={f.menor} onChange={cambiar("menor")} required />
            </div>
            <div className="campo">
              <label htmlFor="p-mayor">Precio por mayor ($)</label>
              <input id="p-mayor" inputMode="numeric" value={f.mayor} onChange={cambiar("mayor")} required />
            </div>
          </div>

          {rol === "programador" && (
            <div className="producto-costo">
              <div className="campo">
                <label htmlFor="p-costo">
                  Costo en dólares <span className="opc">(opcional, solo lo ves vos)</span>
                </label>
                <input id="p-costo" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Ej.: 0,45" />
              </div>
              {sugerido && (
                <p className="nota-campo num">
                  Con el dólar y los márgenes actuales: {plata(sugerido.menor)} por menor y {plata(sugerido.mayor)} por mayor.{" "}
                  <button type="button" className="btn-link" onClick={() => setF({ ...f, menor: String(sugerido.menor), mayor: String(sugerido.mayor) })}>
                    Usar estos precios
                  </button>
                </p>
              )}
              {!parametros && <p className="nota-campo">Todavía no hay dólar ni márgenes cargados (Precios).</p>}
            </div>
          )}
        </div>

        <div>
          <div className="campo">
            <label htmlFor="p-img">Foto</label>
            <input id="p-img" value={f.img} onChange={cambiar("img")} maxLength={500} aria-describedby="p-img-nota" />
            <p id="p-img-nota" className="nota-campo">
              Un archivo de la carpeta public/img (ej. ZMA-1234.jpg) o un link https a una foto.
            </p>
          </div>
          <div className="producto-foto">
            {f.img ? <img src={rutaImagen(f.img.trim())} alt="Vista previa de la foto" /> : <span>Sin foto</span>}
          </div>
        </div>
      </div>

      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>
      <div className="pedido-acciones">
        <button type="submit" className="btn bg-primary" disabled={guardando}>
          {guardando ? "Guardando…" : nuevo ? "Crear producto" : "Guardar cambios"}
        </button>
        {!nuevo && (
          <a className="btn bg-outline" href={`${import.meta.env.BASE_URL}product/${producto.id}`} target="_blank" rel="noopener noreferrer">
            Ver en la tienda
          </a>
        )}
      </div>
    </form>
  );
};

export const AdminProducto = () => {
  const { id } = useParams();
  const { porId, loading, error } = useProductos();
  const { rol } = useAuth();
  // El programador ve el dólar y los márgenes para sugerir precios.
  const { datos: preciosPrivados } = useDocumento(rol === "programador" ? "privado/config" : null);
  const nuevo = id === undefined;
  const producto = nuevo ? null : porId.get(id);

  if (loading) return <p className="estado">Cargando…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;
  if (!nuevo && !producto) {
    return (
      <div className="estado">
        <h1>Ese producto no existe</h1>
        <Link to="/admin/productos" className="btn bg-primary">
          Volver a los productos
        </Link>
      </div>
    );
  }

  return (
    <section>
      <title>{`${nuevo ? "Nuevo producto" : producto.nom} | Panel`}</title>
      <Link to="/admin/productos" className="admin-volver">
        ← Productos
      </Link>
      <h1>{nuevo ? "Nuevo producto" : "Editar producto"}</h1>
      {producto?.origen === "panel" && <p className="admin-intro">Dado de alta desde el panel.</p>}
      <Formulario key={id ?? "nuevo"} producto={producto} rol={rol} parametros={preciosPrivados?.parametros ?? null} />
    </section>
  );
};
