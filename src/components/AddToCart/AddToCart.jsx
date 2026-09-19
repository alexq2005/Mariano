import { useEffect, useRef } from "react";
import { useCart } from "../../context/CartContext";
import { ItemCount } from "../ItemCount/ItemCount";
import { plata, precioMayor, precioMenor } from "../../utils/precios";
import { CONFIG } from "../../config";
import "./AddToCart.css";

// "Agregar al carrito" y, una vez agregado, el contador conectado al
// carrito: lo que se cambia acá se ve al instante en el carrito y viceversa.
export const AddToCart = ({ producto: p }) => {
  const { cantidadDe, agregar, cambiar, fijar } = useCart();
  const cant = cantidadDe(p.id);
  const boton = useRef(null);
  const sumar = useRef(null);
  const previa = useRef(cant);

  useEffect(() => {
    // El botón y el contador se reemplazan entre sí: si el que tenía el foco
    // desaparece, el foco caería al principio de la página y quien usa
    // teclado o lector perdería el lugar. Se lo pasamos al que aparece.
    // hasFocus(): un cambio que llega desde otra pestaña no mueve nada acá.
    const perdido = document.hasFocus() && document.activeElement === document.body;
    if (perdido && previa.current > 0 && cant === 0) boton.current?.focus();
    if (perdido && previa.current === 0 && cant > 0) sumar.current?.focus();
    previa.current = cant;
  }, [cant]);

  if (!cant) {
    return (
      <button ref={boton} type="button" className="btn bg-primary add-to-cart-boton" onClick={() => agregar(p.id)}>
        Agregar al carrito
      </button>
    );
  }

  const faltan = CONFIG.minimo_mayor - cant;
  return (
    <div className="add-to-cart">
      <ItemCount
        cantidad={cant}
        nombre={p.nom}
        refSumar={sumar}
        onCambiar={(paso) => cambiar(p.id, paso)}
        onFijar={(n) => fijar(p.id, n)}
      />
      {faltan <= 0 ? (
        <p className="pista ok num">Ahorrás {plata((precioMenor(p) - precioMayor(p)) * cant)} en este producto</p>
      ) : (
        <p className="pista num">
          {faltan === 1 ? "Te falta 1 u." : `Te faltan ${faltan} u.`} para el precio por mayor
        </p>
      )}
    </div>
  );
};
