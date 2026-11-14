import { useState } from 'react';
import { Modal } from './Modal.jsx';
import NotasActualizacion from './NotasActualizacion.jsx';
import { esProgramaDeComputadora } from '../pwa/escritorio.js';

export default function ModalAyuda({ alCerrar }) {
  const [seccion, setSeccion] = useState('atajos');

  return (
    <Modal titulo="Ayuda de Anotomía" alCerrar={alCerrar} ancho={560}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div className="nt-pestanas" role="tablist" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--nt-borde-suave)' }}>
          <button
            type="button"
            role="tab"
            aria-selected={seccion === 'atajos'}
            className={`nt-btn ${seccion === 'atajos' ? 'nt-btn--primario' : ''}`}
            onClick={() => setSeccion('atajos')}
          >
            Atajos de teclado
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={seccion === 'gestos'}
            className={`nt-btn ${seccion === 'gestos' ? 'nt-btn--primario' : ''}`}
            onClick={() => setSeccion('gestos')}
          >
            Gestos y lápiz
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={seccion === 'formatos'}
            className={`nt-btn ${seccion === 'formatos' ? 'nt-btn--primario' : ''}`}
            onClick={() => setSeccion('formatos')}
          >
            Formatos de notas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={seccion === 'novedades'}
            className={`nt-btn ${seccion === 'novedades' ? 'nt-btn--primario' : ''}`}
            onClick={() => setSeccion('novedades')}
          >
            Novedades
          </button>
        </div>

        {seccion === 'novedades' && <NotasActualizacion soloUltima />}

        {seccion === 'atajos' && (
          <div style={{ display: 'grid', gap: '8px', fontSize: '13px', maxHeight: '360px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + V</strong><span>Herramienta Seleccionar</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + H</strong><span>Herramienta Mano (desplazar lienzo)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + P</strong><span>Lápiz de escritura</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + M</strong><span>Resaltador</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + B</strong><span>Borrador de trazos</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + T</strong><span>Insertar cuadro de texto</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + S</strong><span>Catálogo de símbolos científicos</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Alt + G</strong><span>Renglones y cuadrícula de fondo</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Ctrl + Z / Y</strong><span>Deshacer y rehacer sin límite</span>
            </div>
            {esProgramaDeComputadora() && (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
                <strong>Ctrl + S</strong><span>Guardar en el archivo del documento (también se guarda solo mientras escribe)</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <strong>Escape</strong><span>Terminar edición de texto (mantiene la selección)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '4px 0' }}>
              <strong>Espacio</strong><span>Escribir espacio directo o mover lienzo</span>
            </div>
          </div>
        )}

        {seccion === 'gestos' && (
          <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
            <div>
              <strong>Lápiz óptico / Stylus:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Escriba directamente sobre el lienzo. El grosor varía de manera natural según la presión ejercida en pantalla.
              </p>
            </div>
            <div>
              <strong>Desplazamiento con un dedo:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Al utilizar lápiz táctil, su dedo desplaza la vista sin manchar el documento gracias al rechazo de palma.
              </p>
            </div>
            <div>
              <strong>Pellizco con dos dedos:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Separe o junte dos dedos para acercar o alejar la vista suavemente.
              </p>
            </div>
            <div>
              <strong>Doble toque o doble clic:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Con la herramienta Seleccionar o con Mover el lienzo, toque dos veces un lugar vacío para escribir un texto nuevo, o dos veces un texto para abrir su editor.
              </p>
            </div>
          </div>
        )}

        {seccion === 'formatos' && (
          <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
            <div>
              <strong>Pizarrón infinito:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Espacio continuo libre en todas las direcciones, ideal para mapas conceptuales, fórmulas y diagramas extensos.
              </p>
            </div>
            <div>
              <strong>Páginas A4:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Hojas verticales estándar preparadas para impresión o exportación a PDF, con opción de encabezados y flujo automático.
              </p>
            </div>
            <div>
              <strong>Tarjetas de estudio:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
                Fichas compactas con modo de repaso a pantalla completa e impresión con marcas de corte.
              </p>
            </div>
          </div>
        )}

        <div className="nt-acciones" style={{ marginTop: '8px' }}>
          <button type="button" className="nt-btn nt-btn--primario" onClick={alCerrar}>
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
}
