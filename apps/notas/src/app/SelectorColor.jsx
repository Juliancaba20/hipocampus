import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EnPortal } from './Modal.jsx';

const CLAVE_PALETA = 'nota_paleta_guardada';

const PALETA_BASE = [
  '#14192b', '#2350d8', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#ffffff',
];

export const DEGRADADOS_PREDEFINIDOS = [
  { nombre: 'Cielo suave', css: 'linear-gradient(135deg, #e0f2fe 0%, #ede9fe 100%)', angulo: 135, paradas: [{ pos: 0, color: '#e0f2fe' }, { pos: 1, color: '#ede9fe' }] },
  { nombre: 'Atardecer', css: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)', angulo: 135, paradas: [{ pos: 0, color: '#ff7e5f' }, { pos: 1, color: '#feb47b' }] },
  { nombre: 'Menta', css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', angulo: 135, paradas: [{ pos: 0, color: '#a8edea' }, { pos: 1, color: '#fed6e3' }] },
  { nombre: 'Lavanda', css: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', angulo: 135, paradas: [{ pos: 0, color: '#e0c3fc' }, { pos: 1, color: '#8ec5fc' }] },
  { nombre: 'Pizarrón verde', css: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', angulo: 135, paradas: [{ pos: 0, color: '#1b4332' }, { pos: 1, color: '#2d6a4f' }] },
  { nombre: 'Pizarrón oscuro', css: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', angulo: 135, paradas: [{ pos: 0, color: '#1e293b' }, { pos: 1, color: '#0f172a' }] },
  { nombre: 'Dorado cálido', css: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', angulo: 135, paradas: [{ pos: 0, color: '#f6d365' }, { pos: 1, color: '#fda085' }] },
  { nombre: 'Océano azul', css: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)', angulo: 135, paradas: [{ pos: 0, color: '#2b5876' }, { pos: 1, color: '#4e4376' }] },
];

function cargarPaletaUsuario() {
  try {
    const raw = localStorage.getItem(CLAVE_PALETA);
    if (!raw) return ['#2350d8', '#10b981', '#f59e0b', '#ec4899'];
    const p = JSON.parse(raw);
    return Array.isArray(p) && p.length ? p : ['#2350d8', '#10b981', '#f59e0b', '#ec4899'];
  } catch {
    return ['#2350d8', '#10b981', '#f59e0b', '#ec4899'];
  }
}

function guardarPaletaUsuario(paleta) {
  try {
    localStorage.setItem(CLAVE_PALETA, JSON.stringify(paleta));
  } catch {}
}

export default function SelectorColor({
  colorActual = '#2350d8',
  alCambiar,
  admitirDegradado = false,
  admitirTransparente = false,
  etiqueta = 'Color',
  motorRef = null,
}) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState('solido'); // 'solido' | 'degradado'
  const [paletaGuardada, setPaletaGuardada] = useState(cargarPaletaUsuario);
  const [modoMuestreo, setModoMuestreo] = useState(false);
  const [angulo, setAngulo] = useState(135);
  const [gradCol1, setGradCol1] = useState('#e0f2fe');
  const [gradCol2, setGradCol2] = useState('#ede9fe');
  const [hexInput, setHexInput] = useState(typeof colorActual === 'string' && colorActual.startsWith('#') ? colorActual : '#2350d8');

  const popoverRef = useRef(null);
  const botonRef = useRef(null);
  // El desplegable se dibuja en <body> con posición fija: dentro de paneles con «overflow: hidden» (como el de
  // íconos y pegatinas) quedaba recortado y no se veía.
  const [posicion, setPosicion] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const ancho = 240;
    const alto = popoverRef.current?.offsetHeight || 380;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
    let top = r.bottom + 6;
    if (top + alto > window.innerHeight - 8) top = Math.max(8, r.top - alto - 6);
    setPosicion({ top, left });
  }, [abierto, pestana, admitirDegradado]);

  // Sincronizar input hex cuando cambie la propiedad exterior
  useEffect(() => {
    if (typeof colorActual === 'string' && colorActual.startsWith('#')) {
      setHexInput(colorActual);
    }
  }, [colorActual]);

  // Cerrar al hacer clic fuera o presionar Esc
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        botonRef.current &&
        !botonRef.current.contains(e.target)
      ) {
        setAbierto(false);
        setModoMuestreo(false);
      }
    };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        setModoMuestreo(false);
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  // Manejo de cuentagotas nativo o alternativo en lienzo
  async function usarCuentagotas() {
    // 1. Probar primero EyeDropper nativo del navegador si está soportado (Chrome / Edge / Opera)
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new window.EyeDropper();
        const resultado = await eyeDropper.open();
        if (resultado && resultado.sRGBHex) {
          const hex = resultado.sRGBHex.toLowerCase();
          setHexInput(hex);
          alCambiar(hex);
          agregarAPaleta(hex);
          return;
        }
      } catch (err) {
        // Si el usuario canceló el cuentagotas nativo con Esc, salir sin error
        if (err.name === 'AbortError') return;
      }
    }

    // 2. Alternativa universal propia para Safari (iPad, Mac), Firefox y dispositivos móviles:
    // Muestreo directo tocando sobre el canvas de la aplicación mediante getImageData
    setModoMuestreo(true);
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const alTocarCanvas = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      const px = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
      const py = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);

      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const data = ctx.getImageData(px, py, 1, 1).data;
          const r = data[0].toString(16).padStart(2, '0');
          const g = data[1].toString(16).padStart(2, '0');
          const b = data[2].toString(16).padStart(2, '0');
          const hex = `#${r}${g}${b}`;
          setHexInput(hex);
          alCambiar(hex);
          agregarAPaleta(hex);
        }
      } catch {}

      removerListeners();
      setModoMuestreo(false);
    };

    const alCancelar = (e) => {
      if (e.key === 'Escape') {
        removerListeners();
        setModoMuestreo(false);
      }
    };

    function removerListeners() {
      window.removeEventListener('pointerdown', alTocarCanvas, true);
      window.removeEventListener('keydown', alCancelar, true);
      document.body.style.cursor = '';
    }

    document.body.style.cursor = 'crosshair';
    window.addEventListener('pointerdown', alTocarCanvas, { capture: true, once: true });
    window.addEventListener('keydown', alCancelar, true);
  }

  function agregarAPaleta(hex) {
    if (!hex || !hex.startsWith('#') || paletaGuardada.includes(hex)) return;
    const nueva = [hex, ...paletaGuardada.slice(0, 15)];
    setPaletaGuardada(nueva);
    guardarPaletaUsuario(nueva);
  }

  function quitarDePaleta(hex, e) {
    e.stopPropagation();
    const nueva = paletaGuardada.filter((c) => c !== hex);
    setPaletaGuardada(nueva);
    guardarPaletaUsuario(nueva);
  }

  function aplicarDegradado(ang, c1, c2) {
    const obj = {
      tipo: 'lineal',
      angulo: ang,
      paradas: [
        { pos: 0, color: c1 },
        { pos: 1, color: c2 },
      ],
    };
    alCambiar(obj);
  }

  const esDegradado = typeof colorActual === 'object' && colorActual?.tipo === 'lineal'
    || (typeof colorActual === 'string' && colorActual.startsWith('linear-gradient'));

  const fondoBoton = esDegradado
    ? (typeof colorActual === 'string' ? colorActual : `linear-gradient(${colorActual.angulo || 135}deg, ${colorActual.paradas?.[0]?.color || '#e0f2fe'} 0%, ${colorActual.paradas?.[1]?.color || '#ede9fe'} 100%)`)
    : (colorActual || 'transparent');

  return (
    <div className="nt-selector-color-raiz" style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={botonRef}
        type="button"
        className={`nt-color-muestra ${!colorActual ? 'nt-color--vacio' : ''}`}
        style={{
          background: fondoBoton,
          width: '28px',
          height: '28px',
          borderRadius: '7px',
          border: '1.5px solid rgba(20, 25, 43, 0.25)',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label={`${etiqueta}: abrir paleta de colores`}
        title={`${etiqueta}: selector de color`}
        onClick={() => setAbierto(!abierto)}
      >
        {!colorActual && <span style={{ fontSize: '14px', lineHeight: 1 }}>∅</span>}
      </button>

      {abierto && (
        <EnPortal>
        <div
          ref={popoverRef}
          className="nt-color-popover"
          data-nt-barra-panel
          role="dialog"
          aria-label={`Selector de ${etiqueta.toLowerCase()}`}
          style={{
            position: 'fixed',
            top: posicion.top,
            left: posicion.left,
            maxHeight: 'calc(100vh - 16px)',
            overflowY: 'auto',
            zIndex: 80,
            width: '240px',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 8px 24px rgba(20, 25, 43, 0.25)',
            border: '1px solid #d5dbe8',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Pestañas de modo si admite degradados */}
          {admitirDegradado && (
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              <button
                type="button"
                className={`nt-btn-sm ${pestana === 'solido' ? 'nt-btn-sm--on' : ''}`}
                style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: pestana === 'solido' ? '700' : '500',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: 0,
                  cursor: 'pointer',
                  background: pestana === 'solido' ? '#e0f2fe' : 'transparent',
                  color: pestana === 'solido' ? '#0369a1' : '#64748b',
                }}
                onClick={() => setPestana('solido')}
              >
                Color sólido
              </button>
              <button
                type="button"
                className={`nt-btn-sm ${pestana === 'degradado' ? 'nt-btn-sm--on' : ''}`}
                style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: pestana === 'degradado' ? '700' : '500',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: 0,
                  cursor: 'pointer',
                  background: pestana === 'degradado' ? '#e0f2fe' : 'transparent',
                  color: pestana === 'degradado' ? '#0369a1' : '#64748b',
                }}
                onClick={() => setPestana('degradado')}
              >
                Degradado
              </button>
            </div>
          )}

          {pestana === 'solido' ? (
            <>
              {/* Opción Transparente si aplica */}
              {admitirTransparente && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: !colorActual ? '#f1f5f9' : '#ffffff',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                    onClick={() => alCambiar(null)}
                  >
                    <span style={{ fontSize: '15px' }}>∅</span> Sin color (transparente)
                  </button>
                </div>
              )}

              {/* Paleta básica predefinida */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Básicos</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '4px' }}>
                  {PALETA_BASE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      style={{
                        height: '24px',
                        borderRadius: '6px',
                        background: c,
                        border: colorActual === c ? '2px solid #0284c7' : '1px solid rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title={c}
                      onClick={() => {
                        setHexInput(c);
                        alCambiar(c);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Paleta personal guardada por el usuario */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Mis colores</span>
                  <button
                    type="button"
                    style={{
                      fontSize: '11px',
                      background: 'none',
                      border: 0,
                      color: '#0284c7',
                      cursor: 'pointer',
                      fontWeight: '600',
                      padding: '0 2px',
                    }}
                    title="Guardar el color actual en la paleta personal"
                    onClick={() => agregarAPaleta(hexInput)}
                  >
                    + Guardar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '4px', minHeight: '24px' }}>
                  {paletaGuardada.map((c) => (
                    <div key={c} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          height: '24px',
                          borderRadius: '6px',
                          background: c,
                          border: colorActual === c ? '2px solid #0284c7' : '1px solid rgba(0,0,0,0.15)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        title={c}
                        onClick={() => {
                          setHexInput(c);
                          alCambiar(c);
                        }}
                      />
                      <button
                        type="button"
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: '9px',
                          lineHeight: '1',
                          border: 0,
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          padding: 0,
                        }}
                        title="Quitar de mi paleta"
                        onClick={(e) => quitarDePaleta(c, e)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cuentagotas y entrada de color exacta */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: modoMuestreo ? '#fef08a' : '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  title="Cuentagotas (extraer color tocando cualquier parte de la pantalla o lienzo)"
                  onClick={usarCuentagotas}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                    <path d="M14 4l6 6-2 2-2-2-7 7-4 1 1-4 7-7-2-2 3-3z" />
                  </svg>
                  <span>{modoMuestreo ? 'Tocá...' : 'Gotero'}</span>
                </button>

                <input
                  type="color"
                  value={hexInput.startsWith('#') && hexInput.length === 7 ? hexInput : '#2350d8'}
                  style={{ width: '28px', height: '28px', padding: 0, border: 0, borderRadius: '6px', cursor: 'pointer' }}
                  onChange={(e) => {
                    const c = e.target.value;
                    setHexInput(c);
                    alCambiar(c);
                  }}
                />

                <input
                  type="text"
                  value={hexInput}
                  maxLength={7}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '28px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    padding: '0 6px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHexInput(val);
                    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                      alCambiar(val);
                    }
                  }}
                />
              </div>
            </>
          ) : (
            /* Pestaña de Degradados */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Predefinidos</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {DEGRADADOS_PREDEFINIDOS.map((g) => (
                  <button
                    key={g.nombre}
                    type="button"
                    style={{
                      height: '28px',
                      borderRadius: '6px',
                      background: g.css,
                      border: '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title={g.nombre}
                    onClick={() => {
                      setAngulo(g.angulo);
                      setGradCol1(g.paradas[0].color);
                      setGradCol2(g.paradas[1].color);
                      alCambiar(g);
                    }}
                  />
                ))}
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Personalizado</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={gradCol1}
                    style={{ width: '28px', height: '28px', padding: 0, border: 0, borderRadius: '6px', cursor: 'pointer' }}
                    onChange={(e) => {
                      const c = e.target.value;
                      setGradCol1(c);
                      aplicarDegradado(angulo, c, gradCol2);
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>a</span>
                  <input
                    type="color"
                    value={gradCol2}
                    style={{ width: '28px', height: '28px', padding: 0, border: 0, borderRadius: '6px', cursor: 'pointer' }}
                    onChange={(e) => {
                      const c = e.target.value;
                      setGradCol2(c);
                      aplicarDegradado(angulo, gradCol1, c);
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{angulo}°</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={angulo}
                      style={{ flex: 1 }}
                      onChange={(e) => {
                        const a = +e.target.value;
                        setAngulo(a);
                        aplicarDegradado(a, gradCol1, gradCol2);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </EnPortal>
      )}
    </div>
  );
}
