// Exportación a PDF descargable en cliente usando jsPDF (Etapa 18C · Parte 2).
// Compatible con los tres formatos: Páginas A4, Pizarrón y Tarjetas.
// Soporta alcance (todo / actual / selección), renglones, encabezado/pie,
// progreso de renderizado y compartir directamente en iPad / tablet o descarga.

import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

// Sin worker, PDF.js no puede renderizar el fondo del PDF original y la exportación sale solo con las anotaciones.
// Se configura aquí también (no solo al abrir un PDF) porque este módulo puede usarse sin pasar antes por el visor.
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  } catch { /* entorno sin URL de módulo */ }
}
import { obtenerBlob } from '../almacen/blobs.js';
import { dibujar } from '../lienzo/dibujo.js';
import { Escena } from '../lienzo/escena.js';
import { prepararImagenes } from '../herramientas/imagenes/recursos.js';
import { descargarBlob, guardarCopiaEnPrograma, intentarCompartirArchivo, nombreArchivoSeguro } from './exportar.js';
import { esProgramaEscritorio } from '../pwa/escritorio.js';
import {
  ALTO_A4,
  ANCHO_A4,
  MARGENES_A4,
  formatearTextoGuiaPagina,
  marcoDePagina,
} from '../formatos/paginas.js';
import { encuadrar } from '../lienzo/camara.js';
import { unirRects } from '../lienzo/geometria.js';
import { elementosDeTarjeta } from '../formatos/tarjetas.js';

// Medidas estándar A4 en milímetros
export const A4_ANCHO_MM = 210;
export const A4_ALTO_MM = 297;

/**
 * Genera un PDF binario (Blob) a partir del documento actual.
 */
export async function generarPdfDocumento({
  tipoFormato = 'paginas',
  doc,
  motor,
  alcance = 'todo',
  paginaActiva = 1,
  tarjetaActiva = null,
  tarjetas = [],
  medidasTarjeta: medidasTarjetaConfig = null,
  cantidadPaginas = 1,
  conRenglones = false,
  factor = 2,
  calidad = 0.92,
  alProgreso = null,
}) {
  const escena = motor?.escena;
  const listaCompleta = escena ? escena.lista() : [];
  const recursosImagen = await prepararImagenes(listaCompleta);

  try {
    if (tipoFormato === 'paginas') {
      return await exportarPaginasA4Pdf({
        doc,
        motor,
        escena,
        listaCompleta,
        alcance,
        paginaActiva,
        cantidadPaginas,
        conRenglones,
        factor,
        calidad,
        alProgreso,
      });
    }

    if (tipoFormato === 'pizarron') {
      return await exportarPizarronPdf({
        doc,
        motor,
        escena,
        listaCompleta,
        alcance,
        conRenglones,
        factor,
        calidad,
        alProgreso,
      });
    }

    if (tipoFormato === 'tarjetas') {
      return await exportarTarjetasPdf({
        doc,
        motor,
        escena,
        listaCompleta,
        alcance,
        tarjetaActiva,
        tarjetas,
        medidasTarjetaConfig,
        conRenglones,
        factor,
        calidad,
        alProgreso,
      });
    }

    throw new Error(`Formato de documento desconocido: ${tipoFormato}`);
  } finally {
    recursosImagen.liberar();
  }
}

/**
 * Exporta un documento de hojas A4 a PDF
 */
async function exportarPaginasA4Pdf({
  doc,
  escena,
  listaCompleta,
  alcance,
  paginaActiva,
  cantidadPaginas,
  conRenglones,
  factor,
  calidad,
  alProgreso,
}) {
  const totalDoc = Math.max(1, cantidadPaginas || 1);
  const listaPaginas = alcance === 'actual'
    ? [Math.max(1, Math.min(totalDoc, paginaActiva || 1))]
    : Array.from({ length: totalDoc }, (_, i) => i + 1);

  const cfg = doc.config || {};
  const encCfg = cfg.encabezado;
  const pieCfg = cfg.pie;

  // Cargar documento PDF original si se trata de un documento de anotación
  const pdfBlobId = doc?.pdfBlobId || cfg?.pdfBlobId;
  let pdfOriginalDoc = null;
  if (pdfBlobId) {
    try {
      const reg = await obtenerBlob(pdfBlobId);
      if (reg?.blob) {
        let buf;
        if (typeof reg.blob.arrayBuffer === 'function') buf = await reg.blob.arrayBuffer();
        else if (reg.blob instanceof ArrayBuffer) buf = reg.blob;
        else if (reg.blob?.buffer instanceof ArrayBuffer) buf = reg.blob.buffer;
        if (buf) {
          const loading = pdfjsLib.getDocument({ data: new Uint8Array(buf), cMapPacked: true });
          pdfOriginalDoc = await loading.promise;
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar el PDF de fondo para exportación:', e);
    }
  }

  // Inicializar documento PDF de salida
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < listaPaginas.length; i++) {
    const numHoja = listaPaginas[i];
    alProgreso?.(i + 1, listaPaginas.length, `Renderizando página ${numHoja}…`);

    const marco = marcoDePagina(numHoja, cfg);
    const anchoHojaPx = Math.round(marco.ancho * factor);
    const altoHojaPx = Math.round(marco.alto * factor);

    const cv = document.createElement('canvas');
    cv.width = anchoHojaPx;
    cv.height = altoHojaPx;
    const ctx = cv.getContext('2d');
    if (!ctx) continue;

    // Limpiar canvas con fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, anchoHojaPx, altoHojaPx);

    // El fondo del PDF original se renderiza en la hoja. Debe pasar por `dibujar` (alPedirFondoMarco): ahí se
    // pinta después del relleno blanco de la hoja. Renderizarlo antes, sobre el canvas vacío, hacía que el
    // relleno lo tapara y el PDF exportado salía sin su texto.
    let fondoPdf = null;
    if (pdfOriginalDoc && numHoja <= pdfOriginalDoc.numPages) {
      try {
        const pagPdf = await pdfOriginalDoc.getPage(numHoja);
        const vpBase = pagPdf.getViewport({ scale: 1.0 });
        const escalaFondo = (marco.ancho / vpBase.width) * factor;
        const vp = pagPdf.getViewport({ scale: escalaFondo });
        fondoPdf = document.createElement('canvas');
        fondoPdf.width = anchoHojaPx;
        fondoPdf.height = altoHojaPx;
        const fctx = fondoPdf.getContext('2d');
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, 0, anchoHojaPx, altoHojaPx);
        await pagPdf.render({ canvasContext: fctx, viewport: vp }).promise;
      } catch (err) {
        console.warn(`Error renderizando fondo PDF para pág ${numHoja}:`, err);
        fondoPdf = null;
      }
    }

    // Dibujar la hoja (con su fondo de PDF, si lo hay) y sus anotaciones
    dibujar(ctx, {
      alPedirFondoMarco: fondoPdf ? () => fondoPdf : null,
      camara: { x: 0, y: marco.y, zoom: 1 },
      ancho: marco.ancho,
      alto: marco.alto,
      dpr: factor,
      lista: listaCompleta,
      escena,
      seleccion: new Set(),
      marco: null,
      mostrarManijas: null,
      renglones: conRenglones ? { cfg: doc.renglones, opacidad: 1 } : null,
      guiaTexto: doc.renglones,
      marcoDocumento: { x: 0, y: marco.y, ancho: marco.ancho, alto: marco.alto, fondo: marco.fondo },
      contenedor: numHoja,
    });

    // Encabezado y pie opcionales
    const textoEnc = formatearTextoGuiaPagina(encCfg, numHoja, totalDoc);
    const mIzq = (cfg?.margenes?.izquierdo ?? MARGENES_A4?.izquierdo ?? 40);
    if (textoEnc) {
      ctx.save();
      ctx.font = `${Math.round(11 * factor)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.textBaseline = 'top';
      const xMargen = mIzq * factor;
      ctx.fillText(textoEnc, xMargen, 14 * factor);
      ctx.restore();
    }

    const textoPie = formatearTextoGuiaPagina(pieCfg, numHoja, totalDoc);
    if (textoPie) {
      ctx.save();
      ctx.font = `${Math.round(11 * factor)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.textBaseline = 'bottom';
      const xMargen = mIzq * factor;
      ctx.fillText(textoPie, xMargen, altoHojaPx - 14 * factor);
      ctx.restore();
    }

    // Incrustar en el documento PDF con dimensiones reales de la hoja
    // Las hojas del editor se miden en píxeles CSS (96 por pulgada): 794 px = 210 mm.
    const anchoMm = (marco.ancho * 25.4) / 96;
    const altoMm = (marco.alto * 25.4) / 96;
    const dataUrl = cv.toDataURL('image/jpeg', calidad);

    if (i === 0) {
      pdf.deletePage(1);
      pdf.addPage([anchoMm, altoMm], anchoMm > altoMm ? 'landscape' : 'portrait');
    } else {
      pdf.addPage([anchoMm, altoMm], anchoMm > altoMm ? 'landscape' : 'portrait');
    }
    pdf.addImage(dataUrl, 'JPEG', 0, 0, anchoMm, altoMm, undefined, 'FAST');

    // Liberar memoria gráfica del canvas de inmediato
    cv.width = 0;
    cv.height = 0;
  }

  if (pdfOriginalDoc?.destroy) {
    try {
      await pdfOriginalDoc.destroy();
    } catch (_) {}
  }

  return pdf.output('blob');
}

/**
 * Exporta un pizarrón infinito a PDF
 */
async function exportarPizarronPdf({
  doc,
  motor,
  escena,
  listaCompleta,
  alcance,
  conRenglones,
  factor,
  calidad,
  alProgreso,
}) {
  alProgreso?.(1, 1, 'Calculando encuadre del pizarrón…');

  let elementos = listaCompleta;
  let caja = null;

  if (alcance === 'seleccion') {
    const selIds = motor?.seleccion ? [...motor.seleccion] : [];
    elementos = listaCompleta.filter((e) => selIds.includes(e.id));
    caja = unirRects(elementos);
  } else if (alcance === 'vista' && motor?.camara) {
    const cam = motor.camara;
    const an = motor.ancho / cam.zoom;
    const al = motor.alto / cam.zoom;
    caja = { x: cam.x, y: cam.y, ancho: an, alto: al };
  } else {
    // Todo el pizarrón
    const lim = escena.limites(listaCompleta);
    if (lim) {
      caja = {
        x: lim.minX,
        y: lim.minY,
        ancho: lim.maxX - lim.minX,
        alto: lim.maxY - lim.minY,
      };
    }
  }

  if (!caja || caja.ancho <= 0 || caja.alto <= 0) {
    caja = { x: -400, y: -300, ancho: 800, alto: 600 };
  }

  // Si el contenido es más apaisado que alto, usamos orientación horizontal
  const esApaisado = caja.ancho > caja.alto;
  const orientacion = esApaisado ? 'landscape' : 'portrait';
  const anchoMm = esApaisado ? A4_ALTO_MM : A4_ANCHO_MM;
  const altoMm = esApaisado ? A4_ANCHO_MM : A4_ALTO_MM;

  const pdf = new jsPDF({
    orientation: orientacion,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const anchoRefPx = esApaisado ? ALTO_A4 : ANCHO_A4;
  const altoRefPx = esApaisado ? ANCHO_A4 : ALTO_A4;

  const cv = document.createElement('canvas');
  cv.width = Math.round(anchoRefPx * factor);
  cv.height = Math.round(altoRefPx * factor);
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D para el pizarrón.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);

  const camEncuadre = encuadrar(caja, anchoRefPx, altoRefPx, 30, 2);

  alProgreso?.(1, 1, 'Renderizando pizarrón…');

  const escenaTemp = new Escena(elementos);
  dibujar(ctx, {
    camara: camEncuadre,
    ancho: anchoRefPx,
    alto: altoRefPx,
    dpr: factor,
    lista: elementos,
    escena: escenaTemp,
    seleccion: new Set(),
    marco: null,
    mostrarManijas: null,
    renglones: conRenglones ? { cfg: doc.renglones, opacidad: 1 } : null,
    guiaTexto: doc.renglones,
    marcoDocumento: null,
    fondoDocumento: doc?.config?.fondo || motor?.fondoDocumento || null,
  });

  const dataUrl = cv.toDataURL('image/jpeg', calidad);
  pdf.addImage(dataUrl, 'JPEG', 0, 0, anchoMm, altoMm, undefined, 'FAST');

  cv.width = 1;
  cv.height = 1;
  return pdf.output('blob');
}

/**
 * Exporta tarjetas a PDF (una por página o tarjeta activa)
 */
async function exportarTarjetasPdf({
  doc,
  motor,
  listaCompleta,
  alcance,
  tarjetaActiva,
  tarjetas,
  medidasTarjetaConfig,
  conRenglones,
  factor,
  calidad,
  alProgreso,
}) {
  const listaTarjetas = (alcance === 'actual' && tarjetaActiva)
    ? [tarjetaActiva]
    : (tarjetas && tarjetas.length ? tarjetas : (tarjetaActiva ? [tarjetaActiva] : []));

  if (!listaTarjetas.length) {
    throw new Error('No hay tarjetas disponibles para exportar.');
  }

  const med = medidasTarjetaConfig || { ancho: 800, alto: 500, ratio: 1.6 };
  // Dimensiones de la tarjeta en milímetros (proporción 160 × 100 mm estándar de ficha)
  const anchoMm = 160;
  const altoMm = Math.round((anchoMm / (med.ancho / med.alto)) * 10) / 10;
  const orientacion = anchoMm >= altoMm ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation: orientacion,
    unit: 'mm',
    format: [anchoMm, altoMm],
    compress: true,
  });

  const anchoPx = Math.round(med.ancho * factor);
  const altoPx = Math.round(med.alto * factor);

  const cv = document.createElement('canvas');
  cv.width = anchoPx;
  cv.height = altoPx;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D para tarjetas.');

  for (let i = 0; i < listaTarjetas.length; i++) {
    const t = listaTarjetas[i];
    alProgreso?.(i + 1, listaTarjetas.length, `Renderizando tarjeta "${t.titulo || `Tarjeta ${i + 1}`}"…`);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, anchoPx, altoPx);

    const esActiva = tarjetaActiva && t.id === tarjetaActiva.id && motor;
    const escenaAUsar = esActiva
      ? motor.escena
      : new Escena(elementosDeTarjeta(listaCompleta, t.id));
    const lista = escenaAUsar.lista();

    dibujar(ctx, {
      camara: { x: 0, y: 0, zoom: 1 },
      ancho: med.ancho,
      alto: med.alto,
      dpr: factor,
      lista,
      escena: escenaAUsar,
      seleccion: new Set(),
      marco: null,
      mostrarManijas: null,
      renglones: conRenglones ? { cfg: doc.renglones, opacidad: 1 } : null,
      guiaTexto: doc.renglones,
      marcoDocumento: { x: 0, y: 0, ancho: med.ancho, alto: med.alto, fondo: t.fondo || doc?.config?.fondo || null },
      contenedor: t.id,
    });

    const dataUrl = cv.toDataURL('image/jpeg', calidad);
    if (i > 0) {
      pdf.addPage([anchoMm, altoMm], orientacion);
    }
    pdf.addImage(dataUrl, 'JPEG', 0, 0, anchoMm, altoMm, undefined, 'FAST');
  }

  cv.width = 1;
  cv.height = 1;
  return pdf.output('blob');
}

/**
 * Descarga o comparte el archivo PDF usando navigator.share en tablet/móvil o descarga directa
 */
export async function descargarOCompartirPdf(blob, { titulo = 'Documento', sufijo = '' }) {
  const nombreBase = nombreArchivoSeguro(titulo, 'pdf');
  const nombreFinal = sufijo ? nombreBase.replace('.pdf', `_${sufijo}.pdf`) : nombreBase;

  if (esProgramaEscritorio()) {
    await guardarCopiaEnPrograma(blob, nombreFinal);
    return;
  }

  const resultado = await intentarCompartirArchivo(blob, nombreFinal, titulo);
  if (resultado !== 'compartido' && resultado !== 'cancelado') {
    descargarBlob(blob, nombreFinal);
  }
}
