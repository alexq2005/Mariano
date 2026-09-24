// COPIA de src/compartido/ hecha por scripts/copiar-compartido.mjs: NO editar acá.

// Fórmula de precios: costo de fábrica en dólares → los dos precios de
// venta en pesos.
//
//     precio = costo_USD × factor_importacion × tipo_cambio × margen
//
// Vive en compartido/ porque no es solo del navegador: cuando el pedido se
// haga en la plataforma, el servidor va a recalcular el precio de cada
// línea con ESTA misma función, y tiene que dar exactamente lo mismo que
// vio la clienta. Por eso no importa nada de src/: es código portable.
//
// Es estricta a propósito. La versión anterior hacía `factor_importacion
// || 1`: con la config a medio cargar, vendía a 2,6 veces menos sin que
// nadie se enterara. Un precio mal calculado se cobra; un error se ve.

const positivo = (valor, nombre) => {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    throw new Error(`formula: "${nombre}" tiene que ser un número mayor que 0 (llegó ${JSON.stringify(valor)})`);
  }
  return valor;
};

// Redondea al paso configurado (100 = termina en $00) y nunca devuelve
// menos que un paso, para que ningún producto quede en $0.
export const redondearPrecio = (importe, redondeo) => {
  const paso = positivo(redondeo, "redondeo");
  return Math.max(paso, Math.round(importe / paso) * paso);
};

export const CAMPOS_PRIVADOS = ["tipo_cambio", "factor_importacion", "margen_menor", "margen_mayor", "redondeo"];

export const calcularPrecios = (costoUsd, privada) => {
  const costo = positivo(costoUsd, "costo");
  const [cambio, factor, menor, mayor, redondeo] = CAMPOS_PRIVADOS.map((campo) =>
    positivo(privada?.[campo], campo),
  );
  const costoReal = costo * factor * cambio;
  return {
    menor: redondearPrecio(costoReal * menor, redondeo),
    mayor: redondearPrecio(costoReal * mayor, redondeo),
  };
};
