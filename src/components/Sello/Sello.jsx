// El sello de la marca: tres muestras de color superpuestas, como las que se
// prueban en el dorso de la mano. Es decorativo; el nombre del negocio va al
// lado. Lo usan el encabezado y el pie.
export const Sello = ({ className = "marca-sello" }) => (
  <svg className={className} width="34" height="22" viewBox="0 0 34 22" aria-hidden="true">
    <circle cx="11" cy="11" r="9" fill="#C8105C" />
    <circle cx="19" cy="11" r="9" fill="#6A2FB0" fillOpacity=".88" />
    <circle cx="26" cy="11" r="7" fill="#F2A07B" fillOpacity=".95" />
  </svg>
);
