// Modal de exportación a documento PDF descargable (Etapa 18C · Parte 2).
// Configura alcance (todo o página/tarjeta actual), renglones, resolución,
// muestra progreso y permite descarga directa o compartir en iPad / tablet.

import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { generarPdfDocumento, descargarOCompartirPdf } from '../archivos/exportarPdf.js';

export default function ModalExportarPdf({
  alCerrar,
  tipoFormato = 'paginas',
  doc,
  motorRef,
  paginaActiva = 1,
  tarjetaActiva = null,
  tarjetas = [],
  medidasTarjeta = null,
  cantidadPaginas = 1,
}) {
  const [haySeleccion, setHaySeleccion] = useState(false);
  const [numSeleccion, setNumSeleccion] = useState(0);

  // Alcance inicial
  const [alcance, setAlcance] = useState(() => {
    if (tipoFormato === 'paginas') return 'todo';
    if (tipoFormato === 'tarjetas') return 'todo';
    return 'todo';
  });

  useEffect(() => {
    const m = motorRef?.current;
    const ids = m?.seleccion ? [...m.seleccion] : [];
    if (ids.length > 0) {
      setHaySeleccion(true);
      setNumSeleccion(ids.length);
      setAlcance('seleccion');
    }
  }, [motorRef]);

  const [conRenglones, setConRenglones] = useState(
    Boolean(doc?.renglones?.activos || doc?.config?.imprimirRenglones)
  );
  const [factor, setFactor] = useState(2); // 2× = 192 DPI, 3× = 288 DPI
  const [procesando, setProcesando] = useState(false);
  const [progresoTexto, setProgresoTexto] = useState('');
  const [errorExportar, setErrorExportar] = useState('');

  // Cantidad estimada de páginas en el PDF resultante
  let cantidadEstimada = 1;
  if (tipoFormato === 'paginas') {
    cantidadEstimada = alcance === 'actual' ? 1 : Math.max(1, cantidadPaginas);
  } else if (tipoFormato === 'tarjetas') {
    cantidadEstimada = alcance === 'actual' ? 1 : Math.max(1, tarjetas?.length || 1);
  }

  async function ejecutarExportacion() {
    const motor = motorRef?.current;
    if (procesando || !motor) return;
    setProcesando(true);
    setErrorExportar('');
    setProgresoTexto('Iniciando exportación…');

    try {
      motor.cerrarTexto();

      const blob = await generarPdfDocumento({
        tipoFormato,
        doc,
        motor,
        alcance,
        paginaActiva,
        tarjetaActiva,
        tarjetas,
        medidasTarjeta,
        cantidadPaginas,
        conRenglones,
        factor,
        calidad: 0.92,
        alProgreso: (actual, total, mensaje) => {
          setProgresoTexto(mensaje || `Página ${actual} de ${total}…`);
        },
      });

      let sufijo = '';
      if (tipoFormato === 'paginas' && alcance === 'actual') {
        sufijo = `pag_${paginaActiva}`;
      } else if (tipoFormato === 'tarjetas' && alcance === 'actual') {
        sufijo = `tarjeta_${tarjetaActiva?.titulo || 'actual'}`;
      } else if (alcance === 'seleccion') {
        sufijo = 'seleccion';
      }

      await descargarOCompartirPdf(blob, {
        titulo: doc?.titulo || 'Documento',
        sufijo,
      });

      alCerrar();
    } catch (err) {
      setErrorExportar('No se pudo generar el PDF: ' + (err.message || 'error desconocido'));
    } finally {
      setProcesando(false);
      setProgresoTexto('');
    }
  }

  return (
    <Modal titulo="Exportar a PDF" alCerrar={procesando ? () => {} : alCerrar} ancho={500}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <p className="nt-texto-suave" style={{ margin: 0 }}>
          Descargue un archivo PDF real generado en su dispositivo o guárdelo directamente en su tablet.
        </p>

        {/* Alcance del documento */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
            Alcance
          </label>
          <div style={{ display: 'grid', gap: '8px' }}>
            {tipoFormato === 'paginas' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    checked={alcance === 'todo'}
                    onChange={() => setAlcance('todo')}
                  />
                  <span>Todo el documento ({cantidadPaginas} {cantidadPaginas === 1 ? 'página' : 'páginas'})</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    checked={alcance === 'actual'}
                    onChange={() => setAlcance('actual')}
                  />
                  <span>Solo la página actual (Pág. {paginaActiva})</span>
                </label>
              </>
            )}

            {tipoFormato === 'pizarron' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    checked={alcance === 'todo'}
                    onChange={() => setAlcance('todo')}
                  />
                  <span>Pizarrón completo (encuadrado proporcional a hoja A4)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    checked={alcance === 'vista'}
                    onChange={() => setAlcance('vista')}
                  />
                  <span>Vista actual de la pantalla</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: haySeleccion ? 1 : 0.45, cursor: haySeleccion ? 'pointer' : 'default' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    disabled={!haySeleccion}
                    checked={alcance === 'seleccion'}
                    onChange={() => setAlcance('seleccion')}
                  />
                  <span>Selección actual {haySeleccion ? `(${numSeleccion} elementos)` : '(sin selección)'}</span>
                </label>
              </>
            )}

            {tipoFormato === 'tarjetas' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    checked={alcance === 'todo'}
                    onChange={() => setAlcance('todo')}
                  />
                  <span>Todas las tarjetas ({tarjetas?.length || 1} {tarjetas?.length === 1 ? 'tarjeta' : 'tarjetas'})</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="alcancePdf"
                    checked={alcance === 'actual'}
                    onChange={() => setAlcance('actual')}
                  />
                  <span>Solo la tarjeta actual ({tarjetaActiva?.titulo || 'Tarjeta activa'})</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Formato y Calidad */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Formato de hoja</label>
            <input
              className="nt-campo"
              value={tipoFormato === 'tarjetas' ? 'Ficha / Tarjeta' : 'A4 (210 × 297 mm)'}
              disabled
              style={{ width: '100%', padding: '6px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Calidad y nitidez</label>
            <select
              className="nt-campo"
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
              style={{ width: '100%', padding: '6px' }}
            >
              <option value={2}>2× (Alta nitidez · 192 DPI)</option>
              <option value={3}>3× (Ultra definición · 288 DPI)</option>
            </select>
          </div>
        </div>

        {/* Opción de renglones */}
        <label className="nt-check" style={{ marginTop: '2px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={conRenglones}
            onChange={(e) => setConRenglones(e.target.checked)}
          />
          <span>Incluir renglones y cuadrícula del documento</span>
        </label>

        {/* Resumen */}
        <div
          style={{
            fontSize: '13px',
            color: 'var(--nt-texto-suave, #64748b)',
            background: 'var(--nt-fondo-suave, #f8fafc)',
            border: '1px solid var(--nt-borde, #e2e8f0)',
            borderRadius: '6px',
            padding: '10px 12px',
          }}
        >
          {tipoFormato === 'paginas' && (
            <span>El PDF contendrá <strong>{cantidadEstimada} {cantidadEstimada === 1 ? 'página A4' : 'páginas A4'}</strong>.</span>
          )}
          {tipoFormato === 'pizarron' && (
            <span>El PDF contendrá <strong>1 página</strong> con el pizarrón encuadrado proporcionalmente.</span>
          )}
          {tipoFormato === 'tarjetas' && (
            <span>El PDF contendrá <strong>{cantidadEstimada} {cantidadEstimada === 1 ? 'página' : 'páginas'}</strong> (una tarjeta por página).</span>
          )}
        </div>

        {/* Indicador de progreso */}
        {procesando && (
          <div
            style={{
              padding: '10px',
              borderRadius: '6px',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{progresoTexto || 'Generando archivo PDF…'}</span>
          </div>
        )}

        {/* Error */}
        {errorExportar && (
          <div
            style={{
              padding: '10px',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '13px',
            }}
            role="alert"
          >
            {errorExportar}
          </div>
        )}

        {/* Acciones */}
        <div className="nt-acciones" style={{ marginTop: '4px' }}>
          <button
            type="button"
            className="nt-btn"
            disabled={procesando}
            onClick={alCerrar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="nt-btn nt-btn--primario"
            disabled={procesando}
            onClick={ejecutarExportacion}
          >
            {procesando ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
