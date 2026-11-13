import { useCallback, useEffect, useRef, useState } from 'react';
import { buscarIconos, CATEGORIAS_ICONOS } from '../herramientas/iconos/catalogo.js';
import SelectorColor from './SelectorColor.jsx';

export default function SelectorIconos({ motorRef }) {
  const raiz = useRef(null);
  const boton = useRef(null);
  const panel = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [colorIcono, setColorIcono] = useState('#2350d8');
  const [posicion, setPosicion] = useState({ left: 8, top: 64 });

  const alternar = useCallback(() => {
    if (abierto) {
      setAbierto(false);
      return;
    }
    const r = boton.current?.getBoundingClientRect();
    if (r) {
      const anchoPanel = Math.min(480, window.innerWidth - 16);
      const altoPanel = Math.min(560, window.innerHeight * 0.8);
      setPosicion({
        left: Math.max(8, Math.min(r.left, window.innerWidth - anchoPanel - 8)),
        top: Math.max(8, Math.min(r.bottom + 8, window.innerHeight - altoPanel - 8)),
      });
    }
    setAbierto(true);
  }, [abierto]);

  // Atajo de teclado Alt+I para alternar el panel de íconos
  useEffect(() => {
    const atajo = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        alternar();
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, [alternar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (e.target?.closest?.('.nt-color-popover')) return;
      if (!raiz.current?.contains(e.target) && !panel.current?.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const iconos = buscarIconos(consulta, categoria);

  function insertar(ico) {
    motorRef.current?.insertarIcono?.(ico, { color: colorIcono, modo: ico.modo });
    setAbierto(false);
  }

  return (
    <div ref={raiz} className="nt-selector-iconos" style={{ display: 'inline-flex' }}>
      <button
        ref={boton}
        type="button"
        className={`nt-ib ${abierto ? 'nt-ib--on' : ''}`}
        aria-label="Íconos y pegatinas de estudio (Alt+I)"
        title="Íconos y pegatinas (Alt+I)"
        onClick={alternar}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1L12 2z" />
        </svg>
      </button>

      {abierto && (
        <div
          ref={panel}
          data-nt-barra-panel
          className="nt-simbolos-panel"
          role="dialog"
          aria-label="Biblioteca de íconos y pegatinas"
          style={posicion}
        >
          {/* Cabecera con búsqueda y selector de color del ícono */}
          <div className="nt-simbolos-cab">
            <label className="nt-simbolos-busqueda">
              
              <input
                type="search"
                value={consulta}
                placeholder="Buscar ícono (ej. matraz, adn, flecha, ojo)..."
                onChange={(e) => setConsulta(e.target.value)}
                autoFocus
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Color del ícono">
              <span style={{ fontSize: '11px', color: '#64748b' }}>Color:</span>
              <SelectorColor
                colorActual={colorIcono}
                etiqueta="Color del ícono"
                motorRef={motorRef}
                alCambiar={(c) => setColorIcono(c || '#2350d8')}
              />
            </div>

            <button
              type="button"
              className="nt-ib nt-ib--cerrar nt-simbolos-cerrar"
              aria-label="Cerrar biblioteca de íconos"
              title="Cerrar (Esc)"
              onClick={() => setAbierto(false)}
            >
              ✕
            </button>
          </div>

          {/* Pestañas de categorías */}
          <nav className="nt-simbolos-pestanas" role="tablist" aria-label="Categorías de íconos">
            {CATEGORIAS_ICONOS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={categoria === cat.id}
                className={`nt-simbolos-pestana ${categoria === cat.id ? 'nt-simbolos-pestana--activa' : ''}`}
                onClick={() => setCategoria(cat.id)}
              >
                {cat.nombre}
              </button>
            ))}
          </nav>

          {/* Grilla de íconos */}
          <div className="nt-simbolos-lista" role="listbox" aria-label="Lista de íconos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
            {iconos.map((ico) => (
              <button
                key={ico.id}
                type="button"
                role="option"
                title={`${ico.nombre} (clic para insertar)`}
                aria-label={ico.nombre}
                style={{ width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                onClick={() => insertar(ico)}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{
                    width: '32px',
                    height: '32px',
                    stroke: ico.modo === 'trazo' ? colorIcono : 'none',
                    fill: ico.modo === 'relleno' ? colorIcono : 'none',
                    strokeWidth: ico.modo === 'trazo' ? 2 : 0,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  }}
                >
                  <path d={ico.d} />
                </svg>
              </button>
            ))}
            {iconos.length === 0 && (
              <span className="nt-simbolos-vacio">No se encontraron íconos para «{consulta}».</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
