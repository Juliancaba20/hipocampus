// Pruebas automatizadas para la Etapa 17B: Estirar trazos y símbolos, selección múltiple y lazo.
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
const { crearElemento, nuevoId, TIPOS_ELEMENTO } = await import('../src/almacen/modelo.js');
const {
  esRedimensionable,
  escalarTrazo,
  escalarSimbolo,
  escalarElemento,
  elementoTocadoPorLazo,
  unirRects,
  cajaDeTrazo,
} = await import('../src/lienzo/geometria.js');

test('esRedimensionable incluye trazos y símbolos además de figuras, imágenes y textos', () => {
  const trazo = crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, {
    x: 10, y: 10, ancho: 50, alto: 50,
    datos: { puntos: [[10, 10, 0.5], [60, 60, 0.5]], grosor: 3 },
  });
  const simbolo = crearElemento('doc1', TIPOS_ELEMENTO.SIMBOLO, {
    x: 20, y: 20, ancho: 24, alto: 24,
    datos: { caracter: 'α', tamano: 24 },
  });
  const figura = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, {
    x: 0, y: 0, ancho: 100, alto: 100,
    datos: { forma: 'rectangulo' },
  });

  assert.equal(esRedimensionable(trazo), true);
  assert.equal(esRedimensionable(simbolo), true);
  assert.equal(esRedimensionable(figura), true);
});

test('escalarTrazo escala coordenadas espaciales preservando el grosor lógico del lápiz', () => {
  const trazo = crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, {
    x: 100, y: 100, ancho: 100, alto: 100,
    datos: {
      puntos: [[100, 100, 0.7], [200, 200, 0.4]],
      color: '#2350d8',
      grosor: 4,
    },
  });

  // Estirar de 100x100 a 150x150 (+50%)
  const cajaNueva = { x: 100, y: 100, ancho: 150, alto: 150 };
  const escalado = escalarTrazo(trazo, cajaNueva, trazo);

  // Grosor lógico intacto
  assert.equal(escalado.datos.grosor, 4);
  // Presiones intactas
  assert.equal(escalado.datos.puntos[0][2], 0.7);
  assert.equal(escalado.datos.puntos[1][2], 0.4);
  // Coordenadas ampliadas
  assert.equal(escalado.datos.puntos[0][0], 100);
  assert.equal(escalado.datos.puntos[0][1], 100);
  assert.equal(escalado.datos.puntos[1][0], 250);
  assert.equal(escalado.datos.puntos[1][1], 250);
});

test('escalarSimbolo adapta tamaño tipográfico y posición', () => {
  const simbolo = crearElemento('doc1', TIPOS_ELEMENTO.SIMBOLO, {
    x: 50, y: 50, ancho: 30, alto: 30,
    datos: { caracter: 'Ω', tamano: 20 },
  });

  const cajaNueva = { x: 50, y: 50, ancho: 60, alto: 60 };
  const escalado = escalarSimbolo(simbolo, cajaNueva, simbolo);

  assert.equal(escalado.datos.tamano, 40); // 20 * (60 / 30) = 40
  assert.equal(escalado.ancho, 60);
  assert.equal(escalado.alto, 60);
});

test('elementoTocadoPorLazo detecta elementos dentro del polígono o que cortan su contorno', () => {
  // Polígono cuadrado de 100 a 300
  const lazo = [
    [100, 100],
    [300, 100],
    [300, 300],
    [100, 300],
  ];

  // Elemento completamente adentro
  const adentro = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, {
    x: 150, y: 150, ancho: 50, alto: 50, datos: { forma: 'rectangulo' },
  });
  assert.equal(elementoTocadoPorLazo(adentro, lazo), true);

  // Trazo que cruza el borde del lazo
  const cruzando = crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, {
    x: 50, y: 150, ancho: 100, alto: 20,
    datos: { puntos: [[50, 150, 0.5], [150, 150, 0.5]], grosor: 2 },
  });
  assert.equal(elementoTocadoPorLazo(cruzando, lazo), true);

  // Elemento completamente afuera sin tocar
  const afuera = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, {
    x: 500, y: 500, ancho: 50, alto: 50, datos: { forma: 'rectangulo' },
  });
  assert.equal(elementoTocadoPorLazo(afuera, lazo), false);
});

test('criterio de aceptación: 20 trazos rodeados con lazo, estirados al 150%, movidos, deshechos y rehechos en historial', async () => {
  const trazos = [];
  // Crear 20 trazos en un área de (200, 200) a (500, 500)
  for (let i = 0; i < 20; i++) {
    const ox = 220 + (i % 5) * 50;
    const oy = 220 + Math.floor(i / 5) * 50;
    trazos.push(crearElemento('doc-test', TIPOS_ELEMENTO.TRAZO, {
      x: ox, y: oy, ancho: 30, alto: 30, z: i + 1,
      datos: {
        puntos: [[ox, oy, 0.5], [ox + 30, oy + 30, 0.5]],
        color: '#14192b',
        grosor: 3,
        opacidad: 1,
        herramienta: 'lapiz',
      },
    }));
  }

  const escena = new Escena(trazos);
  const canvas = dom.window.document.getElementById('cv');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 });

  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc-test',
    camara: { x: 0, y: 0, zoom: 1 },
    alCambiar: () => {},
    alCamara: () => {},
    alAjustes: () => {},
    alImagenError: () => {},
  });

  // 1. Activar herramienta LAZO
  motor.setHerramienta('lazo');
  assert.equal(motor.herramienta, 'lazo');

  // 2. Trazar lazo rodeando los 20 trazos (de 180, 180 a 550, 550)
  motor._abajo({ pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 180, shiftKey: false });
  motor._mover({ pointerId: 1, pointerType: 'touch', clientX: 550, clientY: 180 });
  motor._mover({ pointerId: 1, pointerType: 'touch', clientX: 550, clientY: 550 });
  motor._mover({ pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 550 });
  motor._arriba({ pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 180 });

  // Verificar que los 20 trazos quedaron seleccionados
  assert.equal(motor.seleccion.size, 20);

  // 3. Obtener caja envolvente de la selección
  const cajaInicial = motor._cajaRedimensionable();
  assert.ok(cajaInicial);
  assert.equal(cajaInicial.esGrupo, true);
  const anchoInicial = cajaInicial.ancho;
  const altoInicial = cajaInicial.alto;

  // 4. Estirar la selección múltiple al 150 % con manija 'se'
  const manijaX = cajaInicial.x + cajaInicial.ancho;
  const manijaY = cajaInicial.y + cajaInicial.alto;
  const dx = anchoInicial * 0.5; // +50 %
  const dy = altoInicial * 0.5; // +50 %

  // Iniciar gesto de redimensionar
  motor._abajo({ pointerId: 2, pointerType: 'touch', clientX: manijaX, clientY: manijaY, shiftKey: false });
  assert.ok(motor.gesto);
  assert.equal(motor.gesto.tipo, 'redimensionar');

  // Mover puntero ampliando al 150%
  motor._mover({ pointerId: 2, pointerType: 'touch', clientX: manijaX + dx, clientY: manijaY + dy, shiftKey: false });
  // Soltar manija
  motor._arriba({ pointerId: 2, pointerType: 'touch', clientX: manijaX + dx, clientY: manijaY + dy });

  // Comprobar que los trazos crecieron y el grosor lógico del lápiz sigue siendo 3
  const cajaDespuesDeEstirar = motor._cajaRedimensionable();
  assert.ok(Math.abs(cajaDespuesDeEstirar.ancho - anchoInicial * 1.5) < 5);
  for (const id of motor.seleccion) {
    const t = motor.escena.get(id);
    assert.equal(t.datos.grosor, 3); // grosor lógico intacto
  }

  // 5. Mover los 20 trazos juntos (+50px, +50px)
  const trazoCentral = motor.escena.get(trazos[7].id);
  motor._abajo({ pointerId: 3, pointerType: 'touch', clientX: trazoCentral.x + 10, clientY: trazoCentral.y + 10, shiftKey: false });
  assert.equal(motor.gesto?.tipo, 'mover');
  motor._mover({ pointerId: 3, pointerType: 'touch', clientX: trazoCentral.x + 60, clientY: trazoCentral.y + 60 });
  motor._arriba({ pointerId: 3, pointerType: 'touch', clientX: trazoCentral.x + 60, clientY: trazoCentral.y + 60 });

  const cajaMovida = motor._cajaRedimensionable();
  assert.ok(Math.abs(cajaMovida.x - (cajaDespuesDeEstirar.x + 50)) < 2);

  // 6. Deshacer el movimiento (1 acción)
  motor.deshacer();
  const cajaDeshacerMover = motor._cajaRedimensionable();
  assert.ok(Math.abs(cajaDeshacerMover.x - cajaDespuesDeEstirar.x) < 2);

  // 7. Deshacer el estiramiento (1 acción)
  motor.deshacer();
  const cajaOriginalRestaurada = motor._cajaRedimensionable();
  assert.ok(Math.abs(cajaOriginalRestaurada.ancho - anchoInicial) < 2);
  assert.ok(Math.abs(cajaOriginalRestaurada.alto - altoInicial) < 2);

  // 8. Rehacer el estiramiento y el movimiento
  motor.rehacer(); // estirar
  assert.ok(Math.abs(motor._cajaRedimensionable().ancho - anchoInicial * 1.5) < 5);
  motor.rehacer(); // mover
  assert.ok(Math.abs(motor._cajaRedimensionable().x - (cajaDespuesDeEstirar.x + 50)) < 2);

  // 9. Reabrir documento (reconstruir escena a partir de elementos guardados)
  const elementosGuardados = motor.escena.lista();
  assert.equal(elementosGuardados.length, 20);
  const escenaNueva = new Escena(elementosGuardados);
  assert.equal(escenaNueva.lista().length, 20);

  motor.destruir();
});

test('interruptor táctil fijarProporcion mantiene la relación de aspecto sin necesidad de presionar Mayús', () => {
  const figura = crearElemento('doc-prop', TIPOS_ELEMENTO.FIGURA, {
    x: 100, y: 100, ancho: 200, alto: 100, // Relación 2:1
    datos: { forma: 'rectangulo', borde: '#2350d8' },
  });

  const escena = new Escena([figura]);
  const canvas = dom.window.document.getElementById('cv');
  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc-prop',
    alCambiar: () => {},
    alCamara: () => {},
    alAjustes: () => {},
    alImagenError: () => {},
  });

  motor.seleccion = new Set([figura.id]);
  assert.equal(motor.fijarProporcion, false);

  // Activar interruptor táctil para tablet
  motor.toggleFijarProporcion();
  assert.equal(motor.fijarProporcion, true);

  // Redimensionar desde esquina 'se' con dx = 100, dy = 10
  motor._abajo({ pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 200, shiftKey: false });
  motor._mover({ pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 210, shiftKey: false });
  motor._arriba({ pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 210 });

  const figModificada = motor.escena.get(figura.id);
  // Al mantener proporción fija 2:1, el alto se ajusta proporcionalmente al ancho aunque dy fuera pequeño
  const relacionAspecto = figModificada.ancho / figModificada.alto;
  assert.ok(Math.abs(relacionAspecto - 2) < 0.05);

  motor.destruir();
});

test('selección múltiple con Mayús y Ctrl clic agrega y alterna elementos', () => {
  const e1 = crearElemento('doc-m', TIPOS_ELEMENTO.FIGURA, { x: 50, y: 50, ancho: 40, alto: 40, datos: { forma: 'rectangulo' } });
  const e2 = crearElemento('doc-m', TIPOS_ELEMENTO.FIGURA, { x: 150, y: 50, ancho: 40, alto: 40, datos: { forma: 'rectangulo' } });
  const e3 = crearElemento('doc-m', TIPOS_ELEMENTO.FIGURA, { x: 250, y: 50, ancho: 40, alto: 40, datos: { forma: 'rectangulo' } });

  const escena = new Escena([e1, e2, e3]);
  const canvas = dom.window.document.getElementById('cv');
  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc-m',
    camara: { x: 0, y: 0, zoom: 1 },
    alCambiar: () => {},
    alCamara: () => {},
    alAjustes: () => {},
    alImagenError: () => {},
  });

  // Clic en e1
  motor._abajo({ pointerId: 1, pointerType: 'mouse', clientX: 70, clientY: 70, shiftKey: false });
  motor._arriba({ pointerId: 1, pointerType: 'mouse', clientX: 70, clientY: 70 });
  assert.equal(motor.seleccion.size, 1);
  assert.ok(motor.seleccion.has(e1.id));

  // Mayús + clic en e2
  motor._abajo({ pointerId: 1, pointerType: 'mouse', clientX: 170, clientY: 70, shiftKey: true });
  motor._arriba({ pointerId: 1, pointerType: 'mouse', clientX: 170, clientY: 70 });
  assert.equal(motor.seleccion.size, 2);
  assert.ok(motor.seleccion.has(e1.id));
  assert.ok(motor.seleccion.has(e2.id));

  // Ctrl + clic en e3
  motor._abajo({ pointerId: 1, pointerType: 'mouse', clientX: 270, clientY: 70, ctrlKey: true });
  motor._arriba({ pointerId: 1, pointerType: 'mouse', clientX: 270, clientY: 70 });
  assert.equal(motor.seleccion.size, 3);

  // Ctrl + clic en e2 (lo deselecciona)
  motor._abajo({ pointerId: 1, pointerType: 'mouse', clientX: 170, clientY: 70, ctrlKey: true });
  motor._arriba({ pointerId: 1, pointerType: 'mouse', clientX: 170, clientY: 70 });
  assert.equal(motor.seleccion.size, 2);
  assert.ok(motor.seleccion.has(e1.id));
  assert.ok(motor.seleccion.has(e3.id));

  // Eliminar selección múltiple como una sola acción
  motor.eliminarSeleccion();
  assert.equal(motor.escena.lista().length, 1);
  assert.equal(motor.escena.lista()[0].id, e2.id);

  // Deshacer eliminación
  motor.deshacer();
  assert.equal(motor.escena.lista().length, 3);

  motor.destruir();
});
