import { useEffect, useRef } from "react";
import { useCart } from "../../context/CartContext";
import { ItemCount } from "../ItemCount/ItemCount";
import { plata } from "../../utils/precios";
import { porcentajeAhorro } from "../../utils/presentacion";
import "./AddToCart.css";

// Cuánto falta para el precio por mayor, o cuánto se ahorra ya. Se exporta
// porque en el listado la dibuja la tarjeta, debajo del precio: el contador
// compacto va sobre la foto y ahí no hay lugar para una frase.
export const PistaMayor = ({ producto: p, cant, minimo }) => {
  const faltan = minimo - cant;
  return faltan <= 0 ? (
    <p className="pista ok num">Ahorrás {plata((p.menor - p.mayor) * cant)} en este producto</p>
  ) : (
    <p className="pista num">{faltan === 1 ? "Te falta 1 u." : `Te faltan ${faltan} u.`} para el precio por mayor</p>
  );
};

// "Agregar al carrito" y, una vez agregado, el contador conectado al
// carrito: lo que se cambia acá se ve al instante en el carrito y viceversa.
//
// `compacto` (el listado): un "+" redondo que flota sobre la foto y, al
// tocarlo, se vuelve un contador − 3 + en el mismo lugar. Es el patrón de
// las apps de delivery, que la clienta ya sabe usar, y le ahorra a cada
// tarjeta la barra del botón de abajo. El detalle usa el botón completo.
export const AddToCart = ({ producto: p, etiqueta = "Agregar al carrito", compacto = false }) => {
  const { cantidadDe, agregar, cambiar, fijar, config } = useCart();
  const cant = cantidadDe(p.id);
  const boton = useRef(null);
  const sumar = useRef(null);
  const previa = useRef(cant);

  useEffect(() => {
    // El botón y el contador se reemplazan entre sí, y el atajo de "Llevar
    // 12" desaparece al usarlo: si el que tenía el foco desaparece, el foco
    // caería al principio de la página y quien usa teclado o lector perdería
    // el lugar. Se lo pasamos al control que queda.
    // hasFocus(): un cambio que llega desde otra pestaña no mueve nada acá.
    const perdido = document.hasFocus() && document.activeElement === document.body;
    if (perdido && previa.current !== cant) (cant > 0 ? sumar : boton).current?.focus();
    previa.current = cant;
  }, [cant]);

  // Agotado (stock en 0, lo carga el panel): no se puede agregar. Si ya
  // estaba en el carrito, el carrito lo muestra aparte y no lo cobra.
  if (p.agotado && !cant) {
    return compacto ? (
      <span className="sin-stock-chip">Sin stock</span>
    ) : (
      <button type="button" className="btn add-to-cart-boton" disabled>
        Sin stock
      </button>
    );
  }

  if (!cant && compacto) {
    return (
      <button
        ref={boton}
        type="button"
        className="agregar-rapido"
        aria-label={`Agregar ${p.nom} al carrito`}
        onClick={() => agregar(p.id)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
          strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    );
  }

  // En el detalle, el atajo de la revendedora: llevar el mínimo por mayor de
  // un toque, en vez de apretar "+" once veces. Solo si el precio por mayor
  // es más barato, y hasta llegar al mínimo.
  const minimo = config.minimo_mayor;
  const atajo = porcentajeAhorro(p) > 0 && cant < minimo && !p.agotado && (
    <button type="button" className="btn atajo-mayor num" onClick={() => fijar(p.id, minimo)}>
      {cant ? `Completar ${minimo} u.` : `Llevar ${minimo} u.`} a {plata(p.mayor)} c/u
    </button>
  );

  if (!cant) {
    return (
      <>
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
        {atajo}
      </>
    );
  }

  const contador = (
    <ItemCount
      cantidad={cant}
      nombre={p.nom}
      refSumar={sumar}
      onCambiar={(paso) => cambiar(p.id, paso)}
      onFijar={(n) => fijar(p.id, n)}
    />
  );

  if (compacto) return <div className="add-to-cart compacto">{contador}</div>;

  return (
    <div className="add-to-cart">
      {contador}
      <PistaMayor producto={p} cant={cant} minimo={minimo} />
      {atajo}
    </div>
  );
};
