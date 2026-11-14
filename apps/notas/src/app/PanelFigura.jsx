// Panel de estilo de figuras (Etapa 7 y 21A):
// Borde, relleno (color o degradado), grosor, estilo de trazo,
// esquinas redondeadas, sombra y opacidad.
import { useState } from 'react';
import SelectorColor from './SelectorColor.jsx';
import ModalSeleccionarNota from './ModalSeleccionarNota.jsx';

export default function PanelFigura({ estilo, motorRef }) {
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [modalElegirNota, setModalElegirNota] = useState(false);
  const cambiar = (parche) => motorRef.current?.estiloFiguras(parche);

  const sombra = estilo.sombra || { activa: false, color: 'rgba(20, 25, 43, 0.35)', desenfoque: 8, x: 2, y: 4 };
  const esLineaOArco = estilo.linea || estilo.forma === 'linea' || estilo.forma === 'flecha';
  const esRect = !estilo.forma || estilo.forma === 'rectangulo';

  return (
    <div className="nt-props" role="group" aria-label="Estilo de la figura" style={{ flexWrap: 'wrap', gap: '8px' }}>
      {/* Selector de color de borde con cuentagotas y paleta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Color del borde">
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Borde</span>
        <SelectorColor
          colorActual={estilo.borde || '#2350d8'}
          etiqueta="Borde"
          motorRef={motorRef}
          alCambiar={(c) => cambiar({ borde: c || '#2350d8' })}
        />
      </div>

      {/* Relleno con soporte de degradados y paleta de usuario */}
      {!esLineaOArco && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Relleno (color o degradado)">
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Relleno</span>
          <SelectorColor
            colorActual={estilo.relleno}
            etiqueta="Relleno"
            admitirDegradado={true}
            admitirTransparente={true}
            motorRef={motorRef}
            alCambiar={(c) => cambiar({ relleno: c })}
          />
        </div>
      )}

      {/* Selector de tipo de conector para líneas y flechas (Etapa 21B) */}
      {esLineaOArco && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Tipo de línea o conector (recto o curvo)">
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Trazo</span>
          <select
            value={estilo.tipoConector || 'recto'}
            style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
            onChange={(e) => cambiar({ tipoConector: e.target.value })}
            aria-label="Tipo de conector"
          >
            <option value="recto">Recta</option>
            <option value="curvo">Curva</option>
          </select>
        </div>
      )}

      {/* Grosor de borde */}
      <label className="nt-rango" title="Grosor del borde">
        Grosor
        <input
          type="range"
          min="1"
          max="30"
          value={estilo.grosor || 2}
          onChange={(e) => cambiar({ grosor: +e.target.value })}
        />
      </label>

      {/* Texto o etiqueta de nodo para mapas conceptuales (Etapa 23) */}
      {!esLineaOArco && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Texto dentro del nodo">
          <input
            type="text"
            className="nt-campo"
            placeholder="Texto del nodo..."
            value={estilo.texto || ''}
            onChange={(e) => cambiar({ texto: e.target.value })}
            style={{ fontSize: '11px', padding: '2px 6px', width: '120px', borderRadius: '4px' }}
          />
        </div>
      )}

      {/* Botón para crear nodo hijo en mapa conceptual (Etapa 23) */}
      {!esLineaOArco && estilo.seleccionadas === 1 && (
        <button
          type="button"
          className="nt-btn-sm"
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid #93c5fd',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Crear nodo hijo conectado automáticamente con flecha (Mapa conceptual)"
          onClick={() => motorRef.current?.ramificarSeleccion('derecha', 'Concepto')}
        >
          Rama hijo
        </button>
      )}

      {/* Enlazar figura a otra nota de la biblioteca (Etapa 23) */}
      <button
        type="button"
        className="nt-btn-sm"
        style={{
          fontSize: '11px',
          padding: '3px 8px',
          borderRadius: '6px',
          border: estilo.enlace ? '1px solid #86efac' : '1px solid #cbd5e1',
          background: estilo.enlace ? '#f0fdf4' : '#ffffff',
          color: estilo.enlace ? '#16a34a' : '#475569',
          fontWeight: estilo.enlace ? 600 : 400,
          cursor: 'pointer',
        }}
        title={estilo.enlace ? `Enlace a: ${estilo.enlace.titulo || 'nota'}` : 'Enlazar esta figura a otra nota'}
        onClick={() => setModalElegirNota(true)}
      >
        {estilo.enlace ? 'Enlazada' : 'Enlazar nota'}
      </button>

      {estilo.enlace && (
        <button
          type="button"
          className="nt-btn-sm"
          style={{ fontSize: '11px', padding: '3px 6px', color: '#ef4444', border: '1px solid #fecaca', background: '#fff' }}
          title="Quitar enlace"
          onClick={() => cambiar({ enlace: null })}
        >
          Cerrar
        </button>
      )}

      {/* Botón para abrir / plegar propiedades avanzadas: estilo de borde, esquinas, sombra y opacidad */}
      <button
        type="button"
        className={`nt-btn-sm ${mostrarAvanzado ? 'nt-btn-sm--on' : ''}`}
        style={{
          fontSize: '11px',
          padding: '3px 8px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          background: mostrarAvanzado ? '#e0f2fe' : '#ffffff',
          color: mostrarAvanzado ? '#0369a1' : '#475569',
          cursor: 'pointer',
        }}
        onClick={() => setMostrarAvanzado(!mostrarAvanzado)}
        title="Más opciones de estilo: trazo, esquinas redondeadas, sombra y opacidad"
      >
        {mostrarAvanzado ? '− Menos' : '+ Estilos'}
      </button>

      {mostrarAvanzado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
          {/* Estilo de línea */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Trazo:</span>
            <select
              value={estilo.estiloBorde || 'solido'}
              style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              onChange={(e) => cambiar({ estiloBorde: e.target.value })}
            >
              <option value="solido">Sólido</option>
              <option value="guiones">Guiones</option>
              <option value="puntos">Puntos</option>
            </select>
          </div>

          {/* Esquinas redondeadas (en rectángulos) */}
          {esRect && (
            <label className="nt-rango" style={{ fontSize: '11px' }} title="Radio de esquinas redondeadas">
              Esquinas
              <input
                type="range"
                min="0"
                max="60"
                value={estilo.radioEsquinas || 0}
                onChange={(e) => cambiar({ radioEsquinas: +e.target.value })}
              />
            </label>
          )}

          {/* Opacidad */}
          <label className="nt-rango" style={{ fontSize: '11px' }} title="Opacidad del elemento">
            Opacidad
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round((estilo.opacidad !== undefined ? estilo.opacidad : 1) * 100)}
              onChange={(e) => cambiar({ opacidad: +e.target.value / 100 })}
            />
          </label>

          {/* Sombra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!sombra.activa}
                onChange={(e) => cambiar({ sombra: { ...sombra, activa: e.target.checked } })}
              />
              Sombra
            </label>
            {sombra.activa && (
              <label className="nt-rango" style={{ fontSize: '11px' }} title="Desenfoque de la sombra">
                Difuminado
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={sombra.desenfoque || 8}
                  onChange={(e) => cambiar({ sombra: { ...sombra, desenfoque: +e.target.value } })}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {modalElegirNota && (
        <ModalSeleccionarNota
          alSeleccionar={(notaDestino) => {
            setModalElegirNota(false);
            cambiar({
              enlace: {
                tipo: 'nota',
                notaId: notaDestino.id,
                titulo: notaDestino.titulo,
              },
            });
          }}
          alCerrar={() => setModalElegirNota(false)}
        />
      )}
    </div>
  );
}
