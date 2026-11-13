import { useState } from 'react';
import SelectorColor from './SelectorColor.jsx';
import ModalOclusionImagen from './ModalOclusionImagen.jsx';
import EstudioImagen from './EstudioImagen.jsx';
import ModalSeleccionarNota from './ModalSeleccionarNota.jsx';

export default function PanelImagen({ imagen, motorRef }) {
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [modalOclusion, setModalOclusion] = useState(false);
  const [modalEstudio, setModalEstudio] = useState(false);
  const [modalElegirNota, setModalElegirNota] = useState(false);
  const motor = () => motorRef.current;
  const elReal = motor()?.escena?.get(imagen.id) || imagen.elemento || imagen;
  const mascaras = Array.isArray(elReal.datos?.mascaras) ? elReal.datos.mascaras : (Array.isArray(imagen.mascaras) ? imagen.mascaras : []);
  const r = imagen.recorte || { x: 0, y: 0, ancho: 1, alto: 1 };
  const marco = imagen.marco || 'ninguno';
  const sombra = imagen.sombra || { activa: false, color: 'rgba(20, 25, 43, 0.35)', desenfoque: 8, x: 2, y: 4 };

  const cambiarRecorte = (campo, valor) => {
    let siguiente = { ...r, [campo]: valor / 100 };
    if (campo === 'x') siguiente.ancho = Math.min(r.ancho, 1 - siguiente.x);
    if (campo === 'y') siguiente.alto = Math.min(r.alto, 1 - siguiente.y);
    motor()?.recortarImagen(siguiente);
  };

  const cambiarEstilo = (parche) => {
    motor()?.estiloImagenes?.(parche);
  };

  const controlRecorte = (campo, nombre, valor, max) => (
    <label className="nt-rango" key={campo}>
      {nombre}
      <input
        type="range"
        min="0"
        max={max}
        value={Math.round(valor * 100)}
        aria-label={`Recorte ${nombre}`}
        onPointerDown={() => motor()?.iniciarRecorteImagen()}
        onPointerUp={() => motor()?.terminarRecorteImagen()}
        onPointerCancel={() => motor()?.terminarRecorteImagen()}
        onBlur={() => motor()?.terminarRecorteImagen()}
        onChange={(e) => cambiarRecorte(campo, +e.target.value)}
      />
    </label>
  );

  return (
    <div className="nt-props nt-panel-imagen" role="group" aria-label="Ajustes de imagen" style={{ flexWrap: 'wrap', gap: '8px' }}>
      <span className="nt-panel-imagen__nombre" title={imagen.nombre}>{imagen.nombre}</span>

      {/* Selector de Marco de imagen: Rectángulo, Redondeado, Círculo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Forma y marco de la imagen">
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Marco:</span>
        <select
          value={marco}
          style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          onChange={(e) => cambiarEstilo({ marco: e.target.value })}
        >
          <option value="ninguno">Rectangular</option>
          <option value="redondeado">Redondeado</option>
          <option value="circulo">Círculo / Óvalo</option>
        </select>
      </div>

      {marco === 'redondeado' && (
        <label className="nt-rango" title="Radio de esquinas redondeadas">
          Radio
          <input
            type="range"
            min="4"
            max="80"
            value={imagen.radioEsquinas !== undefined ? imagen.radioEsquinas : 20}
            onChange={(e) => cambiarEstilo({ radioEsquinas: +e.target.value })}
          />
        </label>
      )}

      {/* Borde */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Borde de la imagen">
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Borde</span>
        <SelectorColor
          colorActual={imagen.borde}
          etiqueta="Borde imagen"
          admitirTransparente={true}
          motorRef={motorRef}
          alCambiar={(c) => cambiarEstilo({ borde: c, grosor: imagen.grosor || 2 })}
        />
      </div>

      {imagen.borde && (
        <label className="nt-rango" title="Grosor del borde">
          Grosor
          <input
            type="range"
            min="1"
            max="20"
            value={imagen.grosor || 2}
            onChange={(e) => cambiarEstilo({ grosor: +e.target.value })}
          />
        </label>
      )}

      {/* Opacidad */}
      <label className="nt-rango" title="Opacidad de la imagen">
        Opacidad
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round((imagen.opacidad !== undefined ? imagen.opacidad : 1) * 100)}
          onChange={(e) => cambiarEstilo({ opacidad: +e.target.value / 100 })}
        />
      </label>

      {/* Sombra */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }} title="Sombra proyectada">
        <input
          type="checkbox"
          checked={!!sombra.activa}
          onChange={(e) => cambiarEstilo({ sombra: { ...sombra, activa: e.target.checked } })}
        />
        Sombra
      </label>

      {/* Botón de alternar recorte detallado */}
      <button
        type="button"
        className={`nt-btn-sm ${mostrarAvanzado ? 'nt-btn-sm--on' : ''}`}
        style={{
          fontSize: '11px',
          padding: '3px 8px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          background: mostrarAvanzado ? '#e0f2fe' : '#ffffff',
          color: mostrarAvanzado ? '#0369a1' : '#475569',
          cursor: 'pointer',
        }}
        onClick={() => setMostrarAvanzado(!mostrarAvanzado)}
      >
        {mostrarAvanzado ? '− Ocultar recorte' : 'Recortar...'}
      </button>

      {mostrarAvanzado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
          {controlRecorte('x', 'Izquierda', r.x, Math.floor((1 - r.ancho) * 100))}
          {controlRecorte('y', 'Arriba', r.y, Math.floor((1 - r.alto) * 100))}
          {controlRecorte('ancho', 'Ancho visible', r.ancho, Math.floor((1 - r.x) * 100))}
          {controlRecorte('alto', 'Alto visible', r.alto, Math.floor((1 - r.y) * 100))}
          <button
            type="button"
            className="nt-btn"
            style={{ fontSize: '11px', padding: '3px 8px' }}
            aria-label="Restablecer recorte a la imagen completa"
            onClick={() => {
              motor()?.iniciarRecorteImagen();
              motor()?.recortarImagen({ x: 0, y: 0, ancho: 1, alto: 1 });
              motor()?.terminarRecorteImagen();
            }}
          >
            Restablecer recorte
          </button>
        </div>
      )}

      {/* Oclusión de imagen y máscaras de estudio (Etapa 22B) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          className="nt-btn-sm"
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid #93c5fd',
            background: mascaras.length > 0 ? '#eff6ff' : '#ffffff',
            color: '#1d4ed8',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => setModalOclusion(true)}
          title="Dibujar o editar máscaras de oclusión sobre esta imagen para estudiar"
        >
          Oclusión {mascaras.length > 0 ? `(${mascaras.length})` : ''}
        </button>

        {mascaras.length > 0 && (
          <button
            type="button"
            className="nt-btn-sm"
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid #16a34a',
              background: '#f0fdf4',
              color: '#15803d',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => setModalEstudio(true)}
            title="Estudiar las etiquetas de esta imagen a pantalla completa"
          >
            Estudiar imagen
          </button>
        )}

        {/* Enlazar imagen a otra nota (Etapa 23) */}
        <button
          type="button"
          className="nt-btn-sm"
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            border: imagen.enlace ? '1px solid #86efac' : '1px solid #cbd5e1',
            background: imagen.enlace ? '#f0fdf4' : '#ffffff',
            color: imagen.enlace ? '#16a34a' : '#475569',
            fontWeight: imagen.enlace ? 600 : 400,
            cursor: 'pointer',
          }}
          title={imagen.enlace ? `Enlace a: ${imagen.enlace.titulo || 'nota'}` : 'Enlazar esta imagen a otra nota'}
          onClick={() => setModalElegirNota(true)}
        >
          {imagen.enlace ? 'Enlazada' : 'Enlazar nota'}
        </button>

        {imagen.enlace && (
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '11px', padding: '3px 6px', color: '#ef4444', border: '1px solid #fecaca', background: '#fff' }}
            title="Quitar enlace"
            onClick={() => cambiarEstilo({ enlace: null })}
          >
            Cerrar
          </button>
        )}
      </div>

      {modalOclusion && (
        <ModalOclusionImagen
          imagen={elReal}
          motorRef={motorRef}
          alCerrar={() => setModalOclusion(false)}
          alEstudiar={() => {
            setModalOclusion(false);
            setModalEstudio(true);
          }}
        />
      )}

      {modalEstudio && (
        <EstudioImagen
          imagen={elReal}
          onSalir={() => setModalEstudio(false)}
        />
      )}

      {modalElegirNota && (
        <ModalSeleccionarNota
          alSeleccionar={(notaDestino) => {
            setModalElegirNota(false);
            cambiarEstilo({
              enlace: {
                tipo: 'nota',
                notaId: notaDestino.id,
                titulo: notaDestino.titulo,
              },
            });
          }}
          alCerrar={() => setModalElegirNota(false)}
        />
      )}
    </div>
  );
}
