// Modal para guardar el documento actual como plantilla personalizada (Etapa 21C).
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { guardarPlantillaPropia } from '../plantillas/index.js';


export default function ModalGuardarPlantilla({ doc, elementos, alCerrar, alGuardado }) {
  const [nombre, setNombre] = useState(doc.titulo || 'Mi plantilla');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Por favor, introduzca un nombre para la plantilla.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const nueva = await guardarPlantillaPropia({
        nombre,
        descripcion,
        doc,
        elementos,
        icono: '',
      });
      setExito(true);
      setTimeout(() => {
        alGuardado?.(nueva);
        alCerrar();
      }, 700);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la plantilla.');
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Guardar como plantilla propia" alCerrar={alCerrar} ancho={520}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
        <p className="nt-texto-suave" style={{ margin: 0, fontSize: '13.5px' }}>
          Guarde la estructura, elementos y configuración de este documento como una plantilla reutilizable para futuras notas.
        </p>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600 }}>
            Nombre de la plantilla
            <input
              className="nt-campo"
              style={{ width: '100%', marginTop: '4px' }}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Ficha de vocabulario, Resumen clínico…"
              autoFocus
              required
            />
          </label>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600 }}>
            Descripción (opcional)
            <textarea
              className="nt-campo"
              style={{ width: '100%', minHeight: '60px', marginTop: '4px', resize: 'vertical' }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Breve indicación de uso o materia recomendada…"
              rows={2}
            />
          </label>
        </div>


        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
          Formato: <strong>{doc.formato === 'paginas' ? 'Páginas A4' : doc.formato === 'tarjetas' ? 'Tarjetas' : 'Pizarrón'}</strong> · Elementos incluidos: <strong>{elementos?.length || 0}</strong>
        </div>

        {error && <p className="nt-aviso" role="alert" style={{ margin: 0 }}>{error}</p>}
        {exito && <p className="nt-estado--ok" style={{ margin: 0, fontWeight: 600 }}>¡Plantilla guardada con éxito!</p>}

        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="nt-btn nt-btn--primario" disabled={guardando || exito}>
            {guardando ? 'Guardando…' : 'Guardar plantilla'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
