import { useState } from "react";
import { TOPE } from "../../context/carrito";
import "./ItemCount.css";

// Contador − [cantidad] +. El campo guarda lo que se va tipeando como
// texto: si queda vacío a mitad de escribir, el producto NO se quita del
// carrito (era el bug de la versión anterior). Solo un 0 explícito quita.
export const ItemCount = ({ cantidad, nombre, onCambiar, onFijar, refSumar }) => {
  const [borrador, setBorrador] = useState(String(cantidad));
  const [previa, setPrevia] = useState(cantidad);

  // La cantidad cambió desde afuera (+/−, el carrito, otra pestaña).
  if (cantidad !== previa) {
    setPrevia(cantidad);
    setBorrador(String(cantidad));
  }

  const escribir = (e) => {
    const limpio = e.target.value.replace(/\D/g, "").slice(0, String(TOPE).length);
    setBorrador(limpio);
    const n = Number.parseInt(limpio, 10);
    if (n >= 1) onFijar(n); // vacío o 0: todavía está escribiendo
  };

  const confirmar = () => {
    if (borrador !== "" && Number.parseInt(borrador, 10) === 0) onFijar(0);
    else setBorrador(String(cantidad)); // vacío vuelve al valor anterior; "007" queda "7"
  };

  return (
    <div className="item-count">
      <button type="button" aria-label={`Restar una unidad de ${nombre}`} onClick={() => onCambiar(-1)}>
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        maxLength={String(TOPE).length}
        value={borrador}
        aria-label={`Cantidad de ${nombre}`}
        onChange={escribir}
        onBlur={confirmar}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          }
        }}
      />
      <button
        ref={refSumar}
        type="button"
        aria-label={`Sumar una unidad de ${nombre}`}
        onClick={() => onCambiar(1)}
        disabled={cantidad >= TOPE}
      >
        +
      </button>
    </div>
  );
};
