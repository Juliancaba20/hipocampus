import test from 'node:test';
import assert from 'node:assert/strict';
import { generarPdfPrueba } from '../prototipos/pdf/generador-pdf.js';
import { DATOS_COMPARATIVA_TEORICA } from '../prototipos/pdf/comparativa.js';

test('generadorPdfPrueba produce un documento de 10 páginas con peso y dimensiones válidas', async () => {
  const t0 = performance.now();
  const resultado = await generarPdfPrueba({ numPaginas: 10 });
  const t1 = performance.now();

  assert.equal(resultado.numPaginas, 10);
  assert.ok(resultado.pesoBytes > 5000, 'El peso del PDF debe ser mayor a 5KB');
  assert.ok(resultado.arrayBuffer instanceof ArrayBuffer);
  assert.ok(t1 - t0 < 2000, 'La generación de 10 páginas debe ser rápida (< 2 segundos)');
});

test('datos teóricos de la comparativa reflejan la ventaja cuantitativa del Enfoque A sobre el B', () => {
  const datos = DATOS_COMPARATIVA_TEORICA.documento100Paginas;

  // Apertura: PDF.js debe ser órdenes de magnitud más rápido que rasterizar 100 imágenes
  assert.ok(datos.enfoqueA_PdfJs.tiempoImportacionMs < 1000);
  assert.ok(datos.enfoqueB_Imagenes.tiempoImportacionMs > 10000);

  // Almacenamiento: PDF original debe ser significativamente menor que 100 imágenes PNG
  assert.ok(
    datos.enfoqueA_PdfJs.almacenamientoBytes < datos.enfoqueB_Imagenes.almacenamientoBytesJpeg
  );
  assert.ok(
    datos.enfoqueA_PdfJs.almacenamientoBytes < datos.enfoqueB_Imagenes.almacenamientoBytesPng
  );
});

test('PDF.js carga y analiza el buffer generado correctamente', async () => {
  const { arrayBuffer } = await generarPdfPrueba({ numPaginas: 5 });
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  assert.equal(pdfDoc.numPages, 5);

  const page1 = await pdfDoc.getPage(1);
  const viewport = page1.getViewport({ scale: 1.0 });

  // A4 estándar: 595.28 x 841.89 pt
  assert.equal(Math.round(viewport.width), 595);
  assert.equal(Math.round(viewport.height), 842);
});
