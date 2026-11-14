import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLANTILLAS_SISTEMA,
  listarTodasLasPlantillas,
  listarPlantillasPropias,
  guardarPlantillaPropia,
  renombrarPlantillaPropia,
  eliminarPlantillaPropia,
  importarPlantillasPropias,
  crearDocumentoDesdePlantilla,
} from '../src/plantillas/index.js';

import {
  empaquetarColeccion,
  desempaquetarArchivo,
  sanearDocumentoImportado,
} from '../src/archivos/formato.js';

// Mock de localStorage en memoria para entornos Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

test('Etapa 21C - Plantillas de sistema definidas y ligeras', () => {
  const ids = PLANTILLAS_SISTEMA.map((p) => p.id);
  assert.ok(ids.includes('cornell'), 'Debe incluir plantilla Cornell');
  assert.ok(ids.includes('resumen'), 'Debe incluir plantilla Resumen');
  assert.ok(ids.includes('clase'), 'Debe incluir plantilla Clase');
  assert.ok(ids.includes('repaso'), 'Debe incluir plantilla Repaso');
  assert.ok(ids.includes('cuadro-comparativo'), 'Debe incluir plantilla Cuadro comparativo');
  assert.ok(ids.includes('linea-tiempo'), 'Debe incluir plantilla Línea de tiempo');

  PLANTILLAS_SISTEMA.forEach((p) => {
    assert.ok(p.id, 'La plantilla debe tener id');
    assert.ok(p.nombre, 'La plantilla debe tener nombre');
    assert.ok(p.formato, 'La plantilla debe tener formato');
    assert.ok(['pizarron', 'paginas', 'tarjetas'].includes(p.formato), 'Formato válido');
    assert.ok(p.descripcion, 'La plantilla debe tener descripción');
    assert.ok(Array.isArray(p.elementos), 'Los elementos deben ser un arreglo');
    assert.ok(p.elementos.length > 0, `La plantilla ${p.id} debe contener elementos predefinidos`);
  });
});

test('Etapa 21C - Creación de documento desde plantilla clona con nuevos IDs y remapea conectores', async () => {
  const cornell = PLANTILLAS_SISTEMA.find((p) => p.id === 'cornell');
  const res = await crearDocumentoDesdePlantilla(cornell, 'Mis apuntes Cornell');

  assert.ok(res.doc, 'Debe devolver doc');
  assert.equal(res.doc.titulo, 'Mis apuntes Cornell');
  assert.equal(res.doc.formato, 'paginas');
  assert.ok(res.elementos.length > 0, 'Debe contener elementos');

  // Comprobar que ningún elemento conserva los IDs estáticos de la plantilla
  const idsPlantilla = new Set(cornell.elementos.map((e) => e.id));
  res.elementos.forEach((el) => {
    assert.ok(!idsPlantilla.has(el.id), 'Los elementos nuevos no deben tener IDs de la plantilla');
    assert.equal(el.documentoId, res.doc.id, 'Los elementos deben asociarse al nuevo doc');
  });

  // Prueba con plantilla de línea de tiempo (que contiene conectores anclados a formas)
  const linea = PLANTILLAS_SISTEMA.find((p) => p.id === 'linea-tiempo');
  const resLinea = await crearDocumentoDesdePlantilla(linea, 'Historia contemporánea');
  const conectores = resLinea.elementos.filter(
    (e) => e.tipo === 'figura' && (e.datos?.forma === 'linea' || e.datos?.forma === 'flecha') && (e.datos?.anclajeInicio || e.datos?.anclajeFin)
  );
  assert.ok(conectores.length > 0, 'La línea de tiempo debe tener conectores anclados');

  const nuevoSetIds = new Set(resLinea.elementos.map((e) => e.id));
  conectores.forEach((c) => {
    if (c.datos?.anclajeInicio?.elementoId) {
      assert.ok(nuevoSetIds.has(c.datos.anclajeInicio.elementoId), 'El anclaje inicio debe apuntar a un nuevo ID instanciado');
    }
    if (c.datos?.anclajeFin?.elementoId) {
      assert.ok(nuevoSetIds.has(c.datos.anclajeFin.elementoId), 'El anclaje fin debe apuntar a un nuevo ID instanciado');
    }
  });
});

test('Etapa 21C - Gestión de plantillas propias (guardar, renombrar, eliminar)', async () => {
  localStorage.clear();
  const { guardarAjuste } = await import('../src/almacen/ajustes.js');
  const { CLAVE_PLANTILLAS_PROPIAS } = await import('../src/plantillas/index.js');
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, []);
  assert.equal((await listarPlantillasPropias()).length, 0);

  const doc = {
    id: 'doc-prueba-1',
    titulo: 'Mi estructura de ficha',
    formato: 'tarjetas',
    config: { tamano: '4:3', fondo: '#f8fafc' },
    renglones: { tipo: 'puntos', espaciado: 30 },
  };

  const elementos = [
    { id: 'el-1', tipo: 'figura', figura: 'rectangulo', x: 20, y: 20, ancho: 100, alto: 60, contenedor: 't-1' },
    { id: 'el-2', tipo: 'texto', x: 30, y: 30, texto: 'Pregunta', contenedor: 't-1', pasoEstudio: 1 },
    { id: 'el-3', tipo: 'texto', x: 30, y: 100, texto: 'Respuesta', contenedor: 't-1', pasoEstudio: 2 },
  ];

  const pGuardada = await guardarPlantillaPropia(doc, elementos, {
    nombre: 'Plantilla de Pregunta y Respuesta',
    descripcion: 'Tarjeta con pregunta y respuesta por pasos',
    icono: 'tarjeta',
  });

  assert.ok(pGuardada.id.startsWith('propia_'));
  assert.equal(pGuardada.nombre, 'Plantilla de Pregunta y Respuesta');
  assert.equal(pGuardada.esPropia, true);
  assert.equal(pGuardada.elementos.length, 3);

  let propias = await listarPlantillasPropias();
  assert.equal(propias.length, 1);
  assert.equal(propias[0].nombre, 'Plantilla de Pregunta y Respuesta');

  // Renombrar plantilla
  const renombrada = await renombrarPlantillaPropia(pGuardada.id, 'Ficha Q&A Médica');
  assert.ok(renombrada);
  assert.equal(renombrada.nombre, 'Ficha Q&A Médica');
  assert.equal((await listarPlantillasPropias())[0].nombre, 'Ficha Q&A Médica');

  // Listar todas incluye las de sistema + la propia
  const todas = await listarTodasLasPlantillas();
  assert.equal(todas.length, PLANTILLAS_SISTEMA.length + 1);

  // Instanciar documento desde la plantilla propia
  const instanciada = await crearDocumentoDesdePlantilla(renombrada, 'Ficha Anatomía');
  assert.equal(instanciada.doc.titulo, 'Ficha Anatomía');
  assert.equal(instanciada.elementos.length, 3);
  assert.equal(instanciada.elementos[1].pasoEstudio, 1);
  assert.equal(instanciada.elementos[2].pasoEstudio, 2);

  // Eliminar plantilla propia
  await eliminarPlantillaPropia(pGuardada.id);
  assert.equal((await listarPlantillasPropias()).length, 0);
});

test('Etapa 21C - Empaquetado y desempaquetado de respaldo con plantillas propias', async () => {
  localStorage.clear();
  const { guardarAjuste } = await import('../src/almacen/ajustes.js');
  const { CLAVE_PLANTILLAS_PROPIAS } = await import('../src/plantillas/index.js');
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, []);

  const doc = {
    id: 'doc-para-plantilla',
    titulo: 'Doc Base',
    formato: 'paginas',
    config: {},
  };
  const elementos = [{ id: 'e-1', tipo: 'figura', figura: 'hexagono', x: 10, y: 10, ancho: 50, alto: 50 }];
  const plantilla = await guardarPlantillaPropia(doc, elementos, { nombre: 'Plantilla para respaldo' });

  // Empaquetar colección completa
  const items = [{
    documento: doc,
    elementos: [{ ...elementos[0], documentoId: doc.id }],
    recursos: [],
  }];
  const paqueteBytes = await empaquetarColeccion(items, [], [plantilla]);
  assert.ok(paqueteBytes instanceof Uint8Array);

  // Desempaquetar
  const datos = await desempaquetarArchivo(paqueteBytes);
  assert.equal(datos.tipo, 'coleccion');
  assert.ok(Array.isArray(datos.plantillas));
  assert.equal(datos.plantillas.length, 1);
  assert.equal(datos.plantillas[0].nombre, 'Plantilla para respaldo');

  // Probar restauración mediante importarPlantillasPropias
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, []);
  assert.equal((await listarPlantillasPropias()).length, 0);

  const importadas = await importarPlantillasPropias(datos.plantillas);
  assert.equal(importadas.length, 1);
  assert.equal((await listarPlantillasPropias()).length, 1);
  assert.equal((await listarPlantillasPropias())[0].nombre, 'Plantilla para respaldo');
});

test('Etapa 21C - Revelación de elementos por pasos (pasoEstudio)', () => {
  const elementosTarjeta = [
    { id: 'base-1', tipo: 'figura', figura: 'rectangulo' }, // Sin paso (siempre visible)
    { id: 'paso-1', tipo: 'texto', texto: 'Título', pasoEstudio: 1 },
    { id: 'paso-2', tipo: 'texto', texto: 'Detalle anatómico', pasoEstudio: 2 },
    { id: 'paso-3', tipo: 'texto', texto: 'Conclusión diagnóstica', pasoEstudio: 3 },
  ];

  // Cálculo del máximo paso
  const maxPaso = elementosTarjeta.reduce((m, el) => Math.max(m, el.pasoEstudio || 0), 0);
  assert.equal(maxPaso, 3, 'El máximo paso debe ser 3');

  // En paso 1: solo base-1 y paso-1 deben ser visibles
  const paso1 = elementosTarjeta.filter((el) => !el.pasoEstudio || el.pasoEstudio <= 1);
  assert.equal(paso1.length, 2);
  assert.deepEqual(paso1.map((e) => e.id), ['base-1', 'paso-1']);

  // En paso 2: base-1, paso-1 y paso-2 visibles
  const paso2 = elementosTarjeta.filter((el) => !el.pasoEstudio || el.pasoEstudio <= 2);
  assert.equal(paso2.length, 3);
  assert.deepEqual(paso2.map((e) => e.id), ['base-1', 'paso-1', 'paso-2']);

  // En paso 3 (todos visibles):
  const paso3 = elementosTarjeta.filter((el) => !el.pasoEstudio || el.pasoEstudio <= 3);
  assert.equal(paso3.length, 4);

  // Sanitización de elemento con pasoEstudio
  const saneadoValido = sanearDocumentoImportado({
    documento: { id: 'doc-1', titulo: 'Doc', formato: 'tarjetas' },
    elementos: [{
      id: 'e1', tipo: 'texto', x: 10, y: 10, ancho: 100, alto: 50, pasoEstudio: 2,
      datos: { bloques: [] },
    }],
  });
  assert.equal(saneadoValido.elementos[0].pasoEstudio, 2);

  const saneadoInvalido = sanearDocumentoImportado({
    documento: { id: 'doc-2', titulo: 'Doc', formato: 'tarjetas' },
    elementos: [{
      id: 'e2', tipo: 'texto', x: 10, y: 10, ancho: 100, alto: 50, pasoEstudio: -5,
      datos: { bloques: [] },
    }],
  });
  assert.equal(saneadoInvalido.elementos[0].pasoEstudio, null);
});
