import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VERSION_ESQUEMA,
  TIPOS_ELEMENTO,
  crearElemento,
} from '../src/almacen/modelo.js';

import {
  VERSION_FORMATO,
  ID_APP,
  MIGRACIONES,
  migrarArchivo,
  sanearDocumentoImportado,
} from '../src/archivos/formato.js';

import {
  normalizarTarjetasConfig,
  elementosDeTarjeta,
  duplicarElementosTarjeta,
  cambiarDisenoTarjeta,
} from '../src/formatos/tarjetas.js';

import {
  crearRun,
  mismoFormato,
  unirRuns,
  sanear,
} from '../src/herramientas/texto/modelo.js';

import { runsAHtml } from '../src/herramientas/texto/html.js';
import { layoutDe, medidorCanvas } from '../src/herramientas/texto/pintar.js';
import { construirHojasTarjetas } from '../src/formatos/impresion.js';

test('Esquema y formato - Versión 3 para tarjetas de doble cara y texto oculto', () => {
  assert.equal(VERSION_ESQUEMA, 3, 'El esquema de base de datos debe ser versión 3');
  assert.equal(VERSION_FORMATO, 3, 'El formato .nota debe ser versión 3');
  assert.equal(typeof MIGRACIONES[3], 'function', 'Debe existir la función de migración a versión 3');
});

test('Migración formato - Migración a versión 3 preserva tarjetas y normaliza caras', () => {
  const notaV2 = {
    formatoApp: ID_APP,
    versionArchivo: 2,
    tipo: 'documento',
    documento: {
      id: 'doc-1',
      formato: 'tarjetas',
      config: {
        tarjetas: [
          { id: 't1', titulo: 'Tarjeta 1' },
          { id: 't2', titulo: 'Tarjeta 2' },
        ],
      },
    },
    elementos: [
      { id: 'el-1', tipo: 'texto', contenedor: 't1', datos: { bloques: [] } },
      { id: 'el-2', tipo: 'figura', contenedor: 't2', datos: {} },
    ],
  };

  const migrada = migrarArchivo(notaV2);
  assert.equal(migrada.versionArchivo, 3);
  assert.equal(migrada.elementos[0].cara, 'anverso');
  assert.equal(migrada.elementos[1].cara, 'anverso');
});

test('Sanear documento importado - Normaliza elementos con cara anverso y reverso', () => {
  const notaImportada = {
    formatoVersion: 3,
    documento: {
      id: 'doc-imp',
      formato: 'tarjetas',
      config: {
        tarjetas: [
          { id: 't1', titulo: 'Tarjeta Doble', dobleCara: true },
        ],
      },
    },
    elementos: [
      { id: 'e1', contenedor: 't1', tipo: 'texto', x: 0, y: 0, ancho: 100, alto: 50, datos: { bloques: [] } },
      { id: 'e2', contenedor: 't1', tipo: 'figura', cara: 'reverso', x: 10, y: 10, ancho: 80, alto: 60, datos: { forma: 'rectangulo' } },
    ],
  };

  const saneada = sanearDocumentoImportado(notaImportada);
  assert.equal(saneada.elementos[0].cara, 'anverso');
  assert.equal(saneada.elementos[1].cara, 'reverso');
  assert.equal(saneada.documento.config.tarjetas[0].dobleCara, true);
});

test('Tarjetas - Normalización de configuración con soporte de doble cara', () => {
  const cfg = normalizarTarjetasConfig({
    tamano: '16:9',
    tarjetas: [
      { id: 't1', titulo: 'Ficha 1', dobleCara: true, fondoReverso: '#f0fdf4' },
      { id: 't2', titulo: 'Ficha 2' },
    ],
  });

  assert.equal(cfg.tarjetas[0].dobleCara, true);
  assert.equal(cfg.tarjetas[0].fondoReverso, '#f0fdf4');
  assert.equal(cfg.tarjetas[1].dobleCara, false);
});

test('Tarjetas - Partición de elementos entre anverso y reverso', () => {
  const elementos = [
    { id: 'e1', contenedor: 't1', cara: 'anverso', tipo: 'texto' },
    { id: 'e2', contenedor: 't1', cara: 'reverso', tipo: 'texto' },
    { id: 'e3', contenedor: 't1', tipo: 'figura' }, // sin cara definida -> por defecto anverso
    { id: 'e4', contenedor: 't2', cara: 'anverso', tipo: 'trazo' },
  ];

  const anversoT1 = elementosDeTarjeta(elementos, 't1', 'anverso');
  const reversoT1 = elementosDeTarjeta(elementos, 't1', 'reverso');
  const todosT1 = elementosDeTarjeta(elementos, 't1');

  assert.equal(anversoT1.length, 2, 'El anverso debe tener e1 y e3');
  assert.deepEqual(anversoT1.map((e) => e.id), ['e1', 'e3']);

  assert.equal(reversoT1.length, 1, 'El reverso debe tener solo e2');
  assert.equal(reversoT1[0].id, 'e2');

  assert.equal(todosT1.length, 3, 'Sin filtro de cara devuelve todos los elementos de t1');
});

test('Tarjetas - Duplicar elementos conserva la cara (anverso o reverso)', () => {
  const originales = [
    { id: 'e1', contenedor: 't1', cara: 'anverso', tipo: 'texto', x: 10, y: 10, ancho: 100, alto: 50 },
    { id: 'e2', contenedor: 't1', cara: 'reverso', tipo: 'figura', x: 20, y: 20, ancho: 80, alto: 80 },
  ];

  const duplicados = duplicarElementosTarjeta(originales, 't1', 't2', () => 'nuevo-id');
  assert.equal(duplicados.length, 2);
  assert.equal(duplicados[0].contenedor, 't2');
  assert.equal(duplicados[0].cara, 'anverso');
  assert.equal(duplicados[1].contenedor, 't2');
  assert.equal(duplicados[1].cara, 'reverso');
});

test('Tarjetas - Crear elemento con cara específica', () => {
  const elAnverso = crearElemento('doc-1', TIPOS_ELEMENTO.TEXTO, { contenedor: 't1', cara: 'anverso' });
  const elReverso = crearElemento('doc-1', TIPOS_ELEMENTO.FIGURA, { contenedor: 't1', cara: 'reverso' });
  const elPorDefecto = crearElemento('doc-1', TIPOS_ELEMENTO.TRAZO, { contenedor: 't1' });

  assert.equal(elAnverso.cara, 'anverso');
  assert.equal(elReverso.cara, 'reverso');
  assert.equal(elPorDefecto.cara, 'anverso');
});

test('Texto oculto (cloze) - Modelo y normalización de marcas', () => {
  const rOculto = crearRun('Mitochondria', { negrita: true, oculto: true });
  assert.equal(rOculto.texto, 'Mitochondria');
  assert.equal(rOculto.oculto, true);
  assert.equal(rOculto.negrita, true);

  const rNormal = crearRun(' is the powerhouse', { negrita: true });
  assert.equal(mismoFormato(rOculto, rNormal), false, 'Runs con y sin oculto tienen distinto formato');

  const rOculto2 = crearRun(' of cell', { negrita: true, oculto: true });
  assert.equal(mismoFormato(rOculto, rOculto2), true);

  const unidos = unirRuns([rOculto, rOculto2]);
  assert.equal(unidos.length, 1);
  assert.equal(unidos[0].texto, 'Mitochondria of cell');
  assert.equal(unidos[0].oculto, true);
});

test('Texto oculto (cloze) - Serialización HTML', () => {
  const runs = [
    crearRun('La capital de Francia es '),
    crearRun('París', { oculto: true }),
    crearRun('.'),
  ];

  const html = runsAHtml(runs);
  assert.ok(html.includes('class="nt-oculto"'), 'El HTML debe contener la clase nt-oculto');
  assert.ok(html.includes('data-nt-oculto="1"'), 'El HTML debe contener el atributo data-nt-oculto');
  assert.ok(html.includes('París'));
});

test('Texto oculto (cloze) - Maquetación y detección de cajas cloze', () => {
  const docTexto = {
    bloques: [
      {
        tipo: 'parrafo',
        runs: [
          crearRun('El sol es una '),
          crearRun('estrella', { oculto: true }),
          crearRun(' de tipo '),
          crearRun('G2V', { oculto: true }),
          crearRun('.'),
        ],
      },
    ],
  };

  const layout = layoutDe(docTexto, 500, medidorCanvas);
  assert.ok(Array.isArray(layout.ocultos), 'El layout debe generar un arreglo de ocultos');
  assert.equal(layout.ocultos.length, 2, 'Deben existir 2 cajas cloze detectadas');

  const primerOculto = layout.ocultos[0];
  assert.equal(primerOculto.texto, 'estrella');
  assert.equal(primerOculto.indice, 0);
  assert.ok(primerOculto.w > 0);
  assert.ok(primerOculto.h > 0);

  const segundoOculto = layout.ocultos[1];
  assert.equal(segundoOculto.texto, 'G2V');
  assert.equal(segundoOculto.indice, 1);
});

test('Mazo de 10 tarjetas de doble cara con texto cloze - Estructura e impresión', () => {
  // Crear un mazo completo de 10 tarjetas de doble cara con cloze
  const tarjetas = Array.from({ length: 10 }, (_, i) => ({
    id: `tarjeta-${i + 1}`,
    titulo: `Ficha médica ${i + 1}`,
    dobleCara: true,
    fondo: '#ffffff',
    fondoReverso: '#f8fafc',
    diseno: 'en-blanco',
    disenoReverso: 'en-blanco',
  }));

  // Simular contenedor DOM para impresión
  const contenedorMock = {
    innerHTML: '',
    children: [],
    appendChild(nodo) {
      this.children.push(nodo);
    },
  };

  // Mock global document si no existe en entorno de test node
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
        getContext: () => ({
          save: () => {},
          restore: () => {},
          setTransform: () => {},
          fillRect: () => {},
          strokeRect: () => {},
        }),
      }),
    };
  }

  let cantidadDibujos = 0;
  const carasDibujadas = [];

  construirHojasTarjetas(contenedorMock, {
    tarjetas,
    med: { ancho: 600, alto: 400 },
    porHoja: 2,
    marcas: true,
    factor: 1,
    ambasCaras: true,
    dibujarEn: (cv, itemTarjeta) => {
      cantidadDibujos++;
      carasDibujadas.push({ id: itemTarjeta.id, cara: itemTarjeta.caraImpresion });
    },
  });

  // 10 tarjetas × 2 caras = 20 caras impresas en total
  assert.equal(cantidadDibujos, 20, 'Deben dibujarse exactamente 20 caras (10 anversos y 10 reversos)');
  assert.equal(carasDibujadas.filter((c) => c.cara === 'anverso').length, 10);
  assert.equal(carasDibujadas.filter((c) => c.cara === 'reverso').length, 10);

  // Probar también impresión de solo anverso
  cantidadDibujos = 0;
  carasDibujadas.length = 0;
  contenedorMock.children = [];
  construirHojasTarjetas(contenedorMock, {
    tarjetas,
    med: { ancho: 600, alto: 400 },
    porHoja: 2,
    marcas: true,
    factor: 1,
    ambasCaras: false,
    dibujarEn: (cv, itemTarjeta) => {
      cantidadDibujos++;
      carasDibujadas.push({ id: itemTarjeta.id, cara: itemTarjeta.caraImpresion });
    },
  });

  assert.equal(cantidadDibujos, 10, 'Al imprimir solo anverso deben dibujarse 10 caras');
  assert.ok(carasDibujadas.every((c) => c.cara === 'anverso'));
});
