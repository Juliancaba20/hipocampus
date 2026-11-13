import { EnPortal } from './Modal.jsx';
import { useMemo, useState } from 'react';
import { crearBloquesTablaContenido, generarIndiceContenido, yDePagina, ANCHO_A4 } from '../formatos/paginas.js';
import { crearElemento, TIPOS_ELEMENTO } from '../almacen/index.js';
import { layoutDe } from '../herramientas/texto/pintar.js';

export default function ModalTablaContenido({ motorRef, cfg, estilos, paginaActiva, alSaltar, alCerrar }) {
  const [elementos] = useState(() => motorRef.current?.escena?.lista() || []);

  const entradas = useMemo(() => {
    return generarIndiceContenido(elementos, cfg, estilos);
  }, [elementos, cfg, estilos]);

  // Buscar si ya existe una tabla de contenido en el documento
  const tablaExistente = useMemo(() => {
    return elementos.find((el) => el.tipo === 'texto' && el.datos?.esTablaContenido);
  }, [elementos]);

  const handleInsertarOActualizar = () => {
    const motor = motorRef.current;
    if (!motor) return;

    const bloques = crearBloquesTablaContenido(entradas);
    const anchoUtil = (cfg.ancho || ANCHO_A4) - 120;

    if (tablaExistente) {
      // Actualizar tabla existente
      const datosActualizados = {
        ...tablaExistente.datos,
        bloques,
        esTablaContenido: true,
      };
      const alto = layoutDe(datosActualizados, tablaExistente.ancho, undefined, { estilos }).alto;
      const nuevo = {
        ...tablaExistente,
        datos: datosActualizados,
        alto,
      };
      motor.escena.ejecutar(
        [{ id: tablaExistente.id, antes: tablaExistente, despues: nuevo }],
        'actualizar tabla de contenido'
      );
      alCerrar();
    } else {
      // Insertar en la página activa
      const yBase = yDePagina(paginaActiva, cfg) + 60;
      const datos = {
        bloques,
        tamano: 18,
        color: '#0f172a',
        esTablaContenido: true,
      };
      const alto = layoutDe(datos, anchoUtil, undefined, { estilos }).alto;
      const nuevo = crearElemento(motor.documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: 60,
        y: yBase,
        ancho: anchoUtil,
        alto,
        z: motor.escena.zMax() + 1,
        contenedor: paginaActiva,
        datos,
      });

      motor.escena.ejecutar(
        [{ id: nuevo.id, antes: null, despues: nuevo }],
        'insertar tabla de contenido'
      );
      alCerrar();
    }
  };

  return (
    <EnPortal>
    <div className="nt-modal-backdrop" onClick={alCerrar}>
      <div
        className="nt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-toc"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        <div className="nt-modal__cab">
          <h2 id="titulo-toc" className="nt-modal__titulo">
            Tabla de contenido
          </h2>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0' }}>
          Se genera automáticamente a partir de los títulos y subtítulos en las páginas A4. Puede hacer clic para saltar a cualquier sección.
        </p>

        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
          {entradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
              No se encontraron títulos (H1, H2, H3 o estilos de Título/Subtítulo) en el documento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {entradas.map((e, idx) => (
                <button
                  key={`${e.elementoId}_${idx}`}
                  type="button"
                  onClick={() => {
                    alSaltar(e.pagina, e.y);
                    alCerrar();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    paddingLeft: `${8 + (e.nivel - 1) * 20}px`,
                  }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                  title={`Ir a página ${e.pagina}`}
                >
                  <span
                    style={{
                      fontWeight: e.nivel === 1 ? 600 : 400,
                      color: e.nivel === 1 ? '#0f172a' : '#334155',
                      fontSize: e.nivel === 1 ? '14px' : '13px',
                      flexShrink: 0,
                    }}
                  >
                    {e.texto}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: '1px dotted #cbd5e1',
                      margin: '0 8px',
                      height: '1px',
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', flexShrink: 0 }}>
                    Pág. {e.pagina}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="nt-modal__pie" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {entradas.length} {entradas.length === 1 ? 'sección detectada' : 'secciones detectadas'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="nt-btn nt-btn--secundario" onClick={alCerrar}>
              Cerrar
            </button>
            <button
              type="button"
              className="nt-btn nt-btn--primario"
              onClick={handleInsertarOActualizar}
            >
              {tablaExistente ? 'Actualizar tabla en documento' : 'Insertar en página actual'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </EnPortal>
  );
}
