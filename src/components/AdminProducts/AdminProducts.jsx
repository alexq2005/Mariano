import { useMemo, useState } from "react";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { filtrarProductos, nombreRubro } from "../../utils/filtros";
import { rutaImagen } from "../../services/productos";
import { plata } from "../../utils/precios";
import { llamarYRefrescar } from "../../services/panel";
import "./AdminProducts.css";

// Listado de productos del panel. Pausar y reactivar ya funcionan; el alta
// y la edición llegan después. Toda escritura pasa por el servidor: el
// navegador nunca escribe en Firestore.
export const AdminProducts = () => {
  const { productos, config, loading, error } = useProductos();
  const { rol } = useAuth();
  const [texto, setTexto] = useState("");
  // Id del producto que se está cambiando ahora mismo, y el último error.
  const [trabajando, setTrabajando] = useState(null);
  const [aviso, setAviso] = useState("");

  const pausar = async (producto, pausar) => {
    setTrabajando(producto.id);
    setAviso("");
    try {
      await llamarYRefrescar("producto.pausar", { id: producto.id, pausar });
      setAviso(`${producto.nom}: ${pausar ? "pausado, ya no se ve en la tienda" : "de vuelta en la tienda"}.`);
    } catch (err) {
      setAviso(err.message);
    } finally {
      setTrabajando(null);
    }
  };

  const filtrados = useMemo(() => filtrarProductos(productos, { texto }), [productos, texto]);

  if (loading) return <p className="estado">Cargando productos…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;

  return (
    <section>
      <title>{`Productos | ${config.nombre_negocio}`}</title>
      <h1>Productos</h1>

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

      <p className="aviso">
        Pausar saca el producto de la tienda sin borrarlo, y se puede reactivar cuando quieras. El alta y la
        edición llegan en el próximo paso; los precios se recalculan con <code>npm run catalogo</code>.
      </p>

      <p className="admin-aviso-accion" role="status">
        {aviso}
      </p>

      <div className="admin-tabla-marco">
        <table className="admin-tabla">
          <caption className="solo-lector">Productos del catálogo con sus precios</caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Rubro</th>
              <th scope="col" className="der">Por menor</th>
              <th scope="col" className="der">Desde {config.minimo_mayor} u.</th>
              {rol === "programador" && <th scope="col" className="der">Diferencia</th>}
              <th scope="col">En la tienda</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.slice(0, 100).map((p) => (
              <tr key={p.id}>
                <th scope="row" className="admin-prod">
                  <img src={rutaImagen(p.img)} alt="" width="40" height="40" loading="lazy" />
                  <span>
                    <span className="admin-prod-nom">{p.nom}</span>
                    <span className="admin-prod-cod">{p.cod}</span>
                  </span>
                </th>
                <td>{nombreRubro(p.rubro)}</td>
                <td className="der num">{plata(p.menor)}</td>
                <td className="der num">{plata(p.mayor)}</td>
                {rol === "programador" && (
                  <td className="der num admin-dif">−{plata(p.menor - p.mayor)}</td>
                )}
                <td className="admin-estado">
                  <span className={`admin-pastilla ${p.activo === false ? "pausado" : "activo"}`}>
                    {p.activo === false ? "Pausado" : "Se ve"}
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
        <p className="admin-conteo">Se muestran los primeros 100. Buscá para achicar la lista.</p>
      )}
      {filtrados.length === 0 && (
        <div className="estado">
          <h2>Sin resultados</h2>
          <p>Probá con otro nombre, código o rubro.</p>
        </div>
      )}
    </section>
  );
};
