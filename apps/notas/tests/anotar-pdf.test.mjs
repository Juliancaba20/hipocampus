import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import 'fake-indexeddb/auto';
import { abrirBD } from '../src/almacen/db.js';
import { obtenerBlob, listarBlobs } from '../src/almacen/blobs.js';
import { obtenerDocumento, duplicarDocumento, borrarDocumentoDefinitivo } from '../src/almacen/documentos.js';
import { crearDocumentoDePdf, validarYAbrirPdf } from '../src/archivos/anotarPdf.js';
import { prepararRecursosDeElementos } from '../src/archivos/exportar.js';
import { generarPdfDocumento } from '../src/archivos/exportarPdf.js';
import { Escena } from '../src/lienzo/escena.js';
import { crearElemento } from '../src/almacen/modelo.js';

function generarPdfMinimo({ numPaginas = 3, ancho = 595, alto = 842 } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: [ancho, alto] });
  for (let i = 1; i <= numPaginas; i++) {
    if (i > 1) doc.addPage([ancho, alto]);
    doc.text(`Página de prueba ${i}`, 40, 60);
  }
  return doc.output('arraybuffer');
}

test('validarYAbrirPdf: rechaza archivos dañados o sin cabecera PDF', async () => {
  const bytesInvalidos = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  await assert.rejects(
    () => validarYAbrirPdf(bytesInvalidos.buffer),
    /no es un documento PDF válido o está dañado/
  );
});

test('validarYAbrirPdf: extrae dimensiones y metadatos de PDF válido', async () => {
  const buffer = generarPdfMinimo({ numPaginas: 4, ancho: 595, alto: 842 });
  const resultado = await validarYAbrirPdf(buffer);

  assert.equal(resultado.numPaginas, 4);
  assert.equal(resultado.dimensionesPaginas.length, 4);
  assert.equal(resultado.dimensionesPaginas[0].ancho, 595);
  assert.equal(resultado.dimensionesPaginas[0].alto, 842);
  assert.equal(resultado.superaUmbralAviso, false);
});

test('crearDocumentoDePdf: persiste el PDF una sola vez y genera la estructura de páginas', async () => {
  await abrirBD();
  const buffer = generarPdfMinimo({ numPaginas: 3 });
  const archivoSimulado = {
    name: 'Anatomia_Cardio.pdf',
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  };

  const { doc, numPaginas, pdfBlobId } = await crearDocumentoDePdf(archivoSimulado);

  assert.equal(numPaginas, 3);
  assert.equal(doc.formato, 'paginas');
  assert.equal(doc.config.cantidadPaginas, 3);
  assert.equal(doc.config.esAnotacionPdf, true);
  assert.equal(doc.config.pdfBlobId, pdfBlobId);
  assert.equal(doc.pdfBlobId, pdfBlobId);

  // Comprobar que el blob se guardó en IndexedDB
  const registroBlob = await obtenerBlob(pdfBlobId);
  assert.ok(registroBlob);
  assert.equal(registroBlob.tipo, 'application/pdf');

  // Duplicar el documento: no debe duplicar el PDF en blobs
  const totalBlobsAntes = (await listarBlobs()).length;
  const copia = await duplicarDocumento(doc.id, 'Copia de Anatomía');
  const totalBlobsDespues = (await listarBlobs()).length;

  assert.equal(totalBlobsDespues, totalBlobsAntes, 'Duplicar no debe crear un nuevo blob de PDF');
  assert.equal(copia.pdfBlobId, pdfBlobId);

  // Eliminar la copia: el PDF original sigue en uso por el primer documento
  await borrarDocumentoDefinitivo(copia.id);
  const blobAunExiste = await obtenerBlob(pdfBlobId);
  assert.ok(blobAunExiste, 'El blob de PDF debe seguir existiendo porque el documento original lo usa');

  // Eliminar el documento original: ahora sí debe liberarse el blob
  await borrarDocumentoDefinitivo(doc.id);
  const blobEliminado = await obtenerBlob(pdfBlobId);
  assert.equal(blobEliminado, undefined, 'El blob debe eliminarse al borrar el último documento que lo referenciaba');
});

test('prepararRecursosDeElementos: incluye el PDF asociado al documento para exportación .nota', async () => {
  await abrirBD();
  const buffer = generarPdfMinimo({ numPaginas: 2 });
  const archivo = {
    name: 'Guia_Neuro.pdf',
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  };

  const { doc, pdfBlobId } = await crearDocumentoDePdf(archivo);
  const elementos = [
    crearElemento(doc.id, 'trazo', {
      contenedor: 1,
      datos: { puntos: [[10, 10, 0.5], [20, 20, 0.5]], color: '#2350d8', grosor: 2 },
    }),
  ];

  const recursos = await prepararRecursosDeElementos(elementos, doc);
  const recursoPdf = recursos.find((r) => r.id === pdfBlobId);

  assert.ok(recursoPdf, 'El recurso PDF debe estar incluido en la lista de recursos');
  assert.equal(recursoPdf.tipo, 'application/pdf');
  assert.ok(recursoPdf.base64.length > 50);

  await borrarDocumentoDefinitivo(doc.id);
});

test('generarPdfDocumento: exporta PDF anotado con páginas y trazos combinados', async () => {
  await abrirBD();
  const buffer = generarPdfMinimo({ numPaginas: 2 });
  const archivo = {
    name: 'Apunte_Respiratorio.pdf',
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  };

  const { doc } = await crearDocumentoDePdf(archivo);
  const trazoAnotacion = crearElemento(doc.id, 'trazo', {
    contenedor: 1,
    datos: { puntos: [[100, 100, 0.5], [150, 150, 0.5]], color: '#e11d48', grosor: 4 },
  });
  const escena = new Escena([trazoAnotacion]);

  const mockCtx = {
    canvas: null,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    globalAlpha: 1,
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    font: '',
    fillText: () => {},
    setTransform: () => {},
    scale: () => {},
    translate: () => {},
    drawImage: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    quadraticCurveTo: () => {},
    measureText: () => ({ width: 10 }),
    transform: () => {},
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    resetTransform: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
  };
  const docOriginal = globalThis.document;
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        const cv = {
          width: 100,
          height: 100,
          toDataURL: () => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        };
        const ctx = { ...mockCtx, canvas: cv };
        cv.getContext = () => ctx;
        return cv;
      }
      return {};
    },
  };

  try {
    const pdfGenerado = await generarPdfDocumento({
      tipoFormato: 'paginas',
      doc,
      motor: { escena },
      alcance: 'todo',
      paginaActiva: 1,
      cantidadPaginas: 2,
      factor: 1.5,
    });

    assert.ok(pdfGenerado instanceof Blob);
    assert.ok(pdfGenerado.size > 500, 'El PDF generado debe contener datos');
  } finally {
    globalThis.document = docOriginal;
  }

  await borrarDocumentoDefinitivo(doc.id);
});
