// Pruebas añadidas tras la auditoría de las etapas 17 a 24:
// los datos nuevos deben sobrevivir a exportar → importar, duplicar y restaurar un respaldo.
import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearDocumento, crearElemento, guardarDocumento, guardarElementos, guardarBlob,
  listarElementos, duplicarDocumento, guardarExamen, listarExamenes,
} from '../src/almacen/index.js';
import { empaquetarDocumento, empaquetarColeccion, desempaquetarArchivo } from '../src/archivos/formato.js';
import { prepararRecursosDeElementos } from '../src/archivos/exportar.js';
import { persistirDocumentoImportado, importarArchivos } from '../src/archivos/importar.js';
import { normalizarTarjetasConfig } from '../src/formatos/tarjetas.js';

async function armarDocumento() {
  const cfg = normalizarTarjetasConfig({ tarjetas: [{ id: 't1', titulo: 'T1', notasOrador: 'n'.repeat(900) }] });
  const doc = crearDocumento({ titulo: 'Auditoría', formato: 'tarjetas', config: cfg, favorito: true });
  await guardarDocumento(doc);
  const nodo = (x, extra = {}) => crearElemento(doc.id, 'figura', { x, y: 0, ancho: 100, alto: 50, contenedor: 't1', datos: { forma: 'rectangulo', borde: '#2350d8', grosor: 3, ...extra } });
  const a = nodo(0, { texto: 'Nodo A', colorTexto: '#1e293b', tamanoTexto: 14, tipoNodoMapa: 'concepto', enlace: { tipo: 'nota', notaId: 'otra', titulo: 'Otra' } });
  const b = nodo(300);
  const flecha = crearElemento(doc.id, 'figura', { x: 100, y: 25, ancho: 200, alto: 1, contenedor: 't1', datos: { forma: 'flecha', borde: '#2350d8', grosor: 3, tipoConector: 'curvo', anclajeInicio: { elementoId: a.id, puerto: 'derecha' }, anclajeFin: { elementoId: b.id, puerto: 'izquierda' } } });
  await guardarElementos([a, b, flecha]);
  const img = await guardarBlob(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
  const im = crearElemento(doc.id, 'imagen', { x: 0, y: 100, ancho: 100, alto: 100, contenedor: 't1', datos: { blobId: img.id, enlace: { tipo: 'nota', notaId: 'otra' } } });
  await guardarElementos([im]);
  const pdf = await guardarBlob(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 1])], { type: 'application/pdf' }), { tipo: 'application/pdf', nombre: 'x.pdf' });
  doc.config.pdfBlobId = pdf.id;
  await guardarDocumento(doc);
  return { doc, pdf, a, b };
}

const ancladoA = (els) => els.find((e) => e.datos?.tipoConector === 'curvo').datos;

test('exportar → importar conserva favorito, notas del orador, texto de nodos, enlaces y tipo del PDF', async () => {
  const { doc, pdf, a } = await armarDocumento();
  const els = await listarElementos(doc.id);
  const recursos = await prepararRecursosDeElementos(els, doc);
  const des = await desempaquetarArchivo(await empaquetarDocumento(doc, els, recursos, []));
  assert.equal(des.documento.favorito, true);
  assert.equal(des.documento.config.tarjetas[0].notasOrador.length, 900);
  assert.equal(des.recursos.find((r) => r.id === pdf.id).tipo, 'application/pdf');
  const nodo = des.elementos.find((e) => e.id === a.id);
  assert.equal(nodo.datos.texto, 'Nodo A');
  assert.equal(nodo.datos.tipoNodoMapa, 'concepto');
  assert.equal(nodo.datos.enlace.notaId, 'otra');
  assert.equal(nodo.datos.enlace.titulo, 'Otra');
  assert.ok(des.elementos.find((e) => e.tipo === 'imagen').datos.enlace);
});

test('importar como copia remapea los anclajes de los conectores', async () => {
  const { doc } = await armarDocumento();
  const els = await listarElementos(doc.id);
  const des = await desempaquetarArchivo(await empaquetarDocumento(doc, els, await prepararRecursosDeElementos(els, doc), []));
  const res = await persistirDocumentoImportado(des, 'conservar-ambos');
  const copia = await listarElementos(res.documento.id);
  const ids = new Set(copia.map((e) => e.id));
  const d = ancladoA(copia);
  assert.ok(ids.has(d.anclajeInicio.elementoId) && ids.has(d.anclajeFin.elementoId));
});

test('duplicar un documento remapea los anclajes de los conectores', async () => {
  const { doc } = await armarDocumento();
  const copiaDoc = await duplicarDocumento(doc.id);
  const copia = await listarElementos(copiaDoc.id);
  const ids = new Set(copia.map((e) => e.id));
  const d = ancladoA(copia);
  assert.ok(ids.has(d.anclajeInicio.elementoId) && ids.has(d.anclajeFin.elementoId));
});

test('el respaldo completo lleva los exámenes y se restauran sin pisar los actuales', async () => {
  await guardarExamen({ id: 'ex1', titulo: 'Anatomía', materia: 'Anatomía', fecha: '2026-12-01' });
  const examenes = await listarExamenes();
  const bytes = await empaquetarColeccion([], [], [], examenes);
  const des = await desempaquetarArchivo(bytes);
  assert.equal(des.examenes.length, examenes.length);
  await guardarExamen({ id: 'ex2', titulo: 'Fisiología', fecha: '2027-02-01' });
  const archivo = new File([bytes], 'r.anotomia-respaldo');
  await importarArchivos([archivo]);
  const ids = (await listarExamenes()).map((e) => e.id);
  assert.ok(ids.includes('ex1') && ids.includes('ex2'), 'no debe borrar el examen posterior al respaldo');
});

test('exámenes: «hoy» sigue la fecha local y no la UTC (22:30 en Buenos Aires)', async () => {
  const { fechaLocalISO, calcularCuentaRegresivaExamen } = await import('../src/almacen/examenes.js');
  const tardeLocal = new Date(2026, 10, 5, 22, 30); // 5 nov 2026, 22:30 hora local
  assert.equal(fechaLocalISO(tardeLocal), '2026-11-05');
  assert.equal(calcularCuentaRegresivaExamen('2026-11-05', fechaLocalISO(tardeLocal)).texto, '¡Hoy!');
});

test('plantillas: el texto es real, el apilado sigue el orden de definición y las cajas no lo tapan', async () => {
  const { PLANTILLAS_SISTEMA, crearDocumentoDesdePlantilla } = await import('../src/plantillas/index.js');
  const { listarElementos } = await import('../src/almacen/index.js');
  const { Escena } = await import('../src/lienzo/escena.js');
  for (const plantilla of PLANTILLAS_SISTEMA) {
    const { doc } = await crearDocumentoDesdePlantilla(plantilla, { titulo: plantilla.nombre });
    const els = await listarElementos(doc.id);
    const textos = els.filter((e) => e.tipo === 'texto');
    const vacios = textos.filter((e) => !e.datos.bloques.some((b) => (b.runs || []).some((r) => (r.texto || '').trim())));
    assert.equal(vacios.length, 0, `${plantilla.nombre}: ${vacios.length} cuadros de texto sin contenido`);
    // Sin empates: cada elemento tiene una posición de apilado única y determinista (antes todos valían z=0 y la misma hora).
    const escena = new Escena(els);
    const claves = new Set(escena.lista().map((e) => `${e.z}:${e.creado}`));
    assert.equal(claves.size, els.length, `${plantilla.nombre}: elementos con el mismo apilado`);
    // Y respetan el orden en que la plantilla los define.
    const posicion = new Map(escena.lista().map((e, i) => [e.id, i]));
    plantilla.elementos.forEach((def, i) => {
      if (i === 0) return;
      const previo = els.find((e) => e.tipo === plantilla.elementos[i - 1].tipo && e.z === (plantilla.elementos[i - 1].z || i - 1));
      const actual = els.find((e) => e.z === (def.z || i) && e.tipo === def.tipo);
      assert.ok(previo && actual && posicion.get(actual.id) > posicion.get(previo.id), `${plantilla.nombre}: orden roto en el elemento ${i}`);
    });
  }
});

test('duplicar conserva el orden de apilado de elementos con el mismo z', async () => {
  const { doc } = await armarDocumento();
  const copiaDoc = await duplicarDocumento(doc.id);
  const orig = await listarElementos(doc.id);
  const copia = await listarElementos(copiaDoc.id);
  assert.deepEqual(new Set(copia.map((e) => e.creado)), new Set(orig.map((e) => e.creado)));
});

test('exámenes: la fecha se muestra día/mes/año y se guarda como año-mes-día', async () => {
  const { formatearFechaExamen } = await import('../src/almacen/examenes.js');
  assert.equal(formatearFechaExamen('2026-11-06'), '06/11/2026');
  assert.equal(formatearFechaExamen('2027-01-02'), '02/01/2027');
  assert.equal(formatearFechaExamen(''), '');
  assert.equal(formatearFechaExamen('texto raro'), 'texto raro');
});

test('tarjetas: un elemento guardado fuera de su tarjeta se reubica dentro (el reverso no queda invisible)', async () => {
  const { reubicarEnTarjeta } = await import('../src/formatos/tarjetas.js');
  const medidas = { ancho: 1000, alto: 560 };
  const malo = { id: 'r1', tipo: 'texto', x: 84, y: -228, ancho: 385, alto: 28, contenedor: 't1', cara: 'reverso' };
  const r = reubicarEnTarjeta(malo, medidas);
  assert.ok(r.y >= 0 && r.y + r.alto <= medidas.alto, `y=${r.y} debe quedar dentro`);
  const bueno = { ...malo, y: 120 };
  assert.equal(reubicarEnTarjeta(bueno, medidas), bueno, 'un elemento ya bien ubicado no cambia');
});
