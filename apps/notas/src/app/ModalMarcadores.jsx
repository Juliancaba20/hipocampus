// Modal de Marcadores de ubicación e Índice según el formato del documento (Etapa 23).
// - Pizarrón: Marcadores de ubicación con nombre para saltar la cámara directamente.
// - Páginas A4: Esquema automático de títulos (h1, h2) con salto directo a la página.
// - Tarjetas: Índice completo de tarjetas con acceso rápido tocando una tarjeta.

import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { nuevoId } from '../almacen/modelo.js';
import { extraerTextoPlanoBloques } from '../herramientas/texto/modelo.js';
import { paginaEnY } from '../formatos/paginas.js';

export default function ModalMarcadores({
  formato = 'pizarron',
  doc,
  elementos = [],
  tarjetas = [],
  camaraActual = null,
  alSaltarAMarcador,
  alGuardarMarcadores,
  alSaltarAPagina,
  alSaltarATarjeta,
  alCerrar,
}) {
  // Estado para pizarrón: marcadores
  const marcadores = doc.config?.marcadores || [];
  const [nombreNuevoMarcador, setNombreNuevoMarcador] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEditado, setNombreEditado] = useState('');

  const agregarMarcador = (e) => {
    e.preventDefault();
    const nom = nombreNuevoMarcador.trim() || `Marcador ${marcadores.length + 1}`;
    const z = camaraActual?.zoom || 1;
    const nuevo = {
      id: nuevoId('marcador'),
      nombre: nom,
      x: Math.round(camaraActual?.x || 0),
      y: Math.round(camaraActual?.y || 0),
      zoom: Number(z.toFixed(2)),
      fecha: Date.now(),
    };
    alGuardarMarcadores?.([...marcadores, nuevo]);
    setNombreNuevoMarcador('');
  };

  const eliminarMarcador = (id) => {
    alGuardarMarcadores?.(marcadores.filter((m) => m.id !== id));
  };

  const guardarEdicion = (id) => {
    if (!nombreEditado.trim()) return;
    alGuardarMarcadores?.(
      marcadores.map((m) => (m.id === id ? { ...m, nombre: nombreEditado.trim() } : m))
    );
    setEditandoId(null);
  };

  // Esquema de títulos para Páginas A4
  const esquemaTitulos = () => {
    const titulos = [];
    for (const el of elementos) {
      if (el?.tipo === 'texto' && el.datos?.bloques) {
        const pag = paginaEnY(el.y, doc.config || {});
        for (const b of el.datos.bloques) {
          const estilo = b.estilo || (b.tipo === 'h1' ? 'titulo' : b.tipo === 'h2' ? 'subtitulo' : null);
          if (estilo === 'titulo' || estilo === 'subtitulo' || b.tipo === 'h1' || b.tipo === 'h2') {
            const txt = extraerTextoPlanoBloques([b]).trim();
            if (txt) {
              titulos.push({
                texto: txt,
                nivel: (estilo === 'titulo' || b.tipo === 'h1') ? 1 : 2,
                pagina: pag,
                y: el.y,
              });
            }
          }
        }
      }
    }
    return titulos;
  };

  const titulos = formato === 'paginas' ? esquemaTitulos() : [];

  return (
    <Modal
      titulo={
        formato === 'pizarron'
          ? 'Marcadores de ubicación del pizarrón'
          : formato === 'paginas'
            ? 'Esquema de títulos e índice (A4)'
            : 'Índice de tarjetas del mazo'
      }
      alCerrar={alCerrar}
      ancho={480}
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        {/* Caso 1: Pizarrón con marcadores de ubicación */}
        {formato === 'pizarron' && (
          <>
            <form onSubmit={agregarMarcador} style={{ display: 'flex', gap: '8px' }}>
              <input
                className="nt-campo"
                style={{ flex: 1 }}
                placeholder="Nombre del marcador actual..."
                value={nombreNuevoMarcador}
                onChange={(e) => setNombreNuevoMarcador(e.target.value)}
                aria-label="Nombre del nuevo marcador"
              />
              <button type="submit" className="nt-btn nt-btn--primario" style={{ whiteSpace: 'nowrap' }}>
                + Guardar ubicación
              </button>
            </form>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                Ubicaciones guardadas ({marcadores.length}):
              </span>
              {marcadores.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', margin: '8px 0 0' }}>
                  Aún no hay marcadores guardados. Mueva la vista al sector deseado y presione «Guardar ubicación».
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                  {marcadores.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        gap: '8px',
                      }}
                    >
                      {editandoId === m.id ? (
                        <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                          <input
                            className="nt-campo"
                            style={{ flex: 1, padding: '3px 6px', fontSize: '13px' }}
                            value={nombreEditado}
                            onChange={(e) => setNombreEditado(e.target.value)}
                            onKeyDown={(e) => {
                              // Enter confirma solo la edición: se corta aquí para que no llegue al formulario de «Guardar ubicación».
                              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); guardarEdicion(m.id); }
                              if (e.key === 'Escape') setEditandoId(null);
                            }}
                            aria-label={`Nuevo nombre para «${m.nombre}»`}
                            autoFocus
                          />
                          <button type="button" className="nt-btn-sm nt-btn-sm--on" onClick={() => guardarEdicion(m.id)} aria-label={`Guardar el nombre «${nombreEditado.trim() || m.nombre}»`}>
                            Guardar nombre
                          </button>
                          <button type="button" className="nt-btn-sm" onClick={() => setEditandoId(null)} aria-label="Cancelar la edición del nombre">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                            onClick={() => {
                              alSaltarAMarcador?.(m);
                              alCerrar();
                            }}
                            title="Saltar a esta ubicación"
                          >
                            
                            <strong style={{ fontSize: '13px', color: '#0f172a' }}>{m.nombre}</strong>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>({Math.round(m.zoom * 100)}%)</span>
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="nt-btn-sm"
                              style={{ fontSize: '11px', padding: '2px 6px' }}
                              onClick={() => {
                                setEditandoId(m.id);
                                setNombreEditado(m.nombre);
                              }}
                              title="Renombrar marcador"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="nt-btn-sm"
                              style={{ fontSize: '11px', padding: '2px 6px', color: '#ef4444' }}
                              onClick={() => eliminarMarcador(m.id)}
                              title="Eliminar marcador"
                            >
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Caso 2: Páginas A4 con esquema de títulos */}
        {formato === 'paginas' && (
          <div>
            {titulos.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', margin: 0, padding: '16px 0', textAlign: 'center' }}>
                No se detectaron títulos en el documento. Use los estilos «Título» o «Subtítulo» en la barra de texto para generar el esquema automáticamente.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                {titulos.map((t, idx) => (
                  <li key={idx} style={{ paddingLeft: t.nivel === 2 ? '16px' : '0' }}>
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '6px 10px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        gap: '8px',
                      }}
                      onClick={() => {
                        alSaltarAPagina?.(t.pagina, t.y);
                        alCerrar();
                      }}
                    >
                      <span style={{ fontSize: t.nivel === 1 ? '13px' : '12px', fontWeight: t.nivel === 1 ? 600 : 400, color: '#1e293b' }}>
                        {t.nivel === 1 ? '• ' : '– '} {t.texto}
                      </span>
                      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', flexShrink: 0 }}>
                        Pág. {t.pagina}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Caso 3: Tarjetas con lista de tarjetas */}
        {formato === 'tarjetas' && (
          <div>
            {tarjetas.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, padding: '16px 0', textAlign: 'center' }}>
                El mazo no contiene tarjetas.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                {tarjetas.map((tar, idx) => {
                  const textoAnverso = tar.anverso?.texto || tar.texto || `Tarjeta ${idx + 1}`;
                  return (
                    <li key={tar.id || idx}>
                      <button
                        type="button"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 12px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          gap: '8px',
                        }}
                        onClick={() => {
                          alSaltarATarjeta?.(idx);
                          alCerrar();
                        }}
                      >
                        <span style={{ fontSize: '13px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong>#{idx + 1}</strong> · {textoAnverso}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Ir</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
