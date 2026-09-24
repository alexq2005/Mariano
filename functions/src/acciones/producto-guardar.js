import { HttpsError } from "firebase-functions/https";
import { db } from "../firebase.js";
import { refs } from "../refs.js";
import { anotarEnAuditoria } from "../auditoria.js";
import { esProductoValido, RUBROS } from "../compartido/producto.js";

// Una foto de public/img ("ZMA-123.jpg") o un link https a una imagen.
const FOTO_LOCAL = /^[\w.-]+\.(jpe?g|png|webp|gif|svg)$/i;
const esFoto = (img) => FOTO_LOCAL.test(img) || (/^https:\/\/\S+$/i.test(img) && img.length <= 500);
const PRECIO_MAX = 100_000_000;

const texto = (valor, max) => (typeof valor === "string" ? valor.trim().replace(/\s+/g, " ").slice(0, max) : "");
const precio = (valor, nombre) => {
  if (!Number.isInteger(valor) || valor <= 0 || valor > PRECIO_MAX) {
    throw new HttpsError("invalid-argument", `El precio ${nombre} tiene que ser un número entero mayor que 0.`);
  }
  return valor;
};
// El id sale del código: sin espacios ni símbolos raros, porque va en la URL
// del producto (/product/ZMA-1234).
const idDesdeCodigo = (cod) => cod.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

// Alta (sin `id`) o edición (con `id`) de un producto. Los precios son los
// de venta, en pesos. El programador además puede cargar el costo en
// dólares, que va a privado/costos y la admin nunca ve.
export const guardarProducto = async (datos, quien) => {
  const edita = typeof datos?.id === "string" && datos.id.length > 0;
  const campos = {
    cod: texto(datos?.cod, 40),
    nom: texto(datos?.nom, 120),
    desc: texto(datos?.desc, 300),
    rubro: typeof datos?.rubro === "string" ? datos.rubro : "",
    img: texto(datos?.img, 500),
    menor: precio(datos?.menor, "por menor"),
    mayor: precio(datos?.mayor, "por mayor"),
  };
  if (!campos.cod) throw new HttpsError("invalid-argument", "Falta el código del producto.");
  if (!campos.nom) throw new HttpsError("invalid-argument", "Falta el nombre del producto.");
  if (!RUBROS.includes(campos.rubro)) throw new HttpsError("invalid-argument", "Elegí un rubro de la lista.");
  if (!esFoto(campos.img)) {
    throw new HttpsError("invalid-argument", "La foto tiene que ser un archivo de public/img (ej. ZMA-123.jpg) o un link https.");
  }
  if (campos.mayor > campos.menor) {
    throw new HttpsError("invalid-argument", "El precio por mayor no puede ser más alto que el precio por menor.");
  }

  let costoUsd;
  if (datos?.costoUsd !== undefined && datos.costoUsd !== null) {
    if (quien.rol !== "programador") throw new HttpsError("permission-denied", "El costo lo carga el programador.");
    if (typeof datos.costoUsd !== "number" || !Number.isFinite(datos.costoUsd) || datos.costoUsd <= 0) {
      throw new HttpsError("invalid-argument", "El costo en dólares tiene que ser un número mayor que 0.");
    }
    costoUsd = datos.costoUsd;
  }

  const ahora = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const [cat] = await tx.getAll(refs.catalogo());
    if (!cat.exists) throw new HttpsError("failed-precondition", "Todavía no se publicó el catálogo.");
    const productos = cat.data().productos ?? [];

    const id = edita ? datos.id : idDesdeCodigo(campos.cod);
    if (!id) throw new HttpsError("invalid-argument", "El código tiene que tener letras o números.");
    const indice = productos.findIndex((p) => p.id === id);
    if (edita && indice < 0) throw new HttpsError("not-found", "Ese producto ya no está en el catálogo.");
    if (!edita && indice >= 0) throw new HttpsError("already-exists", `Ya hay un producto con el código ${campos.cod}.`);
    const otroConCodigo = productos.find((p) => p.id !== id && p.cod.toUpperCase() === campos.cod.toUpperCase());
    if (otroConCodigo) throw new HttpsError("already-exists", `El código ${campos.cod} ya lo usa ${otroConCodigo.nom}.`);

    const anterior = edita ? productos[indice] : null;
    const producto = edita
      ? { ...anterior, ...campos, editadoEnPanel: true }
      : { id, ...campos, origen: "panel" };
    if (!esProductoValido(producto)) throw new HttpsError("invalid-argument", "Al producto le faltan datos.");

    const nuevos = productos.slice();
    if (edita) nuevos[indice] = producto;
    else nuevos.push(producto);
    tx.update(refs.catalogo(), { productos: nuevos, version: ahora });
    if (costoUsd !== undefined) tx.set(refs.costos(), { costos: { [id]: costoUsd } }, { merge: true });

    const cambios = edita ? Object.keys(campos).filter((k) => anterior[k] !== campos[k]) : Object.keys(campos);
    anotarEnAuditoria(tx, db, {
      accion: "producto.guardar",
      quien,
      cuando: ahora,
      // El costo nunca va al detalle: la admin ve este historial.
      detalle: { id, nombre: campos.nom, nuevo: !edita, cambios, ...(costoUsd !== undefined ? { costoActualizado: true } : {}) },
    });
    return { id, nuevo: !edita };
  });
};
