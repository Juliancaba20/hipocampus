import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { obtenerAjuste, guardarAjuste } from '../almacen/index.js';
import { buscarSimbolos, registrarSimbolo, CATEGORIAS } from '../herramientas/simbolos/catalogo.js';

const CLAVE = 'simbolos.frecuencia';
const sinFoco = (e) => e.preventDefault();

export default function SelectorSimbolos({ motorRef }) {
  const raiz = useRef(null);
  const boton = useRef(null);
  const panel = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [usados, setUsados] = useState([]);
  const [posicion, setPosicion] = useState({ left: 8, top: 64 });

  useEffect(() => {
    let vivo = true;
    obtenerAjuste(CLAVE, []).then((valor) => { if (vivo && Array.isArray(valor)) setUsados(valor); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

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

  // Atajo de teclado Alt+S para alternar el panel
  useEffect(() => {
    const atajo = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
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
      // el panel se dibuja fuera de la barra de texto (si no, la barra lo recortaría), por eso se revisa aparte
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

  function insertar(caracter) {
    if (!motorRef.current?.insertarSimbolo(caracter)) return;
    const nuevos = registrarSimbolo(usados, caracter);
    setUsados(nuevos);
    guardarAjuste(CLAVE, nuevos).catch(() => {});
  }

  const frecuentes = buscarSimbolos('', 'todas', usados)
    .filter((s) => usados.some((u) => u.caracter === s.caracter));
  const lista = buscarSimbolos(consulta, categoria, usados);

  return (
    <div ref={raiz} className="nt-selector-simbolos">
      <button
        ref={boton}
        type="button"
        className="nt-bt"
        aria-label="Símbolos científicos (Alt+S)"
        title="Símbolos científicos (Alt+S)"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onMouseDown={sinFoco}
        onClick={alternar}
      >
        Σ
      </button>

      {abierto && createPortal(
        <div ref={panel} data-nt-barra-panel className="nt-simbolos-panel" role="dialog" aria-label="Símbolos científicos" style={posicion}>
          <div className="nt-simbolos-cab">
            <label className="nt-simbolos-busqueda">
              
              <input
                autoFocus
                type="search"
                aria-label="Buscar símbolo por nombre o término"
                placeholder="Buscar símbolos (ej: alfa, ohm, integral)…"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="nt-ib nt-ib--cerrar nt-simbolos-cerrar"
              aria-label="Cerrar panel de símbolos"
              title="Cerrar (Esc)"
              onMouseDown={sinFoco}
              onClick={() => setAbierto(false)}
            >
              ✕
            </button>
          </div>

          <nav className="nt-simbolos-pestanas" role="tablist" aria-label="Categorías de símbolos">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={categoria === cat.id}
                className={`nt-simbolos-pestana ${categoria === cat.id ? 'nt-simbolos-pestana--activa' : ''}`}
                onMouseDown={sinFoco}
                onClick={() => setCategoria(cat.id)}
              >
                {cat.nombre}
              </button>
            ))}
          </nav>

          {!consulta && categoria === 'todas' && frecuentes.length > 0 && (
            <section className="nt-simbolos-seccion" aria-label="Más usados">
              <h3>Más usados</h3>
              <div className="nt-simbolos-rejilla">
                {frecuentes.slice(0, 12).map((s) => (
                  <button
                    key={`frecuente-${s.caracter}`}
                    type="button"
                    title={`${s.nombre} · ${s.categoria}`}
                    aria-label={`Insertar ${s.nombre}, ${s.caracter}`}
                    onMouseDown={sinFoco}
                    onClick={() => insertar(s.caracter)}
                  >
                    {s.caracter}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="nt-simbolos-lista" role="listbox" aria-label="Lista de símbolos">
            {lista.map((s) => (
              <button
                key={s.caracter}
                type="button"
                role="option"
                aria-label={`${s.nombre}, ${s.caracter}`}
                title={`${s.nombre} · ${s.categoria}`}
                onMouseDown={sinFoco}
                onClick={() => insertar(s.caracter)}
              >
                {s.caracter}
              </button>
            ))}
            {!lista.length && (
              <span className="nt-simbolos-vacio">No se encontraron símbolos para esa búsqueda.</span>
            )}
          </div>
        </div>,
        document.querySelector('.nt-raiz') || document.body,
      )}
    </div>
  );
}
