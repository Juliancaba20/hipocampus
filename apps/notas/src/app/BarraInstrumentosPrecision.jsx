// Barra de control de Instrumentos de Precisión y Corrección de Formas (Etapa 24).
// Permite activar/ocultar Regla, Escuadra y Transportador, y encender/apagar la corrección automática.

import { useState } from 'react';
import { TIPOS_INSTRUMENTO, radianesAGrados, gradosARadianes } from '../herramientas/precision/instrumentos.js';

export default function BarraInstrumentosPrecision({ motorRef, ui }) {
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const inst = ui?.instrumentoPrecision;
  const tipoActivo = inst?.activo ? inst.tipo : TIPOS_INSTRUMENTO.NINGUNO;
  const correccionActiva = !!ui?.correccionFormasActiva;

  const m = () => motorRef?.current;

  const seleccionarInstrumento = (tipo) => {
    if (tipo === TIPOS_INSTRUMENTO.NINGUNO || tipo === tipoActivo) {
      m()?.desactivarInstrumento();
    } else {
      m()?.activarInstrumento(tipo);
    }
  };

  const rotarPaso = (gradosDelta) => {
    if (!inst) return;
    const actualDeg = radianesAGrados(inst.angulo);
    const nuevoDeg = (actualDeg + gradosDelta + 360) % 360;
    m()?.rotarInstrumento(gradosARadianes(nuevoDeg));
  };

  const fijarAngulo = (grados) => {
    m()?.rotarInstrumento(gradosARadianes(grados));
  };

  return (
    <div
      className="nt-precision-hud"
      style={{
        display: 'inline-flex',
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
      aria-label="Instrumentos de precisión y corrección de formas"
    >
      {/* Botón Regla */}
      <button
        type="button"
        className={`nt-btn-sm ${tipoActivo === TIPOS_INSTRUMENTO.REGLA ? 'nt-btn--primario' : ''}`}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '16px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: tipoActivo === TIPOS_INSTRUMENTO.REGLA ? '1px solid #2563eb' : '1px solid #cbd5e1',
          background: tipoActivo === TIPOS_INSTRUMENTO.REGLA ? '#eff6ff' : '#ffffff',
          color: tipoActivo === TIPOS_INSTRUMENTO.REGLA ? '#1d4ed8' : '#334155',
          fontWeight: 600,
        }}
        onClick={() => seleccionarInstrumento(TIPOS_INSTRUMENTO.REGLA)}
        title="Regla en cm y mm. Arrastre con un dedo, rote con dos dedos o con el dial. Trazo recto imantado al borde."
        aria-pressed={tipoActivo === TIPOS_INSTRUMENTO.REGLA}
      >
        Regla
      </button>

      {/* Botón Escuadra */}
      <button
        type="button"
        className={`nt-btn-sm ${tipoActivo === TIPOS_INSTRUMENTO.ESCUADRA ? 'nt-btn--primario' : ''}`}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '16px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: tipoActivo === TIPOS_INSTRUMENTO.ESCUADRA ? '1px solid #2563eb' : '1px solid #cbd5e1',
          background: tipoActivo === TIPOS_INSTRUMENTO.ESCUADRA ? '#eff6ff' : '#ffffff',
          color: tipoActivo === TIPOS_INSTRUMENTO.ESCUADRA ? '#1d4ed8' : '#334155',
          fontWeight: 600,
        }}
        onClick={() => seleccionarInstrumento(TIPOS_INSTRUMENTO.ESCUADRA)}
        title="Escuadra para trazar ángulos perpendiculares (90°) y ángulos de 45°/30°/60°."
        aria-pressed={tipoActivo === TIPOS_INSTRUMENTO.ESCUADRA}
      >
        Escuadra
      </button>

      {/* Botón Transportador */}
      <button
        type="button"
        className={`nt-btn-sm ${tipoActivo === TIPOS_INSTRUMENTO.TRANSPORTADOR ? 'nt-btn--primario' : ''}`}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '16px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: tipoActivo === TIPOS_INSTRUMENTO.TRANSPORTADOR ? '1px solid #2563eb' : '1px solid #cbd5e1',
          background: tipoActivo === TIPOS_INSTRUMENTO.TRANSPORTADOR ? '#eff6ff' : '#ffffff',
          color: tipoActivo === TIPOS_INSTRUMENTO.TRANSPORTADOR ? '#1d4ed8' : '#334155',
          fontWeight: 600,
        }}
        onClick={() => seleccionarInstrumento(TIPOS_INSTRUMENTO.TRANSPORTADOR)}
        title="Transportador de ángulos (0° a 180°). Mida ángulos y trace arcos circulares y radios exactos."
        aria-pressed={tipoActivo === TIPOS_INSTRUMENTO.TRANSPORTADOR}
      >
        Transportador
      </button>

      {/* Si hay un instrumento activo, mostrar controles rápidos de ángulo */}
      {tipoActivo !== TIPOS_INSTRUMENTO.NINGUNO && inst && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', minWidth: '32px', textAlign: 'center' }}>
            {Math.round(radianesAGrados(inst.angulo))}°
          </span>
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
            onClick={() => rotarPaso(-15)}
            title="Rotar 15° en sentido antihorario"
          >
            -15°
          </button>
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
            onClick={() => rotarPaso(15)}
            title="Rotar 15° en sentido horario"
          >
            +15°
          </button>
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
            onClick={() => fijarAngulo(0)}
            title="Fijar ángulo en 0° horizontal"
          >
            0°
          </button>
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
            onClick={() => fijarAngulo(90)}
            title="Fijar ángulo en 90° vertical"
          >
            90°
          </button>
        </div>
      )}

      <span style={{ width: '1px', height: '16px', background: '#cbd5e1', margin: '0 4px' }} aria-hidden="true" />

      {/* Interruptor de Corrección Automática de Formas */}
      <button
        type="button"
        className={`nt-btn-sm ${correccionActiva ? 'nt-btn--primario' : ''}`}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '16px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: correccionActiva ? '1px solid #8b5cf6' : '1px solid #cbd5e1',
          background: correccionActiva ? '#f5f3ff' : '#ffffff',
          color: correccionActiva ? '#6d28d9' : '#334155',
          fontWeight: 600,
        }}
        onClick={() => m()?.toggleCorreccionFormas()}
        title={
          correccionActiva
            ? 'Corrección automática activa: mantenga el lápiz quieto un instante al final del trazo para convertirlo en línea, círculo/elipse, rectángulo o triángulo.'
            : 'Activar corrección automática de formas (hold-to-snap al final del trazo).'
        }
        aria-pressed={correccionActiva}
      >
        Formas{correccionActiva ? ' (activa)' : ''}
      </button>
    </div>
  );
}
