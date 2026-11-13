import { crearElemento, nuevoId, TIPOS_ELEMENTO } from '../almacen/modelo.js';
import { guardarBlob } from '../almacen/blobs.js';
import { camaraInicial, encuadrar, mover, pantallaAMundo, visibleEnMundo, zoomEn } from './camara.js';
import { dibujar, recorteImagenSeguro } from './dibujo.js';
import { invertir } from './historial.js';
import {
  CURSOR_MANIJA, FORMAS, alinearElementos, borrarZona, cajaDeTrazo, calcularSnapGuias,
  distribuirElementos, elementoTocadoPorLazo, esLinea, esRedimensionable, escalarElemento,
  escalarSimbolo, escalarTrazo, extremosLinea, lineaDesdeExtremos, manijaEn, manijas,
  normalizarRect, puntoEnElemento, puntoEnTrazo, rectsSeCruzan, redimensionar, simplificar,
  trasladar, unirRects,
} from './geometria.js';
import { Minimapa } from './minimapa.js';
import { alinearPunto, destelloVigente, guiaActiva, normalizarRenglones, opacidadRenglones } from './renglones.js';
import { EditorTexto } from '../herramientas/texto/editor.js';
import { baseDelPrimerRenglon, invalidarMetricas, layoutDe } from '../herramientas/texto/pintar.js';
import { bloquesDe, datosTextoNuevo, esVacio, modeloATexto, textoAModelo } from '../herramientas/texto/modelo.js';
import { htmlAModelo, modeloAHtml } from '../herramientas/texto/html.js';
import { COLOR_TEXTO } from '../herramientas/texto/estilo.js';
import { procesarImagen } from '../herramientas/imagenes/procesar.js';
import { liberarImagenesCanvas, prepararImagenes } from '../herramientas/imagenes/recursos.js';
import { guardarEnPortapapeles, hayContenidoEnPortapapeles, obtenerDePortapapeles, prepararElementosParaPegar, TIPO_MIME_ELEMENTOS } from './portapapeles.js';
import {
  actualizarConectoresDeElementos, buscarPuertoCercano, calcularPuertosElemento, desanclarConectoresDeIdsBorrados,
} from './conectores.js';
import { ramificarNodoMapaConceptual } from '../herramientas/mapaConceptual.js';
import {
  TIPOS_INSTRUMENTO,
  crearRegla,
  crearEscuadra,
  crearTransportador,
  aplicarSnapInstrumento,
  mundoALocal,
} from '../herramientas/precision/instrumentos.js';
import { reconocerForma, construirLineaRecta } from '../herramientas/precision/reconocimientoFormas.js';

const PALETA = ['#cfdcff', '#ffe9a8', '#c9f0d8', '#ffd3dc', '#e3d6ff', '#d4eef7'];
const BORDES = ['#2350d8', '#b8860b', '#1f7a45', '#c2315a', '#6a3fc2', '#1b7a99'];

export const AJUSTES_INICIALES = {
  lapiz: { color: '#14192b', grosor: 3, opacidad: 1 },
  resaltador: { color: '#ffd84d', grosor: 18, opacidad: 0.4 },
  borrador: { modo: 'trazo', tamano: 28 }, // modo: 'trazo' (trazo completo) | 'zona'
  // Grosores y tamaños están en unidades del mundo: lo que se crea sale igual con cualquier zoom (al acercar se ve más grande).
  texto: { tamano: 20 },
  figura: { borde: '#2350d8', relleno: null, grosor: 3 }, // estilo de las figuras nuevas
  vista: { minimapa: true },
};
const HERRAMIENTAS_DE_MANO = ['lapiz', 'resaltador', 'borrador'];

// Motor del lienzo: cámara, selección, gestos (mouse, dedo, pellizco) e historial.
// No conoce React: la interfaz lo maneja con sus métodos y escucha `alCambiar` / `alCamara`.
export class Lienzo {
  constructor(canvas, { escena, camara, documentoId = '', ajustes, alCambiar, alCamara, alAjustes, alImagenError, capaTexto, escritura = 'ambos', renglones, alRenglones, contenedor = null, marco = null, anchoTextoNuevo = null }) {
    this.canvas = canvas;
    this.documentoId = documentoId;
    this.contenedor = contenedor;
    this.anchoTextoNuevo = anchoTextoNuevo;
    this.marco = marco; // marco delimitador del documento (por ejemplo, tarjetas o páginas)
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); // desynchronized: menor latencia donde el navegador lo permite
    this.escena = escena;
    this.camara = camara || camaraInicial();
    this.alCambiar = alCambiar || (() => {});
    this.alCamara = alCamara || (() => {});
    this.alAjustes = alAjustes || (() => {});
    this.alImagenError = alImagenError || (() => {});
    this.ajustes = {
      lapiz: { ...AJUSTES_INICIALES.lapiz, ...ajustes?.lapiz },
      resaltador: { ...AJUSTES_INICIALES.resaltador, ...ajustes?.resaltador },
      borrador: { ...AJUSTES_INICIALES.borrador, ...ajustes?.borrador },
      texto: { ...AJUSTES_INICIALES.texto, ...ajustes?.texto },
      figura: { ...AJUSTES_INICIALES.figura, ...ajustes?.figura },
      vista: { ...AJUSTES_INICIALES.vista, ...ajustes?.vista },
    };
    this.minimapa = null;
    this.msDibujo = 0;
    this.renglones = normalizarRenglones(renglones); // guía de fondo del documento (Etapa 8)
    this.alRenglones = alRenglones || (() => {});
    this._destello = null; // aparición temporal de los renglones: { inicio, duracion }
    this.escritura = escritura; // ambos | mano | teclado: qué herramientas ofrece el documento
    this.capaTexto = capaTexto || canvas.parentElement;
    this.editor = null; // editor de texto activo (Etapa 6)
    this.texto = null; // { id, base, original, nuevo } de la sesión de edición
    this.ocultoId = null;
    this._ultimoToque = null;
    this._ultimoToqueVacio = null;
    this.cursorTexto = null;
    this.herramienta = 'seleccionar'; // seleccionar | mano | lapiz | resaltador | borrador | rectangulo | elipse
    this.dedoDibuja = true; // pasa a false al detectar un lápiz: entonces el dedo mueve el lienzo
    this.hayLapiz = false;
    this._dedoManual = false;
    this.ignorados = new Set(); // punteros descartados (palma)
    this.cursor = null;
    this._cache = null;
    this.seleccion = new Set();
    this.fijarProporcion = false;
    this.imanActivo = false;
    this.guiasActivas = [];
    this.resaltadosBusqueda = [];
    this.coincidenciaActiva = null;
    this._recorteEnCurso = null;
    this.cara = 'anverso';
    this.punteros = new Map();
    this.gesto = null;
    this.pellizco = null;
    this.espacio = false;
    this.ancho = 1; this.alto = 1; this.dpr = 1;
    this.dibujados = 0;
    this.estilos = null;
    this._ui = '';
    this._pendiente = false;
    this._contadorFigura = 0;
    this.instrumentoPrecision = null;
    this.pellizcoInstrumento = null;
    this.correccionFormasActiva = false;
    this.tiempoEsperaCorreccionMs = 380;
    this._muestrasLatenciaSinSnap = [];
    this._muestrasLatenciaConSnap = [];

    this._eventos = [
      [canvas, 'pointerdown', (e) => this._abajo(e)],
      [canvas, 'pointermove', (e) => this._mover(e)],
      [canvas, 'pointerup', (e) => this._arriba(e)],
      [canvas, 'pointercancel', (e) => this._cancelado(e)],
      [canvas, 'wheel', (e) => this._rueda(e), { passive: false }],
      [canvas, 'dragover', (e) => this._arrastrarArchivo(e)],
      [canvas, 'drop', (e) => this._soltarArchivo(e)],
      [canvas, 'pointerleave', () => { this.cursor = null; this.pedirDibujo(); }],
      [canvas, 'contextmenu', (e) => e.preventDefault()],
      [canvas, 'touchstart', (e) => e.preventDefault(), { passive: false }], // bloquea desplazamiento y zoom de la página
      [canvas, 'touchmove', (e) => e.preventDefault(), { passive: false }],
      [canvas, 'gesturestart', (e) => e.preventDefault()], // Safari: evita el zoom de la página
      [canvas, 'gesturechange', (e) => e.preventDefault()],
      [window, 'keydown', (e) => this._tecla(e)],
      [window, 'keyup', (e) => this._teclaArriba(e)],
      [window, 'blur', () => { this.espacio = false; this._cursor(); }],
      [window, 'pagehide', () => { this.finalizarGestoEnCurso(); this.puntoDeControlTexto(); }],
      [typeof document !== 'undefined' ? document : window, 'visibilitychange', () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.finalizarGestoEnCurso();
          this.puntoDeControlTexto();
        }
      }],
      [window, 'paste', (e) => this._pegar(e)],
      [window, 'copy', (e) => this._copiar(e)],
      [window, 'cut', (e) => this._cortar(e)],
    ];
    this._eventos.forEach(([o, t, f, op]) => o.addEventListener(t, f, op));
    this._desuscribir = escena.suscribir(() => { this._limpiarSeleccion(); this.pedirDibujo(); this._notificar(); });
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.redimensionarCanvas());
      this._ro.observe(canvas.parentElement || canvas);
    }
    this.redimensionarCanvas();
    this.cursorTexto = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    this._cursor();
    this._fuentes = () => { invalidarMetricas(); this.refrescarTextos(); this.pedirDibujo(); };
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.addEventListener?.('loadingdone', this._fuentes);
      document.fonts.ready?.then(() => { if (!this._destruido) this._fuentes(); });
    }
  }

  destruir() {
    this.finalizarGestoEnCurso();
    this.cerrarTexto();
    if (typeof document !== 'undefined') document.fonts?.removeEventListener?.('loadingdone', this._fuentes);
    this._quitarVisualViewport();
    this.minimapa?.destruir();
    this._eventos.forEach(([o, t, f, op]) => o.removeEventListener(t, f, op));
    liberarImagenesCanvas(this.canvas);
    this._desuscribir();
    this._ro?.disconnect();
    this._destruido = true;
  }

  // ---------- tamaño y dibujo ----------
  redimensionarCanvas() {
    const r = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.ancho = Math.max(1, Math.floor(r.width));
    this.alto = Math.max(1, Math.floor(r.height));
    this.canvas.width = Math.floor(this.ancho * this.dpr);
    this.canvas.height = Math.floor(this.alto * this.dpr);
    this.pedirDibujo();
  }

  pedirDibujo() {
    if (this._pendiente || this._destruido) return;
    this._pendiente = true;
    requestAnimationFrame(() => this._dibujar());
  }

  setContenedor(c) { this.contenedor = c; }
  setCara(c) { this.cara = c === 'reverso' ? 'reverso' : 'anverso'; }
  _obtenerCara() { return this.cara === 'reverso' ? 'reverso' : 'anverso'; }
  _obtenerContenedor(y = null) {
    if (typeof this.contenedor === 'function') {
      return this.contenedor(y != null ? y : (this.camara.y + this.alto / (2 * (this.camara.zoom || 1))));
    }
    return this.contenedor;
  }
  setMarco(m) { this.marco = m; this.pedirDibujo(); }
  setProveedorFondoMarco(fn) { this.proveedorFondoMarco = fn; this.pedirDibujo(); }
  setEstilos(estilos) {
    this.estilos = estilos;
    this.refrescarTextos();
    this.pedirDibujo();
  }

  _dibujar() {
    this._pendiente = false;
    if (this._destruido) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const cajaRedim = this._cajaRedimensionable();
    const g = this.gesto;
    const activo = g && g.tipo === 'dibujar' ? { puntos: g.puntos, color: g.color, grosor: g.grosor, opacidad: g.opacidad, variable: g.variable } : null;
    const res = dibujar(this.ctx, {
      trazoActivo: activo, fondoCache: activo ? this._cache : null, dibujadosPrevio: this.dibujados,
      borrador: this.herramienta === 'borrador' && this.cursor ? { x: this.cursor.x, y: this.cursor.y, r: this.ajustes.borrador.tamano / 2 } : null,
      camara: this.camara, ancho: this.ancho, alto: this.alto, dpr: this.dpr,
      lista: this.escena.lista(), escena: this.escena, seleccion: this.seleccion, ocultoId: this.ocultoId, renglones: this._fondoRenglones(),
      guiaTexto: this.renglones,
      alImagenLista: () => this.pedirDibujo(),
      marco: g && (g.tipo === 'marco' || g.tipo === 'texto') ? normalizarRect(g.inicio.x, g.inicio.y, g.actual.x, g.actual.y) : null,
      lazo: g && g.tipo === 'lazo' ? g.puntos : null,
      mostrarManijas: cajaRedim && (this.herramienta === 'seleccionar' || this.herramienta === 'lazo') && (!g || g.tipo === 'redimensionar') ? cajaRedim : null,
      marcoDocumento: this.marco,
      alPedirFondoMarco: this.proveedorFondoMarco ? (num, zoom) => this.proveedorFondoMarco(num, zoom) : null,
      guiasSnap: this.guiasActivas,
      resaltadosBusqueda: this.resaltadosBusqueda,
      coincidenciaActiva: this.coincidenciaActiva,
      contenedor: typeof this.contenedor === 'string' ? this.contenedor : null,
      estilos: this.estilos,
      fondoDocumento: this.fondoDocumento || null,
      puertosConector: this.puertosConector || null,
      puertoConectorActivo: this.puertoConectorActivo || null,
      instrumentoPrecision: this.instrumentoPrecision || null,
    });
    if (typeof performance !== 'undefined') this.msDibujo = performance.now() - t0;
    if (this._destello) { if (destelloVigente(this._destello, this._ahora())) this.pedirDibujo(); else this._destello = null; } // sigue la animación
    if (!activo) this.minimapa?.pintar();
    if (res.dibujados !== this.dibujados) { this.dibujados = res.dibujados; this._notificar(); }
  }

  // ¿Hay algo del contenido a la vista? (para ofrecer «Volver al contenido»)
  _hayContenidoVisible() {
    if (!this.escena.mapa.size) return true;
    const v = { x: this.camara.x, y: this.camara.y, ancho: this.ancho / this.camara.zoom, alto: this.alto / this.camara.zoom };
    for (const el of this.escena.mapa.values()) if (rectsSeCruzan(el, v)) return true;
    return false;
  }

  // Estilo de las figuras para el panel: el de la figura seleccionada o, si no hay, el de las nuevas.
  _estiloFigura() {
    const sel = [...this.seleccion].map((id) => this.escena.get(id)).filter((e) => e && (e.tipo === 'figura' || e.tipo === 'icono'));
    const f = sel[0];
    const a = this.ajustes.figura;
    return {
      seleccionadas: sel.length,
      forma: f ? (f.datos?.forma || (f.tipo === 'icono' ? 'icono' : null)) : null,
      linea: f ? esLinea(f) : this.herramienta === 'linea' || this.herramienta === 'flecha',
      borde: f ? f.datos.borde || a.borde : a.borde,
      relleno: f ? f.datos.relleno || null : a.relleno,
      grosor: f ? Math.max(1, Math.min(40, Math.round(f.datos.grosor || 2))) : a.grosor,
      estiloBorde: f ? f.datos.estiloBorde || 'solido' : a.estiloBorde || 'solido',
      radioEsquinas: f ? f.datos.radioEsquinas || 0 : a.radioEsquinas || 0,
      opacidad: f && f.datos.opacidad !== undefined ? f.datos.opacidad : 1,
      sombra: f && f.datos.sombra ? f.datos.sombra : null,
      tipoConector: f ? (f.datos?.tipoConector || 'recto') : (a.tipoConector || 'recto'),
      anclado: f ? (!!f.datos?.anclajeInicio || !!f.datos?.anclajeFin) : false,
      texto: f ? (f.datos?.texto || f.datos?.etiqueta || '') : '',
      enlace: f ? (f.datos?.enlace || f.enlace || null) : null,
      elementoId: f?.id || null,
    };
  }

  _notificar() {
    this._limpiarSeleccion();
    const unico = this.seleccion.size === 1 ? this.escena.get([...this.seleccion][0]) : null;
    const ui = {
      herramienta: this.herramienta,
      zoom: Math.round(this.camara.zoom * 100),
      puedeDeshacer: this.escena.historial.puedeDeshacer() || !!this.editor || !!this.historialExtra?.puedeDeshacer(),
      puedeRehacer: this.escena.historial.puedeRehacer() || !!this.editor || !!this.historialExtra?.puedeRehacer(),
      puedePegar: hayContenidoEnPortapapeles(),
      puedeCopiar: this.seleccion.size > 0 && !this.editor,
      fijarProporcion: this.fijarProporcion,
      texto: this.editor ? this.editor.estadoActual() : null,
      seleccionados: this.seleccion.size,
      // Nota a la que está enlazado el elemento seleccionado (solo con un elemento seleccionado)
      enlaceSeleccion: unico ? (unico.datos?.enlace || unico.enlace || null) : null,
      textoSeleccionado: unico?.tipo === 'texto'
        ? { id: unico.id, x: unico.x, y: unico.y, ancho: unico.ancho, alto: unico.alto }
        : null,
      imagenSeleccionada: unico?.tipo === 'imagen'
        ? {
            id: unico.id,
            recorte: recorteImagenSeguro(unico.datos.recorte),
            nombre: unico.datos.nombre || 'Imagen',
            marco: unico.datos.marco || 'ninguno',
            radioEsquinas: unico.datos.radioEsquinas,
            borde: unico.datos.borde,
            grosor: unico.datos.grosor,
            estiloBorde: unico.datos.estiloBorde,
            opacidad: unico.datos.opacidad,
            sombra: unico.datos.sombra,
            mascaras: Array.isArray(unico.datos.mascaras) ? unico.datos.mascaras : [],
            enlace: unico.datos.enlace || unico.enlace || null,
            elemento: unico,
          }
        : null,
      iconoSeleccionado: unico?.tipo === 'icono'
        ? {
            id: unico.id,
            nombre: unico.datos.nombre || 'Ícono',
            color: unico.datos.color,
            borde: unico.datos.borde,
            grosor: unico.datos.grosor,
            estiloBorde: unico.datos.estiloBorde,
            opacidad: unico.datos.opacidad,
            sombra: unico.datos.sombra,
          }
        : null,
      elementos: this.escena.mapa.size,
      dibujados: this.dibujados,
      ajustes: this.ajustes,
      dedoDibuja: this.dedoDibuja,
      hayLapiz: this.hayLapiz,
      msDibujo: Math.round(this.msDibujo),
      renglones: this.renglones,
      fueraDeVista: !this._hayContenidoVisible(),
      figura: this._estiloFigura(),
      imanActivo: this.imanActivo,
      puedeAgrupar: [...this.seleccion].filter((id) => !this.escena.get(id)?.bloqueado).length >= 2,
      puedeDesagrupar: [...this.seleccion].some((id) => this.escena.get(id)?.grupoId && !this.escena.get(id)?.bloqueado),
      algunoBloqueado: [...this.seleccion].some((id) => this.escena.get(id)?.bloqueado),
      todosBloqueados: this.seleccion.size > 0 && [...this.seleccion].every((id) => this.escena.get(id)?.bloqueado),
      puedeAlinear: [...this.seleccion].filter((id) => !this.escena.get(id)?.bloqueado).length >= 2,
      puedeDistribuir: [...this.seleccion].filter((id) => !this.escena.get(id)?.bloqueado).length >= 3,
      instrumentoPrecision: this.instrumentoPrecision,
      correccionFormasActiva: this.correccionFormasActiva,
    };
    const clave = JSON.stringify(ui);
    if (clave !== this._ui) { this._ui = clave; this.alCambiar(ui); }
  }

  _limpiarSeleccion() { for (const id of this.seleccion) if (!this.escena.mapa.has(id)) this.seleccion.delete(id); }

  _camaraCambio() { this.editor?.posicionar(this.camara); this.pedirDibujo(); this._notificar(); this.alCamara(this.camara); }

  // ---------- utilidades ----------
  _pos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  _mundo(p) { return pantallaAMundo(this.camara, p.x, p.y); }

  _cursorTextoPosicion() {
    if (this.cursorTexto && Number.isFinite(this.cursorTexto.x) && Number.isFinite(this.cursorTexto.y)) return this.cursorTexto;
    return { x: this.camara.x + this.ancho / (2 * this.camara.zoom), y: this.camara.y + this.alto / (2 * this.camara.zoom) };
  }

  _textoEnOCerca(mundo, tol = 8) {
    const el = this._elementoEn(mundo, tol);
    if (el?.tipo === 'texto') return el;
    const lista = this.escena.lista();
    const margenY = Math.max(36, 48 / this.camara.zoom);
    for (let i = lista.length - 1; i >= 0; i--) {
      const t = lista[i];
      if (t.tipo !== 'texto') continue;
      const xMin = t.x - tol;
      const xMax = t.x + t.ancho + tol;
      const yMin = t.y - tol;
      const yMax = t.y + t.alto + margenY;
      if (mundo.x >= xMin && mundo.x <= xMax && mundo.y >= yMin && mundo.y <= yMax) {
        return t;
      }
    }
    return null;
  }

  // Escribir sin abrir el texto: solo vale cuando hay un único texto seleccionado (se abre y recibe la tecla).
  // Para crear un texto nuevo se hace doble clic en un lugar vacío o se usa la herramienta Texto.
  _escribirDirectoDesdeTeclado(caracter) {
    if (this.editor || this.gesto || !this.puedeHerramienta('texto')) return false;
    const unico = this._unicoTexto();
    if (!unico) return false;
    this.editarTexto(unico.id);
    this.editor?.insertarTextoDirecto(caracter);
    return true;
  }

  _crearTextoDirecto(x, y) {
    const tam = Math.max(6, Math.min(800, Math.round(this.ajustes.texto.tamano)));
    const guiado = this.renglones.activos && this.renglones.estilo !== 'liso';
    const datos = { ...datosTextoNuevo(tam), ...(guiado ? { composicion: 'guiada' } : {}) };
    const ancho = Math.max(80, Math.min(3000, Math.round((this.ancho * 0.8) / this.camara.zoom)));
    let ex = x, ey = y;
    const base = baseDelPrimerRenglon(datos, ancho, this._opcionesLayout(datos));
    if (guiado || guiaActiva(this.renglones)) {
      const cfg = guiado ? { ...this.renglones, alinear: true } : this.renglones;
      const q = alinearPunto(cfg, { x: ex, y: ey + base });
      ey = q.y - base;
      if (cfg.estilo !== 'rayado') ex = q.x;
    }
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TEXTO, {
      x: ex, y: ey, ancho, alto: layoutDe(datos, ancho, undefined, this._opcionesLayout(datos)).alto,
      z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(ey), cara: this._obtenerCara(), datos,
    });
    this._abrirEditor(el, true, undefined, true);
  }

  _cajaRedimensionable() {
    if (this.seleccion.size === 0) return null;
    const tieneBloqueado = [...this.seleccion].some((id) => this.escena.get(id)?.bloqueado);
    if (tieneBloqueado) return null;
    if (this.seleccion.size === 1) {
      const el = this.escena.get([...this.seleccion][0]);
      return el && esRedimensionable(el) ? el : null;
    }
    const elementos = [...this.seleccion].map((id) => this.escena.get(id)).filter(Boolean);
    if (!elementos.length) return null;
    const caja = unirRects(elementos);
    if (!caja) return null;
    return {
      x: caja.x,
      y: caja.y,
      ancho: caja.ancho,
      alto: caja.alto,
      tipo: 'grupo',
      esGrupo: true,
      elementos,
    };
  }

  _unicoRedimensionable() {
    return this._cajaRedimensionable();
  }

  toggleFijarProporcion() {
    this.fijarProporcion = !this.fijarProporcion;
    this._notificar();
    this.pedirDibujo();
  }

  setFijarProporcion(v) {
    this.fijarProporcion = !!v;
    this._notificar();
    this.pedirDibujo();
  }

  _elementoEn(mundo, tol) {
    const lista = this.escena.lista();
    for (let i = lista.length - 1; i >= 0; i--) if (puntoEnElemento(lista[i], mundo.x, mundo.y, tol)) return lista[i];
    return null;
  }

  _cursor(sobre) {
    let c = 'default';
    if (this.pellizco || (this.gesto && this.gesto.tipo === 'paneo')) c = 'grabbing';
    else if (this.herramienta === 'mano' || this.espacio) c = 'grab';
    else if (this.herramienta === 'borrador') c = 'none';
    else if (this.herramienta === 'texto') c = 'text';
    else if (HERRAMIENTAS_DE_MANO.includes(this.herramienta) || FORMAS.includes(this.herramienta) || this.herramienta === 'lazo') c = 'crosshair';
    else if (sobre) c = sobre;
    this.canvas.style.cursor = c;
  }

  // ---------- punteros ----------
  _abajo(e) {
    if (e.pointerType === 'mouse' && e.button === 2) return;
    if (e.pointerType === 'pen') this._detectarLapiz();
    // Rechazo de palma: mientras el lápiz escribe, los toques se descartan; y si el lápiz llega
    // con la mano ya apoyada, se descartan los toques en curso.
    if (e.pointerType === 'touch' && ((this.gesto && this.gesto.pointerType === 'pen') || e.width > 40 || e.height > 40)) { this.ignorados.add(e.pointerId); return; }
    if (e.pointerType === 'pen') {
      for (const [id, pt] of [...this.punteros]) if (pt.tipo === 'touch') { this.ignorados.add(id); this.punteros.delete(id); }
      this.pellizco = null;
      if (this.gesto && this.gesto.pointerType === 'touch') this._cancelarGesto();
    }
    this.cerrarTexto(); // tocar el lienzo termina la edición del texto
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* el puntero ya no está activo */ }
    this.canvas.focus?.({ preventScroll: true });
    const p = this._pos(e);
    if (e.pointerType !== 'pen' || !HERRAMIENTAS_DE_MANO.includes(this.herramienta)) this.cursorTexto = this._mundo(p);
    this.punteros.set(e.pointerId, { ...p, tipo: e.pointerType });
    if (this.punteros.size === 2) {
      this._cancelarGesto();
      const [a, b] = [...this.punteros.values()];
      const centroPantalla = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const centroMundo = this._mundo(centroPantalla);

      if (this.instrumentoPrecision?.activo && this._puntoCercaInstrumento(centroMundo, 60 / this.camara.zoom)) {
        this.pellizcoInstrumento = {
          centroMundo,
          distDedos: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          anguloDedos: Math.atan2(b.y - a.y, b.x - a.x),
          anguloInicialInst: this.instrumentoPrecision.angulo,
          instX: this.instrumentoPrecision.x,
          instY: this.instrumentoPrecision.y,
        };
        this.pellizco = null;
        this._cursor();
        return;
      }

      this.pellizcoInstrumento = null;
      this.pellizco = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, centro: centroPantalla };
      this._cursor();
      return;
    }
    if (this.punteros.size > 2) return;
    e.preventDefault?.();
    const mundo = this._mundo(p);

    if (this.instrumentoPrecision?.activo) {
      if (this._puntoEnCentroDial(mundo)) {
        const dx = mundo.x - this.instrumentoPrecision.x;
        const dy = mundo.y - this.instrumentoPrecision.y;
        this.gesto = {
          tipo: 'rotar_instrumento',
          pointerId: e.pointerId,
          anguloBase: this.instrumentoPrecision.angulo,
          anguloInicio: Math.atan2(dy, dx),
        };
        return;
      }
      if ((this.herramienta === 'seleccionar' || this.herramienta === 'mano') && this._puntoCercaInstrumento(mundo, 8 / this.camara.zoom)) {
        this.gesto = {
          tipo: 'mover_instrumento',
          pointerId: e.pointerId,
          inicioMundo: mundo,
          instX: this.instrumentoPrecision.x,
          instY: this.instrumentoPrecision.y,
        };
        return;
      }
    }
    const tactil = e.pointerType !== 'mouse';
    const manoLibre = HERRAMIENTAS_DE_MANO.includes(this.herramienta);
    const dedoMueve = tactil && e.pointerType === 'touch' && manoLibre && !this.dedoDibuja;
    if ((e.pointerType === 'mouse' && e.button === 1) || this.herramienta === 'mano' || this.espacio || dedoMueve) {
      this.gesto = { tipo: 'paneo', ultimo: p, pointerId: e.pointerId, pointerType: e.pointerType };
      // Con «Mover el lienzo», el doble clic (o doble toque) también escribe: en un lugar vacío crea un texto y sobre un texto lo edita
      if (this.herramienta === 'mano' && !this.espacio && !(e.pointerType === 'mouse' && e.button !== 0)) this._prepararDobleClicMano(p, mundo, tactil, this.gesto);
      this._cursor();
      return;
    }
    if (this.herramienta === 'seleccionar') this._abajoSeleccion(e, p, mundo, tactil);
    else if (this.herramienta === 'lazo') this._abajoLazo(e, p, mundo, tactil);
    else if (this.herramienta === 'borrador') this._iniciarBorrar(e, p, mundo);
    else if (this.herramienta === 'texto') this.gesto = { tipo: 'texto', pointerId: e.pointerId, pointerType: e.pointerType, inicio: mundo, actual: mundo, inicioPantalla: p };
    else if (manoLibre) this._iniciarTrazo(e, p, mundo);
    else this._iniciarCrear(this._snapPunto(mundo), p);
  }

  // Marca el gesto de paneo de la mano para que, si resulta ser un doble clic quieto, al soltar escriba (ver _arriba).
  _prepararDobleClicMano(p, mundo, tactil, gesto) {
    gesto.inicioPantalla = p;
    gesto.inicio = mundo;
    const el = this._elementoEn(mundo, (tactil ? 8 : 3) / this.camara.zoom);
    if (el) {
      this._ultimoToqueVacio = null;
      if (el.tipo === 'texto') gesto.sobreTexto = el.id;
      return;
    }
    this._ultimoToque = null;
    const u = this._ultimoToqueVacio, ahora = Date.now();
    const doble = u && ahora - u.t < 450 && Math.hypot(p.x - u.x, p.y - u.y) < 14 && this.puedeHerramienta('texto');
    this._ultimoToqueVacio = doble ? null : { t: ahora, x: p.x, y: p.y };
    gesto.dobleVacio = !!doble;
  }

  _expandirGrupo(ids) {
    const set = new Set(ids);
    for (const id of ids) {
      const el = this.escena.get(id);
      if (el?.grupoId) {
        for (const otro of this.escena.mapa.values()) {
          if (otro.grupoId === el.grupoId) set.add(otro.id);
        }
      }
    }
    return set;
  }

  _abajoSeleccion(e, p, mundo, tactil) {
    const z = this.camara.zoom;
    const caja = this._cajaRedimensionable();
    if (caja) {
      const m = manijaEn(caja, mundo.x, mundo.y, (tactil ? 22 : 9) / z);
      if (m) {
        if (caja.esGrupo) {
          const origenes = new Map(caja.elementos.map((el) => [el.id, { ...el }]));
          this.gesto = { tipo: 'redimensionar', manija: m, esGrupo: true, cajaOriginal: { x: caja.x, y: caja.y, ancho: caja.ancho, alto: caja.alto }, origenes, inicio: mundo, cambio: false };
        } else {
          this.gesto = { tipo: 'redimensionar', manija: m, esGrupo: false, original: caja, inicio: mundo, cambio: false };
        }
        return;
      }
    }
    const el = this._elementoEn(mundo, (tactil ? 8 : 3) / z);
    const esMulti = e.shiftKey || e.ctrlKey || e.metaKey;
    if (el) {
      const grupoIds = el.grupoId
        ? [...this.escena.mapa.values()].filter((x) => x.grupoId === el.grupoId).map((x) => x.id)
        : [el.id];
      if (esMulti) {
        const todosEnSel = grupoIds.every((id) => this.seleccion.has(id));
        if (todosEnSel) {
          for (const id of grupoIds) this.seleccion.delete(id);
        } else {
          for (const id of grupoIds) this.seleccion.add(id);
        }
      } else if (!this.seleccion.has(el.id)) {
        this.seleccion = new Set(grupoIds);
      }
      const tieneBloqueado = [...this.seleccion].some((id) => this.escena.get(id)?.bloqueado);
      if (this.seleccion.has(el.id) && !tieneBloqueado) {
        const origenes = new Map([...this.seleccion].map((id) => [id, this.escena.get(id)]));
        this.gesto = { tipo: 'mover', origenes, inicio: mundo, inicioPantalla: p, movido: false, sobreTexto: el.tipo === 'texto' ? el.id : null };
      }
    } else {
      if (!esMulti) this.seleccion = new Set();
      // Segundo toque seguido en un lugar vacío: al soltar se crea un texto ahí (doble clic o doble toque)
      const u = this._ultimoToqueVacio, ahora = Date.now();
      const doble = !esMulti && u && ahora - u.t < 450 && Math.hypot(p.x - u.x, p.y - u.y) < 14 && this.puedeHerramienta('texto');
      this._ultimoToqueVacio = doble ? null : { t: ahora, x: p.x, y: p.y };
      this.gesto = { tipo: 'marco', inicio: mundo, actual: mundo, base: new Set(this.seleccion), dobleVacio: !!doble, inicioPantalla: p };
    }
    this._notificar(); this.pedirDibujo();
  }

  _abajoLazo(e, p, mundo, tactil) {
    const z = this.camara.zoom;
    const caja = this._cajaRedimensionable();
    if (caja) {
      const m = manijaEn(caja, mundo.x, mundo.y, (tactil ? 22 : 9) / z);
      if (m) {
        if (caja.esGrupo) {
          const origenes = new Map(caja.elementos.map((el) => [el.id, { ...el }]));
          this.gesto = { tipo: 'redimensionar', manija: m, esGrupo: true, cajaOriginal: { x: caja.x, y: caja.y, ancho: caja.ancho, alto: caja.alto }, origenes, inicio: mundo, cambio: false };
        } else {
          this.gesto = { tipo: 'redimensionar', manija: m, esGrupo: false, original: caja, inicio: mundo, cambio: false };
        }
        return;
      }
    }
    const el = this._elementoEn(mundo, (tactil ? 8 : 3) / z);
    const esMulti = e.shiftKey || e.ctrlKey || e.metaKey;
    const tieneBloqueado = [...this.seleccion].some((id) => this.escena.get(id)?.bloqueado);
    if (el && this.seleccion.has(el.id) && !tieneBloqueado) {
      const origenes = new Map([...this.seleccion].map((id) => [id, this.escena.get(id)]));
      this.gesto = { tipo: 'mover', origenes, inicio: mundo, inicioPantalla: p, movido: false, sobreTexto: el.tipo === 'texto' ? el.id : null };
      return;
    }
    this.gesto = {
      tipo: 'lazo',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      puntos: [[mundo.x, mundo.y]],
      inicio: mundo,
      inicioPantalla: p,
      esMulti,
      base: esMulti ? new Set(this.seleccion) : new Set(),
    };
    if (!esMulti) {
      this.seleccion = new Set();
    }
    this._notificar();
    this.pedirDibujo();
  }

  _detectarLapiz() {
    if (this.hayLapiz) return;
    this.hayLapiz = true;
    if (!this._dedoManual) this.dedoDibuja = false;
    this._notificar();
  }

  _presion(e) { return e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5; }

  _crearCache() {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const cx = c.getContext('2d');
    if (!cx) return null;
    // La caché debe contener TODAS las capas de fondo que se ven normalmente; si no, desaparecen mientras se traza:
    // el PDF de fondo, el color o degradado del documento, el filtro de la tarjeta actual y los instrumentos de precisión.
    dibujar(cx, {
      camara: this.camara, ancho: this.ancho, alto: this.alto, dpr: this.dpr, lista: this.escena.lista(), escena: this.escena,
      seleccion: new Set(), marco: null, mostrarManijas: null, renglones: this._fondoRenglones(), guiaTexto: this.renglones,
      marcoDocumento: this.marco, estilos: this.estilos,
      alPedirFondoMarco: this.proveedorFondoMarco ? (num, zoom) => this.proveedorFondoMarco(num, zoom) : null,
      contenedor: typeof this.contenedor === 'string' ? this.contenedor : null,
      fondoDocumento: this.fondoDocumento || null,
      instrumentoPrecision: this.instrumentoPrecision || null,
    });
    return c;
  }

  _iniciarTrazo(e, p, mundo) {
    const h = this.herramienta, a = this.ajustes[h];
    this.seleccion = new Set();
    const grosor = a.grosor; // en unidades del mundo: igual con cualquier zoom

    let puntoInicial = { x: mundo.x, y: mundo.y };
    let snappeado = false;
    let bordeSnap = null;

    if (this.instrumentoPrecision?.activo) {
      const snap = aplicarSnapInstrumento(this.instrumentoPrecision, mundo, 28 / this.camara.zoom);
      if (snap.snappeado) {
        puntoInicial = snap.punto;
        snappeado = true;
        bordeSnap = snap.borde;
      }
    }

    const tAhora = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.gesto = {
      tipo: 'dibujar',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      herramienta: h,
      ultimo: p,
      puntos: [[puntoInicial.x, puntoInicial.y, this._presion(e)]],
      variable: e.pointerType === 'pen' && h === 'lapiz' && a.opacidad >= 1,
      grosor,
      color: a.color,
      opacidad: a.opacidad,
      snappeadoEnInstrumento: snappeado,
      bordeInstrumento: bordeSnap,
      inicioMs: tAhora,
      ultimoMovimientoMs: tAhora,
      ultimoPuntoPausado: [puntoInicial.x, puntoInicial.y],
      formaReconocida: null,
      trazoOriginal: null,
    };
    this._cache = this._crearCache();
    this._notificar();
    this.pedirDibujo();
  }

  _iniciarBorrar(e, p, mundo) {
    this.seleccion = new Set();
    this.gesto = { tipo: 'borrar', pointerId: e.pointerId, pointerType: e.pointerType, cambios: [], ultimo: mundo };
    this.cursor = p;
    this._borrarEn(mundo.x, mundo.y, this.gesto);
    this._notificar(); this.pedirDibujo();
  }

  // Borra (o recorta) los trazos que toca el círculo del borrador en (x, y).
  _borrarEn(x, y, g) {
    const a = this.ajustes.borrador, r = a.tamano / 2 / this.camara.zoom;
    const caja = { x: x - r, y: y - r, ancho: 2 * r, alto: 2 * r };
    const cambios = [];
    for (const el of this.escena.lista()) {
      if (el.tipo !== 'trazo' || !rectsSeCruzan(el, caja)) continue;
      if (a.modo === 'trazo') {
        if (puntoEnTrazo(el, x, y, r)) cambios.push({ id: el.id, antes: el, despues: null });
      } else {
        const tramos = borrarZona(el.datos.puntos, x, y, r + el.datos.grosor / 2);
        if (!tramos) continue;
        cambios.push({ id: el.id, antes: el, despues: null });
        for (const tramo of tramos) {
          if (tramo.length < 2) continue;
          const pts = simplificar(tramo, 0.2 / this.camara.zoom);
          cambios.push({ id: nuevoId(), antes: null, despues: { ...el, id: null, ...cajaDeTrazo(pts, el.datos.grosor), contenedor: this._obtenerContenedor(el.y), datos: { ...el.datos, puntos: pts } } });
        }
      }
    }
    for (const c of cambios) if (c.despues && c.despues.id === null) c.despues.id = c.id;
    if (cambios.length) { this.escena.transitorio(cambios); g.cambios.push(...cambios); }
  }

  _iniciarCrear(mundo) {
    const a = this.ajustes.figura;
    let inicio = mundo;
    let anclajeInicio = null;
    const esLin = this.herramienta === 'linea' || this.herramienta === 'flecha';

    if (esLin) {
      const puerto = buscarPuertoCercano(this.escena.lista(), mundo.x, mundo.y, 28 / this.camara.zoom);
      if (puerto) {
        inicio = { x: puerto.x, y: puerto.y };
        anclajeInicio = { elementoId: puerto.elementoId, puerto: puerto.id };
        this.puertoConectorActivo = puerto;
      }
      const todosPuertos = [];
      for (const forma of this.escena.lista()) {
        if (forma.tipo === 'figura' && !esLinea(forma)) {
          todosPuertos.push(...calcularPuertosElemento(forma));
        }
      }
      this.puertosConector = todosPuertos;
    }

    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.FIGURA, {
      x: inicio.x, y: inicio.y, ancho: 0, alto: 0, z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(inicio.y), cara: this._obtenerCara(),
      datos: {
        forma: this.herramienta,
        relleno: esLin ? null : a.relleno,
        borde: a.borde,
        grosor: Math.max(0.5, a.grosor),
        estiloBorde: a.estiloBorde || 'solido',
        radioEsquinas: a.radioEsquinas || 0,
        opacidad: a.opacidad !== undefined ? a.opacidad : 1,
        sombra: a.sombra || null,
        tipoConector: a.tipoConector || 'recto',
        anclajeInicio,
        anclajeFin: null,
      },
    });
    this.gesto = { tipo: 'crear', inicio, elemento: el, actual: null, anclajeInicio };
    this.pedirDibujo();
  }

  _mover(e) {
    if (this.ignorados.has(e.pointerId)) return;
    const p = this._pos(e);
    if (e.pointerType === 'pen') this._detectarLapiz();
    if (this.herramienta === 'borrador' && e.pointerType !== 'touch') { this.cursor = p; this.pedirDibujo(); }
    if (!this.punteros.has(e.pointerId)) { if (e.pointerType === 'mouse') this._hover(p); return; }
    this.punteros.set(e.pointerId, { ...p, tipo: e.pointerType });
    if (this.punteros.size === 2) {
      if (this.pellizcoInstrumento && this.instrumentoPrecision) {
        const [a, b] = [...this.punteros.values()];
        const centroPantalla = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const centroMundo = this._mundo(centroPantalla);
        const anguloDedos = Math.atan2(b.y - a.y, b.x - a.x);
        const deltaAngulo = anguloDedos - this.pellizcoInstrumento.anguloDedos;

        this.instrumentoPrecision.angulo = this.pellizcoInstrumento.anguloInicialInst + deltaAngulo;
        this.instrumentoPrecision.x = this.pellizcoInstrumento.instX + (centroMundo.x - this.pellizcoInstrumento.centroMundo.x);
        this.instrumentoPrecision.y = this.pellizcoInstrumento.instY + (centroMundo.y - this.pellizcoInstrumento.centroMundo.y);

        this._notificar();
        this.pedirDibujo();
        return;
      }
      if (this.pellizco) {
        const [a, b] = [...this.punteros.values()];
        const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        let c = mover(this.camara, centro.x - this.pellizco.centro.x, centro.y - this.pellizco.centro.y);
        c = zoomEn(c, centro.x, centro.y, dist / this.pellizco.dist);
        this.camara = c;
        this.pellizco = { dist, centro };
        this._camaraCambio();
        return;
      }
    }
    const g = this.gesto;
    if (!g) return;
    if (g.pointerId !== undefined && g.pointerId !== e.pointerId) return;
    const mundo = this._mundo(p);

    if (g.tipo === 'rotar_instrumento' && this.instrumentoPrecision) {
      const dx = mundo.x - this.instrumentoPrecision.x;
      const dy = mundo.y - this.instrumentoPrecision.y;
      const anguloActual = Math.atan2(dy, dx);
      this.instrumentoPrecision.angulo = g.anguloBase + (anguloActual - g.anguloInicio);
      this._notificar();
      this.pedirDibujo();
      return;
    }
    if (g.tipo === 'mover_instrumento' && this.instrumentoPrecision) {
      this.instrumentoPrecision.x = g.instX + (mundo.x - g.inicioMundo.x);
      this.instrumentoPrecision.y = g.instY + (mundo.y - g.inicioMundo.y);
      this._notificar();
      this.pedirDibujo();
      return;
    }

    if (g.tipo === 'dibujar') {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      let tiempoSnapAcumulado = 0;

      for (const ev of evs.length ? evs : [e]) {
        const pp = this._pos(ev);
        if (Math.hypot(pp.x - g.ultimo.x, pp.y - g.ultimo.y) < 1) continue;
        let m = this._mundo(pp);

        if (this.instrumentoPrecision?.activo) {
          const tSnap0 = typeof performance !== 'undefined' ? performance.now() : 0;
          const snap = aplicarSnapInstrumento(this.instrumentoPrecision, m, 28 / this.camara.zoom);
          if (snap.snappeado) {
            m = snap.punto;
            g.snappeadoEnInstrumento = true;
          }
          if (typeof performance !== 'undefined') {
            tiempoSnapAcumulado += (performance.now() - tSnap0);
          }
        }

        g.puntos.push([m.x, m.y, this._presion(ev)]);
        g.ultimo = pp;
      }

      // Línea ya enderezada: el extremo final acompaña al puntero, así queda donde se suelta
      if (g.formaReconocida?.tipo === 'linea' && g.puntos.length > 2) {
        const p1 = g.formaReconocida.puntos[0];
        const fin = g.puntos[g.puntos.length - 1];
        g.formaReconocida = construirLineaRecta(p1, fin, g.formaReconocida.confianza);
        g.puntos = g.formaReconocida.puntos;
      }

      if (typeof performance !== 'undefined') {
        const tTotal = performance.now() - t0;
        if (this.instrumentoPrecision?.activo) {
          this._muestrasLatenciaConSnap.push(tiempoSnapAcumulado);
          if (this._muestrasLatenciaConSnap.length > 80) this._muestrasLatenciaConSnap.shift();
        } else {
          this._muestrasLatenciaSinSnap.push(tTotal);
          if (this._muestrasLatenciaSinSnap.length > 80) this._muestrasLatenciaSinSnap.shift();
        }
      }

      // Corrección automática de formas («Hold-to-snap»)
      if (this.correccionFormasActiva && !g.snappeadoEnInstrumento && g.puntos.length >= 8) {
        const ult = g.puntos[g.puntos.length - 1];
        const distMov = Math.hypot(ult[0] - g.ultimoPuntoPausado[0], ult[1] - g.ultimoPuntoPausado[1]);
        const distPantalla = distMov * this.camara.zoom;

        const tAhora = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (distPantalla > 7) {
          g.ultimoMovimientoMs = tAhora;
          g.ultimoPuntoPausado = [ult[0], ult[1]];
        } else {
          const tiempoPausado = tAhora - g.ultimoMovimientoMs;
          if (tiempoPausado >= this.tiempoEsperaCorreccionMs && !g.formaReconocida) this._corregirFormaDelGesto(g);
        }
      }
      // Un mouse o un dedo quietos no generan más eventos: un temporizador completa la espera.
      clearTimeout(g.temporizadorForma);
      if (this.correccionFormasActiva && !g.formaReconocida) {
        g.temporizadorForma = setTimeout(() => this._corregirFormaDelGesto(g), this.tiempoEsperaCorreccionMs + 40);
      }

      this.pedirDibujo();
    } else if (g.tipo === 'borrar') {
      this.cursor = p;
      const paso = Math.max(this.ajustes.borrador.tamano / 4 / this.camara.zoom, 0.5);
      const n = Math.max(1, Math.ceil(Math.hypot(mundo.x - g.ultimo.x, mundo.y - g.ultimo.y) / paso));
      for (let k = 1; k <= n; k++) this._borrarEn(g.ultimo.x + ((mundo.x - g.ultimo.x) * k) / n, g.ultimo.y + ((mundo.y - g.ultimo.y) * k) / n, g);
      g.ultimo = mundo;
      this.pedirDibujo();
    } else if (g.tipo === 'paneo') {
      this.camara = mover(this.camara, p.x - g.ultimo.x, p.y - g.ultimo.y);
      g.ultimo = p;
      this._camaraCambio();
    } else if (g.tipo === 'mover') {
      if (!g.movido && Math.hypot(p.x - g.inicioPantalla.x, p.y - g.inicioPantalla.y) < 3) return;
      g.movido = true;
      let dx = mundo.x - g.inicio.x;
      let dy = mundo.y - g.inicio.y;
      this.guiasActivas = [];
      if (this.imanActivo) {
        const origenesArray = [...g.origenes.values()];
        const cajaBase = unirRects(origenesArray);
        if (cajaBase) {
          const cajaTentativa = { x: cajaBase.x + dx, y: cajaBase.y + dy, ancho: cajaBase.ancho, alto: cajaBase.alto };
          const idsMoviendo = new Set(g.origenes.keys());
          const otros = this.escena.lista().filter((el) => !idsMoviendo.has(el.id));
          const umbral = 7 / (this.camara.zoom || 1);
          const snap = calcularSnapGuias(cajaTentativa, otros, this.renglones, umbral, true);
          dx += snap.dx;
          dy += snap.dy;
          this.guiasActivas = snap.guias;
        }
      } else {
        ({ dx, dy } = this._snapMover(g.origenes, dx, dy));
      }
      const cambiosMov = [...g.origenes].map(([id, o]) => ({ id, antes: o, despues: trasladar(o, dx, dy) }));
      const cambiosConectores = actualizarConectoresDeElementos(cambiosMov.map((c) => c.despues), this.escena);
      this.escena.transitorio([...cambiosMov, ...cambiosConectores]);
      this.pedirDibujo();
    } else if (g.tipo === 'texto') {
      g.actual = mundo;
      this.pedirDibujo();
    } else if (g.tipo === 'redimensionar') {
      let dx = mundo.x - g.inicio.x, dy = mundo.y - g.inicio.y;
      const mantenerProp = e.shiftKey || this.fijarProporcion;
      if (g.esGrupo) {
        const cOrig = g.cajaOriginal;
        if (!mantenerProp) {
          const asa = manijas(cOrig).find((h) => h.n === g.manija);
          if (asa) ({ dx, dy } = this._snapDelta(asa, dx, dy));
        }
        const nuevaCaja = redimensionar(cOrig, g.manija, dx, dy, mantenerProp);
        const cambios = [];
        for (const [id, elOrig] of g.origenes) {
          let transformado = escalarElemento(elOrig, nuevaCaja, cOrig);
          if (transformado.tipo === 'texto') {
            transformado = this._ajustarTexto(transformado, elOrig);
          }
          cambios.push({ id, antes: elOrig, despues: transformado });
        }
        const cambiosConectores = actualizarConectoresDeElementos(cambios.map((c) => c.despues), this.escena);
        this.escena.transitorio([...cambios, ...cambiosConectores]);
        g.cambio = true;
      } else {
        if (!mantenerProp) {
          const asa = manijas(g.original).find((h) => h.n === g.manija);
          if (asa) ({ dx, dy } = this._snapDelta(asa, dx, dy));
        }
        const r = redimensionar(g.original, g.manija, dx, dy, mantenerProp);
        let nuevo;
        if (esLinea(g.original)) {
          const [extA, extB] = extremosLinea(g.original);
          let posFin = {
            x: (g.manija === 'p1' ? extA.x : extB.x) + dx,
            y: (g.manija === 'p1' ? extA.y : extB.y) + dy,
          };
          const puerto = buscarPuertoCercano(this.escena.lista(), posFin.x, posFin.y, 28 / this.camara.zoom, g.original.id);
          let nuevoAnclajeInicio = g.original.datos?.anclajeInicio || null;
          let nuevoAnclajeFin = g.original.datos?.anclajeFin || null;
          if (puerto) {
            posFin = { x: puerto.x, y: puerto.y };
            this.puertoConectorActivo = puerto;
            if (g.manija === 'p1') {
              nuevoAnclajeInicio = { elementoId: puerto.elementoId, puerto: puerto.id };
            } else {
              nuevoAnclajeFin = { elementoId: puerto.elementoId, puerto: puerto.id };
            }
          } else {
            this.puertoConectorActivo = null;
            if (g.manija === 'p1') nuevoAnclajeInicio = null;
            else nuevoAnclajeFin = null;
          }
          const pA = g.manija === 'p1' ? posFin : extA;
          const pB = g.manija === 'p2' ? posFin : extB;
          nuevo = lineaDesdeExtremos({
            ...g.original,
            datos: {
              ...g.original.datos,
              anclajeInicio: nuevoAnclajeInicio,
              anclajeFin: nuevoAnclajeFin,
            },
          }, pA, pB);
        } else if (g.original.tipo === 'trazo') {
          nuevo = escalarTrazo(g.original, r, g.original);
        } else if (g.original.tipo === 'simbolo') {
          nuevo = escalarSimbolo(g.original, r, g.original);
        } else if (g.original.tipo === 'texto') {
          nuevo = this._ajustarTexto({ ...g.original, ...r }, g.original);
        } else {
          nuevo = { ...g.original, ...r };
        }
        const cambiosConectores = actualizarConectoresDeElementos([nuevo], this.escena);
        this.escena.transitorio([{ id: g.original.id, antes: g.original, despues: nuevo }, ...cambiosConectores]);
        g.cambio = true;
      }
    } else if (g.tipo === 'marco') {
      g.actual = mundo;
      const r = normalizarRect(g.inicio.x, g.inicio.y, mundo.x, mundo.y);
      const sel = new Set(g.base);
      for (const el of this.escena.lista()) if (rectsSeCruzan(el, r)) sel.add(el.id);
      this.seleccion = sel;
      this._notificar(); this.pedirDibujo();
    } else if (g.tipo === 'lazo') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        const pp = this._pos(ev);
        const m = this._mundo(pp);
        const ult = g.puntos[g.puntos.length - 1];
        if (!ult || Math.hypot(m.x - ult[0], m.y - ult[1]) >= 2 / this.camara.zoom) {
          g.puntos.push([m.x, m.y]);
        }
      }
      this.pedirDibujo();
    } else if (g.tipo === 'crear') {
      let fin = mundo;
      if (e.shiftKey) {
        // Mayús: líneas en múltiplos de 45°; las demás figuras, con lados iguales
        const dx = mundo.x - g.inicio.x, dy = mundo.y - g.inicio.y;
        if (esLinea(g.elemento)) {
          const paso = Math.PI / 4, ang = Math.round(Math.atan2(dy, dx) / paso) * paso, len = Math.hypot(dx, dy);
          fin = { x: g.inicio.x + len * Math.cos(ang), y: g.inicio.y + len * Math.sin(ang) };
        } else { const l = Math.max(Math.abs(dx), Math.abs(dy)); fin = { x: g.inicio.x + Math.sign(dx || 1) * l, y: g.inicio.y + Math.sign(dy || 1) * l }; }
      }
      let anclajeFin = null;
      if (esLinea(g.elemento)) {
        const puerto = buscarPuertoCercano(this.escena.lista(), fin.x, fin.y, 28 / this.camara.zoom, g.elemento.id);
        if (puerto) {
          fin = { x: puerto.x, y: puerto.y };
          anclajeFin = { elementoId: puerto.elementoId, puerto: puerto.id };
          this.puertoConectorActivo = puerto;
        } else {
          this.puertoConectorActivo = null;
          if (!e.shiftKey) fin = this._snapPunto(fin);
        }
      } else if (!e.shiftKey) {
        fin = this._snapPunto(fin);
      }
      let elConAnclajes = g.elemento;
      if (esLinea(g.elemento)) {
        elConAnclajes = {
          ...g.elemento,
          datos: {
            ...g.elemento.datos,
            anclajeInicio: g.anclajeInicio || null,
            anclajeFin,
          },
        };
      }
      const nuevo = esLinea(elConAnclajes)
        ? lineaDesdeExtremos(elConAnclajes, g.inicio, fin)
        : { ...elConAnclajes, ...normalizarRect(g.inicio.x, g.inicio.y, fin.x, fin.y) };
      this.escena.transitorio([{ id: nuevo.id, antes: g.actual, despues: nuevo }]);
      g.actual = nuevo;
    }
  }

  _enlaceEnPunto(el, mundo) {
    if (!el || el.tipo !== 'texto' || !el.datos) return null;
    const l = layoutDe(el.datos, el.ancho, undefined, this._opcionesLayout(el.datos));
    if (!l.enlaces || !l.enlaces.length) return null;
    const lx = mundo.x - el.x;
    const ly = mundo.y - el.y;
    for (const item of l.enlaces) {
      const c = item.caja;
      if (lx >= c.x && lx <= c.x + c.ancho && ly >= c.y && ly <= c.y + c.alto) {
        return item.enlace;
      }
    }
    return null;
  }

  abrirEnlace(enlace) {
    if (!enlace) return;
    if (enlace.tipo === 'web' && enlace.url) {
      try {
        window.open(enlace.url, '_blank', 'noopener,noreferrer');
      } catch {}
    } else if (enlace.tipo === 'nota' && enlace.notaId) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nt:abrir-nota', { detail: enlace }));
      }
    }
  }

  _hover(p) {
    if ((this.herramienta !== 'seleccionar' && this.herramienta !== 'lazo') || this.espacio) { this._cursor(); return; }
    const m = this._mundo(p), z = this.camara.zoom;
    const caja = this._cajaRedimensionable();
    const h = caja && manijaEn(caja, m.x, m.y, 9 / z);
    if (h) { this._cursor(CURSOR_MANIJA[h]); return; }
    const el = this._elementoEn(m, 3 / z);
    if (el && el.tipo === 'texto' && this._enlaceEnPunto(el, m)) {
      this._cursor('pointer');
      return;
    }
    this._cursor(el ? 'move' : null);
  }

  _arriba(e) {
    if (this.ignorados.delete(e.pointerId)) return;
    this.punteros.delete(e.pointerId);
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
    if (this.pellizcoInstrumento) { if (this.punteros.size < 2) { this.pellizcoInstrumento = null; this._cursor(); } }
    if (this.pellizco) { if (this.punteros.size < 2) { this.pellizco = null; this._cursor(); } return; }
    const g = this.gesto;
    if (g && g.pointerId !== undefined && g.pointerId !== e.pointerId) return;
    this.gesto = null;
    if (!g) return;
    if (e.pointerType === 'touch') this.cursor = null;
    if (g.tipo === 'rotar_instrumento' || g.tipo === 'mover_instrumento') {
      this._notificar();
      this.pedirDibujo();
      return;
    }
    if (g.tipo === 'dibujar') {
      this._cache = null;
      if (g.formaReconocida) {
        const fr = g.formaReconocida;
        const df = fr.datosFigura;
        let el;
        if (df && (df.forma === 'rectangulo' || df.forma === 'elipse' || df.forma === 'triangulo' || df.forma === 'linea')) {
          el = crearElemento(this.documentoId, TIPOS_ELEMENTO.FIGURA, {
            x: df.x,
            y: df.y,
            ancho: df.ancho,
            alto: df.alto,
            z: this.escena.zMax() + 1,
            contenedor: this._obtenerContenedor(df.y),
            cara: this._obtenerCara(),
            datos: {
              forma: df.forma,
              ...(df.forma === 'linea' ? { volteoX: !!df.volteoX, volteoY: !!df.volteoY } : {}),
              relleno: null,
              borde: g.color,
              grosor: g.grosor,
              estiloBorde: 'solido',
              radioEsquinas: 0,
              opacidad: g.opacidad,
              trazoOriginal: g.trazoOriginal,
            },
          });
        } else {
          const pts = fr.puntos || g.puntos;
          el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, {
            ...cajaDeTrazo(pts, g.grosor),
            z: this.escena.zMax() + 1,
            contenedor: this._obtenerContenedor(pts[0] ? pts[0][1] : this.camara.y),
            cara: this._obtenerCara(),
            datos: {
              puntos: pts,
              color: g.color,
              grosor: g.grosor,
              opacidad: g.opacidad,
              herramienta: g.herramienta,
              variable: g.variable,
              trazoOriginal: g.trazoOriginal,
            },
          });
        }
        this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'dibujar');
      } else {
        const pts = simplificar(g.puntos, 0.25 / this.camara.zoom);
        const ultimo = pts[pts.length - 1];
        if (ultimo) this.cursorTexto = { x: ultimo[0], y: ultimo[1] };
        const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, {
          ...cajaDeTrazo(pts, g.grosor), z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(pts[0] ? pts[0][1] : this.camara.y), cara: this._obtenerCara(),
          datos: { puntos: pts, color: g.color, grosor: g.grosor, opacidad: g.opacidad, herramienta: g.herramienta, variable: g.variable },
        });
        this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'dibujar');
      }
    } else if (g.tipo === 'borrar') {
      this.escena.registrar(g.cambios, 'borrar');
    } else if (g.tipo === 'texto') {
      this._soltarTexto(g, e);
    } else if (g.tipo === 'paneo' && g.inicioPantalla) {
      this._soltarPaneoMano(g, e);
    } else if (g.tipo === 'marco' && g.dobleVacio && Math.hypot(this._pos(e).x - g.inicioPantalla.x, this._pos(e).y - g.inicioPantalla.y) < 6) {
      // el texto nuevo nace con su primer renglón donde se hizo doble clic (y guiado por los renglones, si están activos)
      this._crearTextoDirecto(g.inicio.x, g.inicio.y - Math.round(this.ajustes.texto.tamano) * 0.7);
    } else if (g.tipo === 'mover' && !g.movido && g.sobreTexto) {
      const el = this.escena.get(g.sobreTexto);
      const enlace = this._enlaceEnPunto(el, g.inicio);
      if (enlace && (e.ctrlKey || e.metaKey || this.herramienta === 'mano')) {
        this.abrirEnlace(enlace);
      } else {
        this._toqueSobreTexto(g.sobreTexto, e);
      }
    } else if (g.tipo === 'mover' && !g.movido) {
      const idPrimerSel = [...g.origenes.keys()][0];
      const el = idPrimerSel ? this.escena.get(idPrimerSel) : null;
      const enlace = el?.enlace || el?.datos?.enlace;
      if (enlace && (this.herramienta === 'mano' || e.ctrlKey || e.metaKey)) {
        this.abrirEnlace(enlace);
      }
    } else if (g.tipo === 'mover' && g.movido) {
      const cambiosMov = [...g.origenes].map(([id, o]) => ({ id, antes: o, despues: this.escena.get(id) }));
      const cambiosConectores = actualizarConectoresDeElementos(cambiosMov.map((c) => c.despues), this.escena);
      this.escena.registrar([...cambiosMov, ...cambiosConectores], 'mover');
    } else if (g.tipo === 'redimensionar' && g.cambio) {
      if (g.esGrupo) {
        const cambios = [...g.origenes.keys()].map((id) => ({ id, antes: g.origenes.get(id), despues: this.escena.get(id) }));
        const cambiosConectores = actualizarConectoresDeElementos(cambios.map((c) => c.despues), this.escena);
        this.escena.registrar([...cambios, ...cambiosConectores], 'redimensionar');
      } else {
        const desp = this.escena.get(g.original.id);
        const cambiosConectores = actualizarConectoresDeElementos([desp], this.escena);
        this.escena.registrar([{ id: g.original.id, antes: g.original, despues: desp }, ...cambiosConectores], 'redimensionar');
      }
    } else if (g.tipo === 'lazo') {
      const cajaL = cajaDeTrazo(g.puntos, 0);
      const recorridoLargo = g.puntos.length >= 4 && (cajaL.ancho >= 8 || cajaL.alto >= 8);
      if (!recorridoLargo) {
        const el = this._elementoEn(g.inicio, (e.pointerType !== 'mouse' ? 8 : 3) / this.camara.zoom);
        if (el) {
          if (g.esMulti) {
            if (this.seleccion.has(el.id)) this.seleccion.delete(el.id);
            else this.seleccion.add(el.id);
          } else {
            this.seleccion = new Set([el.id]);
          }
        } else if (!g.esMulti) {
          this.seleccion = new Set();
        }
      } else {
        const pts = simplificar(g.puntos, 0.8 / this.camara.zoom);
        const sel = new Set(g.base);
        for (const el of this.escena.lista()) {
          if (elementoTocadoPorLazo(el, pts)) sel.add(el.id);
        }
        this.seleccion = sel;
      }
    } else if (g.tipo === 'crear' && g.actual) {
      const el = g.actual;
      if (el.ancho * this.camara.zoom < 4 && el.alto * this.camara.zoom < 4) {
        this.escena.transitorio([{ id: el.id, antes: el, despues: null }]);
      } else {
        this.escena.registrar([{ id: el.id, antes: null, despues: el }], 'crear');
        this.seleccion = new Set([el.id]);
        this.herramienta = 'seleccionar';
      }
    }
    this.puertosConector = null;
    this.puertoConectorActivo = null;
    this.guiasActivas = [];
    this.seleccion = this._expandirGrupo(this.seleccion);
    this._cursor(); this._notificar(); this.pedirDibujo();
  }

  _cancelado(e) {
    if (this.ignorados.delete(e.pointerId)) return; // un toque de palma cancelado no debe cortar el trazo del lápiz
    this.punteros.delete(e.pointerId);
    if (this.punteros.size < 2) this.pellizco = null;
    this._cancelarGesto();
    this._cursor(); this._notificar(); this.pedirDibujo();
  }

  // Deshace sin dejar rastro lo que un gesto interrumpido había aplicado a modo de vista previa.
  _cancelarGesto() {
    const g = this.gesto;
    this.gesto = null;
    this.puertosConector = null;
    this.puertoConectorActivo = null;
    this.guiasActivas = [];
    if (!g) return;
    this._cache = null;
    if (g.tipo === 'borrar' && g.cambios.length) this.escena.transitorio(invertir(g.cambios));
    else if (g.tipo === 'mover' && g.movido) this.escena.transitorio([...g.origenes].map(([id, o]) => ({ id, antes: this.escena.get(id), despues: o })));
    else if (g.tipo === 'redimensionar' && g.cambio) {
      if (g.esGrupo) this.escena.transitorio([...g.origenes].map(([id, o]) => ({ id, antes: this.escena.get(id), despues: o })));
      else this.escena.transitorio([{ id: g.original.id, antes: this.escena.get(g.original.id), despues: g.original }]);
    }
    else if (g.tipo === 'crear' && g.actual) this.escena.transitorio([{ id: g.actual.id, antes: g.actual, despues: null }]);
    this.pedirDibujo();
  }

  // Guarda de inmediato cualquier trazo o modificación en curso si se va a cerrar o cambiar de pestaña.
  finalizarGestoEnCurso() {
    const g = this.gesto;
    if (!g) return;
    this.gesto = null;
    if (g.tipo === 'dibujar' && g.puntos?.length) {
      this._cache = null;
      const pts = simplificar(g.puntos, 0.25 / this.camara.zoom);
      const ultimo = pts[pts.length - 1];
      if (ultimo) this.cursorTexto = { x: ultimo[0], y: ultimo[1] };
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, {
        ...cajaDeTrazo(pts, g.grosor), z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(pts[0] ? pts[0][1] : this.camara.y), cara: this._obtenerCara(),
        datos: { puntos: pts, color: g.color, grosor: g.grosor, opacidad: g.opacidad, herramienta: g.herramienta, variable: g.variable },
      });
      this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'dibujar');
    } else if (g.tipo === 'borrar') {
      if (g.cambios?.length) this.escena.registrar(g.cambios, 'borrar');
    } else if (g.tipo === 'mover' && g.movido) {
      this.escena.registrar([...g.origenes].map(([id, o]) => ({ id, antes: o, despues: this.escena.get(id) })), 'mover');
    } else if (g.tipo === 'redimensionar' && g.cambio) {
      if (g.esGrupo) {
        const cambios = [...g.origenes.keys()].map((id) => ({ id, antes: g.origenes.get(id), despues: this.escena.get(id) }));
        this.escena.registrar(cambios, 'redimensionar');
      } else {
        this.escena.registrar([{ id: g.original.id, antes: g.original, despues: this.escena.get(g.original.id) }], 'redimensionar');
      }
    } else if (g.tipo === 'crear' && g.actual) {
      const el = g.actual;
      if (el.ancho * this.camara.zoom >= 4 || el.alto * this.camara.zoom >= 4) {
        this.escena.registrar([{ id: el.id, antes: null, despues: el }], 'crear');
      }
    }
    this.pedirDibujo();
  }

  _rueda(e) {
    e.preventDefault();
    if (this.gesto && (this.gesto.tipo === 'dibujar' || this.gesto.tipo === 'borrar')) return;
    const p = this._pos(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    this.camara = zoomEn(this.camara, p.x, p.y, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)));
    this._camaraCambio();
  }

  // ---------- teclado ----------
  _tecla(e) {
    const t = e.target;
    if (this._enCampo(t)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();
    if (!ctrl && !e.altKey && !e.isComposing && e.key?.length === 1 && e.key !== ' ' && this.puedeHerramienta('texto') && t?.tagName !== 'BUTTON') {
      if (this._escribirDirectoDesdeTeclado(e.key)) { e.preventDefault(); return; }
    }
    if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) this.rehacer(); else this.deshacer(); }
    else if (ctrl && k === 'y') { e.preventDefault(); this.rehacer(); }
    else if (ctrl && k === 'g') { e.preventDefault(); if (e.shiftKey) this.desagruparSeleccion(); else this.agruparSeleccion(); }
    else if (ctrl && k === 'l') { e.preventDefault(); this.alternarBloqueoSeleccion(); }
    else if (ctrl && k === 'a') { e.preventDefault(); this.seleccionarTodo(); }
    else if (ctrl && k === 'c' && this.seleccion.size > 0 && !this.editor) { this.copiar(); }
    else if (ctrl && k === 'x' && this.seleccion.size > 0 && !this.editor) { e.preventDefault(); this.cortar(); }
    else if (ctrl && k === 'v' && !this.editor) {
      if (hayContenidoEnPortapapeles()) {
        e.preventDefault();
        this.pegar();
      }
    }
    else if (ctrl && k === 'd' && this.seleccion.size > 0 && !this.editor) { e.preventDefault(); this.duplicar(); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.eliminarSeleccion(); }
    else if (k === 'escape') { this._cancelarGesto(); this.seleccion = new Set(); this._notificar(); this.pedirDibujo(); }
    else if (e.code === 'Space' && t?.tagName !== 'BUTTON') {
      if (!ctrl && !e.altKey && this.puedeHerramienta('texto') && (this.herramienta === 'texto' || this._unicoTexto() || this.escritura === 'teclado')) {
        if (this._escribirDirectoDesdeTeclado(' ')) { e.preventDefault(); return; }
      }
      e.preventDefault();
      if (!this.espacio) { this.espacio = true; this._cursor(); }
    }
    else if (k === 'enter' && !ctrl && this._unicoTexto()) { e.preventDefault(); this.editarTexto(this._unicoTexto().id); }
    else if (k === 'g' && !ctrl && !e.altKey && !this.puedeHerramienta('texto')) this.alternarRenglones();
    else if (k === 'g' && !ctrl && e.altKey) this.alternarRenglones();
    else if (!ctrl && !e.altKey) {
      const h = { v: 'seleccionar', q: 'lazo', h: 'mano', p: 'lapiz', m: 'resaltador', b: 'borrador', t: 'texto', r: 'rectangulo', e: 'elipse', l: 'linea', a: 'flecha' }[k];
      if (h) { this.setHerramienta(h); return; }
    } else if (!ctrl && e.altKey) {
      const h = { v: 'seleccionar', q: 'lazo', h: 'mano', p: 'lapiz', m: 'resaltador', b: 'borrador', t: 'texto', r: 'rectangulo', e: 'elipse', l: 'linea', a: 'flecha', g: 'renglones' }[k];
      if (h === 'renglones') this.alternarRenglones();
      else if (h) this.setHerramienta(h);
    }
  }

  _teclaArriba(e) { if (e.code === 'Space') { this.espacio = false; this._cursor(); } }

  // ---------- acciones para la interfaz ----------
  puedeHerramienta(h) {
    if (this.escritura === 'mano') return h !== 'texto';
    if (this.escritura === 'teclado') return !HERRAMIENTAS_DE_MANO.includes(h);
    return true;
  }

  setHerramienta(h) {
    if (this.escritura === 'mano' && h === 'texto') return;
    if (this.escritura === 'teclado' && HERRAMIENTAS_DE_MANO.includes(h)) return;
    if (!this.puedeHerramienta(h)) return;
    this.cerrarTexto(); this._cancelarGesto(); this.herramienta = h; this._cursor(); this._notificar(); this.pedirDibujo();
  }
  configurar(herramienta, parche) {
    this.ajustes[herramienta] = { ...this.ajustes[herramienta], ...parche };
    this.alAjustes(this.ajustes);
    this._notificar(); this.pedirDibujo();
  }

  setDedoDibuja(v) { this.dedoDibuja = v; this._dedoManual = true; this._notificar(); }

  // historialExtra (opcional): historial de nivel superior (por ejemplo, las operaciones sobre la lista de tarjetas).
  // Se usa solo cuando el historial de la escena actual no tiene nada que deshacer o rehacer.
  deshacer() {
    if (this.editor) { this.editor.deshacer(); return; }
    this._cancelarGesto();
    if (!this.escena.historial.puedeDeshacer() && this.historialExtra?.puedeDeshacer()) { this.historialExtra.deshacer(); return; }
    this.escena.deshacer();
  }
  rehacer() {
    if (this.editor) { this.editor.rehacer(); return; }
    this._cancelarGesto();
    if (!this.escena.historial.puedeRehacer() && this.historialExtra?.puedeRehacer()) { this.historialExtra.rehacer(); return; }
    this.escena.rehacer();
  }
  // Reconoce la forma del trazo en curso (círculo, recta, rectángulo...) y la reemplaza por la versión perfecta.
  _corregirFormaDelGesto(g) {
    if (this.gesto !== g || g.tipo !== 'dibujar' || g.formaReconocida || g.snappeadoEnInstrumento || !this.correccionFormasActiva) return;
    if (g.puntos.length < 8) return;
    const forma = reconocerForma(g.puntos);
    if (!forma) return;
    g.formaReconocida = forma;
    g.trazoOriginal = [...g.puntos];
    g.puntos = forma.puntos;
    this.pedirDibujo();
  }

  // Selecciona exactamente los elementos indicados (por ejemplo, al llegar desde un resultado de búsqueda).
  seleccionar(ids = []) {
    this.seleccion = new Set((ids || []).filter((id) => this.escena.get(id)));
    this._notificar();
    this.pedirDibujo();
  }

  seleccionarTodo() { this.seleccion = new Set(this.escena.lista().map((e) => e.id)); this._notificar(); this.pedirDibujo(); }

  eliminarSeleccion() {
    const elementosAEliminar = [...this.seleccion]
      .map((id) => this.escena.get(id))
      .filter((el) => el && !el.bloqueado);
    if (!elementosAEliminar.length) return;
    const cambios = elementosAEliminar.map((el) => ({ id: el.id, antes: el, despues: null }));
    const idsBorrados = elementosAEliminar.map((el) => el.id);
    const cambiosDesanclar = desanclarConectoresDeIdsBorrados(idsBorrados, this.escena);
    for (const el of elementosAEliminar) this.seleccion.delete(el.id);
    this.escena.ejecutar([...cambios, ...cambiosDesanclar], 'eliminar');
    this._notificar();
    this.pedirDibujo();
  }

  agruparSeleccion() {
    const noBloqueados = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && !el.bloqueado);
    if (noBloqueados.length < 2) return false;
    const gId = nuevoId();
    const cambios = noBloqueados.map((el) => ({ id: el.id, antes: el, despues: { ...el, grupoId: gId } }));
    this.escena.ejecutar(cambios, 'agrupar');
    this.seleccion = this._expandirGrupo(this.seleccion);
    this._notificar();
    this.pedirDibujo();
    return true;
  }

  desagruparSeleccion() {
    const conGrupo = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && el.grupoId && !el.bloqueado);
    if (!conGrupo.length) return false;
    const cambios = conGrupo.map((el) => ({ id: el.id, antes: el, despues: { ...el, grupoId: null } }));
    this.escena.ejecutar(cambios, 'desagrupar');
    this._notificar();
    this.pedirDibujo();
    return true;
  }

  bloquearSeleccion() {
    const elementos = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && !el.bloqueado);
    if (!elementos.length) return false;
    const cambios = elementos.map((el) => ({ id: el.id, antes: el, despues: { ...el, bloqueado: true } }));
    this.escena.ejecutar(cambios, 'bloquear');
    this._notificar();
    this.pedirDibujo();
    return true;
  }

  desbloquearSeleccion() {
    const elementos = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && el.bloqueado);
    if (!elementos.length) return false;
    const cambios = elementos.map((el) => ({ id: el.id, antes: el, despues: { ...el, bloqueado: false } }));
    this.escena.ejecutar(cambios, 'desbloquear');
    this._notificar();
    this.pedirDibujo();
    return true;
  }

  alternarBloqueoSeleccion() {
    const algunoBloqueado = [...this.seleccion].some((id) => this.escena.get(id)?.bloqueado);
    if (algunoBloqueado) return this.desbloquearSeleccion();
    return this.bloquearSeleccion();
  }

  alinear(direccion) {
    const elementos = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && !el.bloqueado);
    if (elementos.length < 2) return false;
    const alineados = alinearElementos(elementos, direccion);
    const cambios = alineados
      .map((a) => ({ id: a.id, antes: this.escena.get(a.id), despues: a }))
      .filter((c) => c.antes.x !== c.despues.x || c.antes.y !== c.despues.y);
    if (cambios.length) {
      this.escena.ejecutar(cambios, `alinear ${direccion}`);
      this._notificar();
      this.pedirDibujo();
    }
    return true;
  }

  distribuir(direccion) {
    const elementos = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && !el.bloqueado);
    if (elementos.length < 3) return false;
    const distribuidos = distribuirElementos(elementos, direccion);
    const cambios = distribuidos
      .map((d) => ({ id: d.id, antes: this.escena.get(d.id), despues: d }))
      .filter((c) => c.antes.x !== c.despues.x || c.antes.y !== c.despues.y);
    if (cambios.length) {
      this.escena.ejecutar(cambios, `distribuir ${direccion}`);
      this._notificar();
      this.pedirDibujo();
    }
    return true;
  }

  toggleIman() {
    this.imanActivo = !this.imanActivo;
    this.guiasActivas = [];
    this._notificar();
    this.pedirDibujo();
    return this.imanActivo;
  }

  setIman(activo) {
    this.imanActivo = !!activo;
    this.guiasActivas = [];
    this._notificar();
    this.pedirDibujo();
    return this.imanActivo;
  }

  reordenar(modo) { if (this.seleccion.size) this.escena.reordenar([...this.seleccion], modo); }

  async insertarImagen(archivo, mundo = null) {
    try {
      const procesada = await procesarImagen(archivo);
      const blob = await guardarBlob(procesada.blob, { tipo: procesada.tipo, nombre: procesada.nombre });
      const p = mundo || this._cursorTextoPosicion();
      const pagina = this._obtenerContenedor(p.y);
      const marco = Array.isArray(this.marco)
        ? this.marco.find((m) => m.numero === pagina) || this.marco[0]
        : this.marco;
      const maxAncho = marco ? Math.max(80, marco.ancho - 120) : Math.max(80, this.ancho * 0.7 / this.camara.zoom);
      const escala = Math.min(1, maxAncho / procesada.anchoOriginal, 480 / procesada.altoOriginal);
      const ancho = Math.max(2, procesada.anchoOriginal * escala);
      const alto = Math.max(2, procesada.altoOriginal * escala);
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.IMAGEN, {
        x: p.x, y: p.y, ancho, alto, z: this.escena.zMax() + 1, contenedor: pagina, cara: this._obtenerCara(),
        datos: { blobId: blob.id, anchoOriginal: procesada.anchoOriginal, altoOriginal: procesada.altoOriginal, nombre: procesada.nombre },
      });
      this.seleccion = new Set([el.id]);
      this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'insertar imagen');
      this.alImagenError('');
      this.pedirDibujo();
      return el;
    } catch (error) {
      this.alImagenError(error instanceof Error ? error.message : 'No se pudo insertar la imagen.');
      return null;
    }
  }

  _archivoImagen(transferencia) {
    if (!transferencia) return null;
    const desdeItems = [...(transferencia.items || [])]
      .filter((item) => item.kind === 'file' && /^image\/(jpeg|png|webp)$/i.test(item.type))
      .map((item) => item.getAsFile()).find(Boolean);
    if (desdeItems) return desdeItems;
    return [...(transferencia.files || [])].find((f) => /^image\/(jpeg|png|webp)$/i.test(f.type)) || null;
  }

  _arrastrarArchivo(e) { if (this._archivoImagen(e.dataTransfer)) e.preventDefault(); }

  _soltarArchivo(e) {
    const archivo = this._archivoImagen(e.dataTransfer);
    if (!archivo) return;
    e.preventDefault(); e.stopPropagation();
    const mundo = this._mundo(this._pos(e));
    this.cursorTexto = mundo;
    this.insertarImagen(archivo, mundo);
  }

  zoomPaso(factor) { this.camara = zoomEn(this.camara, this.ancho / 2, this.alto / 2, factor); this._camaraCambio(); }
  zoomReal() { this.camara = zoomEn(this.camara, this.ancho / 2, this.alto / 2, 1 / this.camara.zoom); this._camaraCambio(); }

  // ---------- renglones (Etapa 8) ----------
  _ahora() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  _fondoRenglones() { return { cfg: this.renglones, opacidad: opacidadRenglones(this.renglones, this._ahora(), this._destello) }; }

  // Muestra los renglones un momento con fundido (en modo «breve» u «ocultos»).
  _destellar(segundos) {
    if (this.renglones.modo === 'siempre') return;
    this._destello = { inicio: this._ahora(), duracion: segundos };
    this.pedirDibujo();
  }

  mostrarRenglones() { this._destellar(this.renglones.modo === 'breve' ? this.renglones.duracion : 1.5); }

  // parche: cualquier campo de la configuración. previa: al cambiar el estilo, la separación, etc. se muestra un instante para ver el efecto.
  configurarRenglones(parche, { previa = false } = {}) {
    const antes = this.renglones;
    this.renglones = normalizarRenglones({ ...antes, ...parche });
    if (this.renglones.activos && !antes.activos && this.renglones.modo === 'breve') this._destellar(this.renglones.duracion);
    else if (previa && this.renglones.activos) this._destellar(this.renglones.modo === 'breve' ? this.renglones.duracion : 1.5);
    this.refrescarTextos();
    this.alRenglones(this.renglones);
    this._notificar(); this.pedirDibujo();
  }

  alternarRenglones() { this.configurarRenglones({ activos: !this.renglones.activos }); }

  // Alinear al renglón: solo si el usuario lo activó. Un punto del mundo → el punto de la guía más cercano.
  _snapPunto(p) { return alinearPunto(this.renglones, p); }

  // Ajusta un desplazamiento (dx, dy) para que el punto de referencia caiga sobre la guía.
  _snapDelta(ref, dx, dy, forzar = false) {
    const cfg = forzar ? { ...this.renglones, alinear: true } : this.renglones;
    if (!guiaActiva(cfg)) return { dx, dy };
    const q = alinearPunto(cfg, { x: ref.x + dx, y: ref.y + dy });
    return { dx: q.x - ref.x, dy: q.y - ref.y };
  }

  // Punto del elemento que se apoya en la guía: la base del primer renglón en un texto; la esquina en lo demás.
  _referenciaGuia(el) {
    return el.tipo === 'texto' ? { x: el.x, y: el.y + baseDelPrimerRenglon(el.datos, el.ancho, this._opcionesLayout(el.datos)) } : { x: el.x, y: el.y };
  }

  _snapMover(origenes, dx, dy) {
    const textoGuiado = [...origenes.values()].some((el) => el.tipo === 'texto' && el.datos.composicion === 'guiada');
    if (!guiaActiva(this.renglones) && !(textoGuiado && this.renglones.activos && this.renglones.estilo !== 'liso')) return { dx, dy };
    const ref = [...origenes.values()].filter((o) => o.tipo !== 'trazo').sort((a, b) => a.y - b.y || a.x - b.x)[0];
    return ref ? this._snapDelta(this._referenciaGuia(ref), dx, dy, textoGuiado) : { dx, dy };
  }

  // Centra la vista en un punto del mundo sin cambiar el zoom (lo usa el minimapa).
  irA(x, y) {
    this.camara = { ...this.camara, x: x - this.ancho / 2 / this.camara.zoom, y: y - this.alto / 2 / this.camara.zoom };
    this._camaraCambio();
  }

  setResaltadosBusqueda(resaltados = [], coincidenciaActiva = null) {
    this.resaltadosBusqueda = Array.isArray(resaltados) ? resaltados : [];
    this.coincidenciaActiva = coincidenciaActiva;
    this.pedirDibujo();
  }

  centrarEnUbicacion(u, zoomFijo = null) {
    if (!u) return;
    const cx = (Number(u.x) || 0) + (Number(u.ancho) || 0) / 2;
    const cy = (Number(u.y) || 0) + (Number(u.alto) || 0) / 2;
    const zoom = zoomFijo || this.camara.zoom || 1;
    this.camara = {
      x: cx - this.ancho / 2 / zoom,
      y: cy - this.alto / 2 / zoom,
      zoom,
    };
    this._camaraCambio();
  }

  // Conecta (o desconecta con null) el canvas del minimapa.
  conectarMinimapa(canvas) {
    this.minimapa?.destruir();
    this.minimapa = canvas ? new Minimapa(canvas, this) : null;
    this.pedirDibujo();
  }

  // Cambia el estilo de las figuras o íconos seleccionados y de los que se creen de ahí en adelante.
  estiloFiguras(parche) {
    const cambios = [];
    for (const id of this.seleccion) {
      const el = this.escena.get(id);
      if (!el) continue;
      if (el.tipo === 'figura') {
        const d = { ...el.datos };
        if ('borde' in parche) d.borde = parche.borde;
        if ('relleno' in parche && !esLinea(el)) d.relleno = parche.relleno;
        if ('grosor' in parche) d.grosor = Math.max(0.5, parche.grosor);
        if ('estiloBorde' in parche) d.estiloBorde = parche.estiloBorde;
        if ('radioEsquinas' in parche) d.radioEsquinas = Math.max(0, parche.radioEsquinas);
        if ('opacidad' in parche) d.opacidad = Math.max(0.05, Math.min(1, parche.opacidad));
        if ('sombra' in parche) d.sombra = parche.sombra ? { ...(d.sombra || {}), ...parche.sombra } : null;
        if ('tipoConector' in parche) d.tipoConector = parche.tipoConector;
        if ('texto' in parche) d.texto = parche.texto;
        if ('etiqueta' in parche) d.etiqueta = parche.etiqueta;
        if ('enlace' in parche) d.enlace = parche.enlace;
        cambios.push({ id, antes: el, despues: { ...el, datos: d, enlace: d.enlace } });
      } else if (el.tipo === 'icono') {
        const d = { ...el.datos };
        if ('color' in parche) d.color = parche.color;
        if ('borde' in parche) d.borde = parche.borde;
        if ('grosor' in parche) d.grosor = Math.max(0.5, parche.grosor);
        if ('estiloBorde' in parche) d.estiloBorde = parche.estiloBorde;
        if ('opacidad' in parche) d.opacidad = Math.max(0.05, Math.min(1, parche.opacidad));
        if ('sombra' in parche) d.sombra = parche.sombra ? { ...(d.sombra || {}), ...parche.sombra } : null;
        cambios.push({ id, antes: el, despues: { ...el, datos: d } });
      }
    }
    if (cambios.length) this.escena.ejecutar(cambios, 'estilo');
    this.configurar('figura', parche);
    this.pedirDibujo();
    this._notificar();
  }

  // Cambia el marco, borde, sombra y opacidad de las imágenes seleccionadas
  estiloImagenes(parche) {
    const cambios = [];
    for (const id of this.seleccion) {
      const el = this.escena.get(id);
      if (!el || el.tipo !== 'imagen') continue;
      const d = { ...el.datos };
      if ('borde' in parche) d.borde = parche.borde;
      if ('grosor' in parche) d.grosor = Math.max(0.5, parche.grosor);
      if ('estiloBorde' in parche) d.estiloBorde = parche.estiloBorde;
      if ('marco' in parche) d.marco = parche.marco;
      if ('radioEsquinas' in parche) d.radioEsquinas = Math.max(0, parche.radioEsquinas);
      if ('opacidad' in parche) d.opacidad = Math.max(0.05, Math.min(1, parche.opacidad));
      if ('sombra' in parche) d.sombra = parche.sombra ? { ...(d.sombra || {}), ...parche.sombra } : null;
      if ('enlace' in parche) d.enlace = parche.enlace;
      cambios.push({ id, antes: el, despues: { ...el, datos: d, enlace: d.enlace } });
    }
    if (cambios.length) {
      this.escena.ejecutar(cambios, 'estilo_imagen');
      this.pedirDibujo();
      this._notificar();
    }
  }

  // Asigna o quita un enlace a los elementos seleccionados (Etapa 23)
  enlazarSeleccion(enlace) {
    const cambios = [];
    for (const id of this.seleccion) {
      const el = this.escena.get(id);
      if (!el) continue;
      const d = { ...(el.datos || {}) };
      d.enlace = enlace;
      cambios.push({ id, antes: el, despues: { ...el, enlace, datos: d } });
    }
    if (cambios.length) {
      this.escena.ejecutar(cambios, enlace ? 'enlazar elemento' : 'desenlazar elemento');
      this.pedirDibujo();
      this._notificar();
    }
  }

  // Ramifica un nuevo nodo hijo conectado desde el nodo seleccionado (Etapa 23: Mapas conceptuales)
  ramificarSeleccion(direccion = 'derecha', texto = 'Concepto derivado') {
    if (this.seleccion.size !== 1) return null;
    const padreId = [...this.seleccion][0];
    const res = ramificarNodoMapaConceptual({
      escena: this.escena,
      padreId,
      direccion,
      texto,
      documentoId: this.documentoId,
    });
    if (res?.nuevoNodo) {
      this.seleccion = new Set([res.nuevoNodo.id]);
      this.pedirDibujo();
      this._notificar();
    }
    return res;
  }

  // Actualiza o crea las máscaras de oclusión de una imagen con historial de deshacer/rehacer
  actualizarMascarasImagen(imagenId, nuevasMascaras, descripcion = 'Modificar máscaras de oclusión') {
    const el = this.escena.get(imagenId);
    if (!el || el.tipo !== 'imagen') return;
    const nuevo = {
      ...el,
      datos: {
        ...el.datos,
        mascaras: nuevasMascaras,
      },
    };
    this.escena.ejecutar([{ id: el.id, antes: el, despues: nuevo }], descripcion);
    this.pedirDibujo();
    this._notificar();
  }

  // Inserta una pegatina o ícono SVG educativo en el centro de la vista
  insertarIcono(icono, opciones = {}) {
    const { color = '#2350d8', borde = null, grosor = 2, modo = null, ancho = 72, alto = 72 } = opciones;
    const vista = visibleEnMundo(this.camara, this.ancho, this.alto);
    const cx = Math.round(vista.x + (vista.ancho - ancho) / 2);
    const cy = Math.round(vista.y + (vista.alto - alto) / 2);
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.ICONO, {
      x: cx,
      y: cy,
      ancho,
      alto,
      z: this.escena.zMax() + 1,
      contenedor: this._obtenerContenedor(cy),
      cara: this._obtenerCara(),
      datos: {
        nombre: icono.nombre,
        iconoId: icono.id,
        d: icono.d,
        color: color || '#2350d8',
        borde,
        grosor,
        modo: modo || icono.modo || 'trazo',
        opacidad: 1,
        sombra: { activa: false, color: 'rgba(20,25,43,0.35)', desenfoque: 8, x: 2, y: 4 },
      },
    });
    this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'insertar_icono');
    this.seleccion = new Set([el.id]);
    this._notificar();
    this.pedirDibujo();
    return el;
  }

  // Fondo del documento (página, tarjeta o pizarrón)
  establecerFondoDocumento(fondo) {
    this.fondoDocumento = fondo;
    this.pedirDibujo();
  }

  // Extrae el color hexadecimal de cualquier píxel del canvas (alternativa universal de cuentagotas)
  obtenerColorEnPunto(pantallaX, pantallaY) {
    if (!this.canvas || !this.ctx) return '#ffffff';
    try {
      const px = Math.round(pantallaX * this.dpr);
      const py = Math.round(pantallaY * this.dpr);
      const pixel = this.ctx.getImageData(px, py, 1, 1).data;
      const r = pixel[0].toString(16).padStart(2, '0');
      const g = pixel[1].toString(16).padStart(2, '0');
      const b = pixel[2].toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    } catch {
      return '#ffffff';
    }
  }

  encuadrarTodo() {
    const r = this.escena.limites();
    this.camara = r ? encuadrar(r, this.ancho, this.alto) : camaraInicial();
    this._camaraCambio();
  }

  // ---------- texto con teclado (Etapa 6) ----------
  _enCampo(t) {
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || !!t.isContentEditable || !!(t.closest && t.closest('[data-nt-editor]')));
  }

  _unicoTexto() {
    const el = this.seleccion.size === 1 ? this.escena.get([...this.seleccion][0]) : null;
    return el && el.tipo === 'texto' ? el : null;
  }

  // Al ensanchar un texto, el alto lo decide el contenido; si el borde izquierdo se movió, se respeta el borde derecho.
  _ajustarTexto(nuevo, original) {
    const ancho = Math.max(40, nuevo.ancho);
    const x = nuevo.x !== original.x ? original.x + original.ancho - ancho : nuevo.x;
    return { ...nuevo, x, ancho, alto: layoutDe(nuevo.datos, ancho, undefined, this._opcionesLayout(nuevo.datos)).alto };
  }

  _opcionesLayout(datos) {
    const res = datos?.composicion === 'guiada' ? { interlineado: this.renglones.interlineado } : {};
    if (this.estilos) res.estilos = this.estilos;
    return res;
  }

  // Herramienta Texto: un clic crea (o edita el texto que haya ahí); arrastrar define el ancho.
  _soltarTexto(g, e) {
    const p = this._pos(e);
    if (Math.hypot(p.x - g.inicioPantalla.x, p.y - g.inicioPantalla.y) < 6) {
      const el = this._elementoEn(g.inicio, 4 / this.camara.zoom);
      if (el && el.tipo === 'texto') this.editarTexto(el.id, { x: e.clientX, y: e.clientY });
      else this.crearTexto(g.inicio.x, g.inicio.y, 0, true);
    } else {
      const r = normalizarRect(g.inicio.x, g.inicio.y, g.actual.x, g.actual.y);
      this.crearTexto(r.x, r.y, Math.max(40, r.ancho));
    }
  }

  // Doble clic (o doble toque) sobre un texto con la herramienta Seleccionar.
  // Fin de un paneo con la mano: si se movió, no cuenta como clic; si quedó quieto, puede ser el 2.º clic de un doble clic.
  _soltarPaneoMano(g, e) {
    const q = this._pos(e);
    if (Math.hypot(q.x - g.inicioPantalla.x, q.y - g.inicioPantalla.y) >= 6) { this._ultimoToqueVacio = null; this._ultimoToque = null; return; }
    if (g.dobleVacio) this._crearTextoDirecto(g.inicio.x, g.inicio.y - Math.round(this.ajustes.texto.tamano) * 0.7);
    else if (g.sobreTexto) this._toqueSobreTexto(g.sobreTexto, e);
  }

  _toqueSobreTexto(id, e) {
    const p = this._pos(e), ahora = Date.now(), u = this._ultimoToque;
    if (u && u.id === id && ahora - u.t < 450 && Math.hypot(p.x - u.x, p.y - u.y) < 14) { this._ultimoToque = null; this.editarTexto(id, { x: e.clientX, y: e.clientY }); }
    else this._ultimoToque = { id, t: ahora, x: p.x, y: p.y };
  }

  crearTexto(x, y, ancho = 0, enClic = false) {
    if (!this.puedeHerramienta('texto')) return;
    const z = this.camara.zoom;
    const tam = Math.max(6, Math.min(800, Math.round(this.ajustes.texto.tamano)));
    const datos = datosTextoNuevo(tam);
    let ancho1 = ancho || Math.min(3000, Math.max(80, Math.round(320 / z)));
    if (!ancho && typeof this.anchoTextoNuevo === 'function') {
      const hasta = this.anchoTextoNuevo(x, y); // p. ej. hasta el margen derecho de la hoja A4
      if (Number.isFinite(hasta) && hasta >= 160) ancho1 = Math.min(3000, hasta);
    }
    let ex = x, ey = enClic ? y - tam * 0.7 : y;
    if (guiaActiva(this.renglones)) { // con «alinear al renglón», el primer renglón del texto se apoya en la guía
      const base = baseDelPrimerRenglon(datos, ancho1, this._opcionesLayout(datos));
      const q = alinearPunto(this.renglones, { x: ex, y: ey + base });
      ey = q.y - base;
      if (this.renglones.estilo !== 'rayado') ex = q.x;
    }
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TEXTO, {
      x: ex, y: ey, ancho: ancho1, alto: layoutDe(datos, ancho1).alto, z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(ey), cara: this._obtenerCara(), datos,
    });
    this._abrirEditor(el, true);
  }

  editarTexto(id, punto) {
    const el = this.escena.get(id);
    if (!el || el.tipo !== 'texto' || !this.puedeHerramienta('texto')) return;
    this._abrirEditor(el, false, punto);
  }

  _abrirEditor(el, nuevo, punto, directo = false) {
    this.cerrarTexto();
    this._cancelarGesto();
    this.seleccion = new Set();
    const base = el.ancho > 20 ? el : { ...el, ancho: 300 }; // los textos de prueba antiguos no tenían ancho
    this.texto = { id: el.id, base, original: nuevo ? null : el, nuevo, directo };
    this.ocultoId = el.id;
    this.editor = new EditorTexto(this.capaTexto, {
      el: base, camara: this.camara, guia: this.renglones,
      alImagen: (archivo, punto) => this._insertarImagenDesdeEditor(archivo, punto),
      alCambiar: () => this._notificar(),
      alTerminar: (motivo) => this._terminarTexto(motivo),
      alPuntoDeControl: () => this.puntoDeControlTexto(),
      alTamano: (n) => this.configurar('texto', { tamano: Math.max(1, Math.round(n)) }),
    });
    this.editor.enfocar(punto);
    this._vigilarVisualViewport();
    this._notificar(); this.pedirDibujo();
    this._despejarBarra();
  }

  _insertarImagenDesdeEditor(archivo, punto) {
    const rect = this.canvas.getBoundingClientRect();
    const posicion = punto && Number.isFinite(punto.x) && Number.isFinite(punto.y)
      ? this._mundo({ x: punto.x - rect.left, y: punto.y - rect.top })
      : this._cursorTextoPosicion();
    this.cerrarTexto();
    this.insertarImagen(archivo, posicion);
  }

  // La barra de formato aparece arriba: si tapa el texto, se baja la vista lo justo para dejarlo a la vista.
  _despejarBarra() {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const barra = this.editor && document.querySelector('[data-nt-barra]');
      if (!barra) return;
      const limite = barra.getBoundingClientRect().bottom + 14;
      const arriba = this.editor.rect().top;
      if (arriba < limite) { this.camara = mover(this.camara, 0, limite - arriba); this._camaraCambio(); }
    });
  }

  _datosDeEditor(ed, base = this.texto?.base) {
    return { ...(base?.datos?.composicion ? { composicion: base.datos.composicion } : {}), bloques: ed.leer(), tamano: ed.tamano, color: ed.colorBase };
  }
  _elementoDe(base, datos) { return { ...base, datos, alto: layoutDe(datos, base.ancho, undefined, this._opcionesLayout(datos)).alto }; }

  // Pasa lo escrito a la escena sin cerrar el editor ni tocar el historial: así el autoguardado
  // también guarda el texto mientras se escribe y no se pierde si se cierra la pestaña.
  puntoDeControlTexto() {
    if (!this.editor || !this.texto) return;
    const t = this.texto, actual = this.escena.get(t.id);
    const datos = this._datosDeEditor(this.editor, t.base);
    if (esVacio(datos.bloques)) {
      if (t.nuevo && actual) this.escena.transitorio([{ id: t.id, antes: actual, despues: null }]);
      return;
    }
    this.escena.transitorio([{ id: t.id, antes: actual || null, despues: this._elementoDe(t.base, datos) }]);
  }

  // Termina la edición y deja una sola acción en el historial. Devuelve true si había un texto abierto.
  cerrarTexto() {
    const ed = this.editor;
    if (!ed) return false;
    const t = this.texto;
    const puntoInsercion = t.directo ? ed.puntoInsercion() : null;
    const datos = this._datosDeEditor(ed, t.base);
    this.editor = null; this.texto = null;
    ed.destruir();
    this._quitarVisualViewport();
    this.ocultoId = null;
    const actual = this.escena.get(t.id);
    if (esVacio(datos.bloques)) {
      if (t.nuevo) { if (actual) this.escena.transitorio([{ id: t.id, antes: actual, despues: null }]); }
      else this.escena.ejecutar([{ id: t.id, antes: t.original, despues: null }], 'eliminar texto');
    } else {
      const nuevo = this._elementoDe(t.base, datos);
      if (t.nuevo) this.escena.ejecutar([{ id: t.id, antes: null, despues: nuevo }], 'texto');
      else if (JSON.stringify(t.original.datos) !== JSON.stringify(datos) || t.original.ancho !== nuevo.ancho) this.escena.ejecutar([{ id: t.id, antes: t.original, despues: nuevo }], 'editar texto');
      else if (actual !== t.original) this.escena.transitorio([{ id: t.id, antes: actual, despues: t.original }]);
    }
    if (t.directo && puntoInsercion) {
      const rect = this.canvas.getBoundingClientRect();
      this.cursorTexto = pantallaAMundo(this.camara, puntoInsercion.x - rect.left, puntoInsercion.y - rect.top);
    } else if (actual || t.base) {
      const elRef = actual || t.base;
      this.cursorTexto = { x: elRef.x, y: elRef.y + (elRef.alto || 24) };
    }
    this._notificar(); this.pedirDibujo();
    return true;
  }

  // 'esc': el usuario terminó a propósito (queda seleccionado para moverlo); 'blur': el foco se fue a otro lado.
  _terminarTexto(motivo) {
    const t = this.texto;
    if (!t) return;
    const id = t.id;
    this.cerrarTexto();
    if (motivo === 'esc' && this.escena.get(id)) {
      this.herramienta = 'seleccionar';
      this.seleccion = new Set([id]);
      this._cursor(); this._notificar(); this.pedirDibujo();
      this.canvas.focus?.({ preventScroll: true });
    }
  }

  formatoTexto(accion, valor, extra = null) {
    if (!this.editor) return;
    if (accion === 'terminar') { this._terminarTexto('esc'); return; }
    this.editor.aplicar(accion, valor, extra);
  }

  insertarSimbolo(caracter) {
    if (typeof caracter !== 'string' || !caracter) return false;
    if (!this.editor) {
      if (!this.puedeHerramienta('texto')) return false;
      const p = this._cursorTextoPosicion();
      this._crearTextoDirecto(p.x, p.y);
    }
    return !!this.editor?.insertarTextoDirecto(caracter);
  }

  iniciarRecorteImagen() {
    const el = this.seleccion.size === 1 ? this.escena.get([...this.seleccion][0]) : null;
    if (!el || el.tipo !== 'imagen') return false;
    this.cerrarTexto();
    this._recorteEnCurso = { original: el };
    return true;
  }

  recortarImagen(parche) {
    const id = this._recorteEnCurso?.original.id || (this.seleccion.size === 1 ? [...this.seleccion][0] : null);
    const actual = id ? this.escena.get(id) : null;
    if (!actual || actual.tipo !== 'imagen') return;
    const datos = { ...actual.datos, recorte: recorteImagenSeguro({ ...actual.datos.recorte, ...parche }) };
    const nuevo = { ...actual, datos };
    if (this._recorteEnCurso?.original.id === id) this.escena.transitorio([{ id, antes: actual, despues: nuevo }]);
    else this.escena.ejecutar([{ id, antes: actual, despues: nuevo }], 'recortar imagen');
    this.pedirDibujo();
  }

  terminarRecorteImagen() {
    const sesion = this._recorteEnCurso;
    this._recorteEnCurso = null;
    if (!sesion) return;
    const actual = this.escena.get(sesion.original.id);
    if (actual && JSON.stringify(actual.datos.recorte) !== JSON.stringify(sesion.original.datos.recorte)) {
      this.escena.registrar([{ id: actual.id, antes: sesion.original, despues: actual }], 'recortar imagen');
    }
  }

  // Cuando termina de cargar una tipografía cambian las medidas: se recalcula el alto de cada texto.
  refrescarTextos() {
    const cambios = [];
    for (const el of this.escena.mapa.values()) {
      if (el.tipo !== 'texto' || !Array.isArray(el.datos.bloques) || (this.texto && this.texto.id === el.id)) continue;
      const opciones = this._opcionesLayout(el.datos);
      const base = baseDelPrimerRenglon(el.datos, el.ancho, opciones);
      let x = el.x, y = el.y;
      if (el.datos.composicion === 'guiada' && this.renglones.activos && this.renglones.estilo !== 'liso') {
        const q = alinearPunto({ ...this.renglones, alinear: true }, { x, y: y + base });
        x = q.x; y = q.y - base;
      }
      const alto = layoutDe(el.datos, el.ancho, undefined, opciones).alto;
      if (Math.abs(alto - el.alto) > 0.75 || Math.abs(x - el.x) > 0.75 || Math.abs(y - el.y) > 0.75) cambios.push({ id: el.id, antes: el, despues: { ...el, x, y, alto } });
    }
    if (cambios.length) this.escena.transitorio(cambios);
  }

  _detectarFormato() {
    if (Array.isArray(this.marco)) return 'paginas';
    if (this.marco) return 'tarjetas';
    return 'pizarron';
  }

  // Copiar elementos seleccionados (Ctrl+C o botón Copiar).
  copiar(e = null) {
    if (this.editor || this._enCampo(e?.target)) return false;
    const seleccionados = [...this.seleccion].map((id) => this.escena.get(id)).filter(Boolean);
    if (!seleccionados.length) return false;

    const formato = this._detectarFormato();
    const contenedor = this._obtenerContenedor();
    const caja = unirRects(seleccionados);
    guardarEnPortapapeles(seleccionados, {
      documentoId: this.documentoId,
      formato,
      contenedor,
      caja,
    });

    if (e?.clipboardData) {
      try {
        e.clipboardData.setData(TIPO_MIME_ELEMENTOS, JSON.stringify({
          elementos: seleccionados,
          origen: { documentoId: this.documentoId, formato, contenedor, caja },
        }));
      } catch {
        /* ignorar fallos en clipboardData personalizado */
      }
      const textos = seleccionados.filter((x) => x.tipo === 'texto').sort((a, b) => a.y - b.y || a.x - b.x);
      if (textos.length) {
        const bloques = textos.flatMap((x) => bloquesDe(x.datos));
        e.clipboardData.setData('text/html', modeloAHtml(bloques));
        e.clipboardData.setData('text/plain', modeloATexto(bloques));
      }
      e.preventDefault();
    }

    this._notificar();
    return true;
  }

  // Cortar elementos seleccionados (Ctrl+X o botón Cortar): copiar + eliminar en una sola acción del historial.
  cortar(e = null) {
    if (this.editor || this._enCampo(e?.target)) return false;
    const seleccionados = [...this.seleccion].map((id) => this.escena.get(id)).filter((el) => el && !el.bloqueado);
    if (!seleccionados.length) return false;

    this.copiar(e);

    const cambios = seleccionados.map((el) => ({ id: el.id, antes: el, despues: null }));
    for (const el of seleccionados) this.seleccion.delete(el.id);
    this.escena.ejecutar(cambios, 'cortar');
    this._notificar();
    this.pedirDibujo();
    return true;
  }

  // Duplicar elementos seleccionados (Ctrl+D o botón Duplicar): clona la selección con leve desplazamiento en una sola acción.
  duplicar() {
    if (this.editor) return false;
    const seleccionados = [...this.seleccion].map((id) => this.escena.get(id)).filter(Boolean);
    if (!seleccionados.length) return false;

    const formato = this._detectarFormato();
    const contenedor = this._obtenerContenedor();
    const paquete = {
      elementos: seleccionados,
      origen: {
        documentoId: this.documentoId,
        formato,
        contenedor,
        caja: unirRects(seleccionados),
      },
      contador: 1,
    };

    const nuevos = prepararElementosParaPegar(paquete, {
      documentoId: this.documentoId,
      formato,
      contenedor,
      camara: this.camara,
      vistaAncho: this.ancho,
      vistaAlto: this.alto,
      marco: this.marco,
      zMax: this.escena.zMax(),
    });

    if (!nuevos.length) return false;

    const cambios = nuevos.map((el) => ({ id: el.id, antes: null, despues: el }));
    this.escena.ejecutar(cambios, 'duplicar');
    this.seleccion = new Set(nuevos.map((el) => el.id));
    if (nuevos.some((el) => el.tipo === 'imagen')) {
      prepararImagenes(nuevos).then(() => this.pedirDibujo()).catch(() => {});
    }
    this._notificar();
    this.pedirDibujo();
    return true;
  }

  // Pegar elementos (Ctrl+V o botón Pegar): convive con texto/imágenes externos y con el portapapeles interno.
  pegar(e = null) {
    if (this.editor) return false;
    if (this._enCampo(e?.target)) return false;

    // Si viene un evento con clipboardData (evento nativo de pegado)
    if (e?.clipboardData) {
      // 1. ¿Viene un paquete de elementos de Anotomía?
      try {
        const raw = e.clipboardData.getData(TIPO_MIME_ELEMENTOS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.elementos) && parsed.elementos.length > 0) {
            if (e.preventDefault) e.preventDefault();
            return this._insertarPaquete({
              elementos: parsed.elementos,
              origen: parsed.origen || {},
              contador: 1,
            });
          }
        }
      } catch {
        /* continuar con otras fuentes */
      }

      // 2. Verificar imagen externa
      const archivo = this._archivoImagen(e.clipboardData);
      if (archivo) {
        e.preventDefault();
        this.insertarImagen(archivo);
        return true;
      }

      // 3. Verificar texto externo (HTML o plano de Word/web)
      const html = e.clipboardData.getData('text/html');
      let bloques = html ? htmlAModelo(html, { colorBase: COLOR_TEXTO }) : [];
      if (esVacio(bloques)) bloques = textoAModelo(e.clipboardData.getData('text/plain'));
      if (!esVacio(bloques) && this.puedeHerramienta('texto')) {
        e.preventDefault();
        const z = this.camara.zoom;
        const tam = Math.max(6, Math.round(this.ajustes.texto.tamano));
        const ancho = Math.max(80, Math.round(Math.min(520, this.ancho * 0.6) / z));
        const pos = pantallaAMundo(this.camara, this.ancho * 0.2, this.alto * 0.2);
        const datos = { bloques, tamano: tam, color: COLOR_TEXTO };
        const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TEXTO, {
          x: pos.x,
          y: pos.y,
          ancho,
          z: this.escena.zMax() + 1,
          contenedor: this._obtenerContenedor(pos.y),
          cara: this._obtenerCara(),
          datos,
        });
        const nuevo = { ...el, alto: layoutDe(datos, ancho).alto };
        this.escena.ejecutar([{ id: nuevo.id, antes: null, despues: nuevo }], 'pegar');
        this.seleccion = new Set([nuevo.id]);
        this._notificar();
        this.pedirDibujo();
        return true;
      }

      // Si fue un evento nativo con clipboardData pero sin contenido válido externo ni Anotomía, no prevenimos default
      return false;
    }

    // 4. Si se invoca programáticamente (botón Pegar o atajo sin clipboardData del sistema)
    const paquete = obtenerDePortapapeles();
    if (!paquete || !paquete.elementos || !paquete.elementos.length) return false;

    return this._insertarPaquete(paquete);
  }

  _insertarPaquete(paquete) {
    const formato = this._detectarFormato();
    const contenedor = this._obtenerContenedor();
    const nuevos = prepararElementosParaPegar(paquete, {
      documentoId: this.documentoId,
      formato,
      contenedor,
      camara: this.camara,
      vistaAncho: this.ancho,
      vistaAlto: this.alto,
      marco: this.marco,
      zMax: this.escena.zMax(),
    });

    if (!nuevos.length) return false;

    const cambios = nuevos.map((el) => ({ id: el.id, antes: null, despues: el }));
    this.escena.ejecutar(cambios, 'pegar');
    this.seleccion = new Set(nuevos.map((el) => el.id));

    if (nuevos.some((el) => el.tipo === 'imagen')) {
      prepararImagenes(nuevos).then(() => this.pedirDibujo()).catch(() => {});
    }

    this._notificar();
    this.pedirDibujo();
    return true;
  }

  _pegar(e) { this.pegar(e); }
  _copiar(e) { this.copiar(e); }
  _cortar(e) { this.cortar(e); }

  // En tablets, al abrirse el teclado se achica el área visible: se corre la vista para que lo escrito no quede tapado.
  _vigilarVisualViewport() {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (!vv || this._vv) return;
    this._vv = () => this._asegurarVisible();
    vv.addEventListener('resize', this._vv); vv.addEventListener('scroll', this._vv);
  }

  _quitarVisualViewport() {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (vv && this._vv) { vv.removeEventListener('resize', this._vv); vv.removeEventListener('scroll', this._vv); }
    this._vv = null;
  }

  _asegurarVisible() {
    const vv = window.visualViewport;
    if (!vv || !this.editor) return;
    const r = this.editor.rect();
    const limite = vv.offsetTop + vv.height - 16;
    if (r.bottom <= limite) return;
    const tope = this.canvas.getBoundingClientRect().top + 56;
    const dy = Math.min(r.bottom - limite, Math.max(0, r.top - tope));
    if (dy > 0) { this.camara = mover(this.camara, 0, -dy); this._camaraCambio(); }
  }

  // Herramientas de prueba de la etapa 4.
  generarFiguras(n) {
    const lado = Math.sqrt(n) * 100;
    const c = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    let z = this.escena.zMax();
    const cambios = [];
    for (let i = 0; i < n; i++) {
      const k = i % PALETA.length;
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.FIGURA, {
        x: c.x - lado / 2 + Math.random() * lado, y: c.y - lado / 2 + Math.random() * lado,
        ancho: 30 + Math.random() * 60, alto: 30 + Math.random() * 60, z: ++z,
        datos: { forma: i % 2 ? 'elipse' : 'rectangulo', relleno: PALETA[k], borde: BORDES[k], grosor: 2 },
      });
      cambios.push({ id: el.id, antes: null, despues: el });
    }
    this.escena.ejecutar(cambios, 'generar');
    this.encuadrarTodo();
  }

  generarTrazos(n) {
    const lado = Math.sqrt(n) * 140;
    const c = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    let z = this.escena.zMax();
    const cambios = [];
    for (let i = 0; i < n; i++) {
      const x0 = c.x - lado / 2 + Math.random() * lado, y0 = c.y - lado / 2 + Math.random() * lado;
      const ang = Math.random() * Math.PI * 2, giro = (Math.random() - 0.5) * 0.25, np = 25 + Math.floor(Math.random() * 50);
      const pts = []; let a = ang, x = x0, y = y0;
      for (let k = 0; k < np; k++) { pts.push([x, y, 0.5]); a += giro + (Math.random() - 0.5) * 0.3; x += Math.cos(a) * 4; y += Math.sin(a) * 4; }
      const grosor = 2 + Math.random() * 2;
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, { ...cajaDeTrazo(pts, grosor), z: ++z, datos: { puntos: pts, color: BORDES[i % BORDES.length], grosor, opacidad: 1, herramienta: 'lapiz', variable: i % 3 === 0 } });
      cambios.push({ id: el.id, antes: null, despues: el });
    }
    this.escena.ejecutar(cambios, 'generar');
    this.encuadrarTodo();
  }

  borrarTodo() { this.seleccionarTodo(); this.eliminarSeleccion(); }

  _puntoEnCentroDial(mundo) {
    if (!this.instrumentoPrecision?.activo) return false;
    const inst = this.instrumentoPrecision;
    const local = mundoALocal(inst, mundo);
    if (inst.tipo === TIPOS_INSTRUMENTO.REGLA) {
      const cx = inst.longitud / 2;
      const cy = inst.ancho / 2;
      return Math.hypot(local.x - cx, local.y - cy) <= 32;
    }
    if (inst.tipo === TIPOS_INSTRUMENTO.ESCUADRA) {
      const cx = inst.catetoA / 3;
      const cy = inst.catetoB / 3;
      return Math.hypot(local.x - cx, local.y - cy) <= 34;
    }
    if (inst.tipo === TIPOS_INSTRUMENTO.TRANSPORTADOR) {
      return Math.hypot(local.x, local.y) <= 30;
    }
    return false;
  }

  _puntoCercaInstrumento(mundo, margen = 10) {
    if (!this.instrumentoPrecision?.activo) return false;
    const inst = this.instrumentoPrecision;
    const local = mundoALocal(inst, mundo);
    if (inst.tipo === TIPOS_INSTRUMENTO.REGLA) {
      return (
        local.x >= -margen &&
        local.x <= inst.longitud + margen &&
        local.y >= -margen &&
        local.y <= inst.ancho + margen
      );
    }
    if (inst.tipo === TIPOS_INSTRUMENTO.ESCUADRA) {
      if (local.x < -margen || local.y < -margen) return false;
      const val = local.x / inst.catetoA + local.y / inst.catetoB;
      return val <= 1 + margen / Math.min(inst.catetoA, inst.catetoB);
    }
    if (inst.tipo === TIPOS_INSTRUMENTO.TRANSPORTADOR) {
      const dist = Math.hypot(local.x, local.y);
      return dist <= inst.radio + margen && local.y <= margen && local.y >= -inst.radio - margen;
    }
    return false;
  }

  activarInstrumento(tipo, opciones = {}) {
    const centro = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    if (tipo === TIPOS_INSTRUMENTO.REGLA) {
      this.instrumentoPrecision = crearRegla({
        x: centro.x - 200,
        y: centro.y - 35,
        angulo: opciones.angulo ?? 0,
        ...opciones,
      });
    } else if (tipo === TIPOS_INSTRUMENTO.ESCUADRA) {
      this.instrumentoPrecision = crearEscuadra({
        x: centro.x - 100,
        y: centro.y - 100,
        angulo: opciones.angulo ?? 0,
        ...opciones,
      });
    } else if (tipo === TIPOS_INSTRUMENTO.TRANSPORTADOR) {
      this.instrumentoPrecision = crearTransportador({
        x: centro.x,
        y: centro.y,
        angulo: opciones.angulo ?? 0,
        ...opciones,
      });
    } else {
      this.instrumentoPrecision = null;
    }
    this._notificar();
    this.pedirDibujo();
  }

  desactivarInstrumento() {
    if (this.instrumentoPrecision) {
      this.instrumentoPrecision.activo = false;
      this.instrumentoPrecision = null;
      this._notificar();
      this.pedirDibujo();
    }
  }

  rotarInstrumento(anguloRad) {
    if (this.instrumentoPrecision) {
      this.instrumentoPrecision.angulo = anguloRad;
      this._notificar();
      this.pedirDibujo();
    }
  }

  moverInstrumento(dx, dy) {
    if (this.instrumentoPrecision) {
      this.instrumentoPrecision.x += dx;
      this.instrumentoPrecision.y += dy;
      this._notificar();
      this.pedirDibujo();
    }
  }

  toggleCorreccionFormas() {
    this.correccionFormasActiva = !this.correccionFormasActiva;
    this._notificar();
    return this.correccionFormasActiva;
  }

  setCorreccionFormas(activa) {
    this.correccionFormasActiva = !!activa;
    this._notificar();
  }

  obtenerMetricasLatencia() {
    const calcProm = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const promSinSnap = calcProm(this._muestrasLatenciaSinSnap || []);
    const promConSnap = calcProm(this._muestrasLatenciaConSnap || []);
    return {
      latenciaSinSnapMs: Number(promSinSnap.toFixed(3)),
      latenciaConSnapMs: Number(promConSnap.toFixed(3)),
      sobrecostoSnapMs: Number(Math.max(0, promConSnap).toFixed(3)),
      muestrasSinSnap: (this._muestrasLatenciaSinSnap || []).length,
      muestrasConSnap: (this._muestrasLatenciaConSnap || []).length,
    };
  }
}
