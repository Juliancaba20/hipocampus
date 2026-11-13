// Panel de enlaces entre notas y notas que enlazan aquí (Backlinks).
// Etapa 23: Visualización de referencias cruzadas y estado de enlaces rotos/papelera.

import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { buscarNotasQueEnlazanA, obtenerEnlacesSalientesDocumento } from '../almacen/enlaces.js';
import { NOMBRE_FORMATO, fechaRelativa } from './utiles.js';

export default function ModalEnlacesEntrantes({ doc, elementos = null, alCerrar, alAbrirNota }) {
  const [tab, setTab] = useState('entrantes'); // 'entrantes' | 'salientes'
  const [entrantes, setEntrantes] = useState([]);
  const [salientes, setSalientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [resEntrantes, resSalientes] = await Promise.all([
          buscarNotasQueEnlazanA(doc.id),
          obtenerEnlacesSalientesDocumento(doc.id, elementos),
        ]);
        if (activo) {
          setEntrantes(resEntrantes);
          setSalientes(resSalientes);
          setCargando(false);
        }
      } catch {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [doc.id, elementos]);

  return (
    <Modal titulo="Conexiones y enlaces entre notas" alCerrar={alCerrar} ancho={560}>
      <div style={{ display: 'grid', gap: '14px' }}>
        {/* Selector de pestañas */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`nt-btn-sm ${tab === 'entrantes' ? 'nt-btn-sm--on' : ''}`}
            style={{
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '6px',
              border: tab === 'entrantes' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              background: tab === 'entrantes' ? '#eff6ff' : '#ffffff',
              color: tab === 'entrantes' ? '#1d4ed8' : '#475569',
              cursor: 'pointer',
            }}
            onClick={() => setTab('entrantes')}
          >
            Notas que enlazan aquí ({entrantes.length})
          </button>
          <button
            type="button"
            className={`nt-btn-sm ${tab === 'salientes' ? 'nt-btn-sm--on' : ''}`}
            style={{
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '6px',
              border: tab === 'salientes' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              background: tab === 'salientes' ? '#eff6ff' : '#ffffff',
              color: tab === 'salientes' ? '#1d4ed8' : '#475569',
              cursor: 'pointer',
            }}
            onClick={() => setTab('salientes')}
          >
            Enlaces salientes ({salientes.length})
          </button>
        </div>

        {cargando ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Explorando conexiones entre notas...
          </div>
        ) : tab === 'entrantes' ? (
          <div>
            {entrantes.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontWeight: 500, color: '#334155' }}>
                  Ninguna nota enlaza a este documento todavía.
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Puede enlazar hacia aquí seleccionando un texto o cualquier figura en otra nota e insertando el enlace a <em>«{doc.titulo}»</em>.
                </p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {entrantes.map((item) => (
                  <li
                    key={item.documentoId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.titulo}</strong>
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                          {NOMBRE_FORMATO[item.formato] || item.formato}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                        {item.cantidadEnlaces} {item.cantidadEnlaces === 1 ? 'enlace' : 'enlaces'} · Editado {fechaRelativa(item.modificado)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="nt-btn nt-btn--primario"
                      style={{ fontSize: '12px', padding: '5px 12px', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        alCerrar();
                        alAbrirNota(item.documentoId);
                      }}
                    >
                      Abrir nota
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            {salientes.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontWeight: 500, color: '#334155' }}>
                  Esta nota no contiene enlaces hacia otras notas.
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Seleccione un fragmento de texto o una figura para añadir enlaces cruzados a otras notas de su biblioteca.
                </p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {salientes.map((s, idx) => {
                  const est = s.estadoDestino || {};
                  return (
                    <li
                      key={`${s.notaId}_${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        gap: '12px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {est.doc?.titulo || s.titulo || 'Nota enlazada'}
                          </strong>
                          {est.disponible ? (
                            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                              Disponible
                            </span>
                          ) : est.estado === 'papelera' ? (
                            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 600 }} title="En la papelera. Se reactivará al restaurar.">
                              En papelera
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }} title="La nota destino fue borrada o no existe.">
                              Nota no disponible
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                          {s.tipo === 'texto' ? `Fragmento en texto: «${s.texto || 'enlace'}»` : `Enlace en ${s.tipoElemento || 'elemento'}`}
                        </div>
                      </div>
                      {est.disponible && (
                        <button
                          type="button"
                          className="nt-btn nt-btn--primario"
                          style={{ fontSize: '12px', padding: '5px 12px', whiteSpace: 'nowrap' }}
                          onClick={() => {
                            alCerrar();
                            alAbrirNota(s.notaId);
                          }}
                        >
                          Ir a nota
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Guía informativa de comportamiento con papelera */}
        <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
          <strong>Gestión de enlaces y papelera:</strong> Si una nota enlazada se envía a la papelera, los enlaces se identifican como «En papelera» sin romper el documento. Al restaurarla de la papelera, el enlace se reactiva inmediatamente de forma automática.
        </div>

        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
