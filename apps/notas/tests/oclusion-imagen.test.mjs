// Pruebas unitarias e integración para Etapa 22B · Oclusión de imagen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearMascara,
  mascaraAbsoluta,
  mascaraRelativa,
  puntoEnMascara,
  buscarMascaraEnPunto,
} from '../src/lienzo/oclusion.js';
import { sanearDocumentoImportado, VERSION_FORMATO } from '../src/archivos/formato.js';
import { FORMATOS, TIPOS_ELEMENTO } from '../src/almacen/modelo.js';

test('sanearMascara normaliza coordenadas relativas entre 0 y 1 y valida formas', () => {
  const m1 = sanearMascara({
    id: 'm-1',
    forma: 'rectangulo',
    rx: 0.1,
    ry: 0.2,
    rw: 0.3,
    rh: 0.15,
    texto: 'Vena cava superior',
    color: '#ef4444',
  });
  assert.equal(m1.id, 'm-1');
  assert.equal(m1.forma, 'rectangulo');
  assert.equal(m1.rx, 0.1);
  assert.equal(m1.ry, 0.2);
  assert.equal(m1.rw, 0.3);
  assert.equal(m1.rh, 0.15);
  assert.equal(m1.texto, 'Vena cava superior');
  assert.equal(m1.color, '#ef4444');

  // Forma elipse y límites corregidos
  const m2 = sanearMascara({
    forma: 'elipse',
    rx: -0.5,
    ry: 1.5,
    rw: 2.0,
    rh: -0.1,
  });
  assert.equal(m2.forma, 'elipse');
  assert.equal(m2.rx, 0); // corregido mínimo
  assert.equal(m2.ry, 0.99); // corregido máximo
  assert.ok(m2.rw > 0 && m2.rw <= 1);
  assert.ok(m2.rh > 0 && m2.rh <= 1);
  assert.ok(typeof m2.id === 'string' && m2.id.length > 0);
});

test('mascaraAbsoluta y mascaraRelativa convierten coordenadas de forma bidireccional', () => {
  const img = {
    x: 100,
    y: 200,
    ancho: 400,
    alto: 300,
  };

  const mascaraRel = {
    id: 'm-test',
    forma: 'rectangulo',
    rx: 0.25,
    ry: 0.5,
    rw: 0.2,
    rh: 0.1,
    texto: 'Aorta',
  };

  const abs = mascaraAbsoluta(mascaraRel, img);
  assert.equal(abs.x, 100 + 0.25 * 400); // 200
  assert.equal(abs.y, 200 + 0.5 * 300); // 350
  assert.equal(abs.ancho, 0.2 * 400); // 80
  assert.equal(abs.alto, 0.1 * 300); // 30

  // Conversión inversa
  const convertida = mascaraRelativa({
    x: abs.x,
    y: abs.y,
    ancho: abs.ancho,
    alto: abs.alto,
  }, img, { id: 'm-test', forma: 'rectangulo', texto: 'Aorta' });

  assert.equal(convertida.id, 'm-test');
  assert.ok(Math.abs(convertida.rx - 0.25) < 0.001);
  assert.ok(Math.abs(convertida.ry - 0.5) < 0.001);
  assert.ok(Math.abs(convertida.rw - 0.2) < 0.001);
  assert.ok(Math.abs(convertida.rh - 0.1) < 0.001);
});

test('las máscaras acompañan a la imagen cuando se mueve o redimensiona (invarianza relativa)', () => {
  const mascara = {
    id: 'm-1',
    forma: 'rectangulo',
    rx: 0.2,
    ry: 0.3,
    rw: 0.25,
    rh: 0.15,
  };

  const img1 = { x: 50, y: 50, ancho: 200, alto: 100 };
  const abs1 = mascaraAbsoluta(mascara, img1);
  assert.equal(abs1.x, 90);
  assert.equal(abs1.y, 80);

  // Mover imagen a otra posición
  const imgMovida = { ...img1, x: 300, y: 400 };
  const absMovida = mascaraAbsoluta(mascara, imgMovida);
  assert.equal(absMovida.x, 300 + 0.2 * 200); // 340
  assert.equal(absMovida.y, 400 + 0.3 * 100); // 430

  // Estirar imagen al doble
  const imgEstirada = { ...img1, ancho: 400, alto: 200 };
  const absEstirada = mascaraAbsoluta(mascara, imgEstirada);
  assert.equal(absEstirada.ancho, 0.25 * 400); // 100
  assert.equal(absEstirada.alto, 0.15 * 200); // 30
});

test('puntoEnMascara detecta impactos en rectángulos y elipses', () => {
  const img = { x: 100, y: 100, ancho: 200, alto: 200 };

  const mRect = {
    id: 'rect-1',
    forma: 'rectangulo',
    rx: 0.1, // x: 120
    ry: 0.1, // y: 120
    rw: 0.3, // w: 60 -> x max 180
    rh: 0.2, // h: 40 -> y max 160
  };

  assert.equal(puntoEnMascara(150, 140, mRect, img), true);
  assert.equal(puntoEnMascara(110, 140, mRect, img), false);
  assert.equal(puntoEnMascara(190, 140, mRect, img), false);

  const mElipse = {
    id: 'eli-1',
    forma: 'elipse',
    rx: 0.5, // x: 200, centro x: 230
    ry: 0.5, // y: 200, centro y: 220
    rw: 0.3, // w: 60, radio x: 30
    rh: 0.2, // h: 40, radio y: 20
  };

  // Centro de la elipse
  assert.equal(puntoEnMascara(230, 220, mElipse, img), true);
  // Esquina exterior del bounding box (dentro del rect pero fuera de la elipse)
  assert.equal(puntoEnMascara(201, 201, mElipse, img), false);
});

test('buscarMascaraEnPunto localiza la máscara superior entre los elementos de la escena', () => {
  const img = {
    id: 'img-1',
    tipo: 'imagen',
    x: 0,
    y: 0,
    ancho: 500,
    alto: 400,
    datos: {
      blobId: 'blob-1',
      mascaras: [
        { id: 'm-a', forma: 'rectangulo', rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.2, texto: 'Estructura A' },
        { id: 'm-b', forma: 'elipse', rx: 0.5, ry: 0.5, rw: 0.3, rh: 0.2, texto: 'Estructura B' },
      ],
    },
  };

  const halladoA = buscarMascaraEnPunto(75, 60, [img]);
  assert.ok(halladoA);
  assert.equal(halladoA.elemento.id, 'img-1');
  assert.equal(halladoA.mascara.id, 'm-a');
  assert.equal(halladoA.indice, 0);

  const halladoB = buscarMascaraEnPunto(325, 240, [img]);
  assert.ok(halladoB);
  assert.equal(halladoB.mascara.id, 'm-b');
  assert.equal(halladoB.indice, 1);

  const fuera = buscarMascaraEnPunto(10, 10, [img]);
  assert.equal(fuera, null);
});

test('Criterio de aceptación Etapa 22B: imagen anatómica con 10 etiquetas, estudio y persistencia sin pérdidas', () => {
  // 1. Imagen anatómica con 10 máscaras (rectangulares y elípticas con etiquetas de texto)
  const etiquetasAnatomicas = [
    { texto: 'Aurícula derecha', forma: 'rectangulo', rx: 0.15, ry: 0.12, rw: 0.18, rh: 0.08, color: '#2563eb' },
    { texto: 'Ventrículo derecho', forma: 'rectangulo', rx: 0.20, ry: 0.35, rw: 0.20, rh: 0.09, color: '#2563eb' },
    { texto: 'Aurícula izquierda', forma: 'elipse', rx: 0.65, ry: 0.15, rw: 0.18, rh: 0.10, color: '#dc2626' },
    { texto: 'Ventrículo izquierdo', forma: 'rectangulo', rx: 0.60, ry: 0.40, rw: 0.22, rh: 0.09, color: '#dc2626' },
    { texto: 'Arteria aorta', forma: 'elipse', rx: 0.45, ry: 0.05, rw: 0.16, rh: 0.12, color: '#dc2626' },
    { texto: 'Arteria pulmonar', forma: 'rectangulo', rx: 0.32, ry: 0.10, rw: 0.15, rh: 0.08, color: '#2563eb' },
    { texto: 'Vena cava superior', forma: 'rectangulo', rx: 0.10, ry: 0.04, rw: 0.14, rh: 0.07, color: '#2563eb' },
    { texto: 'Vena cava inferior', forma: 'rectangulo', rx: 0.12, ry: 0.60, rw: 0.14, rh: 0.07, color: '#2563eb' },
    { texto: 'Válvula mitral', forma: 'elipse', rx: 0.58, ry: 0.28, rw: 0.12, rh: 0.08, color: '#16a34a' },
    { texto: 'Válvula tricúspide', forma: 'elipse', rx: 0.25, ry: 0.26, rw: 0.12, rh: 0.08, color: '#16a34a' },
  ];

  const mascarasSaneadas = etiquetasAnatomicas.map((e, idx) => sanearMascara({
    id: `etiqueta-${idx + 1}`,
    ...e,
  }));
  assert.equal(mascarasSaneadas.length, 10);

  const elementoImagen = {
    id: 'img-corazon-1',
    tipo: TIPOS_ELEMENTO.IMAGEN,
    x: 80,
    y: 120,
    ancho: 640,
    alto: 480,
    datos: {
      blobId: 'blob-anatomia-corazon',
      anchoOriginal: 1280,
      altoOriginal: 960,
      marco: 'redondeado',
      radioEsquinas: 12,
      mascaras: mascarasSaneadas,
    },
  };

  // 2. Simulación de estudio: «ocultar todas»
  // Se tapan todas inicialmente
  const reveladas = new Set();
  assert.equal(reveladas.size, 0); // Todas tapadas

  // El estudiante toca la etiqueta 1 (Aurícula derecha)
  const abs1 = mascaraAbsoluta(mascarasSaneadas[0], elementoImagen);
  const clickX1 = abs1.x + abs1.ancho / 2;
  const clickY1 = abs1.y + abs1.alto / 2;
  const impacto1 = buscarMascaraEnPunto(clickX1, clickY1, [elementoImagen]);
  assert.ok(impacto1);
  assert.equal(impacto1.mascara.texto, 'Aurícula derecha');
  reveladas.add(`${elementoImagen.id}-${impacto1.mascara.id}`);
  assert.equal(reveladas.size, 1);

  // 3. Simulación de estudio: «ocultar una»
  // En modo «ocultar una», se selecciona una máscara activa (por ejemplo, índice 4: Arteria aorta)
  let indiceActivo = 4;
  assert.equal(mascarasSaneadas[indiceActivo].texto, 'Arteria aorta');
  // Se avanza a la siguiente máscara en modo una
  indiceActivo = (indiceActivo + 1) % mascarasSaneadas.length;
  assert.equal(mascarasSaneadas[indiceActivo].texto, 'Arteria pulmonar');

  // 4. Invarianza: Mover y redimensionar la imagen
  const elementoImagenMovido = {
    ...elementoImagen,
    x: 250,
    y: 350,
    ancho: 800,
    alto: 600,
  };
  // Comprobar que todas las 10 máscaras calculan sus coordenadas absolutas acordes a la nueva posición y escala
  for (let i = 0; i < 10; i++) {
    const abs = mascaraAbsoluta(elementoImagenMovido.datos.mascaras[i], elementoImagenMovido);
    assert.equal(abs.x, 250 + mascarasSaneadas[i].rx * 800);
    assert.equal(abs.y, 350 + mascarasSaneadas[i].ry * 600);
    assert.equal(abs.ancho, mascarasSaneadas[i].rw * 800);
    assert.equal(abs.alto, mascarasSaneadas[i].rh * 600);
  }

  // 5. Serialización .nota y re-apertura sin pérdidas
  const documentoCompleto = {
    versionArchivo: VERSION_FORMATO,
    formato: FORMATOS.TARJETAS,
    config: {
      tarjetas: [{ id: 'tarjeta-1', titulo: 'Anatomía del Corazón', orden: 0, dobleCara: false }],
    },
    elementos: [
      {
        ...elementoImagen,
        tarjetaId: 'tarjeta-1',
        cara: 'anverso',
      },
    ],
  };

  const docSaneado = sanearDocumentoImportado(documentoCompleto);
  assert.equal(docSaneado.elementos.length, 1);
  const imgRecuperada = docSaneado.elementos[0];
  assert.equal(imgRecuperada.tipo, TIPOS_ELEMENTO.IMAGEN);
  assert.equal(imgRecuperada.datos.mascaras.length, 10);

  // Verificar integridad exacta de cada una de las 10 máscaras tras el guardado y carga
  for (let i = 0; i < 10; i++) {
    const orig = mascarasSaneadas[i];
    const rec = imgRecuperada.datos.mascaras[i];
    assert.equal(rec.id, orig.id);
    assert.equal(rec.forma, orig.forma);
    assert.equal(rec.texto, orig.texto);
    assert.equal(rec.color, orig.color);
    assert.ok(Math.abs(rec.rx - orig.rx) < 0.0001);
    assert.ok(Math.abs(rec.ry - orig.ry) < 0.0001);
    assert.ok(Math.abs(rec.rw - orig.rw) < 0.0001);
    assert.ok(Math.abs(rec.rh - orig.rh) < 0.0001);
  }
});
