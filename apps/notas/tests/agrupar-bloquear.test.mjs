// Pruebas automatizadas para la Etapa 17C: Agrupar, bloquear, alinear, distribuir, guías e imán.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="c"><canvas id="cv" tabindex="0"></canvas><div id="t"></div></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });

const { Escena } = await import('../src/lienzo/escena.js');
const { Lienzo } = await import('../src/lienzo/motor.js');
const { crearElemento, TIPOS_ELEMENTO, VERSION_ESQUEMA } = await import('../src/almacen/modelo.js');
const {
  alinearElementos,
  distribuirElementos,
  calcularSnapGuias,
} = await import('../src/lienzo/geometria.js');
const {
  VERSION_FORMATO,
  empaquetarDocumento,
  desempaquetarArchivo,
  migrarArchivo,
} = await import('../src/archivos/formato.js');

function crearLienzoPruebas(elementos = []) {
  const canvas = dom.window.document.getElementById('cv');
  const escena = new Escena(elementos);
  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc-test-17c',
    herramienta: 'seleccionar',
  });
  return { canvas, escena, motor };
}

test('VERSION_ESQUEMA y VERSION_FORMATO se actualizaron a 2 o superior y conservan retrocompatibilidad', async () => {
  assert.ok(VERSION_ESQUEMA >= 2);
  assert.ok(VERSION_FORMATO >= 2);

  // Archivo antiguo versión 1 sin grupoId ni bloqueado
  const docV1 = {
    formatoApp: 'anotomia',
    versionArchivo: 1,
    exportado: Date.now(),
    tipo: 'documento',
    documento: { id: 'doc-v1', titulo: 'Nota v1', formato: 'pizarron', version: 1 },
    elementos: [
      { id: 'el-1', tipo: 'figura', x: 10, y: 10, ancho: 50, alto: 50, z: 1, datos: { forma: 'rectangulo' } },
    ],
    recursos: [],
  };

  const migrado = migrarArchivo(docV1);
  assert.ok(migrado.versionArchivo >= 2);
  assert.equal(migrado.elementos[0].grupoId, null);
  assert.equal(migrado.elementos[0].bloqueado, false);
});

test('Alinear selección múltiple: izquierda, centro, derecha, arriba, medio, abajo', () => {
  const f1 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 10, y: 20, ancho: 40, alto: 40 });
  const f2 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 100, y: 80, ancho: 60, alto: 60 });
  const f3 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 50, y: 150, ancho: 50, alto: 50 });

  // Caja envolvente: X de 10 a 160 (ancho 150), Y de 20 a 200 (alto 180)
  // Alinear izquierda -> todos en X = 10
  const izq = alinearElementos([f1, f2, f3], 'izquierda');
  assert.equal(izq[0].x, 10);
  assert.equal(izq[1].x, 10);
  assert.equal(izq[2].x, 10);

  // Alinear derecha -> X + ancho = 160
  const der = alinearElementos([f1, f2, f3], 'derecha');
  assert.equal(der[0].x + der[0].ancho, 160);
  assert.equal(der[1].x + der[1].ancho, 160);
  assert.equal(der[2].x + der[2].ancho, 160);

  // Alinear centro horizontal -> centro X = 10 + 150/2 = 85
  const cen = alinearElementos([f1, f2, f3], 'centro');
  assert.equal(cen[0].x + cen[0].ancho / 2, 85);
  assert.equal(cen[1].x + cen[1].ancho / 2, 85);
  assert.equal(cen[2].x + cen[2].ancho / 2, 85);

  // Alinear arriba -> todos en Y = 20
  const arr = alinearElementos([f1, f2, f3], 'arriba');
  assert.equal(arr[0].y, 20);
  assert.equal(arr[1].y, 20);
  assert.equal(arr[2].y, 20);

  // Alinear medio vertical -> centro Y = 20 + 180/2 = 110
  const med = alinearElementos([f1, f2, f3], 'medio');
  assert.equal(med[0].y + med[0].alto / 2, 110);
  assert.equal(med[1].y + med[1].alto / 2, 110);
  assert.equal(med[2].y + med[2].alto / 2, 110);

  // Alinear abajo -> Y + alto = 200
  const aba = alinearElementos([f1, f2, f3], 'abajo');
  assert.equal(aba[0].y + aba[0].alto, 200);
  assert.equal(aba[1].y + aba[1].alto, 200);
  assert.equal(aba[2].y + aba[2].alto, 200);
});

test('Distribuir selección múltiple horizontal y verticalmente', () => {
  const f1 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 0, y: 0, ancho: 20, alto: 20 });
  const f2 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 30, y: 30, ancho: 20, alto: 20 });
  const f3 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 100, y: 100, ancho: 20, alto: 20 });

  // Horizontal: de 0 a 120 (span 120). f1 (20w), f2 (20w), f3 (20w) -> total ancho 60.
  // Hueco = (120 - 60) / 2 = 30.
  // Posiciones esperadas: f1.x = 0, f2.x = 20 + 30 = 50, f3.x = 100.
  const distH = distribuirElementos([f1, f2, f3], 'horizontal');
  assert.equal(distH.find((e) => e.id === f1.id).x, 0);
  assert.equal(distH.find((e) => e.id === f2.id).x, 50);
  assert.equal(distH.find((e) => e.id === f3.id).x, 100);

  // Vertical: igualmente distribuye a 50
  const distV = distribuirElementos([f1, f2, f3], 'vertical');
  assert.equal(distV.find((e) => e.id === f1.id).y, 0);
  assert.equal(distV.find((e) => e.id === f2.id).y, 50);
  assert.equal(distV.find((e) => e.id === f3.id).y, 100);
});

test('Guías inteligentes e imán: detecta bordes y centros de otros elementos y cuadrícula', () => {
  const estatico = { x: 100, y: 100, ancho: 80, alto: 80 };
  // Caja moviéndose cerca del borde izquierdo del estático (100)
  const moviendoCercaX = { x: 98, y: 300, ancho: 50, alto: 50 };
  const snap1 = calcularSnapGuias(moviendoCercaX, [estatico], null, 6, true);
  assert.equal(snap1.dx, 2); // 98 + 2 = 100
  assert.equal(snap1.guias.some((g) => g.tipo === 'x' && g.valor === 100), true);

  // Con imán desactivado: no altera nada (dx = 0, dy = 0, guias vacías)
  const snapApagado = calcularSnapGuias(moviendoCercaX, [estatico], null, 6, false);
  assert.equal(snapApagado.dx, 0);
  assert.equal(snapApagado.dy, 0);
  assert.equal(snapApagado.guias.length, 0);

  // Con cuadrícula activa: engancha a múltiplos del interlineado
  const renglonesCuadricula = { activos: true, estilo: 'cuadriculado', interlineado: 32 };
  const moviendoCercaCuad = { x: 62, y: 95, ancho: 40, alto: 40 }; // 62 cerca de 64 (32*2), 95 cerca de 96 (32*3)
  const snapCuad = calcularSnapGuias(moviendoCercaCuad, [], renglonesCuadricula, 6, true);
  assert.equal(snapCuad.dx, 2); // 62 + 2 = 64
  assert.equal(snapCuad.dy, 1); // 95 + 1 = 96
});

test('Bloquear y desbloquear elementos: no se pueden mover ni borrar por accidente', () => {
  const f1 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 50, y: 50, ancho: 60, alto: 60 });
  const { motor, escena } = crearLienzoPruebas([f1]);

  motor.seleccion = new Set([f1.id]);
  assert.equal(motor.bloquearSeleccion(), true);

  const bloqueado = escena.get(f1.id);
  assert.equal(bloqueado.bloqueado, true);

  // Intentar eliminar selección teniendo el elemento bloqueado -> no se borra
  motor.eliminarSeleccion();
  assert.equal(escena.get(f1.id) !== null, true);
  assert.equal(escena.mapa.size, 1);

  // Deshacer bloqueo
  motor.deshacer();
  assert.equal(escena.get(f1.id).bloqueado, false);

  // Rehacer bloqueo
  motor.rehacer();
  assert.equal(escena.get(f1.id).bloqueado, true);

  // Desbloquear mediante método
  motor.desbloquearSeleccion();
  assert.equal(escena.get(f1.id).bloqueado, false);
});

test('Agrupar y desagrupar: el grupo actúa como una unidad atómica y se deshace/rehace en un solo paso', () => {
  const f1 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 10, y: 10, ancho: 40, alto: 40 });
  const f2 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 70, y: 10, ancho: 40, alto: 40 });
  const { motor, escena } = crearLienzoPruebas([f1, f2]);

  motor.seleccion = new Set([f1.id, f2.id]);
  motor.agruparSeleccion();

  const el1 = escena.get(f1.id);
  const el2 = escena.get(f2.id);
  assert.ok(el1.grupoId);
  assert.equal(el1.grupoId, el2.grupoId);

  // Al seleccionar uno solo, _expandirGrupo selecciona a todos los miembros del grupo
  const expandida = motor._expandirGrupo(new Set([f1.id]));
  assert.equal(expandida.has(f1.id), true);
  assert.equal(expandida.has(f2.id), true);

  // Desagrupar
  motor.seleccion = new Set([f1.id, f2.id]);
  motor.desagruparSeleccion();
  assert.equal(escena.get(f1.id).grupoId, null);
  assert.equal(escena.get(f2.id).grupoId, null);

  // Deshacer desagrupado en 1 solo paso
  motor.deshacer();
  assert.equal(escena.get(f1.id).grupoId, el1.grupoId);
  assert.equal(escena.get(f2.id).grupoId, el2.grupoId);

  // Deshacer agrupado en 1 solo paso
  motor.deshacer();
  assert.equal(escena.get(f1.id).grupoId, null);
  assert.equal(escena.get(f2.id).grupoId, null);
});

test('Criterio de aceptación de la Etapa 17C: 5 figuras alineadas y distribuidas, agrupadas y movidas como una, 1 bloqueada sin moverse, y reabierto idéntico', async () => {
  // 1. Cinco figuras en la escena
  const f1 = crearElemento('doc-17c', TIPOS_ELEMENTO.FIGURA, { x: 10, y: 100, ancho: 30, alto: 30, datos: { forma: 'rectangulo' } });
  const f2 = crearElemento('doc-17c', TIPOS_ELEMENTO.FIGURA, { x: 60, y: 10, ancho: 30, alto: 30, datos: { forma: 'rectangulo' } });
  const f3 = crearElemento('doc-17c', TIPOS_ELEMENTO.FIGURA, { x: 150, y: 50, ancho: 30, alto: 30, datos: { forma: 'rectangulo' } });
  const f4 = crearElemento('doc-17c', TIPOS_ELEMENTO.FIGURA, { x: 80, y: 180, ancho: 30, alto: 30, datos: { forma: 'rectangulo' } });
  const f5 = crearElemento('doc-17c', TIPOS_ELEMENTO.FIGURA, { x: 250, y: 90, ancho: 30, alto: 30, datos: { forma: 'rectangulo' } });

  const { motor, escena } = crearLienzoPruebas([f1, f2, f3, f4, f5]);

  // Alinear arriba las 5 figuras (todas a Y = min(y) = 10)
  motor.seleccion = new Set([f1.id, f2.id, f3.id, f4.id, f5.id]);
  motor.alinear('arriba');
  for (const id of [f1.id, f2.id, f3.id, f4.id, f5.id]) {
    assert.equal(escena.get(id).y, 10);
  }

  // Distribuir horizontalmente las 5 figuras (todas alineadas uniformemente)
  motor.distribuir('horizontal');
  const listaDist = [f1.id, f2.id, f3.id, f4.id, f5.id].map((id) => escena.get(id)).sort((a, b) => a.x - b.x);
  const hueco1 = listaDist[1].x - (listaDist[0].x + listaDist[0].ancho);
  const hueco2 = listaDist[2].x - (listaDist[1].x + listaDist[1].ancho);
  const hueco3 = listaDist[3].x - (listaDist[2].x + listaDist[2].ancho);
  const hueco4 = listaDist[4].x - (listaDist[3].x + listaDist[3].ancho);
  assert.ok(Math.abs(hueco1 - hueco2) < 0.001);
  assert.ok(Math.abs(hueco2 - hueco3) < 0.001);
  assert.ok(Math.abs(hueco3 - hueco4) < 0.001);

  // Agrupar las 5 figuras
  motor.agruparSeleccion();
  const grupoId = escena.get(f1.id).grupoId;
  assert.ok(grupoId);
  for (const id of [f1.id, f2.id, f3.id, f4.id, f5.id]) {
    assert.equal(escena.get(id).grupoId, grupoId);
  }

  // Mover el grupo como una sola unidad (+100 en X, +50 en Y)
  const origenes = new Map(motor.escena.lista().map((el) => [el.id, { ...el }]));
  const dx = 100, dy = 50;
  escena.ejecutar([...origenes].map(([id, o]) => ({
    id,
    antes: o,
    despues: { ...o, x: o.x + dx, y: o.y + dy },
  })), 'mover grupo');

  for (const id of [f1.id, f2.id, f3.id, f4.id, f5.id]) {
    assert.equal(escena.get(id).x, origenes.get(id).x + 100);
    assert.equal(escena.get(id).y, origenes.get(id).y + 50);
  }

  // Bloquear una figura (f1) y verificar que no se deja mover ni borrar
  motor.seleccion = new Set([f1.id]);
  motor.bloquearSeleccion();
  assert.equal(escena.get(f1.id).bloqueado, true);

  // Intentar eliminar
  motor.eliminarSeleccion();
  assert.ok(escena.get(f1.id)); // No se borró

  // Simular intento de inicio de movimiento: con elemento bloqueado no crea gesto 'mover'
  const evPointer = { shiftKey: false, ctrlKey: false, pointerType: 'mouse', button: 0 };
  const p = { x: 50, y: 50 };
  const mundo = { x: escena.get(f1.id).x + 10, y: escena.get(f1.id).y + 10 };
  motor._abajoSeleccion(evPointer, p, mundo, false);
  assert.equal(motor.gesto, null); // Bloqueado contra movimiento

  // Empaquetar y desempaquetar el documento (.nota) y verificar que reabre idéntico
  const docObj = {
    id: 'doc-17c',
    titulo: 'Pizarrón 17C',
    formato: 'pizarron',
    version: VERSION_ESQUEMA,
    renglones: { activos: true, estilo: 'rayado', interlineado: 32 },
  };
  const elementosFinales = escena.lista();
  const bytesNota = await empaquetarDocumento(docObj, elementosFinales, []);
  assert.ok(bytesNota.length > 0);

  const reabierto = await desempaquetarArchivo(bytesNota);
  assert.equal(reabierto.documento.id, 'doc-17c');
  assert.equal(reabierto.elementos.length, 5);

  const f1Reabierto = reabierto.elementos.find((e) => e.id === f1.id);
  assert.equal(f1Reabierto.bloqueado, true);
  assert.equal(f1Reabierto.grupoId, grupoId);
  assert.equal(f1Reabierto.x, escena.get(f1.id).x);
  assert.equal(f1Reabierto.y, escena.get(f1.id).y);
});
