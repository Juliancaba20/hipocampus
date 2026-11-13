import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearDocumento, crearElemento, guardarDocumento, obtenerDocumento,
  guardarElementos, listarElementos, guardarBlob, nuevoId,
} from '../src/almacen/index.js';
import {
  empaquetarDocumento, empaquetarColeccion, desempaquetarArchivo, migrarArchivo,
  sanearDocumentoImportado, ID_APP,
} from '../src/archivos/formato.js';
import { exportarDocumento, intentarCompartirArchivo } from '../src/archivos/exportar.js';
import { persistirDocumentoImportado, importarArchivos } from '../src/archivos/importar.js';
import {
  comprobarNecesidadCopia,
} from '../src/archivos/copias.js';
import { JSDOM } from 'jsdom';
import { construirHojasPizarron } from '../src/formatos/impresion.js';

test('ida y vuelta de un documento completo con texto, trazo, figura e imagen', async () => {
  const doc = crearDocumento({ titulo: 'Nota de Anatomía', formato: 'pizarron' });
  await guardarDocumento(doc);

  const blobImg = await guardarBlob(new Blob(['datos-de-imagen-falsa'], { type: 'image/png' }));
  const elTexto = crearElemento(doc.id, 'texto', {
    x: 100, y: 120, ancho: 200, alto: 80,
    datos: { bloques: [{ tipo: 'p', spans: [{ texto: 'Músculo bíceps braquial', negrita: true }] }] },
  });
  const elTrazo = crearElemento(doc.id, 'trazo', {
    x: 50, y: 50, ancho: 100, alto: 100,
    datos: { puntos: [[50, 50], [80, 90], [150, 150]], grosor: 4, color: '#2350d8' },
  });
  const elFigura = crearElemento(doc.id, 'figura', {
    x: 200, y: 200, ancho: 120, alto: 80,
    datos: { forma: 'rectangulo', borde: '#14192b', grosor: 2 },
  });
  const elImagen = crearElemento(doc.id, 'imagen', {
    x: 350, y: 100, ancho: 200, alto: 150,
    datos: { blobId: blobImg.id, anchoOriginal: 400, altoOriginal: 300 },
  });

  await guardarElementos([elTexto, elTrazo, elFigura, elImagen]);

  // Exportar a bytes
  const expRes = await exportarDocumento(doc, { compartir: false });
  assert.equal(expRes.metodo, 'descargado');
  assert.match(expRes.nombreArchivo, /^Nota_de_Anatomia\.nota$/);

  // Desempaquetar y comprobar estructura
  const elementos = await listarElementos(doc.id);
  const bytes = await empaquetarDocumento(doc, elementos, [{
    id: blobImg.id,
    tipo: 'image/png',
    nombre: 'imagen.png',
    tamano: 22,
    base64: Buffer.from('datos-de-imagen-falsa').toString('base64'),
  }]);

  const desempaquetado = await desempaquetarArchivo(bytes);
  assert.equal(desempaquetado.tipo, 'documento');
  assert.equal(desempaquetado.documento.titulo, 'Nota de Anatomía');
  assert.equal(desempaquetado.elementos.length, 4);
  assert.equal(desempaquetado.recursos.length, 1);
  assert.equal(desempaquetado.recursos[0].id, blobImg.id);
});

test('desempaquetarArchivo rechaza archivos corruptos y bytes no válidos', async () => {
  // Bytes aleatorios sin sentido
  const corrupto = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
  await assert.rejects(async () => {
    await desempaquetarArchivo(corrupto);
  }, /El archivo no contiene un formato JSON válido|El archivo no contiene texto legible/);

  // Cabecera Gzip rota
  const gzipRoto = new Uint8Array([0x1f, 0x8b, 0x00, 0x00, 0xff, 0xff]);
  await assert.rejects(async () => {
    await desempaquetarArchivo(gzipRoto);
  }, /El archivo comprimido está dañado/);
});

test('rechaza archivos de versión más reciente o de otra aplicación', () => {
  // Otra aplicación
  assert.throws(() => {
    migrarArchivo({ formatoApp: 'otra-app', versionArchivo: 1 });
  }, /El archivo seleccionado no pertenece a la aplicación Anotomía/);

  // Versión futura no compatible
  assert.throws(() => {
    migrarArchivo({ formatoApp: ID_APP, versionArchivo: 99 });
  }, /El archivo fue creado con una versión más reciente \(99\) de Anotomía/);

  // Estructura nula o vacía
  assert.throws(() => {
    migrarArchivo(null);
  }, /El archivo no contiene un formato de datos reconocible/);
});

test('sanearDocumentoImportado tolera datos incompletos o malformados sin fallar', () => {
  const saneado = sanearDocumentoImportado({
    documento: {
      titulo: '<script>alert(1)</script>Título Seguro',
      formato: 'invalido',
      renglones: { interlineado: -50, estilo: 'desconocido' },
    },
    elementos: [
      null,
      { tipo: 'invalido' },
      { tipo: 'texto', x: 0, y: 0, ancho: 100, alto: 50, datos: { bloques: 'no-array' } },
      { tipo: 'trazo', x: 10, y: 10, ancho: 20, alto: 20, datos: { puntos: 'invalido' } }, // se descarta por puntos vacíos
      { tipo: 'figura', x: 5, y: 5, ancho: 50, alto: 50, datos: { forma: 'circulo-raro', grosor: 999 } },
    ],
  });

  assert.equal(saneado.documento.titulo, 'alert(1)Título Seguro');
  assert.equal(saneado.documento.formato, 'pizarron'); // fallback a formato seguro
  assert.equal(saneado.documento.renglones.interlineado, 32); // normalizado al rango válido
  assert.equal(saneado.documento.renglones.estilo, 'rayado');
  assert.equal(saneado.elementos.length, 2); // el texto saneado y la figura saneada
  assert.equal(saneado.elementos[1].datos.forma, 'rectangulo');
  assert.equal(saneado.elementos[1].datos.grosor, 40); // acotado a máximo 40
});

test('manejo de duplicados: reemplazar actualiza el documento existente', async () => {
  const doc = crearDocumento({ titulo: 'Original' });
  await guardarDocumento(doc);
  await guardarElementos([crearElemento(doc.id, 'texto', { datos: { bloques: [] } })]);

  const paquete = {
    documento: { ...doc, titulo: 'Reemplazado por importación' },
    elementos: [
      crearElemento(doc.id, 'figura', { datos: { forma: 'elipse' } }),
      crearElemento(doc.id, 'figura', { datos: { forma: 'rombo' } }),
    ],
    recursos: [],
  };

  const res = await persistirDocumentoImportado(paquete, 'reemplazar');
  assert.equal(res.accion, 'reemplazar');

  const actualizado = await obtenerDocumento(doc.id);
  assert.equal(actualizado.titulo, 'Reemplazado por importación');
  const els = await listarElementos(doc.id);
  assert.equal(els.length, 2);
  assert.ok(els.every((e) => e.tipo === 'figura'));
});

test('manejo de duplicados: conservar-ambos genera identificador nuevo y no toca el original', async () => {
  const doc = crearDocumento({ titulo: 'Base Fisiología' });
  await guardarDocumento(doc);
  await guardarElementos([crearElemento(doc.id, 'texto', { datos: { bloques: [] } })]);

  const paquete = {
    documento: { ...doc, titulo: 'Base Fisiología' },
    elementos: [crearElemento(doc.id, 'simbolo', { datos: { caracter: 'α' } })],
    recursos: [],
  };

  const res = await persistirDocumentoImportado(paquete, 'conservar-ambos');
  assert.equal(res.accion, 'conservar-ambos');
  assert.notEqual(res.documento.id, doc.id);
  assert.equal(res.documento.titulo, 'Base Fisiología (copia)');

  // El original sigue intacto con su texto
  const orig = await obtenerDocumento(doc.id);
  assert.equal(orig.titulo, 'Base Fisiología');
  const elsOrig = await listarElementos(doc.id);
  assert.equal(elsOrig.length, 1);
  assert.equal(elsOrig[0].tipo, 'texto');

  // La copia tiene el nuevo id y su nuevo elemento
  const copia = await obtenerDocumento(res.documento.id);
  assert.equal(copia.titulo, 'Base Fisiología (copia)');
  const elsCopia = await listarElementos(res.documento.id);
  assert.equal(elsCopia.length, 1);
  assert.equal(elsCopia[0].tipo, 'simbolo');
  assert.notEqual(elsCopia[0].id, paquete.elementos[0].id);
});

test('manejo de duplicados: omitir no realiza modificaciones en la base', async () => {
  const doc = crearDocumento({ titulo: 'Intacto' });
  await guardarDocumento(doc);

  const paquete = {
    documento: { ...doc, titulo: 'Intento de cambio' },
    elementos: [],
    recursos: [],
  };

  const res = await persistirDocumentoImportado(paquete, 'omitir');
  assert.equal(res.accion, 'omitido');

  const enBase = await obtenerDocumento(doc.id);
  assert.equal(enBase.titulo, 'Intacto');
});

test('importación atómica: un error no deja datos a medias en IndexedDB', async () => {
  const idInexistente = nuevoId();
  const paqueteInvalido = {
    documento: { id: idInexistente, titulo: 'Doc Incompleto', formato: 'pizarron' },
    elementos: [
      { id: 'el-1', documentoId: idInexistente, tipo: 'texto', x: 0, y: 0, ancho: 10, alto: 10, datos: {} },
    ],
    // Recurso corrupto con base64 que provocará un fallo durante la decodificación
    recursos: [
      { id: 'blob-err', base64: null, tipo: 'image/png' },
    ],
  };

  await assert.rejects(async () => {
    await persistirDocumentoImportado(paqueteInvalido, 'reemplazar');
  });

  // Verificamos que no se guardó el documento
  const buscado = await obtenerDocumento(idInexistente);
  assert.equal(buscado, undefined);
  const elementosRestantes = await listarElementos(idInexistente);
  assert.equal(elementosRestantes.length, 0);
});

test('copia de respaldo completa (colección) exporta e importa todas las notas activas', async () => {
  const doc1 = await guardarDocumento(crearDocumento({ titulo: 'Histología 1' }));
  const doc2 = await guardarDocumento(crearDocumento({ titulo: 'Embriología 2' }));
  await guardarElementos([crearElemento(doc1.id, 'trazo', { datos: { puntos: [[0, 0], [10, 10]] } })]);
  await guardarElementos([crearElemento(doc2.id, 'figura', { datos: { forma: 'elipse' } })]);

  const items = [
    { documento: doc1, elementos: await listarElementos(doc1.id), recursos: [] },
    { documento: doc2, elementos: await listarElementos(doc2.id), recursos: [] },
  ];
  const bytes = await empaquetarColeccion(items);

  const desempaquetado = await desempaquetarArchivo(bytes);
  assert.equal(desempaquetado.tipo, 'coleccion');
  assert.equal(desempaquetado.items.length, 2);
  assert.equal(desempaquetado.items[0].documento.titulo, 'Histología 1');
  assert.equal(desempaquetado.items[1].documento.titulo, 'Embriología 2');
});

test('comprobarNecesidadCopia verifica intervalos y modificaciones pendientes', () => {
  const ahora = Date.now();
  const docs = [{ id: '1', modificado: ahora - 2 * 86400000 }];

  // 1. Con intervalo 0 ('Nunca'), nunca avisa
  assert.equal(comprobarNecesidadCopia(docs, { intervalo: 0, ultimaFecha: 0 }), false);

  // 2. Si no hay documentos, no avisa
  assert.equal(comprobarNecesidadCopia([], { intervalo: 14, ultimaFecha: 0 }), false);

  // 3. Si no pasó el intervalo, no avisa
  const fechaReciente = ahora - 5 * 86400000;
  assert.equal(comprobarNecesidadCopia(docs, { intervalo: 14, ultimaFecha: fechaReciente }), false);

  // 4. Si pasaron los días pero no hay cambios posteriores a la última copia, no avisa
  const fechaAnterior = ahora - 20 * 86400000;
  const docsAntiguos = [{ id: '1', modificado: ahora - 25 * 86400000 }];
  assert.equal(comprobarNecesidadCopia(docsAntiguos, { intervalo: 14, ultimaFecha: fechaAnterior }), false);

  // 5. Si pasaron los días y HAY modificaciones posteriores a la última copia, AVISA
  assert.equal(comprobarNecesidadCopia(docs, { intervalo: 14, ultimaFecha: fechaAnterior }), true);
});

test('construirHojasPizarron arma una hoja A4 con dimensiones escaladas y título seguro', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="cont"></div></body></html>');
  const cont = dom.window.document.getElementById('cont');
  let dibujarLlamado = false;

  const resultado = construirHojasPizarron(cont, {
    titulo: 'Pizarrón con <b>HTML</b>',
    factor: 2,
    dibujarEn: (cv, factor) => {
      dibujarLlamado = true;
      assert.equal(factor, 2);
    },
  });

  assert.equal(resultado, 1);
  assert.equal(cont.children.length, 1);
  const hoja = cont.children[0];
  assert.ok(hoja.classList.contains('nt-pagina-impresa'));
  assert.ok(hoja.classList.contains('nt-hoja-pizarron'));

  const rotulo = hoja.querySelector('.nt-pagina-impresa__rotulo');
  assert.equal(rotulo.textContent, 'Pizarrón con <b>HTML</b> · Pizarrón completo');
  assert.equal(rotulo.innerHTML, 'Pizarrón con &lt;b&gt;HTML&lt;/b&gt; · Pizarrón completo');

  const cv = hoja.querySelector('canvas');
  assert.equal(cv.width, 794 * 2);
  assert.equal(cv.height, 1123 * 2);
  assert.equal(dibujarLlamado, true);
});

// ---------- Correcciones de la auditoría posterior a la etapa 12 ----------
const archivoDe = (bytes, name) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const itemSimple = (titulo, recursos = []) => {
  const d = crearDocumento({ titulo, formato: 'pizarron' });
  const e = crearElemento(d.id, 'simbolo', { x: 1, y: 1, ancho: 10, alto: 10, datos: { caracter: 'α', tamano: 20, color: '#000000' } });
  return { documento: d, elementos: [e], recursos };
};

test('importar un respaldo con un documento corrupto no deja nada a medias', async () => {
  const bueno = itemSimple('Respaldo bueno A1');
  const malo = itemSimple('Respaldo malo A2', [{ id: nuevoId(), tipo: 'image/png', nombre: 'x', base64: '%%%no-es-base64%%%' }]);
  const bytes = await empaquetarColeccion([bueno, malo]);
  const res = await importarArchivos([archivoDe(bytes, 'copia.anotomia-respaldo')]);
  assert.equal(res.errores.length, 1);
  assert.equal(res.importados, 0);
  assert.equal(await obtenerDocumento(bueno.documento.id), undefined, 'el primer documento no debe quedar guardado');
});

test('omitir un duplicado no se cuenta como importado', async () => {
  const item = itemSimple('Duplicado A3');
  await persistirDocumentoImportado(item, 'reemplazar');
  const bytes = await empaquetarDocumento(item.documento, item.elementos, []);
  const res = await importarArchivos([archivoDe(bytes, 'd.nota')], { solicitarDecision: async () => ({ decision: 'omitir', aplicarATodos: false }) });
  assert.equal(res.omitidos, 1);
  assert.equal(res.importados, 0);
});

test('una imagen sin su recurso se omite y se informa', async () => {
  const d = crearDocumento({ titulo: 'Imagen huérfana A4' });
  const e = crearElemento(d.id, 'imagen', { x: 0, y: 0, ancho: 50, alto: 50, datos: { blobId: 'no-existe-' + nuevoId() } });
  const bytes = await empaquetarDocumento(d, [e], []);
  const res = await importarArchivos([archivoDe(bytes, 'i.nota')]);
  assert.equal(res.importados, 1);
  assert.equal(res.imagenesOmitidas, 1);
  assert.equal((await listarElementos(d.id)).length, 0);
});

test('la configuración importada se sanea (cámara, páginas, tarjetas)', () => {
  const base = itemSimple('Config A5');
  base.documento.config = JSON.parse('{"camara":{"x":0,"y":0,"zoom":-5},"cantidadPaginas":1000000000,"__proto__":{"x":1},"tarjetas":[null,7,{"id":"t1","titulo":"Uno"}],"personalizado":{"anchoMm":1e9}}');
  base.documento.formato = 'paginas';
  const p = sanearDocumentoImportado(base);
  assert.equal(p.documento.config.camara, undefined);
  assert.equal(p.documento.config.cantidadPaginas, 2000);
  assert.equal(Object.prototype.x, undefined);
  base.documento.formato = 'tarjetas';
  const t = sanearDocumentoImportado(base);
  assert.equal(t.documento.config.tarjetas.length, 1);
  assert.equal(t.documento.config.tarjetas[0].id, 't1');
  assert.equal(t.documento.config.personalizado.anchoMm, 400);
});

test('cancelar la hoja de compartir no cuenta como copia hecha', async () => {
  const previo = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previoFile = globalThis.File;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => true, share: async () => { const e = new Error('cancelado'); e.name = 'AbortError'; throw e; } } });
  globalThis.File = class { constructor(partes, nombre) { this.nombre = nombre; } };
  try {
    assert.equal(await intentarCompartirArchivo(new Blob(['x']), 'a.nota', 't'), 'cancelado');
    const doc = crearDocumento({ titulo: 'Compartir A6' });
    const res = await exportarDocumento(doc, { elementos: [], compartir: true });
    assert.equal(res.metodo, 'cancelado');
  } finally {
    if (previo) Object.defineProperty(globalThis, 'navigator', previo); else delete globalThis.navigator;
    globalThis.File = previoFile;
  }
});

test('el recordatorio de copia no avisa el primer día de uso', () => {
  const ahora = Date.now();
  const nuevos = [{ id: '1', creado: ahora - 86400000, modificado: ahora }];
  assert.equal(comprobarNecesidadCopia(nuevos, { intervalo: 14, ultimaFecha: 0 }), false);
  const viejos = [{ id: '1', creado: ahora - 20 * 86400000, modificado: ahora - 86400000 }];
  assert.equal(comprobarNecesidadCopia(viejos, { intervalo: 14, ultimaFecha: 0 }), true);
});
