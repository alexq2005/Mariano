import { useState } from "react";
import { useProductos } from "../../hooks/useProductos";
import { useAuth } from "../../context/AuthContext";
import { llamarPanel, llamarYRefrescar } from "../../services/panel";
import { useDocumento } from "../../admin/vivo";
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

const desdeCobro = (c = {}) => ({
  alias: c.alias ?? "",
  cbu: c.cbu ?? "",
  titular: c.titular ?? "",
  banco: c.banco ?? "",
  mercadopago: Boolean(c.mercadopago),
});

// Cómo le paga la clienta un pedido confirmado. Vive en interno/config (lo
// ve solo el equipo) y se muestra en el link de seguimiento de cada pedido
// confirmado: no queda a la vista de cualquiera que entre a la tienda.
const FormularioCobro = ({ cobro, aviso, setAviso }) => {
  const [f, setF] = useState(() => desdeCobro(cobro));
  const [guardando, setGuardando] = useState(false);
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    const base = desdeCobro(cobro);
    const datos = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== base[k]));
    if (!Object.keys(datos).length) return setAviso({ tipo: "ok", texto: "No hay cambios para guardar." });
    setGuardando(true);
    setAviso({ tipo: "", texto: "" });
    try {
      const r = await llamarPanel("cobro.guardar", datos);
      const n = r.actualizados ?? 0;
      setAviso({
        tipo: "ok",
        texto: r.cambiados.length ? `Guardado.${n ? ` Se actualizó en ${n} ${n === 1 ? "pedido confirmado" : "pedidos confirmados"} sin pagar.` : ""}` : "No había cambios.",
      });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="producto-form config-form" onSubmit={guardar} noValidate>
      <fieldset>
        <legend>Cobrar los pedidos</legend>
        <p className="nota-campo">
          Cuando confirmás un pedido, la clienta lo paga desde su link de seguimiento. Lo que cargues acá es lo que ve.
        </p>
        <label className="opcion config-check">
          <input type="checkbox" checked={f.mercadopago} onChange={campo("mercadopago")} />
          Cobrar con Mercado Pago (tarjetas de crédito y débito, dinero en cuenta, efectivo en Rapipago / Pago Fácil)
        </label>
        <p className="nota-campo">
          Se marca pagado solo. Necesita la cuenta de Mercado Pago conectada en el servidor (ver LEEME); si falta, al guardar te avisa.
        </p>
        <h3 className="config-sub">Transferencia (cualquier banco o billetera)</h3>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="cb-alias">Alias</label>
            <input id="cb-alias" value={f.alias} onChange={campo("alias")} maxLength={20} autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="campo">
            <label htmlFor="cb-cbu">CBU o CVU</label>
            <input id="cb-cbu" inputMode="numeric" value={f.cbu} onChange={campo("cbu")} maxLength={26} />
          </div>
        </div>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="cb-titular">Titular de la cuenta</label>
            <input id="cb-titular" value={f.titular} onChange={campo("titular")} maxLength={60} />
          </div>
          <div className="campo">
            <label htmlFor="cb-banco">Banco o billetera</label>
            <input id="cb-banco" value={f.banco} onChange={campo("banco")} maxLength={40} placeholder="Ej.: Mercado Pago, Galicia, Ualá" />
          </div>
        </div>
        <p className="nota-campo">
          Las transferencias las marcás vos como pagadas al ver el comprobante (en el pedido, «Marcar pagado»). Un cambio de alias o CBU queda en el historial.
        </p>
      </fieldset>
      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>
      <button type="submit" className="btn bg-primary" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar datos de cobro"}
      </button>
    </form>
  );
};

const SeccionCobro = () => {
  const { datos, cargando, error } = useDocumento("interno/config");
  // El aviso vive acá: al guardar, el formulario se vuelve a armar con lo
  // guardado (ver key) y el "Guardado" no se tiene que perder.
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  if (cargando) return <p className="estado">Cargando los datos de cobro…</p>;
  if (error) return <p className="estado" role="alert">{error}</p>;
  // key: si otra persona del equipo lo cambia, el formulario arranca de nuevo con lo guardado.
  return <FormularioCobro key={JSON.stringify(datos?.cobro ?? {})} cobro={datos?.cobro} aviso={aviso} setAviso={setAviso} />;
};

const desdeFacturacion = (c = {}) => ({
  activa: Boolean(c.activa),
  condicion: c.condicion ?? "",
  cuit: c.cuit ?? "",
  razon_social: c.razon_social ?? "",
  domicilio: c.domicilio ?? "",
  iibb: c.iibb ?? "",
  inicio: c.inicio ?? "",
  ptoVta: c.ptoVta ? String(c.ptoVta) : "",
  ambiente: c.ambiente ?? "homologacion",
});

// Los datos del negocio para ARCA. Con la facturación prendida, cada cobro
// sale con su factura (C si es monotributo; A o B si es responsable
// inscripto) y cada devolución con su nota de crédito.
const FormularioFacturacion = ({ facturacion, aviso, setAviso }) => {
  const [f, setF] = useState(() => desdeFacturacion(facturacion));
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    const base = desdeFacturacion(facturacion);
    const datos = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== base[k]));
    if (datos.ptoVta !== undefined) datos.ptoVta = Number(datos.ptoVta.replace(/\D/g, "")) || 0;
    if (datos.condicion === "") delete datos.condicion;
    if (!Object.keys(datos).length) return setAviso({ tipo: "ok", texto: "No hay cambios para guardar." });
    setGuardando(true);
    setAviso({ tipo: "", texto: "" });
    try {
      const r = await llamarYRefrescar("facturacion.guardar", datos);
      setAviso({ tipo: "ok", texto: r.cambiados.length ? "Guardado." : "No había cambios." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba({ ok: true, ...(await llamarPanel("factura.probar", {})) });
    } catch (err) {
      setPrueba({ ok: false, texto: err.message });
    } finally {
      setProbando(false);
    }
  };

  return (
    <form className="producto-form config-form" onSubmit={guardar} noValidate>
      <fieldset>
        <legend>Facturación electrónica (ARCA)</legend>
        <p className="nota-campo">
          La factura sale sola cuando se cobra un pedido (Mercado Pago o «Marcar pagado»), y la nota de crédito cuando se devuelve. La clienta la ve e imprime desde su link.
        </p>
        <label className="opcion config-check">
          <input type="checkbox" checked={f.activa} onChange={campo("activa")} />
          Facturar los cobros
        </label>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="fa-condicion">Condición ante el IVA</label>
            <select id="fa-condicion" value={f.condicion} onChange={campo("condicion")}>
              <option value="">Elegí…</option>
              <option value="monotributo">Monotributo (factura C)</option>
              <option value="responsable_inscripto">Responsable inscripto (factura A o B)</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fa-cuit">CUIT del negocio</label>
            <input id="fa-cuit" inputMode="numeric" value={f.cuit} onChange={campo("cuit")} maxLength={13} />
          </div>
        </div>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="fa-razon">Razón social (o nombre y apellido)</label>
            <input id="fa-razon" value={f.razon_social} onChange={campo("razon_social")} maxLength={80} />
          </div>
          <div className="campo">
            <label htmlFor="fa-domicilio">Domicilio comercial</label>
            <input id="fa-domicilio" value={f.domicilio} onChange={campo("domicilio")} maxLength={120} />
          </div>
        </div>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="fa-iibb">
              Ingresos Brutos <span className="opc">(número, «Exento» o «Convenio Multilateral»)</span>
            </label>
            <input id="fa-iibb" value={f.iibb} onChange={campo("iibb")} maxLength={40} />
          </div>
          <div className="campo">
            <label htmlFor="fa-inicio">Inicio de actividades</label>
            <input id="fa-inicio" value={f.inicio} onChange={campo("inicio")} placeholder="dd/mm/aaaa" maxLength={10} />
          </div>
        </div>
        <div className="producto-dos">
          <div className="campo">
            <label htmlFor="fa-pto">Punto de venta (web service)</label>
            <input id="fa-pto" inputMode="numeric" value={f.ptoVta} onChange={campo("ptoVta")} maxLength={5} />
          </div>
          <div className="campo">
            <label htmlFor="fa-ambiente">Ambiente</label>
            <select id="fa-ambiente" value={f.ambiente} onChange={campo("ambiente")}>
              <option value="homologacion">Homologación (pruebas, sin validez fiscal)</option>
              <option value="produccion">Producción (facturas reales)</option>
            </select>
          </div>
        </div>
        <p className="nota-campo">
          El certificado de ARCA no se carga acá: va en el servidor (ver LEEME, «Facturar con ARCA»). Probá primero en homologación.
        </p>
      </fieldset>
      <p className={`admin-aviso-accion ${aviso.tipo === "error" ? "es-error" : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.texto}
      </p>
      <div className="pedido-acciones">
        <button type="submit" className="btn bg-primary" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar facturación"}
        </button>
        <button type="button" className="btn bg-outline" onClick={probar} disabled={probando}>
          {probando ? "Probando…" : "Probar conexión con ARCA"}
        </button>
      </div>
      {prueba && (
        <div className={`config-prueba ${prueba.ok ? "" : "es-error"}`} role={prueba.ok ? "status" : "alert"}>
          {prueba.ok ? (
            <>
              <p>
                <b>Conectado a ARCA ({prueba.ambiente === "produccion" ? "producción" : "homologación"}).</b> Servidores: {prueba.servidores?.app}. Certificado aceptado.
              </p>
              <ul>
                {prueba.ultimos.map((u) => (
                  <li key={u.nombre}>
                    Última {u.nombre}: <span className="num">{u.ultimo}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{prueba.texto}</p>
          )}
        </div>
      )}
    </form>
  );
};

const SeccionFacturacion = () => {
  const { datos, cargando, error } = useDocumento("interno/config");
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  if (cargando) return null;
  if (error) return <p className="estado" role="alert">{error}</p>;
  return <FormularioFacturacion key={JSON.stringify(datos?.facturacion ?? {})} facturacion={datos?.facturacion} aviso={aviso} setAviso={setAviso} />;
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
      <SeccionCobro />
      <SeccionFacturacion />
    </section>
  );
};
