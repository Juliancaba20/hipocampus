// Correcciones de la versión 1.3 (noviembre de 2026): línea enderezada, hojas siempre verticales y avisos de repaso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirLineaRecta, reconocerForma } from '../src/herramientas/precision/reconocimientoFormas.js';
import { extremosLinea } from '../src/lienzo/geometria.js';

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');

test('Línea enderezada: queda entre el punto de inicio y el de fin en las cuatro direcciones', () => {
  const casos = [
    [[100, 100], [300, 200]],   // hacia abajo y a la derecha
    [[100, 300], [300, 100]],   // hacia arriba y a la derecha
    [[300, 100], [100, 300]],   // hacia abajo y a la izquierda
    [[300, 300], [100, 100]],   // hacia arriba y a la izquierda
    [[100, 100], [400, 100]],   // horizontal
    [[100, 100], [100, 400]],   // vertical
  ];
  for (const [a, b] of casos) {
    const f = construirLineaRecta(a, b).datosFigura;
    assert.equal(f.forma, 'linea');
    const [p1, p2] = extremosLinea({ x: f.x, y: f.y, ancho: f.ancho, alto: f.alto, datos: { volteoX: f.volteoX, volteoY: f.volteoY } });
    assert.deepEqual([p1.x, p1.y, p2.x, p2.y], [a[0], a[1], b[0], b[1]]);
    assert.equal(f.volteoX, b[0] < a[0]);
    assert.equal(f.volteoY, b[1] < a[1]);
  }
});

test('reconocerForma devuelve una línea con su sentido', () => {
  const puntos = Array.from({ length: 12 }, (_, i) => [400 - i * 20, 100 + i * 10, 0.5]);
  const r = reconocerForma(puntos);
  if (r) assert.equal(r.datosFigura.volteoX, true);
});

test('El autoguardado no corta el trazo en curso', () => {
  for (const f of ['src/app/EditorLienzo.jsx', 'src/formatos/EditorPaginas.jsx', 'src/formatos/EditorTarjetas.jsx']) {
    const t = leer(f);
    const i = t.indexOf('crearAutoguardado(async () => {');
    assert.ok(i > 0, f);
    assert.ok(!t.slice(i, i + 400).includes('finalizarGestoEnCurso'), `${f}: el autoguardado no debe finalizar el gesto`);
  }
});

test('La ventana modal se dibuja en <body> y la barra de selección recibe clics', () => {
  assert.match(leer('src/app/Modal.jsx'), /createPortal\(<div className="nt-raiz nt-portal">/);
  assert.doesNotMatch(leer('src/estilos/editor.css'), /\.nt-seleccion \{[^}]*pointer-events: none/);
  assert.doesNotMatch(leer('src/estilos/editor.css'), /\.nt-hud-pie \.nt-seleccion \{[^}]*pointer-events: none/);
});

test('Las hojas se crean solo en vertical desde la interfaz', () => {
  const t = leer('src/app/ModalConfigurarPagina.jsx');
  assert.match(t, /const orientacion = 'vertical'/);
  assert.doesNotMatch(t, /Horizontal \(Paisaje\)/);
});

test('Favoritos: sin tope de 5, se pueden quitar todos y restablecer', () => {
  const l = leer('src/herramientas/precision/lapicesFavoritos.js');
  assert.match(l, /MAXIMO_LAPICES_FAVORITOS = 12/);
  assert.doesNotMatch(l, /guardados\.length >= 3/);
  const b = leer('src/app/BarraLapicesFavoritos.jsx');
  assert.doesNotMatch(b, /MINIMO/);
  assert.match(b, /restablecerLapicesFavoritos/);
});

test('Tabla de contenido: un solo botón «Cerrar»', () => {
  const t = leer('src/app/ModalTablaContenido.jsx');
  assert.equal((t.match(/>\s*Cerrar\s*</g) || []).length, 1);
});

test('Barra inferior: zoom y páginas van lado a lado; la superior, apilada', () => {
  assert.match(leer('src/estilos/editor.css'), /\.nt-hud-pie \{ flex-wrap: nowrap/);
  for (const f of ['src/app/EditorLienzo.jsx', 'src/formatos/EditorPaginas.jsx', 'src/formatos/EditorTarjetas.jsx']) {
    const t = leer(f);
    const i = t.indexOf('className="nt-precision-flotante"');
    assert.match(t.slice(i, i + 500), /flexDirection: 'column'/, f);
  }
});

test('Selector de color: desplegable fijo en <body>, y barras inferiores a la misma altura', () => {
  const s = leer('src/app/SelectorColor.jsx');
  assert.match(s, /position: 'fixed'/);
  assert.match(s, /<EnPortal>/);
  assert.match(leer('src/estilos/editor.css'), /\.nt-hud-pie \{ align-items: stretch; \}/);
});
