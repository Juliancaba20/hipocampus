import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearDocumento, guardarDocumento, obtenerDocumento,
  listarCarpetas, guardarCarpeta, eliminarCarpeta, moverDocumentoACarpeta,
  asignarEtiquetasDocumento, COLORES_CARPETA,
} from '../src/almacen/index.js';
import { empaquetarColeccion, desempaquetarArchivo } from '../src/archivos/formato.js';
import { importarArchivos } from '../src/archivos/importar.js';

test('creación, listado y actualización de materias/carpetas', async () => {
  const c1 = await guardarCarpeta({ nombre: 'Anatomía I', color: COLORES_CARPETA[0][0] });
  assert.ok(c1.id);
  assert.equal(c1.nombre, 'Anatomía I');
  assert.equal(c1.color, COLORES_CARPETA[0][0]);

  const c2 = await guardarCarpeta({ nombre: 'Fisiología', color: COLORES_CARPETA[1][0] });
  const lista = await listarCarpetas();
  assert.ok(lista.some((c) => c.id === c1.id));
  assert.ok(lista.some((c) => c.id === c2.id));

  // Actualizar nombre y color
  const c1Actualizada = await guardarCarpeta({ id: c1.id, nombre: 'Anatomía Humana', color: COLORES_CARPETA[2][0] });
  assert.equal(c1Actualizada.nombre, 'Anatomía Humana');
  assert.equal(c1Actualizada.color, COLORES_CARPETA[2][0]);
});

test('mover documento a materia y asignar etiquetas', async () => {
  const c = await guardarCarpeta({ nombre: 'Farmacología', color: '#7048e8' });
  const doc = await guardarDocumento(crearDocumento({ titulo: 'Drogas del SNC' }));

  assert.equal(doc.carpetaId, null);
  assert.deepEqual(doc.etiquetas, []);

  // Mover a carpeta
  const movido = await moverDocumentoACarpeta(doc.id, c.id);
  assert.equal(movido.carpetaId, c.id);
  const reLeido = await obtenerDocumento(doc.id);
  assert.equal(reLeido.carpetaId, c.id);

  // Asignar etiquetas (se eliminan '#' previos y duplicados)
  const conTags = await asignarEtiquetasDocumento(doc.id, ['#parcial1', 'snc', 'parcial1', 'farmaco']);
  assert.deepEqual(conTags.etiquetas, ['parcial1', 'snc', 'farmaco']);
  const reLeidoTags = await obtenerDocumento(doc.id);
  assert.deepEqual(reLeidoTags.etiquetas, ['parcial1', 'snc', 'farmaco']);
});

test('eliminar materia no borra sus documentos, solo los desvincula a null', async () => {
  const c = await guardarCarpeta({ nombre: 'Histología', color: '#d6336c' });
  const doc1 = await guardarDocumento(crearDocumento({ titulo: 'Tejido epitelial', carpetaId: c.id }));
  const doc2 = await guardarDocumento(crearDocumento({ titulo: 'Tejido conectivo', carpetaId: c.id }));

  await eliminarCarpeta(c.id);

  // La carpeta ya no existe en la lista
  const lista = await listarCarpetas();
  assert.ok(!lista.some((item) => item.id === c.id));

  // Los documentos siguen existiendo y tienen carpetaId: null
  const d1 = await obtenerDocumento(doc1.id);
  const d2 = await obtenerDocumento(doc2.id);
  assert.ok(d1);
  assert.ok(d2);
  assert.equal(d1.carpetaId, null);
  assert.equal(d2.carpetaId, null);
});

test('empaquetar y desempaquetar respaldo preserva carpetas y etiquetas', async () => {
  const c = await guardarCarpeta({ nombre: 'Bioquímica', color: '#1f9d55' });
  const doc = crearDocumento({ titulo: 'Glucólisis', carpetaId: c.id, etiquetas: ['resumen', 'metabolismo'] });

  const bytes = await empaquetarColeccion([{ documento: doc, elementos: [], recursos: [] }], [c]);
  assert.ok(bytes && bytes.length > 0);

  const desempaquetado = await desempaquetarArchivo(bytes);
  assert.equal(desempaquetado.tipo, 'coleccion');
  assert.equal(desempaquetado.items.length, 1);
  assert.equal(desempaquetado.items[0].documento.carpetaId, c.id);
  assert.deepEqual(desempaquetado.items[0].documento.etiquetas, ['resumen', 'metabolismo']);
  assert.ok(desempaquetado.carpetas.some((k) => k.id === c.id && k.nombre === 'Bioquímica'));

  // Importar el archivo restaura la carpeta en la biblioteca
  const archivoSimulado = new File([bytes], 'respaldo.anotomia-respaldo', { type: 'application/x-anotomia-nota' });
  const resultado = await importarArchivos([archivoSimulado]);
  assert.equal(resultado.importados, 1);

  const carpetasActuales = await listarCarpetas();
  assert.ok(carpetasActuales.some((k) => k.id === c.id && k.nombre === 'Bioquímica'));
});
