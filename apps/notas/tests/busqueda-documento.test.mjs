// Pruebas de la Etapa 18B: Buscar dentro del documento abierto (Ctrl+F).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarEnDocumento, extraerCoincidenciasDeElemento } from '../src/herramientas/busqueda/documento.js';
import { Escena } from '../src/lienzo/escena.js';

test('extraerCoincidenciasDeElemento encuentra todas las ocurrencias y normaliza tildes y mayúsculas', () => {
  const elemento = {
    id: 'el-1',
    tipo: 'texto',
    x: 100,
    y: 200,
    ancho: 400,
    alto: 150,
    contenedor: 1,
    datos: {
      bloques: [
        {
          id: 'b-1',
          tipo: 'parrafo',
          runs: [
            { texto: 'La fotosíntesis es fundamental. FOTOSINTESIS en plantas.' },
          ],
        },
      ],
    },
  };

  const coincidencias = extraerCoincidenciasDeElemento(elemento, 'fotosintesis');
  assert.equal(coincidencias.length, 2, 'Debe encontrar 2 coincidencias ignorando mayúsculas y acentos');
  assert.equal(coincidencias[0].elementoId, 'el-1');
  assert.equal(coincidencias[0].ubicacion.contenedor, 1);
  assert.equal(coincidencias[0].cajaDestacada.x, 100);
});

test('extraerCoincidenciasDeElemento busca en celdas de tablas', () => {
  const tabla = {
    id: 'tabla-1',
    tipo: 'texto',
    x: 50,
    y: 80,
    ancho: 300,
    alto: 200,
    contenedor: 2,
    datos: {
      bloques: [
        {
          id: 'b-tabla',
          tipo: 'tabla',
          filas: [
            [
              { runs: [{ texto: 'Elemento' }] },
              { runs: [{ texto: 'Masa' }] },
            ],
            [
              { runs: [{ texto: 'Hidrógeno' }] },
              { runs: [{ texto: '1.008' }] },
            ],
            [
              { runs: [{ texto: 'Oxígeno' }] },
              { runs: [{ texto: '15.999' }] },
            ],
          ],
        },
      ],
    },
  };

  const coincidencias = extraerCoincidenciasDeElemento(tabla, 'hidrogeno');
  assert.equal(coincidencias.length, 1);
  assert.equal(coincidencias[0].tipo, 'tabla');
  assert.equal(coincidencias[0].fila, 2);
  assert.equal(coincidencias[0].columna, 1);
  assert.equal(coincidencias[0].ubicacion.contenedor, 2);
});

test('Criterio de aceptación 18B: Documento de 20 páginas A4 encuentra y recorre todas las coincidencias en orden', () => {
  // Crear 20 páginas A4 con elementos de texto en cada una
  const elementos = [];
  const termino = 'hipotesis';

  for (let pag = 1; pag <= 20; pag++) {
    // Colocar varios bloques por página con coordenadas verticales crecientes
    elementos.push({
      id: `pag_${pag}_bloque_1`,
      tipo: 'texto',
      x: 60,
      y: (pag - 1) * 1180 + 100,
      ancho: 500,
      alto: 60,
      contenedor: pag,
      datos: {
        bloques: [
          { id: `b1_${pag}`, tipo: 'parrafo', runs: [{ texto: `Página ${pag}: Planteamiento de la hipótesis inicial.` }] },
        ],
      },
    });

    if (pag % 2 === 0) {
      elementos.push({
        id: `pag_${pag}_bloque_2`,
        tipo: 'texto',
        x: 60,
        y: (pag - 1) * 1180 + 350,
        ancho: 500,
        alto: 60,
        contenedor: pag,
        datos: {
          bloques: [
            { id: `b2_${pag}`, tipo: 'parrafo', runs: [{ texto: `Comprobación: se valida la HIPÓTESIS experimental.` }] },
          ],
        },
      },);
    }
  }

  // 20 páginas: 20 ocurrencias en bloque 1 + 10 en bloque 2 (páginas pares) = 30 ocurrencias
  const resultados = buscarEnDocumento(termino, elementos);
  assert.equal(resultados.length, 30, 'Encuentra las 30 ocurrencias en las 20 páginas');

  // Verificar que el orden de lectura recorre página 1 -> página 2 -> ... -> página 20
  for (let i = 0; i < resultados.length - 1; i++) {
    const act = resultados[i];
    const sig = resultados[i + 1];
    const pagAct = Number(act.ubicacion.contenedor);
    const pagSig = Number(sig.ubicacion.contenedor);

    assert.ok(
      pagAct <= pagSig,
      `El orden de lectura debe avanzar por páginas (pág ${pagAct} <= pág ${pagSig})`
    );

    if (pagAct === pagSig) {
      assert.ok(
        act.ubicacion.y <= sig.ubicacion.y,
        `En la misma página debe avanzar de arriba hacia abajo (y ${act.ubicacion.y} <= ${sig.ubicacion.y})`
      );
    }
  }

  // Simular navegación cíclica «1 de 30» a «30 de 30»
  let indiceActual = 0;
  const siguiente = () => { indiceActual = (indiceActual + 1) % resultados.length; };
  const anterior = () => { indiceActual = (indiceActual - 1 + resultados.length) % resultados.length; };

  assert.equal(indiceActual + 1, 1);
  siguiente();
  assert.equal(indiceActual + 1, 2);
  anterior();
  assert.equal(indiceActual + 1, 1);
  anterior();
  assert.equal(indiceActual + 1, 30); // Ciclo al final
});

test('Criterio de aceptación 18B: Pizarrón libre encuentra coincidencias en múltiples elementos dispersos', () => {
  const elementos = [
    {
      id: 'piz-1',
      tipo: 'texto',
      x: -500,
      y: -200,
      ancho: 300,
      alto: 80,
      contenedor: null,
      datos: {
        bloques: [{ id: 'b-1', runs: [{ texto: 'Nodo A: concepto cuántico' }] }],
      },
    },
    {
      id: 'piz-2',
      tipo: 'texto',
      x: 1200,
      y: 800,
      ancho: 400,
      alto: 100,
      contenedor: null,
      datos: {
        bloques: [{ id: 'b-2', runs: [{ texto: 'Nodo B: entrelazamiento cuántico avanzado' }] }],
      },
    },
  ];

  const resultados = buscarEnDocumento('cuantico', elementos);
  assert.equal(resultados.length, 2);
  assert.equal(resultados[0].elementoId, 'piz-1');
  assert.equal(resultados[1].elementoId, 'piz-2');
});

test('Garantía de no mutación: buscar y recorrer coincidencias NO altera textos ni el historial de la escena', () => {
  const elementoInicial = {
    id: 'el-firme',
    tipo: 'texto',
    x: 100,
    y: 100,
    ancho: 300,
    alto: 80,
    contenedor: 1,
    datos: {
      bloques: [{ id: 'b-firme', runs: [{ texto: 'Texto inmutable de prueba' }] }],
    },
  };

  const escena = new Escena([elementoInicial]);
  const copiaJsonAntes = JSON.stringify(escena.lista());
  const versionAntes = escena.version;
  const puedeDeshacerAntes = escena.historial.puedeDeshacer();
  const puedeRehacerAntes = escena.historial.puedeRehacer();

  // Búsqueda repetida
  const resultados = buscarEnDocumento('inmutable', escena.lista());
  assert.equal(resultados.length, 1);

  // Recorrido simulado
  const primerResultado = resultados[0];
  assert.equal(primerResultado.texto, 'Texto inmutable de prueba');

  // Comprobar invariantes de la escena
  assert.equal(JSON.stringify(escena.lista()), copiaJsonAntes, 'Los elementos en la escena no deben modificarse');
  assert.equal(escena.version, versionAntes, 'La versión de la escena no debe cambiar');
  assert.equal(escena.historial.puedeDeshacer(), puedeDeshacerAntes, 'No se deben agregar entradas al historial');
  assert.equal(escena.historial.puedeRehacer(), puedeRehacerAntes, 'El estado de rehacer no debe cambiar');
});
