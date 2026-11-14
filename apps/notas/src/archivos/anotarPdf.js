// Importación y preparación de documentos PDF para anotación manuscrita (Etapa 19 · Paso 2).
// Valida integridad, contraseñas, dimensiones reales de página y persiste el PDF original
// una sola vez en el almacén de blobs.

import * as pdfjsLib from 'pdfjs-dist';
import { guardarBlob } from '../almacen/blobs.js';
import { FORMATOS, crearDocumento } from '../almacen/modelo.js';
import { guardarDocumento } from '../almacen/documentos.js';
import { normalizarPaginasConfig } from '../formatos/paginas.js';

// Asignar worker local empaquetado para funcionamiento sin conexión
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  } catch {}
}

export const UMBRAL_AVISO_TAMANO_MB = 50;
export const LIMITE_MAXIMO_PDF_MB = 100;

/**
 * Valida un archivo PDF, comprueba daños o contraseñas y extrae
 * las dimensiones reales de cada página.
 */
export async function validarYAbrirPdf(bufferOArchivo) {
  let arrayBuffer;
  let nombreArchivo = 'documento.pdf';
  let tamanoBytes = 0;

  if (bufferOArchivo instanceof Blob || (typeof File !== 'undefined' && bufferOArchivo instanceof File)) {
    nombreArchivo = bufferOArchivo.name || 'documento.pdf';
    tamanoBytes = bufferOArchivo.size;
    arrayBuffer = await bufferOArchivo.arrayBuffer();
  } else if (bufferOArchivo && typeof bufferOArchivo.arrayBuffer === 'function') {
    nombreArchivo = bufferOArchivo.name || 'documento.pdf';
    arrayBuffer = await bufferOArchivo.arrayBuffer();
    tamanoBytes = bufferOArchivo.size ?? arrayBuffer.byteLength;
  } else if (bufferOArchivo instanceof ArrayBuffer) {
    arrayBuffer = bufferOArchivo;
    tamanoBytes = bufferOArchivo.byteLength;
  } else if (bufferOArchivo?.buffer instanceof ArrayBuffer) {
    arrayBuffer = bufferOArchivo.buffer;
    tamanoBytes = arrayBuffer.byteLength;
  } else {
    throw new Error('Formato de archivo no reconocido.');
  }

  const tamanoMb = tamanoBytes / (1024 * 1024);
  if (tamanoMb > LIMITE_MAXIMO_PDF_MB) {
    throw new Error(
      `El archivo PDF pesa ${tamanoMb.toFixed(1)} MB, lo que supera el límite máximo permitido de ${LIMITE_MAXIMO_PDF_MB} MB.`
    );
  }

  // Comprobar cabecera mínima de PDF (%PDF-)
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new Error('El archivo seleccionado no es un documento PDF válido o está dañado.');
  }

  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      cMapPacked: true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new Error('El documento PDF está protegido con contraseña. Desbloquéelo antes de importarlo para anotar.');
    }
    if (err?.name === 'InvalidPDFException') {
      throw new Error('El archivo PDF está dañado y no se puede leer.');
    }
    throw new Error('No se pudo abrir el PDF: ' + (err?.message || 'Error de lectura'));
  }

  const numPaginas = pdfDoc.numPages;
  if (!numPaginas || numPaginas < 1) {
    throw new Error('El documento PDF no contiene páginas legibles.');
  }

  // Extraer las dimensiones reales de cada página
  // Para 100 páginas esto toma menos de 15ms
  const dimensionesPaginas = [];
  for (let i = 1; i <= numPaginas; i++) {
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({ scale: 1.0 });
    dimensionesPaginas.push({
      numero: i,
      ancho: Math.round(vp.width),
      alto: Math.round(vp.height),
    });
  }

  return {
    pdfDoc,
    numPaginas,
    dimensionesPaginas,
    arrayBuffer,
    tamanoBytes,
    tamanoMb,
    nombreArchivo,
    superaUmbralAviso: tamanoMb > UMBRAL_AVISO_TAMANO_MB,
  };
}

/**
 * Crea un documento de notas a partir de un archivo PDF.
 * Almacena el PDF UNA sola vez en blobs y genera las páginas referenciándolo.
 */
export async function crearDocumentoDePdf(archivoOBlob, { carpetaId = null, tituloPersonalizado = '' } = {}) {
  const datosPdf = await validarYAbrirPdf(archivoOBlob);
  const { numPaginas, dimensionesPaginas, arrayBuffer, nombreArchivo, tamanoBytes, tamanoMb, superaUmbralAviso } = datosPdf;

  // Guardar el PDF original en el almacén de blobs una sola vez
  const blobAGuardar = archivoOBlob instanceof Blob
    ? archivoOBlob
    : new Blob([arrayBuffer.slice(0)], { type: 'application/pdf' });
  const registroBlob = await guardarBlob(blobAGuardar, {
    tipo: 'application/pdf',
    nombre: nombreArchivo,
  });

  const tituloLimpio = (tituloPersonalizado || nombreArchivo)
    .replace(/\.pdf$/i, '')
    .trim() || 'Documento PDF';

  const configPaginas = normalizarPaginasConfig({
    cantidadPaginas: numPaginas,
    paginaActiva: 1,
    esAnotacionPdf: true,
    pdfBlobId: registroBlob.id,
    pdfNombre: nombreArchivo,
    pdfTamanoBytes: tamanoBytes,
    dimensionesPaginas,
  });

  const nuevoDoc = crearDocumento({
    titulo: tituloLimpio,
    formato: FORMATOS.PAGINAS,
    carpetaId,
    config: configPaginas,
    estiloRenglones: 'liso', // los renglones se verían encima del texto del PDF
  });

  // Guardar el pdfBlobId también a nivel de raíz del documento para consultas directas
  nuevoDoc.pdfBlobId = registroBlob.id;

  await guardarDocumento(nuevoDoc);

  return {
    doc: nuevoDoc,
    numPaginas,
    pdfBlobId: registroBlob.id,
    tamanoMb,
    superaUmbralAviso,
  };
}
