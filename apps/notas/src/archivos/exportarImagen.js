// Exportación a imagen PNG / JPG (Etapa 18C · Parte 1).
// Permite exportar todo el pizarrón, una página A4, una tarjeta o la selección
// con escalas 1×, 2× o 3×, fondo transparente opcional y renglones.
// Incluye límite de seguridad de memoria para evitar bloqueos en iPads y móviles.

import { dibujar, dibujarFondoEnRect } from '../lienzo/dibujo.js';
import { Escena } from '../lienzo/escena.js';
import { prepararImagenes } from '../herramientas/imagenes/recursos.js';
import { descargarBlob, guardarCopiaEnPrograma, intentarCompartirArchivo, nombreArchivoSeguro } from './exportar.js';
import { esProgramaEscritorio } from '../pwa/escritorio.js';

export const LIMITE_MEGAPIXELES_SEGURO = 25; // 25 MP límite seguro para WebKit / iOS
export const LIMITE_LADO_CANVAS_SEGURO = 16384; // 16K px límite seguro

// Comprueba si las dimensiones a exportar son seguras para la memoria del navegador
export function validarTamanoExportacion(ancho, alto, escala = 1) {
  const an = Math.max(1, Math.round(ancho * escala));
  const al = Math.max(1, Math.round(alto * escala));
  const mp = (an * al) / 1_000_000;

  if (an > LIMITE_LADO_CANVAS_SEGURO || al > LIMITE_LADO_CANVAS_SEGURO) {
    return {
      esSeguro: false,
      anchoPx: an,
      altoPx: al,
      megapixeles: mp,
      error: `La dimensión (${an} × ${al} px) excede el tamaño máximo permitido por el navegador (${LIMITE_LADO_CANVAS_SEGURO} px). Reduzca la escala o exporte una selección menor.`,
    };
  }

  if (mp > LIMITE_MEGAPIXELES_SEGURO) {
    return {
      esSeguro: false,
      anchoPx: an,
      altoPx: al,
      megapixeles: mp,
      error: `El tamaño resultante (${an} × ${al} px, ${mp.toFixed(1)} MP) excede el límite seguro de memoria (${LIMITE_MEGAPIXELES_SEGURO} MP). Reduzca la escala a 1× o 2× para evitar que el navegador se cierre.`,
    };
  }

  return {
    esSeguro: true,
    anchoPx: an,
    altoPx: al,
    megapixeles: mp,
    error: null,
  };
}

// Renderiza los elementos en un canvas independiente y genera el Blob
export async function renderizarImagen({
  elementos = [],
  rect,
  escala = 1,
  formato = 'png', // 'png' | 'jpeg'
  transparente = false,
  renglones = null,
  guiaTexto = null,
  marcoDocumento = null,
  contenedor = null,
  fondoDocumento = null,
}) {
  if (!rect || rect.ancho <= 0 || rect.alto <= 0) {
    throw new Error('El área a exportar está vacía.');
  }

  const validacion = validarTamanoExportacion(rect.ancho, rect.alto, escala);
  if (!validacion.esSeguro) {
    throw new Error(validacion.error);
  }

  const cv = document.createElement('canvas');
  cv.width = validacion.anchoPx;
  cv.height = validacion.altoPx;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D para la exportación.');

  // Fondo
  const esPngTransparente = formato === 'png' && transparente;
  if (!esPngTransparente) {
    if (fondoDocumento && !marcoDocumento) {
      dibujarFondoEnRect(ctx, fondoDocumento, { x: 0, y: 0, ancho: cv.width, alto: cv.height });
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }

  const escenaTemp = new Escena(elementos);
  const recursos = await prepararImagenes(elementos);

  try {
    dibujar(ctx, {
      camara: { x: rect.x, y: rect.y, zoom: escala },
      ancho: validacion.anchoPx,
      alto: validacion.altoPx,
      dpr: 1, // La escala ya se incorporó en el zoom y tamaño del canvas
      lista: elementos,
      escena: escenaTemp,
      seleccion: new Set(),
      marco: null,
      mostrarManijas: null,
      renglones: renglones || null,
      guiaTexto: guiaTexto || null,
      marcoDocumento: marcoDocumento || null,
      contenedor: contenedor || null,
      fondoDocumento: fondoDocumento || null,
    });

    const mime = formato === 'jpeg' ? 'image/jpeg' : 'image/png';
    const calidad = formato === 'jpeg' ? 0.92 : undefined;

    const blob = await new Promise((resolver, rechazar) => {
      cv.toBlob((b) => {
        if (b) resolver(b);
        else rechazar(new Error('No se pudo codificar la imagen.'));
      }, mime, calidad);
    });

    return blob;
  } finally {
    recursos.liberar();
    cv.width = 1;
    cv.height = 1;
  }
}

// Descarga o comparte la imagen usando el mecanismo existente
export async function descargarOCompartirImagen(blob, { titulo = 'Nota', formato = 'png', sufijo = '' }) {
  const ext = formato === 'jpeg' ? 'jpg' : 'png';
  const nombreBase = nombreArchivoSeguro(titulo, ext);
  const nombreFinal = sufijo ? nombreBase.replace(`.${ext}`, `_${sufijo}.${ext}`) : nombreBase;

  if (esProgramaEscritorio()) {
    await guardarCopiaEnPrograma(blob, nombreFinal);
    return;
  }

  const resultado = await intentarCompartirArchivo(blob, nombreFinal, titulo);
  if (resultado !== 'compartido' && resultado !== 'cancelado') {
    descargarBlob(blob, nombreFinal);
  }
}
