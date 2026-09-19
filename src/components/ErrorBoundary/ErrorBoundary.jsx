import { Component } from "react";

// Red de seguridad: si algún componente falla al renderizar, se muestra un
// aviso en vez de dejar la página en blanco. Los límites de error de React
// todavía solo existen como componentes de clase.
export class ErrorBoundary extends Component {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error, info) {
    console.error("Error en la página:", error, info.componentStack);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="estado" role="alert">
        <h1>Algo salió mal</h1>
        <p>Tu carrito quedó guardado.</p>
        {/* <a> y no <Link>: recarga la página y arranca de cero */}
        <a href={import.meta.env.BASE_URL} className="btn bg-primary">
          Volver al catálogo
        </a>
      </div>
    );
  }
}
