// Barra de acceso rápido a Lápices Favoritos (Etapa 24).
// Permite alternar entre los ajustes favoritos con un solo toque. Cada persona arma su propia bandeja: agrega,
// quita y modifica favoritos con el botón «Editar» (también con pulsación larga o clic derecho sobre uno).

import { useState, useEffect, useRef } from 'react';
import {
  cargarLapicesFavoritos,
  guardarLapicesFavoritos,
  actualizarLapizFavorito,
  restablecerLapicesFavoritos,
  MAXIMO_LAPICES_FAVORITOS,
} from '../herramientas/precision/lapicesFavoritos.js';
import { COLORES } from './EditorComun.jsx';

export default function BarraLapicesFavoritos({ motorRef, ui }) {
  const [lapices, setLapices] = useState([]);
  const [slotEditando, setSlotEditando] = useState(null);
  const [cargado, setCargado] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    let activo = true;
    cargarLapicesFavoritos().then((lista) => {
      if (activo) { setLapices(lista); setCargado(true); }
    });
    return () => {
      activo = false;
    };
  }, []);

  const pulsacionLargaRef = useRef(null);

  if (!cargado) return null;

  const herrActual = ui?.herramienta;
  const ajustesActuales = ui?.ajustes?.[herrActual] || {};
  const puedeGuardarActual = ['lapiz', 'resaltador'].includes(herrActual);
  const MAXIMO = MAXIMO_LAPICES_FAVORITOS;

  // Agrega un favorito nuevo: copia el lápiz o resaltador que se está usando (o uno azul si se usa otra herramienta)
  // y abre su editor para ajustarlo enseguida.
  const agregarActual = async () => {
    if (lapices.length >= MAXIMO) return;
    const nuevo = {
      id: `lapiz-${Date.now().toString(36)}`,
      herramienta: puedeGuardarActual ? herrActual : 'lapiz',
      color: (puedeGuardarActual && ajustesActuales.color) || '#2350d8',
      grosor: (puedeGuardarActual && ajustesActuales.grosor) || 2,
      opacidad: (puedeGuardarActual && ajustesActuales.opacidad) || 1.0,
      nombre: `Favorito ${lapices.length + 1}`,
    };
    const lista = await guardarLapicesFavoritos([...lapices, nuevo]);
    if (lista) { setLapices(lista); setModoEdicion(true); setSlotEditando(lista.length - 1); }
  };

  const restablecer = async () => {
    const lista = await restablecerLapicesFavoritos();
    if (lista) setLapices(lista);
    setSlotEditando(null);
  };

  const modificar = async (idx, parche) => {
    const lista = await actualizarLapizFavorito(idx, parche);
    if (lista) setLapices(lista);
  };

  const quitarFavorito = async (idx) => {
    const lista = await guardarLapicesFavoritos(lapices.filter((_, i) => i !== idx));
    if (lista) setLapices(lista);
    setSlotEditando(null);
  };

  // Pulsación larga (dedo o lápiz): abre las opciones de la ranura, igual que el clic derecho
  const empezarPulsacionLarga = (idx) => {
    clearTimeout(pulsacionLargaRef.current);
    pulsacionLargaRef.current = setTimeout(() => { pulsacionLargaRef.current = 'abierta'; setSlotEditando(idx); }, 500);
  };
  const terminarPulsacionLarga = () => {
    if (pulsacionLargaRef.current !== 'abierta') clearTimeout(pulsacionLargaRef.current);
  };

  const aplicarLapiz = (l) => {
    const motor = motorRef?.current;
    if (!motor) return;
    motor.setHerramienta(l.herramienta);
    motor.configurar(l.herramienta, {
      color: l.color,
      grosor: l.grosor,
      opacidad: l.opacidad,
    });
  };

  const guardarActualEnSlot = async (idx) => {
    if (!['lapiz', 'resaltador'].includes(herrActual)) return;
    const nuevo = {
      herramienta: herrActual,
      color: ajustesActuales.color || '#2350d8',
      grosor: ajustesActuales.grosor || 2,
      opacidad: ajustesActuales.opacidad || 1.0,
      nombre: herrActual === 'resaltador' ? 'Resaltador' : 'Lápiz',
    };
    const actualizados = await actualizarLapizFavorito(idx, nuevo);
    setLapices(actualizados);
    setSlotEditando(null);
  };

  return (
    <div
      ref={contenedorRef}
      className="nt-lapices-favoritos"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        maxWidth: 'min(420px, calc(100vw - 24px))',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        padding: '3px 6px',
        borderRadius: '24px',
        border: '1px solid rgba(203, 213, 225, 0.9)',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
        position: 'relative',
        zIndex: 10,
      }}
      role="toolbar"
      aria-label="Lápices favoritos de acceso rápido"
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#64748b',
          padding: '0 4px',
          userSelect: 'none',
        }}
        title="Lápices favoritos: toque uno para usarlo. Con «Editar» puede agregar, quitar y modificar los suyos."
      >
        Favoritos
      </span>

      {lapices.map((l, idx) => {
        const esActivo =
          herrActual === l.herramienta &&
          ajustesActuales.color === l.color &&
          Math.abs((ajustesActuales.grosor || 0) - l.grosor) < 0.5;

        return (
          <div key={l.id || idx} style={{ position: 'relative' }}>
            <button
              type="button"
              className="nt-lapiz-fav-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: esActivo ? '2px solid #2563eb' : '1.5px solid rgba(203, 213, 225, 0.8)',
                background: esActivo ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
                transition: 'all 0.15s ease',
                transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                boxShadow: esActivo ? '0 0 0 2px rgba(37, 99, 235, 0.25)' : 'none',
              }}
              onClick={() => {
                if (pulsacionLargaRef.current === 'abierta') { pulsacionLargaRef.current = null; return; }
                if (modoEdicion) { setSlotEditando(slotEditando === idx ? null : idx); return; }
                aplicarLapiz(l);
              }}
              onPointerDown={() => empezarPulsacionLarga(idx)}
              onPointerUp={terminarPulsacionLarga}
              onPointerLeave={terminarPulsacionLarga}
              onPointerCancel={terminarPulsacionLarga}
              onContextMenu={(e) => {
                e.preventDefault();
                setSlotEditando(slotEditando === idx ? null : idx);
              }}
              title={`${l.nombre} (${l.herramienta === 'resaltador' ? 'Resaltador' : 'Lápiz'} ${l.grosor}px, ${l.color}). ${modoEdicion ? 'Toque para modificarlo.' : 'Mantenga presionado o clic derecho para editar.'}`}
              aria-label={`Lápiz favorito ${idx + 1}: ${l.nombre}`}
              aria-pressed={esActivo}
            >
              {/* Círculo indicador de color y grosor */}
              <span
                style={{
                  display: 'block',
                  width: `${Math.max(8, Math.min(22, l.herramienta === 'resaltador' ? 18 : l.grosor * 3.5))}px`,
                  height: `${Math.max(8, Math.min(22, l.herramienta === 'resaltador' ? 18 : l.grosor * 3.5))}px`,
                  borderRadius: l.herramienta === 'resaltador' ? '4px' : '50%',
                  background: l.color,
                  opacity: l.opacidad,
                  boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.15)',
                }}
              />
            </button>

            {modoEdicion && (
              <button
                type="button"
                className="nt-lapiz-fav-quitar"
                style={{
                  position: 'absolute', top: '-5px', right: '-5px', width: '16px', height: '16px', borderRadius: '50%', padding: 0,
                  border: '1px solid #fff', background: '#dc2626', color: '#fff', fontSize: '11px', lineHeight: '14px', cursor: 'pointer',
                }}
                onClick={(e) => { e.stopPropagation(); quitarFavorito(idx); }}
                title={`Quitar «${l.nombre}» de favoritos`}
                aria-label={`Quitar ${l.nombre} de favoritos`}
              >
                ×
              </button>
            )}

            {/* Menú emergente de personalización del slot */}
            {slotEditando === idx && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: 'min(300px, calc(100vw - 24px))',
                  zIndex: 60,
                  background: '#ffffff',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
                  width: '210px',
                  zIndex: 200,
                  display: 'grid',
                  gap: '8px',
                  fontSize: '12px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontWeight: 600, color: '#1e293b' }}>
                  Favorito {idx + 1}
                </div>

                <input
                  type="text"
                  className="nt-campo"
                  value={l.nombre}
                  maxLength={24}
                  aria-label="Nombre del favorito"
                  style={{ fontSize: '12px', padding: '4px 6px', minHeight: 0 }}
                  onChange={(e) => setLapices(lapices.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)))}
                  onBlur={(e) => modificar(idx, { nombre: e.target.value.trim() || `Favorito ${idx + 1}` })}
                />

                <div style={{ display: 'flex', gap: '4px' }}>
                  {[['lapiz', 'Lápiz'], ['resaltador', 'Resaltador']].map(([h, n]) => (
                    <button
                      key={h}
                      type="button"
                      className="nt-btn nt-btn-sm"
                      style={{ flex: 1, fontSize: '11px', padding: '3px 4px', borderColor: l.herramienta === h ? '#2563eb' : undefined, fontWeight: l.herramienta === h ? 700 : 500 }}
                      onClick={() => modificar(idx, h === 'resaltador' ? { herramienta: h, grosor: Math.max(l.grosor, 14), opacidad: Math.min(l.opacidad, 0.5) } : { herramienta: h, opacidad: 1 })}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'grid', gap: '2px', fontSize: '11px', color: '#64748b' }}>
                  Grosor: {l.grosor}
                  <input type="range" min="1" max="40" step="0.5" value={l.grosor} onChange={(e) => modificar(idx, { grosor: Number(e.target.value) })} />
                </label>
                <label style={{ display: 'grid', gap: '2px', fontSize: '11px', color: '#64748b' }}>
                  Opacidad: {Math.round(l.opacidad * 100)} %
                  <input type="range" min="0.1" max="1" step="0.05" value={l.opacidad} onChange={(e) => modificar(idx, { opacidad: Number(e.target.value) })} />
                </label>

                <button
                  type="button"
                  className="nt-btn nt-btn--primario nt-btn-sm"
                  style={{ width: '100%', fontSize: '11px', padding: '4px' }}
                  onClick={() => guardarActualEnSlot(idx)}
                  disabled={!puedeGuardarActual}
                  title={puedeGuardarActual ? 'Copiar aquí el color, grosor y opacidad que está usando' : 'Elija el lápiz o el resaltador para copiar su ajuste'}
                >
                  Copiar el ajuste que estoy usando
                </button>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Color:</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(l.color) ? l.color : '#2350d8'}
                      onChange={(e) => modificar(idx, { color: e.target.value })}
                      aria-label="Elegir otro color"
                      title="Elegir cualquier otro color"
                      style={{ width: '22px', height: '22px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '50%', background: 'none', cursor: 'pointer' }}
                    />
                    {COLORES.map(([c, n]) => (
                      <button
                        key={c}
                        type="button"
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: c,
                          border: l.color === c ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                        }}
                        title={n}
                        onClick={async () => {
                          const act = await actualizarLapizFavorito(idx, { color: c });
                          setLapices(act);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="nt-btn nt-btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => quitarFavorito(idx)}
                    title="Quitar este favorito"
                  >
                    Quitar
                  </button>
                  <button
                    type="button"
                    className="nt-btn nt-btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => setSlotEditando(null)}
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {lapices.length < MAXIMO && (
        <button
          type="button"
          className="nt-lapiz-fav-agregar"
          style={{
            width: '32px', height: '32px', borderRadius: '50%', padding: 0, cursor: 'pointer',
            border: '1.5px dashed #94a3b8', background: '#ffffff', color: '#334155', fontSize: '18px', lineHeight: 1,
          }}
          onClick={agregarActual}
          title={puedeGuardarActual ? 'Agregar un favorito nuevo con el lápiz o resaltador que está usando' : 'Agregar un favorito nuevo y ajustarlo'}
          aria-label="Agregar un lápiz favorito"
        >
          +
        </button>
      )}

      <button
        type="button"
        className="nt-lapiz-fav-editar"
        style={{
          height: '28px', borderRadius: '14px', padding: '0 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
          border: modoEdicion ? '1.5px solid #2563eb' : '1px solid #cbd5e1', background: modoEdicion ? '#eff6ff' : '#fff', color: '#334155',
        }}
        onClick={() => { setModoEdicion(!modoEdicion); setSlotEditando(null); }}
        aria-pressed={modoEdicion}
        title="Agregar, quitar y modificar sus favoritos"
      >
        {modoEdicion ? 'Listo' : 'Editar'}
      </button>

      {modoEdicion && (
        <button
          type="button"
          className="nt-lapiz-fav-restablecer"
          style={{ height: '28px', borderRadius: '14px', padding: '0 10px', cursor: 'pointer', fontSize: '11px', border: '1px solid #cbd5e1', background: '#fff', color: '#64748b' }}
          onClick={restablecer}
          title="Volver a los favoritos que trae la aplicación"
        >
          Restablecer
        </button>
      )}
    </div>
  );
}
