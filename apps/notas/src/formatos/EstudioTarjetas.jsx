// Modo estudio mejorado (Etapa 21C & Etapa 22A): repaso de tarjetas a pantalla completa.
// - Tarjetas de doble cara (anverso y reverso) con animación 3D y respeto a prefers-reduced-motion
// - Texto oculto («cloze»): tapado con [...] interactivo para revelar al tocar o con atajo (Tecla C)
// - Revelación paso a paso de elementos (pasoEstudio)
// - Puntero láser temporal con estela que se desvanece
// - Temporizador opcional visible (cronómetro y cuenta regresiva)
// - Notas del orador y navegación accesible por teclado y táctil
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dibujar } from '../lienzo/dibujo.js';
import { liberarImagenesCanvas } from '../herramientas/imagenes/recursos.js';
import { layoutDe, medidorCanvas } from '../herramientas/texto/pintar.js';
import { buscarMascaraEnPunto } from '../lienzo/oclusion.js';
import {
  moverEstudio, pasoPorDeslizamiento, pasoPorTecla, pasoPorToque,
} from './estudio.js';
import {
  CALIFICACIONES,
  METADATOS_CALIFICACION,
  calcularRepasoSM2,
  predecirIntervalos,
  obtenerEstadoRepaso,
  guardarEstadoRepaso,
  obtenerFechaHoyISO,
  calcularEstadisticasRepaso,
  listarTodosEstadosRepaso,
} from '../almacen/repeticion.js';

const MARGEN = 24; // espacio libre alrededor de la tarjeta (px)
const DURACION_LASER_MS = 1500; // duración de la estela del puntero láser

export default function EstudioTarjetas({
  tarjetas, indiceInicial = 0, med, obtenerLista, renglones, onSalir,
  documentoId = null, fechaHoyISO = null,
}) {
  const raizRef = useRef(null);
  const escenarioRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasReversoRef = useRef(null);
  const laserCanvasRef = useRef(null);
  const gestoRef = useRef(null);

  const [indice, setIndice] = useState(() => moverEstudio(indiceInicial, 0, tarjetas.length));
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  const [verNotas, setVerNotas] = useState(false);
  const [pasoActual, setPasoActual] = useState(1);
  const [laserActivo, setLaserActivo] = useState(false);

  // Repetición espaciada (Etapa 22C)
  const hoyISO = useMemo(() => fechaHoyISO || obtenerFechaHoyISO(), [fechaHoyISO]);
  const [estadoTarjeta, setEstadoTarjeta] = useState(null);
  const [avisoRepaso, setAvisoRepaso] = useState('');
  const [sesionRepasos, setSesionRepasos] = useState([]);
  const [mostrarResumenSesion, setMostrarResumenSesion] = useState(false);
  const [statsFinales, setStatsFinales] = useState(null);

  // Doble cara: 'anverso' | 'reverso' (Etapa 22A)
  const [caraEstudio, setCaraEstudio] = useState('anverso');

  // Texto oculto (cloze): claves de clozes revelados individualmente y flag para revelar todos (Etapa 22A)
  const [reveladosOcultos, setReveladosOcultos] = useState(() => new Set());
  const [revelarTodosOcultos, setRevelarTodosOcultos] = useState(false);

  // Oclusión de imágenes (Etapa 22B): modo 'todas' | 'una', máscaras reveladas e índice de máscara activa
  const [modoOclusionImg, setModoOclusionImg] = useState('todas');
  const [reveladosMascaras, setReveladosMascaras] = useState(() => new Set());
  const [indiceUnaMascara, setIndiceUnaMascara] = useState(0);

  // Detección de preferencia de movimiento reducido
  const [prefiereMovimientoReducido, setPrefiereMovimientoReducido] = useState(() => {
    try {
      return window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const mq = window?.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (!mq) return undefined;
      const alCambiar = (e) => setPrefiereMovimientoReducido(e.matches);
      mq.addEventListener?.('change', alCambiar);
      return () => mq.removeEventListener?.('change', alCambiar);
    } catch {
      return undefined;
    }
  }, []);

  // Estado del temporizador visible
  const [verTemporizador, setVerTemporizador] = useState(false);
  const [modoTemp, setModoTemp] = useState('cronometro'); // 'cronometro' | 'cuenta-regresiva'
  const [segundosTemp, setSegundosTemp] = useState(0);
  const [tiempoObjetivo, setTiempoObjetivo] = useState(180); // 3 min
  const [tempCorriendo, setTempCorriendo] = useState(false);

  // Láser: puntos de la estela { x, y, t } y puntero actual
  const puntosLaserRef = useRef([]);
  const punteroActualRef = useRef(null);
  const animLaserRef = useRef(null);
  const laserDibujandoRef = useRef(false);

  const total = tarjetas.length;
  const tarjeta = tarjetas[indice];

  // Elementos de la tarjeta según cara
  const listaAnversoCompleta = useMemo(() => {
    if (!tarjeta) return [];
    return obtenerLista(tarjeta.id, 'anverso') || [];
  }, [tarjeta, obtenerLista]);

  const listaReversoCompleta = useMemo(() => {
    if (!tarjeta || !tarjeta.dobleCara) return [];
    return obtenerLista(tarjeta.id, 'reverso') || [];
  }, [tarjeta, obtenerLista]);

  // Lista de la cara actualmente activa
  const listaCaraActiva = caraEstudio === 'reverso' ? listaReversoCompleta : listaAnversoCompleta;
  const maxPaso = useMemo(() => listaCaraActiva.reduce((m, el) => Math.max(m, el.pasoEstudio || 0), 0), [listaCaraActiva]);

  // Al cambiar de tarjeta, se restablecen cara, paso y revelados
  const [prevIndice, setPrevIndice] = useState(indice);
  if (prevIndice !== indice) {
    setPrevIndice(indice);
    setPasoActual(1);
    setCaraEstudio('anverso');
    setReveladosOcultos(new Set());
    setRevelarTodosOcultos(false);
    setReveladosMascaras(new Set());
    setIndiceUnaMascara(0);
  }

  // Elementos visibles según el paso actual para cada cara
  const listaAnversoVisible = useMemo(() => {
    if (caraEstudio === 'reverso' || maxPaso <= 0) return listaAnversoCompleta;
    return listaAnversoCompleta.filter((el) => !el.pasoEstudio || el.pasoEstudio <= pasoActual);
  }, [listaAnversoCompleta, maxPaso, pasoActual, caraEstudio]);

  const listaReversoVisible = useMemo(() => {
    if (caraEstudio === 'anverso' || maxPaso <= 0) return listaReversoCompleta;
    return listaReversoCompleta.filter((el) => !el.pasoEstudio || el.pasoEstudio <= pasoActual);
  }, [listaReversoCompleta, maxPaso, pasoActual, caraEstudio]);

  // Verifica si existen textos con cloze en la tarjeta actual (en cualquier cara)
  const hayOcultos = useMemo(() => {
    const tieneEnLista = (l) => l.some((el) => {
      if (el.tipo !== 'texto' || !Array.isArray(el.datos?.bloques)) return false;
      const L = layoutDe(el.datos, el.ancho, medidorCanvas);
      return Array.isArray(L?.ocultos) && L.ocultos.length > 0;
    });
    return tieneEnLista(listaAnversoCompleta) || tieneEnLista(listaReversoCompleta);
  }, [listaAnversoCompleta, listaReversoCompleta]);

  // Verifica si existen imágenes con máscaras de oclusión en la tarjeta actual
  const hayMascarasImagen = useMemo(() => {
    const tieneEnLista = (l) => l.some((el) => el.tipo === 'imagen' && Array.isArray(el.datos?.mascaras) && el.datos.mascaras.length > 0);
    return tieneEnLista(listaAnversoCompleta) || tieneEnLista(listaReversoCompleta);
  }, [listaAnversoCompleta, listaReversoCompleta]);

  // Total de máscaras en la cara activa actual
  const totalMascarasActiva = useMemo(() => {
    return listaCaraActiva.reduce((acc, el) => {
      if (el.tipo === 'imagen' && Array.isArray(el.datos?.mascaras)) {
        return acc + el.datos.mascaras.length;
      }
      return acc;
    }, 0);
  }, [listaCaraActiva]);

  // Salida segura sin reiniciar efectos de pantalla completa
  const salirRef = useRef(onSalir);
  useEffect(() => { salirRef.current = onSalir; });
  const salir = useCallback(() => salirRef.current(), []);

  useEffect(() => () => {
    liberarImagenesCanvas(canvasRef.current);
    liberarImagenesCanvas(canvasReversoRef.current);
  }, []);

  const ir = useCallback((paso) => {
    setIndice((i) => moverEstudio(i, paso, total));
  }, [total]);

  // Alternar cara en tarjeta de doble cara
  const voltearTarjeta = useCallback(() => {
    if (!tarjeta?.dobleCara) return;
    setCaraEstudio((c) => (c === 'anverso' ? 'reverso' : 'anverso'));
    setPasoActual(1);
  }, [tarjeta?.dobleCara]);

  // Navegación con pasos: si hay pasos pendientes en la cara activa avanza el paso; si no, avanza la tarjeta
  const avanzarPasoOTarjeta = useCallback(() => {
    if (maxPaso > 1 && pasoActual < maxPaso) {
      setPasoActual((p) => p + 1);
    } else {
      ir(1);
    }
  }, [maxPaso, pasoActual, ir]);

  const retrocederPasoOTarjeta = useCallback(() => {
    if (maxPaso > 1 && pasoActual > 1) {
      setPasoActual((p) => p - 1);
    } else {
      ir(-1);
    }
  }, [maxPaso, pasoActual, ir]);

  const revelarTodo = useCallback(() => {
    if (maxPaso > 0) setPasoActual(maxPaso);
    setRevelarTodosOcultos(true);
  }, [maxPaso]);

  const reiniciarPasos = useCallback(() => {
    setPasoActual(1);
    setRevelarTodosOcultos(false);
    setReveladosMascaras(new Set());
    setIndiceUnaMascara(0);
  }, []);

  // Carga del estado de repaso de la tarjeta activa en IndexedDB
  useEffect(() => {
    let activo = true;
    if (documentoId && tarjeta?.id) {
      obtenerEstadoRepaso(documentoId, tarjeta.id)
        .then((est) => { if (activo) setEstadoTarjeta(est || null); })
        .catch(() => { if (activo) setEstadoTarjeta(null); });
    } else {
      queueMicrotask(() => {
        if (activo) setEstadoTarjeta(null);
      });
    }
    return () => { activo = false; };
  }, [documentoId, tarjeta?.id]);

  // Predicciones de intervalo para los 4 botones
  const predicciones = useMemo(() => {
    return predecirIntervalos(estadoTarjeta, hoyISO);
  }, [estadoTarjeta, hoyISO]);

  // Calificar tarjeta actual mediante el algoritmo SM-2
  const calificarTarjeta = useCallback(async (calificacion) => {
    if (!tarjeta) return;
    const meta = METADATOS_CALIFICACION[calificacion];
    const docId = documentoId || 'doc-tarjetas';
    const nuevo = calcularRepasoSM2(
      estadoTarjeta || { documentoId: docId, tarjetaId: tarjeta.id },
      calificacion,
      hoyISO,
    );
    nuevo.documentoId = docId;
    nuevo.tarjetaId = tarjeta.id;
    nuevo.id = `${docId}:${tarjeta.id}`;

    try {
      await guardarEstadoRepaso(nuevo);
      setEstadoTarjeta(nuevo);
    } catch {
      /* si el entorno no admite persistencia, continuar normalmente */
    }

    setSesionRepasos((prev) => [...prev, { tarjetaId: tarjeta.id, calificacion, intervalo: nuevo.intervalo }]);
    setAvisoRepaso(`«${meta.etiqueta}» guardado · Próximo repaso: en ${nuevo.intervalo} día(s)`);
    setTimeout(() => setAvisoRepaso(''), 2500);

    // Si aún hay más tarjetas en el mazo, avanzar a la siguiente
    if (indice < total - 1) {
      setTimeout(() => {
        ir(1);
      }, 150);
    } else {
      // Última tarjeta: preparar estadísticas y mostrar resumen de sesión
      try {
        const todos = await listarTodosEstadosRepaso();
        const stats = calcularEstadisticasRepaso(todos, hoyISO);
        setStatsFinales(stats);
      } catch {
        setStatsFinales(null);
      }
      setMostrarResumenSesion(true);
    }
  }, [tarjeta, documentoId, estadoTarjeta, hoyISO, indice, total, ir]);

  // Control del temporizador
  useEffect(() => {
    if (!tempCorriendo) return undefined;
    const interval = setInterval(() => {
      setSegundosTemp((s) => {
        if (modoTemp === 'cuenta-regresiva') {
          if (s <= 1) {
            setTempCorriendo(false);
            return 0;
          }
          return s - 1;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tempCorriendo, modoTemp]);

  const iniciarPausarTemp = () => setTempCorriendo((v) => !v);
  const reiniciarTemp = () => {
    setTempCorriendo(false);
    setSegundosTemp(modoTemp === 'cuenta-regresiva' ? tiempoObjetivo : 0);
  };
  const fijarPresetRegresiva = (seg) => {
    setTiempoObjetivo(seg);
    setSegundosTemp(seg);
    setTempCorriendo(false);
  };

  const formatearTiempo = (seg) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Pantalla completa cuando el navegador la permite
  useEffect(() => {
    const raiz = raizRef.current;
    raiz?.focus();
    let activa = false;
    try {
      const p = raiz?.requestFullscreen?.();
      if (p && typeof p.then === 'function') p.then(() => { activa = true; }).catch(() => {});
    } catch {
      /* sin pantalla completa */
    }
    const alCambiar = () => { if (activa && !document.fullscreenElement) salir(); };
    document.addEventListener('fullscreenchange', alCambiar);
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar);
      activa = false;
      try {
        if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
      } catch {
        /* ya no estaba en pantalla completa */
      }
    };
  }, [salir]);

  // Medida del escenario disponible
  useEffect(() => {
    const el = escenarioRef.current;
    if (!el) return undefined;
    const medir = () => setTamano({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dibujo de las caras de la tarjeta
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tarjeta || !tamano.ancho || !tamano.alto) return;
    const libreAncho = Math.max(50, tamano.ancho - 2 * MARGEN);
    const libreAlto = Math.max(50, tamano.alto - 2 * MARGEN);
    const zoom = Math.min(libreAncho / med.ancho, libreAlto / med.alto);
    const ancho = Math.round(med.ancho * zoom);
    const alto = Math.round(med.alto * zoom);
    const dpr = window.devicePixelRatio || 1;

    // 1. Dibujar Cara Anverso
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;
    const cx = canvas.getContext('2d');
    if (cx) {
      const porId = new Map(listaAnversoVisible.map((e) => [e.id, e]));
      const dibujarAnverso = () => dibujar(cx, {
        camara: { x: 0, y: 0, zoom },
        ancho,
        alto,
        dpr,
        lista: listaAnversoVisible,
        escena: { get: (id) => porId.get(id) },
        seleccion: new Set(),
        marco: null,
        mostrarManijas: null,
        renglones: renglones ? { cfg: renglones, opacidad: 1 } : null,
        guiaTexto: renglones,
        marcoDocumento: { x: 0, y: 0, ancho: med.ancho, alto: med.alto, fondo: tarjeta.fondo || null },
        alImagenLista: (cv) => { if (cv === canvas) dibujarAnverso(); },
        opcionesOculto: {
          activo: true,
          revelados: reveladosOcultos,
          reveladosMascaras,
          modoOclusion: modoOclusionImg,
          indiceMascaraUna: indiceUnaMascara,
          revelarTodo: revelarTodosOcultos,
        },
      });
      dibujarAnverso();
    }

    // 2. Dibujar Cara Reverso (si la tarjeta tiene doble cara activada)
    const canvasRev = canvasReversoRef.current;
    if (canvasRev && tarjeta.dobleCara) {
      canvasRev.width = Math.round(ancho * dpr);
      canvasRev.height = Math.round(alto * dpr);
      canvasRev.style.width = `${ancho}px`;
      canvasRev.style.height = `${alto}px`;
      const cxRev = canvasRev.getContext('2d');
      if (cxRev) {
        const porIdRev = new Map(listaReversoVisible.map((e) => [e.id, e]));
        const fondoReverso = tarjeta.fondoReverso || tarjeta.fondo || null;
        const dibujarReverso = () => dibujar(cxRev, {
          camara: { x: 0, y: 0, zoom },
          ancho,
          alto,
          dpr,
          lista: listaReversoVisible,
          escena: { get: (id) => porIdRev.get(id) },
          seleccion: new Set(),
          marco: null,
          mostrarManijas: null,
          renglones: renglones ? { cfg: renglones, opacidad: 1 } : null,
          guiaTexto: renglones,
          marcoDocumento: { x: 0, y: 0, ancho: med.ancho, alto: med.alto, fondo: fondoReverso },
          alImagenLista: (cv) => { if (cv === canvasRev) dibujarReverso(); },
          opcionesOculto: {
            activo: true,
            revelados: reveladosOcultos,
            reveladosMascaras,
            modoOclusion: modoOclusionImg,
            indiceMascaraUna: indiceUnaMascara,
            revelarTodo: revelarTodosOcultos,
          },
        });
        dibujarReverso();
      }
    }
  }, [tarjeta, tamano, med, listaAnversoVisible, listaReversoVisible, renglones, reveladosOcultos, revelarTodosOcultos, reveladosMascaras, modoOclusionImg, indiceUnaMascara]);

  // Bucle de animación del puntero láser temporal
  const iniciarBucleLaser = useCallback(() => {
    if (laserDibujandoRef.current) return;
    laserDibujandoRef.current = true;

    const bucle = () => {
      const cv = laserCanvasRef.current;
      if (!cv) {
        laserDibujandoRef.current = false;
        return;
      }
      const cx = cv.getContext('2d');
      if (!cx) {
        laserDibujandoRef.current = false;
        return;
      }

      const ahora = performance.now();
      const puntos = puntosLaserRef.current;

      while (puntos.length && ahora - puntos[0].t > DURACION_LASER_MS) {
        puntos.shift();
      }

      cx.clearRect(0, 0, cv.width, cv.height);

      if (puntos.length > 1) {
        cx.save();
        cx.lineCap = 'round';
        cx.lineJoin = 'round';
        cx.shadowColor = '#ef4444';

        for (let i = 1; i < puntos.length; i++) {
          const pAnterior = puntos[i - 1];
          const pActual = puntos[i];
          const edad = ahora - pActual.t;
          const alpha = Math.max(0, 1 - edad / DURACION_LASER_MS);
          if (alpha <= 0) continue;

          cx.beginPath();
          cx.moveTo(pAnterior.x, pAnterior.y);
          cx.lineTo(pActual.x, pActual.y);
          cx.lineWidth = 5 * alpha + 1;
          cx.shadowBlur = 10 * alpha;
          cx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          cx.stroke();
        }
        cx.restore();
      }

      const cursor = punteroActualRef.current;
      if (cursor) {
        cx.save();
        cx.shadowColor = '#ef4444';
        cx.shadowBlur = 15;

        const rad = cx.createRadialGradient(cursor.x, cursor.y, 1, cursor.x, cursor.y, 10);
        rad.addColorStop(0, '#ffffff');
        rad.addColorStop(0.3, '#fca5a5');
        rad.addColorStop(0.7, '#ef4444');
        rad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        cx.fillStyle = rad;
        cx.beginPath();
        cx.arc(cursor.x, cursor.y, 10, 0, Math.PI * 2);
        cx.fill();

        cx.fillStyle = '#ffffff';
        cx.beginPath();
        cx.arc(cursor.x, cursor.y, 2.5, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
      }

      if (puntos.length > 0 || punteroActualRef.current) {
        animLaserRef.current = requestAnimationFrame(bucle);
      } else {
        laserDibujandoRef.current = false;
        animLaserRef.current = null;
      }
    };

    animLaserRef.current = requestAnimationFrame(bucle);
  }, []);

  // Ajustar tamaño del canvas del láser al cambiar dimensiones
  useEffect(() => {
    const cv = laserCanvasRef.current;
    if (!cv || !tamano.ancho || !tamano.alto) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(tamano.ancho * dpr);
    cv.height = Math.round(tamano.alto * dpr);
    cv.style.width = `${tamano.ancho}px`;
    cv.style.height = `${tamano.alto}px`;
    const cx = cv.getContext('2d');
    if (cx) cx.scale(dpr, dpr);
  }, [tamano]);

  // Limpiar láser al desactivar o desmontar
  useEffect(() => {
    if (!laserActivo) {
      puntosLaserRef.current = [];
      punteroActualRef.current = null;
      if (animLaserRef.current) cancelAnimationFrame(animLaserRef.current);
      laserDibujandoRef.current = false;
      const cv = laserCanvasRef.current;
      if (cv) {
        const cx = cv.getContext('2d');
        cx?.clearRect(0, 0, cv.width, cv.height);
      }
    }
  }, [laserActivo]);

  // Atajos de teclado en modo estudio
  function alTecla(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      salir();
      return;
    }
    // Voltear tarjeta de doble cara (Tecla F)
    if (e.key === 'f' || e.key === 'F') {
      if (tarjeta?.dobleCara) {
        e.preventDefault();
        voltearTarjeta();
      }
      return;
    }
    // Alternar modo de oclusión de imagen (Tecla O)
    if (e.key === 'o' || e.key === 'O') {
      if (hayMascarasImagen) {
        e.preventDefault();
        setModoOclusionImg((m) => (m === 'todas' ? 'una' : 'todas'));
      }
      return;
    }
    // Revelar / ocultar texto cloze y máscaras (Tecla C)
    if (e.key === 'c' || e.key === 'C') {
      if (hayOcultos || hayMascarasImagen) {
        e.preventDefault();
        setRevelarTodosOcultos((v) => !v);
      }
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      setVerNotas((v) => !v);
      return;
    }
    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      setLaserActivo((v) => !v);
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      setVerTemporizador((v) => !v);
      return;
    }
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      revelarTodo();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      reiniciarPasos();
      return;
    }

    // Calificación rápida de repetición espaciada (Teclas 1, 2, 3, 4)
    if (e.key === '1') {
      e.preventDefault();
      calificarTarjeta(CALIFICACIONES.OTRA_VEZ);
      return;
    }
    if (e.key === '2') {
      e.preventDefault();
      calificarTarjeta(CALIFICACIONES.DIFICIL);
      return;
    }
    if (e.key === '3') {
      e.preventDefault();
      calificarTarjeta(CALIFICACIONES.BIEN);
      return;
    }
    if (e.key === '4') {
      e.preventDefault();
      calificarTarjeta(CALIFICACIONES.FACIL);
      return;
    }

    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      avanzarPasoOTarjeta();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      retrocederPasoOTarjeta();
      return;
    }

    const nuevo = pasoPorTecla(e.key, indice, total);
    if (nuevo !== null) {
      e.preventDefault();
      setIndice(nuevo);
    }
  }

  // Eventos táctiles y de ratón (navegación, cloze o puntero láser)
  function alBajar(e) {
    if (laserActivo) {
      const caja = escenarioRef.current?.getBoundingClientRect();
      if (!caja) return;
      const x = e.clientX - caja.left;
      const y = e.clientY - caja.top;
      punteroActualRef.current = { x, y };
      puntosLaserRef.current.push({ x, y, t: performance.now() });
      iniciarBucleLaser();
      return;
    }
    if (gestoRef.current) return;
    gestoRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  function alMover(e) {
    if (laserActivo && punteroActualRef.current) {
      const caja = escenarioRef.current?.getBoundingClientRect();
      if (!caja) return;
      const x = e.clientX - caja.left;
      const y = e.clientY - caja.top;
      punteroActualRef.current = { x, y };
      puntosLaserRef.current.push({ x, y, t: performance.now() });
      iniciarBucleLaser();
    }
  }

  function alSoltar(e) {
    if (laserActivo) {
      punteroActualRef.current = null;
      return;
    }
    const g = gestoRef.current;
    if (!g || g.id !== e.pointerId) return;
    gestoRef.current = null;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const desliz = pasoPorDeslizamiento(dx, dy);
    if (desliz) {
      if (desliz > 0) avanzarPasoOTarjeta();
      else retrocederPasoOTarjeta();
      return;
    }

    if (Math.hypot(dx, dy) < 10) {
      // Comprobar si se tocó sobre un fragmento de texto oculto («cloze») en la cara visible
      const cvActivo = (caraEstudio === 'reverso' && tarjeta.dobleCara)
        ? canvasReversoRef.current
        : canvasRef.current;

      if (cvActivo) {
        const rect = cvActivo.getBoundingClientRect();
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const libreAncho = Math.max(50, tamano.ancho - 2 * MARGEN);
          const libreAlto = Math.max(50, tamano.alto - 2 * MARGEN);
          const zoom = Math.min(libreAncho / med.ancho, libreAlto / med.alto);
          const docX = (e.clientX - rect.left) / zoom;
          const docY = (e.clientY - rect.top) / zoom;

          const listaActiva = caraEstudio === 'reverso' ? listaReversoVisible : listaAnversoVisible;

          // Comprobar si se tocó sobre una máscara de oclusión de imagen
          const impactoMascara = buscarMascaraEnPunto(docX, docY, listaActiva);
          if (impactoMascara) {
            const claveMascara = `${impactoMascara.elemento.id}-${impactoMascara.mascara.id}`;
            setReveladosMascaras((prev) => {
              const sig = new Set(prev);
              if (sig.has(claveMascara)) sig.delete(claveMascara);
              else sig.add(claveMascara);
              return sig;
            });
            return; // El clic reveló/ocultó la máscara de la imagen, no voltea ni cambia tarjeta
          }

          let claveClickeada = null;

          for (const el of listaActiva) {
            if (el.tipo === 'texto' && Array.isArray(el.datos?.bloques)) {
              const L = layoutDe(el.datos, el.ancho, medidorCanvas);
              if (Array.isArray(L?.ocultos)) {
                for (const oc of L.ocultos) {
                  const rx = el.x + oc.x - 2;
                  const ry = el.y + oc.y - 1;
                  const rw = oc.w + 4;
                  const rh = oc.h + 2;
                  if (docX >= rx && docX <= rx + rw && docY >= ry && docY <= ry + rh) {
                    claveClickeada = `${el.id}-${oc.indice}`;
                    break;
                  }
                }
              }
            }
            if (claveClickeada) break;
          }

          if (claveClickeada) {
            setReveladosOcultos((prev) => {
              const sig = new Set(prev);
              if (sig.has(claveClickeada)) sig.delete(claveClickeada);
              else sig.add(claveClickeada);
              return sig;
            });
            return; // El clic reveló/ocultó el cloze, no voltea ni cambia tarjeta
          }

          // Si la tarjeta es de doble cara y se tocó la tarjeta, dar vuelta (voltear cara)
          if (tarjeta.dobleCara) {
            voltearTarjeta();
            return;
          }
        }
      }

      // Tarjetas de una sola cara: toque lateral izquierdo retrocede, derecho avanza
      const caja = e.currentTarget.getBoundingClientRect();
      const paso = pasoPorToque(e.clientX - caja.left, caja.width);
      if (paso > 0) avanzarPasoOTarjeta();
      else if (paso < 0) retrocederPasoOTarjeta();
    }
  }

  function alCancelar() {
    gestoRef.current = null;
    if (laserActivo) punteroActualRef.current = null;
  }

  if (!tarjeta) return null;

  const libreAncho = Math.max(50, tamano.ancho - 2 * MARGEN);
  const libreAlto = Math.max(50, tamano.alto - 2 * MARGEN);
  const zoom = Math.min(libreAncho / med.ancho, libreAlto / med.alto);
  const anchoPx = Math.round(med.ancho * zoom);
  const altoPx = Math.round(med.alto * zoom);

  return (
    <div
      ref={raizRef}
      className="nt-estudio"
      role="dialog"
      aria-modal="true"
      aria-label="Modo estudio"
      tabIndex={-1}
      onKeyDown={alTecla}
    >
      <header className="nt-estudio__cab" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="nt-estudio__titulo" style={{ fontWeight: 600 }}>{tarjeta.titulo || `Tarjeta ${indice + 1}`}</span>
          <span className="nt-estudio__indicador" aria-live="polite">
            Tarjeta {indice + 1} de {total}
            {tarjeta.dobleCara && (
              <span style={{ marginLeft: '6px', color: '#93c5fd', fontWeight: 600 }}>
                ({caraEstudio === 'reverso' ? 'Reverso' : 'Anverso'})
              </span>
            )}
          </span>
        </div>

        {/* Controles de revelación por pasos si la cara contiene elementos con paso */}
        {maxPaso > 1 && (
          <div
            className="nt-estudio__pasos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(30, 41, 59, 0.7)',
              padding: '4px 10px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            role="group"
            aria-label="Revelación por pasos"
          >
            <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 600 }}>
              Paso {pasoActual} de {maxPaso}
            </span>
            <button
              type="button"
              className="nt-btn"
              style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
              disabled={pasoActual <= 1}
              onClick={() => setPasoActual((p) => Math.max(1, p - 1))}
              title="Paso anterior (Flecha izquierda)"
            >
              Anterior
            </button>
            <button
              type="button"
              className="nt-btn"
              style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
              disabled={pasoActual >= maxPaso}
              onClick={() => setPasoActual((p) => Math.min(maxPaso, p + 1))}
              title="Paso siguiente (Espacio o Flecha derecha)"
            >
              Siguiente
            </button>
            {pasoActual < maxPaso ? (
              <button
                type="button"
                className="nt-btn"
                style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                onClick={revelarTodo}
                title="Revelar todo el contenido de la tarjeta (Tecla A)"
              >
                Revelar todo
              </button>
            ) : (
              <button
                type="button"
                className="nt-btn"
                style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                onClick={reiniciarPasos}
                title="Reiniciar pasos al primero (Tecla R)"
              >
                Reiniciar
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Botón voltear cara para tarjetas de doble cara */}
          {tarjeta.dobleCara && (
            <button
              type="button"
              className={`nt-btn ${caraEstudio === 'reverso' ? 'nt-btn--activo' : ''}`}
              onClick={voltearTarjeta}
              title="Dar vuelta la tarjeta para ver la otra cara (Tecla F o tocar la tarjeta)"
              aria-pressed={caraEstudio === 'reverso'}
            >
              {caraEstudio === 'anverso' ? 'Ver Reverso (F)' : 'Ver Anverso (F)'}
            </button>
          )}

          {/* Controles de oclusión de imagen si la tarjeta contiene imágenes con máscaras */}
          {hayMascarasImagen && (
            <div
              role="group"
              aria-label="Oclusión de imágenes"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(30, 41, 59, 0.7)',
                padding: '2px 8px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Máscaras:</span>
              <button
                type="button"
                className={`nt-btn ${modoOclusionImg === 'todas' ? 'nt-btn--activo' : ''}`}
                style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                onClick={() => setModoOclusionImg('todas')}
                title="Ocultar todas las máscaras a la vez"
              >
                Todas
              </button>
              <button
                type="button"
                className={`nt-btn ${modoOclusionImg === 'una' ? 'nt-btn--activo' : ''}`}
                style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                onClick={() => setModoOclusionImg('una')}
                title="Ocultar una sola máscara por vez y mostrar las demás para contexto (O)"
              >
                Una
              </button>

              {modoOclusionImg === 'una' && totalMascarasActiva > 1 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                  <button
                    type="button"
                    className="nt-btn"
                    style={{ padding: '2px 6px', fontSize: '11px', height: '24px' }}
                    disabled={indiceUnaMascara <= 0}
                    onClick={() => setIndiceUnaMascara((i) => Math.max(0, i - 1))}
                    title="Máscara anterior"
                  >
                    Anterior
                  </button>
                  <span style={{ fontSize: '11px', color: '#93c5fd', minWidth: '32px', textAlign: 'center' }}>
                    {indiceUnaMascara + 1}/{totalMascarasActiva}
                  </span>
                  <button
                    type="button"
                    className="nt-btn"
                    style={{ padding: '2px 6px', fontSize: '11px', height: '24px' }}
                    disabled={indiceUnaMascara >= totalMascarasActiva - 1}
                    onClick={() => setIndiceUnaMascara((i) => Math.min(totalMascarasActiva - 1, i + 1))}
                    title="Máscara siguiente"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Botón revelar / tapar todo el texto oculto y máscaras */}
          {(hayOcultos || hayMascarasImagen) && (
            <button
              type="button"
              className={`nt-btn ${revelarTodosOcultos ? 'nt-btn--activo' : ''}`}
              onClick={() => setRevelarTodosOcultos((v) => !v)}
              title="Revelar u ocultar todo el contenido oculto en esta tarjeta (Tecla C)"
              aria-pressed={revelarTodosOcultos}
            >
              {revelarTodosOcultos ? 'Tapar todo (C)' : 'Revelar todo (C)'}
            </button>
          )}

          {/* Botón puntero láser */}
          <button
            type="button"
            className={`nt-btn ${laserActivo ? 'nt-btn--activo' : ''}`}
            onClick={() => setLaserActivo((v) => !v)}
            title="Activar / desactivar puntero láser temporal (Tecla L)"
            aria-pressed={laserActivo}
            style={{
              borderColor: laserActivo ? '#ef4444' : undefined,
              color: laserActivo ? '#fca5a5' : undefined,
            }}
          >
            Láser (L)
          </button>

          {/* Botón temporizador visible */}
          <button
            type="button"
            className={`nt-btn ${verTemporizador ? 'nt-btn--activo' : ''}`}
            onClick={() => setVerTemporizador((v) => !v)}
            title="Mostrar u ocultar temporizador (Tecla T)"
            aria-pressed={verTemporizador}
          >
            {formatearTiempo(segundosTemp)}
          </button>

          {/* Botón notas del orador */}
          <button
            type="button"
            className={`nt-btn ${verNotas ? 'nt-btn--activo' : ''}`}
            onClick={() => setVerNotas(!verNotas)}
            title="Ver / ocultar notas del orador (Tecla N)"
          >
            Notas {tarjeta.notasOrador?.trim() ? '•' : ''}
          </button>

          <button type="button" className="nt-btn" onClick={salir} aria-label="Salir del modo estudio">
            Salir (Esc)
          </button>
        </div>
      </header>

      <div
        ref={escenarioRef}
        className="nt-estudio__escenario"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alCancelar}
        style={{ cursor: laserActivo ? 'crosshair' : 'default', position: 'relative' }}
      >
        {/* Contenedor 3D para animación fluida de vuelta de tarjeta */}
        <div
          className="nt-estudio-ficha-3d"
          style={{
            position: 'relative',
            width: `${anchoPx}px`,
            height: `${altoPx}px`,
            perspective: '1200px',
          }}
        >
          <div
            className="nt-estudio-ficha-volteable"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transition: prefiereMovimientoReducido ? 'none' : 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: tarjeta.dobleCara && caraEstudio === 'reverso' ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Cara Anverso */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                pointerEvents: (!tarjeta.dobleCara || caraEstudio === 'anverso') ? 'auto' : 'none',
              }}
            >
              <canvas
                ref={canvasRef}
                className="nt-estudio__tarjeta"
                aria-label={`Anverso: Tarjeta ${indice + 1} de ${total}`}
              />
            </div>

            {/* Cara Reverso (si la tarjeta es de doble cara) */}
            {tarjeta.dobleCara && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  pointerEvents: caraEstudio === 'reverso' ? 'auto' : 'none',
                }}
              >
                <canvas
                  ref={canvasReversoRef}
                  className="nt-estudio__tarjeta"
                  aria-label={`Reverso: Tarjeta ${indice + 1} de ${total}`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Capa de trazado del puntero láser temporal */}
        <canvas
          ref={laserCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 30,
          }}
          aria-hidden="true"
        />

        {/* Widget del Temporizador visible */}
        {verTemporizador && (
          <aside
            className="nt-estudio__temporizador"
            style={{
              position: 'absolute',
              top: '16px',
              right: '24px',
              background: 'rgba(15, 23, 42, 0.92)',
              color: '#f8fafc',
              backdropFilter: 'blur(10px)',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
              zIndex: 45,
              display: 'grid',
              gap: '8px',
              minWidth: '220px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            aria-label="Temporizador de presentación"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', gap: '4px', background: '#334155', padding: '2px', borderRadius: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setModoTemp('cronometro'); setTempCorriendo(false); setSegundosTemp(0); }}
                  style={{
                    background: modoTemp === 'cronometro' ? '#2563eb' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Cronómetro
                </button>
                <button
                  type="button"
                  onClick={() => { setModoTemp('cuenta-regresiva'); setTempCorriendo(false); setSegundosTemp(tiempoObjetivo); }}
                  style={{
                    background: modoTemp === 'cuenta-regresiva' ? '#2563eb' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Regresiva
                </button>
              </div>
              <button
                type="button"
                onClick={() => setVerTemporizador(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                title="Ocultar temporizador"
              >
                Cerrar
              </button>
            </div>

            {modoTemp === 'cuenta-regresiva' && (
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                {[60, 120, 180, 300].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => fijarPresetRegresiva(s)}
                    style={{
                      background: tiempoObjetivo === s ? '#1d4ed8' : '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    {s / 60}m
                  </button>
                ))}
              </div>
            )}

            <div
              style={{
                fontSize: '32px',
                fontWeight: 700,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                color: modoTemp === 'cuenta-regresiva' && segundosTemp === 0 ? '#f87171' : '#f1f5f9',
                letterSpacing: '1px',
                margin: '2px 0',
              }}
            >
              {formatearTiempo(segundosTemp)}
            </div>

            {modoTemp === 'cuenta-regresiva' && segundosTemp === 0 && (
              <div style={{ fontSize: '11px', color: '#fca5a5', textAlign: 'center', fontWeight: 600 }}>
                ¡Tiempo concluido!
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={iniciarPausarTemp}
                style={{
                  background: tempCorriendo ? '#eab308' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                {tempCorriendo ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                type="button"
                onClick={reiniciarTemp}
                style={{
                  background: '#475569',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                title="Reiniciar a cero o al tiempo establecido"
              >
                Reiniciar
              </button>
            </div>
          </aside>
        )}

        {/* Panel de notas del orador en modo estudio */}
        {verNotas && (
          <aside
            className="nt-estudio__notas"
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(720px, calc(100% - 48px))',
              maxHeight: '35vh',
              overflowY: 'auto',
              background: 'rgba(15, 23, 42, 0.88)',
              color: '#f8fafc',
              backdropFilter: 'blur(10px)',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
              zIndex: 40,
            }}
            aria-label="Notas del orador"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd' }}>
                Notas del orador
              </strong>
              <button
                type="button"
                onClick={() => setVerNotas(false)}
                style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '14px' }}
                title="Ocultar notas (N)"
              >
                Cerrar
              </button>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
              {tarjeta.notasOrador?.trim() ? tarjeta.notasOrador : <em style={{ color: '#94a3b8' }}>Esta tarjeta no tiene notas del orador asignadas.</em>}
            </div>
          </aside>
        )}
      </div>

      <button
        type="button"
        className="nt-estudio__flecha nt-estudio__flecha--izq"
        disabled={indice <= 0 && pasoActual <= 1}
        onClick={retrocederPasoOTarjeta}
        aria-label="Tarjeta o paso anterior"
      >
        ←
      </button>
      <button
        type="button"
        className="nt-estudio__flecha nt-estudio__flecha--der"
        disabled={indice >= total - 1 && pasoActual >= maxPaso}
        onClick={avanzarPasoOTarjeta}
        aria-label="Tarjeta o paso siguiente"
      >
        Siguiente
      </button>

      {/* Barra de calificación de Repetición Espaciada (SM-2) */}
      <footer
        className="nt-estudio__srs-dock"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          zIndex: 35,
          maxWidth: 'calc(100% - 32px)',
          pointerEvents: 'auto',
        }}
      >
        {/* Aviso flotante de guardado */}
        {avisoRepaso && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#93c5fd',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid rgba(147, 197, 253, 0.3)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
            }}
          >
            {avisoRepaso}
          </div>
        )}

        {/* Los 4 botones de calificación: Otra vez, Difícil, Bien, Fácil */}
        <div
          role="group"
          aria-label="Calificar tarjeta para repetición espaciada"
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            padding: '6px 10px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Otra vez (1) */}
          <button
            type="button"
            className="nt-btn nt-btn--srs"
            onClick={() => calificarTarjeta(CALIFICACIONES.OTRA_VEZ)}
            title="No la recordé. Reiniciar aprendizaje (Tecla 1)"
            aria-label="Calificar: Otra vez. Próximo repaso en 1 día"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 14px',
              minWidth: '78px',
              background: '#450a0a',
              borderColor: '#ef4444',
              color: '#fca5a5',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f87171' }}>
              Otra vez
            </span>
            <span style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px', color: '#fecaca' }}>
              {predicciones['otra-vez']?.etiqueta || '< 1 d'} · [1]
            </span>
          </button>

          {/* Difícil (2) */}
          <button
            type="button"
            className="nt-btn nt-btn--srs"
            onClick={() => calificarTarjeta(CALIFICACIONES.DIFICIL)}
            title="Recordada con gran esfuerzo (Tecla 2)"
            aria-label="Calificar: Difícil"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 14px',
              minWidth: '78px',
              background: '#451a03',
              borderColor: '#f59e0b',
              color: '#fde68a',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>
              Difícil
            </span>
            <span style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px', color: '#fef3c7' }}>
              {predicciones['dificil']?.etiqueta || '1 d'} · [2]
            </span>
          </button>

          {/* Bien (3) */}
          <button
            type="button"
            className="nt-btn nt-btn--srs"
            onClick={() => calificarTarjeta(CALIFICACIONES.BIEN)}
            title="Recordada correctamente con esfuerzo normal (Tecla 3)"
            aria-label="Calificar: Bien"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 14px',
              minWidth: '78px',
              background: '#172554',
              borderColor: '#3b82f6',
              color: '#bfdbfe',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa' }}>
              Bien
            </span>
            <span style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px', color: '#dbeafe' }}>
              {predicciones['bien']?.etiqueta || '1 d'} · [3]
            </span>
          </button>

          {/* Fácil (4) */}
          <button
            type="button"
            className="nt-btn nt-btn--srs"
            onClick={() => calificarTarjeta(CALIFICACIONES.FACIL)}
            title="Recordada de inmediato y con seguridad (Tecla 4)"
            aria-label="Calificar: Fácil"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 14px',
              minWidth: '78px',
              background: '#064e3b',
              borderColor: '#10b981',
              color: '#a7f3d0',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399' }}>
              Fácil
            </span>
            <span style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px', color: '#d1fae5' }}>
              {predicciones['facil']?.etiqueta || '4 d'} · [4]
            </span>
          </button>
        </div>
      </footer>

      {/* Modal de Sesión de Repaso Completada */}
      {mostrarResumenSesion && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-resumen-srs"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10, 15, 30, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'grid',
              gap: '18px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <span />
              <h2 id="titulo-resumen-srs" style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#e2e8f0' }}>
                ¡Sesión de repaso completada!
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#94a3b8' }}>
                Has completado la revisión de las tarjetas programadas para este mazo.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                background: '#1e293b',
                padding: '14px',
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#38bdf8' }}>
                  {sesionRepasos.length}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Repasadas hoy
                </div>
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#f59e0b' }}>
                  {statsFinales?.rachaDias ?? (sesionRepasos.length > 0 ? 1 : 0)}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Días de racha
                </div>
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#34d399' }}>
                  {statsFinales?.porcentajeAciertos ?? 100}%
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Aciertos
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="nt-btn"
                onClick={() => { setMostrarResumenSesion(false); setIndice(0); }}
                style={{ padding: '8px 16px' }}
              >
                Volver a repasar
              </button>
              <button
                type="button"
                className="nt-btn nt-btn--primario"
                onClick={salir}
                style={{ padding: '8px 18px', fontWeight: 600 }}
              >
                Finalizar y salir
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
