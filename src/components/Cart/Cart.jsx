import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { CartItem } from "../CartItem/CartItem";
import { CatalogError } from "../CatalogError/CatalogError";
import { plata, plural } from "../../utils/precios";
import "./Cart.css";

export const Cart = () => {
  const { items, resumen, config, productosListos, errorProductos, quitar, reponer, vaciar, restaurar } = useCart();
  // Lo último quitado, para "Deshacer" en el mismo lugar de la lista.
  const [quitado, setQuitado] = useState(null);
  // Lo que había antes de vaciar, para "Deshacer".
  const [vaciado, setVaciado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enfocarId, setEnfocarId] = useState(null);
  const [enfocarDeshacer, setEnfocarDeshacer] = useState(0);
  const deshacer = useRef(null);
  const noVaciar = useRef(null);
  const botonVaciar = useRef(null);
  const titulo = useRef(null);

  // La fila quitada desaparece con el foco adentro: se lo pasamos al
  // "Deshacer" que aparece en su lugar, así no se pierde quien usa teclado.
  useEffect(() => {
    if (enfocarDeshacer) deshacer.current?.focus();
  }, [enfocarDeshacer]);

  // En la confirmación, el foco va a la opción que NO borra nada.
  useEffect(() => {
    if (confirmando) noVaciar.current?.focus();
  }, [confirmando]);

  if (!productosListos) return <p className="estado">Cargando tu carrito…</p>;
  if (errorProductos) return <CatalogError mensaje={errorProductos} />;

  const alQuitar = (linea) => {
    const q = quitar(linea.p.id);
    if (!q) return;
    setQuitado({ ...q, nombre: linea.p.nom });
    setVaciado(null);
    setConfirmando(false);
    setEnfocarDeshacer((n) => n + 1);
  };

  const deshacerQuitar = () => {
    reponer({ id: quitado.id, cant: quitado.cant, posicion: quitado.posicion });
    setEnfocarId(quitado.id);
    setQuitado(null);
  };

  const alVaciar = () => {
    setVaciado(vaciar());
    setQuitado(null);
    setConfirmando(false);
    setEnfocarDeshacer((n) => n + 1);
  };

  const deshacerVaciado = () => {
    flushSync(() => {
      restaurar(vaciado);
      setVaciado(null);
    });
    titulo.current?.focus(); // el "Deshacer" desaparece: el foco va al título
  };

  const noVaciarCarrito = () => {
    flushSync(() => setConfirmando(false));
    botonVaciar.current?.focus();
  };

  const { total, ahorro, unidades, faltaMinimo } = resumen;
  const n = resumen.items.length;
  const tituloPestana = <title>{`Carrito | ${config.nombre_negocio}`}</title>;

  if (!n && !quitado) {
    return (
      <section className="estado">
        {tituloPestana}
        <h1>Tu carrito</h1>
        {vaciado ? (
          <p>
            Vaciaste el carrito.{" "}
            <button ref={deshacer} type="button" className="btn-link" onClick={deshacerVaciado}>
              Deshacer
            </button>
          </p>
        ) : (
          <p>
            <strong>Tu carrito está vacío</strong>
            Agregá productos desde el catálogo.
          </p>
        )}
        <Link to="/" className="btn bg-primary">
          Ver el catálogo
        </Link>
      </section>
    );
  }

  // Filas del carrito, con el aviso de "Quitaste…" en el lugar de la fila.
  const filas = resumen.items.map((linea) => ({ tipo: "item", linea }));
  if (quitado && !items.some((x) => x.id === quitado.id)) {
    filas.splice(Math.min(quitado.posicion, filas.length), 0, { tipo: "quitado" });
  }

  const continuar =
    n > 0 && faltaMinimo === 0 ? (
      <Link to="/checkout" className="btn bg-success">
        Continuar con el pedido
      </Link>
    ) : (
      <button type="button" className="btn" disabled>
        Continuar con el pedido
      </button>
    );

  return (
    <section className="cart">
      {tituloPestana}
      <h1 ref={titulo} tabIndex={-1}>
        Tu carrito
      </h1>
      <p className="aviso">
        Precio por mayor desde <b>{config.minimo_mayor} u. del mismo producto</b>. No se suman productos distintos.
      </p>

      {/* Si la tienda pausó algo que ya estaba en el carrito, se dice: no
          se cobra, pero tampoco desaparece sin explicación. */}
      {resumen.noDisponibles.length > 0 && (
        <div className="cart-no-disponibles" role="status">
          <p>
            {resumen.noDisponibles.length === 1
              ? "Un producto de tu carrito ya no está disponible:"
              : `${resumen.noDisponibles.length} productos de tu carrito ya no están disponibles:`}
          </p>
          <ul>
            {resumen.noDisponibles.map(({ p, cant }) => (
              <li key={p.id}>
                <span>
                  {p.nom} ({plural(cant, "unidad", "unidades")})
                </span>
                <button type="button" className="btn-link" onClick={() => quitar(p.id)}>
                  Quitar del carrito
                </button>
              </li>
            ))}
          </ul>
          <p className="cart-no-disponibles-nota">No se cuentan en el total.</p>
        </div>
      )}

      <div className="cart-layout">
        <div>
          <ul className="cart-lista">
            {filas.map((f) =>
              f.tipo === "item" ? (
                <CartItem
                  key={f.linea.p.id}
                  linea={f.linea}
                  onQuitar={() => alQuitar(f.linea)}
                  enfocar={enfocarId === f.linea.p.id}
                />
              ) : (
                <li key="quitado" className="cart-quitado">
                  <span>
                    Quitaste <b>{quitado.nombre}</b> ({plural(quitado.cant, "unidad", "unidades")}).
                  </span>
                  <button ref={deshacer} type="button" className="btn bg-outline" onClick={deshacerQuitar}>
                    Deshacer
                  </button>
                </li>
              ),
            )}
          </ul>

          {n > 0 && (
            <div className="cart-vaciar">
              {confirmando ? (
                <div className="confirmar" role="group" aria-labelledby="confirmar-vaciar">
                  <p id="confirmar-vaciar">
                    ¿Vaciar el carrito? Se quitan {plural(n, "producto", "productos")} (
                    {plural(unidades, "unidad", "unidades")}).
                  </p>
                  <div className="confirmar-botones">
                    <button ref={noVaciar} type="button" className="btn bg-outline" onClick={noVaciarCarrito}>
                      No, conservar
                    </button>
                    <button type="button" className="btn bg-primary" onClick={alVaciar}>
                      Sí, vaciar
                    </button>
                  </div>
                </div>
              ) : (
                <button ref={botonVaciar} type="button" className="btn-link" onClick={() => setConfirmando(true)}>
                  Vaciar carrito
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="cart-resumen" aria-labelledby="resumen-titulo">
          <h2 id="resumen-titulo">Resumen</h2>
          <p className="cart-resumen-conteo">
            {plural(n, "producto", "productos")} · {plural(unidades, "unidad", "unidades")}
          </p>
          {ahorro > 0 && <p className="cart-resumen-ahorro num">Ahorrás {plata(ahorro)} por comprar por mayor</p>}
          <p className="cart-total">
            <span>
              Total <small>(sin envío)</small>
            </span>
            <strong className="num">{plata(total)}</strong>
          </p>
          {faltaMinimo > 0 && (
            <p className="cart-resumen-alerta num">
              Te faltan {plata(faltaMinimo)} para el pedido mínimo de {plata(config.pedido_minimo)}.
            </p>
          )}
          {continuar}
          <Link to="/" className="btn bg-outline">
            Seguir comprando
          </Link>
          <p className="cart-resumen-nota">El envío y el stock se confirman por WhatsApp.</p>
        </aside>
      </div>
    </section>
  );
};
