// Pruebas automatizadas para la Etapa 17A: Copiar, cortar, pegar y duplicar elementos.
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
const { crearElemento, TIPOS_ELEMENTO } = await import('../src/almacen/modelo.js');
const {
  guardarEnPortapapeles,
  hayContenidoEnPortapapeles,
  obtenerDePortapapeles,
  limpiarPortapapeles,
  prepararElementosParaPegar,
} = await import('../src/lienzo/portapapeles.js');
const { marcosDePaginas, yDePagina } = await import('../src/formatos/paginas.js');

function crear30ElementosMezclados(documentoId, contenedor = null) {
  const lista = [];
  let z = 0;

  // 6 Trazos
  for (let i = 0; i < 6; i++) {
    lista.push(crearElemento(documentoId, TIPOS_ELEMENTO.TRAZO, {
      x: 100 + i * 20, y: 100 + i * 20, ancho: 80, alto: 60, z: ++z, contenedor,
      datos: {
        puntos: [[100 + i * 20, 100 + i * 20, 0.5], [180 + i * 20, 160 + i * 20, 0.5]],
        color: '#2350d8', grosor: 3, opacidad: 1, herramienta: 'lapiz',
      },
    }));
  }

  // 6 Figuras
  const formas = ['rectangulo', 'elipse', 'triangulo', 'rombo', 'linea', 'flecha'];
  for (let i = 0; i < 6; i++) {
    lista.push(crearElemento(documentoId, TIPOS_ELEMENTO.FIGURA, {
      x: 250 + i * 25, y: 120 + i * 15, ancho: 90, alto: 70, z: ++z, contenedor,
      datos: { forma: formas[i], borde: '#1f9d55', relleno: null, grosor: 2 },
    }));
  }

  // 6 Textos
  for (let i = 0; i < 6; i++) {
    lista.push(crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
      x: 120 + i * 30, y: 300 + i * 25, ancho: 200, alto: 45, z: ++z, contenedor,
      datos: {
        bloques: [{ tipo: 'parrafo', runs: [{ t: `Texto de prueba número ${i + 1}` }] }],
        tamano: 18, color: '#14192b',
      },
    }));
  }

  // 6 Imágenes (con referencias a blobId)
  for (let i = 0; i < 6; i++) {
    lista.push(crearElemento(documentoId, TIPOS_ELEMENTO.IMAGEN, {
      x: 350 + i * 20, y: 350 + i * 20, ancho: 120, alto: 90, z: ++z, contenedor,
      datos: {
        blobId: `blob-anatomia-${i + 1}`,
        anchoOriginal: 800,
        altoOriginal: 600,
        nombre: `corte_${i + 1}.png`,
      },
    }));
  }

  // 6 Símbolos
  const simbolos = ['α', 'β', 'γ', 'Δ', '±', '∞'];
  for (let i = 0; i < 6; i++) {
    lista.push(crearElemento(documentoId, TIPOS_ELEMENTO.SIMBOLO, {
      x: 200 + i * 25, y: 500, ancho: 30, alto: 30, z: ++z, contenedor,
      datos: { caracter: simbolos[i], tamano: 22, color: '#7048e8' },
    }));
  }

  return lista;
}

function montarLienzo({ documentoId = 'doc-test', contenedor = null, marco = null } = {}) {
  const canvas = dom.window.document.getElementById('cv');
  const capaTexto = dom.window.document.getElementById('t');
  const escena = new Escena();
  const motor = new Lienzo(canvas, {
    escena,
    documentoId,
    camara: { x: 0, y: 0, zoom: 1 },
    capaTexto,
    contenedor,
    marco,
  });
  return { motor, escena, canvas };
}

test('portapapeles: guardar, consultar y obtener contenido de forma inmutable', () => {
  limpiarPortapapeles();
  assert.equal(hayContenidoEnPortapapeles(), false);

  const els = [crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { x: 10, y: 20, ancho: 30, alto: 40 })];
  assert.equal(guardarEnPortapapeles(els, { documentoId: 'doc1', formato: 'pizarron' }), true);
  assert.equal(hayContenidoEnPortapapeles(), true);

  const paquete = obtenerDePortapapeles();
  assert.ok(paquete);
  assert.equal(paquete.elementos.length, 1);
  assert.equal(paquete.elementos[0].id, els[0].id);

  // Modificar el retorno no debe alterar la copia interna (inmutabilidad)
  paquete.elementos[0].x = 9999;
  const paquete2 = obtenerDePortapapeles();
  assert.equal(paquete2.elementos[0].x, 10);
  assert.equal(paquete2.contador, 2); // incremento por pegado consecutivo

  limpiarPortapapeles();
  assert.equal(hayContenidoEnPortapapeles(), false);
});

test('prepararElementosParaPegar: genera IDs únicos y preserva blobId en imágenes', () => {
  const els = [
    crearElemento('doc1', TIPOS_ELEMENTO.IMAGEN, {
      x: 100, y: 100, ancho: 80, alto: 80,
      datos: { blobId: 'blob-fijo-123', anchoOriginal: 400, altoOriginal: 400 },
    }),
    crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, {
      x: 50, y: 50, ancho: 50, alto: 50,
      datos: { puntos: [[50, 50, 0.5], [100, 100, 0.5]], color: '#000', grosor: 2 },
    }),
  ];

  const paquete = { elementos: els, origen: { documentoId: 'doc1', formato: 'pizarron' }, contador: 1 };
  const preparados = prepararElementosParaPegar(paquete, {
    documentoId: 'doc-destino',
    formato: 'pizarron',
    zMax: 10,
  });

  assert.equal(preparados.length, 2);
  assert.notEqual(preparados[0].id, els[0].id);
  assert.notEqual(preparados[1].id, els[1].id);
  assert.equal(preparados[0].documentoId, 'doc-destino');
  assert.equal(preparados[1].documentoId, 'doc-destino');

  // La imagen preserva exactamente la referencia a su blobId sin duplicar peso
  assert.equal(preparados[0].datos.blobId, 'blob-fijo-123');

  // El trazo desplazó tanto sus coordenadas x, y como los puntos internos
  assert.equal(preparados[1].x, els[1].x + 24);
  assert.equal(preparados[1].y, els[1].y + 24);
  assert.equal(preparados[1].datos.puntos[0][0], 50 + 24);
  assert.equal(preparados[1].datos.puntos[0][1], 50 + 24);
});

test('pizarrón: copiar y pegar 30 elementos mixtos, con historial de una sola acción', () => {
  limpiarPortapapeles();
  const { motor, escena } = montarLienzo({ documentoId: 'pizarron-doc' });

  const elementos30 = crear30ElementosMezclados('pizarron-doc');
  assert.equal(elementos30.length, 30);
  escena.transitorio(elementos30.map((el) => ({ id: el.id, antes: null, despues: el })));
  assert.equal(escena.lista().length, 30);

  // Seleccionar los 30 elementos
  motor.seleccionarTodo();
  assert.equal(motor.seleccion.size, 30);

  // Copiar
  const copiado = motor.copiar();
  assert.equal(copiado, true);
  assert.equal(hayContenidoEnPortapapeles(), true);

  // Pegar
  const pegado = motor.pegar();
  assert.equal(pegado, true);

  // La escena ahora tiene 60 elementos
  assert.equal(escena.lista().length, 60);

  // Los 30 nuevos elementos quedaron seleccionados
  assert.equal(motor.seleccion.size, 30);
  for (const nuevoIdSel of motor.seleccion) {
    const el = escena.get(nuevoIdSel);
    assert.ok(el, 'El elemento pegado existe en la escena');
    assert.equal(el.documentoId, 'pizarron-doc');
  }

  // Comprobar que las 6 imágenes copiadas conservaron sus blobIds
  const imagenesNuevas = [...motor.seleccion].map((id) => escena.get(id)).filter((e) => e.tipo === 'imagen');
  assert.equal(imagenesNuevas.length, 6);
  imagenesNuevas.forEach((img, idx) => {
    assert.equal(img.datos.blobId, `blob-anatomia-${idx + 1}`);
  });

  // Deshacer revierte todo el pegado (30 elementos) en UNA sola acción
  motor.deshacer();
  assert.equal(escena.lista().length, 30);

  // Rehacer restablece todos los elementos pegados en UNA sola acción
  motor.rehacer();
  assert.equal(escena.lista().length, 60);
});

test('cortar (Ctrl+X): copia los elementos y los elimina en una sola acción', () => {
  limpiarPortapapeles();
  const { motor, escena } = montarLienzo({ documentoId: 'pizarron-cortar' });

  const figuras = [
    crearElemento('pizarron-cortar', TIPOS_ELEMENTO.FIGURA, { x: 10, y: 10, ancho: 40, alto: 40, datos: { forma: 'rectangulo' } }),
    crearElemento('pizarron-cortar', TIPOS_ELEMENTO.FIGURA, { x: 60, y: 10, ancho: 40, alto: 40, datos: { forma: 'elipse' } }),
  ];
  escena.transitorio(figuras.map((f) => ({ id: f.id, antes: null, despues: f })));
  assert.equal(escena.lista().length, 2);

  motor.seleccionarTodo();
  assert.equal(motor.seleccion.size, 2);

  // Cortar
  const cortado = motor.cortar();
  assert.equal(cortado, true);
  assert.equal(escena.lista().length, 0);
  assert.equal(motor.seleccion.size, 0);
  assert.equal(hayContenidoEnPortapapeles(), true);

  // Deshacer restaura los elementos cortados en una sola acción
  motor.deshacer();
  assert.equal(escena.lista().length, 2);

  // Rehacer vuelve a eliminarlos
  motor.rehacer();
  assert.equal(escena.lista().length, 0);

  // Y se pueden pegar en otro punto
  motor.pegar();
  assert.equal(escena.lista().length, 2);
});

test('duplicar (Ctrl+D): clona la selección en el mismo documento con desplazamiento e historial', () => {
  const { motor, escena } = montarLienzo({ documentoId: 'doc-duplicar' });
  const f = crearElemento('doc-duplicar', TIPOS_ELEMENTO.FIGURA, { x: 50, y: 50, ancho: 100, alto: 80, datos: { forma: 'rombo' } });
  escena.transitorio([{ id: f.id, antes: null, despues: f }]);

  motor.seleccion = new Set([f.id]);
  const duplicado = motor.duplicar();
  assert.equal(duplicado, true);

  assert.equal(escena.lista().length, 2);
  const clonId = [...motor.seleccion][0];
  assert.notEqual(clonId, f.id);
  const clon = escena.get(clonId);
  assert.equal(clon.x, f.x + 24);
  assert.equal(clon.y, f.y + 24);

  motor.deshacer();
  assert.equal(escena.lista().length, 1);
  assert.equal(escena.get(f.id)?.id, f.id);

  motor.rehacer();
  assert.equal(escena.lista().length, 2);
});

test('criterio de aceptación: copiar 30 elementos mixtos de Pizarrón y pegar en Tarjetas y Páginas A4', () => {
  limpiarPortapapeles();

  // 1. Crear Pizarrón con 30 elementos mixtos
  const { motor: motorPizarron, escena: escenaPizarron } = montarLienzo({ documentoId: 'pizarron-origen' });
  const elementos30 = crear30ElementosMezclados('pizarron-origen');
  escenaPizarron.transitorio(elementos30.map((el) => ({ id: el.id, antes: null, despues: el })));
  motorPizarron.seleccionarTodo();
  assert.equal(motorPizarron.seleccion.size, 30);

  // Copiar los 30 elementos
  motorPizarron.copiar();
  assert.equal(hayContenidoEnPortapapeles(), true);

  // 2. Abrir editor de Tarjetas y pegar
  const { motor: motorTarjetas, escena: escenaTarjetas } = montarLienzo({
    documentoId: 'tarjetas-destino',
    contenedor: 'tarjeta-activa-01',
    marco: { x: 0, y: 0, ancho: 1120, alto: 630 },
  });

  const pegadoTarjetas = motorTarjetas.pegar();
  assert.equal(pegadoTarjetas, true);
  assert.equal(escenaTarjetas.lista().length, 30);

  // Verificar que todos los 30 elementos pertenecen a la tarjeta activa
  for (const el of escenaTarjetas.lista()) {
    assert.equal(el.documentoId, 'tarjetas-destino');
    assert.equal(el.contenedor, 'tarjeta-activa-01');
    // Coordenadas acotadas a la tarjeta
    assert.ok(el.x >= 0, `X (${el.x}) debe estar en rango de tarjeta`);
    assert.ok(el.y >= 0, `Y (${el.y}) debe estar en rango de tarjeta`);
  }

  // Deshacer y rehacer en tarjetas
  motorTarjetas.deshacer();
  assert.equal(escenaTarjetas.lista().length, 0);
  motorTarjetas.rehacer();
  assert.equal(escenaTarjetas.lista().length, 30);

  // 3. Abrir editor de Páginas A4 en la página activa 2 y pegar
  const { motor: motorPaginas, escena: escenaPaginas } = montarLienzo({
    documentoId: 'paginas-destino',
    contenedor: (y) => (y < 1173 ? 1 : 2),
    marco: marcosDePaginas(2),
  });
  motorPaginas.camara.y = yDePagina(2); // La vista está centrada en la página 2

  const pegadoPaginas = motorPaginas.pegar();
  assert.equal(pegadoPaginas, true);
  assert.equal(escenaPaginas.lista().length, 30);

  // Verificar que todos los 30 elementos tienen contenedor = 2 o Y dentro de página 2
  const yInicioPag2 = yDePagina(2);
  for (const el of escenaPaginas.lista()) {
    assert.equal(el.documentoId, 'paginas-destino');
    assert.ok(el.y >= yInicioPag2, `Y (${el.y}) debe pertenecer a la página 2 (inicio: ${yInicioPag2})`);
  }

  // Deshacer y rehacer en páginas A4
  motorPaginas.deshacer();
  assert.equal(escenaPaginas.lista().length, 0);
  motorPaginas.rehacer();
  assert.equal(escenaPaginas.lista().length, 30);
});

test('convivencia con portapapeles del sistema: texto plano y HTML de Word o web', () => {
  const { motor, escena } = montarLienzo({ documentoId: 'doc-externo' });

  // Pegar simula texto externo con HTML
  const eventoPasteHtml = new dom.window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(eventoPasteHtml, 'clipboardData', {
    value: {
      getData: (t) => {
        if (t === 'text/html') return '<h3>Anatomía humana</h3><p>Estudio de huesos y músculos.</p>';
        if (t === 'text/plain') return 'Anatomía humana\nEstudio de huesos y músculos.';
        return '';
      },
    },
  });

  motor.pegar(eventoPasteHtml);
  assert.ok(eventoPasteHtml.defaultPrevented);
  assert.equal(escena.lista().length, 1);
  const textoPegado = escena.lista()[0];
  assert.equal(textoPegado.tipo, 'texto');
  assert.equal(textoPegado.datos.bloques[0].tipo, 'titulo3');
});
