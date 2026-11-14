// Pruebas unitarias para Etapa 21A: Estilos visuales, formas ampliadas e íconos de estudio.
import test from 'node:test';
import assert from 'node:assert/strict';

import { LISTA_FORMAS, ES_FORMA } from '../src/app/formas.js';
import { CATALOGO_ICONOS, CATEGORIAS_ICONOS, buscarIconos } from '../src/herramientas/iconos/catalogo.js';
import { FORMAS, puntosForma, puntoEnElemento, esRedimensionable } from '../src/lienzo/geometria.js';
import { sanearDocumentoImportado, empaquetarDocumento, desempaquetarArchivo } from '../src/archivos/formato.js';
import { marcoDePagina } from '../src/formatos/paginas.js';

test('Etapa 21A - Catálogo de formas ampliado', () => {
  const formasEsperadas = [
    'rectangulo', 'triangulo', 'linea', 'flecha', 'rombo',
    'estrella', 'hexagono', 'llave', 'nube', 'cilindro', 'cruz', 'flechaDoblada',
  ];

  for (const forma of formasEsperadas) {
    assert.ok(FORMAS.includes(forma), `FORMAS debe incluir '${forma}'`);
    assert.ok(ES_FORMA(forma), `ES_FORMA debe reconocer '${forma}'`);
  }

  const idsEnLista = LISTA_FORMAS.map(([id]) => id);
  assert.ok(idsEnLista.includes('estrella'));
  assert.ok(idsEnLista.includes('hexagono'));
  assert.ok(idsEnLista.includes('llave'));
  assert.ok(idsEnLista.includes('nube'));
  assert.ok(idsEnLista.includes('cilindro'));
  assert.ok(idsEnLista.includes('cruz'));
  assert.ok(idsEnLista.includes('flechaDoblada'));
});

test('Etapa 21A - Geometría y detección de puntos en nuevas formas poligonales', () => {
  const elEstrella = {
    id: 'el-star',
    tipo: 'figura',
    x: 100,
    y: 100,
    ancho: 100,
    alto: 100,
    datos: {
      forma: 'estrella',
      grosor: 2,
    },
  };

  const verticesEstrella = puntosForma(elEstrella);
  assert.equal(verticesEstrella.length, 10, 'La estrella de 5 puntas debe tener 10 vértices');

  // El centro (150, 150) debe estar dentro de la estrella
  assert.ok(puntoEnElemento(elEstrella, 150, 150, 4));

  const elHexagono = {
    id: 'el-hex',
    tipo: 'figura',
    x: 0,
    y: 0,
    ancho: 100,
    alto: 100,
    datos: {
      forma: 'hexagono',
      grosor: 2,
    },
  };
  const verticesHex = puntosForma(elHexagono);
  assert.equal(verticesHex.length, 6, 'El hexágono debe tener 6 vértices');
  assert.ok(puntoEnElemento(elHexagono, 50, 50, 4));
  // Punto exterior lejano no debe colisionar
  assert.ok(!puntoEnElemento(elHexagono, 200, 200, 4));

  const elCruz = {
    id: 'el-cruz',
    tipo: 'figura',
    x: 0,
    y: 0,
    ancho: 90,
    alto: 90,
    datos: {
      forma: 'cruz',
      grosor: 2,
    },
  };
  const verticesCruz = puntosForma(elCruz);
  assert.equal(verticesCruz.length, 12, 'La cruz debe tener 12 vértices');
  assert.ok(puntoEnElemento(elCruz, 45, 45, 4));
});

test('Etapa 21A - Catálogo de íconos vectoriales para estudio', () => {
  assert.ok(CATALOGO_ICONOS.length >= 60, `Debe haber al menos 60 íconos (actual: ${CATALOGO_ICONOS.length})`);
  assert.ok(CATALOGO_ICONOS.length <= 100, 'Debe haber un catálogo acotado y seleccionado');

  const categorias = CATEGORIAS_ICONOS.map((c) => c.id);
  assert.ok(categorias.includes('todas'));
  assert.ok(categorias.includes('flechas'));
  assert.ok(categorias.includes('marcas'));
  assert.ok(categorias.includes('estudio'));
  assert.ok(categorias.includes('laboratorio'));
  assert.ok(categorias.includes('anatomia'));

  // Verificar que todos los íconos tienen propiedades requeridas
  for (const icono of CATALOGO_ICONOS) {
    assert.ok(icono.id, 'Ícono debe tener id');
    assert.ok(icono.nombre, 'Ícono debe tener nombre');
    assert.ok(icono.categoria, 'Ícono debe tener categoria');
    assert.ok(icono.palabras && typeof icono.palabras === 'string', 'Ícono debe tener palabras clave');
    assert.ok(icono.d && typeof icono.d === 'string', 'Ícono debe tener trazado SVG');
  }

  // Búsqueda por palabra clave con y sin tildes
  const resultadosCorazon = buscarIconos('corazón', 'anatomia');
  assert.ok(resultadosCorazon.some((i) => i.id === 'corazon-organo'));

  const resultadosMicro = buscarIconos('microscopio', 'laboratorio');
  assert.ok(resultadosMicro.some((i) => i.id === 'microscopio'));

  const resultadosFlechas = buscarIconos('', 'flechas');
  assert.ok(resultadosFlechas.length >= 10);
});

test('Etapa 21A - Sanitización y persistencia de estilos visuales en figuras', () => {
  const figuraAvanzada = {
    id: 'fig-1',
    tipo: 'figura',
    x: 50,
    y: 50,
    ancho: 120,
    alto: 80,
    datos: {
      forma: 'nube',
      relleno: 'linear-gradient(135deg, #e0f2fe 0%, #38bdf8 100%)',
      borde: '#0284c7',
      grosor: 3,
      estiloBorde: 'guiones',
      radioEsquinas: 15,
      opacidad: 0.85,
      sombra: {
        activa: true,
        color: '#000000',
        desenfoque: 12,
        x: 4,
        y: 6,
      },
    },
  };

  const resultado = sanearDocumentoImportado({
    documento: { id: 'd1', formato: 'pizarron' },
    elementos: [figuraAvanzada],
  });
  const sanitizada = resultado.elementos[0];
  assert.equal(sanitizada.datos.forma, 'nube');
  assert.equal(sanitizada.datos.relleno, 'linear-gradient(135deg, #e0f2fe 0%, #38bdf8 100%)');
  assert.equal(sanitizada.datos.estiloBorde, 'guiones');
  assert.equal(sanitizada.datos.radioEsquinas, 15);
  assert.equal(sanitizada.datos.opacidad, 0.85);
  assert.ok(sanitizada.datos.sombra?.activa);
  assert.equal(sanitizada.datos.sombra.desenfoque, 12);
  assert.equal(sanitizada.datos.sombra.x, 4);
  assert.equal(sanitizada.datos.sombra.y, 6);
});

test('Etapa 21A - Sanitización y persistencia de estilos visuales y marcos en imágenes', () => {
  const imagenAvanzada = {
    id: 'img-1',
    tipo: 'imagen',
    x: 200,
    y: 150,
    ancho: 300,
    alto: 200,
    datos: {
      blobId: 'blob-123',
      marco: 'circulo',
      radioEsquinas: 20,
      borde: '#6366f1',
      grosor: 4,
      estiloBorde: 'puntos',
      opacidad: 0.9,
      sombra: {
        activa: true,
        color: '#0f172a',
        desenfoque: 16,
        x: 0,
        y: 8,
      },
    },
  };

  const resultado = sanearDocumentoImportado({
    documento: { id: 'd1', formato: 'pizarron' },
    elementos: [imagenAvanzada],
  });
  const sanitizada = resultado.elementos[0];
  assert.equal(sanitizada.datos.marco, 'circulo');
  assert.equal(sanitizada.datos.radioEsquinas, 20);
  assert.equal(sanitizada.datos.borde, '#6366f1');
  assert.equal(sanitizada.datos.grosor, 4);
  assert.equal(sanitizada.datos.estiloBorde, 'puntos');
  assert.equal(sanitizada.datos.opacidad, 0.9);
  assert.ok(sanitizada.datos.sombra?.activa);
  assert.equal(sanitizada.datos.sombra.desenfoque, 16);
});

test('Etapa 21A - Elemento tipo icono en modelo y persistencia', async () => {
  const iconoElemento = {
    id: 'ico-1',
    tipo: 'icono',
    x: 80,
    y: 80,
    ancho: 64,
    alto: 64,
    datos: {
      iconoId: 'adn',
      nombre: 'ADN',
      color: '#10b981',
      grosor: 2,
      modo: 'trazo',
      opacidad: 0.95,
      sombra: {
        activa: true,
        color: '#000000',
        desenfoque: 8,
        x: 0,
        y: 2,
      },
    },
  };

  const resultado = sanearDocumentoImportado({
    documento: { id: 'd1', formato: 'pizarron' },
    elementos: [iconoElemento],
  });
  const sanitizado = resultado.elementos[0];
  assert.equal(sanitizado.tipo, 'icono');
  assert.equal(sanitizado.datos.iconoId, 'adn');
  assert.equal(sanitizado.datos.color, '#10b981');
  assert.ok(esRedimensionable(sanitizado));

  // Serialización y deserialización completa de documento .nota con ícono
  const doc = {
    id: 'doc-test-1',
    version: 2,
    formato: 'paginas',
    titulo: 'Apuntes de Biología Celular',
    config: {
      fondo: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    },
  };

  const paquete = await empaquetarDocumento(doc, [sanitizado]);
  assert.ok(paquete instanceof Blob || paquete instanceof Uint8Array || typeof paquete === 'object');
  const desempaquetado = await desempaquetarArchivo(paquete);
  assert.equal(desempaquetado.tipo, 'documento');
  assert.equal(desempaquetado.elementos.length, 1);
  assert.equal(desempaquetado.elementos[0].tipo, 'icono');
  assert.equal(desempaquetado.elementos[0].datos.iconoId, 'adn');
  assert.equal(desempaquetado.documento.config.fondo, 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)');
});

test('Etapa 21A - Fondo de página en marcoDePagina', () => {
  const configConFondo = {
    fondo: '#f8fafc',
  };
  const marco = marcoDePagina(1, configConFondo);
  assert.equal(marco.fondo, '#f8fafc');

  const marcoSinFondo = marcoDePagina(1, {});
  assert.equal(marcoSinFondo.fondo, null);
});
