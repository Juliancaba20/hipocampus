import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularPuertosElemento,
  buscarPuertoCercano,
  puntosControlConectorCurvo,
  muestrearCurvaBezier,
  actualizarConectoresDeElementos,
  desanclarConectoresDeIdsBorrados,
  remaparAnclajesConectores,
} from '../src/lienzo/conectores.js';

import { extremosLinea } from '../src/lienzo/geometria.js';

import {
  DISENOS_TARJETA,
  LISTA_DISENOS_TARJETA,
  cambiarDisenoTarjeta,
  normalizarTarjetasConfig,
} from '../src/formatos/tarjetas.js';

import { TIPOS_ELEMENTO } from '../src/almacen/modelo.js';
const { TEXTO, FIGURA, TRAZO } = TIPOS_ELEMENTO;

test('Conectores - Cálculo de puertos en formas (arriba, abajo, izquierda, derecha, centro)', () => {
  const forma = {
    id: 'f1',
    tipo: FIGURA,
    datos: { forma: 'rectangulo' },
    x: 100,
    y: 100,
    ancho: 200,
    alto: 100,
  };

  const puertos = calcularPuertosElemento(forma);
  assert.equal(puertos.length, 5);

  const arr = puertos.find((p) => p.id === 'arriba');
  const ab = puertos.find((p) => p.id === 'abajo');
  const izq = puertos.find((p) => p.id === 'izquierda');
  const der = puertos.find((p) => p.id === 'derecha');
  const centro = puertos.find((p) => p.id === 'centro');

  assert.deepEqual(arr, { id: 'arriba', elementoId: 'f1', x: 200, y: 100 });
  assert.deepEqual(ab, { id: 'abajo', elementoId: 'f1', x: 200, y: 200 });
  assert.deepEqual(izq, { id: 'izquierda', elementoId: 'f1', x: 100, y: 150 });
  assert.deepEqual(der, { id: 'derecha', elementoId: 'f1', x: 300, y: 150 });
  assert.deepEqual(centro, { id: 'centro', elementoId: 'f1', x: 200, y: 150 });
});

test('Conectores - Búsqueda de puerto más cercano con atracción magnética', () => {
  const formaA = { id: 'f1', tipo: FIGURA, datos: { forma: 'circulo' }, x: 100, y: 100, ancho: 100, alto: 100 };
  const formaB = { id: 'f2', tipo: FIGURA, datos: { forma: 'hexagono' }, x: 400, y: 100, ancho: 100, alto: 100 };
  const elementos = [formaA, formaB];

  // Puerto derecho de f1: x=200, y=150
  // Punto de búsqueda cerca de (205, 152) con radio 24
  const cercaDer = buscarPuertoCercano(elementos, 205, 152, 24);
  assert.ok(cercaDer);
  assert.equal(cercaDer.elementoId, 'f1');
  assert.equal(cercaDer.id, 'derecha');

  // Punto lejos de cualquier puerto
  const lejos = buscarPuertoCercano(elementos, 300, 300, 24);
  assert.equal(lejos, null);

  // Excluir f1 de la búsqueda
  const excluirF1 = buscarPuertoCercano(elementos, 205, 152, 24, 'f1');
  assert.equal(excluirF1, null);
});

test('Conectores - Curvas Bézier: puntos de control y muestreo', () => {
  const a = { x: 100, y: 100 };
  const b = { x: 300, y: 200 };
  const anclajeA = { elementoId: 'f1', puerto: 'derecha' };
  const anclajeB = { elementoId: 'f2', puerto: 'izquierda' };

  const { cp1, cp2 } = puntosControlConectorCurvo(a, b, anclajeA, anclajeB);
  assert.ok(cp1.x > a.x, 'cp1 debe proyectarse hacia la derecha desde el puerto derecho');
  assert.ok(cp2.x < b.x, 'cp2 debe proyectarse hacia la izquierda hacia el puerto izquierdo');

  const puntos = muestrearCurvaBezier(a, cp1, cp2, b, 8);
  assert.equal(puntos.length, 9);
  assert.deepEqual(puntos[0], a);
  assert.deepEqual(puntos[puntos.length - 1], b);
});

test('Conectores - Actualización dinámica al mover o redimensionar formas ancladas', () => {
  const f1 = { id: 'f1', tipo: FIGURA, datos: { forma: 'rectangulo' }, x: 50, y: 50, ancho: 100, alto: 100 };
  const f2 = { id: 'f2', tipo: FIGURA, datos: { forma: 'rectangulo' }, x: 300, y: 50, ancho: 100, alto: 100 };
  const conector = {
    id: 'c1',
    tipo: FIGURA,
    x: 150,
    y: 100,
    ancho: 150,
    alto: 0,
    datos: {
      forma: 'flecha',
      tipoConector: 'curvo',
      puntos: [{ x: 150, y: 100 }, { x: 300, y: 100 }],
      anclajeInicio: { elementoId: 'f1', puerto: 'derecha' },
      anclajeFin: { elementoId: 'f2', puerto: 'izquierda' },
    },
  };

  // Mover f1 hacia abajo en y (y: 50 -> 150)
  const f1Movido = { ...f1, y: 150 };
  const escenaMock = [f1Movido, f2, conector];

  const cambios = actualizarConectoresDeElementos([f1Movido], escenaMock);
  assert.equal(cambios.length, 1);
  const cambio = cambios[0];
  assert.equal(cambio.id, 'c1');

  // El puerto 'derecha' de f1 antes estaba en y=100 (50+50). Con y=150 pasa a 200 (150+50).
  const [aDespues, bDespues] = extremosLinea(cambio.despues);
  assert.equal(aDespues.x, 150);
  assert.equal(aDespues.y, 200);

  // El puerto 'izquierda' de f2 sigue en (300, 100)
  assert.equal(bDespues.x, 300);
  assert.equal(bDespues.y, 100);
});

test('Conectores - Desanclado limpio cuando una forma es eliminada', () => {
  const conector = {
    id: 'c1',
    tipo: FIGURA,
    x: 100,
    y: 100,
    ancho: 100,
    alto: 100,
    datos: {
      forma: 'linea',
      puntos: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
      anclajeInicio: { elementoId: 'f1', puerto: 'derecha' },
      anclajeFin: { elementoId: 'f2', puerto: 'izquierda' },
    },
  };

  // Se borra f1
  const cambios1 = desanclarConectoresDeIdsBorrados(['f1'], [conector]);
  assert.equal(cambios1.length, 1);
  assert.equal(cambios1[0].despues.datos.anclajeInicio, null);
  assert.deepEqual(cambios1[0].despues.datos.anclajeFin, { elementoId: 'f2', puerto: 'izquierda' });

  // Si después se borra f2
  const cambios2 = desanclarConectoresDeIdsBorrados(['f2'], [cambios1[0].despues]);
  assert.equal(cambios2.length, 1);
  assert.equal(cambios2[0].despues.datos.anclajeInicio, null);
  assert.equal(cambios2[0].despues.datos.anclajeFin, null);
});

test('Conectores - Remap de anclajes en copiar y pegar', () => {
  const conector = {
    id: 'c1',
    tipo: FIGURA,
    datos: {
      forma: 'flecha',
      anclajeInicio: { elementoId: 'f1', puerto: 'derecha' },
      anclajeFin: { elementoId: 'f2', puerto: 'izquierda' },
    },
  };

  const idMap = new Map([
    ['f1', 'f1_copia'],
    ['f2', 'f2_copia'],
  ]);

  const clonados = remaparAnclajesConectores([conector], idMap);
  assert.equal(clonados[0].datos.anclajeInicio.elementoId, 'f1_copia');
  assert.equal(clonados[0].datos.anclajeFin.elementoId, 'f2_copia');

  // Si solo se copió el conector y no f2
  const idMapParcial = new Map([['f1', 'f1_copia']]);
  const clonadosParcial = remaparAnclajesConectores([conector], idMapParcial);
  assert.equal(clonadosParcial[0].datos.anclajeInicio.elementoId, 'f1_copia');
  assert.equal(clonadosParcial[0].datos.anclajeFin, null);
});

test('Diseños de Tarjeta - Catálogo y cambio de diseño sin perder contenido', () => {
  assert.ok(LISTA_DISENOS_TARJETA.length >= 5);
  assert.ok(DISENOS_TARJETA['titulo']);
  assert.ok(DISENOS_TARJETA['dos-columnas']);
  assert.ok(DISENOS_TARJETA['imagen-texto']);

  const med = { ancho: 800, alto: 500 };
  const docId = 'doc123';
  const tarjetaId = 't1';

  // 1. Crear diseño 'titulo' en tarjeta vacía
  const r1 = cambiarDisenoTarjeta([], tarjetaId, 'titulo', med, docId);
  assert.ok(r1.cambios?.length > 0);
  const textoTitulo = r1.cambios[0].despues;
  assert.equal(textoTitulo.tipo, TEXTO);
  assert.equal(textoTitulo.contenedor, tarjetaId);

  // 2. Agregar un trazo a mano y cambiar a 'dos-columnas': no debe eliminarse el trazo
  const trazoMano = { id: 'trazo1', tipo: TRAZO, contenedor: tarjetaId, puntos: [{ x: 10, y: 10 }] };
  const elementosConTrazo = [textoTitulo, trazoMano];

  const r2 = cambiarDisenoTarjeta(elementosConTrazo, tarjetaId, 'dos-columnas', med, docId);
  assert.ok(r2.cambios?.length > 0);

  // Ninguno de los cambios debe eliminar 'trazo1'
  const cambioTrazo = r2.cambios.find((c) => c.id === 'trazo1');
  assert.equal(cambioTrazo, undefined, 'El trazo a mano no se modifica ni elimina');

  // El diseño debe haber reorganizado/creado los textos requeridos
  const nuevosTextos = r2.cambios.map((c) => c.despues).filter((el) => el && el.tipo === TEXTO);
  assert.ok(nuevosTextos.length >= 2);
});

test('Tarjetas - Normalización de notas de orador y diseño en configuración', () => {
  const rawConfig = {
    tamano: '16:9',
    tarjetas: [
      { id: 't1', titulo: 'Portada' },
      { id: 't2', titulo: 'Conclusiones', notasOrador: 'Mencionar estadísticas del 2026', diseno: 'dos-columnas' },
    ],
  };

  const norm = normalizarTarjetasConfig(rawConfig);
  assert.equal(norm.tarjetas[0].notasOrador, '');
  assert.equal(norm.tarjetas[0].diseno, 'en-blanco');
  assert.equal(norm.tarjetas[1].notasOrador, 'Mencionar estadísticas del 2026');
  assert.equal(norm.tarjetas[1].diseno, 'dos-columnas');
});
