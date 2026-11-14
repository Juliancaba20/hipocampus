// Editor de Páginas A4 (Etapa 10): hojas continuas una debajo de otra, como un documento.
// Dimensiones estándar A4 (794 × 1123 px), desplazamiento vertical, paginación,
// adición/duplicación de páginas e impresión en hojas A4 con/sin renglones.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearAutoguardado, guardarAjuste, guardarDocumento, guardarPendientesDeEscena, listarElementos, nuevoId, obtenerAjuste,
  programarActualizacionIndice,
} from '../almacen/index.js';
import { exportarDocumento } from '../archivos/exportar.js';
import { Escena } from '../lienzo/escena.js';
import { Lienzo } from '../lienzo/motor.js';
import { dibujar } from '../lienzo/dibujo.js';
import BarraTexto from '../app/BarraTexto.jsx';
import MenuRenglones from '../app/MenuRenglones.jsx';
import MenuFormas from '../app/MenuFormas.jsx';
import { ES_FORMA } from '../app/formas.js';
import PanelFigura from '../app/PanelFigura.jsx';
import PanelImagen from '../app/PanelImagen.jsx';
import InsertarImagen from '../app/InsertarImagen.jsx';
import SelectorIconos from '../app/SelectorIconos.jsx';
import { Modal } from '../app/Modal.jsx';
import BarraBusquedaDocumento from '../app/BarraBusquedaDocumento.jsx';
import ModalExportarImagen from '../app/ModalExportarImagen.jsx';
import ModalExportarPdf from '../app/ModalExportarPdf.jsx';
import ModalEstilos from '../app/ModalEstilos.jsx';
import ModalTablaContenido from '../app/ModalTablaContenido.jsx';
import ModalConfigurarPagina from '../app/ModalConfigurarPagina.jsx';
import ModalGuardarPlantilla from '../app/ModalGuardarPlantilla.jsx';
import {
  BarraSeleccion, Boton, Propiedades,
} from '../app/EditorComun.jsx';
import ModalEnlacesEntrantes from '../app/ModalEnlacesEntrantes.jsx';
import BarraInstrumentosPrecision from '../app/BarraInstrumentosPrecision.jsx';
import BarraLapicesFavoritos from '../app/BarraLapicesFavoritos.jsx';
import { TEXTO_ESTADO } from '../app/utiles.js';
import {
  ANCHO_A4, cabeEnPagina, desbordeDePagina, duplicarElementosPagina, cambiosEliminarPagina, marcoDePagina, marcosDePaginas, moverElementoAPagina, normalizarPaginasConfig, paginaDeElemento, paginaEnY, yDePagina, formatearTextoGuiaPagina, partirTextoPorDesborde, extraerNotasAlPieDocumento, migrarElementosPorCambioHoja, dimensionesHoja,
} from './paginas.js';
import { construirHojasPaginas, factorResolucion, imprimirContenedor } from './impresion.js';
import { prepararImagenes } from '../herramientas/imagenes/recursos.js';
import { encuadrar } from '../lienzo/camara.js';
import { ProveedorPdfDocumento } from './proveedorPdf.js';

function ItemMiniatura({ numero, esActiva, alSeleccionar, proveedorPdf }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    if (proveedorPdf && canvasRef.current) {
      proveedorPdf.obtenerMiniatura(numero, 90).then((canvasFuente) => {
        if (!cancelado && canvasFuente && canvasRef.current) {
          const cv = canvasRef.current;
          cv.width = canvasFuente.width;
          cv.height = canvasFuente.height;
          const ctx = cv.getContext('2d');
          ctx.drawImage(canvasFuente, 0, 0);
        }
      });
    }
    return () => { cancelado = true; };
  }, [proveedorPdf, numero]);

  return (
    <button
      type="button"
      className={`nt-item-miniatura ${esActiva ? 'nt-item-miniatura--activa' : ''}`}
      onClick={alSeleccionar}
      title={`Ir a la página ${numero}`}
    >
      <div className="nt-item-miniatura__marco">
        {proveedorPdf ? (
          <canvas ref={canvasRef} className="nt-item-miniatura__canvas" />
        ) : (
          <div className="nt-item-miniatura__blanco" />
        )}
      </div>
      <span className="nt-item-miniatura__numero">Pág. {numero}</span>
    </button>
  );
}

function BarraMiniaturasLateral({ cantidad, paginaActiva, alSeleccionar, alCerrar, proveedorPdf }) {
  return (
    <aside className="nt-lateral-miniaturas" role="navigation" aria-label="Miniaturas de páginas">
      <div className="nt-lateral-miniaturas__cab">
        <span style={{ fontWeight: 600, fontSize: '13px' }}>Páginas ({cantidad})</span>
        <button type="button" className="nt-ib nt-ib--cerrar" onClick={alCerrar} title="Cerrar miniaturas" aria-label="Cerrar miniaturas">✕</button>
      </div>
      <div className="nt-lateral-miniaturas__lista">
        {Array.from({ length: cantidad }, (_, i) => i + 1).map((num) => (
          <ItemMiniatura
            key={num}
            numero={num}
            esActiva={num === paginaActiva}
            alSeleccionar={() => alSeleccionar(num)}
            proveedorPdf={proveedorPdf}
          />
        ))}
      </div>
    </aside>
  );
}

export default function EditorPaginas({ doc, volver }) {
  const canvasRef = useRef(null);
  const capaTextoRef = useRef(null);
  const motorRef = useRef(null);
  const autoRef = useRef(null);
  const docRef = useRef({ ...doc });
  const tituloSucio = useRef(false);

  // Configuración de páginas A4
  const [cfg, setCfg] = useState(() => normalizarPaginasConfig(doc.config));
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const [titulo, setTitulo] = useState(doc.titulo);
  const [ui, setUi] = useState(null);
  const [estado, setEstado] = useState('sin-cambios');
  const [error, setError] = useState('');
  const [ultimaForma, setUltimaForma] = useState('rectangulo');
  const [paginaActiva, setPaginaActiva] = useState(cfg.paginaActiva);
  const [mostrarMiniaturas, setMostrarMiniaturas] = useState(false);
  const [proveedorPdf, setProveedorPdf] = useState(null);

  // Estilos de párrafo reutilizables (Etapa 20B)
  const [estilos, setEstilos] = useState(() => doc.config?.estilos || doc.estilos || null);
  const estilosRef = useRef(estilos);
  useEffect(() => { estilosRef.current = estilos; }, [estilos]);
  const [modalEstilos, setModalEstilos] = useState(false);
  const [modalTablaContenido, setModalTablaContenido] = useState(false);

  // Modal de impresión y encabezado/pie
  const [modalImprimir, setModalImprimir] = useState(false);
  const [modalExportarImagen, setModalExportarImagen] = useState(false);
  const [modalExportarPdf, setModalExportarPdf] = useState(false);
  const [modalEncabezadoPie, setModalEncabezadoPie] = useState(false);
  const [modoImpresion, setModoImpresion] = useState('todas'); // todas | actual
  const [imprimirRenglones, setImprimirRenglones] = useState(cfg.imprimirRenglones);
  const [exportando, setExportando] = useState(false);
  const [busquedaDoc, setBusquedaDoc] = useState(false);
  const [modalConfigurarPagina, setModalConfigurarPagina] = useState(false);
  const [datosPlantilla, setDatosPlantilla] = useState(null);
  const [modalEnlaces, setModalEnlaces] = useState(false);

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

  // Modal para confirmar eliminación de página
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  // Marcos de página con texto de encabezado, pie y notas al pie por hoja A4
  const listaMarcosConGuia = useCallback((cantidad, configActual = cfgRef.current, notasAlPie = null) => {
    const marcos = marcosDePaginas(cantidad, configActual);
    const enc = configActual.encabezado;
    const pie = configActual.pie;
    let notas = notasAlPie;
    if (!notas && motorRef.current?.escena) {
      try {
        notas = extraerNotasAlPieDocumento(motorRef.current.escena.lista(), configActual);
      } catch {}
    }
    return marcos.map((m) => ({
      ...m,
      encabezadoTexto: formatearTextoGuiaPagina(enc, m.numero, cantidad) || null,
      pieTexto: formatearTextoGuiaPagina(pie, m.numero, cantidad) || null,
      notasAlPie: notas ? (notas.get(m.numero) || []) : [],
    }));
  }, []);

  // Actualiza la configuración y programa autoguardado
  const guardarCambioConfig = useCallback((nuevaCfg) => {
    setCfg(nuevaCfg);
    cfgRef.current = nuevaCfg;
    docRef.current = {
      ...docRef.current,
      config: { ...docRef.current.config, ...nuevaCfg },
    };
    if (motorRef.current) {
      motorRef.current.setMarco(listaMarcosConGuia(nuevaCfg.cantidadPaginas, nuevaCfg));
      motorRef.current.pedirDibujo();
    }
    autoRef.current?.programar();
  }, [listaMarcosConGuia]);

  // Centra y encuadra la página activa en el visor
  const irAPagina = useCallback((num) => {
    const n = Math.max(1, Math.min(cfgRef.current.cantidadPaginas, num));
    setPaginaActiva(n);
    const motor = motorRef.current;
    if (!motor) return;

    const m = marcoDePagina(n, cfgRef.current);
    const anchoPag = m.ancho || ANCHO_A4;
    const z = motor.camara.zoom;
    motor.camara = {
      ...motor.camara,
      x: (anchoPag - motor.ancho / z) / 2,
      y: m.y - 20,
    };
    motor._camaraCambio();
  }, []);

  // Cambiar tamaño de hoja, orientación y márgenes preservando elementos y trazos a mano alzada
  const cambiarConfiguracionPagina = useCallback((nuevaConfig) => {
    const cfgVieja = cfgRef.current;
    const cfgNueva = normalizarPaginasConfig(nuevaConfig);
    const motor = motorRef.current;
    if (!motor) return;

    const elementosViejos = motor.escena.lista();
    const elementosNuevos = migrarElementosPorCambioHoja(elementosViejos, cfgVieja, cfgNueva);

    const cambios = [];
    elementosViejos.forEach((viejo, idx) => {
      const nuevo = elementosNuevos[idx];
      if (viejo.y !== nuevo.y || viejo.contenedor !== nuevo.contenedor) {
        cambios.push({ id: viejo.id, antes: viejo, despues: nuevo });
      }
    });

    if (cambios.length > 0) {
      motor.escena.ejecutar({
        nombre: 'Configuración de página',
        hacer: (esc) => {
          cambios.forEach((c) => esc.cambiar(c.despues));
        },
        deshacer: (esc) => {
          cambios.forEach((c) => esc.cambiar(c.antes));
        },
      });
    }

    guardarCambioConfig(cfgNueva);
    motor.setMarco(listaMarcosConGuia(cfgNueva.cantidadPaginas, cfgNueva));
    motor.establecerFondoDocumento(cfgNueva.fondo || null);
    irAPagina(paginaActiva);
  }, [guardarCambioConfig, irAPagina, listaMarcosConGuia, paginaActiva]);

  // Actualizar estilos y refrescar todo el documento (Etapa 20B)
  const guardarEstilos = useCallback((nuevosEstilos) => {
    setEstilos(nuevosEstilos);
    estilosRef.current = nuevosEstilos;
    docRef.current = {
      ...docRef.current,
      config: { ...docRef.current.config, estilos: nuevosEstilos },
      estilos: nuevosEstilos,
    };
    if (motorRef.current) {
      motorRef.current.setEstilos(nuevosEstilos);
      const notas = extraerNotasAlPieDocumento(motorRef.current.escena.lista(), cfgRef.current);
      motorRef.current.setMarco(listaMarcosConGuia(cfgRef.current.cantidadPaginas, cfgRef.current, notas));
      motorRef.current.pedirDibujo();
    }
    autoRef.current?.programar();
  }, [listaMarcosConGuia]);

  // Ajusta la cámara para ver la hoja ocupando el ancho útil de la pantalla
  const ajustarAncho = useCallback(() => {
    const motor = motorRef.current;
    if (!motor) return;
    const marco = marcoDePagina(paginaActiva, cfgRef.current);
    const anchoPag = marco.ancho || ANCHO_A4;
    const factor = Math.min(1.8, Math.max(0.4, (motor.ancho - 80) / anchoPag));
    const targetY = marco.y;
    motor.camara = {
      x: (anchoPag - motor.ancho / factor) / 2,
      y: targetY - 30,
      zoom: factor,
    };
    motor._camaraCambio();
  }, [paginaActiva]);

  // Encuadra la página completa (ancho y alto) dentro de la pantalla
  const encuadrarPagina = useCallback(() => {
    const motor = motorRef.current;
    if (!motor) return;
    const marco = marcoDePagina(paginaActiva, cfgRef.current);
    motor.camara = encuadrar(marco, motor.ancho, motor.alto, 50, 2);
    motor._camaraCambio();
  }, [paginaActiva]);

  // Inicialización del motor del lienzo y persistencia continua
  useEffect(() => {
    let vivo = true;
    let motor;
    let auto;
    let proveedorPdfLocal = null;
    let baja = () => {};
    let bajaEstado = () => {};

    (async () => {
      let elementos;
      try {
        elementos = await listarElementos(doc.id);
      } catch (e) {
        setError(e.message);
        return;
      }
      if (!vivo) return;

      // El contenedor (página) se recalcula siempre por la posición del elemento
      elementos.forEach((el) => {
        el.contenedor = paginaDeElemento(el);
      });

      const escena = new Escena(elementos);

      auto = crearAutoguardado(async () => {
        // No se finaliza el gesto en curso: guardar a mitad de un trazo (por ejemplo, mientras se mantiene el lápiz
        // quieto para enderezar una línea) lo cortaba. El trazo se guarda al soltar, al salir o al cambiar de pestaña.
        motorRef.current?.puntoDeControlTexto();
        await guardarPendientesDeEscena(() => escena, undefined, async ({ guardados, borrados }) => {
          const hayContenido = guardados > 0 || borrados > 0 || tituloSucio.current;
          tituloSucio.current = false;
          await guardarDocumento(docRef.current, { tocarFecha: hayContenido });
          programarActualizacionIndice(docRef.current.id, { doc: docRef.current, elementos: escena.lista() });
        });
      }, { espera: 700 });

      autoRef.current = auto;
      bajaEstado = auto.suscribir(setEstado);
      baja = escena.suscribir(() => {
        try {
          const notas = extraerNotasAlPieDocumento(escena.lista(), cfgRef.current);
          motor?.setMarco(listaMarcosConGuia(cfgRef.current.cantidadPaginas, cfgRef.current, notas));
        } catch {}
        auto.programar();
      });

      let ajustes = null;
      try {
        ajustes = await obtenerAjuste('lienzo.ajustes', null);
      } catch {
        /* valores por defecto */
      }
      if (!vivo) {
        auto.destruir();
        return;
      }

      const listaMarcos = listaMarcosConGuia(cfgRef.current.cantidadPaginas, cfgRef.current);
      let camInicial = doc.config?.camara;
      if (doc.destinoInicial?.ubicacion) {
        const u = doc.destinoInicial.ubicacion;
        const pValida = Math.max(1, Math.min(cfgRef.current.cantidadPaginas, Number(u.contenedor) || paginaEnY(u.y) || 1));
        const targetY = u.y != null ? (u.y - 60) : (yDePagina(pValida) - 30);
        const wWin = typeof window !== 'undefined' ? window.innerWidth : 800;
        const factor = Math.min(1.4, Math.max(0.5, (wWin - 60) / ANCHO_A4));
        camInicial = {
          x: (ANCHO_A4 - wWin / factor) / 2,
          y: targetY,
          zoom: factor,
        };
        setPaginaActiva(pValida);
      } else if (!camInicial) {
        const wWin = typeof window !== 'undefined' ? window.innerWidth : 800;
        camInicial = {
          x: (ANCHO_A4 - wWin) / 2,
          y: -30,
          zoom: Math.min(1.4, Math.max(0.5, (wWin - 60) / ANCHO_A4)),
        };
      }

      const pdfBlobId = doc.pdfBlobId || cfgRef.current?.pdfBlobId;
      if (pdfBlobId) {
        proveedorPdfLocal = new ProveedorPdfDocumento(pdfBlobId);
        setProveedorPdf(proveedorPdfLocal);
      }

      motor = new Lienzo(canvasRef.current, {
        escena,
        documentoId: doc.id,
        camara: camInicial,
        ajustes,
        capaTexto: capaTextoRef.current,
        escritura: doc.escritura,
        renglones: doc.renglones,
        contenedor: (y) => Math.max(1, Math.min(cfgRef.current.cantidadPaginas, paginaEnY(y, cfgRef.current))),
        marco: listaMarcos,
        // Un texto nuevo llega hasta el margen derecho de la hoja, como en un procesador de texto.
        anchoTextoNuevo: (x, y) => {
          const cfg = cfgRef.current;
          const m = marcoDePagina(paginaEnY(y, cfg), cfg);
          const derecho = cfg?.margenes?.derecho ?? 60;
          return Math.round(m.x + m.ancho - derecho - x);
        },
        alRenglones: (r) => {
          docRef.current = { ...docRef.current, renglones: r };
          auto.programar();
        },
        alAjustes: (a) => {
          guardarAjuste('lienzo.ajustes', a).catch(() => {});
        },
        alCambiar: setUi,
        alImagenError: setError,
        alCamara: (c) => {
          // Detectar dinámicamente en qué página se encuentra el centro de la vista
          const centroY = c.y + (canvasRef.current ? canvasRef.current.height / (window.devicePixelRatio || 1) / c.zoom / 2 : 0);
          const p = paginaEnY(centroY, cfgRef.current);
          const pValida = Math.max(1, Math.min(cfgRef.current.cantidadPaginas, p));
          setPaginaActiva(pValida);

          docRef.current = {
            ...docRef.current,
            config: { ...docRef.current.config, camara: { ...c }, paginaActiva: pValida },
          };
          auto.programar();
        },
      });

      if (proveedorPdfLocal) {
        motor.setProveedorFondoMarco((num, zoom) =>
          proveedorPdfLocal.obtenerCanvasPagina(num, zoom, () => motor.pedirDibujo())
        );
      }

      motorRef.current = motor;
      if (estilosRef.current) {
        motor.setEstilos(estilosRef.current);
      }
      try {
        const notasIniciales = extraerNotasAlPieDocumento(escena.lista(), cfgRef.current);
        motor.setMarco(listaMarcosConGuia(cfgRef.current.cantidadPaginas, cfgRef.current, notasIniciales));
      } catch {}

      if (doc.destinoInicial?.elementoId) {
        motor.seleccionar([doc.destinoInicial.elementoId]);
        motor.pedirDibujo();
      }

      // Deshacer o rehacer una operación de páginas restaura también la cantidad de hojas
      escena.alMeta = (m) => {
        const n = Math.max(1, m.cantidadPaginas);
        const activa = Math.max(1, Math.min(n, m.paginaActiva || cfgRef.current.paginaActiva || 1));
        const notas = extraerNotasAlPieDocumento(escena.lista(), cfgRef.current);
        motor.setMarco(listaMarcosConGuia(n, cfgRef.current, notas));
        guardarCambioConfig({ ...cfgRef.current, cantidadPaginas: n, paginaActiva: activa });
        setPaginaActiva(activa);
      };
      motor._notificar();

      setTimeout(() => {
        if (vivo && motorRef.current && !doc.destinoInicial?.ubicacion) ajustarAncho();
      }, 50);
    })();

    return () => {
      vivo = false;
      baja();
      bajaEstado();
      motor?.destruir();
      auto?.destruir();
      if (proveedorPdfLocal) {
        proveedorPdfLocal.destruir();
      }
    };
  }, [doc.id]);

  // Salto a página desde enlace interno (ej. Tabla de contenido #pag-N)
  useEffect(() => {
    const alAbrirNota = (e) => {
      const url = e.detail?.url;
      if (url && typeof url === 'string' && url.startsWith('#pag-')) {
        const p = parseInt(url.replace('#pag-', ''), 10);
        if (Number.isFinite(p) && p >= 1) {
          irAPagina(p);
        }
      }
    };
    window.addEventListener('nt:abrir-nota', alAbrirNota);
    return () => window.removeEventListener('nt:abrir-nota', alAbrirNota);
  }, [irAPagina]);

  // Agregar una página A4 nueva al final del documento
  const agregarPagina = useCallback(() => {
    motorRef.current?.cerrarTexto();
    const nuevaCantidad = cfg.cantidadPaginas + 1;
    const nuevosMarcos = listaMarcosConGuia(nuevaCantidad, cfgRef.current);

    motorRef.current?.setMarco(nuevosMarcos);
    motorRef.current?.escena.registrar([], 'pagina', { antes: { cantidadPaginas: cfg.cantidadPaginas }, despues: { cantidadPaginas: nuevaCantidad } });
    guardarCambioConfig({
      ...cfgRef.current,
      cantidadPaginas: nuevaCantidad,
      paginaActiva: nuevaCantidad,
    });

    irAPagina(nuevaCantidad);
  }, [cfg.cantidadPaginas, guardarCambioConfig, irAPagina, listaMarcosConGuia]);

  // Duplicar la página activa y clonar sus elementos desplazados
  const duplicarPagina = useCallback(async () => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.cerrarTexto();

    const origen = paginaActiva;
    const nuevaCantidad = cfg.cantidadPaginas + 1;
    const nuevosMarcos = listaMarcosConGuia(nuevaCantidad, cfgRef.current);

    // Clonar elementos de la página actual desplazando sus coordenadas
    const elementosActuales = motor.escena.lista();
    const clonados = duplicarElementosPagina(elementosActuales, origen, nuevaCantidad, nuevoId, cfg.cantidadPaginas);

    // Insertar en la escena (deshacer también quita la hoja)
    motor.escena.ejecutar(clonados.map((el) => ({ id: el.id, antes: null, despues: el })), 'crear', { antes: { cantidadPaginas: cfg.cantidadPaginas }, despues: { cantidadPaginas: nuevaCantidad } });
    motor.setMarco(nuevosMarcos);

    guardarCambioConfig({
      ...cfgRef.current,
      cantidadPaginas: nuevaCantidad,
      paginaActiva: nuevaCantidad,
    });

    irAPagina(nuevaCantidad);
  }, [paginaActiva, cfg.cantidadPaginas, guardarCambioConfig, irAPagina, listaMarcosConGuia]);

  // Eliminar la página actual
  const ejecutarEliminacionPagina = useCallback(async () => {
    const motor = motorRef.current;
    if (!motor || cfg.cantidadPaginas <= 1) return;
    motor.cerrarTexto();

    const numAEliminar = paginaActiva;
    const cambios = cambiosEliminarPagina(motor.escena.lista(), numAEliminar, cfg.cantidadPaginas);

    motor.escena.ejecutar(cambios, 'borrar', { antes: { cantidadPaginas: cfg.cantidadPaginas }, despues: { cantidadPaginas: cfg.cantidadPaginas - 1 } });

    const nuevaCantidad = cfg.cantidadPaginas - 1;
    const nuevosMarcos = listaMarcosConGuia(nuevaCantidad, cfgRef.current);
    motor.setMarco(nuevosMarcos);

    const nuevaActiva = Math.max(1, Math.min(nuevaCantidad, numAEliminar));
    guardarCambioConfig({
      ...cfgRef.current,
      cantidadPaginas: nuevaCantidad,
      paginaActiva: nuevaActiva,
    });

    setConfirmarEliminar(false);
    irAPagina(nuevaActiva);
  }, [paginaActiva, cfg.cantidadPaginas, guardarCambioConfig, irAPagina, listaMarcosConGuia]);

  // Preparar e iniciar la impresión de páginas A4
  const ejecutarImpresion = useCallback(async () => {
    const cont = document.getElementById('nt-area-impresion-paginas');
    if (!cont || !motorRef.current) return;

    const motor = motorRef.current;
    motor.cerrarTexto();
    const listaCompleta = motor.escena.lista();
    const recursosImagen = await prepararImagenes(listaCompleta);

    const paginasAImprimir = modoImpresion === 'actual'
      ? [paginaActiva]
      : Array.from({ length: cfg.cantidadPaginas }, (_, i) => i + 1);

    const factor = factorResolucion(paginasAImprimir.length);
    const notasAlPieMap = extraerNotasAlPieDocumento(listaCompleta, cfgRef.current);

    try { construirHojasPaginas(cont, {
      cantidad: paginasAImprimir.length,
      paginas: paginasAImprimir,
      titulo: docRef.current.titulo || doc.titulo,
      factor,
      encabezado: cfgRef.current.encabezado,
      pie: cfgRef.current.pie,
      estilos: estilosRef.current,
      notasAlPie: notasAlPieMap,
      config: cfgRef.current,
      dibujarEn: (cv, num) => {
        const cx = cv.getContext('2d');
        const marco = marcoDePagina(num, cfgRef.current);

        dibujar(cx, {
          camara: { x: 0, y: marco.y, zoom: 1 },
          ancho: marco.ancho,
          alto: marco.alto,
          dpr: factor,
          lista: listaCompleta,
          escena: motor.escena,
          seleccion: new Set(),
          marco: null,
          mostrarManijas: null,
          renglones: imprimirRenglones ? { cfg: docRef.current.renglones, opacidad: 1 } : null,
          guiaTexto: docRef.current.renglones,
          marcoDocumento: { x: 0, y: marco.y, ancho: marco.ancho, alto: marco.alto, notasAlPie: notasAlPieMap?.get(num) || [] },
          estilos: estilosRef.current,
        });
      },
    }); } finally { recursosImagen.liberar(); }

    setModalImprimir(false);
    imprimirContenedor(cont);
  }, [modoImpresion, paginaActiva, cfg.cantidadPaginas, imprimirRenglones, doc.titulo]);

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

  async function salir() {
    motorRef.current?.finalizarGestoEnCurso();
    motorRef.current?.cerrarTexto();
    try {
      await autoRef.current?.vaciar();
    } catch {
      /* reflejado en estado */
    }
    volver();
  }

  function cambiarTituloDoc(v) {
    setTitulo(v);
    docRef.current = { ...docRef.current, titulo: v.trim() || 'Sin título' };
    tituloSucio.current = true;
    autoRef.current?.programar();
  }

  const m = () => motorRef.current;
  const sel = (ui?.seleccionados || 0) > 0;
  const herr = ui?.herramienta;
  const elementoTextoSeleccionado = ui?.textoSeleccionado || null;
  const desbordeTexto = elementoTextoSeleccionado?.tipo === 'texto' ? desbordeDePagina(elementoTextoSeleccionado) : null;
  const modo = doc.escritura || 'ambos';
  const conMano = modo !== 'teclado';
  const conTeclado = modo !== 'mano';

  function continuarTextoEnPaginaSiguiente() {
    const motor = motorRef.current;
    const elemento = elementoTextoSeleccionado && motor?.escena.get(elementoTextoSeleccionado.id);
    if (!motor || !elemento || elemento.tipo !== 'texto' || !desbordeDePagina(elemento).inferior) return;
    const origen = paginaDeElemento(elemento);
    const destino = origen + 1;
    const cantidadAnterior = cfgRef.current.cantidadPaginas;
    const cantidadNueva = Math.max(cantidadAnterior, destino);
    const marco = marcoDePagina(origen);

    const partido = partirTextoPorDesborde(elemento, marco, nuevoId);
    if (partido) {
      if (cantidadNueva > cantidadAnterior) motor.setMarco(listaMarcosConGuia(cantidadNueva, cfgRef.current));
      motor.escena.ejecutar(
        [
          { id: elemento.id, antes: elemento, despues: partido.elemento1 },
          { id: partido.elemento2.id, antes: null, despues: partido.elemento2 },
        ],
        'partir texto entre páginas',
        cantidadNueva > cantidadAnterior
          ? {
            antes: { cantidadPaginas: cantidadAnterior, paginaActiva: cfgRef.current.paginaActiva },
            despues: { cantidadPaginas: cantidadNueva, paginaActiva: destino },
          }
          : null,
      );
    } else {
      const nuevo = moverElementoAPagina(elemento, destino);
      if (cantidadNueva > cantidadAnterior) motor.setMarco(listaMarcosConGuia(cantidadNueva, cfgRef.current));
      motor.escena.ejecutar(
        [{ id: elemento.id, antes: elemento, despues: nuevo }],
        'mover texto a página siguiente',
        cantidadNueva > cantidadAnterior
          ? {
            antes: { cantidadPaginas: cantidadAnterior, paginaActiva: cfgRef.current.paginaActiva },
            despues: { cantidadPaginas: cantidadNueva, paginaActiva: destino },
          }
          : null,
      );
    }
    if (cantidadNueva > cantidadAnterior) {
      guardarCambioConfig({ ...cfgRef.current, cantidadPaginas: cantidadNueva, paginaActiva: destino });
    }
    irAPagina(destino);
  }

  // Efecto de flujo automático entre hojas
  useEffect(() => {
    if (!cfg.flujoAutomatico || ui?.texto) return;
    const motor = motorRef.current;
    if (!motor) return;
    const textos = motor.escena.lista().filter((e) => e.tipo === 'texto');
    for (const t of textos) {
      const desborde = desbordeDePagina(t);
      if (desborde.inferior) {
        const origen = desborde.pagina;
        const destino = origen + 1;
        const cantidadAnterior = cfgRef.current.cantidadPaginas;
        const cantidadNueva = Math.max(cantidadAnterior, destino);
        const marco = marcoDePagina(origen);
        const partido = partirTextoPorDesborde(t, marco, nuevoId);
        if (partido) {
          if (cantidadNueva > cantidadAnterior) motor.setMarco(listaMarcosConGuia(cantidadNueva, cfgRef.current));
          motor.escena.ejecutar([
            { id: t.id, antes: t, despues: partido.elemento1 },
            { id: partido.elemento2.id, antes: null, despues: partido.elemento2 },
          ], 'flujo automático de texto');
          if (cantidadNueva > cantidadAnterior) {
            guardarCambioConfig({ ...cfgRef.current, cantidadPaginas: cantidadNueva });
          }
          break;
        }
      }
    }
  }, [cfg.flujoAutomatico, ui?.texto, listaMarcosConGuia, guardarCambioConfig]);

  return (
    <div className="nt-editor nt-editor--paginas">
      <header className="nt-ed-cab">
        <button className="nt-btn" onClick={salir}>Biblioteca</button>
        <input className="nt-ed-titulo" aria-label="Título del documento" value={titulo} onChange={(e) => cambiarTituloDoc(e.target.value)} />
        <span className="nt-pagina-badge" title="Formato">
          {cfg.esAnotacionPdf ? `Anotación PDF (${cfg.cantidadPaginas} págs)` : 'Páginas A4 (210 × 297 mm)'}
        </span>
        <span className={`nt-estado ${estado === 'guardado' ? 'nt-estado--ok' : ''} ${estado.startsWith('error') ? 'nt-estado--error' : ''}`} aria-live="polite">
          {TEXTO_ESTADO[estado] ?? TEXTO_ESTADO.error}
        </span>
        <Boton icono="panel" nombre={mostrarMiniaturas ? 'Ocultar miniaturas de páginas' : 'Miniaturas de páginas (saltar a página)'} activo={mostrarMiniaturas} alPulsar={() => setMostrarMiniaturas((v) => !v)} />
        <Boton icono="buscar" nombre="Buscar en este documento (Ctrl+F)" activo={busquedaDoc} alPulsar={() => setBusquedaDoc((v) => !v)} />
        <Boton icono="texto" nombre="Estilos de párrafo del documento" alPulsar={() => setModalEstilos(true)} />
        <Boton icono="lista" nombre="Tabla de contenido automática" alPulsar={() => setModalTablaContenido(true)} />
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
        <Boton icono="imprimir" nombre="Imprimir documento en A4" alPulsar={() => setModalImprimir(true)} />
        <Boton icono="exportar" nombre="Exportar nota (.nota)" deshabilitado={exportando} alPulsar={ejecutarExportar} />
        <Boton icono="deshacer" nombre="Deshacer (Ctrl+Z)" conservarFoco deshabilitado={!ui?.puedeDeshacer} alPulsar={() => m()?.deshacer()} />
        <Boton icono="rehacer" nombre="Rehacer (Ctrl+Y)" conservarFoco deshabilitado={!ui?.puedeRehacer} alPulsar={() => m()?.rehacer()} />
      </header>

      <div className="nt-ed-trabajo">
        {mostrarMiniaturas && (
          <BarraMiniaturasLateral
            cantidad={cfg.cantidadPaginas}
            paginaActiva={paginaActiva}
            alSeleccionar={(num) => irAPagina(num)}
            alCerrar={() => setMostrarMiniaturas(false)}
            proveedorPdf={proveedorPdf}
          />
        )}
        <nav className="nt-riel" aria-label="Herramientas">
          <Boton icono="seleccionar" nombre="Seleccionar (Alt+V)" activo={herr === 'seleccionar'} alPulsar={() => m()?.setHerramienta('seleccionar')} />
          <Boton icono="lazo" nombre="Lazo de selección (Alt+Q)" activo={herr === 'lazo'} alPulsar={() => m()?.setHerramienta('lazo')} />
          <Boton icono="mano" nombre="Mover el lienzo (Alt+H)" activo={herr === 'mano'} alPulsar={() => m()?.setHerramienta('mano')} />
          {conMano && <Boton icono="lapiz" nombre="Lápiz (Alt+P)" activo={herr === 'lapiz'} alPulsar={() => m()?.setHerramienta('lapiz')} />}
          {conMano && <Boton icono="resaltador" nombre="Resaltador (Alt+M)" activo={herr === 'resaltador'} alPulsar={() => m()?.setHerramienta('resaltador')} />}
          {conMano && <Boton icono="borrador" nombre="Borrador (Alt+B)" activo={herr === 'borrador'} alPulsar={() => m()?.setHerramienta('borrador')} />}
          {conTeclado && <Boton icono="texto" nombre="Texto por cuadro (Alt+T)" activo={herr === 'texto'} alPulsar={() => m()?.setHerramienta('texto')} />}
          <InsertarImagen motorRef={motorRef} />
          <SelectorIconos motorRef={motorRef} />
          <MenuFormas herramienta={herr} ultima={ES_FORMA(herr) ? herr : ultimaForma} alElegir={(f) => { setUltimaForma(f); m()?.setHerramienta(f); }} />
          <hr />
          <Boton icono="copiar" nombre="Copiar (Ctrl+C)" deshabilitado={!sel} alPulsar={() => m()?.copiar()} />
          <Boton icono="cortar" nombre="Cortar (Ctrl+X)" deshabilitado={!sel} alPulsar={() => m()?.cortar()} />
          <Boton icono="pegar" nombre="Pegar (Ctrl+V)" deshabilitado={!ui?.puedePegar} alPulsar={() => m()?.pegar()} />
          <Boton icono="duplicar" nombre="Duplicar (Ctrl+D)" deshabilitado={!sel} alPulsar={() => m()?.duplicar()} />
          <hr />
          <Boton icono="agrupar" nombre="Agrupar selección (Ctrl+G)" deshabilitado={!ui?.puedeAgrupar} alPulsar={() => m()?.agruparSeleccion()} />
          <Boton icono="desagrupar" nombre="Desagrupar selección (Ctrl+Shift+G)" deshabilitado={!ui?.puedeDesagrupar} alPulsar={() => m()?.desagruparSeleccion()} />
          <Boton icono={ui?.algunoBloqueado ? 'desbloquear' : 'bloquear'} nombre={ui?.algunoBloqueado ? 'Desbloquear selección (Ctrl+L)' : 'Bloquear selección (Ctrl+L)'} deshabilitado={!sel} activo={ui?.algunoBloqueado} alPulsar={() => m()?.alternarBloqueoSeleccion()} />
          <hr />
          <Boton icono="frente" nombre="Traer al frente" deshabilitado={!sel} alPulsar={() => m()?.reordenar('frente')} />
          <Boton icono="subir" nombre="Subir una capa" deshabilitado={!sel} alPulsar={() => m()?.reordenar('subir')} />
          <Boton icono="bajar" nombre="Bajar una capa" deshabilitado={!sel} alPulsar={() => m()?.reordenar('bajar')} />
          <Boton icono="fondo" nombre="Enviar al fondo" deshabilitado={!sel} alPulsar={() => m()?.reordenar('fondo')} />
          <hr />
          <Boton icono="eliminar" nombre="Eliminar (Supr)" deshabilitado={!sel} alPulsar={() => m()?.eliminarSeleccion()} />
        </nav>

        <div className="nt-lienzo">
          <canvas ref={canvasRef} tabIndex={0} aria-label="Documento de páginas A4" />
          <div className="nt-capa-texto" ref={capaTextoRef} />

          {busquedaDoc && (
            <BarraBusquedaDocumento
              motorRef={motorRef}
              alCerrar={() => setBusquedaDoc(false)}
              alSaltar={(c) => {
                const pag = c.ubicacion?.contenedor;
                if (typeof pag === 'number' && pag >= 1) {
                  setPaginaActiva(pag);
                }
                motorRef.current?.centrarEnUbicacion(c.cajaDestacada || c.ubicacion);
              }}
            />
          )}

          {ui && ['lapiz', 'resaltador', 'borrador'].includes(herr) && <Propiedades ui={ui} motorRef={motorRef} />}
          {ui && (ES_FORMA(herr) || (herr === 'seleccionar' && (ui.figura.seleccionadas > 0 || ui.iconoSeleccionado))) && <PanelFigura estilo={ui.figura} motorRef={motorRef} />}
          {ui?.imagenSeleccionada && <PanelImagen imagen={ui.imagenSeleccionada} motorRef={motorRef} />}
          {ui?.texto && (
            <BarraTexto
              estado={ui.texto}
              motorRef={motorRef}
              estilosDoc={estilos}
              onAbrirEstilos={() => setModalEstilos(true)}
            />
          )}

          {desbordeTexto?.inferior && !ui?.texto && (
            <div className="nt-desborde-texto" role="status">
              {cabeEnPagina(elementoTextoSeleccionado) ? (
                <>
                  <span>El bloque rebasa el margen inferior de la página {desbordeTexto.pagina}. Se moverá completo, sin dividirse.</span>
                  <button className="nt-btn" onClick={continuarTextoEnPaginaSiguiente}>Mover a pág. {desbordeTexto.pagina + 1}</button>
                </>
              ) : <span>Este bloque es mayor que el área imprimible de una hoja; divídalo en varios cuadros de texto.</span>}
            </div>
          )}

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

          {error && <p className="nt-aviso nt-lienzo__aviso" role="alert">{error}</p>}

          {/* Dock inferior: zoom, selección y navegación comparten fila, altura y estilo */}
          <div className="nt-hud-pie">
          <div className="nt-zoom" role="group" aria-label="Zoom">
            <button className="nt-ib" aria-label="Alejar" onClick={() => m()?.zoomPaso(1 / 1.25)}>−</button>
            <button className="nt-zoom__valor" onClick={() => ajustarAncho()} title="Ajustar al ancho">{ui?.zoom ?? 100} %</button>
            <button className="nt-ib" aria-label="Acercar" onClick={() => m()?.zoomPaso(1.25)}>+</button>
            <button className="nt-btn" onClick={ajustarAncho}>Ajustar ancho</button>
            <button className="nt-btn" onClick={encuadrarPagina} title="Ver la página completa en pantalla">Encuadrar pág.</button>
            {ui && <MenuRenglones renglones={ui.renglones} motorRef={motorRef} />}
            <Boton
              icono="iman"
              nombre={ui?.imanActivo ? 'Imán y guías inteligentes activados (clic para desactivar)' : 'Activar imán y guías inteligentes'}
              activo={!!ui?.imanActivo}
              alPulsar={() => m()?.toggleIman()}
            />
          </div>

          {sel && <BarraSeleccion ui={ui} motorRef={motorRef} />}

          {/* Barra inferior de navegación entre páginas */}
          <div className="nt-barra-paginas" role="region" aria-label="Navegación de páginas">
            <div className="nt-paginas-nav">
              <button
                className="nt-btn-sm"
                disabled={paginaActiva <= 1}
                title="Página anterior"
                aria-label="Página anterior"
                onClick={() => irAPagina(paginaActiva - 1)}
              >
                Anterior
              </button>
              <span className="nt-pagina-indicador">
                Pág. {paginaActiva} de {cfg.cantidadPaginas}
              </span>
              <button
                className="nt-btn-sm"
                disabled={paginaActiva >= cfg.cantidadPaginas}
                title="Página siguiente"
                aria-label="Página siguiente"
                onClick={() => irAPagina(paginaActiva + 1)}
              >
                Siguiente
              </button>
            </div>

            <div className="nt-tarjetas-chips" aria-label="Selector rápido de páginas">
              {Array.from({ length: cfg.cantidadPaginas }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  className={`nt-pagina-chip ${num === paginaActiva ? 'nt-pagina-chip--activa' : ''}`}
                  onClick={() => irAPagina(num)}
                  title={`Ir a página ${num}`}
                >
                  {num}
                </button>
              ))}
            </div>

            <span className="nt-separador-v" />

            <button className="nt-btn" onClick={agregarPagina} title="Agregar hoja A4 al final">+ Página</button>
            <button className="nt-btn" onClick={duplicarPagina} title="Duplicar hoja y contenido">Duplicar</button>
            <button
              className="nt-btn"
              disabled={cfg.cantidadPaginas <= 1}
              onClick={() => setConfirmarEliminar(true)}
              title={cfg.cantidadPaginas <= 1 ? 'El documento debe tener al menos una página' : 'Eliminar página actual'}
            >
              Eliminar
            </button>

            <span className="nt-separador-v" />

            <button
              className={`nt-btn ${cfg.flujoAutomatico ? 'nt-btn--primario' : ''}`}
              onClick={() => guardarCambioConfig({ ...cfg, flujoAutomatico: !cfg.flujoAutomatico })}
              title={cfg.flujoAutomatico ? 'Flujo automático entre hojas activado' : 'Flujo automático entre hojas desactivado'}
              aria-pressed={cfg.flujoAutomatico}
            >
              Flujo auto: {cfg.flujoAutomatico ? 'Sí' : 'No'}
            </button>
            <button
              className="nt-btn"
              onClick={() => setModalEncabezadoPie(true)}
              title="Configurar encabezado y pie de página"
            >
              Encabezado y pie
            </button>
            <button
              className="nt-btn"
              onClick={() => setModalConfigurarPagina(true)}
              title="Configurar tamaño de hoja y márgenes"
            >
              Configurar página
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Modal de Impresión */}
      {modalImprimir && (
        <Modal titulo="Imprimir documento en A4" alCerrar={() => setModalImprimir(false)} ancho={500}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <p className="nt-texto-suave" style={{ margin: 0 }}>
              Imprima sus apuntes en hojas A4 estándar o guárdelos como PDF con la separación exacta de páginas.
            </p>

            <div className="nt-fila nt-campos">
              <label>
                Alcance
                <select className="nt-campo" value={modoImpresion} onChange={(e) => setModoImpresion(e.target.value)}>
                  <option value="todas">Todo el documento ({cfg.cantidadPaginas} {cfg.cantidadPaginas === 1 ? 'página' : 'páginas'})</option>
                  <option value="actual">Solo la página actual (Pág. {paginaActiva})</option>
                </select>
              </label>

              <label>
                Formato
                <input
                  className="nt-campo"
                  value={`${dimensionesHoja(cfg).nombre}${cfg.orientacion === 'horizontal' ? ' (Horizontal)' : ''}`}
                  disabled
                />
              </label>
            </div>

            <label className="nt-check" style={{ marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={imprimirRenglones}
                onChange={(e) => {
                  setImprimirRenglones(e.target.checked);
                  guardarCambioConfig({ ...cfgRef.current, imprimirRenglones: e.target.checked });
                }}
              />
              Incluir renglones y cuadrícula de fondo al imprimir
            </label>

            <div className="nt-acciones" style={{ marginTop: '12px' }}>
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
              <button type="button" className="nt-btn nt-btn--primario" onClick={ejecutarImpresion}>
                Imprimir ahora
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmar Eliminación */}
      {confirmarEliminar && (
        <Modal titulo="¿Eliminar esta página?" alCerrar={() => setConfirmarEliminar(false)} ancho={440}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <p style={{ margin: 0 }}>
              Se eliminará la <strong>Página {paginaActiva}</strong> y todo lo dibujado o escrito en ella. Las páginas siguientes subirán de posición.
            </p>
            <div className="nt-acciones">
              <button type="button" className="nt-btn" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
              <button type="button" className="nt-btn" style={{ background: '#d6336c', color: '#fff', borderColor: '#d6336c' }} onClick={ejecutarEliminacionPagina}>
                Eliminar página
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Encabezado y Pie */}
      {modalEncabezadoPie && (
        <Modal titulo="Encabezado y pie de página" alCerrar={() => setModalEncabezadoPie(false)} ancho={480}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <p className="nt-texto-suave" style={{ margin: 0 }}>
              Configure el encabezado superior y pie inferior para todas las hojas A4 del documento y para la impresión.
            </p>

            <div style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '12px' }}>
              <label className="nt-check" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={cfg.encabezado.activo}
                  onChange={(e) => guardarCambioConfig({
                    ...cfg,
                    encabezado: { ...cfg.encabezado, activo: e.target.checked },
                  })}
                />
                Activar encabezado
              </label>
              {cfg.encabezado.activo && (
                <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                  <label>
                    Texto del encabezado
                    <input
                      type="text"
                      className="nt-campo nt-ancho"
                      placeholder="Ej. Anatomía Humana - Resumen"
                      value={cfg.encabezado.texto}
                      onChange={(e) => guardarCambioConfig({
                        ...cfg,
                        encabezado: { ...cfg.encabezado, texto: e.target.value },
                      })}
                    />
                  </label>
                  <label className="nt-check">
                    <input
                      type="checkbox"
                      checked={cfg.encabezado.numeracion}
                      onChange={(e) => guardarCambioConfig({
                        ...cfg,
                        encabezado: { ...cfg.encabezado, numeracion: e.target.checked },
                      })}
                    />
                    Incluir numeración («Página N de M»)
                  </label>
                </div>
              )}
            </div>

            <div style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '12px' }}>
              <label className="nt-check" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={cfg.pie.activo}
                  onChange={(e) => guardarCambioConfig({
                    ...cfg,
                    pie: { ...cfg.pie, activo: e.target.checked },
                  })}
                />
                Activar pie de página
              </label>
              {cfg.pie.activo && (
                <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                  <label>
                    Texto del pie de página
                    <input
                      type="text"
                      className="nt-campo nt-ancho"
                      placeholder="Ej. Documento de estudio"
                      value={cfg.pie.texto}
                      onChange={(e) => guardarCambioConfig({
                        ...cfg,
                        pie: { ...cfg.pie, texto: e.target.value },
                      })}
                    />
                  </label>
                  <label className="nt-check">
                    <input
                      type="checkbox"
                      checked={cfg.pie.numeracion}
                      onChange={(e) => guardarCambioConfig({
                        ...cfg,
                        pie: { ...cfg.pie, numeracion: e.target.checked },
                      })}
                    />
                    Incluir numeración («Página N de M»)
                  </label>
                </div>
              )}
            </div>

            <div className="nt-acciones">
              <button type="button" className="nt-btn nt-btn--primario" onClick={() => setModalEncabezadoPie(false)}>
                Aceptar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modalExportarImagen && (
        <ModalExportarImagen
          alCerrar={() => setModalExportarImagen(false)}
          tipoFormato="paginas"
          doc={doc}
          motorRef={motorRef}
          paginaActiva={paginaActiva}
          cantidadPaginas={cfg.cantidadPaginas}
        />
      )}

      {modalExportarPdf && (
        <ModalExportarPdf
          alCerrar={() => setModalExportarPdf(false)}
          tipoFormato="paginas"
          doc={doc}
          motorRef={motorRef}
          paginaActiva={paginaActiva}
          cantidadPaginas={cfg.cantidadPaginas}
        />
      )}

      {modalEstilos && (
        <ModalEstilos
          estilosActuales={estilos}
          alGuardar={guardarEstilos}
          alCerrar={() => setModalEstilos(false)}
        />
      )}

      {modalTablaContenido && (
        <ModalTablaContenido
          motorRef={motorRef}
          cfg={cfg}
          estilos={estilos}
          paginaActiva={paginaActiva}
          alSaltar={(pag) => irAPagina(pag)}
          alCerrar={() => setModalTablaContenido(false)}
        />
      )}

      {modalConfigurarPagina && (
        <ModalConfigurarPagina
          config={cfg}
          alCerrar={() => setModalConfigurarPagina(false)}
          alGuardar={cambiarConfiguracionPagina}
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

      {/* Contenedor invisible en pantalla normal, visible solo con window.print() */}
      <div id="nt-area-impresion-paginas" className="nt-impresion-paginas" aria-hidden="true" />
    </div>
  );
}
