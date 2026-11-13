// Barra de búsqueda dentro del documento abierto (Etapa 18B).
// Soporta los 3 formatos (Pizarrón, Páginas A4, Tarjetas).
// Contador «3 de 12», anterior, siguiente, resaltado de coincidencias y
// panel expandible preparado para «Reemplazar» en la Etapa 20.

import { useEffect, useRef, useState } from 'react';
import { buscarEnDocumento, reemplazarEnDocumento } from '../herramientas/busqueda/documento.js';

export default function BarraBusquedaDocumento({
  visible = true,
  alCerrar,
  elementos = null,
  obtenerElementos = null,
  alSaltar,
  motor = null,
  motorRef = null,
}) {
  const [consulta, setConsulta] = useState('');
  const [coincidencias, setCoincidencias] = useState([]);
  const [indiceActual, setIndiceActual] = useState(0);
  const [mostrarReemplazar, setMostrarReemplazar] = useState(false);
  const [coincidirMayus, setCoincidirMayus] = useState(false);
  const [reemplazo, setReemplazo] = useState('');
  const [mensajeReemplazo, setMensajeReemplazo] = useState('');
  const inputRef = useRef(null);

  function ejecutarBusqueda(texto, mayus = coincidirMayus) {
    const q = texto.trim();
    const m = motor || motorRef?.current;
    if (!q) {
      setCoincidencias([]);
      setIndiceActual(0);
      m?.setResaltadosBusqueda([], null);
      return;
    }

    const lista = obtenerElementos ? obtenerElementos() : (elementos || m?.escena?.lista() || []);
    const encontradas = buscarEnDocumento(q, lista, { coincidirMayusculas: mayus });
    setCoincidencias(encontradas);
    setIndiceActual(0);

    const cajas = encontradas.map((c) => ({
      id: c.id,
      x: c.cajaDestacada.x,
      y: c.cajaDestacada.y,
      ancho: c.cajaDestacada.ancho,
      alto: c.cajaDestacada.alto,
      contenedor: c.cajaDestacada.contenedor ?? c.ubicacion?.contenedor ?? null,
    }));

    const primera = encontradas[0] || null;
    m?.setResaltadosBusqueda(cajas, primera);

    if (primera && alSaltar) {
      alSaltar(primera);
    }
  }

  // Manejador del cambio en el campo de búsqueda
  function alCambiarConsulta(e) {
    const texto = e.target.value;
    setConsulta(texto);
    ejecutarBusqueda(texto, coincidirMayus);
  }

  function alternarMayusculas() {
    const nueva = !coincidirMayus;
    setCoincidirMayus(nueva);
    ejecutarBusqueda(consulta, nueva);
  }

  // Enfocar el campo cuando se hace visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [visible]);

  // Limpiar resaltados al desmontar
  useEffect(() => {
    const m = motor || motorRef?.current;
    return () => {
      m?.setResaltadosBusqueda([], null);
    };
  }, [motor, motorRef]);

  function saltarA(nuevoIndice) {
    if (!coincidencias.length) return;
    const n = (nuevoIndice + coincidencias.length) % coincidencias.length;
    setIndiceActual(n);
    const activa = coincidencias[n];
    const cajas = coincidencias.map((c) => ({
      id: c.id,
      x: c.cajaDestacada.x,
      y: c.cajaDestacada.y,
      ancho: c.cajaDestacada.ancho,
      alto: c.cajaDestacada.alto,
      contenedor: c.cajaDestacada.contenedor ?? c.ubicacion?.contenedor ?? null,
    }));
    const m = motor || motorRef?.current;
    m?.setResaltadosBusqueda(cajas, activa);
    if (activa && alSaltar) {
      alSaltar(activa);
    }
  }

  function irSiguiente() {
    if (coincidencias.length <= 1) return;
    saltarA(indiceActual + 1);
  }

  function irAnterior() {
    if (coincidencias.length <= 1) return;
    saltarA(indiceActual - 1);
  }

  function alReemplazarUno() {
    if (!coincidencias.length || !consulta.trim()) return;
    const m = motor || motorRef?.current;
    const activa = coincidencias[indiceActual];
    const lista = obtenerElementos ? obtenerElementos() : (elementos || m?.escena?.lista() || []);

    const res = reemplazarEnDocumento({
      consulta: consulta.trim(),
      reemplazo,
      coincidirMayusculas: coincidirMayus,
      reemplazarTodos: false,
      coincidenciaActiva: activa,
      elementos: lista,
      escena: m?.escena,
    });

    if (res.totalReemplazos > 0) {
      setMensajeReemplazo('1 reemplazado');
      setTimeout(() => setMensajeReemplazo(''), 2500);
      ejecutarBusqueda(consulta, coincidirMayus);
    }
  }

  function alReemplazarTodos() {
    if (!coincidencias.length || !consulta.trim()) return;
    const m = motor || motorRef?.current;
    const lista = obtenerElementos ? obtenerElementos() : (elementos || m?.escena?.lista() || []);

    const res = reemplazarEnDocumento({
      consulta: consulta.trim(),
      reemplazo,
      coincidirMayusculas: coincidirMayus,
      reemplazarTodos: true,
      elementos: lista,
      escena: m?.escena,
    });

    if (res.totalReemplazos > 0) {
      setMensajeReemplazo(`${res.totalReemplazos} reemplazados`);
      setTimeout(() => setMensajeReemplazo(''), 2500);
      ejecutarBusqueda(consulta, coincidirMayus);
    }
  }

  const manejarTeclas = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      alCerrar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) irAnterior();
      else irSiguiente();
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) irAnterior();
      else irSiguiente();
    }
  };

  if (!visible) return null;

  const total = coincidencias.length;
  let contadorTexto = '';
  if (consulta.trim()) {
    contadorTexto = total > 0 ? `${indiceActual + 1} de ${total}` : '0 de 0';
  }

  return (
    <div
      className="nt-barra-busqueda-doc"
      style={{
        position: 'fixed',
        top: '12px',
        right: '18px',
        zIndex: 90,
        background: 'var(--nt-fondo, #ffffff)',
        border: '1px solid var(--nt-borde, #ced4da)',
        borderRadius: '8px',
        boxShadow: '0 6px 16px rgba(20, 25, 43, 0.16)',
        padding: '6px 8px',
        display: 'grid',
        gap: '6px',
        minWidth: '340px',
        maxWidth: '92vw',
        fontSize: '13px',
      }}
      role="search"
      aria-label="Buscar en documento"
      onKeyDown={manejarTeclas}
    >
      {/* Fila principal: entrada, contador y navegación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          ref={inputRef}
          type="search"
          className="nt-campo"
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: '13px',
            borderRadius: '4px',
            minWidth: '140px',
          }}
          placeholder="Buscar en el documento (Ctrl+F)..."
          value={consulta}
          onChange={alCambiarConsulta}
          aria-label="Término a buscar"
        />

        {contadorTexto && (
          <span
            style={{
              fontSize: '12px',
              color: total === 0 ? 'var(--nt-error, #dc2626)' : 'var(--nt-suave, #6c757d)',
              whiteSpace: 'nowrap',
              padding: '0 4px',
              userSelect: 'none',
              fontWeight: 500,
            }}
          >
            {contadorTexto}
          </span>
        )}

        {/* Coincidir mayúsculas y minúsculas */}
        <button
          type="button"
          className={`nt-btn nt-btn--sm ${coincidirMayus ? 'nt-btn--primario' : ''}`}
          style={{ padding: '4px 6px', fontSize: '11px', fontWeight: 600 }}
          onClick={alternarMayusculas}
          title={coincidirMayus ? 'Distinguir mayúsculas activo' : 'Distinguir mayúsculas y minúsculas (Aa)'}
          aria-pressed={coincidirMayus}
        >
          Aa
        </button>

        {/* Botones de navegación Anterior / Siguiente */}
        <button
          type="button"
          className="nt-btn nt-btn--sm"
          style={{ padding: '4px 8px' }}
          disabled={total === 0}
          onClick={irAnterior}
          title="Coincidencia anterior (Shift+Enter)"
          aria-label="Anterior"
        >
          Anterior
        </button>
        <button
          type="button"
          className="nt-btn nt-btn--sm"
          style={{ padding: '4px 8px' }}
          disabled={total === 0}
          onClick={irSiguiente}
          title="Coincidencia siguiente (Enter)"
          aria-label="Siguiente"
        >
          Siguiente
        </button>

        {/* Desplegable para reemplazar */}
        <button
          type="button"
          className={`nt-btn nt-btn--sm ${mostrarReemplazar ? 'nt-btn--primario' : ''}`}
          style={{ padding: '4px 6px', fontSize: '11px' }}
          onClick={() => setMostrarReemplazar(!mostrarReemplazar)}
          title={mostrarReemplazar ? 'Ocultar reemplazar' : 'Mostrar opciones de reemplazar'}
          aria-expanded={mostrarReemplazar}
        >
          Reemplazar
        </button>

        {/* Cerrar barra de búsqueda */}
        <button
          type="button"
          className="nt-btn nt-btn--sm"
          style={{ padding: '4px 8px' }}
          onClick={alCerrar}
          title="Cerrar búsqueda (Esc)"
          aria-label="Cerrar"
        >
          Cerrar
        </button>
      </div>

      {/* Fila secundaria: interfaz de Reemplazar */}
      {mostrarReemplazar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderTop: '1px solid var(--nt-borde, #e9ecef)',
            paddingTop: '6px',
          }}
        >
          <input
            type="text"
            className="nt-campo"
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: '13px',
              borderRadius: '4px',
            }}
            placeholder="Reemplazar por..."
            value={reemplazo}
            onChange={(e) => setReemplazo(e.target.value)}
            title="Texto de sustitución"
          />
          <button
            type="button"
            className="nt-btn nt-btn--sm"
            style={{ fontSize: '11px' }}
            disabled={total === 0}
            onClick={alReemplazarUno}
            title="Reemplazar coincidencia actual (deshacer con Ctrl+Z)"
          >
            Reemplazar
          </button>
          <button
            type="button"
            className="nt-btn nt-btn--sm nt-btn--primario"
            style={{ fontSize: '11px' }}
            disabled={total === 0}
            onClick={alReemplazarTodos}
            title="Reemplazar todas las coincidencias en una sola acción de historial"
          >
            Todos
          </button>
          {mensajeReemplazo && (
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {mensajeReemplazo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
