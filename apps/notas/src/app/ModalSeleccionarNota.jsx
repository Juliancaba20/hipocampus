// Selector con buscador para enlazar a otra nota de la biblioteca.
// Etapa 23: Enlaces entre notas desde texto o elementos.

import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal.jsx';
import { listarDocumentos } from '../almacen/documentos.js';
import { NOMBRE_FORMATO, normalizar } from './utiles.js';

export default function ModalSeleccionarNota({
  titulo = 'Enlazar a otra nota',
  docActualId = null,
  alSeleccionar,
  alCerrar,
}) {
  const [documentos, setDocumentos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    listarDocumentos({ papelera: false, orden: 'nombre' })
      .then((docs) => {
        if (activo) {
          setDocumentos(docs.filter((d) => d.id !== docActualId && !d._danado));
          setCargando(false);
        }
      })
      .catch(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [docActualId]);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return documentos;
    return documentos.filter((d) => normalizar(d.titulo || '').includes(q));
  }, [documentos, busqueda]);

  return (
    <Modal titulo={titulo} alCerrar={alCerrar} ancho={480}>
      <div style={{ display: 'grid', gap: '12px' }}>
        <input
          type="search"
          className="nt-campo nt-ancho"
          placeholder="Buscar nota por título..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoFocus
          aria-label="Buscar nota para enlazar"
        />

        {cargando ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            Cargando notas disponibles...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
            {busqueda ? 'No se encontraron notas con ese título.' : 'No hay otras notas disponibles en la biblioteca.'}
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
            {filtrados.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                  onClick={() => alSeleccionar(doc)}
                >
                  <strong style={{ fontSize: '13px', color: '#1e293b', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.titulo || 'Sin título'}
                  </strong>
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', flexShrink: 0 }}>
                    {NOMBRE_FORMATO[doc.formato] || doc.formato}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}
