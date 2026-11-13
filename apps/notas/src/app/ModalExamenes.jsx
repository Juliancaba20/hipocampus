// Modal de Calendario de exámenes simple y cuenta regresiva (Etapa 23).
// Permite programar fechas de examen por materia y ver los días restantes.
// Aviso: Recordatorio exclusivamente local dentro de la aplicación.

import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import {
  listarExamenes,
  guardarExamen,
  eliminarExamen,
  alternarCompletadoExamen,
  calcularCuentaRegresivaExamen,
  formatearFechaExamen,
} from '../almacen/examenes.js';

export default function ModalExamenes({ carpetas = [], alCerrar, alCambio }) {
  const [examenes, setExamenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);

  // Campos del formulario
  const [materia, setMateria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const cargar = async () => {
    try {
      const lista = await listarExamenes();
      setExamenes(lista);
      setCargando(false);
    } catch {
      setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    listarExamenes().then((lista) => {
      if (activo) {
        setExamenes(lista);
        setCargando(false);
      }
    }).catch(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, []);

  const resetForm = () => {
    setEditando(null);
    setMateria('');
    setTitulo('');
    setFecha('');
    setHora('');
    setDescripcion('');
    setMostrarForm(false);
  };

  const iniciarEdicion = (ex) => {
    setEditando(ex);
    setMateria(ex.materia || '');
    setTitulo(ex.titulo || '');
    setFecha(ex.fecha || '');
    setHora(ex.hora || '');
    setDescripcion(ex.descripcion || '');
    setMostrarForm(true);
  };

  const enviarForm = async (e) => {
    e.preventDefault();
    if (!fecha || !titulo.trim()) return;

    await guardarExamen({
      id: editando?.id,
      materia: materia.trim(),
      titulo: titulo.trim(),
      fecha,
      hora: hora || '',
      descripcion: descripcion.trim(),
      completado: editando?.completado || false,
    });

    resetForm();
    await cargar();
    alCambio?.();
  };

  const borrar = async (id) => {
    await eliminarExamen(id);
    await cargar();
    alCambio?.();
  };

  const toggleCompletado = async (id) => {
    await alternarCompletadoExamen(id);
    await cargar();
    alCambio?.();
  };

  return (
    <Modal titulo="Calendario de exámenes y evaluaciones" alCerrar={alCerrar} ancho={560}>
      <div style={{ display: 'grid', gap: '14px' }}>
        {/* Encabezado con botón de agregar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {examenes.length} {examenes.length === 1 ? 'examen registrado' : 'exámenes registrados'}
          </span>
          {!mostrarForm && (
            <button
              type="button"
              className="nt-btn nt-btn--primario"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={() => { resetForm(); setMostrarForm(true); }}
            >
              + Nuevo examen
            </button>
          )}
        </div>

        {/* Formulario de creación / edición */}
        {mostrarForm && (
          <form
            onSubmit={enviarForm}
            style={{
              display: 'grid',
              gap: '10px',
              padding: '12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          >
            <strong style={{ fontSize: '13px', color: '#1e293b' }}>
              {editando ? 'Editar examen' : 'Registrar nueva fecha de examen'}
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Materia / Cuaderno:
                {carpetas.length > 0 ? (
                  <input
                    className="nt-campo nt-ancho"
                    list="lista-materias-examenes"
                    placeholder="Ej. Anatomía I..."
                    value={materia}
                    onChange={(e) => setMateria(e.target.value)}
                    style={{ marginTop: '2px', fontSize: '12px' }}
                  />
                ) : (
                  <input
                    className="nt-campo nt-ancho"
                    placeholder="Ej. Fisiología..."
                    value={materia}
                    onChange={(e) => setMateria(e.target.value)}
                    style={{ marginTop: '2px', fontSize: '12px' }}
                  />
                )}
                <datalist id="lista-materias-examenes">
                  {carpetas.map((c) => (
                    <option key={c.id} value={c.nombre} />
                  ))}
                </datalist>
              </label>

              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Título / Instancia:
                <input
                  className="nt-campo nt-ancho"
                  placeholder="Ej. Primer Parcial, Final..."
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                  style={{ marginTop: '2px', fontSize: '12px' }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Fecha del examen:
                <input
                  type="date"
                  className="nt-campo nt-ancho"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  style={{ marginTop: '2px', fontSize: '12px' }}
                />
              </label>

              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Hora (opcional):
                <input
                  type="time"
                  className="nt-campo nt-ancho"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  style={{ marginTop: '2px', fontSize: '12px' }}
                />
              </label>
            </div>

            <label style={{ fontSize: '12px', fontWeight: 600 }}>
              Temas a evaluar / Notas:
              <input
                className="nt-campo nt-ancho"
                placeholder="Ej. Unidades 1 a 4, sistema muscular..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                style={{ marginTop: '2px', fontSize: '12px' }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button type="button" className="nt-btn" style={{ fontSize: '12px' }} onClick={resetForm}>
                Cancelar
              </button>
              <button type="submit" className="nt-btn nt-btn--primario" style={{ fontSize: '12px' }}>
                {editando ? 'Guardar cambios' : 'Registrar examen'}
              </button>
            </div>
          </form>
        )}

        {/* Listado de exámenes */}
        {cargando ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Cargando calendario...
          </div>
        ) : examenes.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontWeight: 500, color: '#334155' }}>
              No hay exámenes agendados.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
              Presione «+ Nuevo examen» para registrar fechas importantes y visualizar la cuenta regresiva en su biblioteca.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
            {examenes.map((ex) => {
              const cuenta = calcularCuentaRegresivaExamen(ex.fecha);
              return (
                <li
                  key={ex.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: ex.completado ? '#f8fafc' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    opacity: ex.completado ? 0.75 : 1,
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={ex.completado}
                      onChange={() => toggleCompletado(ex.id)}
                      title={ex.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Lo importante primero: materia y fecha */}
                      <div className="nt-examen__principal">
                        <strong className="nt-examen__materia" style={{ textDecoration: ex.completado ? 'line-through' : 'none' }}>
                          {ex.materia || ex.titulo}
                        </strong>
                        <span className="nt-examen__fecha">{formatearFechaExamen(ex.fecha)}{ex.hora ? ` · ${ex.hora} hs` : ''}</span>
                      </div>
                      <div className="nt-examen__detalle">
                        {ex.materia ? ex.titulo : ''}
                        {ex.descripcion ? `${ex.materia ? ' · ' : ''}${ex.descripcion}` : ''}
                      </div>
                    </div>
                    <span
                      className="nt-examen__cuenta"
                      style={{
                        background: ex.completado ? '#f1f5f9' : cuenta.urgente ? '#fee2e2' : '#fef3c7',
                        color: ex.completado ? '#64748b' : cuenta.urgente ? '#b91c1c' : '#b45309',
                      }}
                    >
                      {ex.completado ? 'Completado' : cuenta.texto}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="nt-btn-sm"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => iniciarEdicion(ex)}
                      title="Editar examen"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="nt-btn-sm"
                      style={{ fontSize: '11px', padding: '2px 6px', color: '#ef4444' }}
                      onClick={() => borrar(ex.id)}
                      title="Eliminar examen"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Declaración de privacidad y límite local documentado */}
        <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
          <strong>Recordatorio local:</strong> Este calendario se gestiona exclusivamente en su navegador o dispositivo. No se envían notificaciones push externas ni se ejecutan procesos en segundo plano fuera de la app.
        </div>

        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
