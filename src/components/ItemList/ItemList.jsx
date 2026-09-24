import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Item } from "../Item/Item";
import { AddToCart } from "../AddToCart/AddToCart";
import { useCart } from "../../context/CartContext";
import "./ItemList.css";

// Se muestran de a tandas: 266 tarjetas con foto de una sola vez es
// mucho para un celular.
const POR_TANDA = 60;

export const ItemList = ({ productos, total, config }) => {
  const [mostrando, setMostrando] = useState(POR_TANDA);
  const { cantidadDe } = useCart();
  const lista = useRef(null);

  if (!productos.length) {
    return (
      <div className="estado">
        <h2>Sin resultados</h2>
        <p>Probá con otro nombre, otro rubro o el código del producto.</p>
      </div>
    );
  }

  const visibles = productos.slice(0, mostrando);
  const restantes = productos.length - visibles.length;
  const conteo =
    productos.length === total
      ? `Mostrando ${visibles.length} de ${total} productos`
      : `${productos.length} ${productos.length === 1 ? "producto encontrado" : "productos encontrados"}` +
        (restantes > 0 ? ` · mostrando ${visibles.length}` : "");

  // El botón "Ver más" desaparece en la última tanda: el foco pasa al primer
  // producto nuevo, que es donde la clienta quiere seguir.
  const verMas = () => {
    const primeroNuevo = visibles.length;
    flushSync(() => setMostrando(mostrando + POR_TANDA));
    lista.current?.querySelectorAll(".card-nombre a")[primeroNuevo]?.focus();
  };

  return (
    <>
      <p className="conteo">{conteo}</p>
      <ul ref={lista} className="products-container">
        {visibles.map((p) => (
          <li key={p.id}>
            <Item producto={p} cant={cantidadDe(p.id)} config={config}>
              <AddToCart producto={p} compacto />
            </Item>
          </li>
        ))}
      </ul>
      {restantes > 0 && (
        <button type="button" className="btn bg-outline mas" onClick={verMas}>
          Ver más productos ({restantes} restantes)
        </button>
      )}
    </>
  );
};
