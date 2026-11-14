import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Miniatura } from './SelectorFormato.jsx';
import { NOMBRE_FORMATO, fechaRelativa } from './utiles.js';
import { buscarEnIndice, reconstruirIndice } from '../almacen/busqueda.js';
import { obtenerDocumento } from '../almacen/documentos.js';

export default function ModalBusquedaGlobal({ alCerrar, alAbrirDocumento, carpetasMap }) {
  const [consulta, setConsulta] = useState('');
  const [incluirPapelera, setIncluirPapelera] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [totalCoincidencias, setTotalCoincidencias] = useState(0);
  const [tiempoMs, setTiempoMs] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [progresoReconstruccion, setProgresoReconstruccion] = useState(null);
  const [mensajeExito, setMensajeExito] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Búsqueda en tiempo real
  useEffect(() => {
    let activo = true;
    const q = consulta.trim();
    if (!q) {
      return;
    }

    Promise.resolve().then(() => {
      if (activo) setBuscando(true);
    });
    buscarEnIndice(q, { incluirPapelera })
      .then((res) => {
        if (!activo) return;
        setResultados(res.resultados || []);
        setTotalCoincidencias(res.totalCoincidencias || 0);
        setTiempoMs(res.tiempoMs || 0);
      })
      .catch(() => {
        if (!activo) return;
        setResultados([]);
      })
      .finally(() => {
        if (activo) setBuscando(false);
      });

    return () => {
      activo = false;
    };
  }, [consulta, incluirPapelera]);

  async function ejecutarReconstruir() {
    if (progresoReconstruccion) return;
    setMensajeExito('');
    try {
      const res = await reconstruirIndice((prog) => {
        setProgresoReconstruccion(prog);
      });
      setProgresoReconstruccion(null);
      setMensajeExito(`Índice reconstruido: ${res.total} nota${res.total === 1 ? '' : 's'} indexada${res.total === 1 ? '' : 's'}.`);
      // Refrescar la búsqueda si hay consulta
      if (consulta.trim()) {
        const busc = await buscarEnIndice(consulta.trim(), { incluirPapelera });
        setResultados(busc.resultados || []);
        setTotalCoincidencias(busc.totalCoincidencias || 0);
        setTiempoMs(busc.tiempoMs || 0);
      }
    } catch (e) {
      setProgresoReconstruccion(null);
      setMensajeExito('Error al reconstruir el índice: ' + e.message);
    }
  }

  async function seleccionarCoincidencia(resDoc, coincidencia) {
    try {
      const docCompleto = await obtenerDocumento(resDoc.documentoId);
      if (!docCompleto) return;
      alAbrirDocumento(docCompleto, {
        ubicacion: coincidencia.ubicacion,
        elementoId: coincidencia.elementoId,
        tipo: coincidencia.tipo,
      });
      alCerrar();
    } catch {
      /* si falla la carga directa */
    }
  }

  function etiquetaTipo(tipo, subtipo, fila, columna) {
    if (tipo === 'titulo') return 'Título';
    if (tipo === 'materia') return 'Materia';
    if (tipo === 'etiqueta') return 'Etiqueta';
    if (tipo === 'tabla') return `Celda fila ${fila}, col. ${columna}`;
    if (subtipo === 'titulo1' || subtipo === 'titulo2' || subtipo === 'titulo3') return 'Encabezado';
    if (subtipo === 'vineta' || subtipo === 'numero') return 'Lista';
    return 'Párrafo';
  }

  function etiquetaUbicacion(formato, ubicacion) {
    if (!ubicacion) return null;
    if (formato === 'paginas' && ubicacion.contenedor) {
      return `Página ${ubicacion.contenedor}`;
    }
    if (formato === 'tarjetas' && ubicacion.contenedor) {
      return 'Ficha de tarjeta';
    }
    if (formato === 'pizarron' && ubicacion.x !== undefined) {
      return `Pizarrón (${Math.round(ubicacion.x)}, ${Math.round(ubicacion.y)})`;
    }
    return null;
  }

  return (
    <Modal titulo="Búsqueda global de notas" alCerrar={alCerrar} ancho={720}>
      <div style={{ display: 'grid', gap: '14px' }}>
        {/* Campo de búsqueda principal */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="search"
            className="nt-campo nt-ancho"
            style={{ fontSize: '15px', padding: '10px 12px' }}
            placeholder="Buscar en títulos, párrafos, tablas, materias y etiquetas..."
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              if (!e.target.value.trim()) {
                setResultados([]);
                setTotalCoincidencias(0);
                setTiempoMs(0);
              }
            }}
            aria-label="Buscar notas"
          />
          {consulta && (
            <button
              type="button"
              className="nt-btn nt-btn--sm"
              style={{ position: 'absolute', right: '8px', padding: '4px 8px' }}
              onClick={() => {
                setConsulta('');
                setResultados([]);
                setTotalCoincidencias(0);
                setTiempoMs(0);
                inputRef.current?.focus();
              }}
              title="Borrar texto"
            >
              Cerrar
            </button>
          )}
        </div>

        {/* Barra de opciones y herramientas */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '13px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={incluirPapelera}
              onChange={(e) => setIncluirPapelera(e.target.checked)}
            />
            <span>Incluir notas de la papelera</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {progresoReconstruccion ? (
              <span className="nt-texto-suave">
                Indexando {progresoReconstruccion.procesados} de {progresoReconstruccion.total}...
              </span>
            ) : (
              <button
                type="button"
                className="nt-enlace"
                style={{ fontSize: '12px' }}
                onClick={ejecutarReconstruir}
                title="Vuelve a analizar todos los documentos y elementos para actualizar el índice"
              >
                Reconstruir índice
              </button>
            )}
          </div>
        </div>

        {/* Barra de progreso de reconstrucción */}
        {progresoReconstruccion && (
          <div style={{ background: 'var(--nt-fondo-barra, #f1f3f5)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--nt-borde, #dee2e6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <strong>Reconstruyendo índice de búsqueda...</strong>
              <span>{progresoReconstruccion.porcentaje}% ({progresoReconstruccion.procesados} de {progresoReconstruccion.total})</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--nt-borde, #ced4da)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progresoReconstruccion.porcentaje}%`,
                  height: '100%',
                  background: 'var(--nt-primario, #2350d8)',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
            {progresoReconstruccion.docActual && (
              <div style={{ fontSize: '11px', color: 'var(--nt-suave, #6c757d)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Procesando: {progresoReconstruccion.docActual}
              </div>
            )}
          </div>
        )}

        {mensajeExito && (
          <div style={{ fontSize: '13px', color: '#1f9d55', padding: '6px 0' }}>
            {mensajeExito}
          </div>
        )}

        {/* Resumen de resultados */}
        {consulta.trim() && !progresoReconstruccion && (
          <div style={{ fontSize: '12px', color: 'var(--nt-suave)', display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {buscando ? 'Buscando…' : `${totalCoincidencias} coincidencia${totalCoincidencias === 1 ? '' : 's'} en ${resultados.length} nota${resultados.length === 1 ? '' : 's'}`}
            </span>
            {tiempoMs > 0 && <span>({tiempoMs} ms)</span>}
          </div>
        )}

        {/* Lista de resultados */}
        <div
          style={{
            maxHeight: '380px',
            overflowY: 'auto',
            border: '1px solid var(--nt-borde, #dee2e6)',
            borderRadius: '6px',
            background: 'var(--nt-fondo, #ffffff)',
          }}
        >
          {consulta.trim() === '' ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--nt-suave)' }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 600, fontSize: '14px' }}>
                Búsqueda en todos los documentos
              </p>
              <p style={{ margin: 0, fontSize: '13px' }}>
                Escriba términos para buscar dentro de títulos, bloques de texto, tablas, materias o etiquetas.
              </p>
            </div>
          ) : resultados.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--nt-suave)' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '14px' }}>
                No se encontraron notas con <strong>«{consulta}»</strong>.
              </p>
              {!incluirPapelera && (
                <p style={{ margin: 0, fontSize: '12px' }}>
                  Pruebe activar la opción de <em>«Incluir notas de la papelera»</em> si el contenido fue eliminado recientemente.
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', divideY: '1px solid var(--nt-borde)' }}>
              {resultados.map((resDoc) => {
                const carpeta = resDoc.carpetaId && carpetasMap ? carpetasMap.get(resDoc.carpetaId) : null;
                return (
                  <div
                    key={resDoc.documentoId}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--nt-borde, #e9ecef)',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {/* Encabezado del documento */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Miniatura formato={resDoc.formato} />
                      <strong style={{ fontSize: '14px' }}>{resDoc.titulo}</strong>
                      <span className="nt-badge" style={{ fontSize: '11px' }}>
                        {NOMBRE_FORMATO[resDoc.formato]}
                      </span>
                      {carpeta && (
                        <span
                          className="nt-badge-carpeta"
                          style={{
                            background: `${carpeta.color}15`,
                            color: carpeta.color,
                            border: `1px solid ${carpeta.color}35`,
                            fontSize: '11px',
                            padding: '2px 6px',
                          }}
                        >
                          <span className="nt-badge-carpeta__punto" style={{ background: carpeta.color }} />
                          {carpeta.nombre}
                        </span>
                      )}
                      {resDoc.enPapelera && (
                        <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Papelera
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--nt-suave)', marginLeft: 'auto' }}>
                        {fechaRelativa(resDoc.modificado)}
                      </span>
                    </div>

                    {/* Coincidencias dentro del documento */}
                    <div style={{ display: 'grid', gap: '6px', paddingLeft: '8px' }}>
                      {resDoc.coincidencias.map((c) => {
                        const ubicacionTxt = etiquetaUbicacion(resDoc.formato, c.ubicacion);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="nt-resultado-item"
                            onClick={() => seleccionarCoincidencia(resDoc, c)}
                            style={{
                              textAlign: 'left',
                              background: 'var(--nt-fondo-hover, #f8f9fa)',
                              border: '1px solid var(--nt-borde, #e9ecef)',
                              borderRadius: '5px',
                              padding: '8px 10px',
                              cursor: 'pointer',
                              display: 'grid',
                              gap: '4px',
                              width: '100%',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--nt-primario, #2350d8)' }}>
                                {etiquetaTipo(c.tipo, c.subtipo, c.fila, c.columna)}
                              </span>
                              {ubicacionTxt && (
                                <span style={{ color: 'var(--nt-suave)' }}>
                                  · {ubicacionTxt}
                                </span>
                              )}
                              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--nt-suave)' }}>
                                Abrir en el lugar exacto
                              </span>
                            </div>

                            {/* Fragmento de contexto con términos resaltados */}
                            <div style={{ fontSize: '13px', lineHeight: 1.4, color: 'var(--nt-texto, #212529)' }}>
                              {Array.isArray(c.partes) ? (
                                c.partes.map((p, idx) => (
                                  p.coincide ? (
                                    <mark
                                      key={idx}
                                      style={{
                                        background: '#ffec99',
                                        color: '#000',
                                        padding: '1px 3px',
                                        borderRadius: '3px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {p.texto}
                                    </mark>
                                  ) : (
                                    <span key={idx}>{p.texto}</span>
                                  )
                                ))
                              ) : (
                                c.fragmento
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acciones del pie */}
        <div className="nt-acciones" style={{ marginTop: '4px' }}>
          <button type="button" className="nt-btn" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
