// GENERADO desde src/compartido/fiscal.js por scripts/copiar-compartido.mjs.
// No editar acá: se pisa en cada `npm run emu` y en cada despliegue.

// Los datos para la factura que puede dejar quien compra. Lo común es
// consumidor final, sin nada más; quien quiere la factura a su nombre deja
// el CUIT y su condición ante el IVA (con eso el negocio, si es responsable
// inscripto, sabe si le corresponde factura A o B).
//
// Vive en compartido/ porque valida en los dos lados: el navegador avisa
// antes de enviar y el servidor no confía en el navegador.

// "arca" es el código de condición frente al IVA del receptor que pide ARCA
// en cada comprobante (CondicionIVAReceptorId, obligatorio desde 09/2026).
export const CONDICIONES_FISCALES = {
  consumidor_final: { nombre: "Consumidor final", arca: 5 },
  responsable_inscripto: { nombre: "IVA Responsable Inscripto", arca: 1 },
  monotributo: { nombre: "Responsable Monotributo", arca: 6 },
  exento: { nombre: "IVA Sujeto Exento", arca: 4 },
};

export const FISCAL_VACIO = { condicion: "consumidor_final", cuit: "", dni: "", nombre: "" };

// CUIT o CUIL: 11 números y el último es un dígito verificador (módulo 11).
export const cuitValido = (v) => {
  const c = String(v ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(c)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(c[i]), 0);
  const dv = (11 - (suma % 11)) % 11;
  // Un 10 no existe: ARCA cambia el prefijo para que no pase.
  return dv !== 10 && dv === Number(c[10]);
};

export const cuitConGuiones = (c) => {
  const s = String(c ?? "").replace(/\D/g, "");
  return s.length === 11 ? `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}` : s;
};

// Solo lo conocido, como texto y recortado.
export const sanearFiscal = (f) => {
  const condicion = Object.hasOwn(CONDICIONES_FISCALES, f?.condicion) ? f.condicion : "consumidor_final";
  const cuit = typeof f?.cuit === "string" ? f.cuit.replace(/\D/g, "").slice(0, 11) : "";
  // El DNI solo para consumidor final sin CUIT: ARCA lo pide desde
  // $10.000.000 (RG 5866/2026). Lo carga el negocio en el panel.
  const dni = condicion === "consumidor_final" && !cuit && typeof f?.dni === "string" ? f.dni.replace(/\D/g, "").slice(0, 8) : "";
  const nombre = typeof f?.nombre === "string" ? f.nombre.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  // Consumidor final sin identificar: no se guarda ningún dato de más.
  if (condicion === "consumidor_final" && !cuit && !dni) return { ...FISCAL_VACIO };
  return { condicion, cuit, dni, nombre };
};

// Con CUIT hacen falta el número (válido) y el nombre o la razón social.
// Consumidor final puede dejar el CUIT si lo quiere en la factura (por
// ejemplo, para deducirlo de Ganancias).
export const validarFiscal = (f) => {
  const e = {};
  if (f.dni) {
    if (!/^\d{7,8}$/.test(f.dni)) e.dni = "El DNI son 7 u 8 números.";
    if (!f.nombre) e.razon_social = "Escribí el nombre y apellido para la factura.";
    return e;
  }
  const conCuit = f.condicion !== "consumidor_final" || f.cuit;
  if (!conCuit) return e;
  if (!cuitValido(f.cuit)) e.cuit = "Ese CUIT no es válido: son 11 números, sin guiones.";
  if (!f.nombre) e.razon_social = "Escribí el nombre o la razón social para la factura.";
  return e;
};
