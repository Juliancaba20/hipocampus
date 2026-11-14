import test from 'node:test';
import assert from 'node:assert/strict';

import {
  obtenerCatalogoEstilos,
  resolverEstilo,
} from '../src/herramientas/texto/estilo.js';
import {
  sanear,
} from '../src/herramientas/texto/modelo.js';
import { layoutDe } from '../src/herramientas/texto/pintar.js';
import {
  buscarEnDocumento,
  reemplazarEnDocumento,
} from '../src/herramientas/busqueda/documento.js';
import {
  extraerNotasAlPieDocumento,
  generarIndiceContenido,
  crearBloquesTablaContenido,
  partirTextoPorDesborde,
} from '../src/formatos/paginas.js';
import { Escena } from '../src/lienzo/escena.js';

test('Etapa 20B · Estilos de párrafo reutilizables', () => {
  const catalogo = obtenerCatalogoEstilos();
  assert.ok(catalogo.normal, 'Debe incluir estilo normal');
  assert.ok(catalogo.titulo, 'Debe incluir estilo titulo');
  assert.ok(catalogo.subtitulo, 'Debe incluir estilo subtitulo');
  assert.ok(catalogo.definicion, 'Debe incluir estilo definicion');
  assert.ok(catalogo.importante, 'Debe incluir estilo importante');
  assert.ok(catalogo.cita, 'Debe incluir estilo cita');

  // Resolver estilo predeterminado
  const bloqueTitulo = { tipo: 'parrafo', estilo: 'titulo', runs: [{ texto: 'Título del documento' }] };
  const resTitulo = resolverEstilo(bloqueTitulo, catalogo);
  assert.strictEqual(resTitulo.negrita, true);
  assert.strictEqual(resTitulo.factor, 1.9);

  // Cascada: si el documento redefine el estilo 'titulo', el bloque adopta la nueva definición
  const estilosDoc = {
    titulo: {
      ...catalogo.titulo,
      factor: 2.2,
      color: '#dc2626',
    },
  };
  const catalogoModificado = obtenerCatalogoEstilos(estilosDoc);
  const resCascada = resolverEstilo(bloqueTitulo, catalogoModificado);
  assert.strictEqual(resCascada.factor, 2.2);
  assert.strictEqual(resCascada.color, '#dc2626');

  // Maquetar texto con estilo modificado
  const datos = {
    tamano: 20,
    bloques: [bloqueTitulo],
  };
  const layout = layoutDe(datos, 500, undefined, { estilos: catalogoModificado });
  assert.ok(layout.alto > 0);
  assert.strictEqual(layout.textos[0].color, '#dc2626');
});

test('Etapa 20B · Enlaces web e internos en texto', () => {
  const bloqueConEnlace = {
    tipo: 'parrafo',
    runs: [
      { texto: 'Visite ' },
      {
        texto: 'Google',
        enlace: { tipo: 'web', url: 'https://google.com' },
        color: '#1a73e8',
        subrayado: true,
      },
      { texto: ' para buscar.' },
    ],
  };

  const saneados = sanear([bloqueConEnlace]);
  assert.strictEqual(saneados[0].runs[1].enlace.url, 'https://google.com');
  assert.strictEqual(saneados[0].runs[1].enlace.tipo, 'web');

  // Maquetación extrae las cajas de enlaces para interactividad
  const layout = layoutDe({ tamano: 18, bloques: saneados }, 400);
  assert.ok(layout.enlaces && layout.enlaces.length === 1);
  assert.strictEqual(layout.enlaces[0].enlace.url, 'https://google.com');
  assert.ok(layout.enlaces[0].caja.ancho > 0);

  // Preparación para notas internas (Etapa 23)
  const bloqueNotaInterna = {
    tipo: 'parrafo',
    runs: [
      {
        texto: 'Ver Sección 2',
        enlace: { tipo: 'nota', url: '#pag-2', notaId: 'nota_123', bloqueId: 'bloque_456' },
      },
    ],
  };
  const saneadoNota = sanear([bloqueNotaInterna]);
  assert.strictEqual(saneadoNota[0].runs[0].enlace.tipo, 'nota');
  assert.strictEqual(saneadoNota[0].runs[0].enlace.notaId, 'nota_123');
});

test('Etapa 20B · Notas al pie numeradas en páginas A4', () => {
  const elementos = [
    {
      id: 'el_1',
      tipo: 'texto',
      contenedor: 1,
      y: 100,
      datos: {
        tamano: 16,
        bloques: [
          {
            tipo: 'parrafo',
            runs: [
              { texto: 'El ADN contiene las instrucciones genéticas' },
              { texto: '[1]', notaAlPie: 'Ácido desoxirribonucleico, base de la herencia celular.' },
              { texto: '.' },
            ],
          },
        ],
      },
    },
    {
      id: 'el_2',
      tipo: 'texto',
      contenedor: 2,
      y: 1300,
      datos: {
        tamano: 16,
        bloques: [
          {
            tipo: 'parrafo',
            runs: [
              { texto: 'La fotosíntesis' },
              { texto: '[2]', notaAlPie: 'Proceso biológico que convierte luz solar en energía química.' },
              { texto: ' ocurre en los cloroplastos.' },
            ],
          },
        ],
      },
    },
  ];

  const notasMap = extraerNotasAlPieDocumento(elementos);
  const notasPag1 = notasMap.get(1);
  const notasPag2 = notasMap.get(2);

  assert.ok(notasPag1 && notasPag1.length === 1);
  assert.strictEqual(notasPag1[0].numero, 1);
  assert.strictEqual(notasPag1[0].texto, 'Ácido desoxirribonucleico, base de la herencia celular.');

  assert.ok(notasPag2 && notasPag2.length === 1);
  assert.strictEqual(notasPag2[0].numero, 2);
  assert.strictEqual(notasPag2[0].texto, 'Proceso biológico que convierte luz solar en energía química.');
});

test('Etapa 20B · Tabla de contenido automática con salto directo', () => {
  const elementos = [
    {
      id: 't1',
      tipo: 'texto',
      contenedor: 1,
      y: 200,
      datos: {
        bloques: [
          { tipo: 'titulo1', estilo: 'titulo', runs: [{ texto: 'Introducción a la Biología' }] },
        ],
      },
    },
    {
      id: 't2',
      tipo: 'texto',
      contenedor: 3,
      y: 2500,
      datos: {
        bloques: [
          { tipo: 'titulo2', estilo: 'subtitulo', runs: [{ texto: 'Estructura Celular' }] },
        ],
      },
    },
  ];

  const entradas = generarIndiceContenido(elementos);
  assert.strictEqual(entradas.length, 2);
  assert.strictEqual(entradas[0].texto, 'Introducción a la Biología');
  assert.strictEqual(entradas[0].pagina, 1);
  assert.strictEqual(entradas[0].nivel, 1);

  assert.strictEqual(entradas[1].texto, 'Estructura Celular');
  assert.strictEqual(entradas[1].pagina, 3);
  assert.strictEqual(entradas[1].nivel, 2);

  // Creación de bloques para la tabla de contenido
  const bloquesTOC = crearBloquesTablaContenido(entradas);
  assert.ok(bloquesTOC.length >= 3);
  // Debe contener enlace con #pag-X para salto directo
  const enlaceIntro = bloquesTOC[1].runs[0].enlace;
  assert.ok(enlaceIntro);
  assert.strictEqual(enlaceIntro.url, '#pag-1');
});

test('Etapa 20B · Saltos de página manuales en páginas A4', () => {
  const marco = { x: 0, y: 0, ancho: 794, alto: 1123 };
  const elemento = {
    id: 'el_salto',
    tipo: 'texto',
    x: 60,
    y: 100,
    ancho: 674,
    alto: 400,
    datos: {
      tamano: 20,
      bloques: [
        { tipo: 'parrafo', runs: [{ texto: 'Contenido antes del salto.' }] },
        { tipo: 'saltoPagina', saltoPagina: true, runs: [] },
        { tipo: 'parrafo', runs: [{ texto: 'Contenido después del salto, debe ir a la página siguiente.' }] },
      ],
    },
  };

  const partido = partirTextoPorDesborde(elemento, marco, (prefix) => prefix + '_nuevo');
  assert.ok(partido, 'Debe partirse en dos elementos por el salto de página');
  assert.strictEqual(partido.elemento1.datos.bloques.length, 1);
  assert.strictEqual(partido.elemento1.datos.bloques[0].runs[0].texto, 'Contenido antes del salto.');
  assert.strictEqual(partido.elemento2.datos.bloques.length, 1);
  assert.strictEqual(partido.elemento2.datos.bloques[0].runs[0].texto, 'Contenido después del salto, debe ir a la página siguiente.');
  assert.ok(partido.elemento2.y >= marco.alto, 'El segundo elemento debe quedar en la hoja siguiente');
});

test('Etapa 20B · Buscar y reemplazar con coincidencia de mayúsculas y acción atómica de historial', () => {
  const elementos = [
    {
      id: 'txt_1',
      tipo: 'texto',
      datos: {
        tamano: 18,
        bloques: [
          {
            tipo: 'parrafo',
            runs: [
              { texto: 'El ADN humano es fascinante. El adn contiene genes.' },
            ],
          },
        ],
      },
    },
    {
      id: 'txt_2',
      tipo: 'texto',
      datos: {
        tamano: 18,
        bloques: [
          {
            tipo: 'parrafo',
            runs: [
              { texto: 'Estudio de ADN mitocondrial.' },
            ],
          },
        ],
      },
    },
  ];

  const escena = new Escena(elementos);

  // Búsqueda distinguiendo mayúsculas
  const resMayus = buscarEnDocumento('ADN', escena.lista(), { coincidirMayusculas: true });
  assert.strictEqual(resMayus.length, 2);

  // Búsqueda sin distinguir mayúsculas
  const resNoMayus = buscarEnDocumento('ADN', escena.lista(), { coincidirMayusculas: false });
  assert.strictEqual(resNoMayus.length, 3);

  // Reemplazo atómico masivo (todos) distinguiendo mayúsculas
  const resultadoReemplazo = reemplazarEnDocumento({
    escena,
    consulta: 'ADN',
    reemplazo: 'ÁCIDO',
    coincidirMayusculas: true,
    reemplazarTodos: true,
  });
  assert.strictEqual(resultadoReemplazo.totalReemplazos, 2);

  // Verificar que el 'adn' en minúsculas no cambió
  const el1Despues = escena.get('txt_1');
  const txt1 = el1Despues.datos.bloques[0].runs[0].texto;
  assert.ok(txt1.includes('El ÁCIDO humano'));
  assert.ok(txt1.includes('El adn contiene'));

  // Verificar que la acción en historial fue una sola (atómica)
  assert.strictEqual(escena.historial.pasado.length, 1);
  // Un solo deshacer revierte todos los cambios de todos los bloques
  escena.deshacer();
  assert.strictEqual(escena.get('txt_1').datos.bloques[0].runs[0].texto, 'El ADN humano es fascinante. El adn contiene genes.');
  assert.strictEqual(escena.get('txt_2').datos.bloques[0].runs[0].texto, 'Estudio de ADN mitocondrial.');

  // Rehacer restaura todo en una sola acción
  escena.rehacer();
  assert.ok(escena.get('txt_1').datos.bloques[0].runs[0].texto.includes('El ÁCIDO humano'));
});
