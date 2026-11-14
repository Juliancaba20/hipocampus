import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { PERFILES_MARGENES, TAMANOS_HOJA, dimensionesHoja, margenesHoja } from '../formatos/paginas.js';
import SelectorColor from './SelectorColor.jsx';

export default function ModalConfigurarPagina({ config, alCerrar, alGuardar }) {
  const [tamanoHoja, setTamanoHoja] = useState(config?.tamanoHoja || 'a4');
  // Las hojas son siempre verticales: una hoja horizontal sería en la práctica una tarjeta.
  const orientacion = 'vertical';

  // Detectar perfil de márgenes inicial
  const margenesIniciales = margenesHoja(config);
  const encontrarPerfil = (m) => {
    for (const [key, p] of Object.entries(PERFILES_MARGENES)) {
      if (p.superior === m.superior && p.inferior === m.inferior && p.izquierdo === m.izquierdo && p.derecho === m.derecho) {
        return key;
      }
    }
    return 'personalizado';
  };

  const [perfilMargen, setPerfilMargen] = useState(() => encontrarPerfil(margenesIniciales));
  const [margenesPersonalizados, setMargenesPersonalizados] = useState(margenesIniciales);

  const cambiarPerfil = (nuevoPerfil) => {
    setPerfilMargen(nuevoPerfil);
    if (nuevoPerfil !== 'personalizado' && PERFILES_MARGENES[nuevoPerfil]) {
      const p = PERFILES_MARGENES[nuevoPerfil];
      setMargenesPersonalizados({
        superior: p.superior,
        inferior: p.inferior,
        izquierdo: p.izquierdo,
        derecho: p.derecho,
      });
    }
  };

  const [fondo, setFondo] = useState(config?.fondo || null);

  const previewDims = dimensionesHoja({ tamanoHoja, orientacion });

  const aplicar = (e) => {
    e.preventDefault();
    alGuardar({
      ...config,
      tamanoHoja,
      orientacion,
      margenes: margenesPersonalizados,
      fondo,
    });
    alCerrar();
  };

  return (
    <Modal titulo="Configurar página y márgenes" alCerrar={alCerrar} ancho={540}>
      <form onSubmit={aplicar} style={{ display: 'grid', gap: '16px' }}>
        <p className="nt-texto-suave" style={{ margin: 0 }}>
          Configure el tamaño de hoja (siempre vertical) y los márgenes de impresión y escritura del documento.
        </p>

        <div style={{ display: 'grid', gap: '12px' }}>
          {/* Tamaño de hoja */}
          <label style={{ display: 'grid', gap: '4px', fontWeight: 600, fontSize: '13px' }}>
            Tamaño de hoja
            <select
              className="nt-campo"
              value={tamanoHoja}
              onChange={(e) => setTamanoHoja(e.target.value)}
            >
              {Object.values(TAMANOS_HOJA).map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Resumen dimensional */}
        <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Dimensiones:</strong> {Math.round(previewDims.anchoMm)} × {Math.round(previewDims.altoMm)} mm ({previewDims.ancho} × {previewDims.alto} px)</span>
          <span style={{ color: '#64748b' }}>Vertical</span>
        </div>

        {/* Márgenes */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', display: 'grid', gap: '10px' }}>
          <label style={{ display: 'grid', gap: '4px', fontWeight: 600, fontSize: '13px' }}>
            Márgenes de página
            <select
              className="nt-campo"
              value={perfilMargen}
              onChange={(e) => cambiarPerfil(e.target.value)}
            >
              {Object.entries(PERFILES_MARGENES).map(([key, p]) => (
                <option key={key} value={key}>{p.nombre}</option>
              ))}
              <option value="personalizado">Personalizado…</option>
            </select>
          </label>

          {/* Edición de márgenes numéricos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'grid', gap: '2px' }}>
              Superior
              <input
                type="number"
                min="10"
                max="200"
                className="nt-campo"
                value={margenesPersonalizados.superior}
                onChange={(e) => {
                  setPerfilMargen('personalizado');
                  setMargenesPersonalizados((prev) => ({ ...prev, superior: Math.max(10, parseInt(e.target.value, 10) || 10) }));
                }}
              />
            </label>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'grid', gap: '2px' }}>
              Inferior
              <input
                type="number"
                min="10"
                max="200"
                className="nt-campo"
                value={margenesPersonalizados.inferior}
                onChange={(e) => {
                  setPerfilMargen('personalizado');
                  setMargenesPersonalizados((prev) => ({ ...prev, inferior: Math.max(10, parseInt(e.target.value, 10) || 10) }));
                }}
              />
            </label>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'grid', gap: '2px' }}>
              Izquierdo
              <input
                type="number"
                min="10"
                max="200"
                className="nt-campo"
                value={margenesPersonalizados.izquierdo}
                onChange={(e) => {
                  setPerfilMargen('personalizado');
                  setMargenesPersonalizados((prev) => ({ ...prev, izquierdo: Math.max(10, parseInt(e.target.value, 10) || 10) }));
                }}
              />
            </label>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'grid', gap: '2px' }}>
              Derecho
              <input
                type="number"
                min="10"
                max="200"
                className="nt-campo"
                value={margenesPersonalizados.derecho}
                onChange={(e) => {
                  setPerfilMargen('personalizado');
                  setMargenesPersonalizados((prev) => ({ ...prev, derecho: Math.max(10, parseInt(e.target.value, 10) || 10) }));
                }}
              />
            </label>
          </div>
        </div>

        {/* Fondo de página: color, degradado o pizarrón */}
        <div style={{ display: 'grid', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Fondo de la página</span>
            <SelectorColor
              colorActual={fondo}
              etiqueta="Fondo de página"
              admitirDegradado={true}
              admitirTransparente={false}
              alCambiar={(c) => setFondo(c)}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`nt-btn-sm ${!fondo || fondo === '#ffffff' ? 'nt-btn-sm--on' : ''}`}
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => setFondo('#ffffff')}
            >
              Blanco
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${fondo === '#fdfbf7' ? 'nt-btn-sm--on' : ''}`}
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => setFondo('#fdfbf7')}
            >
              Crema
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${fondo === '#f0fdf4' ? 'nt-btn-sm--on' : ''}`}
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => setFondo('#f0fdf4')}
            >
              Menta pastel
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${fondo === '#f0f9ff' ? 'nt-btn-sm--on' : ''}`}
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => setFondo('#f0f9ff')}
            >
              Cielo pastel
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${fondo === 'pizarron-verde' ? 'nt-btn-sm--on' : ''}`}
              style={{ fontSize: '11px', padding: '4px 8px', background: '#1b4332', color: '#fff' }}
              onClick={() => setFondo('pizarron-verde')}
            >
              Pizarrón verde
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${fondo === 'pizarron-negro' ? 'nt-btn-sm--on' : ''}`}
              style={{ fontSize: '11px', padding: '4px 8px', background: '#1e293b', color: '#fff' }}
              onClick={() => setFondo('pizarron-negro')}
            >
              Pizarrón oscuro
            </button>
          </div>
        </div>

        <p className="nt-texto-suave" style={{ fontSize: '11px', margin: 0 }}>
          Los trazos a mano alzada y anotaciones conservan su posición dentro de cada página sin sufrir deformaciones ni rotaciones.
        </p>

        <div className="nt-acciones" style={{ marginTop: '8px' }}>
          <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="nt-btn nt-btn--primario">Aplicar cambios</button>
        </div>
      </form>
    </Modal>
  );
}
