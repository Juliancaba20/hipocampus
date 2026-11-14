import { useState } from 'react';
import { EnPortal } from './Modal.jsx';
import { CATALOGO_FUENTES, ESTILOS_PREDETERMINADOS, INTERLINEADOS, obtenerCatalogoEstilos } from '../herramientas/texto/estilo.js';

const COLORES = [
  { val: null, label: 'Automático' },
  { val: '#0f172a', label: 'Negro' },
  { val: '#2563eb', label: 'Azul' },
  { val: '#b91c1c', label: 'Rojo' },
  { val: '#15803d', label: 'Verde' },
  { val: '#b45309', label: 'Ámbar' },
  { val: '#7e22ce', label: 'Púrpura' },
  { val: '#475569', label: 'Gris' },
];

const FONDOS = [
  { val: null, label: 'Sin fondo' },
  { val: '#f1f5f9', label: 'Gris claro' },
  { val: '#eff6ff', label: 'Azul pastel' },
  { val: '#fef2f2', label: 'Rojo pastel' },
  { val: '#f0fdf4', label: 'Verde pastel' },
  { val: '#fefce8', label: 'Amarillo pastel' },
];

export default function ModalEstilos({ estilosActuales, alGuardar, alCerrar }) {
  const [catalogo, setCatalogo] = useState(() => ({
    ...obtenerCatalogoEstilos(estilosActuales),
  }));
  const [estiloSeleccionado, setEstiloSeleccionado] = useState('titulo');
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const est = catalogo[estiloSeleccionado] || catalogo.normal || ESTILOS_PREDETERMINADOS.normal;

  const actualizarActual = (parche) => {
    setCatalogo((prev) => ({
      ...prev,
      [estiloSeleccionado]: {
        ...prev[estiloSeleccionado],
        ...parche,
      },
    }));
  };

  const handleCrearNuevo = (e) => {
    e.preventDefault();
    const id = 'estilo_' + Date.now().toString(36);
    const nombre = nombreNuevo.trim() || 'Mi estilo';
    const nuevo = {
      ...ESTILOS_PREDETERMINADOS.normal,
      id,
      nombre,
      personalizado: true,
    };
    setCatalogo((prev) => ({ ...prev, [id]: nuevo }));
    setEstiloSeleccionado(id);
    setNombreNuevo('');
    setCreandoNuevo(false);
  };

  const handleRestablecer = () => {
    if (ESTILOS_PREDETERMINADOS[estiloSeleccionado]) {
      setCatalogo((prev) => ({
        ...prev,
        [estiloSeleccionado]: { ...ESTILOS_PREDETERMINADOS[estiloSeleccionado] },
      }));
    } else {
      // Eliminar estilo personalizado
      setCatalogo((prev) => {
        const copia = { ...prev };
        delete copia[estiloSeleccionado];
        return copia;
      });
      setEstiloSeleccionado('normal');
    }
  };

  const guardar = () => {
    alGuardar(catalogo);
    alCerrar();
  };

  return (
    <EnPortal>
    <div className="nt-modal-backdrop" onClick={alCerrar}>
      <div
        className="nt-modal nt-modal--ancho"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-estilos"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        <div className="nt-modal__cab">
          <h2 id="titulo-estilos" className="nt-modal__titulo">
            Estilos de párrafo
          </h2>
          <button type="button" className="nt-ib nt-ib--texto" onClick={alCerrar} title="Cerrar">Cerrar</button>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
          Personalice los estilos del documento. Al modificar un estilo, todos los párrafos que lo usen se actualizarán automáticamente.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px', minHeight: '340px' }}>
          {/* Lista de estilos */}
          <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estilos disponibles
            </span>
            {Object.values(catalogo).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nt-btn nt-btn--menu ${estiloSeleccionado === item.id ? 'nt-btn--activo' : ''}`}
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: estiloSeleccionado === item.id ? '#eff6ff' : 'transparent',
                  color: estiloSeleccionado === item.id ? '#1d4ed8' : '#334155',
                  fontWeight: estiloSeleccionado === item.id ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setEstiloSeleccionado(item.id)}
              >
                <span>{item.nombre}</span>
                {item.personalizado && <span style={{ fontSize: '10px', color: '#94a3b8' }}>propio</span>}
              </button>
            ))}

            {!creandoNuevo ? (
              <button
                type="button"
                className="nt-btn nt-btn--secundario"
                style={{ marginTop: 'auto', fontSize: '12px' }}
                onClick={() => setCreandoNuevo(true)}
              >
                + Crear estilo
              </button>
            ) : (
              <form onSubmit={handleCrearNuevo} style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Nombre..."
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  autoFocus
                  style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="submit" className="nt-btn nt-btn--primario" style={{ fontSize: '11px', flex: 1 }}>Crear</button>
                  <button type="button" className="nt-btn nt-btn--secundario" style={{ fontSize: '11px' }} onClick={() => setCreandoNuevo(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>

          {/* Editor del estilo seleccionado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Nombre:</label>
              <input
                type="text"
                value={est.nombre}
                onChange={(e) => actualizarActual({ nombre: e.target.value })}
                disabled={!est.personalizado && est.id === 'normal'}
                style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Fuente:</label>
              <select
                value={est.fuente || 'serif'}
                onChange={(e) => actualizarActual({ fuente: e.target.value })}
                style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                {Object.values(CATALOGO_FUENTES).map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Escala:</label>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.05"
                value={est.factor || 1}
                onChange={(e) => actualizarActual({ factor: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '45px' }}>
                {(est.factor || 1).toFixed(2)}×
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Formato:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`nt-bt ${est.negrita ? 'nt-bt--on' : ''}`}
                  onClick={() => actualizarActual({ negrita: !est.negrita })}
                  title="Negrita"
                >
                  <b>N</b>
                </button>
                <button
                  type="button"
                  className={`nt-bt ${est.cursiva ? 'nt-bt--on' : ''}`}
                  onClick={() => actualizarActual({ cursiva: !est.cursiva })}
                  title="Cursiva"
                >
                  <i>C</i>
                </button>
              </div>

              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginLeft: '12px' }}>Alineación:</label>
              <select
                value={est.alinear || 'izquierda'}
                onChange={(e) => actualizarActual({ alinear: e.target.value })}
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                <option value="izquierda">Izquierda</option>
                <option value="centro">Centro</option>
                <option value="derecha">Derecha</option>
                <option value="justificado">Justificado</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Interlineado:</label>
              <select
                value={String(est.interlineado || 1.4)}
                onChange={(e) => actualizarActual({ interlineado: parseFloat(e.target.value) })}
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                {INTERLINEADOS.map((val) => (
                  <option key={val} value={String(val)}>{val}×</option>
                ))}
              </select>

              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginLeft: '12px' }}>Sangría:</label>
              <select
                value={String(est.sangria || 0)}
                onChange={(e) => actualizarActual({ sangria: parseInt(e.target.value, 10) })}
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                <option value="0">0 niveles</option>
                <option value="1">1 nivel</option>
                <option value="2">2 niveles</option>
                <option value="3">3 niveles</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Color texto:</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COLORES.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className="nt-color nt-color--chico"
                    style={{
                      background: c.val || '#ffffff',
                      border: est.color === c.val ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    }}
                    title={c.label}
                    onClick={() => actualizarActual({ color: c.val })}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '70px' }}>Fondo:</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {FONDOS.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    className="nt-color nt-color--chico"
                    style={{
                      background: f.val || '#ffffff',
                      border: est.resaltado === f.val ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    }}
                    title={f.label}
                    onClick={() => actualizarActual({ resaltado: f.val })}
                  />
                ))}
              </div>
            </div>

            {/* Vista previa en vivo */}
            <div style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Vista previa
              </span>
              <div
                style={{
                  marginTop: '4px',
                  padding: '12px 16px',
                  background: est.resaltado || '#ffffff',
                  color: est.color || '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontFamily: CATALOGO_FUENTES[est.fuente]?.familia || 'serif',
                  fontSize: `${Math.round(18 * (est.factor || 1))}px`,
                  fontWeight: est.negrita ? '700' : '400',
                  fontStyle: est.cursiva ? 'italic' : 'normal',
                  textAlign: est.alinear || 'izquierda',
                  lineHeight: est.interlineado || 1.4,
                  marginLeft: `${(est.sangria || 0) * 16}px`,
                }}
              >
                {est.nombre}: El veloz murciélago hindú comía feliz cardillo y kiwi. 1234567890.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
              <button
                type="button"
                className="nt-btn nt-btn--secundario"
                style={{ fontSize: '12px', color: '#b91c1c' }}
                onClick={handleRestablecer}
              >
                {est.personalizado ? 'Eliminar este estilo' : 'Restablecer valores predeterminados'}
              </button>
            </div>
          </div>
        </div>

        <div className="nt-modal__pie" style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="nt-btn nt-btn--secundario" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="button" className="nt-btn nt-btn--primario" onClick={guardar}>
            Aplicar y guardar cambios
          </button>
        </div>
      </div>
    </div>
    </EnPortal>
  );
}
