import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CALIFICACIONES,
  METADATOS_CALIFICACION,
  FACILIDAD_INICIAL,
  FACILIDAD_MINIMA,
  obtenerFechaHoyISO,
  sumarDiasISO,
  diasEntreFechasISO,
  calcularRepasoSM2,
  predecirIntervalos,
  formatearIntervaloParaBoton,
  construirColaDocumento,
  calcularEstadisticasRepaso,
  obtenerEstadoRepaso,
  guardarEstadoRepaso,
  listarEstadosRepasoDocumento,
  eliminarEstadosRepasoDocumento,
  eliminarEstadoRepasoTarjeta,
  obtenerLimiteNuevas,
  guardarLimiteNuevas,
  obtenerResumenRepasoBiblioteca,
} from '../src/almacen/repeticion.js';

import {
  crearDocumento,
  guardarDocumento,
  borrarDocumentoDefinitivo,
  duplicarDocumento,
  nuevoId,
} from '../src/almacen/index.js';

import {
  empaquetarDocumento,
  empaquetarColeccion,
  desempaquetarArchivo,
  sanearRepasosImportados,
} from '../src/archivos/formato.js';

import {
  duplicarElementosTarjeta,
} from '../src/formatos/tarjetas.js';

test('1. Algoritmo SM-2 y parámetros documentados', () => {
  assert.equal(FACILIDAD_INICIAL, 2.50, 'La facilidad inicial debe ser 2.50');
  assert.equal(FACILIDAD_MINIMA, 1.30, 'La facilidad mínima debe ser 1.30');

  // Tarjeta nueva calificada como «Bien»
  const hoy = '2026-06-01';
  const r1 = calcularRepasoSM2(null, CALIFICACIONES.BIEN, hoy);
  assert.equal(r1.repeticiones, 1);
  assert.equal(r1.intervalo, 1, 'Primera repetición exitosa da 1 día');
  assert.equal(r1.fechaRepaso, '2026-06-02');
  assert.equal(r1.facilidad, 2.50, 'Calificación «Bien» mantiene la facilidad inicial');
  assert.equal(r1.estado, 'repaso');
  assert.equal(r1.historial.length, 1);

  // Segunda repetición exitosa «Bien»
  const r2 = calcularRepasoSM2(r1, CALIFICACIONES.BIEN, '2026-06-02');
  assert.equal(r2.repeticiones, 2);
  assert.equal(r2.intervalo, 6, 'Segunda repetición exitosa da 6 días');
  assert.equal(r2.fechaRepaso, '2026-06-08');

  // Tercera repetición exitosa «Bien» (intervalo previo 6 * 2.5 = 15)
  const r3 = calcularRepasoSM2(r2, CALIFICACIONES.BIEN, '2026-06-08');
  assert.equal(r3.repeticiones, 3);
  assert.equal(r3.intervalo, 15, 'Tercera repetición multiplica por factor de facilidad');
  assert.equal(r3.fechaRepaso, '2026-06-23');

  // Calificación «Fácil» en tarjeta nueva: 4 días y aumenta facilidad
  const rf1 = calcularRepasoSM2(null, CALIFICACIONES.FACIL, hoy);
  assert.equal(rf1.intervalo, 4);
  assert.equal(rf1.facilidad, 2.65, 'Fácil incrementa facilidad en +0.15');

  // Calificación «Otra vez»: reinicia repeticiones a 0, intervalo 1, disminuye facilidad
  const ro = calcularRepasoSM2(r3, CALIFICACIONES.OTRA_VEZ, '2026-06-23');
  assert.equal(ro.repeticiones, 0, 'Otra vez resetea las repeticiones consecutivas a 0');
  assert.equal(ro.intervalo, 1, 'Otra vez programa repaso para mañana');
  assert.equal(ro.facilidad, 2.30, 'Otra vez reduce facilidad en 0.20');
  assert.equal(ro.estado, 'aprendiendo');

  // Límite de facilidad mínima (1.30)
  let estadoDificil = { ...r1, facilidad: 1.40 };
  estadoDificil = calcularRepasoSM2(estadoDificil, CALIFICACIONES.OTRA_VEZ, hoy);
  assert.equal(estadoDificil.facilidad, 1.30, 'No debe descender por debajo de la facilidad mínima de 1.30');
  estadoDificil = calcularRepasoSM2(estadoDificil, CALIFICACIONES.OTRA_VEZ, hoy);
  assert.equal(estadoDificil.facilidad, 1.30, 'Permanece en el límite de 1.30');
});

test('2. Manejo de fechas naturales, bisiestos y cambios de mes/año', () => {
  // Año bisiesto 2028 (28 de febrero -> 29 de febrero -> 1 de marzo)
  assert.equal(sumarDiasISO('2028-02-28', 1), '2028-02-29', '2028 es bisiesto, 28 feb + 1 da 29 feb');
  assert.equal(sumarDiasISO('2028-02-29', 1), '2028-03-01', '29 feb + 1 da 1 mar');

  // Año no bisiesto 2027 (28 de febrero -> 1 de marzo)
  assert.equal(sumarDiasISO('2027-02-28', 1), '2027-03-01', '2027 no es bisiesto, 28 feb + 1 da 1 mar');

  // Cambio de mes habitual
  assert.equal(sumarDiasISO('2026-01-31', 1), '2026-02-01');
  assert.equal(sumarDiasISO('2026-04-30', 1), '2026-05-01');

  // Cambio de año
  assert.equal(sumarDiasISO('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDiasISO('2026-12-31', 31), '2027-01-31');

  // Resta de días
  assert.equal(sumarDiasISO('2026-03-01', -1), '2026-02-28');

  // Diferencia de días
  assert.equal(diasEntreFechasISO('2026-05-01', '2026-05-10'), 9);
  assert.equal(diasEntreFechasISO('2026-02-28', '2026-03-01'), 1);
  assert.equal(diasEntreFechasISO('2028-02-28', '2028-03-01'), 2); // 29 feb en medio

  // Formato de intervalo
  assert.equal(formatearIntervaloParaBoton(0), '< 1 d');
  assert.equal(formatearIntervaloParaBoton(1), '1 d');
  assert.equal(formatearIntervaloParaBoton(6), '6 d');
  assert.equal(formatearIntervaloParaBoton(60), '2 m');
  assert.equal(formatearIntervaloParaBoton(365), '1 a');
});

test('3. Cola diaria «Para repasar hoy» y límite configurable de tarjetas nuevas', () => {
  const hoy = '2026-05-10';
  const tarjetas = [
    { id: 't1', titulo: 'Tarjeta 1' },
    { id: 't2', titulo: 'Tarjeta 2' },
    { id: 't3', titulo: 'Tarjeta 3' },
    { id: 't4', titulo: 'Tarjeta 4' },
    { id: 't5', titulo: 'Tarjeta 5' },
  ];

  const estados = [
    // t1 está vencida hoy
    { tarjetaId: 't1', estado: 'repaso', fechaRepaso: '2026-05-10' },
    // t2 vence mañana (no entra hoy)
    { tarjetaId: 't2', estado: 'repaso', fechaRepaso: '2026-05-11' },
    // t3 venció ayer (debe entrar hoy)
    { tarjetaId: 't3', estado: 'repaso', fechaRepaso: '2026-05-09' },
    // t4 y t5 son nuevas (sin registro previo)
  ];

  // Con límite de 1 tarjeta nueva:
  const cola1 = construirColaDocumento({
    tarjetas,
    estados,
    documentoId: 'doc-1',
    limiteNuevas: 1,
    fechaHoyISO: hoy,
  });

  assert.equal(cola1.cantidadRepaso, 2, 'Entran t1 (hoy) y t3 (atrasada)');
  assert.equal(cola1.cantidadNuevas, 1, 'Solo entra 1 tarjeta nueva por límite diario');
  assert.equal(cola1.total, 3);
  assert.equal(cola1.items[0].tarjeta.id, 't3', 'Las más atrasadas primero');
  assert.equal(cola1.items[1].tarjeta.id, 't1');
  assert.equal(cola1.items[2].esNueva, true);

  // Con límite de 5 tarjetas nuevas:
  const cola2 = construirColaDocumento({
    tarjetas,
    estados,
    documentoId: 'doc-1',
    limiteNuevas: 5,
    fechaHoyISO: hoy,
  });
  assert.equal(cola2.cantidadRepaso, 2);
  assert.equal(cola2.cantidadNuevas, 2, 'Entran las 2 nuevas disponibles');
  assert.equal(cola2.total, 4);
});

test('4. Estadísticas: tarjetas repasadas hoy, racha de días y porcentaje de aciertos', () => {
  const hoy = '2026-05-10';
  const ayer = '2026-05-09';
  const anteayer = '2026-05-08';

  const estadosConHistorial = [
    {
      tarjetaId: 't1',
      estado: 'repaso',
      historial: [
        { fecha: anteayer, calificacion: 'bien' },
        { fecha: ayer, calificacion: 'bien' },
        { fecha: hoy, calificacion: 'bien' },
      ],
    },
    {
      tarjetaId: 't2',
      estado: 'repaso',
      historial: [
        { fecha: ayer, calificacion: 'facil' },
        { fecha: hoy, calificacion: 'dificil' },
      ],
    },
    {
      tarjetaId: 't3',
      estado: 'aprendiendo',
      historial: [
        { fecha: hoy, calificacion: 'otra-vez' },
      ],
    },
  ];

  const stats = calcularEstadisticasRepaso(estadosConHistorial, hoy);

  // Tarjetas repasadas hoy: 3 eventos con fecha '2026-05-10'
  assert.equal(stats.repasadasHoy, 3);

  // Racha de días: hoy (10), ayer (09), anteayer (08) -> 3 días consecutivos
  assert.equal(stats.rachaDias, 3);

  // Porcentaje de aciertos:
  // Total histórico: 6 eventos
  // Aciertos ('bien' o 'facil'): 3 de 'bien' + 1 de 'facil' = 4
  // 4 / 6 * 100 = 67%
  assert.equal(stats.totalRepasosHistorico, 6);
  assert.equal(stats.totalAciertos, 4);
  assert.equal(stats.porcentajeAciertos, 67);

  // Caso racha viva aunque hoy aún no se haya repasado nada
  const statsManana = calcularEstadisticasRepaso(estadosConHistorial, '2026-05-11');
  assert.equal(statsManana.repasadasHoy, 0);
  assert.equal(statsManana.rachaDias, 3, 'Si hoy no se repasó nada aún, conserva la racha acumulada hasta ayer');

  // Caso racha rota por día sin repaso intermedio
  const statsMuchoDespues = calcularEstadisticasRepaso(estadosConHistorial, '2026-05-20');
  assert.equal(statsMuchoDespues.rachaDias, 0, 'Racha se reinicia a 0 si pasaron días sin repasar');
});

test('5. Persistencia en IndexedDB y borrado limpio', async () => {
  const docId = 'doc-test-srs-' + nuevoId();
  const tId = 'tarjeta-srs-1';

  const reg = {
    documentoId: docId,
    tarjetaId: tId,
    fechaRepaso: '2026-07-01',
    intervalo: 6,
    facilidad: 2.5,
    repeticiones: 2,
    estado: 'repaso',
    ultimoRepaso: Date.now(),
    historial: [{ fecha: '2026-06-25', calificacion: 'bien', intervalo: 6, facilidad: 2.5 }],
  };

  await guardarEstadoRepaso(reg);

  const obtenido = await obtenerEstadoRepaso(docId, tId);
  assert.ok(obtenido);
  assert.equal(obtenido.tarjetaId, tId);
  assert.equal(obtenido.intervalo, 6);

  const lista = await listarEstadosRepasoDocumento(docId);
  assert.equal(lista.length, 1);

  // Borrado de tarjeta individual
  await eliminarEstadoRepasoTarjeta(docId, tId);
  assert.equal(await obtenerEstadoRepaso(docId, tId), undefined);

  // Borrado de todo el documento
  await guardarEstadoRepaso({ ...reg, tarjetaId: 't-a' });
  await guardarEstadoRepaso({ ...reg, tarjetaId: 't-b' });
  assert.equal((await listarEstadosRepasoDocumento(docId)).length, 2);

  await eliminarEstadosRepasoDocumento(docId);
  assert.equal((await listarEstadosRepasoDocumento(docId)).length, 0);
});

test('6. Invarianza en duplicación: el progreso de la copia empieza de cero', async () => {
  // A nivel tarjeta:
  const elementos = [
    { id: 'el-1', contenedor: 't-origen', tipo: 'texto', datos: {} },
    { id: 'el-2', contenedor: 't-origen', tipo: 'figura', datos: {} },
  ];
  const clonados = duplicarElementosTarjeta(elementos, 't-origen', 't-destino');
  assert.equal(clonados.length, 2);
  assert.ok(clonados.every((e) => e.contenedor === 't-destino'));
  assert.ok(clonados.every((e) => e.id !== 'el-1' && e.id !== 'el-2'));

  // A nivel documento:
  const docOriginal = await guardarDocumento(crearDocumento({
    titulo: 'Original SRS',
    formato: 'tarjetas',
    config: {
      tarjetas: [
        { id: 'tar-1', titulo: 'Ficha 1' },
      ],
    },
  }));

  await guardarEstadoRepaso({
    documentoId: docOriginal.id,
    tarjetaId: 'tar-1',
    fechaRepaso: '2026-08-01',
    intervalo: 10,
    facilidad: 2.65,
    repeticiones: 3,
    estado: 'repaso',
    ultimoRepaso: Date.now(),
    historial: [],
  });

  const copiaDoc = await duplicarDocumento(docOriginal.id);
  assert.notEqual(copiaDoc.id, docOriginal.id);

  // El progreso del documento copia debe estar completamente vacío (empieza de cero)
  const estadosCopia = await listarEstadosRepasoDocumento(copiaDoc.id);
  assert.equal(estadosCopia.length, 0, 'La copia del documento debe iniciar con 0 repasos (progreso desde cero)');

  // El original conserva sus repasos intactos
  const estadosOrig = await listarEstadosRepasoDocumento(docOriginal.id);
  assert.equal(estadosOrig.length, 1);

  // Al borrar definitivamente el original, se purgan sus registros de repaso
  await borrarDocumentoDefinitivo(docOriginal.id);
  assert.equal((await listarEstadosRepasoDocumento(docOriginal.id)).length, 0);
  await borrarDocumentoDefinitivo(copiaDoc.id);
});

test('7. Serialización y respaldo de repasos con migración', async () => {
  const doc = crearDocumento({ titulo: 'Mazo Con Repasos', formato: 'tarjetas' });
  const elementos = [];
  const repasos = [
    {
      documentoId: doc.id,
      tarjetaId: 't-1',
      fechaRepaso: '2026-05-15',
      intervalo: 6,
      facilidad: 2.5,
      repeticiones: 2,
      estado: 'repaso',
      ultimoRepaso: 1715000000000,
      historial: [
        { fecha: '2026-05-09', calificacion: 'bien', intervalo: 6, facilidad: 2.5, timestamp: 1715000000000 },
      ],
    },
  ];

  // Empaquetar y desempaquetar archivo .nota
  const bytes = await empaquetarDocumento(doc, elementos, [], repasos);
  const desempaquetado = await desempaquetarArchivo(bytes);

  assert.equal(desempaquetado.tipo, 'documento');
  assert.equal(desempaquetado.documento.titulo, 'Mazo Con Repasos');
  assert.ok(Array.isArray(desempaquetado.repasos));
  assert.equal(desempaquetado.repasos.length, 1);
  assert.equal(desempaquetado.repasos[0].tarjetaId, 't-1');
  assert.equal(desempaquetado.repasos[0].intervalo, 6);
  assert.equal(desempaquetado.repasos[0].historial.length, 1);

  // Empaquetar y desempaquetar colección de respaldo
  const coleccionBytes = await empaquetarColeccion([{ documento: doc, elementos, recursos: [], repasos }]);
  const desColeccion = await desempaquetarArchivo(coleccionBytes);

  assert.equal(desColeccion.tipo, 'coleccion');
  assert.equal(desColeccion.items.length, 1);
  assert.equal(desColeccion.items[0].repasos.length, 1);
  assert.equal(desColeccion.items[0].repasos[0].intervalo, 6);

  // Lectura de archivos antiguos sin 'repasos' (compatibilidad hacia atrás)
  const archivoAntiguo = {
    formatoApp: 'anotomia',
    versionArchivo: 2,
    tipo: 'documento',
    documento: { id: 'v2-doc', formato: 'tarjetas', titulo: 'Antiguo' },
    elementos: [],
    // sin repasos
  };
  const bytesAntiguo = new TextEncoder().encode(JSON.stringify(archivoAntiguo));
  const desAntiguo = await desempaquetarArchivo(bytesAntiguo);
  assert.ok(Array.isArray(desAntiguo.repasos));
  assert.equal(desAntiguo.repasos.length, 0, 'Archivos antiguos se abren sin pérdidas con repasos vacíos');
});

test('8. Criterio de aceptación: mazo de 20 tarjetas, repaso, cambio de día simulado y verificación de cola y estadísticas', async () => {
  const fechaDia1 = '2026-05-01';
  const fechaDia2 = '2026-05-02';
  const fechaDia5 = '2026-05-05';

  // Creamos un mazo con 20 tarjetas
  const tarjetas20 = Array.from({ length: 20 }, (_, i) => ({
    id: `tarjeta-${i + 1}`,
    titulo: `Ficha médica ${i + 1}`,
    diseno: 'titulo-contenido',
  }));

  const mazoDoc = await guardarDocumento(crearDocumento({
    titulo: 'Mazo 20 Fichas Anatomía',
    formato: 'tarjetas',
    config: {
      tarjetas: tarjetas20,
    },
  }));

  // 1. En Día 1: comprobamos la cola inicial (todas nuevas, límite 20)
  const colaDia1 = construirColaDocumento({
    tarjetas: tarjetas20,
    estados: [],
    documentoId: mazoDoc.id,
    limiteNuevas: 20,
    fechaHoyISO: fechaDia1,
  });
  assert.equal(colaDia1.total, 20);
  assert.equal(colaDia1.cantidadNuevas, 20);
  assert.equal(colaDia1.cantidadRepaso, 0);

  // 2. Realizamos el repaso de las 20 tarjetas en Día 1:
  // - 5 calificadas «Otra vez» (intervalo 1 día -> vencen Día 2)
  // - 5 calificadas «Difícil» (rep 1, intervalo 1 día -> vencen Día 2)
  // - 5 calificadas «Bien» (rep 1, intervalo 1 día -> vencen Día 2)
  // - 5 calificadas «Fácil» (rep 1, intervalo 4 días -> vencen Día 5)
  const estadosGuardados = [];

  for (let i = 0; i < 20; i++) {
    const t = tarjetas20[i];
    let cal;
    if (i < 5) cal = CALIFICACIONES.OTRA_VEZ;
    else if (i < 10) cal = CALIFICACIONES.DIFICIL;
    else if (i < 15) cal = CALIFICACIONES.BIEN;
    else cal = CALIFICACIONES.FACIL;

    const res = calcularRepasoSM2(null, cal, fechaDia1);
    res.documentoId = mazoDoc.id;
    res.tarjetaId = t.id;
    await guardarEstadoRepaso(res);
    estadosGuardados.push(res);
  }

  // 3. Verificamos estadísticas en Día 1:
  const statsDia1 = calcularEstadisticasRepaso(estadosGuardados, fechaDia1);
  assert.equal(statsDia1.repasadasHoy, 20, '20 tarjetas repasadas hoy');
  assert.equal(statsDia1.rachaDias, 1, 'Racha de 1 día');
  // Aciertos: 5 'bien' + 5 'facil' = 10 de 20 -> 50%
  assert.equal(statsDia1.totalRepasosHistorico, 20);
  assert.equal(statsDia1.totalAciertos, 10);
  assert.equal(statsDia1.porcentajeAciertos, 50);

  // 4. Simulamos cerrar la app y reabrirla al DÍA SIGUIENTE (fechaDia2: 2026-05-02):
  const estadosDesdeBD = await listarEstadosRepasoDocumento(mazoDoc.id);
  assert.equal(estadosDesdeBD.length, 20);

  const colaDia2 = construirColaDocumento({
    tarjetas: tarjetas20,
    estados: estadosDesdeBD,
    documentoId: mazoDoc.id,
    limiteNuevas: 20,
    fechaHoyISO: fechaDia2,
  });

  // En Día 2:
  // - Las 5 «Otra vez» (intervalo 1) vencen hoy: entran
  // - Las 5 «Difícil» (intervalo 1) vencen hoy: entran
  // - Las 5 «Bien» (intervalo 1) vencen hoy: entran
  // - Las 5 «Fácil» (intervalo 4) NO vencen hoy (vencen el 2026-05-05)
  // Total para repasar en Día 2 = 15 tarjetas
  assert.equal(colaDia2.cantidadRepaso, 15, 'Las 15 tarjetas con intervalo 1 día deben estar en la cola hoy');
  assert.equal(colaDia2.cantidadNuevas, 0, 'No hay tarjetas nuevas pendientes');
  assert.equal(colaDia2.total, 15, 'Exactamente 15 tarjetas para repasar en Día 2');

  // Estadísticas al inicio de Día 2 (antes de empezar a calificar):
  const statsInicioDia2 = calcularEstadisticasRepaso(estadosDesdeBD, fechaDia2);
  assert.equal(statsInicioDia2.repasadasHoy, 0, 'Aún no se repasó ninguna tarjeta en Día 2');
  assert.equal(statsInicioDia2.rachaDias, 1, 'La racha se mantiene activa desde el día anterior');
  assert.equal(statsInicioDia2.porcentajeAciertos, 50, 'El porcentaje histórico coincide');

  // 5. Simulamos avanzar al DÍA 5 (fechaDia5: 2026-05-05):
  // Ahora las 5 tarjetas «Fácil» también han vencido:
  const colaDia5 = construirColaDocumento({
    tarjetas: tarjetas20,
    estados: estadosDesdeBD,
    documentoId: mazoDoc.id,
    limiteNuevas: 20,
    fechaHoyISO: fechaDia5,
  });
  assert.equal(colaDia5.cantidadRepaso, 20, 'En día 5 las 20 tarjetas han vencido y están en la cola');

  // Limpieza final
  await borrarDocumentoDefinitivo(mazoDoc.id);
});
