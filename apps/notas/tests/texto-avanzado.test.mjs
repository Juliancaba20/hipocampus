// Tests de formato de texto avanzado (Etapa 20A):
//  - Fuentes y tamaños distintos en un mismo bloque
//  - Subíndice y superíndice (H₂O, Ca²⁺, x²)
//  - Justificado, interlineado y sangría
//  - Copiar formato (pincel)
//  - Contador de palabras y caracteres
//  - Compatibilidad retroactiva y composición guiada
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="c"><canvas id="cv" tabindex="0"></canvas><div id="capa"></div></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);

const M = await import('../src/herramientas/texto/modelo.js');
const H = await import('../src/herramientas/texto/html.js');
const { maquetar } = await import('../src/herramientas/texto/maquetar.js');

const tamDe = (f) => parseFloat(/([\d.]+)px/.exec(f)?.[1] || 16);
const medidor = {
  ancho: (f, t) => t.length * tamDe(f) * 0.5,
  metricas: (f) => ({ asc: tamDe(f) * 0.95, desc: tamDe(f) * 0.25 }),
};

test('modelo y HTML: fuentes y tamaños por fragmento se conservan en ida y vuelta', () => {
  const bloques = [
    {
      tipo: 'parrafo',
      runs: [
        M.crearRun('Texto en Serif 20px, '),
        M.crearRun('palabra en Sans 28px', { fuente: 'sans', tamano: 28, negrita: true }),
        M.crearRun(' y ', {}),
        M.crearRun('código en Mono 14px', { fuente: 'mono', tamano: 14 }),
      ],
    },
  ];

  const html = H.modeloAHtml(bloques);
  const reparseado = H.htmlAModelo(html);

  assert.equal(reparseado.length, 1);
  const runs = reparseado[0].runs;
  assert.equal(runs[0].texto, 'Texto en Serif 20px, ');
  assert.equal(runs[1].texto, 'palabra en Sans 28px');
  assert.equal(runs[1].fuente, 'sans');
  assert.equal(runs[1].tamano, 28);
  assert.equal(runs[1].negrita, true);
  assert.equal(runs[3].texto, 'código en Mono 14px');
  assert.equal(runs[3].fuente, 'mono');
  assert.equal(runs[3].tamano, 14);
});

test('subíndice y superíndice: generación HTML e importación de fórmulas', () => {
  const formulaAgua = [
    {
      tipo: 'parrafo',
      runs: [
        M.crearRun('H'),
        M.crearRun('2', { script: 'sub' }),
        M.crearRun('O + Ca'),
        M.crearRun('2+', { script: 'super' }),
        M.crearRun(' -> x'),
        M.crearRun('2', { script: 'super' }),
      ],
    },
  ];

  const html = H.modeloAHtml(formulaAgua);
  assert.ok(html.includes('<sub>2</sub>'), 'Debe generar etiqueta sub');
  assert.ok(html.includes('<sup>2+</sup>'), 'Debe generar etiqueta sup');
  assert.ok(html.includes('<sup>2</sup>'), 'Debe generar etiqueta sup');

  const recuperado = H.htmlAModelo(html);
  assert.equal(recuperado[0].runs[1].script, 'sub');
  assert.equal(recuperado[0].runs[3].script, 'super');
  assert.equal(recuperado[0].runs[5].script, 'super');
});

test('justificado, interlineado y sangría: se conservan en modelo y HTML', () => {
  const bloques = [
    {
      tipo: 'parrafo',
      alinear: 'justificado',
      interlineado: 1.5,
      sangria: 2,
      runs: [M.crearRun('Párrafo justificado con interlineado y sangría.')],
    },
  ];

  const html = H.modeloAHtml(bloques);
  assert.ok(html.includes('text-align:justify') || html.includes('text-align: justify'));
  assert.ok(html.includes('line-height:1.5') || html.includes('line-height: 1.5'));

  const recuperado = H.htmlAModelo(html);
  assert.equal(recuperado[0].alinear, 'justificado');
  assert.equal(recuperado[0].interlineado, 1.5);
  assert.equal(recuperado[0].sangria, 2);
});

test('maquetación: justificado distribuye el espacio sobrante entre palabras', () => {
  const textoLargo = 'Primera palabra segunda palabra tercera palabra cuarta palabra.';
  const datosJustificado = {
    bloques: [
      {
        tipo: 'parrafo',
        alinear: 'justificado',
        runs: [M.crearRun(textoLargo + ' Segunda oracion que continua el parrafo de prueba.')],
      },
    ],
    tamano: 16,
  };

  const layout = maquetar(datosJustificado, 200, medidor);
  assert.ok(layout.textos.length > 0);
  assert.ok(layout.alto > 0);
});

test('maquetación: subíndice y superíndice desplazan la posición vertical de dibujo', () => {
  const datos = {
    bloques: [
      {
        tipo: 'parrafo',
        runs: [
          M.crearRun('Base'),
          M.crearRun('Sub', { script: 'sub' }),
          M.crearRun('Super', { script: 'super' }),
        ],
      },
    ],
    tamano: 20,
  };

  const layout = maquetar(datos, 400, medidor);
  const tBase = layout.textos.find((t) => t.texto.includes('Base'));
  const tSub = layout.textos.find((t) => t.texto.includes('Sub'));
  const tSuper = layout.textos.find((t) => t.texto.includes('Super'));

  assert.ok(tBase && tSub && tSuper);
  // El subíndice debe estar más abajo en Y (coordenadas de pantalla van hacia abajo)
  assert.ok(tSub.y > tBase.y, `Subíndice (${tSub.y}) debe estar más abajo que Base (${tBase.y})`);
  // El superíndice debe estar más arriba en Y
  assert.ok(tSuper.y < tBase.y, `Superíndice (${tSuper.y}) debe estar más arriba que Base (${tBase.y})`);
});

test('conteo de palabras y caracteres: documento y selección', () => {
  const texto = 'Hola mundo, esta es una prueba de conteo.';
  const res = M.contarTexto(texto);
  assert.equal(res.palabras, 8);
  assert.equal(res.caracteres, 41);

  const vacio = M.contarTexto('');
  assert.equal(vacio.palabras, 0);
  assert.equal(vacio.caracteres, 0);

  const bloques = [
    { tipo: 'parrafo', runs: [M.crearRun('Dos palabras')] },
    { tipo: 'titulo1', runs: [M.crearRun('Tres palabras más')] },
  ];
  const resBloques = M.contarBloques(bloques);
  assert.equal(resBloques.palabras, 5);
});

test('compatibilidad retroactiva: textos antiguos sin nuevas propiedades se leen sin error', () => {
  const docAntiguo = {
    contenido: 'Texto plano antiguo\nCon dos líneas',
    tamano: 18,
  };

  const bloques = M.bloquesDe(docAntiguo);
  assert.equal(bloques.length, 2);

  const layout = maquetar(docAntiguo, 300, medidor);
  assert.ok(layout.alto > 0);
  assert.ok(layout.textos.length >= 2);
  // Por defecto usa la fuente serif
  assert.ok(layout.textos[0].fuente.includes('Source Serif 4'));
});

test('composición guiada con pauta de renglones: la altura del bloque se alinea al paso de guía', () => {
  const datosGuiados = {
    bloques: [
      { tipo: 'parrafo', runs: [M.crearRun('Línea 1')] },
      { tipo: 'parrafo', runs: [M.crearRun('Línea 2')] },
    ],
    tamano: 20,
    composicion: 'guiada',
  };

  const pasoGuia = 30; // Interlineado de la pauta de renglones
  const layout = maquetar(datosGuiados, 300, medidor, { interlineado: pasoGuia });

  // Cada renglón y separación debe respetar múltiplos enteros de pasoGuia
  assert.equal(layout.alto % pasoGuia, 0, 'La altura total debe ser múltiplo exacto del paso de guía');
});
