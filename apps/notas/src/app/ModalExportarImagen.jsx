// Modal de exportación a imagen PNG / JPG (Etapa 18C · Parte 1).
// Configura alcance, escala (1×, 2×, 3×), formato, fondo transparente y renglones.
// Monitorea el límite de memoria del lienzo antes de exportar.

import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal.jsx';
import { renderizarImagen, descargarOCompartirImagen, validarTamanoExportacion } from '../archivos/exportarImagen.js';
import { marcoDePagina, marcosDePaginas } from '../formatos/paginas.js';
import { unirRects } from '../lienzo/geometria.js';

export default function ModalExportarImagen({
  alCerrar,
  tipoFormato = 'pizarron',
  doc,
  motorRef,
  paginaActiva = 1,
  tarjetaActiva = null,
  medidasTarjeta = null,
  cantidadPaginas = 1,
}) {
  const [datosLienzo, setDatosLienzo] = useState(() => ({
    seleccionIds: [],
    haySeleccion: false,
    elementos: [],
    camara: { x: -40, y: -40, zoom: 1 },
    ancho: 800,
    alto: 600,
    limites: null,
  }));

  // Opciones iniciales según formato
  const [alcance, setAlcance] = useState(() => {
    if (tipoFormato === 'paginas') return 'pagina';
    if (tipoFormato === 'tarjetas') return 'tarjeta';
    return 'todo';
  });

  useEffect(() => {
    const m = motorRef?.current;
    if (!m) return;
    const sel = m.seleccion ? [...m.seleccion] : [];
    const todos = m.escena ? m.escena.lista() : [];
    const lim = m.escena?.limites(todos) || null;
    setDatosLienzo({
      seleccionIds: sel,
      haySeleccion: sel.length > 0,
      elementos: todos,
      camara: m.camara ? { ...m.camara } : { x: -40, y: -40, zoom: 1 },
      ancho: m.ancho || 800,
      alto: m.alto || 600,
      limites: lim,
    });
    if (sel.length > 0) {
      setAlcance('seleccion');
    }
  }, [motorRef]);

  const [formato, setFormato] = useState('png'); // 'png' | 'jpeg'
  const [escala, setEscala] = useState(2); // 1, 2, 3
  const [transparente, setTransparente] = useState(false);
  const [conRenglones, setConRenglones] = useState(Boolean(doc?.renglones?.activos));
  const [procesando, setProcesando] = useState(false);
  const [errorExportar, setErrorExportar] = useState('');

  // Calcula el área geométrica (x, y, ancho, alto) y elementos correspondientes al alcance elegido
  const { rect, elementosExportar, marcoDoc, contenedor } = useMemo(() => {
    const { elementos: todosElementos, seleccionIds, camara, ancho: anchoVista, alto: altoVista, limites } = datosLienzo;

    if (alcance === 'seleccion') {
      const seleccionados = todosElementos.filter((e) => seleccionIds.includes(e.id));
      const caja = unirRects(seleccionados) || { x: 0, y: 0, ancho: 400, alto: 300 };
      const margen = 24;
      return {
        rect: {
          x: caja.x - margen,
          y: caja.y - margen,
          ancho: caja.ancho + margen * 2,
          alto: caja.alto + margen * 2,
        },
        elementosExportar: seleccionados,
        marcoDoc: null,
        contenedor: null,
      };
    }

    if (tipoFormato === 'paginas') {
      if (alcance === 'pagina') {
        const m = marcoDePagina(paginaActiva);
        const elementosPagina = todosElementos.filter((e) => {
          if (e.contenedor !== undefined && e.contenedor !== null) return Number(e.contenedor) === paginaActiva;
          const cy = e.y + (e.alto || 0) / 2;
          return cy >= m.y && cy < m.y + m.alto;
        });
        return {
          rect: { x: m.x, y: m.y, ancho: m.ancho, alto: m.alto },
          elementosExportar: elementosPagina.length ? elementosPagina : todosElementos,
          marcoDoc: null,
          contenedor: paginaActiva,
        };
      }
      // 'todo' las páginas
      const listaMarcos = marcosDePaginas(cantidadPaginas);
      const mUltimo = listaMarcos[listaMarcos.length - 1];
      const altoTotal = (mUltimo ? mUltimo.y + mUltimo.alto : 1123);
      return {
        rect: { x: 0, y: 0, ancho: 794, alto: altoTotal },
        elementosExportar: todosElementos,
        marcoDoc: listaMarcos,
        contenedor: null,
      };
    }

    if (tipoFormato === 'tarjetas') {
      const an = medidasTarjeta?.ancho || 800;
      const al = medidasTarjeta?.alto || 450;
      return {
        rect: { x: 0, y: 0, ancho: an, alto: al },
        elementosExportar: todosElementos,
        marcoDoc: null,
        contenedor: tarjetaActiva,
      };
    }

    // Pizarrón libre
    if (alcance === 'vista') {
      const c = camara;
      return {
        rect: {
          x: c.x,
          y: c.y,
          ancho: anchoVista / c.zoom,
          alto: altoVista / c.zoom,
        },
        elementosExportar: todosElementos,
        marcoDoc: null,
        contenedor: null,
      };
    }

    // 'todo' el pizarrón: límites de todos los elementos con margen
    if (!limites) {
      return {
        rect: { x: -400, y: -300, ancho: 800, alto: 600 },
        elementosExportar: todosElementos,
        marcoDoc: null,
        contenedor: null,
      };
    }
    // La escena devuelve la caja como {x, y, ancho, alto} (ver unirRects); antes se leían minX/maxX, que no existen → NaN.
    const margen = 40;
    return {
      rect: {
        x: limites.x - margen,
        y: limites.y - margen,
        ancho: Math.max(100, limites.ancho + margen * 2),
        alto: Math.max(100, limites.alto + margen * 2),
      },
      elementosExportar: todosElementos,
      marcoDoc: null,
      contenedor: null,
    };
  }, [datosLienzo, alcance, tipoFormato, paginaActiva, tarjetaActiva, medidasTarjeta, cantidadPaginas]);

  // Validación de memoria en vivo según escala y área
  const infoTamano = useMemo(() => {
    return validarTamanoExportacion(rect.ancho, rect.alto, escala);
  }, [rect.ancho, rect.alto, escala]);

  async function ejecutar() {
    if (!infoTamano.esSeguro || procesando) return;
    setProcesando(true);
    setErrorExportar('');

    try {
      motorRef?.current?.cerrarTexto();

      const renglonesRender = conRenglones
        ? { cfg: doc.renglones, opacidad: 1 }
        : null;

      const blob = await renderizarImagen({
        elementos: elementosExportar,
        rect,
        escala,
        formato,
        transparente: formato === 'png' && transparente,
        renglones: renglonesRender,
        guiaTexto: conRenglones ? doc.renglones : null,
        marcoDocumento: marcoDoc,
        contenedor,
      });

      let sufijo = '';
      if (alcance === 'seleccion') sufijo = 'seleccion';
      else if (alcance === 'pagina') sufijo = `pag_${paginaActiva}`;
      else if (alcance === 'tarjeta') sufijo = 'tarjeta';
      else sufijo = 'completo';

      await descargarOCompartirImagen(blob, {
        titulo: doc?.titulo || 'Nota',
        formato,
        sufijo,
      });

      alCerrar();
    } catch (err) {
      setErrorExportar(err.message || 'Error al exportar la imagen.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Modal titulo="Exportar imagen (PNG / JPG)" alCerrar={alCerrar} ancho={500}>
      <div style={{ display: 'grid', gap: '14px', fontSize: '13px' }}>
        {/* Selector de Alcance */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Área a exportar</label>
          <div style={{ display: 'grid', gap: '6px' }}>
            {tipoFormato === 'pizarron' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="alcance" checked={alcance === 'todo'} onChange={() => setAlcance('todo')} />
                  <span>Todo el pizarrón (encuadre automático del contenido)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="alcance" checked={alcance === 'vista'} onChange={() => setAlcance('vista')} />
                  <span>Vista actual de la pantalla</span>
                </label>
              </>
            )}

            {tipoFormato === 'paginas' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="alcance" checked={alcance === 'pagina'} onChange={() => setAlcance('pagina')} />
                  <span>Página actual (página {paginaActiva})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="alcance" checked={alcance === 'todo'} onChange={() => setAlcance('todo')} />
                  <span>Todas las páginas ({cantidadPaginas} {cantidadPaginas === 1 ? 'página' : 'páginas'})</span>
                </label>
              </>
            )}

            {tipoFormato === 'tarjetas' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="alcance" checked={alcance === 'tarjeta'} onChange={() => setAlcance('tarjeta')} />
                <span>Tarjeta actual</span>
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: datosLienzo.haySeleccion ? 1 : 0.45, cursor: datosLienzo.haySeleccion ? 'pointer' : 'default' }}>
              <input
                type="radio"
                name="alcance"
                disabled={!datosLienzo.haySeleccion}
                checked={alcance === 'seleccion'}
                onChange={() => setAlcance('seleccion')}
              />
              <span>Selección actual {datosLienzo.haySeleccion ? `(${datosLienzo.seleccionIds.length} elem.)` : '(sin elementos seleccionados)'}</span>
            </label>
          </div>
        </div>

        {/* Formato y Escala */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Formato</label>
            <select
              className="nt-campo"
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              style={{ width: '100%', padding: '6px' }}
            >
              <option value="png">PNG (calidad sin pérdidas)</option>
              <option value="jpeg">JPG (comprimido ligero)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Resolución / Escala</label>
            <select
              className="nt-campo"
              value={escala}
              onChange={(e) => setEscala(Number(e.target.value))}
              style={{ width: '100%', padding: '6px' }}
            >
              <option value={1}>1× (tamaño estándar)</option>
              <option value={2}>2× (alta definición · recomendado)</option>
              <option value={3}>3× (máxima nitidez)</option>
            </select>
          </div>
        </div>

        {/* Opciones de Fondo y Renglones */}
        <div style={{ display: 'grid', gap: '6px', borderTop: '1px solid var(--nt-borde, #e9ecef)', paddingTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: formato === 'png' ? 'pointer' : 'default', opacity: formato === 'png' ? 1 : 0.45 }}>
            <input
              type="checkbox"
              disabled={formato !== 'png'}
              checked={formato === 'png' && transparente}
              onChange={(e) => setTransparente(e.target.checked)}
            />
            <span>Fondo transparente {formato !== 'png' && '(solo disponible en PNG)'}</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={conRenglones}
              onChange={(e) => setConRenglones(e.target.checked)}
            />
            <span>Incluir renglones y cuadrícula del documento</span>
          </label>
        </div>

        {/* Panel de información de dimensiones y memoria */}
        <div
          style={{
            background: infoTamano.esSeguro ? 'var(--nt-superficie-2, #f8f9fa)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${infoTamano.esSeguro ? 'var(--nt-borde, #e9ecef)' : '#ef4444'}`,
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
            <span>Dimensiones resultantes:</span>
            <span>{infoTamano.anchoPx} × {infoTamano.altoPx} px ({infoTamano.megapixeles.toFixed(1)} MP)</span>
          </div>

          {!infoTamano.esSeguro && (
            <p style={{ margin: '6px 0 0 0', color: '#b91c1c', fontWeight: 500 }}>
              {infoTamano.error}
            </p>
          )}
        </div>

        {errorExportar && (
          <p className="nt-aviso" role="alert" style={{ margin: 0 }}>
            {errorExportar}
          </p>
        )}

        {/* Botones de acción */}
        <div className="nt-acciones" style={{ marginTop: '4px' }}>
          <button type="button" className="nt-btn" onClick={alCerrar} disabled={procesando}>
            Cancelar
          </button>
          <button
            type="button"
            className="nt-btn nt-btn--primario"
            onClick={ejecutar}
            disabled={!infoTamano.esSeguro || procesando}
          >
            {procesando ? 'Generando imagen…' : 'Exportar imagen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
