import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Ventana emergente accesible: se cierra con Escape o tocando el fondo.
export function Modal({ titulo, alCerrar: alCerrarProp, children, ancho = 520 }) {
  const ref = useRef(null);
  // La función de cierre llega «nueva» en cada render del padre: se guarda en una referencia para que la ventana
  // no vuelva a enfocar su primer botón (ni reinicie sus eventos) cada vez que el padre se redibuja.
  const cierreRef = useRef(alCerrarProp);
  cierreRef.current = alCerrarProp;
  const alCerrar = useRef(() => cierreRef.current?.()).current;
  useEffect(() => {
    const previo = document.activeElement;
    const el = ref.current;
    if (el) {
      const enfocables = [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((node) => !node.hasAttribute('disabled'));
      if (enfocables.length) enfocables[0].focus();
    }
    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        alCerrar();
        return;
      }
      if (e.key === 'Tab' && el) {
        const enfocables = [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((node) => !node.hasAttribute('disabled'));
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); previo?.focus?.(); };
  }, [alCerrar]);
  const ventana = (
    <div className="nt-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div className="nt-ventana" role="dialog" aria-modal="true" aria-label={titulo} ref={ref} style={{ width: `min(${ancho}px, 100%)` }}>
        <h2 className="nt-sub">{titulo}</h2>
        {children}
      </div>
    </div>
  );
  // Se dibuja directamente en <body>: si se abre desde una barra con «transform» (como la de propiedades), la
  // posición fija quedaba atrapada dentro de esa barra y la ventana no se veía.
  return <EnPortal>{ventana}</EnPortal>;
}

// Dibuja su contenido directamente en <body> pero dentro de un contenedor «nt-raiz», que es el que define la tipografía,
// el color y los estilos base de la app (si no, las ventanas salían con la tipografía del navegador).
export function EnPortal({ children }) {
  if (typeof document === 'undefined') return children;
  return createPortal(<div className="nt-raiz nt-portal">{children}</div>, document.body);
}

export function Confirmar({ titulo, texto, textoBoton, alConfirmar, alCerrar }) {
  return (
    <Modal titulo={titulo} alCerrar={alCerrar} ancho={440}>
      <p className="nt-texto-suave">{texto}</p>
      <div className="nt-acciones">
        <button className="nt-btn" onClick={alCerrar} autoFocus>Cancelar</button>
        <button className="nt-btn nt-btn--peligro" onClick={alConfirmar}>{textoBoton}</button>
      </div>
    </Modal>
  );
}
