// Pruebas de la Etapa 18C · Parte 1: Exportar a imagen (PNG/JPG) y límites de memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarTamanoExportacion,
  LIMITE_MEGAPIXELES_SEGURO,
  LIMITE_LADO_CANVAS_SEGURO,
} from '../src/archivos/exportarImagen.js';
import { nombreArchivoSeguro } from '../src/archivos/exportar.js';

test('validarTamanoExportacion aprueba dimensiones estándar en 1×, 2× y 3×', () => {
  // Hoja A4 estándar: 794 × 1123 px
  const a4_1x = validarTamanoExportacion(794, 1123, 1);
  assert.equal(a4_1x.esSeguro, true);
  assert.equal(a4_1x.anchoPx, 794);
  assert.equal(a4_1x.altoPx, 1123);
  assert.ok(a4_1x.megapixeles < 1);

  const a4_2x = validarTamanoExportacion(794, 1123, 2);
  assert.equal(a4_2x.esSeguro, true);
  assert.equal(a4_2x.anchoPx, 1588);
  assert.equal(a4_2x.altoPx, 2246);
  assert.ok(a4_2x.megapixeles < 4);

  const a4_3x = validarTamanoExportacion(794, 1123, 3);
  assert.equal(a4_3x.esSeguro, true);
  assert.equal(a4_3x.anchoPx, 2382);
  assert.equal(a4_3x.altoPx, 3369);
  assert.ok(a4_3x.megapixeles < 9);

  // Tarjeta 16:9 estándar: 800 × 450 px
  const tarjeta_2x = validarTamanoExportacion(800, 450, 2);
  assert.equal(tarjeta_2x.esSeguro, true);
  assert.equal(tarjeta_2x.anchoPx, 1600);
  assert.equal(tarjeta_2x.altoPx, 900);
});

test('validarTamanoExportacion detecta y previene exceder el límite seguro de memoria (25 MP)', () => {
  // Pizarrón grande de 4000 × 3000 px a 2× = 8000 × 6000 px = 48 MP (> 25 MP)
  const pizarronGrande2x = validarTamanoExportacion(4000, 3000, 2);
  assert.equal(pizarronGrande2x.esSeguro, false);
  assert.ok(pizarronGrande2x.megapixeles > LIMITE_MEGAPIXELES_SEGURO);
  assert.ok(pizarronGrande2x.error.includes('límite seguro de memoria'));

  // El mismo pizarrón a 1× = 4000 × 3000 px = 12 MP (es seguro)
  const pizarronGrande1x = validarTamanoExportacion(4000, 3000, 1);
  assert.equal(pizarronGrande1x.esSeguro, true);
  assert.equal(pizarronGrande1x.megapixeles, 12);
});

test('validarTamanoExportacion detecta y rechaza dimensiones que exceden el lado máximo del canvas (16384 px)', () => {
  const pizarronExtenso = validarTamanoExportacion(6000, 1000, 3); // 18000 × 3000 px
  assert.equal(pizarronExtenso.esSeguro, false);
  assert.ok(pizarronExtenso.anchoPx > LIMITE_LADO_CANVAS_SEGURO);
  assert.ok(pizarronExtenso.error.includes('dimensión'));
});

test('nombreArchivoSeguro genera nombres con extensión .png y .jpg limpios de caracteres inválidos', () => {
  const nombrePng = nombreArchivoSeguro('Anatomía: Músculos & Huesos / 2026', 'png');
  assert.equal(nombrePng, 'Anatomia_Musculos_Huesos_2026.png');

  const nombreJpg = nombreArchivoSeguro('Célula Eucariota (Práctica #1)', 'jpg');
  assert.equal(nombreJpg, 'Celula_Eucariota_Practica_1.jpg');
});
