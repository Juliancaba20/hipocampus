// Modal de Repetición Espaciada y Estadísticas (Etapa 22C).
// Muestra la cola de repaso diaria («Para repasar hoy») por materia y general,
// estadísticas (repasadas hoy, racha de días, porcentaje de aciertos),
// configuración de límite diario de nuevas tarjetas y simulación de fecha.

import { useState } from 'react';
import { Modal } from './Modal.jsx';
import {
  sumarDiasISO,
  obtenerFechaHoyISO,
} from '../almacen/repeticion.js';

export default function ModalRepasoEstadisticas({
  alCerrar,
  resumenSRS,
  documentos = [],
  carpetasMap = new Map(),
  fechaSimulada = null,
  alCambiarFechaSimulada,
  alGuardarLimiteNuevas,
  alAbrirMazo,
  mostrarAvisos = true,
  alCambiarMostrarAvisos,
}) {
  const hoyReal = obtenerFechaHoyISO();
  const fechaActual = fechaSimulada || hoyReal;
  const stats = resumenSRS?.estadisticas || {
    repasadasHoy: 0,
    rachaDias: 0,
    porcentajeAciertos: 100,
    totalRepasosHistorico: 0,
    totalAciertos: 0,
    distribucion: { 'otra-vez': 0, 'dificil': 0, 'bien': 0, 'facil': 0 },
    conteoEstados: { nuevas: 0, aprendiendo: 0, repaso: 0 },
  };

  const [limite, setLimite] = useState(resumenSRS?.limiteNuevas ?? 20);
  const [guardandoLimite, setGuardandoLimite] = useState(false);
  const [avisoLimite, setAvisoLimite] = useState('');

  const guardarNuevoLimite = async (e) => {
    e.preventDefault();
    setGuardandoLimite(true);
    try {
      await alGuardarLimiteNuevas(Number(limite));
      setAvisoLimite('Límite actualizado.');
      setTimeout(() => setAvisoLimite(''), 2000);
    } finally {
      setGuardandoLimite(false);
    }
  };

  // Filtrar documentos de tarjetas activos
  const mazos = documentos.filter((d) => d && d.formato === 'tarjetas' && !d.papelera);

  return (
    <Modal titulo="Repetición espaciada y estadísticas" alCerrar={alCerrar} ancho={640}>
      <div style={{ display: 'grid', gap: '20px' }}>

        {alCambiarMostrarAvisos && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mostrarAvisos}
              onChange={(e) => alCambiarMostrarAvisos(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <span>
              Mostrar avisos de repaso en la biblioteca
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--nt-suave, #64748b)' }}>
                Quita las etiquetas «para repasar hoy» de cada mazo, el cartel superior y el contador del botón. Los mazos se pueden repasar igual.
              </span>
            </span>
          </label>
        )}

        {/* Tarjetas resumen de estadísticas principales */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
          }}
        >
          <div
            style={{
              background: 'var(--nt-fondo-suave, #f1f5f9)',
              padding: '12px 10px',
              borderRadius: '10px',
              textAlign: 'center',
              border: '1px solid var(--nt-linea, #e2e8f0)',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>
              {resumenSRS?.totalGeneral ?? 0}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--nt-suave, #64748b)', marginTop: '2px' }}>
              Para repasar hoy
            </div>
            <div style={{ fontSize: '10px', color: 'var(--nt-suave, #94a3b8)', marginTop: '2px' }}>
              {resumenSRS?.totalRepasosGeneral ?? 0} prog. + {resumenSRS?.totalNuevasGeneral ?? 0} nuevas
            </div>
          </div>

          <div
            style={{
              background: 'var(--nt-fondo-suave, #f1f5f9)',
              padding: '12px 10px',
              borderRadius: '10px',
              textAlign: 'center',
              border: '1px solid var(--nt-linea, #e2e8f0)',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0891b2' }}>
              {stats.repasadasHoy}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--nt-suave, #64748b)', marginTop: '2px' }}>
              Repasadas hoy
            </div>
            <div style={{ fontSize: '10px', color: 'var(--nt-suave, #94a3b8)', marginTop: '2px' }}>
              {stats.totalRepasosHistorico} en total
            </div>
          </div>

          <div
            style={{
              background: 'var(--nt-fondo-suave, #f1f5f9)',
              padding: '12px 10px',
              borderRadius: '10px',
              textAlign: 'center',
              border: '1px solid var(--nt-linea, #e2e8f0)',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>
              {stats.rachaDias}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--nt-suave, #64748b)', marginTop: '2px' }}>
              Racha de días
            </div>
            <div style={{ fontSize: '10px', color: 'var(--nt-suave, #94a3b8)', marginTop: '2px' }}>
              consecutivos
            </div>
          </div>

          <div
            style={{
              background: 'var(--nt-fondo-suave, #f1f5f9)',
              padding: '12px 10px',
              borderRadius: '10px',
              textAlign: 'center',
              border: '1px solid var(--nt-linea, #e2e8f0)',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>
              {stats.porcentajeAciertos}%
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--nt-suave, #64748b)', marginTop: '2px' }}>
              Aciertos
            </div>
            <div style={{ fontSize: '10px', color: 'var(--nt-suave, #94a3b8)', marginTop: '2px' }}>
              {stats.totalAciertos} de {stats.totalRepasosHistorico}
            </div>
          </div>
        </div>

        {/* Mazos y cola de hoy por materia */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              Cola de repaso por mazo
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--nt-suave, #64748b)' }}>
              Fecha de consulta: <strong>{fechaActual}</strong> {fechaSimulada ? '(Simulada)' : ''}
            </span>
          </div>

          {mazos.length === 0 ? (
            <p className="nt-texto-suave" style={{ fontSize: '13.5px' }}>
              Aún no tienes mazos de tarjetas creados. Crea un documento con formato «Tarjetas» para comenzar a estudiar con repetición espaciada.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {mazos.map((m) => {
                const infoCola = resumenSRS?.conteoPorDoc?.[m.id] || { total: 0, cantidadRepaso: 0, cantidadNuevas: 0 };
                const carpeta = m.carpetaId ? carpetasMap.get(m.carpetaId) : null;
                const totalTarjetas = Array.isArray(m.config?.tarjetas) ? m.config.tarjetas.length : 0;

                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--nt-fondo-campo, #f8fafc)',
                      border: '1px solid var(--nt-linea, #e2e8f0)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px' }}>{m.titulo}</strong>
                        {carpeta && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: `${carpeta.color}15`,
                              color: carpeta.color,
                              fontWeight: 600,
                            }}
                          >
                            {carpeta.nombre}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--nt-suave, #64748b)' }}>
                        {totalTarjetas} tarjetas en el mazo · {infoCola.cantidadRepaso} para repasar hoy · {infoCola.cantidadNuevas} nuevas
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: infoCola.total > 0 ? '#dbeafe' : '#f1f5f9',
                          color: infoCola.total > 0 ? '#1d4ed8' : '#64748b',
                        }}
                      >
                        {infoCola.total > 0 ? `${infoCola.total} pendientes` : 'Al día'}
                      </span>
                      <button
                        type="button"
                        className={`nt-btn nt-btn--sm ${infoCola.total > 0 ? 'nt-btn--primario' : ''}`}
                        onClick={() => {
                          alCerrar();
                          alAbrirMazo(m, { modoEstudio: true, fechaSimulada });
                        }}
                      >
                        {infoCola.total > 0 ? 'Repasar mazo' : 'Estudiar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Configuración: Límite de tarjetas nuevas */}
        <div style={{ borderTop: '1px solid var(--nt-linea, #e2e8f0)', paddingTop: '14px' }}>
          <form onSubmit={guardarNuevoLimite} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <label style={{ fontSize: '13.5px', color: 'var(--nt-texto, #1e293b)', flex: 1 }}>
              <strong>Límite diario de tarjetas nuevas:</strong>
              <div style={{ fontSize: '12px', color: 'var(--nt-suave, #64748b)' }}>
                Máxima cantidad de tarjetas no estudiadas antes que se incorporan a la cola cada día.
              </div>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="1"
                max="200"
                className="nt-campo"
                style={{ width: '80px', textAlign: 'center' }}
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
              />
              <button type="submit" className="nt-btn" disabled={guardandoLimite}>
                Guardar
              </button>
            </div>
          </form>
          {avisoLimite && (
            <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px', textAlign: 'right' }}>
              {avisoLimite}
            </div>
          )}
        </div>

        {/* Herramienta de simulación de fecha (verificación de algoritmos y casos límite) */}
        <div
          style={{
            borderTop: '1px solid var(--nt-linea, #e2e8f0)',
            paddingTop: '14px',
            background: 'var(--nt-fondo-campo, #f8fafc)',
            padding: '12px 14px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Simular cambio de fecha (Pruebas de algoritmo SM-2):
            </span>
            {fechaSimulada && (
              <button
                type="button"
                className="nt-enlace"
                style={{ fontSize: '12px', color: '#2563eb' }}
                onClick={() => alCambiarFechaSimulada(null)}
              >
                Restablecer a fecha real
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--nt-suave, #64748b)', marginBottom: '8px' }}>
            Permite avanzar los días de forma local para comprobar cómo madura la cola de repaso y los intervalos sin modificar el reloj de su computadora o dispositivo.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="nt-campo"
              style={{ fontSize: '12px', padding: '4px 8px' }}
              value={fechaActual}
              onChange={(e) => alCambiarFechaSimulada(e.target.value || null)}
            />
            <button
              type="button"
              className="nt-btn nt-btn--sm"
              onClick={() => alCambiarFechaSimulada(hoyReal)}
            >
              Hoy ({hoyReal})
            </button>
            <button
              type="button"
              className="nt-btn nt-btn--sm"
              onClick={() => alCambiarFechaSimulada(sumarDiasISO(fechaActual, 1))}
              title="Avanzar 1 día natural"
            >
              +1 día (mañana)
            </button>
            <button
              type="button"
              className="nt-btn nt-btn--sm"
              onClick={() => alCambiarFechaSimulada(sumarDiasISO(fechaActual, 7))}
              title="Avanzar 1 semana"
            >
              +7 días
            </button>
            <button
              type="button"
              className="nt-btn nt-btn--sm"
              onClick={() => alCambiarFechaSimulada(sumarDiasISO(fechaActual, 30))}
              title="Avanzar 1 mes"
            >
              +30 días
            </button>
          </div>
        </div>

        {/* Botón de cierre */}
        <div className="nt-acciones">
          <button type="button" className="nt-btn nt-btn--primario" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
