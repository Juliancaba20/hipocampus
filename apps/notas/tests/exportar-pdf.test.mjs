import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { A4_ANCHO_MM, A4_ALTO_MM } from '../src/archivos/exportarPdf.js';
import { nombreArchivoSeguro } from '../src/archivos/exportar.js';

test('constantes A4_ANCHO_MM y A4_ALTO_MM coinciden con el estándar ISO 216', () => {
  assert.equal(A4_ANCHO_MM, 210);
  assert.equal(A4_ALTO_MM, 297);
});

test('jsPDF se inicializa correctamente y produce un blob PDF', () => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  doc.text('Prueba de documento', 20, 20);
  const blob = doc.output('blob');
  assert.ok(blob, 'El blob de PDF debe existir');
  assert.ok(blob.size > 0, 'El PDF generado debe contener bytes');
});

test('nombreArchivoSeguro genera nombres válidos para documentos PDF', () => {
  assert.equal(nombreArchivoSeguro('Apuntes de Cardiología: Clase 1', 'pdf'), 'Apuntes_de_Cardiologia_Clase_1.pdf');
  assert.equal(nombreArchivoSeguro('   ', 'pdf'), 'nota.pdf');
  assert.equal(nombreArchivoSeguro('Resumen/Final', 'pdf'), 'ResumenFinal.pdf');
});
