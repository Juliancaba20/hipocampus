// Componentes y constantes comunes compartidos entre editores (EditorLienzo, EditorTarjetas, EditorPaginas).
import { useEffect, useState } from 'react';
import ModalSeleccionarNota from './ModalSeleccionarNota.jsx';

export const ICONOS = {
  seleccionar: 'M5 3l14 7-6 2-2 6z',
  lazo: 'M13.5 3a4.5 4.5 0 00-4.3 3.2C7 6.8 4.8 8.6 3.4 11 1.6 14 2 17.5 4.2 20c2.3 2.5 6.4 2.8 10.5 1 4.5-2 7.3-5.8 7.3-9.5 0-3.5-2.2-6.2-5.5-7.7A4.47 4.47 0 0013.5 3zm0 2c1.4 0 2.5 1.1 2.5 2.5S14.9 10 13.5 10 11 8.9 11 7.5 12.1 5 13.5 5z',
  proporcion: 'M3 5h18v14H3V5zm2 2v10h14V7H5zm2 2h4v2H9v2H7V9zm10 6h-4v-2h2v-2h2v4z', // marco con esquinas de escala (dibujo propio)
  mano: 'M8 13V6.5a1.5 1.5 0 013 0V11m0-1V4.5a1.5 1.5 0 013 0V11m0-2.5a1.5 1.5 0 013 0V16a6 6 0 01-6 6h-1a6 6 0 01-5-3l-3-5a1.5 1.5 0 012.5-1.5L8 15',
  lapiz: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  resaltador: 'M9 15l7-7 3 3-7 7H9zM5 21h8',
  borrador: 'M4 16l9-9 6 6-5 5H8zM9 21h11',
  texto: 'M5 7V4h14v3M12 4v16M9 20h6',
  imagen: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 12 4-4 3 3 3-4 6 7M8 9h.01',
  mapa: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  frente: 'M12 19V7M6 12l6-6 6 6M5 3h14',
  subir: 'M12 19V6M6 12l6-6 6 6',
  bajar: 'M12 5v13M6 12l6 6 6-6',
  fondo: 'M12 5v12M6 12l6 6 6-6M5 21h14',
  eliminar: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  deshacer: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  rehacer: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z',
  pdf: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm3-7h6v2H9v-2zm0 3h6v2H9v-2z',
  anterior: 'M15 18l-6-6 6-6',
  siguiente: 'M9 18l6-6-6-6',
  duplicar: 'M8 7v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-8a2 2 0 00-2 2zM4 15V5a2 2 0 012-2h10',
  copiar: 'M8 4v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2h-8a2 2 0 00-2 2zM4 8v12a2 2 0 002 2h8',
  cortar: 'M6 9a3 3 0 100-6 3 3 0 000 6zm0 0l12 12M6 15a3 3 0 100 6 3 3 0 000-6zm0 0l12-12',
  pegar: 'M9 3h6a1 1 0 011 1v2H8V4a1 1 0 011-1zm-3 3h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2zm3 6h6m-6 4h4',
  mas: 'M12 5v14M5 12h14',
  exportar: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  agrupar: 'M7 7h10v10H7zM3 3h4v2H5v2H3zm14 0h4v4h-2V5h-2zm-14 14h2v2h2v2H3zm14 2v-2h2v-2h2v4z',
  desagrupar: 'M3 3h5v5H3zm13 0h5v5h-5zM3 16h5v5H3zm13 0h5v5h-5zM8 8l8 8m0-8l-8 8',
  bloquear: 'M17 11V7a5 5 0 00-10 0v4H5v10h14V11h-2zm-8-4a3 3 0 016 0v4H9V7zm3 8a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
  desbloquear: 'M17 9V7a5 5 0 00-10 0v1h2V7a3 3 0 016 0v2H5v12h14V9h-2zm-5 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
  iman: 'M4 4v7a8 8 0 0016 0V4h-4v7a4 4 0 01-8 0V4H4zm0 0h4V2H4v2zm12 0h4V2h-4v2z',
  alinearIzquierda: 'M4 22V2h2v20H4zm4-16h12v4H8V6zm0 8h8v4H8v-4z',
  alinearCentro: 'M11 2h2v20h-2zm-7 4h16v4H4V6zm2 8h12v4H6v-4z',
  alinearDerecha: 'M18 2h2v20h-2zM4 6h12v4H4V6zm4 8h8v4H8v-4z',
  alinearArriba: 'M2 4h20v2H2V4zm4 4h4v12H6V8zm8 0h4v8h-4V8z',
  alinearMedio: 'M2 11h20v2H2v-2zm4-7h4v16H6V4zm8 2h4v12h-4V6z',
  alinearAbajo: 'M2 18h20v2H2v-2zm4-12h4v10H6V6zm8 4h4v6h-4v-6z',
  distribuirHorizontal: 'M4 2h2v20H4zm14 0h2v20h-2zM9 7h6v10H9V7z',
  distribuirVertical: 'M2 4h20v2H2V4zm0 14h20v2H2v-2zm5-5h10v-4H7v4z',
  buscar: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  panel: 'M3 4h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm6 2H4v12h5V6zm2 0v12h9V6h-9z',
  lista: 'M4 6h16M4 12h16M4 18h7',
  plantilla: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 2h7v4h-7V5zm-7 0h5v8H5V5zm0 10h5v4H5v-4zm7 4v-8h7v8h-7z',
};

export const Icono = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

export function Boton({ icono, nombre, activo, deshabilitado, alPulsar, conservarFoco }) {
  return (
    <button className={`nt-ib ${activo ? 'nt-ib--on' : ''}`} title={nombre} aria-label={nombre} aria-pressed={activo === undefined ? undefined : activo}
      disabled={deshabilitado} onMouseDown={conservarFoco ? (e) => e.preventDefault() : undefined} onClick={alPulsar}><Icono d={ICONOS[icono]} /></button>
  );
}

export const COLORES = [['#14192b', 'Negro'], ['#2350d8', 'Azul'], ['#d6336c', 'Rosa'], ['#1f9d55', 'Verde'], ['#e67700', 'Naranja'], ['#7048e8', 'Violeta'], ['#868e96', 'Gris'], ['#ffd84d', 'Amarillo']];

export function Propiedades({ ui, motorRef }) {
  const h = ui.herramienta;
  const a = ui.ajustes[h];
  const cfg = (parche) => motorRef.current.configurar(h, parche);
  return (
    <div className="nt-props" role="group" aria-label="Opciones de la herramienta">
      {h === 'borrador' ? (
        <>
          <div className="nt-seg" role="radiogroup" aria-label="Modo del borrador">
            <button role="radio" aria-checked={a.modo === 'trazo'} className={a.modo === 'trazo' ? 'nt-seg--on' : ''} onClick={() => cfg({ modo: 'trazo' })}>Trazo completo</button>
            <button role="radio" aria-checked={a.modo === 'zona'} className={a.modo === 'zona' ? 'nt-seg--on' : ''} onClick={() => cfg({ modo: 'zona' })}>Por zona</button>
          </div>
          <label className="nt-rango">Tamaño<input type="range" min="10" max="90" value={a.tamano} onChange={(e) => cfg({ tamano: +e.target.value })} /></label>
        </>
      ) : (
        <>
          <div className="nt-colores" role="radiogroup" aria-label="Color">
            {COLORES.map(([c, n]) => (
              <button key={c} role="radio" aria-checked={a.color === c} aria-label={n} title={n}
                className={`nt-color ${a.color === c ? 'nt-color--on' : ''}`} style={{ background: c }} onClick={() => cfg({ color: c })} />
            ))}
          </div>
          <label className="nt-rango">Grosor<input type="range" min="1" max="40" value={a.grosor} onChange={(e) => cfg({ grosor: +e.target.value })} /></label>
          <label className="nt-rango">Opacidad<input type="range" min="10" max="100" value={Math.round(a.opacidad * 100)} onChange={(e) => cfg({ opacidad: +e.target.value / 100 })} /></label>
        </>
      )}
      <label className="nt-check"><input type="checkbox" checked={ui.dedoDibuja} onChange={(e) => motorRef.current.setDedoDibuja(e.target.checked)} />
        Dibujar con el dedo{ui.hayLapiz ? '' : ' (si usa lápiz, desactívelo para apoyar la mano)'}</label>
    </div>
  );
}


export function BarraSeleccion({ ui, motorRef, extra }) {
  const [modalElegirNota, setModalElegirNota] = useState(false);
  const [confirmacionEnlace, setConfirmacionEnlace] = useState(null);
  useEffect(() => {
    if (!confirmacionEnlace) return undefined;
    const id = setTimeout(() => setConfirmacionEnlace(null), 4000);
    return () => clearTimeout(id);
  }, [confirmacionEnlace]);
  if (!ui || (ui.seleccionados || 0) === 0) return null;
  const m = () => motorRef.current;
  const n = ui.seleccionados;
  const multi = n > 1;

  return (
    <div className="nt-seleccion" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }} role="toolbar" aria-label="Operaciones de selección">
      <span style={{ fontSize: '12px', fontWeight: '500', marginRight: '4px' }}>
        {n} {n === 1 ? 'elemento' : 'elementos'}
      </span>

      <Boton
        icono="proporcion"
        nombre={ui.fijarProporcion ? 'Proporción fija activa (bloqueada)' : 'Fijar proporción al estirar (o mantenga Mayús)'}
        activo={!!ui.fijarProporcion}
        alPulsar={() => m()?.toggleFijarProporcion()}
      />

      <Boton
        icono={ui.algunoBloqueado ? 'desbloquear' : 'bloquear'}
        nombre={ui.algunoBloqueado ? 'Desbloquear selección (Ctrl+L)' : 'Bloquear selección contra movimientos o borrado accidental (Ctrl+L)'}
        activo={!!ui.algunoBloqueado}
        alPulsar={() => m()?.alternarBloqueoSeleccion()}
      />

      {multi && (
        <>
          <Boton
            icono="agrupar"
            nombre="Agrupar elementos (Ctrl+G)"
            deshabilitado={!ui.puedeAgrupar}
            alPulsar={() => m()?.agruparSeleccion()}
          />
          {ui.puedeDesagrupar && (
            <Boton
              icono="desagrupar"
              nombre="Desagrupar (Ctrl+Shift+G)"
              alPulsar={() => m()?.desagruparSeleccion()}
            />
          )}

          <span style={{ width: '1px', height: '18px', background: '#cbd5e1', margin: '0 2px' }} aria-hidden="true" />

          {/* Alineación */}
          <Boton icono="alinearIzquierda" nombre="Alinear a la izquierda" deshabilitado={!ui.puedeAlinear} alPulsar={() => m()?.alinear('izquierda')} />
          <Boton icono="alinearCentro" nombre="Alinear al centro horizontal" deshabilitado={!ui.puedeAlinear} alPulsar={() => m()?.alinear('centro')} />
          <Boton icono="alinearDerecha" nombre="Alinear a la derecha" deshabilitado={!ui.puedeAlinear} alPulsar={() => m()?.alinear('derecha')} />
          <Boton icono="alinearArriba" nombre="Alinear arriba" deshabilitado={!ui.puedeAlinear} alPulsar={() => m()?.alinear('arriba')} />
          <Boton icono="alinearMedio" nombre="Alinear al medio vertical" deshabilitado={!ui.puedeAlinear} alPulsar={() => m()?.alinear('medio')} />
          <Boton icono="alinearAbajo" nombre="Alinear abajo" deshabilitado={!ui.puedeAlinear} alPulsar={() => m()?.alinear('abajo')} />

          {/* Distribución */}
          {n >= 3 && (
            <>
              <span style={{ width: '1px', height: '18px', background: '#cbd5e1', margin: '0 2px' }} aria-hidden="true" />
              <Boton icono="distribuirHorizontal" nombre="Distribuir horizontalmente" deshabilitado={!ui.puedeDistribuir} alPulsar={() => m()?.distribuir('horizontal')} />
              <Boton icono="distribuirVertical" nombre="Distribuir verticalmente" deshabilitado={!ui.puedeDistribuir} alPulsar={() => m()?.distribuir('vertical')} />
            </>
          )}
        </>
      )}

      {!multi && ui.puedeDesagrupar && (
        <Boton
          icono="desagrupar"
          nombre="Desagrupar (Ctrl+Shift+G)"
          alPulsar={() => m()?.desagruparSeleccion()}
        />
      )}

      {/* Ramificación de mapa conceptual con un toque (Etapa 23) */}
      {!multi && ui.figura?.forma && !ui.figura?.linea && (
        <button
          type="button"
          className="nt-btn-sm"
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid #93c5fd',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Crear nodo hijo conectado automáticamente con flecha (Mapa conceptual)"
          onClick={() => m()?.ramificarSeleccion('derecha', 'Concepto')}
        >
          Rama hijo
        </button>
      )}

      {/* Enlazar cualquier elemento seleccionado a otra nota (Etapa 23) */}
      {ui.enlaceSeleccion && !multi ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="nt-btn-sm"
            style={{
              fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #86efac',
              background: '#f0fdf4', color: '#15803d', fontWeight: 700, cursor: 'pointer', maxWidth: '220px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={`Este elemento está enlazado con «${ui.enlaceSeleccion.titulo || 'otra nota'}». Toque para abrirla o cambiar el enlace.`}
            onClick={() => (ui.enlaceSeleccion.tipo === 'nota' || ui.enlaceSeleccion.notaId) ? m()?.abrirEnlace(ui.enlaceSeleccion) : setModalElegirNota(true)}
          >
            🔗 Enlazada con «{ui.enlaceSeleccion.titulo || 'otra nota'}»
          </button>
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
            title="Cambiar la nota a la que está enlazado"
            onClick={() => setModalElegirNota(true)}
          >
            Cambiar
          </button>
          <button
            type="button"
            className="nt-btn-sm"
            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#ffffff', color: '#b91c1c', cursor: 'pointer' }}
            title="Quitar el enlace de este elemento"
            onClick={() => { m()?.enlazarSeleccion(null); setConfirmacionEnlace('Enlace quitado'); }}
          >
            Quitar enlace
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="nt-btn-sm"
          style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
          title="Enlazar el elemento seleccionado a otra nota de la biblioteca"
          onClick={() => setModalElegirNota(true)}
        >
          Enlazar nota…
        </button>
      )}

      {confirmacionEnlace && (
        <span role="status" style={{ fontSize: '11px', fontWeight: 700, color: '#bbf7d0', background: 'rgba(22,163,74,.35)', padding: '3px 8px', borderRadius: '99px' }}>
          ✓ {confirmacionEnlace}
        </span>
      )}

      {modalElegirNota && (
        <ModalSeleccionarNota
          alSeleccionar={(notaDestino) => {
            setModalElegirNota(false);
            m()?.enlazarSeleccion({
              tipo: 'nota',
              notaId: notaDestino.id,
              titulo: notaDestino.titulo,
            });
            setConfirmacionEnlace(`Enlazado con «${notaDestino.titulo || 'otra nota'}»`);
          }}
          alCerrar={() => setModalElegirNota(false)}
        />
      )}

      {extra}
    </div>
  );
}
