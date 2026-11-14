// Almacenamiento de blobs e imágenes (Etapa 11).
// Guarda datos binarios (imágenes, fotos, diagramas) en el almacén 'blobs' de IndexedDB.
import { pedido, transaccion } from './db.js';
import { nuevoId } from './modelo.js';

export async function guardarBlob(blobOBuffer, { id = null, tipo = '', nombre = '' } = {}) {
  const blobId = id || nuevoId();
  const ahora = Date.now();
  const mime = tipo || (blobOBuffer && blobOBuffer.type) || 'application/octet-stream';
  const nombreLimpio = nombre || 'imagen';
  const tamano = blobOBuffer ? (blobOBuffer.size ?? blobOBuffer.byteLength ?? 0) : 0;

  const registro = {
    id: blobId,
    blob: blobOBuffer,
    tipo: mime,
    nombre: nombreLimpio,
    tamano,
    creado: ahora,
  };

  await transaccion(['blobs'], 'readwrite', (tx) => {
    tx.objectStore('blobs').put(registro);
  });

  return registro;
}

export async function obtenerBlob(id) {
  if (!id) return null;
  return transaccion(['blobs'], 'readonly', (tx) => pedido(tx.objectStore('blobs').get(id)));
}

export async function borrarBlob(id) {
  if (!id) return;
  return transaccion(['blobs'], 'readwrite', (tx) => {
    tx.objectStore('blobs').delete(id);
  });
}

export async function listarBlobs() {
  return transaccion(['blobs'], 'readonly', (tx) => pedido(tx.objectStore('blobs').getAll()));
}

// Elimina blobs que ya no están referenciados. Se usa al iniciar, cuando el historial anterior ya no existe.
export function purgarBlobsSinReferencia() {
  return transaccion(['elementos', 'blobs', 'documentos'], 'readwrite', async (tx) => {
    const [elementos, blobs, documentos] = await Promise.all([
      pedido(tx.objectStore('elementos').getAll()),
      pedido(tx.objectStore('blobs').getAll()),
      pedido(tx.objectStore('documentos').getAll()),
    ]);
    const usados = new Set(elementos.filter((el) => el.tipo === 'imagen' && el.datos?.blobId).map((el) => el.datos.blobId));
    for (const doc of documentos) {
      if (doc?.pdfBlobId) usados.add(doc.pdfBlobId);
      if (doc?.config?.pdfBlobId) usados.add(doc.config.pdfBlobId);
    }
    let eliminados = 0;
    for (const blob of blobs) if (!usados.has(blob.id)) { tx.objectStore('blobs').delete(blob.id); eliminados++; }
    return eliminados;
  });
}
