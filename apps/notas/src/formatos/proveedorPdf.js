// Proveedor virtualizado de páginas de PDF para el motor del lienzo (Etapa 19 · Paso 2).
// Renderiza páginas bajo demanda con PDF.js, gestiona memoria de texturas (evicción agresiva
// con canvas.width = 0 para Safari/iPad) y nivel de detalle adaptativo.

import * as pdfjsLib from 'pdfjs-dist';
import { obtenerBlob } from '../almacen/blobs.js';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  } catch {}
}

export class ProveedorPdfDocumento {
  constructor(pdfBlobId, opciones = {}) {
    this.pdfBlobId = pdfBlobId;
    this.maxCanvases = opciones.maxCanvases || 5; // Seguridad para iPad / Safari
    this.pdfDoc = null;
    this.cargandoPromesa = null;
    this.destruido = false;

    // Cache de canvases: numPagina -> { canvas, dpr, zoom, renderTask, ultimaUbicacion }
    this.cacheCanvases = new Map();
    // Cache ligera de miniaturas para la barra lateral
    this.cacheMiniaturas = new Map();
    // Tareas de renderizado activas
    this.tareasActivas = new Map();
  }

  async inicializar() {
    if (this.pdfDoc) return this.pdfDoc;
    if (this.cargandoPromesa) return this.cargandoPromesa;

    this.cargandoPromesa = (async () => {
      const registro = await obtenerBlob(this.pdfBlobId);
      if (!registro || !registro.blob) {
        throw new Error('No se encontró el archivo PDF original en el almacenamiento.');
      }

      let arrayBuffer;
      if (typeof registro.blob.arrayBuffer === 'function') {
        arrayBuffer = await registro.blob.arrayBuffer();
      } else if (registro.blob instanceof ArrayBuffer) {
        arrayBuffer = registro.blob;
      } else if (registro.blob?.buffer instanceof ArrayBuffer) {
        arrayBuffer = registro.blob.buffer;
      } else {
        throw new Error('Formato de blob de PDF inválido.');
      }

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapPacked: true,
      });

      this.pdfDoc = await loadingTask.promise;
      return this.pdfDoc;
    })();

    return this.cargandoPromesa;
  }

  /**
   * Obtiene el canvas renderizado para una página específica al nivel de zoom actual.
   * Si no está en memoria, programa el renderizado en el worker y llama a alListo() al completar.
   */
  obtenerCanvasPagina(numPagina, zoom = 1.0, alListo = null) {
    if (this.destruido) return null;

    const dprDispositivo = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    // LOD adaptativo
    let factorDpr = dprDispositivo;
    if (zoom <= 0.6) {
      factorDpr = Math.min(0.8, dprDispositivo);
    } else if (zoom < 1.2) {
      factorDpr = Math.min(1.2, dprDispositivo);
    } else {
      factorDpr = Math.min(2.0, dprDispositivo);
    }

    const entrada = this.cacheCanvases.get(numPagina);
    if (entrada && entrada.canvas) {
      entrada.ultimoAcceso = Date.now();
      // Si la resolución actual es suficientemente cercana, reutilizar
      if (Math.abs(entrada.factorDpr - factorDpr) < 0.35) {
        return entrada.canvas;
      }
    }

    // Si ya se está renderizando para esta página, esperar
    if (this.tareasActivas.has(numPagina)) {
      return entrada?.canvas || null;
    }

    // Encolar renderizado asíncrono
    this.programarRenderizado(numPagina, zoom, factorDpr, alListo);

    return entrada?.canvas || null;
  }

  async programarRenderizado(numPagina, zoom, factorDpr, alListo) {
    try {
      const doc = await this.inicializar();
      if (this.destruido) return;

      const page = await doc.getPage(numPagina);
      if (this.destruido) return;

      const viewportLogico = page.getViewport({ scale: 1.0 });
      const viewportFisico = page.getViewport({ scale: factorDpr });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewportFisico.width);
      canvas.height = Math.round(viewportFisico.height);

      const ctx = canvas.getContext('2d', { alpha: false });
      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewportFisico,
      });

      this.tareasActivas.set(numPagina, renderTask);
      await renderTask.promise;
      this.tareasActivas.delete(numPagina);

      if (this.destruido) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }

      // Evicción por cuota de memoria (protección iPad / Safari)
      this.evictarSiExcedeCuota();

      // Guardar en cache
      this.cacheCanvases.set(numPagina, {
        canvas,
        ancho: viewportLogico.width,
        alto: viewportLogico.height,
        factorDpr,
        ultimoAcceso: Date.now(),
      });

      if (alListo) {
        alListo(canvas, numPagina);
      }
    } catch (err) {
      this.tareasActivas.delete(numPagina);
      if (err?.name !== 'RenderingCancelledException') {
        console.warn(`[ProveedorPdf] Error renderizando página ${numPagina}:`, err);
      }
    }
  }

  /**
   * Genera o devuelve una miniatura ligera para la barra lateral.
   */
  async obtenerMiniatura(numPagina, anchoPx = 100) {
    if (this.cacheMiniaturas.has(numPagina)) {
      return this.cacheMiniaturas.get(numPagina);
    }

    try {
      const doc = await this.inicializar();
      const page = await doc.getPage(numPagina);
      const vpBase = page.getViewport({ scale: 1.0 });
      const escalaMiniatura = anchoPx / vpBase.width;
      const vpMini = page.getViewport({ scale: escalaMiniatura });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vpMini.width);
      canvas.height = Math.round(vpMini.height);

      const ctx = canvas.getContext('2d', { alpha: false });
      await page.render({
        canvasContext: ctx,
        viewport: vpMini,
      }).promise;

      this.cacheMiniaturas.set(numPagina, canvas);
      return canvas;
    } catch {
      return null;
    }
  }

  /**
   * Libera canvases más antiguos cuando se supera la cuota máxima.
   * Obligatorio canvas.width = 0 para forzar la liberación de memoria de textura en WebKit.
   */
  evictarSiExcedeCuota() {
    if (this.cacheCanvases.size < this.maxCanvases) return;

    // Ordenar por último acceso (LRU)
    const entradas = Array.from(this.cacheCanvases.entries()).sort(
      (a, b) => a[1].ultimoAcceso - b[1].ultimoAcceso
    );

    const aEliminar = entradas.slice(0, this.cacheCanvases.size - this.maxCanvases + 1);
    for (const [num, entrada] of aEliminar) {
      if (entrada.canvas) {
        entrada.canvas.width = 0;
        entrada.canvas.height = 0;
      }
      this.cacheCanvases.delete(num);
    }
  }

  destruir() {
    this.destruido = true;

    // Cancelar tareas activas
    for (const [, task] of this.tareasActivas) {
      try {
        task.cancel();
      } catch {}
    }
    this.tareasActivas.clear();

    // Destruir texturas de GPU
    for (const [, entrada] of this.cacheCanvases) {
      if (entrada.canvas) {
        entrada.canvas.width = 0;
        entrada.canvas.height = 0;
      }
    }
    this.cacheCanvases.clear();

    for (const [, canvas] of this.cacheMiniaturas) {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    this.cacheMiniaturas.clear();

    this.pdfDoc = null;
  }
}
