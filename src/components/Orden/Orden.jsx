import { useSearchParams } from "react-router-dom";
import { ORDENES } from "../../utils/filtros";
import "./Orden.css";

// "Ordenar por": un <select> nativo a propósito. En el celular abre la
// rueda del sistema, que la clienta ya sabe usar, y el lector de pantalla lo
// anuncia sin nada extra. El orden vive en la URL (?orden=precio) junto con
// la búsqueda.
export const Orden = () => {
  const [params, setParams] = useSearchParams();
  const pedido = params.get("orden") ?? "";
  const actual = ORDENES.some((o) => o.id === pedido) ? pedido : "";

  const cambiar = (e) => {
    const siguiente = new URLSearchParams(params);
    if (e.target.value) siguiente.set("orden", e.target.value);
    else siguiente.delete("orden");
    setParams(siguiente);
  };

  return (
    <label className="orden">
      <span>Ordenar</span>
      <select value={actual} onChange={cambiar}>
        {ORDENES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom}
          </option>
        ))}
      </select>
    </label>
  );
};
