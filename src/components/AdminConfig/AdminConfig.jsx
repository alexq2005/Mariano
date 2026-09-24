import { useState } from "react";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { llamarYRefrescar } from "../../services/panel";
import { numeroWhatsAppValido } from "../../utils/pedido";
import "../Checkout/Checkout.css";
import "../AdminProducto/AdminProducto.css";
import "./AdminConfig.css";

const desdeConfig = (c) => ({
  nombre_negocio: c.nombre_negocio ?? "",
  whatsapp: c.whatsapp ?? "",
  minimo_mayor: String(c.minimo_mayor ?? 12),
  pedido_minimo: String(c.pedido_minimo ?? 0),
  actualizado: c.actualizado ?? "",
  precios_confirmados: Boolean(c.precios_confirmados),
  formas_entrega: (c.formas_entrega ?? []).map((f) => ({ ...f })),
  formas_pago: [...(c.formas_pago ?? [])],
  instagram: c.instagram ?? "",
  email_contacto: c.email_contacto ?? "",
  direccion_retiro: c.direccion_retiro ?? "",
});

// Lo que se manda: solo lo que cambió. Así un campo que ya estaba mal (el
// WhatsApp de ejemplo) no impide guardar otra cosa.
const cambios = (form, config) => {
  const listo = {
    ...form,
    whatsapp: form.whatsapp.replace(/\D/g, ""),
    minimo_mayor: Number(form.minimo_mayor),
    pedido_minimo: Number(form.pedido_minimo || 0),
  };
  const base = desdeConfig(config);
  const original = { ...base, minimo_mayor: Number(base.minimo_mayor), pedido_minimo: Number(base.pedido_minimo) };
  return Object.fromEntries(Object.entries(listo).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original[k])));
};

const Formulario = ({ config }) => {
  const { rol } = useAuth();
  const [f, setF] = useState(() => desdeConfig(config));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const entrega = (i, k, v) => setF({ ...f, formas_entrega: f.formas_entrega.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const pago = (i, v) => setF({ ...f, formas_pago: f.formas_pago.map((x, j) => (j === i ? v : x)) });

  const guardar = async (e) => {
    e.preventDefault();
    const datos = cambios(f, config);
    if (!Object.keys(datos).length) return setAviso({ tipo: "ok", texto: "No hay cambios para guardar." });
    setGuardando(true);
    setAviso({ tipo: "", texto: "" });
    try {
      const r = await llamarYRefrescar("config.guardar", datos);
      setAviso({ tipo: "ok", texto: r.cambiados.length ? "Guardado. La tienda ya lo muestra." : "No había cambios." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const waOk = numeroWhatsAppValido(f.whatsapp.replace(/\D/g, ""));

  return (
    <form className="producto-form config-form" onSubmit={guardar} noValidate>
      <fieldset>
        <legend>El negocio</legend>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="cf-nombre">Nombre</label>
            <input id="cf-nombre" value={f.nombre_negocio} onChange={campo("nombre_negocio")} maxLength={40} />
          </div>
          <div className="campo">
            <label htmlFor="cf-wa">WhatsApp de los pedidos</label>
            <input id="cf-wa" inputMode="tel" value={f.whatsapp} onChange={campo("whatsapp")} aria-describedby="cf-wa-nota" />
            <p id="cf-wa-nota" className={`nota-campo ${waOk ? "" : "config-alerta"}`}>
              {waOk ? "✓ Número válido." : "549 + característica sin 0 + número sin 15. Ej.: 5491145678901."}
            </p>
          </div>
        </div>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="cf-ig">
              Instagram <span className="opc">(opcional)</span>
            </label>
            <input id="cf-ig" value={f.instagram} onChange={campo("instagram")} placeholder="usuario, sin @" />
          </div>
          <div className="campo">
            <label htmlFor="cf-mail">
              Email de contacto <span className="opc">(opcional)</span>
            </label>
            <input id="cf-mail" type="email" value={f.email_contacto} onChange={campo("email_contacto")} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="cf-retiro">
            Punto de retiro <span className="opc">(opcional, se ve en el pie)</span>
          </label>
          <input id="cf-retiro" value={f.direccion_retiro} onChange={campo("direccion_retiro")} maxLength={120} placeholder="Ej.: Punto de retiro en Boedo" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Precios</legend>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="cf-min">Precio por mayor desde (u. del mismo producto)</label>
            <input id="cf-min" inputMode="numeric" value={f.minimo_mayor} onChange={campo("minimo_mayor")} />
          </div>
          <div className="campo">
            <label htmlFor="cf-pmin">Pedido mínimo ($, 0 = sin mínimo)</label>
            <input id="cf-pmin" inputMode="numeric" value={f.pedido_minimo} onChange={campo("pedido_minimo")} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="cf-lista">Fecha de la lista de precios</label>
          <input id="cf-lista" value={f.actualizado} onChange={campo("actualizado")} placeholder="Ej.: 24/09/2026" />
        </div>
        <label className="opcion config-check">
          <input type="checkbox" checked={f.precios_confirmados} onChange={campo("precios_confirmados")} disabled={rol !== "programador"} />
          Precios confirmados (sin esto, la tienda y cada pedido avisan «precios orientativos»)
        </label>
        {rol !== "programador" && <p className="nota-campo">Lo confirma el programador cuando está el costo real de importación.</p>}
      </fieldset>

      <fieldset>
        <legend>Formas de entrega</legend>
        {f.formas_entrega.map((x, i) => (
          <div key={i} className="config-fila">
            <input aria-label={`Forma de entrega ${i + 1}`} value={x.nombre} onChange={(e) => entrega(i, "nombre", e.target.value)} maxLength={60} />
            <label className="config-mini">
              <input type="checkbox" checked={x.pide_direccion} onChange={(e) => entrega(i, "pide_direccion", e.target.checked)} /> pide dirección
            </label>
            <button type="button" className="btn-link" onClick={() => setF({ ...f, formas_entrega: f.formas_entrega.filter((_, j) => j !== i) })}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="btn bg-outline admin-boton-chico"
          onClick={() => setF({ ...f, formas_entrega: [...f.formas_entrega, { id: "", nombre: "", pide_direccion: false }] })}>
          Agregar forma de entrega
        </button>
      </fieldset>

      <fieldset>
        <legend>Formas de pago</legend>
        {f.formas_pago.map((x, i) => (
          <div key={i} className="config-fila">
            <input aria-label={`Forma de pago ${i + 1}`} value={x} onChange={(e) => pago(i, e.target.value)} maxLength={40} />
            <button type="button" className="btn-link" onClick={() => setF({ ...f, formas_pago: f.formas_pago.filter((_, j) => j !== i) })}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="btn bg-outline admin-boton-chico" onClick={() => setF({ ...f, formas_pago: [...f.formas_pago, ""] })}>
          Agregar forma de pago
        </button>
      </fieldset>

      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>
      <button type="submit" className="btn bg-primary" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
};

// Los datos del negocio que ve la tienda. Viajan con el catálogo: el cambio
// se ve en la próxima visita, sin volver a publicar el sitio.
export const AdminConfig = () => {
  const { config, loading, error } = useProductos();
  if (loading) return <p className="estado">Cargando…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;
  return (
    <section>
      <title>Configuración | Panel</title>
      <h1>Configuración</h1>
      <p className="admin-intro">Lo que ve la clienta en la tienda y en el pedido.</p>
      <Formulario config={config} />
    </section>
  );
};
