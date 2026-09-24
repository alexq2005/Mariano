// Leer un documento público de Firestore sin el SDK.
//
// La tienda necesita UN documento (publico/catalogo) y nada más: ni tiempo
// real, ni sesión, ni caché offline. Traer el SDK para eso costaba 27 KB
// comprimidos en CADA visita — con datos móviles, eso se paga.
//
// La API REST de Firestore es HTTP común: un fetch y listo. Las reglas de
// seguridad se aplican igual que con el SDK (publico/catalogo es de lectura
// pública; cualquier otra ruta responde 403 a quien no corresponda).

const env = import.meta.env;
const enEmuladores = env.DEV && env.VITE_FIREBASE_EMULADORES !== "no";

const base = enEmuladores
  ? `http://127.0.0.1:8519/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Firestore devuelve los valores con su tipo adentro: {"stringValue": "x"},
// {"arrayValue": {"values": [...]}}, etc. Esto los pasa a JavaScript común.
const aPlano = (valor) => {
  if (!valor || typeof valor !== "object") return undefined;
  if ("stringValue" in valor) return valor.stringValue;
  if ("integerValue" in valor) return Number(valor.integerValue);
  if ("doubleValue" in valor) return valor.doubleValue;
  if ("booleanValue" in valor) return valor.booleanValue;
  if ("timestampValue" in valor) return valor.timestampValue;
  if ("nullValue" in valor) return null;
  if ("arrayValue" in valor) return (valor.arrayValue.values ?? []).map(aPlano);
  if ("mapValue" in valor) return camposAPlano(valor.mapValue.fields);
  return undefined;
};

const camposAPlano = (campos = {}) =>
  Object.fromEntries(Object.entries(campos).map(([clave, valor]) => [clave, aPlano(valor)]));

export const leerDocumentoPublico = async (ruta, { signal } = {}) => {
  // Un build sin proyecto de Firebase (sin las variables VITE_FIREBASE_*,
  // como la vista previa en GitHub Pages) no tiene a quién preguntarle: falla
  // enseguida, sin un pedido a ".../projects/undefined/...", y la tienda
  // sigue con el archivo publicado.
  if (!env.VITE_FIREBASE_PROJECT_ID) {
    throw new Error("este build no tiene proyecto de Firebase (faltan las variables VITE_FIREBASE_*)");
  }
  const url = new URL(`${base}/${ruta}`);
  if (!enEmuladores && env.VITE_FIREBASE_API_KEY) url.searchParams.set("key", env.VITE_FIREBASE_API_KEY);

  const res = await fetch(url, { signal });
  if (res.status === 404) throw new Error(`todavía no se publicó ${ruta}`);
  if (!res.ok) throw new Error(`Firestore respondió HTTP ${res.status}`);

  const datos = await res.json();
  return camposAPlano(datos.fields);
};
