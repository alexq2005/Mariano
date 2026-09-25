import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { useDocumento } from "../../admin/vivo";
import { filtrarProductos, nombreRubro } from "../../utils/filtros";
import { rutaImagen } from "../../services/productos";
import { plata } from "../../utils/precios";
import { llamarYRefrescar } from "../../services/panel";
import "./AdminProducts.css";

const FILTROS = [
  { id: "todos", nom: "Todos" },
  { id: "agotados", nom: "Sin stock" },
  { id: "controlados", nom: "Con stock cargado" },
  { id: "pausados", nom: "Pausados" },
];

// El stock de un producto, editable en la misma fila. Vacío = sin control
// (se vende sin tope y se confirma por WhatsApp).
const EditorStock = ({ producto, cantidad, onAviso }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (nueva) => {
    setGuardando(true);
    try {
      await llamarYRefrescar("stock.ajustar", { id: producto.id, cantidad: nueva });
      onAviso({ tipo: "ok", texto: `${producto.nom}: ${nueva === null ? "sin control de stock" : `stock en ${nueva} u.`}` });
      setEditando(false);
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <button
        type="button"
        className={`admin-stock ${cantidad === 0 ? "agotado" : ""}`}
        onClick={() => {
          setValor(cantidad === undefined || cantidad === null ? "" : String(cantidad));
          setEditando(true);
        }}
        aria-label={`Stock de ${producto.nom}: ${cantidad ?? "sin control"}. Cambiar`}
      >
        {cantidad === undefined || cantidad === null ? "—" : `${cantidad} u.`}
      </button>
    );
  }
  return (
    <form
      className="admin-stock-form"
      onSubmit={(e) => {
        e.preventDefault();
        const n = valor.trim() === "" ? null : Number(valor);
        if (n !== null && (!Number.isInteger(n) || n < 0)) {
          onAviso({ tipo: "error", texto: "El stock es un número entero, 0 o más. Vacío = sin control." });
          return;
        }
        guardar(n);
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 4))}
        aria-label={`Unidades en stock de ${producto.nom} (vacío = sin control)`}
        placeholder="—"
        autoFocus
      />
      <button type="submit" className="btn bg-primary admin-boton-chico" disabled={guardando}>
        {guardando ? "…" : "Guardar"}
      </button>
      <button type="button" className="btn bg-outline admin-boton-chico" onClick={() => setEditando(false)}>
        Cancelar
      </button>
    </form>
  );
};

// Productos del panel: buscar, filtrar, pausar, cargar stock, dar de alta y
// editar. Toda escritura pasa por el servidor: el navegador nunca escribe en
// Firestore.
export const AdminProducts = () => {
  const { productos, config, loading, error } = useProductos();
  const { rol } = useAuth();
  const { datos: stock } = useDocumento("interno/stock");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [trabajando, setTrabajando] = useState(null);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const cantidades = useMemo(() => stock?.cantidades ?? {}, [stock]);

  const pausar = async (producto, pausar) => {
    setTrabajando(producto.id);
    setAviso({ tipo: "", texto: "" });
    try {
      await llamarYRefrescar("producto.pausar", { id: producto.id, pausar });
      setAviso({ tipo: "ok", texto: `${producto.nom}: ${pausar ? "pausado, ya no se ve en la tienda" : "de vuelta en la tienda"}.` });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setTrabajando(null);
    }
  };

  const filtrados = useMemo(() => {
    const porTexto = filtrarProductos(productos, { texto });
    if (filtro === "agotados") return porTexto.filter((p) => p.agotado);
    if (filtro === "controlados") return porTexto.filter((p) => typeof cantidades[p.id] === "number");
    if (filtro === "pausados") return porTexto.filter((p) => p.activo === false);
    return porTexto;
  }, [productos, texto, filtro, cantidades]);

  if (loading) return <p className="estado">Cargando productos…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;

  return (
    <section>
      <title>{`Productos | ${config.nombre_negocio}`}</title>
      <div className="admin-titulo">
        <h1>Productos</h1>
        <Link to="/admin/productos/nuevo" className="btn bg-primary">
          Nuevo producto
        </Link>
      </div>

      <div className="admin-herramientas">
        <input
          type="search"
          className="admin-buscar"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, código o rubro…"
          aria-label="Buscar productos"
        />
        <p className="admin-conteo" role="status">
          {filtrados.length === productos.length
            ? `${productos.length} productos`
            : `${filtrados.length} de ${productos.length} productos`}
        </p>
      </div>
      <div className="admin-pestanas" role="group" aria-label="Filtrar productos">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" className="admin-pestana" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.nom}
          </button>
        ))}
      </div>

      <p className="aviso">
        <b>Stock:</b> tocá la cantidad para cambiarla. Vacío (—) = sin control: se vende sin tope. Se descuenta sola al
        confirmar un pedido, y en 0 la tienda muestra «Sin stock». <b>Pausar</b> saca el producto de la tienda sin borrarlo.
      </p>

      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>

      <div className="admin-tabla-marco" tabIndex={0} role="region" aria-label="Productos">
        <table className="admin-tabla">
          <caption className="solo-lector">Productos del catálogo con sus precios y stock</caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Rubro</th>
              <th scope="col" className="der">Por menor</th>
              <th scope="col" className="der">Desde {config.minimo_mayor} u.</th>
              {rol === "programador" && <th scope="col" className="der">Diferencia</th>}
              <th scope="col">Stock</th>
              <th scope="col">En la tienda</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.slice(0, 100).map((p) => (
              <tr key={p.id}>
                <th scope="row" className="admin-prod">
                  <img src={rutaImagen(p.img)} alt="" width="40" height="40" loading="lazy" />
                  <span>
                    <Link to={`/admin/productos/${encodeURIComponent(p.id)}`} className="admin-prod-nom">
                      {p.nom}
                    </Link>
                    <span className="admin-prod-cod">{p.cod}</span>
                  </span>
                </th>
                <td>{nombreRubro(p.rubro)}</td>
                <td className="der num">{plata(p.menor)}</td>
                <td className="der num">{plata(p.mayor)}</td>
                {rol === "programador" && <td className="der num admin-dif">−{plata(p.menor - p.mayor)}</td>}
                <td>
                  <EditorStock producto={p} cantidad={cantidades[p.id]} onAviso={setAviso} />
                </td>
                <td className="admin-estado">
                  <span className={`admin-pastilla ${p.activo === false ? "pausado" : p.agotado ? "agotado" : "activo"}`}>
                    {p.activo === false ? "Pausado" : p.agotado ? "Sin stock" : "Se ve"}
                  </span>
                  <button
                    type="button"
                    className="btn bg-outline admin-boton-chico"
                    onClick={() => pausar(p, p.activo !== false)}
                    disabled={trabajando === p.id}
                  >
                    {trabajando === p.id ? "Guardando…" : p.activo === false ? "Reactivar" : "Pausar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length > 100 && (
        <p className="admin-conteo">Se muestran los primeros 100. Buscá o filtrá para achicar la lista.</p>
      )}
      {filtrados.length === 0 && (
        <div className="estado">
          <h2>Sin resultados</h2>
          <p>Probá con otro nombre, código, rubro o filtro.</p>
        </div>
      )}
    </section>
  );
};
