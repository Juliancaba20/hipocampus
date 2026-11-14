import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearDocumento, crearElemento, guardarDocumento, guardarElementos,
  enviarAPapelera,
  normalizar, extraerTextoDeElemento, construirEntradaIndice,
  guardarEnIndice, obtenerDeIndice, eliminarDeIndice,
  reconstruirIndice, buscarEnIndice, extraerFragmentoConResaltado,
  guardarCarpeta,
} from '../src/almacen/index.js';

test('normalizar quita mayúsculas, tildes y espacios laterales de forma idéntica al catálogo de símbolos', () => {
  assert.equal(normalizar('Anatomía Cardíaca'), 'anatomia cardiaca');
  assert.equal(normalizar('  ESÓFAGO Y ESTÓMAGO  '), 'esofago y estomago');
  assert.equal(normalizar('Célula ß y glóbulos rojos'), 'celula ß y globulos rojos');
  assert.equal(normalizar(null), '');
  assert.equal(normalizar(undefined), '');
});

test('extraerTextoDeElemento extrae párrafos, encabezados, listas y celdas individuales de tablas con coordenadas', () => {
  const elTexto = {
    id: 'el_1',
    tipo: 'texto',
    x: 150,
    y: 300,
    ancho: 400,
    alto: 250,
    contenedor: 'tarjeta_alpha',
    datos: {
      bloques: [
        {
          tipo: 'titulo1',
          runs: [{ texto: 'Sistema Circulatorio' }],
        },
        {
          tipo: 'parrafo',
          runs: [{ texto: 'El miocardio es el tejido muscular del corazón.' }],
        },
        {
          tipo: 'tabla',
          encabezado: true,
          filas: [
            [{ runs: [{ texto: 'Cámara' }] }, { runs: [{ texto: 'Función' }] }],
            [{ runs: [{ texto: 'Ventrículo izquierdo' }] }, { runs: [{ texto: 'Bombea sangre a la aorta' }] }],
          ],
        },
      ],
    },
  };

  const entradas = extraerTextoDeElemento(elTexto);
  assert.equal(entradas.length, 6); // titulo1 + parrafo + 4 celdas de tabla

  const entradaParrafo = entradas.find((e) => e.tipo === 'texto' && e.subtipo === 'parrafo');
  assert.ok(entradaParrafo);
  assert.equal(entradaParrafo.texto, 'El miocardio es el tejido muscular del corazón.');
  assert.equal(entradaParrafo.textoNormalizado, 'el miocardio es el tejido muscular del corazon.');
  assert.equal(entradaParrafo.ubicacion.x, 150);
  assert.equal(entradaParrafo.ubicacion.y, 300);
  assert.equal(entradaParrafo.ubicacion.contenedor, 'tarjeta_alpha');

  const celdaVentriculo = entradas.find((e) => e.tipo === 'tabla' && e.texto.includes('Ventrículo'));
  assert.ok(celdaVentriculo);
  assert.equal(celdaVentriculo.fila, 2);
  assert.equal(celdaVentriculo.columna, 1);
  assert.equal(celdaVentriculo.textoNormalizado, 'ventriculo izquierdo');
});

test('extraerFragmentoConResaltado genera recorte con el término marcado y contexto', () => {
  const original = 'En la fisiología respiratoria, los alvéolos pulmonares permiten el intercambio gaseoso con los capilares.';
  const normalizado = normalizar(original);
  const qNorm = normalizar('alvéolos');

  const { fragmento, partes } = extraerFragmentoConResaltado(original, normalizado, qNorm, 25);
  assert.ok(fragmento.includes('alvéolos'));
  assert.ok(partes.some((p) => p.coincide && p.texto === 'alvéolos'));
  assert.ok(partes.some((p) => !p.coincide));
});

test('almacén de índice en IndexedDB guarda, recupera y elimina registros de documentos', async () => {
  const doc = crearDocumento({ titulo: 'Biofísica del sonido' });
  const entrada = construirEntradaIndice(doc, [], { nombre: 'Física Médica' });

  await guardarEnIndice(entrada);
  const obtenido = await obtenerDeIndice(doc.id);
  assert.ok(obtenido);
  assert.equal(obtenido.titulo, 'Biofísica del sonido');
  assert.equal(obtenido.materia, 'Física Médica');

  await eliminarDeIndice(doc.id);
  const despuesDeBorrar = await obtenerDeIndice(doc.id);
  assert.equal(despuesDeBorrar, undefined);
});

test('filtro de papelera: excluye notas eliminadas salvo que se solicite expresamente', async () => {
  const docActivo = await guardarDocumento(crearDocumento({ titulo: 'Histología del hígado' }));
  let docPapelera = await guardarDocumento(crearDocumento({ titulo: 'Histología del bazo' }));
  docPapelera = await enviarAPapelera(docPapelera);

  const regActivo = construirEntradaIndice(docActivo, []);
  const regPapelera = construirEntradaIndice(docPapelera, []);

  await guardarEnIndice(regActivo);
  await guardarEnIndice(regPapelera);

  const busqSinPapelera = await buscarEnIndice('histologia', { incluirPapelera: false });
  assert.equal(busqSinPapelera.resultados.length, 1);
  assert.equal(busqSinPapelera.resultados[0].documentoId, docActivo.id);

  const busqConPapelera = await buscarEnIndice('histologia', { incluirPapelera: true });
  assert.equal(busqConPapelera.resultados.length, 2);
  assert.ok(busqConPapelera.resultados.some((r) => r.enPapelera === true));
});

test('reconstruirIndice procesa todos los documentos e informa el avance con la barra de progreso', async () => {
  const d1 = await guardarDocumento(crearDocumento({ titulo: 'Neuroanatomía I' }));
  const d2 = await guardarDocumento(crearDocumento({ titulo: 'Neuroanatomía II' }));

  const progresos = [];
  const resultado = await reconstruirIndice((p) => {
    progresos.push({ ...p });
  });

  assert.ok(resultado.total >= 2);
  assert.ok(progresos.some((p) => p.estado === 'iniciando'));
  assert.ok(progresos.some((p) => p.estado === 'completado' && p.porcentaje === 100));

  const busq = await buscarEnIndice('neuroanatomia');
  assert.ok(busq.resultados.some((r) => r.documentoId === d1.id));
  assert.ok(busq.resultados.some((r) => r.documentoId === d2.id));
});

test('criterio de aceptación: con 50 documentos de prueba, la búsqueda responde en menos de un segundo y abre el lugar exacto', async () => {
  // Crear materia para pruebas
  const materia = await guardarCarpeta({ nombre: 'Embriología Humana', color: '#2350d8' });

  // Sembrar 50 documentos de prueba en base de datos
  const docsCreados = [];
  for (let i = 1; i <= 50; i++) {
    const formato = i === 33 ? 'paginas' : i === 42 ? 'tarjetas' : i === 15 ? 'pizarron' : (i % 3 === 0 ? 'tarjetas' : i % 3 === 1 ? 'paginas' : 'pizarron');
    const doc = crearDocumento({
      titulo: `Apuntes Médicos Tema ${i} - Introducción`,
      formato,
      carpetaId: i % 5 === 0 ? materia.id : null,
      etiquetas: [`etiqueta${i}`, i === 25 ? 'terminoespecial' : 'general'],
    });
    docsCreados.push(doc);
    await guardarDocumento(doc);

    // Contenido textual específico en algunos documentos
    if (i === 15) {
      // Nota en pizarrón con coordenadas precisas
      const elTexto = crearElemento(doc.id, 'texto', {
        x: 820,
        y: 1450,
        ancho: 320,
        alto: 180,
        datos: {
          bloques: [
            { tipo: 'parrafo', runs: [{ texto: 'La sinapsis química utiliza neurotransmisores en la hendidura.' }] },
          ],
        },
      });
      await guardarElementos([elTexto]);
    } else if (i === 33) {
      // Nota en páginas A4 con página específica
      const elTabla = crearElemento(doc.id, 'texto', {
        x: 60,
        y: 2400,
        ancho: 500,
        alto: 200,
        contenedor: 3, // Página 3 de A4
        datos: {
          bloques: [
            {
              tipo: 'tabla',
              filas: [
                [{ runs: [{ texto: 'Glóbulo' }] }, { runs: [{ texto: 'Leucocitos neutrófilos segmentados' }] }],
              ],
            },
          ],
        },
      });
      await guardarElementos([elTabla]);
    } else if (i === 42) {
      // Nota en tarjetas con ficha específica
      const elTarjeta = crearElemento(doc.id, 'texto', {
        x: 100,
        y: 100,
        ancho: 300,
        alto: 150,
        contenedor: 'ficha_farmacologia_beta',
        datos: {
          bloques: [
            { tipo: 'titulo2', runs: [{ texto: 'Farmacocinética y biodisponibilidad' }] },
          ],
        },
      });
      await guardarElementos([elTarjeta]);
    }
  }

  // Reconstruir el índice completo desde cero
  const tReconstruirInicio = Date.now();
  await reconstruirIndice();
  const duracionReconstruccion = Date.now() - tReconstruirInicio;
  assert.ok(duracionReconstruccion < 5000, `La reconstrucción de 50 notas no debe exceder 5s (fue ${duracionReconstruccion}ms)`);

  // Búsqueda 1: Buscar término en celda de tabla en nota de Páginas A4
  const tBusqInicio = Date.now();
  const resTabla = await buscarEnIndice('neutrofilos');
  const tBusqDuracion = Date.now() - tBusqInicio;

  // Criterio de aceptación: responde en menos de 1 segundo (1000 ms)
  assert.ok(tBusqDuracion < 1000, `La búsqueda debe responder en menos de 1000 ms (tardó ${tBusqDuracion} ms)`);
  assert.equal(resTabla.resultados.length, 1);

  const docMatchTabla = resTabla.resultados[0];
  assert.equal(docMatchTabla.documentoId, docsCreados[32].id); // Documento 33 (índice 32)
  assert.equal(docMatchTabla.formato, 'paginas');

  const coincidenciaTabla = docMatchTabla.coincidencias[0];
  assert.equal(coincidenciaTabla.tipo, 'tabla');
  assert.equal(coincidenciaTabla.ubicacion.contenedor, 3); // Lleva a la página 3 exacta
  assert.equal(coincidenciaTabla.ubicacion.y, 2400);

  // Búsqueda 2: Buscar en pizarrón por término en párrafo
  const resPizarron = await buscarEnIndice('sinapsis quimica');
  assert.ok(resPizarron.tiempoMs < 1000);
  assert.equal(resPizarron.resultados.length, 1);
  const matchPiz = resPizarron.resultados[0];
  assert.equal(matchPiz.formato, 'pizarron');
  assert.equal(matchPiz.coincidencias[0].ubicacion.x, 820);
  assert.equal(matchPiz.coincidencias[0].ubicacion.y, 1450);

  // Búsqueda 3: Buscar en tarjetas por encabezado
  const resTarjetas = await buscarEnIndice('biodisponibilidad');
  assert.equal(resTarjetas.resultados.length, 1);
  const matchTar = resTarjetas.resultados[0];
  assert.equal(matchTar.formato, 'tarjetas');
  assert.equal(matchTar.coincidencias[0].ubicacion.contenedor, 'ficha_farmacologia_beta');

  // Búsqueda 4: Buscar materia
  const resMateria = await buscarEnIndice('embriologia');
  assert.ok(resMateria.resultados.length >= 10); // Todos los múltiplos de 5
});
