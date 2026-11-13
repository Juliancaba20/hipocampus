import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;

import {
  TAMANOS_HOJA,
  PERFILES_MARGENES,
  dimensionesHoja,
  anchoHoja,
  altoHoja,
  pasoPagina,
  margenesHoja,
  marcoDePagina,
  marcosDePaginas,
  paginaEnY,
  yDePagina,
  normalizarPaginasConfig,
  migrarElementosPorCambioHoja,
  partirTextoPorDesborde,
} from '../src/formatos/paginas.js';
import { sanear, normalizarBloques } from '../src/herramientas/texto/modelo.js';
import { htmlAModelo, modeloAHtml } from '../src/herramientas/texto/html.js';
import { maquetar } from '../src/herramientas/texto/maquetar.js';
import { medidorCanvas } from '../src/herramientas/texto/pintar.js';

test('Etapa 20C · Catálogo de tamaños de hoja (A4, Carta, A5) y orientaciones', () => {
  // A4 vertical por defecto
  const a4V = dimensionesHoja({ tamanoHoja: 'a4', orientacion: 'vertical' });
  assert.equal(a4V.ancho, 794);
  assert.equal(a4V.alto, 1123);
  assert.equal(a4V.orientacion, 'vertical');

  // Carta vertical
  const cartaV = dimensionesHoja({ tamanoHoja: 'carta', orientacion: 'vertical' });
  assert.equal(cartaV.ancho, 816);
  assert.equal(cartaV.alto, 1056);
  assert.equal(cartaV.tamanoCss, 'letter');

  // Carta horizontal (intercambia ancho y alto)
  const cartaH = dimensionesHoja({ tamanoHoja: 'carta', orientacion: 'horizontal' });
  assert.equal(cartaH.ancho, 1056);
  assert.equal(cartaH.alto, 816);
  assert.equal(cartaH.orientacion, 'horizontal');

  // A5 vertical y horizontal
  const a5V = dimensionesHoja({ tamanoHoja: 'a5', orientacion: 'vertical' });
  assert.equal(a5V.ancho, 559);
  assert.equal(a5V.alto, 794);

  const a5H = dimensionesHoja({ tamanoHoja: 'a5', orientacion: 'horizontal' });
  assert.equal(a5H.ancho, 794);
  assert.equal(a5H.alto, 559);
});

test('Etapa 20C · Perfiles de márgenes y márgenes personalizados', () => {
  const norm = margenesHoja({ margenes: 'normal' });
  assert.deepEqual(norm, { superior: 60, inferior: 60, izquierdo: 60, derecho: 60 });

  const estr = margenesHoja({ margenes: 'estrecho' });
  assert.deepEqual(estr, { superior: 36, inferior: 36, izquierdo: 36, derecho: 36 });

  const mod = margenesHoja({ margenes: 'moderado' });
  assert.deepEqual(mod, { superior: 60, inferior: 60, izquierdo: 45, derecho: 45 });

  const anch = margenesHoja({ margenes: 'ancho' });
  assert.deepEqual(anch, { superior: 60, inferior: 60, izquierdo: 90, derecho: 90 });

  const pers = margenesHoja({ margenes: { superior: 40, inferior: 50, izquierdo: 30, derecho: 35 } });
  assert.deepEqual(pers, { superior: 40, inferior: 50, izquierdo: 30, derecho: 35 });
});

test('Etapa 20C · Marcos de página y coordenadas con configuración Carta horizontal', () => {
  const cfgCartaH = {
    tamanoHoja: 'carta',
    orientacion: 'horizontal',
    cantidadPaginas: 3,
  };

  const m1 = marcoDePagina(1, cfgCartaH);
  assert.equal(m1.x, 0);
  assert.equal(m1.y, 0);
  assert.equal(m1.ancho, 1056);
  assert.equal(m1.alto, 816);

  const paso = 816 + 50; // 866
  const m2 = marcoDePagina(2, cfgCartaH);
  assert.equal(m2.y, paso);
  assert.equal(m2.ancho, 1056);
  assert.equal(m2.alto, 816);

  assert.equal(paginaEnY(100, cfgCartaH), 1);
  assert.equal(paginaEnY(paso + 50, cfgCartaH), 2);
  assert.equal(yDePagina(3, cfgCartaH), 2 * paso);
});

test('Etapa 20C · Migración de elementos por cambio de hoja sin distorsión de trazos libres', () => {
  const cfgA4V = normalizarPaginasConfig({ tamanoHoja: 'a4', orientacion: 'vertical' });
  const cfgCartaH = normalizarPaginasConfig({ tamanoHoja: 'carta', orientacion: 'horizontal' });

  // Elementos en la página 2
  const yInicioP2A4 = yDePagina(2, cfgA4V); // 1173 px
  const yInicioP2CartaH = yDePagina(2, cfgCartaH); // 866 px
  const deltaEsperado = yInicioP2CartaH - yInicioP2A4; // 866 - 1173 = -307 px

  const trazoP2 = {
    id: 'trazo-1',
    tipo: 'trazo',
    contenedor: 2,
    y: yInicioP2A4 + 100,
    datos: {
      puntos: [
        [50, yInicioP2A4 + 100, 0.5],
        [60, yInicioP2A4 + 110, 0.5],
        [70, yInicioP2A4 + 120, 0.5],
      ],
    },
  };

  const textoP2 = {
    id: 'txt-1',
    tipo: 'texto',
    contenedor: 2,
    x: 80,
    y: yInicioP2A4 + 150,
    ancho: 400,
    alto: 80,
    datos: { bloques: [] },
  };

  const migrados = migrarElementosPorCambioHoja([trazoP2, textoP2], cfgA4V, cfgCartaH);

  // Texto se desplazó verticalmente de forma exacta
  assert.equal(migrados[1].y, textoP2.y + deltaEsperado);
  assert.equal(migrados[1].x, textoP2.x); // x permanece intacto

  // Trazo se desplazó sin deformaciones (los puntos se conservan con el desplazamiento vertical delta)
  assert.equal(migrados[0].y, trazoP2.y + deltaEsperado);
  assert.equal(migrados[0].datos.puntos[0][0], 50); // x idéntico
  assert.equal(migrados[0].datos.puntos[0][1], yInicioP2CartaH + 100); // y relativo exacto
  assert.equal(migrados[0].datos.puntos[1][1], yInicioP2CartaH + 110);
  assert.equal(migrados[0].datos.puntos[2][1], yInicioP2CartaH + 120);
});

test('Etapa 20C · Modelo de tablas avanzadas: saneamiento y normalización', () => {
  const bloquesSucios = [
    {
      tipo: 'tabla',
      encabezado: true,
      anchosColumnas: [1, 2, 1],
      bordeColor: '#2350d8',
      bordeGrosor: 2,
      bordeEstilo: 'grilla',
      filas: [
        [
          { runs: [{ texto: 'Celda A1' }], colspan: 2, fondo: '#dcfce7', alinearV: 'centro' },
          { runs: [], combinada: true },
          { runs: [{ texto: 'Celda A3' }], alinearV: 'abajo' },
        ],
        [
          { runs: [{ texto: 'Celda B1' }] },
          { runs: [{ texto: 'Celda B2' }], fondo: '#fee2e2' },
          { runs: [{ texto: 'Celda B3' }] },
        ],
      ],
    },
  ];

  const saneados = sanear(bloquesSucios);
  assert.equal(saneados.length, 1);
  const t = saneados[0];
  assert.equal(t.tipo, 'tabla');
  assert.equal(t.encabezado, true);
  assert.deepEqual(t.anchosColumnas, [1, 2, 1]);
  assert.equal(t.bordeColor, '#2350d8');
  assert.equal(t.bordeGrosor, 2);
  assert.equal(t.bordeEstilo, 'grilla');

  assert.equal(t.filas[0][0].colspan, 2);
  assert.equal(t.filas[0][0].fondo, '#dcfce7');
  assert.equal(t.filas[0][0].alinearV, 'centro');
  assert.equal(t.filas[0][1].combinada, true);
  assert.equal(t.filas[0][2].alinearV, 'abajo');
});

test('Etapa 20C · Serialización HTML (modeloAHtml) y análisis de pegado (htmlAModelo)', () => {
  const modelo = [
    {
      tipo: 'tabla',
      encabezado: true,
      bordeEstilo: 'todos',
      bordeColor: '#2563eb',
      filas: [
        [
          { runs: [{ texto: 'Título 1' }], colspan: 2, fondo: '#f1f5f9' },
          { runs: [], combinada: true },
        ],
        [
          { runs: [{ texto: 'Dato A' }], alinearV: 'centro', fondo: '#fee2e2' },
          { runs: [{ texto: 'Dato B' }], alinearV: 'abajo' },
        ],
      ],
    },
  ];

  const html = modeloAHtml(modelo);
  assert.match(html, /<table data-enc="1" data-borde-estilo="todos"/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /background-color:#f1f5f9/);
  assert.match(html, /background-color:#fee2e2/);
  assert.match(html, /vertical-align:middle/);
  assert.match(html, /vertical-align:bottom/);

  // Leer desde HTML simulando pegado de tabla desde Word / web
  const modeloLeido = htmlAModelo(html);
  assert.equal(modeloLeido.length, 1);
  const tLeida = modeloLeido[0];
  assert.equal(tLeida.tipo, 'tabla');
  assert.equal(tLeida.encabezado, true);
  assert.equal(tLeida.filas.length, 2);
  assert.equal(tLeida.filas[0][0].colspan, 2);
  assert.equal(tLeida.filas[0][0].fondo, '#f1f5f9');
  assert.equal(tLeida.filas[0][1].combinada, true);
  assert.equal(tLeida.filas[1][0].fondo, '#fee2e2');
  assert.equal(tLeida.filas[1][0].alinearV, 'centro');
  assert.equal(tLeida.filas[1][1].alinearV, 'abajo');
});

test('Etapa 20C · Maquetación de tablas avanzadas con celdas combinadas y fondos', () => {
  const datos = {
    bloques: [
      {
        tipo: 'tabla',
        encabezado: true,
        anchosColumnas: [1, 3], // primera columna 25%, segunda columna 75%
        bordeColor: '#000000',
        bordeGrosor: 1,
        bordeEstilo: 'todos',
        filas: [
          [
            { runs: [{ texto: 'Col 1' }], fondo: '#fef3c7' },
            { runs: [{ texto: 'Col 2 ancha' }] },
          ],
          [
            { runs: [{ texto: 'Fusión horizontal' }], colspan: 2, fondo: '#dcfce7', alinearV: 'centro' },
            { runs: [], combinada: true },
          ],
        ],
      },
    ],
  };

  const layout = maquetar(datos, 400, medidorCanvas);
  assert.ok(layout.alto > 30);
  assert.ok(layout.lineas.length > 0);
  assert.ok(layout.fondos.length >= 2); // encabezado y/o fondos de celda

  // Verificar que hay un fondo con color #dcfce7
  const fondoVerde = layout.fondos.find((f) => f.color === '#dcfce7');
  assert.ok(fondoVerde, 'Debe existir un fondo para la celda fusionada');
  assert.equal(fondoVerde.w, 400, 'La celda con colspan 2 debe ocupar todo el ancho');
});

test('Etapa 20C · División de tablas que desbordan páginas (partirTextoPorDesborde)', () => {
  const filas = [];
  for (let i = 1; i <= 10; i++) {
    filas.push([
      { runs: [{ texto: `Fila ${i}` }] },
      { runs: [{ texto: `Valor ${i}` }] },
    ]);
  }

  const el = {
    id: 'el-tabla-1',
    tipo: 'texto',
    x: 60,
    y: 900,
    ancho: 674,
    alto: 400, // Desborda el marco A4 (alto disponible < 400)
    datos: {
      bloques: [
        {
          tipo: 'tabla',
          encabezado: true,
          filas,
        },
      ],
    },
  };

  const marcoP1 = marcoDePagina(1);
  let idGenerado = 100;
  const nuevoId = () => `id-${idGenerado++}`;

  const res = partirTextoPorDesborde(el, marcoP1, nuevoId);
  assert.ok(res, 'Debe dividir la tabla por filas al desbordar');
  assert.equal(res.paginaSiguiente, 2);

  const t1 = res.elemento1.datos.bloques[0];
  const t2 = res.elemento2.datos.bloques[0];

  assert.equal(t1.tipo, 'tabla');
  assert.equal(t2.tipo, 'tabla');
  assert.ok(t1.filas.length > 0 && t1.filas.length < 10);
  assert.ok(t2.filas.length > 0);
  // Al tener encabezado: true, la página 2 repite la fila de encabezado
  assert.equal(t2.encabezado, true);
  assert.equal(t2.filas[0][0].runs[0].texto, 'Fila 1', 'Debe repetir la fila de encabezado');
});
