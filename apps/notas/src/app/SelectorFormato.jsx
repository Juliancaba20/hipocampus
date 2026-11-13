import { useState, useEffect, useMemo } from 'react';
import { FORMATOS, MODOS_ESCRITURA, crearDocumento, guardarDocumento } from '../almacen/index.js';
import { Modal } from './Modal.jsx';
import { normalizarPersonalizado } from '../formatos/tarjetas.js';
import {
  listarTodasLasPlantillas,
  crearDocumentoDesdePlantilla,
} from '../plantillas/index.js';
import ModalGestionPlantillas from './ModalGestionPlantillas.jsx';

const OPCIONES_FORMATO = [
  { id: FORMATOS.PIZARRON, nombre: 'Pizarrón infinito', texto: 'Espacio libre para moverse en cualquier dirección.' },
  { id: FORMATOS.PAGINAS, nombre: 'Páginas A4', texto: 'Hojas una debajo de otra, como un documento.' },
  { id: FORMATOS.TARJETAS, nombre: 'Tarjetas', texto: 'Una idea por tarjeta, pensadas para imprimir.' },
];

export function Miniatura({ formato }) {
  return <div className="nt-mini"><i className={`nt-mini__${formato}`} /></div>;
}

export function SelectorFormato({ alCerrar, alCrear, carpetaId = null }) {
  const [pestana, setPestana] = useState('blanco'); // 'blanco' | 'plantillas'

  // Estados para formato en blanco
  const [formato, setFormato] = useState(FORMATOS.PIZARRON);
  const [titulo, setTitulo] = useState('Sin título');
  const [escritura, setEscritura] = useState(MODOS_ESCRITURA.AMBOS);
  const [estilo, setEstilo] = useState('rayado');
  const [tamano, setTamano] = useState('16:9');
  const [anchoMm, setAnchoMm] = useState(150);
  const [altoMm, setAltoMm] = useState(100);

  // Estados para plantillas
  const [plantillas, setPlantillas] = useState([]);
  const [filtroFormato, setFiltroFormato] = useState('todas');
  const [plantillaSelId, setPlantillaSelId] = useState('cornell');
  const [tituloPlantilla, setTituloPlantilla] = useState('');
  const [modalGestion, setModalGestion] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function cargarPlantillas() {
    try {
      const lista = await listarTodasLasPlantillas();
      setPlantillas(lista);
      if (lista.length > 0 && !lista.some((p) => p.id === plantillaSelId)) {
        setPlantillaSelId(lista[0].id);
        setTituloPlantilla(lista[0].nombre);
      }
    } catch {
      /* lista fallback */
    }
  }

  useEffect(() => {
    cargarPlantillas();
  }, []);

  const plantillasFiltradas = useMemo(() => {
    if (filtroFormato === 'todas') return plantillas;
    if (filtroFormato === 'propias') return plantillas.filter((p) => p.esPropia);
    return plantillas.filter((p) => p.formato === filtroFormato);
  }, [plantillas, filtroFormato]);

  const plantillaSeleccionada = useMemo(
    () => plantillas.find((p) => p.id === plantillaSelId) || plantillas[0],
    [plantillas, plantillaSelId],
  );

  useEffect(() => {
    if (plantillaSeleccionada && !tituloPlantilla) {
      setTituloPlantilla(plantillaSeleccionada.nombre);
    }
  }, [plantillaSeleccionada, tituloPlantilla]);

  async function crearEnBlanco(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const persNorm = normalizarPersonalizado({ anchoMm, altoMm });
      const config = formato === FORMATOS.TARJETAS
        ? (tamano === 'personalizado' ? { tamano: 'personalizado', personalizado: persNorm } : { tamano })
        : {};
      const doc = await guardarDocumento(crearDocumento({
        titulo: titulo.trim() || 'Sin título',
        formato,
        escritura,
        estiloRenglones: estilo,
        carpetaId: carpetaId || null,
        config,
      }));
      alCrear(doc);
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  async function crearConPlantilla(e) {
    e.preventDefault();
    if (!plantillaSeleccionada) return;
    setCargando(true);
    setError('');
    try {
      const res = await crearDocumentoDesdePlantilla(plantillaSeleccionada, {
        titulo: tituloPlantilla.trim() || plantillaSeleccionada.nombre,
        carpetaId: carpetaId || null,
      });
      alCrear(res.doc);
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  return (
    <>
      <Modal titulo="Nueva nota" alCerrar={alCerrar} ancho={760}>
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Selector de pestañas */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '4px',
              background: 'var(--nt-papel, #f1f5f9)',
              borderRadius: '10px',
              width: 'max-content',
            }}
            role="tablist"
            aria-label="Tipo de nota"
          >
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'blanco'}
              className={`nt-btn ${pestana === 'blanco' ? 'nt-btn--primario' : ''}`}
              style={{ minHeight: '34px', padding: '0 16px', fontSize: '13.5px' }}
              onClick={() => setPestana('blanco')}
            >
              Formato en blanco
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'plantillas'}
              className={`nt-btn ${pestana === 'plantillas' ? 'nt-btn--primario' : ''}`}
              style={{ minHeight: '34px', padding: '0 16px', fontSize: '13.5px' }}
              onClick={() => setPestana('plantillas')}
            >
              Plantillas de estudio
            </button>
          </div>

          {pestana === 'blanco' ? (
            <form onSubmit={crearEnBlanco}>
              <div className="nt-formatos" role="radiogroup" aria-label="Formato">
                {OPCIONES_FORMATO.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    role="radio"
                    aria-checked={formato === o.id}
                    className={`nt-formato ${formato === o.id ? 'nt-formato--sel' : ''}`}
                    onClick={() => setFormato(o.id)}
                  >
                    <Miniatura formato={o.id} />
                    <b>{o.nombre}</b>
                    <small>{o.texto}</small>
                  </button>
                ))}
              </div>

              <div className="nt-fila nt-campos">
                <label>
                  Título
                  <input
                    className="nt-campo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                  />
                </label>
                <label>
                  Escritura
                  <select className="nt-campo" value={escritura} onChange={(e) => setEscritura(e.target.value)}>
                    <option value={MODOS_ESCRITURA.AMBOS}>A mano y con teclado</option>
                    <option value={MODOS_ESCRITURA.MANO}>Solo a mano</option>
                    <option value={MODOS_ESCRITURA.TECLADO}>Solo con teclado</option>
                  </select>
                </label>
                <label>
                  Renglones
                  <select className="nt-campo" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
                    <option value="rayado">Rayado</option>
                    <option value="cuadriculado">Cuadriculado</option>
                    <option value="puntos">Puntos</option>
                    <option value="liso">Liso</option>
                  </select>
                </label>

                {formato === FORMATOS.TARJETAS && (
                  <>
                    <label>
                      Tamaño de tarjeta
                      <select className="nt-campo" value={tamano} onChange={(e) => setTamano(e.target.value)}>
                        <option value="16:9">16:9</option>
                        <option value="4:3">4:3</option>
                        <option value="A6">A6</option>
                        <option value="A5">A5</option>
                        <option value="personalizado">Personalizado</option>
                      </select>
                    </label>
                    {tamano === 'personalizado' && (
                      <>
                        <label>
                          Ancho (mm)
                          <input
                            type="number"
                            className="nt-campo"
                            min={40}
                            max={400}
                            value={anchoMm}
                            onChange={(e) => setAnchoMm(e.target.value)}
                            onBlur={() => {
                              const norm = normalizarPersonalizado({ anchoMm, altoMm });
                              setAnchoMm(norm.anchoMm);
                              setAltoMm(norm.altoMm);
                            }}
                          />
                        </label>
                        <label>
                          Alto (mm)
                          <input
                            type="number"
                            className="nt-campo"
                            min={40}
                            max={400}
                            value={altoMm}
                            onChange={(e) => setAltoMm(e.target.value)}
                            onBlur={() => {
                              const norm = normalizarPersonalizado({ anchoMm, altoMm });
                              setAnchoMm(norm.anchoMm);
                              setAltoMm(norm.altoMm);
                            }}
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
              </div>

              {error && <p className="nt-aviso" role="alert">{error}</p>}
              <div className="nt-acciones">
                <button type="button" className="nt-btn" onClick={alCerrar} disabled={cargando}>
                  Cancelar
                </button>
                <button type="submit" className="nt-btn nt-btn--primario" disabled={cargando}>
                  {cargando ? 'Creando…' : 'Crear nota'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={crearConPlantilla}>
              {/* Filtros de plantillas */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="group" aria-label="Filtro de formato">
                  {[
                    { id: 'todas', label: 'Todas' },
                    { id: FORMATOS.PAGINAS, label: 'Páginas A4' },
                    { id: FORMATOS.TARJETAS, label: 'Tarjetas' },
                    { id: FORMATOS.PIZARRON, label: 'Pizarrón' },
                    { id: 'propias', label: 'Mis plantillas' },
                  ].map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      className={`nt-btn ${filtroFormato === f.id ? 'nt-btn--primario' : ''}`}
                      style={{ minHeight: '30px', padding: '0 10px', fontSize: '12.5px' }}
                      onClick={() => setFiltroFormato(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="nt-btn"
                  style={{ minHeight: '30px', padding: '0 10px', fontSize: '12.5px' }}
                  onClick={() => setModalGestion(true)}
                  title="Gestionar mis plantillas personalizadas"
                >
                  Gestionar propias
                </button>
              </div>

              {/* Cuadrícula de plantillas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '12px',
                  maxHeight: '38vh',
                  overflowY: 'auto',
                  padding: '2px',
                  marginBottom: '16px',
                }}
                role="radiogroup"
                aria-label="Plantillas disponibles"
              >
                {plantillasFiltradas.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    No se encontraron plantillas para el filtro seleccionado.
                  </div>
                ) : (
                  plantillasFiltradas.map((p) => {
                    const sel = plantillaSelId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        className={`nt-formato ${sel ? 'nt-formato--sel' : ''}`}
                        style={{ padding: '12px', position: 'relative' }}
                        onClick={() => {
                          setPlantillaSelId(p.id);
                          setTituloPlantilla(p.nombre);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span />
                          <span
                            className="nt-etiqueta"
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              background: p.esPropia ? '#fef3c7' : '#e0f2fe',
                              color: p.esPropia ? '#92400e' : '#0369a1',
                            }}
                          >
                            {p.esPropia ? 'Propia' : p.formato === 'paginas' ? 'Páginas' : p.formato === 'tarjetas' ? 'Tarjetas' : 'Pizarrón'}
                          </span>
                        </div>
                        <b style={{ fontSize: '14.5px', marginTop: '6px' }}>{p.nombre}</b>
                        <small style={{ color: '#64748b', fontSize: '12px', lineHeight: '1.35' }}>{p.descripcion}</small>
                      </button>
                    );
                  })
                )}
              </div>

              {plantillaSeleccionada && (
                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600 }}>
                    Título de la nota a crear
                    <input
                      className="nt-campo"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={tituloPlantilla}
                      onChange={(e) => setTituloPlantilla(e.target.value)}
                      placeholder="Nombre de la nueva nota…"
                      autoFocus
                    />
                  </label>
                </div>
              )}

              {error && <p className="nt-aviso" role="alert" style={{ marginTop: '12px' }}>{error}</p>}

              <div className="nt-acciones">
                <button type="button" className="nt-btn" onClick={alCerrar} disabled={cargando}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="nt-btn nt-btn--primario"
                  disabled={!plantillaSeleccionada || cargando}
                >
                  {cargando ? 'Creando…' : `Crear desde «${plantillaSeleccionada?.nombre || 'plantilla'}»`}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {modalGestion && (
        <ModalGestionPlantillas
          alCerrar={() => setModalGestion(false)}
          alCambiar={cargarPlantillas}
        />
      )}
    </>
  );
}
