// Modal para gestionar (renombrar y eliminar) plantillas propias del usuario (Etapa 21C).
import { useState, useEffect } from 'react';
import { Modal } from './Modal.jsx';
import { listarPlantillasPropias, renombrarPlantillaPropia, eliminarPlantillaPropia } from '../plantillas/index.js';

export default function ModalGestionPlantillas({ alCerrar, alCambiar }) {
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      const lista = await listarPlantillasPropias();
      setPlantillas(lista);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardarRenombrado(id) {
    if (!nuevoNombre.trim()) return;
    try {
      await renombrarPlantillaPropia(id, nuevoNombre.trim());
      setEditandoId(null);
      await cargar();
      alCambiar?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmarEliminar(id) {
    try {
      await eliminarPlantillaPropia(id);
      setEliminandoId(null);
      await cargar();
      alCambiar?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal titulo="Gestión de plantillas propias" alCerrar={alCerrar} ancho={600}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <p className="nt-texto-suave" style={{ margin: 0, fontSize: '13.5px' }}>
          Consulte, modifique el nombre o elimine las plantillas que ha guardado a partir de sus notas.
        </p>

        {error && <p className="nt-aviso" role="alert" style={{ margin: 0 }}>{error}</p>}

        {cargando ? (
          <p className="nt-texto-suave">Cargando plantillas…</p>
        ) : plantillas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <span />
            <strong style={{ fontSize: '15px', color: '#1e293b', display: 'block' }}>Aún no ha guardado plantillas propias</strong>
            <p className="nt-texto-suave" style={{ fontSize: '13px', margin: '6px 0 0' }}>
              Puede guardar cualquier nota como plantilla propia abriendo el menú de opciones del editor y seleccionando <em>«Guardar como plantilla»</em>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px', maxHeight: '50vh', overflowY: 'auto' }}>
            {plantillas.map((p) => {
              const estaEditando = editandoId === p.id;
              const estaEliminando = eliminandoId === p.id;

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--nt-linea)',
                    background: '#ffffff',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <span />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {estaEditando ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            className="nt-campo"
                            style={{ height: '32px', fontSize: '14px', flex: 1 }}
                            value={nuevoNombre}
                            onChange={(e) => setNuevoNombre(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') guardarRenombrado(p.id);
                              if (e.key === 'Escape') setEditandoId(null);
                            }}
                          />
                          <button type="button" className="nt-btn nt-btn--primario" style={{ height: '32px', padding: '0 10px', fontSize: '12px' }} onClick={() => guardarRenombrado(p.id)}>
                            Guardar
                          </button>
                          <button type="button" className="nt-btn" style={{ height: '32px', padding: '0 8px', fontSize: '12px' }} onClick={() => setEditandoId(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '14.5px', color: '#1e293b' }}>{p.nombre}</strong>
                            <span className="nt-etiqueta" style={{ fontSize: '11px', padding: '1px 8px' }}>
                              {p.formato === 'paginas' ? 'Páginas' : p.formato === 'tarjetas' ? 'Tarjetas' : 'Pizarrón'}
                            </span>
                          </div>
                          {p.descripcion && (
                            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.descripcion}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!estaEditando && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {estaEliminando ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#b91c1c' }}>¿Eliminar?</span>
                          <button
                            type="button"
                            className="nt-btn nt-btn--peligro"
                            style={{ height: '30px', padding: '0 8px', fontSize: '12px' }}
                            onClick={() => confirmarEliminar(p.id)}
                          >
                            Sí, borrar
                          </button>
                          <button
                            type="button"
                            className="nt-btn"
                            style={{ height: '30px', padding: '0 8px', fontSize: '12px' }}
                            onClick={() => setEliminandoId(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="nt-btn"
                            style={{ height: '32px', padding: '0 10px', fontSize: '12.5px' }}
                            onClick={() => {
                              setEditandoId(p.id);
                              setNuevoNombre(p.nombre);
                            }}
                            title="Renombrar plantilla"
                          >
                            Renombrar
                          </button>
                          <button
                            type="button"
                            className="nt-btn"
                            style={{ height: '32px', padding: '0 8px', fontSize: '12.5px', color: '#b91c1c' }}
                            onClick={() => setEliminandoId(p.id)}
                            title="Eliminar plantilla"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="nt-acciones">
          <button type="button" className="nt-btn nt-btn--primario" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
