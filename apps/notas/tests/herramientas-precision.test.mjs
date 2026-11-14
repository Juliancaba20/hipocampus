import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TIPOS_INSTRUMENTO,
  PX_POR_CM,
  PX_POR_MM,
  radianesAGrados,
  gradosARadianes,
  crearRegla,
  crearEscuadra,
  crearTransportador,
  mundoALocal,
  localAMundo,
  snapPuntoARegla,
  snapPuntoAEscuadra,
  snapPuntoATransportador,
  aplicarSnapInstrumento,
} from '../src/herramientas/precision/instrumentos.js';

import {
  reconocerForma,
  simplificarPuntos,
} from '../src/herramientas/precision/reconocimientoFormas.js';

import {
  LAPICES_POR_DEFECTO,
  cargarLapicesFavoritos,
  guardarLapicesFavoritos,
  actualizarLapizFavorito,
} from '../src/herramientas/precision/lapicesFavoritos.js';

test('1. Geometría y escala métrica de instrumentos de precisión', () => {
  assert.ok(PX_POR_CM > 37 && PX_POR_CM < 38, 'Escala métrica estándar de pantalla 96 DPI (~37.795 px/cm)');
  assert.ok(Math.abs(PX_POR_MM * 10 - PX_POR_CM) < 0.0001, '1 cm = 10 mm en escala de píxeles');

  const regla = crearRegla({ longitudCm: 15, x: 100, y: 200, angulo: 0 });
  assert.equal(regla.tipo, TIPOS_INSTRUMENTO.REGLA);
  assert.equal(regla.activo, true);
  assert.equal(regla.longitudCm, 15);
  assert.equal(Math.round(regla.longitud), Math.round(15 * PX_POR_CM));
  assert.ok(regla.ancho > 0, 'La regla tiene un ancho físico de cuerpo acrílico');

  const escuadra = crearEscuadra({ catetoACm: 12, tipoTriangulo: '30-60-90' });
  assert.equal(escuadra.tipo, TIPOS_INSTRUMENTO.ESCUADRA);
  assert.equal(escuadra.tipoTriangulo, '30-60-90');
  assert.equal(escuadra.angulos.a, 90);
  assert.equal(escuadra.angulos.b, 30);
  assert.equal(escuadra.angulos.c, 60);

  const transportador = crearTransportador({ radioCm: 6 });
  assert.equal(transportador.tipo, TIPOS_INSTRUMENTO.TRANSPORTADOR);
  assert.equal(transportador.radioCm, 6);
  assert.ok(transportador.radio > 100);
});

test('2. Transformaciones espaciales mundo <-> local con rotación y desplazamiento', () => {
  const regla = crearRegla({ x: 50, y: 80, angulo: Math.PI / 2 }); // rotada 90°
  const pMundo = { x: 50, y: 180 };
  const pLocal = mundoALocal(regla, pMundo);

  // Al rotar 90°, mover hacia abajo (+Y en mundo) es avanzar en el eje X local
  assert.ok(Math.abs(pLocal.x - 100) < 0.001);
  assert.ok(Math.abs(pLocal.y - 0) < 0.001);

  const reconvertido = localAMundo(regla, pLocal);
  assert.ok(Math.abs(reconvertido.x - pMundo.x) < 0.001);
  assert.ok(Math.abs(reconvertido.y - pMundo.y) < 0.001);
});

test('3. Regla: snap magnético a los bordes rectos superior e inferior', () => {
  const regla = crearRegla({ x: 100, y: 100, angulo: 0, longitudCm: 10 });
  const margenSnap = 20;

  // Punto cerca del borde superior (y = 0 en local, y = 100 en mundo) con ligera desviación
  const pCercaBordeSup = { x: 150, y: 108 }; // 8px de desvío
  const resSup = snapPuntoARegla(regla, pCercaBordeSup, margenSnap);
  assert.equal(resSup.snappeado, true);
  assert.equal(resSup.punto.y, 100, 'El punto se pega con precisión milimétrica al borde superior y=100');
  assert.equal(resSup.punto.x, 150, 'Mantiene la coordenada horizontal');

  // Punto cerca del borde inferior (y = ancho en local)
  const yBordeInfMundo = regla.y + regla.ancho;
  const pCercaBordeInf = { x: 220, y: yBordeInfMundo - 6 };
  const resInf = snapPuntoARegla(regla, pCercaBordeInf, margenSnap);
  assert.equal(resInf.snappeado, true);
  assert.ok(Math.abs(resInf.punto.y - yBordeInfMundo) < 0.001, 'El punto se pega al borde inferior');

  // Punto fuera del rango de snap
  const pLejos = { x: 150, y: 350 };
  const resLejos = snapPuntoARegla(regla, pLejos, margenSnap);
  assert.equal(resLejos.snappeado, false);
  assert.equal(resLejos.punto.x, pLejos.x);
  assert.equal(resLejos.punto.y, pLejos.y);
});

test('4. Escuadra: snap a catetos y a hipotenusa para trazo de ángulos exactos', () => {
  const escuadra = crearEscuadra({ x: 0, y: 0, angulo: 0, catetoACm: 10, tipoTriangulo: '45-45-90' });
  const margenSnap = 25;

  // Snap a cateto horizontal (y = 0)
  const pHori = { x: 80, y: 7 };
  const resHori = snapPuntoAEscuadra(escuadra, pHori, margenSnap);
  assert.equal(resHori.snappeado, true);
  assert.equal(resHori.punto.y, 0);

  // Snap a cateto vertical (x = 0)
  const pVert = { x: 5, y: 90 };
  const resVert = snapPuntoAEscuadra(escuadra, pVert, margenSnap);
  assert.equal(resVert.snappeado, true);
  assert.equal(resVert.punto.x, 0);

  // Snap a hipotenusa (recta que une (catetoA, 0) y (0, catetoB))
  const midX = escuadra.catetoA / 2;
  const midY = escuadra.catetoB / 2;
  const pHip = { x: midX + 4, y: midY + 4 };
  const resHip = snapPuntoAEscuadra(escuadra, pHip, margenSnap);
  assert.equal(resHip.snappeado, true);
  assert.ok(resHip.segmento === 'hipotenusa');
});

test('5. Transportador: lectura angular y snap a borde semicircular (arcos y radios)', () => {
  const transp = crearTransportador({ x: 200, y: 300, angulo: 0, radioCm: 5 });
  const margenSnap = 25;

  // Punto cerca del arco semicircular a 45 grados (en cuadrante superior, y < 0)
  const anguloRad = -Math.PI / 4;
  const radioEsperado = transp.radio;
  const pCercaArco = {
    x: transp.x + (radioEsperado + 6) * Math.cos(anguloRad),
    y: transp.y + (radioEsperado + 6) * Math.sin(anguloRad),
  };

  const resArco = snapPuntoATransportador(transp, pCercaArco, margenSnap);
  assert.equal(resArco.snappeado, true);
  assert.equal(resArco.segmento, 'arco');

  // La distancia al centro debe ser exactamente el radio del transportador
  const distAlCentro = Math.hypot(resArco.punto.x - transp.x, resArco.punto.y - transp.y);
  assert.ok(Math.abs(distAlCentro - radioEsperado) < 0.001, 'El punto snappeado tiene radio circular perfecto');

  // Snap a diámetro base
  const pBase = { x: transp.x + 50, y: transp.y + 4 };
  const resBase = snapPuntoATransportador(transp, pBase, margenSnap);
  assert.equal(resBase.snappeado, true);
  assert.equal(resBase.segmento, 'base');
  assert.equal(resBase.punto.y, transp.y);
});

test('6. Corrección automática de formas («hold-to-snap»): línea recta', () => {
  // Trazo de una línea recta con pequeñas fluctuaciones de mano alzada
  const puntosManoAlzada = [];
  for (let x = 20; x <= 220; x += 10) {
    const temblor = (Math.sin(x) * 1.5);
    puntosManoAlzada.push([x, 100 + temblor, 0.5]);
  }

  const res = reconocerForma(puntosManoAlzada);
  assert.ok(res, 'Debe reconocer una forma regularizada');
  assert.equal(res.tipo, 'linea');
  assert.ok(res.datosFigura);
  assert.equal(res.datosFigura.forma, 'linea');
  assert.equal(res.puntos.length, 2, 'La línea recta corregida se regulariza a 2 extremos exactos');
  assert.equal(res.puntos[0][0], 20);
  assert.equal(res.puntos[1][0], 220);
});

test('7. Corrección automática de formas: círculo o elipse', () => {
  const centroX = 150;
  const centroY = 150;
  const radio = 60;
  const puntosCirculo = [];

  for (let ang = 0; ang <= Math.PI * 2; ang += 0.2) {
    const rVar = radio + (Math.sin(ang * 5) * 2.5); // ruido leve de dibujo manual
    puntosCirculo.push([centroX + rVar * Math.cos(ang), centroY + rVar * Math.sin(ang), 0.5]);
  }
  // Cerrar el trazo
  puntosCirculo.push([puntosCirculo[0][0], puntosCirculo[0][1], 0.5]);

  const res = reconocerForma(puntosCirculo);
  assert.ok(res, 'Debe reconocer el trazo como elipse/círculo');
  assert.ok(res.tipo === 'circulo' || res.tipo === 'elipse');
  assert.equal(res.datosFigura.forma, 'elipse');
  assert.ok(Math.abs(res.datosFigura.ancho - radio * 2) < 15);
  assert.ok(Math.abs(res.datosFigura.alto - radio * 2) < 15);
});

test('8. Corrección automática de formas: rectángulo', () => {
  const puntosRect = [];
  // Lado superior (x: 50 -> 200, y: 50)
  for (let x = 50; x <= 200; x += 15) puntosRect.push([x, 50, 0.5]);
  // Lado derecho (x: 200, y: 50 -> 150)
  for (let y = 50; y <= 150; y += 15) puntosRect.push([200, y, 0.5]);
  // Lado inferior (x: 200 -> 50, y: 150)
  for (let x = 200; x >= 50; x -= 15) puntosRect.push([x, 150, 0.5]);
  // Lado izquierdo (x: 50, y: 150 -> 50)
  for (let y = 150; y >= 50; y -= 15) puntosRect.push([50, y, 0.5]);
  puntosRect.push([50, 50, 0.5]);

  const res = reconocerForma(puntosRect);
  assert.ok(res, 'Debe reconocer el rectángulo');
  assert.equal(res.tipo, 'rectangulo');
  assert.equal(res.datosFigura.forma, 'rectangulo');
  assert.equal(res.datosFigura.x, 50);
  assert.equal(res.datosFigura.y, 50);
  assert.equal(res.datosFigura.ancho, 150);
  assert.equal(res.datosFigura.alto, 100);
});

test('9. Corrección automática de formas: triángulo', () => {
  const puntosTri = [];
  // Vértice A (100, 50) a Vértice B (200, 200)
  for (let i = 0; i <= 10; i++) {
    puntosTri.push([100 + i * 10, 50 + i * 15, 0.5]);
  }
  // Vértice B (200, 200) a Vértice C (0, 200)
  for (let i = 0; i <= 10; i++) {
    puntosTri.push([200 - i * 20, 200, 0.5]);
  }
  // Vértice C (0, 200) de regreso a Vértice A (100, 50)
  for (let i = 0; i <= 10; i++) {
    puntosTri.push([0 + i * 10, 200 - i * 15, 0.5]);
  }

  const res = reconocerForma(puntosTri);
  assert.ok(res, 'Debe reconocer el triángulo');
  assert.equal(res.tipo, 'triangulo');
  assert.equal(res.datosFigura.forma, 'triangulo');
});

test('10. Lápices favoritos: inicialización, personalización y persistencia en almacén', async () => {
  const iniciales = await cargarLapicesFavoritos();
  assert.ok(Array.isArray(iniciales));
  assert.equal(iniciales.length, LAPICES_POR_DEFECTO.length, 'Tiene 4 ranuras por defecto');
  assert.equal(iniciales[0].nombre, 'Boli fino azul');
  assert.equal(iniciales[0].herramienta, 'lapiz');

  // Actualizar un slot (ej. convertir el slot 0 a pluma morada de 5px)
  const actualizados = await actualizarLapizFavorito(0, {
    nombre: 'Pluma Morada',
    color: '#9333ea',
    grosor: 5,
    opacidad: 0.9,
  });

  assert.equal(actualizados[0].nombre, 'Pluma Morada');
  assert.equal(actualizados[0].color, '#9333ea');
  assert.equal(actualizados[0].grosor, 5);

  // Reabrir y verificar persistencia en IndexedDB
  const recargados = await cargarLapicesFavoritos();
  assert.equal(recargados[0].nombre, 'Pluma Morada');
  assert.equal(recargados[0].color, '#9333ea');
});

test('11. Medición de latencia del trazado con y sin snap de instrumento', () => {
  const regla = crearRegla({ x: 50, y: 50, angulo: 0, longitudCm: 20 });
  const NUM_PUNTOS = 1000;

  // Medición 1: cálculo de snap magnético sobre 1.000 puntos continuos
  const t0 = performance.now();
  let snappeados = 0;
  for (let i = 0; i < NUM_PUNTOS; i++) {
    const pt = { x: 50 + (i % 300), y: 50 + (i % 25) };
    const res = aplicarSnapInstrumento(regla, pt, 25);
    if (res.snappeado) snappeados++;
  }
  const tTotalSnap = performance.now() - t0;
  const latenciaPorPuntoSnapMs = tTotalSnap / NUM_PUNTOS;

  // Medición 2: recorrido sin snap
  const tSin0 = performance.now();
  let acum = 0;
  for (let i = 0; i < NUM_PUNTOS; i++) {
    acum += (i * 0.5);
  }
  const tTotalSin = performance.now() - tSin0;
  const latenciaPorPuntoSinMs = tTotalSin / NUM_PUNTOS;

  // Reporte estricto: la operación geométrica de snap debe ser menor a 0.05 ms por evento
  assert.ok(
    latenciaPorPuntoSnapMs < 0.05,
    `El snap por evento (${latenciaPorPuntoSnapMs.toFixed(4)} ms) es sub-milisegundo y no degrada los 120 FPS`
  );
  assert.ok(snappeados > 0, 'Detecta el borde de la regla y aplica la proyección');
});
