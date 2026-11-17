const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../datos.js');
const L = require('../logica.js');

test('los datos coinciden con la versión de Python', () => {
  assert.deepEqual(Object.keys(D.paginas), ['α', 'Α', '±', 'H₂', '∫']);
  assert.equal(D.columnas, 9);
  assert.equal(D.maxRecientes, 9);
  assert.equal(Object.keys(D.temas).length, 6);
  for (const t of Object.values(D.temas)) {
    for (const c of ['fondo', 'barra', 'boton', 'hover', 'texto', 'acento', 'cerrar', 'reciente', 'nombre', 'asa']) {
      assert.match(t[c], /^#[0-9a-f]{6}$/i, c);
    }
  }
});

test('todo símbolo tiene nombre', () => {
  for (const s of L.simbolosValidos(D)) assert.ok(D.nombres[s], `falta el nombre de ${s}`);
});

test('transparencia: límites y valores raros', () => {
  assert.equal(L.limitarAlpha(0.2, D), 0.6);
  assert.equal(L.limitarAlpha(7, D), 1);
  assert.equal(L.limitarAlpha(0.955, D), 0.96);
  assert.equal(L.limitarAlpha('x', D), D.alphaPredeterminada);
  assert.equal(L.limitarAlpha(NaN, D), D.alphaPredeterminada);
  assert.equal(L.limitarAlpha(undefined, D), D.alphaPredeterminada);
});

test('recientes: sin repetidos, el último primero y tope de 9', () => {
  let r = [];
  for (const s of 'αβγδεζηθικλ') r = L.agregarReciente(r, s, D);
  assert.equal(r.length, 9);
  assert.equal(r[0], 'λ');
  r = L.agregarReciente(r, 'ε', D);
  assert.equal(r[0], 'ε');
  assert.equal(r.filter((s) => s === 'ε').length, 1);
  assert.equal(r.length, 9);
});

test('recientes guardados: se descartan los inválidos y repetidos', () => {
  assert.deepEqual(L.normalizarRecientes(['α', 'zz', 'α', 5, '²', null], D), ['α', '²']);
  assert.deepEqual(L.normalizarRecientes('no es lista', D), []);
  assert.equal(L.normalizarRecientes(Array(30).fill('α').map((_, i) => 'αβγδεζηθικλμνξ'[i % 14]), D).length, 9);
});

test('configuración vacía o dañada da valores predeterminados', () => {
  for (const mala of [null, undefined, 5, 'x', [], {}]) {
    const c = L.normalizarConfig(mala, D);
    assert.equal(c.tema, 'Medianoche');
    assert.equal(c.tamano, 'Normal');
    assert.equal(c.alpha, 0.96);
    assert.equal(c.nombres, true);
    assert.equal(c.arriba, true);
    assert.equal(c.compacto, false);
    assert.equal(c.pagina, 'α');
    assert.equal(c.atajo, 'ctrl+alt+g');
    assert.equal(c.x, null);
  }
});

test('configuración de Python 1.x se aprovecha', () => {
  const c = L.normalizarConfig({ version: '1.8', x: 840, y: 120.4, pagina: '∫', recientes: ['α', '∫'],
    compacto: true, buscar_actualizaciones: false, tema: 'Claro', tamano: 'Grande', alpha: 0.8,
    nombres: false, arriba: false, atajo: 'ctrl+shift+k' }, D);
  assert.deepEqual(c, { tema: 'Claro', tamano: 'Grande', alpha: 0.8, nombres: false, arriba: false,
    compacto: true, pagina: '∫', recientes: ['α', '∫'], atajo: 'ctrl+shift+k', x: 840, y: 120 });
});

test('valores de tipo equivocado se ignoran uno por uno', () => {
  const c = L.normalizarConfig({ tema: 'Inventado', tamano: 3, alpha: 'mucho', nombres: 'si', pagina: 'ñ',
    x: '10', y: Infinity }, D);
  assert.equal(c.tema, 'Medianoche');
  assert.equal(c.tamano, 'Normal');
  assert.equal(c.alpha, 0.96);
  assert.equal(c.nombres, true);
  assert.equal(c.pagina, 'α');
  assert.equal(c.x, null);
  assert.equal(c.y, null);
});

test('texto del atajo', () => {
  assert.equal(L.textoAtajo('ctrl+alt+g'), 'Ctrl+Alt+G');
  assert.equal(L.textoAtajo('Ctrl + Shift + F12'), 'Ctrl+Shift+F12');
  assert.equal(L.textoAtajo(''), '');
  assert.equal(L.textoAtajo(null), '');
});

test('letras con punto', () => {
  assert.ok(L.conPunto('V\u0307', D));
  assert.ok(!L.conPunto('V', D));
  assert.ok(!L.conPunto('α', D));
  assert.equal(Object.values(D.paginas).flat().filter((s) => L.conPunto(s, D)).length, 3);
});

test('posición guardada: se detecta si quedó fuera de las pantallas', () => {
  const pantallas = [{ x: 0, y: 0, ancho: 1920, alto: 1080 }, { x: 1920, y: 0, ancho: 1280, alto: 1024 }];
  assert.ok(L.dentroDePantallas(100, 100, pantallas));
  assert.ok(L.dentroDePantallas(2000, 500, pantallas));
  assert.ok(!L.dentroDePantallas(-500, 100, pantallas));
  assert.ok(!L.dentroDePantallas(5000, 100, pantallas));
  assert.ok(!L.dentroDePantallas(0, 0, []));
});
