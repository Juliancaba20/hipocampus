// Exportación de documentos individuales y colecciones completas (Etapa 12).
// Admite descarga directa y hoja de compartir del sistema (navigator.share) en iPads y móviles.

import { listarElementos, obtenerBlob, listarDocumentos, listarCarpetas, listarExamenes } from '../almacen/index.js';
import { MIME_TIPO_NOTA, arrayBufferABase64, empaquetarDocumento, empaquetarColeccion } from './formato.js';
import { esProgramaEscritorio, esProgramaDeComputadora } from '../pwa/escritorio.js';

// Limpia un nombre para que sea seguro como nombre de archivo en cualquier sistema operativo
export function nombreArchivoSeguro(titulo, extension = 'nota') {
  const base = String(titulo || 'Sin título')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes para compatibilidad de archivo
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'nota';
  return `${base}.${extension}`;
}

// Descarga un Blob mediante un enlace temporal <a>
export function descargarBlob(blob, nombreArchivo) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// En el programa (Windows, Mac, Linux o Android) los archivos que no son .nota (PDF, imágenes) se guardan con la ventana
// «Guardar como» del sistema: la descarga por enlace y la hoja de compartir no están verificadas allí.
// Devuelve { ruta, nombre } o null si la persona cerró la ventana sin elegir dónde guardar.
export async function guardarCopiaEnPrograma(blob, nombreArchivo) {
  const { discoDelPrograma } = await import('./disco.js');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return discoDelPrograma().guardarCopia(bytes, nombreArchivo);
}

// Intenta compartir un archivo mediante navigator.share (hoja nativa en iOS/iPad y Android).
// Devuelve 'compartido', 'cancelado' (la persona cerró la hoja sin guardar nada) o false (no disponible: usar descarga).
export async function intentarCompartirArchivo(blob, nombreArchivo, titulo) {
  // En el programa de escritorio (Windows) no hay hoja de compartir: se descarga el archivo directamente.
  if (esProgramaEscritorio()) return false;
  if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
    try {
      const tipo = blob.type || MIME_TIPO_NOTA;
      const archivo = new File([blob], nombreArchivo, { type: tipo });
      if (navigator.canShare({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: titulo || 'Nota de Anotomía',
        });
        return 'compartido';
      }
    } catch (e) {
      // Si el usuario canceló la hoja de compartir (AbortError), no es un éxito ni un error: no se guardó nada
      if (e.name === 'AbortError') return 'cancelado';
    }
  }
  return false;
}

// Prepara los recursos (blobs a base64) de una lista de elementos y del documento (ej. PDF)
export async function prepararRecursosDeElementos(elementos, doc = null) {
  const imagenes = elementos.filter((e) => e.tipo === 'imagen' && e.datos?.blobId);
  const blobIdsUnicos = [...new Set(imagenes.map((e) => e.datos.blobId))];

  // Si el documento tiene un archivo PDF de fondo, se incluye para exportarlo en el .nota
  const pdfBlobId = doc?.pdfBlobId || doc?.config?.pdfBlobId;
  if (pdfBlobId && !blobIdsUnicos.includes(pdfBlobId)) {
    blobIdsUnicos.push(pdfBlobId);
  }

  const recursos = [];

  for (const bid of blobIdsUnicos) {
    const reg = await obtenerBlob(bid);
    if (!reg || !reg.blob) continue;

    let buffer = null;
    if (typeof reg.blob.arrayBuffer === 'function') {
      buffer = await reg.blob.arrayBuffer();
    } else if (reg.blob instanceof ArrayBuffer) {
      buffer = reg.blob;
    } else if (reg.blob.buffer instanceof ArrayBuffer) {
      buffer = reg.blob.buffer;
    }

    if (buffer) {
      recursos.push({
        id: reg.id,
        tipo: reg.tipo || (bid === pdfBlobId ? 'application/pdf' : 'image/png'),
        nombre: reg.nombre || (bid === pdfBlobId ? 'documento.pdf' : 'imagen'),
        tamano: reg.tamano || buffer.byteLength,
        base64: arrayBufferABase64(buffer),
      });
    }
  }

  return recursos;
}

// Arma los bytes del archivo .nota de un documento leyendo todo desde el almacén (o con los elementos que se le den)
export async function empaquetarDesdeAlmacen(doc, { elementos: elementosProvistos = null } = {}) {
  let elementos = elementosProvistos;
  if (!elementos) {
    try {
      elementos = await listarElementos(doc.id);
    } catch {
      elementos = [];
    }
  }
  const recursos = await prepararRecursosDeElementos(elementos, doc);
  let repasos = [];
  if (doc.formato === 'tarjetas') {
    try {
      const { listarEstadosRepasoDocumento } = await import('../almacen/repeticion.js');
      repasos = await listarEstadosRepasoDocumento(doc.id);
    } catch {
      repasos = [];
    }
  }
  return empaquetarDocumento(doc, elementos, recursos, repasos);
}

// Exporta un único documento en formato .nota.
// En el programa de computadora es «Guardar como»: se elige dónde guardar el archivo y el documento queda
// vinculado a él (desde ese momento cada cambio se escribe también en ese archivo). En Android se elige dónde
// guardar una copia. En un navegador se descarga o se comparte.
export async function exportarDocumento(doc, { elementos: elementosProvistos = null, compartir = true } = {}) {
  const bytes = await empaquetarDesdeAlmacen(doc, { elementos: elementosProvistos });
  const nombreArchivo = nombreArchivoSeguro(doc.titulo, 'nota');

  if (esProgramaEscritorio()) {
    const { discoDelPrograma } = await import('./disco.js');
    const r = await discoDelPrograma().guardarComo(doc, bytes, { vincular: esProgramaDeComputadora() });
    if (!r) return { metodo: 'cancelado', nombreArchivo };
    return { metodo: 'guardado-en-archivo', nombreArchivo: r.nombre, ruta: r.ruta };
  }

  const blob = new Blob([bytes], { type: MIME_TIPO_NOTA });

  const tamanoMb = (blob.size / (1024 * 1024)).toFixed(1);
  const advertenciaTamano = blob.size > 50 * 1024 * 1024
    ? `Atención: El archivo exportado pesa ${tamanoMb} MB.`
    : null;

  if (compartir) {
    const compartido = await intentarCompartirArchivo(blob, nombreArchivo, doc.titulo);
    if (compartido) return { metodo: compartido, nombreArchivo, tamanoMb, advertenciaTamano };
  }

  descargarBlob(blob, nombreArchivo);
  return { metodo: 'descargado', nombreArchivo, tamanoMb, advertenciaTamano };
}

// Exporta todos los documentos activos en un único archivo de copia de respaldo
export async function exportarTodasLasNotas({ compartir = false } = {}) {
  const documentos = await listarDocumentos({ papelera: false });
  const items = [];

  for (const doc of documentos) {
    const elementos = await listarElementos(doc.id);
    const recursos = await prepararRecursosDeElementos(elementos, doc);
    let repasos = [];
    if (doc.formato === 'tarjetas') {
      try {
        const { listarEstadosRepasoDocumento } = await import('../almacen/repeticion.js');
        repasos = await listarEstadosRepasoDocumento(doc.id);
      } catch {
        repasos = [];
      }
    }
    items.push({ documento: doc, elementos, recursos, repasos });
  }

  const carpetas = await listarCarpetas();
  let plantillas = [];
  try {
    const { listarPlantillasPropias } = await import('../plantillas/index.js');
    plantillas = await listarPlantillasPropias();
  } catch {}
  let examenes = [];
  try { examenes = await listarExamenes(); } catch { /* sin exámenes */ }
  const bytes = await empaquetarColeccion(items, carpetas, plantillas, examenes);
  const fechaStr = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Anotomia_Copia_Completa_${fechaStr}.anotomia-respaldo`;

  if (esProgramaEscritorio()) {
    const { discoDelPrograma } = await import('./disco.js');
    const r = await discoDelPrograma().guardarCopia(bytes, nombreArchivo);
    if (!r) return { metodo: 'cancelado', nombreArchivo, cantidad: items.length };
    return { metodo: 'guardado-en-archivo', nombreArchivo: r.nombre, ruta: r.ruta, cantidad: items.length };
  }

  const blob = new Blob([bytes], { type: MIME_TIPO_NOTA });

  const tamanoMb = (blob.size / (1024 * 1024)).toFixed(1);
  const advertenciaTamano = blob.size > 50 * 1024 * 1024
    ? `Atención: La copia de seguridad pesa ${tamanoMb} MB.`
    : null;

  if (compartir) {
    const compartido = await intentarCompartirArchivo(blob, nombreArchivo, 'Copia de seguridad de Anotomía');
    if (compartido) return { metodo: compartido, nombreArchivo, cantidad: items.length, tamanoMb, advertenciaTamano };
  }

  descargarBlob(blob, nombreArchivo);
  return { metodo: 'descargado', nombreArchivo, cantidad: items.length };
}
