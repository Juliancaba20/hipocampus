import { useEffect, useRef, useState } from 'react';
import {
  crearAutoguardado, guardarAjuste, guardarDocumento, guardarPendientesDeEscena, listarElementos, obtenerAjuste,
  programarActualizacionIndice,
} from '../almacen/index.js';
import { exportarDocumento } from '../archivos/exportar.js';
import { Escena } from '../lienzo/escena.js';
import { Lienzo } from '../lienzo/motor.js';
import { encuadrar } from '../lienzo/camara.js';
import { dibujar } from '../lienzo/dibujo.js';
import { ALTO_A4, ANCHO_A4 } from '../formatos/paginas.js';
import { construirHojasPizarron, imprimirContenedor } from '../formatos/impresion.js';
import { prepararImagenes } from '../herramientas/imagenes/recursos.js';
import BarraTexto from './BarraTexto.jsx';
import Minimapa from './Minimapa.jsx';
import MenuRenglones from './MenuRenglones.jsx';
import MenuFormas from './MenuFormas.jsx';
import { ES_FORMA } from './formas.js';
import PanelFigura from './PanelFigura.jsx';
import PanelImagen from './PanelImagen.jsx';
import InsertarImagen from './InsertarImagen.jsx';
import SelectorIconos from './SelectorIconos.jsx';
import SelectorColor from './SelectorColor.jsx';
import { Modal } from './Modal.jsx';
import BarraBusquedaDocumento from './BarraBusquedaDocumento.jsx';
import ModalExportarImagen from './ModalExportarImagen.jsx';
import ModalExportarPdf from './ModalExportarPdf.jsx';
import ModalGuardarPlantilla from './ModalGuardarPlantilla.jsx';
import ModalEnlacesEntrantes from './ModalEnlacesEntrantes.jsx';
import ModalMarcadores from './ModalMarcadores.jsx';
import BarraInstrumentosPrecision from './BarraInstrumentosPrecision.jsx';
import BarraLapicesFavoritos from './BarraLapicesFavoritos.jsx';
import {
  BarraSeleccion, Boton, Propiedades,
} from './EditorComun.jsx';
import { TEXTO_ESTADO } from './utiles.js';

export default function EditorLienzo({ doc, volver }) {
  const canvasRef = useRef(null);
  const capaTextoRef = useRef(null);
  const motorRef = useRef(null);
  const autoRef = useRef(null);
  const docRef = useRef({ ...doc });
  const tituloSucio = useRef(false);
  const [titulo, setTitulo] = useState(doc.titulo);
  const [ui, setUi] = useState(null);
  const [datosPlantilla, setDatosPlantilla] = useState(null);
  const [modalEnlaces, setModalEnlaces] = useState(false);
  const [modalMarcadores, setModalMarcadores] = useState(false);
  const [estado, setEstado] = useState('sin-cambios');
  const [error, setError] = useState('');
  const [ultimaForma, setUltimaForma] = useState('rectangulo');
  const [modalImprimir, setModalImprimir] = useState(false);
  const [modalExportarImagen, setModalExportarImagen] = useState(false);
  const [modalExportarPdf, setModalExportarPdf] = useState(false);
  const [imprimirRenglones, setImprimirRenglones] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [busquedaDoc, setBusquedaDoc] = useState(false);

  useEffect(() => {
    const alTecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setBusquedaDoc((v) => !v);
      }
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, []);

  useEffect(() => {
    let vivo = true;
    let motor; let auto; let baja = () => {}; let bajaEstado = () => {};
    (async () => {
      let elementos;
      try { elementos = await listarElementos(doc.id); } catch (e) { setError(e.message); return; }
      if (!vivo) return;
      const escena = new Escena(elementos);
      auto = crearAutoguardado(async () => {
        // No se finaliza el gesto en curso: guardar a mitad de un trazo (por ejemplo, mientras se mantiene el lápiz
        // quieto para enderezar una línea) lo cortaba. El trazo se guarda al soltar, al salir o al cambiar de pestaña.
        motorRef.current?.puntoDeControlTexto(); // el texto que se está escribiendo entra en lo que se guarda
        await guardarPendientesDeEscena(() => escena, undefined, async ({ guardados, borrados }) => {
          const hayContenido = guardados > 0 || borrados > 0 || tituloSucio.current;
          tituloSucio.current = false;
          await guardarDocumento(docRef.current, { tocarFecha: hayContenido });
          programarActualizacionIndice(docRef.current.id, { doc: docRef.current, elementos: escena.lista() });
        });
      }, { espera: 700 });
      autoRef.current = auto;
      bajaEstado = auto.suscribir(setEstado);
      baja = escena.suscribir(() => auto.programar());
      let ajustes = null;
      try { ajustes = await obtenerAjuste('lienzo.ajustes', null); } catch { /* se usan los valores por defecto */ }
      if (!vivo) { auto.destruir(); return; }

      let camaraInicial = doc.config?.camara;
      if (doc.destinoInicial?.ubicacion) {
        const u = doc.destinoInicial.ubicacion;
        const cx = (Number(u.x) || 0) + (Number(u.ancho) || 0) / 2;
        const cy = (Number(u.y) || 0) + (Number(u.alto) || 0) / 2;
        const w = (typeof window !== 'undefined' ? window.innerWidth : 800);
        const h = (typeof window !== 'undefined' ? window.innerHeight : 600);
        camaraInicial = { x: cx - w / 2, y: cy - h / 2, zoom: 1 };
      }

      motor = new Lienzo(canvasRef.current, {
        escena, documentoId: doc.id, camara: camaraInicial, ajustes, capaTexto: capaTextoRef.current, escritura: doc.escritura, renglones: doc.renglones,
        fondoDocumento: doc.config?.fondo || null,
        alRenglones: (r) => { docRef.current = { ...docRef.current, renglones: r }; auto.programar(); },
        alAjustes: (a) => { guardarAjuste('lienzo.ajustes', a).catch(() => {}); },
        alCambiar: setUi,
        alImagenError: setError,
        alCamara: (c) => { docRef.current = { ...docRef.current, config: { ...docRef.current.config, camara: { ...c } } }; auto.programar(); },
      });
      motorRef.current = motor;
      if (doc.destinoInicial?.elementoId) {
        motor.seleccionar([doc.destinoInicial.elementoId]);
        motor.pedirDibujo();
      }
      motor._notificar();
    })();
    return () => { vivo = false; baja(); bajaEstado(); motor?.destruir(); auto?.destruir(); };
  }, [doc]);

  async function salir() {
    motorRef.current?.finalizarGestoEnCurso();
    motorRef.current?.cerrarTexto(); // lo escrito pasa a la escena antes de guardar
    try { await autoRef.current?.vaciar(); } catch { /* el estado de error ya se muestra */ }
    volver();
  }

  function cambiarTitulo(v) {
    setTitulo(v);
    docRef.current = { ...docRef.current, titulo: v.trim() || 'Sin título' };
    tituloSucio.current = true;
    autoRef.current?.programar();
  }

  async function ejecutarExportar() {
    if (exportando) return;
    setExportando(true);
    try {
      motorRef.current?.cerrarTexto();
      await autoRef.current?.vaciar();
      const elementos = motorRef.current ? motorRef.current.escena.lista() : null;
      await exportarDocumento(docRef.current, { elementos, compartir: true });
    } catch (err) {
      setError('No se pudo exportar la nota: ' + err.message);
    } finally {
      setExportando(false);
    }
  }

  async function ejecutarImpresion() {
    const cont = document.getElementById('nt-area-impresion-pizarron');
    if (!cont || !motorRef.current) return;
    const motor = motorRef.current;
    motor.cerrarTexto();
    const listaCompleta = motor.escena.lista();
    const recursosImagen = await prepararImagenes(listaCompleta);

    const factor = 2;
    try {
      construirHojasPizarron(cont, {
        titulo: docRef.current.titulo || doc.titulo,
        factor,
        dibujarEn: (cv, factorDpr) => {
          const cx = cv.getContext('2d');
          const limites = motor.escena.limites(listaCompleta) || { minX: -400, minY: -300, maxX: 400, maxY: 300 };
          const cam = encuadrar(limites, ANCHO_A4, ALTO_A4, { margen: 40 });
          dibujar(cx, {
            camara: cam,
            ancho: ANCHO_A4,
            alto: ALTO_A4,
            dpr: factorDpr,
            lista: listaCompleta,
            escena: motor.escena,
            seleccion: new Set(),
            marco: null,
            mostrarManijas: null,
            renglones: imprimirRenglones ? { cfg: docRef.current.renglones, opacidad: 1 } : null,
            guiaTexto: docRef.current.renglones,
            marcoDocumento: null,
            fondoDocumento: docRef.current.config?.fondo || null,
          });
        },
      });
    } finally {
      recursosImagen.liberar();
    }
    setModalImprimir(false);
    imprimirContenedor(cont);
  }

  const m = () => motorRef.current;
  const sel = (ui?.seleccionados || 0) > 0;
  const herr = ui?.herramienta;
  const modo = doc.escritura || 'ambos';
  const conMano = modo !== 'teclado';
  const conTeclado = modo !== 'mano';

  return (
    <div className="nt-editor">
      <header className="nt-ed-cab">
        <button className="nt-btn" onClick={salir}>Biblioteca</button>
        <input className="nt-ed-titulo" aria-label="Título" value={titulo} onChange={(e) => cambiarTitulo(e.target.value)} />
        <span className={`nt-estado ${estado === 'guardado' ? 'nt-estado--ok' : ''} ${estado.startsWith('error') ? 'nt-estado--error' : ''}`} aria-live="polite">{TEXTO_ESTADO[estado] ?? TEXTO_ESTADO.error}</span>
        <Boton icono="deshacer" nombre="Deshacer (Ctrl+Z)" conservarFoco deshabilitado={!ui?.puedeDeshacer} alPulsar={() => m().deshacer()} />
        <Boton icono="rehacer" nombre="Rehacer (Ctrl+Y)" conservarFoco deshabilitado={!ui?.puedeRehacer} alPulsar={() => m().rehacer()} />
        <Boton icono="buscar" nombre="Buscar en esta nota (Ctrl+F)" activo={busquedaDoc} alPulsar={() => setBusquedaDoc(!busquedaDoc)} />
        <Boton icono="lista" nombre="Marcadores de ubicación (Índice)" alPulsar={() => setModalMarcadores(true)} />
        <button
          type="button"
          className="nt-btn"
          style={{ fontSize: '12px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          title="Notas que enlazan a este documento y conexiones salientes"
          onClick={() => setModalEnlaces(true)}
        >
          Conexiones
        </button>
        <Boton icono="imagen" nombre="Exportar a imagen (PNG / JPG)" alPulsar={() => setModalExportarImagen(true)} />
        <Boton icono="pdf" nombre="Exportar a PDF" alPulsar={() => setModalExportarPdf(true)} />
        <Boton icono="exportar" nombre="Exportar nota (.nota)" deshabilitado={exportando} alPulsar={ejecutarExportar} />
        <Boton
          icono="plantilla"
          nombre="Guardar como plantilla propia…"
          alPulsar={() => {
            const motor = motorRef.current;
            const docActual = docRef.current || doc;
            const elementosActuales = motor?.escena ? motor.escena.lista() : [];
            setDatosPlantilla({ doc: docActual, elementos: elementosActuales });
          }}
        />
        <Boton icono="imprimir" nombre="Imprimir o guardar en PDF" alPulsar={() => setModalImprimir(true)} />
      </header>
      <div className="nt-ed-trabajo">
        <nav className="nt-riel" aria-label="Herramientas">
          <Boton icono="seleccionar" nombre="Seleccionar (Alt+V)" activo={herr === 'seleccionar'} alPulsar={() => m().setHerramienta('seleccionar')} />
          <Boton icono="lazo" nombre="Lazo de selección (Alt+Q)" activo={herr === 'lazo'} alPulsar={() => m().setHerramienta('lazo')} />
          <Boton icono="mano" nombre="Mover el lienzo (Alt+H)" activo={herr === 'mano'} alPulsar={() => m().setHerramienta('mano')} />
          {conMano && <Boton icono="lapiz" nombre="Lápiz (Alt+P)" activo={herr === 'lapiz'} alPulsar={() => m().setHerramienta('lapiz')} />}
          {conMano && <Boton icono="resaltador" nombre="Resaltador (Alt+M)" activo={herr === 'resaltador'} alPulsar={() => m().setHerramienta('resaltador')} />}
          {conMano && <Boton icono="borrador" nombre="Borrador (Alt+B)" activo={herr === 'borrador'} alPulsar={() => m().setHerramienta('borrador')} />}
          {conTeclado && <Boton icono="texto" nombre="Texto por cuadro (Alt+T)" activo={herr === 'texto'} alPulsar={() => m().setHerramienta('texto')} />}
          <InsertarImagen motorRef={motorRef} />
          <SelectorIconos motorRef={motorRef} />
          <MenuFormas herramienta={herr} ultima={ES_FORMA(herr) ? herr : ultimaForma} alElegir={(f) => { setUltimaForma(f); m().setHerramienta(f); }} />
          <hr />
          <Boton icono="copiar" nombre="Copiar (Ctrl+C)" deshabilitado={!sel} alPulsar={() => m().copiar()} />
          <Boton icono="cortar" nombre="Cortar (Ctrl+X)" deshabilitado={!sel} alPulsar={() => m().cortar()} />
          <Boton icono="pegar" nombre="Pegar (Ctrl+V)" deshabilitado={!ui?.puedePegar} alPulsar={() => m().pegar()} />
          <Boton icono="duplicar" nombre="Duplicar (Ctrl+D)" deshabilitado={!sel} alPulsar={() => m().duplicar()} />
          <hr />
          <Boton icono="agrupar" nombre="Agrupar selección (Ctrl+G)" deshabilitado={!ui?.puedeAgrupar} alPulsar={() => m().agruparSeleccion()} />
          <Boton icono="desagrupar" nombre="Desagrupar selección (Ctrl+Shift+G)" deshabilitado={!ui?.puedeDesagrupar} alPulsar={() => m().desagruparSeleccion()} />
          <Boton icono={ui?.algunoBloqueado ? 'desbloquear' : 'bloquear'} nombre={ui?.algunoBloqueado ? 'Desbloquear selección (Ctrl+L)' : 'Bloquear selección (Ctrl+L)'} deshabilitado={!sel} activo={ui?.algunoBloqueado} alPulsar={() => m().alternarBloqueoSeleccion()} />
          <hr />
          <Boton icono="frente" nombre="Traer al frente" deshabilitado={!sel} alPulsar={() => m().reordenar('frente')} />
          <Boton icono="subir" nombre="Subir una capa" deshabilitado={!sel} alPulsar={() => m().reordenar('subir')} />
          <Boton icono="bajar" nombre="Bajar una capa" deshabilitado={!sel} alPulsar={() => m().reordenar('bajar')} />
          <Boton icono="fondo" nombre="Enviar al fondo" deshabilitado={!sel} alPulsar={() => m().reordenar('fondo')} />
          <hr />
          <Boton icono="eliminar" nombre="Eliminar (Supr)" deshabilitado={!sel} alPulsar={() => m().eliminarSeleccion()} />
        </nav>
        <div className="nt-lienzo">
          <canvas ref={canvasRef} tabIndex={0} aria-label="Lienzo de dibujo" />
          <div className="nt-capa-texto" ref={capaTextoRef} />
          <BarraBusquedaDocumento
            visible={busquedaDoc}
            alCerrar={() => setBusquedaDoc(false)}
            motorRef={motorRef}
            alSaltar={(c) => {
              motorRef.current?.centrarEnUbicacion(c.cajaDestacada || c.ubicacion);
            }}
          />
          {ui && ['lapiz', 'resaltador', 'borrador'].includes(herr) && <Propiedades ui={ui} motorRef={motorRef} />}
          {ui && (ES_FORMA(herr) || (herr === 'seleccionar' && (ui.figura.seleccionadas > 0 || ui.iconoSeleccionado))) && <PanelFigura estilo={ui.figura} motorRef={motorRef} />}
          {ui?.imagenSeleccionada && <PanelImagen imagen={ui.imagenSeleccionada} motorRef={motorRef} />}
          {ui && ui.elementos > 0 && ui.fueraDeVista && !ui.texto && <button className="nt-btn nt-volver" onClick={() => m().encuadrarTodo()}>Volver al contenido</button>}
          {ui && ui.elementos > 0 && ui.ajustes.vista.minimapa && <Minimapa motorRef={motorRef} />}
          {ui?.texto && <BarraTexto estado={ui.texto} motorRef={motorRef} />}
          {ui && (
            <div
              className="nt-precision-flotante"
              style={{
                position: 'absolute',
                top: 12,
                right: 14,
                zIndex: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'flex-end',
                pointerEvents: 'auto',
              }}
            >
              <BarraInstrumentosPrecision motorRef={motorRef} ui={ui} />
              {conMano && <BarraLapicesFavoritos motorRef={motorRef} ui={ui} />}
            </div>
          )}
          {!ui && !error && <p className="nt-lienzo__aviso">Cargando…</p>}
          {error && <p className="nt-aviso nt-lienzo__aviso" role="alert">{error}</p>}
          <div className="nt-hud-pie">
          <div className="nt-zoom" role="group" aria-label="Zoom">
            <button className="nt-ib" aria-label="Alejar" onClick={() => m().zoomPaso(1 / 1.25)}>−</button>
            <button className="nt-zoom__valor" onClick={() => m().zoomReal()} title="Volver al 100 %">{ui?.zoom ?? 100} %</button>
            <button className="nt-ib" aria-label="Acercar" onClick={() => m().zoomPaso(1.25)}>+</button>
            <button className="nt-btn" onClick={() => m().encuadrarTodo()}>Ver todo</button>
            {ui && <MenuRenglones renglones={ui.renglones} motorRef={motorRef} />}
            <div style={{ display: 'inline-flex', alignItems: 'center' }} title="Fondo del pizarrón (color, degradado o pizarra)">
              <SelectorColor
                colorActual={docRef.current.config?.fondo || '#ffffff'}
                etiqueta="Fondo del pizarrón"
                admitirDegradado={true}
                motorRef={motorRef}
                alCambiar={(nuevoFondo) => {
                  const sigDoc = {
                    ...docRef.current,
                    config: { ...docRef.current.config, fondo: nuevoFondo },
                  };
                  docRef.current = sigDoc;
                  autoRef.current?.programar();
                  if (motorRef.current) {
                    motorRef.current.establecerFondoDocumento(nuevoFondo);
                  }
                }}
              />
            </div>
            <Boton
              icono="iman"
              nombre={ui?.imanActivo ? 'Imán y guías inteligentes activados (clic para desactivar)' : 'Activar imán y guías inteligentes'}
              activo={!!ui?.imanActivo}
              alPulsar={() => m()?.toggleIman()}
            />
            <Boton icono="mapa" nombre="Mostrar u ocultar el minimapa" activo={!!ui?.ajustes.vista.minimapa} alPulsar={() => m().configurar('vista', { minimapa: !ui.ajustes.vista.minimapa })} />
          </div>
          {sel && <BarraSeleccion ui={ui} motorRef={motorRef} />}
          </div>
        </div>
      </div>
      {modalImprimir && (
        <Modal titulo="Imprimir o exportar como PDF" alCerrar={() => setModalImprimir(false)} ancho={440}>
          <div className="nt-campos">
            <label className="nt-check">
              <input
                type="checkbox"
                checked={imprimirRenglones}
                onChange={(e) => setImprimirRenglones(e.target.checked)}
              />
              Incluir renglones / cuadrícula al imprimir
            </label>
          </div>
          <div className="nt-acciones">
            <button type="button" className="nt-btn" onClick={() => setModalImprimir(false)}>Cancelar</button>
            <button
              type="button"
              className="nt-btn"
              onClick={() => {
                setModalImprimir(false);
                setModalExportarPdf(true);
              }}
            >
              Exportar PDF directo
            </button>
            <button type="button" className="nt-btn nt-btn--primario" onClick={ejecutarImpresion}>Imprimir / Guardar en PDF</button>
          </div>
        </Modal>
      )}
      {modalExportarImagen && (
        <ModalExportarImagen
          alCerrar={() => setModalExportarImagen(false)}
          tipoFormato="pizarron"
          doc={doc}
          motorRef={motorRef}
        />
      )}
      {modalExportarPdf && (
        <ModalExportarPdf
          alCerrar={() => setModalExportarPdf(false)}
          tipoFormato="pizarron"
          doc={doc}
          motorRef={motorRef}
        />
      )}
      {datosPlantilla && (
        <ModalGuardarPlantilla
          doc={datosPlantilla.doc}
          elementos={datosPlantilla.elementos}
          alCerrar={() => setDatosPlantilla(null)}
        />
      )}
      {modalEnlaces && (
        <ModalEnlacesEntrantes
          doc={docRef.current}
          elementos={motorRef.current?.escena ? motorRef.current.escena.lista() : null}
          alCerrar={() => setModalEnlaces(false)}
          alAbrirNota={(idDestino) => {
            window.dispatchEvent(new CustomEvent('nt:abrir-nota', { detail: { notaId: idDestino } }));
          }}
        />
      )}
      {modalMarcadores && (
        <ModalMarcadores
          formato="pizarron"
          doc={docRef.current}
          camaraActual={motorRef.current?.camara}
          alGuardarMarcadores={(nuevos) => {
            docRef.current = {
              ...docRef.current,
              config: { ...(docRef.current.config || {}), marcadores: nuevos },
            };
            autoRef.current?.programar();
          }}
          alSaltarAMarcador={(m) => {
            const motor = motorRef.current;
            if (!motor || !m) return;
            motor.camara = {
              ...motor.camara,
              x: m.x,
              y: m.y,
              zoom: m.zoom || motor.camara.zoom,
            };
            motor._camaraCambio();
          }}
          alCerrar={() => setModalMarcadores(false)}
        />
      )}
      <div id="nt-area-impresion-pizarron" className="nt-area-impresion-pizarron" />
    </div>
  );
}
