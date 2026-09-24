import { useEffect, useRef } from "react";
import { useCart } from "../../context/CartContext";
import { ItemCount } from "../ItemCount/ItemCount";
import { plata } from "../../utils/precios";
import "./AddToCart.css";

// "Agregar al carrito" y, una vez agregado, el contador conectado al
// carrito: lo que se cambia acá se ve al instante en el carrito y viceversa.
// `etiqueta`: en el listado alcanza con "Agregar" (en tarjetas angostas
// "Agregar al carrito" se partía en dos líneas); el detalle, que tiene
// lugar, lo dice entero.
export const AddToCart = ({ producto: p, etiqueta = "Agregar" }) => {
  const { cantidadDe, agregar, cambiar, fijar, config } = useCart();
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
      <button
        ref={boton}
        type="button"
        className="btn bg-primary add-to-cart-boton"
        // Con 60 tarjetas, el lector de pantalla escuchaba 60 veces el mismo
        // "Agregar": así cada botón dice qué producto agrega.
        aria-label={`Agregar ${p.nom} al carrito`}
        onClick={() => agregar(p.id)}
      >
        {etiqueta}
      </button>
    );
  }

  const faltan = config.minimo_mayor - cant;
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
        <p className="pista ok num">Ahorrás {plata((p.menor - p.mayor) * cant)} en este producto</p>
      ) : (
        <p className="pista num">
          {faltan === 1 ? "Te falta 1 u." : `Te faltan ${faltan} u.`} para el precio por mayor
        </p>
      )}
    </div>
  );
};
