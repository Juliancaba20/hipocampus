import { useState } from 'react';
import { CATALOGO_FUENTES, INTERLINEADOS, TAMANOS_TEXTO, obtenerCatalogoEstilos } from '../herramientas/texto/estilo.js';
import SelectorSimbolos from './SelectorSimbolos.jsx';
import ModalSeleccionarNota from './ModalSeleccionarNota.jsx';

// Barra de formato del texto con teclado (Etapas 6, 20A y 20B). Los botones no le quitan el foco al texto
// (onMouseDown con preventDefault), así la selección se conserva al dar formato.
const sinFoco = (e) => e.preventDefault();

function Bt({ nombre, activo, deshabilitado, alPulsar, children, ancho, className = '' }) {
  return (
    <button
      type="button"
      className={`nt-bt ${activo ? 'nt-bt--on' : ''} ${className}`}
      title={nombre}
      aria-label={nombre}
      aria-pressed={activo === undefined ? undefined : !!activo}
      disabled={deshabilitado}
      style={ancho ? { minWidth: ancho } : undefined}
      onMouseDown={sinFoco}
      onClick={alPulsar}
    >
      {children}
    </button>
  );
}

const Linea = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

const ALINEAR = {
  izquierda: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  centro: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  derecha: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  justificado: 'M4 6h16M4 10h16M4 14h16M4 18h16',
};

const LISTA = {
  vineta: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  numero: 'M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.5 13.5h2l-2 3h2.2M3.5 19h2v1.2h-1.2v1.3h1.2',
};

const ICONO_PINCEL = 'M19.4 7.34l-2.74-2.74a2 2 0 0 0-2.83 0L3 15.42V20h4.58l10.82-10.83a2 2 0 0 0 0-2.83zM6.77 18H5v-1.77l9-9 1.77 1.77-9 9z';
const ICONO_ENLACE = 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';
const ICONO_SALTO = 'M19 14l-4 4m0 0l-4-4m4 4V3M5 21h14';

const COLORES = [
  ['#14192b', 'Negro (automático)'],
  ['#2350d8', 'Azul'],
  ['#d6336c', 'Rosa'],
  ['#1f9d55', 'Verde'],
  ['#e67700', 'Naranja'],
  ['#7048e8', 'Violeta'],
  ['#868e96', 'Gris'],
];

const RESALTADOS = [
  ['#ffe066', 'Amarillo'],
  ['#b2f2bb', 'Verde'],
  ['#ffc9de', 'Rosa'],
  ['#bfe3ff', 'Celeste'],
];

const FONDOS_CELDA = [
  ['#f8fafc', 'Gris muy claro'],
  ['#f1f5f9', 'Pizarra claro'],
  ['#fee2e2', 'Rojo claro'],
  ['#fef3c7', 'Ámbar claro'],
  ['#dcfce7', 'Verde claro'],
  ['#e0e7ff', 'Índigo claro'],
  ['#e0f2fe', 'Cielo claro'],
  ['#f3e8ff', 'Púrpura claro'],
  ['#fce7f3', 'Rosa claro'],
];

export default function BarraTexto({ estado, motorRef, estilosDoc, onAbrirEstilos }) {
  const f = (accion, valor, extra) => motorRef.current?.formatoTexto(accion, valor, extra);
  const t = estado || {};
  const [popoverFondoCelda, setPopoverFondoCelda] = useState(false);

  const [popoverEnlace, setPopoverEnlace] = useState(false);
  const [urlEnlace, setUrlEnlace] = useState('');
  const [modalElegirNota, setModalElegirNota] = useState(false);
  const [popoverNotaPie, setPopoverNotaPie] = useState(false);
  const [textoNotaPie, setTextoNotaPie] = useState('');

  const conteo = t.conteoSeleccion || t.conteoTotal;
  const esSeleccion = !!t.conteoSeleccion;
  const catalogoEstilos = obtenerCatalogoEstilos(estilosDoc);

  const abrirDialogoEnlace = () => {
    setUrlEnlace(t.enlace ? t.enlace.url : 'https://');
    setPopoverEnlace(true);
    setPopoverNotaPie(false);
  };

  const aplicarEnlace = (e) => {
    e.preventDefault();
    if (urlEnlace.trim()) {
      f('enlace', urlEnlace.trim());
    } else {
      f('enlace', null);
    }
    setPopoverEnlace(false);
  };

  const quitarEnlace = () => {
    f('enlace', null);
    setPopoverEnlace(false);
  };

  const abrirDialogoNotaPie = () => {
    setTextoNotaPie(t.notaAlPie || '');
    setPopoverNotaPie(true);
    setPopoverEnlace(false);
  };

  const aplicarNotaPie = (e) => {
    e.preventDefault();
    if (textoNotaPie.trim()) {
      f('notaAlPie', textoNotaPie.trim());
    }
    setPopoverNotaPie(false);
  };

  return (
    <div className="nt-props nt-barra-texto" data-nt-barra role="toolbar" aria-label="Formato del texto" style={{ position: 'relative' }}>
      {/* Estilos de párrafo reutilizables */}
      <div className="nt-grupo" role="group" aria-label="Estilo del párrafo">
        <select
          className="nt-select-estilo"
          value={t.estilo || 'normal'}
          onChange={(e) => {
            if (e.target.value === '__gestionar__') {
              onAbrirEstilos?.();
            } else {
              f('estilo', e.target.value);
            }
          }}
          onMouseDown={sinFoco}
          title="Estilo de párrafo reutilizable (Etapa 20B)"
          aria-label="Estilo de párrafo"
          disabled={t.enTabla}
          style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 600 }}
        >
          {Object.values(catalogoEstilos).map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
          <option value="__gestionar__">Personalizar estilos...</option>
        </select>
      </div>

      {/* Fuente autoalojada */}
      <div className="nt-grupo" role="group" aria-label="Tipografía">
        <select
          className="nt-select-fuente"
          value={t.fuente || 'serif'}
          onChange={(e) => f('fuente', e.target.value)}
          onMouseDown={sinFoco}
          title="Tipografía del texto o selección"
          aria-label="Tipografía"
        >
          {Object.values(CATALOGO_FUENTES).map((cfg) => (
            <option key={cfg.id} value={cfg.id}>{cfg.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tamaño de letra */}
      <div className="nt-grupo" role="group" aria-label="Tamaño">
        <Bt nombre="Letra más chica" deshabilitado={t.tamano <= TAMANOS_TEXTO[0]} alPulsar={() => f('tamano', 'menos')}>A−</Bt>
        <span className="nt-tam" aria-live="polite">{Math.round(t.tamano || 20)}</span>
        <Bt nombre="Letra más grande" deshabilitado={t.tamano >= TAMANOS_TEXTO[TAMANOS_TEXTO.length - 1]} alPulsar={() => f('tamano', 'mas')}>A+</Bt>
      </div>

      {/* Formato de carácter */}
      <div className="nt-grupo" role="group" aria-label="Formato de letra">
        <Bt nombre="Negrita (Ctrl+B)" activo={t.negrita} alPulsar={() => f('negrita')}><b>N</b></Bt>
        <Bt nombre="Cursiva (Ctrl+I)" activo={t.cursiva} alPulsar={() => f('cursiva')}><i>C</i></Bt>
        <Bt nombre="Subrayado (Ctrl+U)" activo={t.subrayado} alPulsar={() => f('subrayado')}><u>S</u></Bt>
        <Bt nombre="Tachado (Ctrl+Mayús+X)" activo={t.tachado} alPulsar={() => f('tachado')}><s>T</s></Bt>
        <Bt nombre="Subíndice (ej. H₂O)" activo={t.subindice} alPulsar={() => f('subindice')}>
          <span>X<sub style={{ fontSize: '10px' }}>2</sub></span>
        </Bt>
        <Bt nombre="Superíndice (ej. Ca²⁺, x²)" activo={t.superindice} alPulsar={() => f('superindice')}>
          <span>X<sup style={{ fontSize: '10px' }}>2</sup></span>
        </Bt>
        <Bt
          nombre="Texto oculto (cloze) para fichas de estudio (Ctrl+Mayús+C)"
          activo={t.oculto}
          alPulsar={() => f('oculto')}
        >
          <span style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '-0.5px' }}>[...]</span>
        </Bt>
        <Bt
          nombre={t.pincelActivo ? 'Formato copiado. Seleccione texto para aplicarlo' : 'Copiar formato (Pincel)'}
          activo={t.pincelActivo}
          alPulsar={() => f('copiarFormato')}
        >
          <Linea d={ICONO_PINCEL} />
        </Bt>
      </div>

      {/* Estructura: Enlace, Nota al pie, Salto de página */}
      <div className="nt-grupo" role="group" aria-label="Estructura">
        <Bt
          nombre="Enlace web (Ctrl+K)"
          activo={!!t.enlace}
          alPulsar={abrirDialogoEnlace}
        >
          <Linea d={ICONO_ENLACE} />
        </Bt>
        <Bt
          nombre="Nota al pie en página A4"
          activo={!!t.notaAlPie}
          alPulsar={abrirDialogoNotaPie}
        >
          <span>[¹]</span>
        </Bt>
        <Bt
          nombre="Insertar salto de página (A4)"
          alPulsar={() => f('saltoPagina')}
        >
          <Linea d={ICONO_SALTO} />
        </Bt>
      </div>

      {/* Popover de Enlace */}
      {popoverEnlace && (
        <form
          onSubmit={aplicarEnlace}
          style={{
            position: 'absolute',
            top: '46px',
            left: '260px',
            zIndex: 100,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Enlace:</span>
          <input
            type="text"
            value={urlEnlace}
            onChange={(e) => setUrlEnlace(e.target.value)}
            placeholder="https://ejemplo.com"
            autoFocus
            style={{ width: '180px', padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
          <button type="submit" className="nt-btn nt-btn--primario" style={{ fontSize: '11px', padding: '4px 8px' }}>
            Guardar
          </button>
          <button
            type="button"
            className="nt-btn"
            style={{ fontSize: '11px', padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
            title="Elegir una nota existente de la biblioteca"
            onClick={() => {
              setPopoverEnlace(false);
              setModalElegirNota(true);
            }}
          >
            Elegir nota…
          </button>
          {t.enlace && (
            <button type="button" className="nt-btn nt-btn--secundario" style={{ fontSize: '11px', color: '#b91c1c' }} onClick={quitarEnlace}>
              Quitar
            </button>
          )}
          <button type="button" className="nt-ib" style={{ fontSize: '12px' }} onClick={() => setPopoverEnlace(false)}>Cerrar</button>
        </form>
      )}

      {modalElegirNota && (
        <ModalSeleccionarNota
          alSeleccionar={(notaDestino) => {
            setModalElegirNota(false);
            f('enlace', { tipo: 'nota', notaId: notaDestino.id, url: notaDestino.titulo });
          }}
          alCerrar={() => setModalElegirNota(false)}
        />
      )}

      {/* Popover de Nota al pie */}
      {popoverNotaPie && (
        <form
          onSubmit={aplicarNotaPie}
          style={{
            position: 'absolute',
            top: '46px',
            left: '320px',
            zIndex: 100,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Nota al pie:</span>
          <input
            type="text"
            value={textoNotaPie}
            onChange={(e) => setTextoNotaPie(e.target.value)}
            placeholder="Texto explicativo al pie de página..."
            autoFocus
            style={{ width: '260px', padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
          <button type="submit" className="nt-btn nt-btn--primario" style={{ fontSize: '11px', padding: '4px 10px' }}>
            Insertar
          </button>
          <button type="button" className="nt-ib" style={{ fontSize: '12px' }} onClick={() => setPopoverNotaPie(false)}>Cerrar</button>
        </form>
      )}

      {/* Listas, sangría y alineación */}
      <div className="nt-grupo" role="group" aria-label="Listas y alineación">
        <Bt nombre="Lista con viñetas (Ctrl+Mayús+8)" activo={t.lista === 'vineta'} deshabilitado={t.enTabla} alPulsar={() => f('lista', 'vineta')}><Linea d={LISTA.vineta} /></Bt>
        <Bt nombre="Lista numerada (Ctrl+Mayús+7)" activo={t.lista === 'numero'} deshabilitado={t.enTabla} alPulsar={() => f('lista', 'numero')}><Linea d={LISTA.numero} /></Bt>
        <Bt nombre="Disminuir sangría (Mayús+Tab)" deshabilitado={t.enTabla || (t.lista ? t.nivel === 0 : !t.sangria)} alPulsar={() => f('sangria', 'menos')}>Menos sangría</Bt>
        <Bt nombre="Aumentar sangría (Tab)" deshabilitado={t.enTabla || (t.lista ? t.nivel >= 2 : (t.sangria || 0) >= 5)} alPulsar={() => f('sangria', 'mas')}>Más sangría</Bt>
        {['izquierda', 'centro', 'derecha', 'justificado'].map((a) => (
          <Bt
            key={a}
            nombre={`Alinear ${a === 'centro' ? 'al centro' : a === 'justificado' ? 'justificado' : `a la ${a}`}`}
            activo={t.alinear === a}
            deshabilitado={t.enTabla}
            alPulsar={() => f('alinear', a)}
          >
            <Linea d={ALINEAR[a]} />
          </Bt>
        ))}
      </div>

      {/* Interlineado */}
      <div className="nt-grupo" role="group" aria-label="Interlineado">
        <select
          className="nt-select-interlineado"
          value={t.interlineado ? String(t.interlineado) : '1.4'}
          onChange={(e) => f('interlineado', parseFloat(e.target.value))}
          onMouseDown={sinFoco}
          title="Interlineado de párrafo"
          aria-label="Interlineado"
          disabled={t.enTabla}
        >
          {INTERLINEADOS.map((val) => (
            <option key={val} value={String(val)}>{val}×</option>
          ))}
        </select>
      </div>

      {/* Color y resaltado */}
      <div className="nt-grupo" role="group" aria-label="Color de la letra">
        {COLORES.map(([c, n]) => (
          <button
            key={c}
            type="button"
            aria-label={`Letra ${n}`}
            title={`Letra ${n}`}
            className="nt-color nt-color--chico"
            style={{ background: c }}
            onMouseDown={sinFoco}
            onClick={() => f('color', c === '#14192b' ? null : c)}
          />
        ))}
      </div>
      <div className="nt-grupo" role="group" aria-label="Resaltado">
        {RESALTADOS.map(([c, n]) => (
          <button
            key={c}
            type="button"
            aria-label={`Resaltar en ${n.toLowerCase()}`}
            title={`Resaltar en ${n.toLowerCase()}`}
            className="nt-color nt-color--chico"
            style={{ background: c }}
            onMouseDown={sinFoco}
            onClick={() => f('resaltado', c)}
          />
        ))}
        <Bt nombre="Quitar resaltado" alPulsar={() => f('resaltado', null)}>Sin resaltado</Bt>
      </div>

      <SelectorSimbolos motorRef={motorRef} />

      {/* Tablas */}
      <div className="nt-grupo" role="group" aria-label="Tabla">
        {!t.enTabla && <Bt nombre="Insertar tabla de 3 × 3" alPulsar={() => f('tabla', 'insertar')}>Tabla</Bt>}
        {t.enTabla && (
          <>
            <Bt nombre="Agregar fila debajo" alPulsar={() => f('tabla', 'fila+')}>+ Fila</Bt>
            <Bt nombre="Agregar columna a la derecha" alPulsar={() => f('tabla', 'col+')}>+ Col.</Bt>
            <Bt nombre="Quitar esta fila" alPulsar={() => f('tabla', 'fila-')}>− Fila</Bt>
            <Bt nombre="Quitar esta columna" alPulsar={() => f('tabla', 'col-')}>− Col.</Bt>
            <Bt nombre="Fila de encabezado" activo={t.encabezado} alPulsar={() => f('tabla', 'encabezado')}>Encab.</Bt>
            <Bt nombre="Combinar con celda a la derecha" alPulsar={() => f('tabla', 'combinar')}>Combinar</Bt>
            <Bt nombre="Dividir celdas combinadas" deshabilitado={(t.celdaColspan || 1) <= 1 && (t.celdaRowspan || 1) <= 1} alPulsar={() => f('tabla', 'dividir')}>Dividir</Bt>
            <Bt nombre="Alinear arriba en celda" activo={t.celdaAlinearV === 'arriba'} alPulsar={() => f('tabla', 'alinearV', 'arriba')}>Arriba</Bt>
            <Bt nombre="Alinear al centro en celda" activo={t.celdaAlinearV === 'centro'} alPulsar={() => f('tabla', 'alinearV', 'centro')}>Centro</Bt>
            <Bt nombre="Alinear abajo en celda" activo={t.celdaAlinearV === 'abajo'} alPulsar={() => f('tabla', 'alinearV', 'abajo')}>Abajo</Bt>
            <Bt nombre="Color de fondo de celda" activo={!!t.celdaFondo} alPulsar={() => setPopoverFondoCelda((v) => !v)}>Fondo</Bt>
            <select
              className="nt-select-interlineado"
              style={{ width: '92px', fontSize: '11px' }}
              value={t.tablaBordes || 'todos'}
              onChange={(e) => f('tabla', 'bordes', { estilo: e.target.value })}
              title="Bordes de tabla"
              onMouseDown={sinFoco}
            >
              <option value="todos">Todos bordes</option>
              <option value="grilla">Grilla</option>
              <option value="externo">Solo ext.</option>
              <option value="filas">Solo filas</option>
              <option value="ninguno">Sin bordes</option>
            </select>
            <Bt nombre="Eliminar la tabla" alPulsar={() => f('tabla', 'borrar')}>Quitar tabla</Bt>
          </>
        )}
      </div>

      {/* Popover de Fondo de Celda */}
      {popoverFondoCelda && (
        <div
          style={{
            position: 'absolute',
            top: '46px',
            right: '180px',
            zIndex: 100,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>Fondo:</span>
          {FONDOS_CELDA.map(([c, n]) => (
            <button
              key={c}
              type="button"
              title={n}
              className="nt-color nt-color--chico"
              style={{ background: c, border: '1px solid #cbd5e1' }}
              onMouseDown={sinFoco}
              onClick={() => {
                f('tabla', 'fondo', c);
                setPopoverFondoCelda(false);
              }}
            />
          ))}
          <button
            type="button"
            className="nt-btn nt-btn--secundario"
            style={{ fontSize: '11px', padding: '2px 6px' }}
            onMouseDown={sinFoco}
            onClick={() => {
              f('tabla', 'fondo', null);
              setPopoverFondoCelda(false);
            }}
          >
            Quitar
          </button>
          <button type="button" className="nt-ib" style={{ fontSize: '12px' }} onClick={() => setPopoverFondoCelda(false)}>Cerrar</button>
        </div>
      )}

      {/* Contador de palabras y caracteres */}
      {conteo && (
        <div className="nt-conteo-texto" title={esSeleccion ? 'Palabras y caracteres de la selección' : 'Palabras y caracteres del texto completo'}>
          <span className="nt-conteo-texto__item">
            <strong>{conteo.palabras}</strong> {conteo.palabras === 1 ? 'palabra' : 'palabras'}
          </span>
          <span className="nt-conteo-texto__sep">·</span>
          <span className="nt-conteo-texto__item">
            <strong>{conteo.caracteres}</strong> {conteo.caracteres === 1 ? 'carácter' : 'caracteres'}
          </span>
          {esSeleccion && <span className="nt-conteo-texto__badge">selección</span>}
        </div>
      )}

      <button type="button" className="nt-btn nt-btn--primario" onMouseDown={sinFoco} onClick={() => f('terminar')} title="Terminar de escribir (Esc)">Listo</button>
    </div>
  );
}
