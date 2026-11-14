// Toda llamada de la interfaz al motor del lienzo debe apuntar a un método que exista.
// (Antes, «insertarIcono» y «abrir en el lugar exacto» fallaban en silencio por llamar a métodos inexistentes.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Lienzo } from '../src/lienzo/motor.js';

function archivos(dir) {
  return readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(`${dir}${e.name}/`) : (/\.(jsx?|js)$/.test(e.name) ? [`${dir}${e.name}`] : []));
}

const metodos = new Set(Object.getOwnPropertyNames(Lienzo.prototype));
const PROPIEDADES = new Set(['current', 'escena', 'camara', 'canvas', 'ajustes', 'seleccion', 'herramienta', 'documentoId', 'ancho', 'alto', 'contenedor', 'marco']);

test('la interfaz solo llama a métodos que existen en el motor del lienzo', () => {
  const patron = /(?:\bm\(\)|motorRef\.current|\bmotor)\??\.(\w+)\s*\(/g;
  const faltan = [];
  for (const f of archivos('../src/')) {
    if (!/\.jsx$/.test(f)) continue;
    const texto = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of texto.matchAll(patron)) {
      if (!metodos.has(m[1]) && !PROPIEDADES.has(m[1])) faltan.push(`${f.replace('../src/', '')}: ${m[1]}()`);
    }
  }
  assert.deepEqual([...new Set(faltan)], []);
});

test('el motor no llama a métodos propios que no existen', () => {
  const texto = readFileSync(new URL('../src/lienzo/motor.js', import.meta.url), 'utf8');
  const propiedades = new Set([...texto.matchAll(/this\.(\w+)\s*=/g)].map((m) => m[1]));
  const faltan = [...new Set([...texto.matchAll(/this\.(\w+)\(/g)].map((m) => m[1]))].filter((n) => !metodos.has(n) && !propiedades.has(n));
  assert.deepEqual(faltan, []);
});

test('la caché que se usa mientras se traza incluye todas las capas de fondo del dibujo normal', () => {
  const texto = readFileSync(new URL('../src/lienzo/motor.js', import.meta.url), 'utf8');
  const cuerpo = (nombre) => {
    const i = texto.indexOf(`  ${nombre}(`);
    assert.ok(i >= 0, `no se encontró ${nombre}`);
    const j = texto.indexOf('\n  }\n', i);
    return texto.slice(i, j);
  };
  const normal = cuerpo('_dibujar');
  const cache = cuerpo('_crearCache');
  // Capas que, si faltan en la caché, desaparecen de la pantalla mientras se mantiene apretado el clic.
  for (const capa of ['alPedirFondoMarco', 'contenedor', 'fondoDocumento', 'instrumentoPrecision', 'marcoDocumento', 'estilos', 'renglones', 'guiaTexto']) {
    assert.ok(normal.includes(`${capa}:`), `_dibujar ya no usa «${capa}»: actualice esta prueba`);
    assert.ok(cache.includes(`${capa}:`), `_crearCache no incluye la capa «${capa}» (desaparecería al trazar)`);
  }
});

test('marcadores: Enter al renombrar no envía el formulario de «Guardar ubicación» (no crea marcadores extra)', () => {
  const texto = readFileSync(new URL('../src/app/ModalMarcadores.jsx', import.meta.url), 'utf8');
  const i = texto.indexOf("if (e.key === 'Enter')");
  assert.ok(i >= 0, 'falta el manejo de Enter en la edición');
  assert.ok(texto.slice(i, i + 200).includes('e.preventDefault()'), 'Enter debe cancelar el envío del formulario');
});

test('A4: los botones «Anterior» y «Siguiente» usan el estilo de botón de página (no el de la barra de herramientas)', () => {
  const texto = readFileSync(new URL('../src/formatos/EditorPaginas.jsx', import.meta.url), 'utf8');
  for (const etiqueta of ['Página anterior', 'Página siguiente']) {
    const i = texto.indexOf(`aria-label="${etiqueta}"`);
    assert.ok(i >= 0, `falta ${etiqueta}`);
    const inicio = texto.lastIndexOf('<button', i);
    assert.ok(texto.slice(inicio, i).includes('className="nt-btn-sm"'), `${etiqueta} debe usar nt-btn-sm`);
  }
});

test('lápices favoritos: el editor de ranura se abre hacia abajo, dentro de la pantalla', () => {
  const texto = readFileSync(new URL('../src/app/BarraLapicesFavoritos.jsx', import.meta.url), 'utf8');
  const i = texto.indexOf('slotEditando === idx && (');
  assert.ok(i >= 0, 'falta el editor de ranura');
  const bloque = texto.slice(i, i + 400);
  assert.ok(bloque.includes("top: 'calc(100% + 8px)'"), 'el editor debe abrirse hacia abajo, no hacia arriba (quedaba tapado por la cabecera)');
  assert.ok(!bloque.includes("bottom: '40px'"), 'no debe volver a abrirse hacia arriba');
});

test('exportar imagen: los límites de la escena se leen como {x, y, ancho, alto} (antes NaN)', () => {
  const texto = readFileSync(new URL('../src/app/ModalExportarImagen.jsx', import.meta.url), 'utf8');
  assert.ok(!/limites\.(minX|maxX|minY|maxY)/.test(texto), 'no debe leer minX/maxX: la escena no los devuelve');
  assert.ok(texto.includes('limites.ancho'), 'debe usar limites.ancho');
});

test('exportar PDF: el fondo del PDF original se pinta con alPedirFondoMarco (después del relleno blanco de la hoja)', () => {
  const texto = readFileSync(new URL('../src/archivos/exportarPdf.js', import.meta.url), 'utf8');
  assert.ok(texto.includes('alPedirFondoMarco: fondoPdf'), 'el fondo del PDF debe entregarse a dibujar()');
  assert.ok(!/await pagPdf\.render\(\{ canvasContext: ctx,/.test(texto), 'no debe renderizar el fondo directamente sobre el canvas de la hoja');
});
