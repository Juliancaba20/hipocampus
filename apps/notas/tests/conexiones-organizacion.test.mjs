import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  crearDocumento,
  guardarDocumento,
  obtenerDocumento,
  borrarDocumentoDefinitivo,
  enviarAPapelera,
  restaurarDePapelera,
  guardarElementos,
  nuevoId,
} from '../src/almacen/index.js';

import {
  verificarEstadoNotaEnlace,
  extraerEnlacesDeElemento,
  buscarNotasQueEnlazanA,
  obtenerEnlacesSalientesDocumento,
} from '../src/almacen/enlaces.js';

import {
  listarExamenes,
  guardarExamen,
  eliminarExamen,
  alternarCompletadoExamen,
  calcularCuentaRegresivaExamen,
  obtenerProximoExamen,
} from '../src/almacen/examenes.js';

import {
  calcularPosicionNodoHijo,
  obtenerHijosDeNodo,
  ramificarNodoMapaConceptual,
} from '../src/herramientas/mapaConceptual.js';

import { Escena } from '../src/lienzo/escena.js';

test('1. Enlaces entre notas: extracción desde texto y desde figuras', () => {
  // Elemento de texto con enlaces web y enlaces internos a otras notas
  const elementoTexto = {
    id: 'el-texto-1',
    tipo: 'texto',
    x: 100,
    y: 100,
    datos: {
      bloques: [
        {
          tipo: 'parrafo',
          runs: [
            { texto: 'Ver nota de ' },
            {
              texto: 'Anatomía',
              enlace: { tipo: 'nota', notaId: 'nota-anatomia-1', url: 'nota://nota-anatomia-1' },
            },
            { texto: ' y también ' },
            {
              texto: 'Fisiología',
              enlace: { tipo: 'nota', notaId: 'nota-fisio-2', url: 'nota://nota-fisio-2' },
            },
          ],
        },
      ],
    },
  };

  const enlacesTexto = extraerEnlacesDeElemento(elementoTexto);
  assert.equal(enlacesTexto.length, 2, 'Debe extraer 2 enlaces a notas desde el texto');
  assert.equal(enlacesTexto[0].notaId, 'nota-anatomia-1');
  assert.equal(enlacesTexto[0].texto, 'Anatomía');
  assert.equal(enlacesTexto[1].notaId, 'nota-fisio-2');
  assert.equal(enlacesTexto[1].texto, 'Fisiología');

  // Elemento gráfico (figura / imagen) con enlace directo
  const elementoFigura = {
    id: 'fig-1',
    tipo: 'figura',
    x: 200,
    y: 200,
    ancho: 120,
    alto: 60,
    enlace: { tipo: 'nota', notaId: 'nota-bioquimica-3', titulo: 'Bioquímica General' },
    datos: {
      forma: 'rectangulo',
      texto: 'Ir a Bioquímica',
      enlace: { tipo: 'nota', notaId: 'nota-bioquimica-3', titulo: 'Bioquímica General' },
    },
  };

  const enlacesFigura = extraerEnlacesDeElemento(elementoFigura);
  assert.equal(enlacesFigura.length, 1, 'Debe extraer el enlace de la figura');
  assert.equal(enlacesFigura[0].notaId, 'nota-bioquimica-3');
  assert.equal(enlacesFigura[0].origen, 'figura');
});

test('2. Enlaces salientes y panel de «Notas que enlazan aquí» (Backlinks)', async () => {
  // Creamos 4 notas: Doc Principal que enlaza a Doc A, Doc B y Doc C
  const docA = await crearDocumento({ titulo: 'Nota A - Cardiología' });
  const docB = await crearDocumento({ titulo: 'Nota B - Neumología' });
  const docC = await crearDocumento({ titulo: 'Nota C - Neurología' });
  await guardarDocumento(docA);
  await guardarDocumento(docB);
  await guardarDocumento(docC);

  const docOrigen = await crearDocumento({
    titulo: 'Resumen Clínico General',
  });
  await guardarDocumento(docOrigen);

  const elementosOrigen = [
    {
      id: 'txt-1',
      documentoId: docOrigen.id,
      tipo: 'texto',
      x: 0,
      y: 0,
      datos: {
        bloques: [
          {
            tipo: 'parrafo',
            runs: [
              { texto: 'Ver ', negrita: true },
              { texto: 'Cardio', enlace: { tipo: 'nota', notaId: docA.id } },
              { texto: ' y ' },
              { texto: 'Neumo', enlace: { tipo: 'nota', notaId: docB.id } },
            ],
          },
        ],
      },
    },
    {
      id: 'nodo-1',
      documentoId: docOrigen.id,
      tipo: 'figura',
      x: 50,
      y: 150,
      ancho: 100,
      alto: 50,
      enlace: { tipo: 'nota', notaId: docC.id },
      datos: {
        forma: 'elipse',
        texto: 'Ir a Neuro',
        enlace: { tipo: 'nota', notaId: docC.id },
      },
    },
  ];

  await guardarElementos(elementosOrigen);

  // Verificamos los enlaces salientes del documento
  const salientes = await obtenerEnlacesSalientesDocumento(docOrigen.id);
  assert.equal(salientes.length, 3, 'El documento de origen debe tener 3 enlaces salientes');
  const idsSalientes = salientes.map((s) => s.notaId);
  assert.ok(idsSalientes.includes(docA.id));
  assert.ok(idsSalientes.includes(docB.id));
  assert.ok(idsSalientes.includes(docC.id));

  // Verificamos que buscarNotasQueEnlazanA encuentre el backlink en cada una de las 3 notas
  const backlinksA = await buscarNotasQueEnlazanA(docA.id);
  assert.equal(backlinksA.length, 1, 'Doc A debe tener 1 nota entrante');
  assert.equal(backlinksA[0].docId, docOrigen.id);
  assert.equal(backlinksA[0].titulo, 'Resumen Clínico General');

  const backlinksC = await buscarNotasQueEnlazanA(docC.id);
  assert.equal(backlinksC.length, 1, 'Doc C debe tener 1 nota entrante');
  assert.equal(backlinksC[0].docId, docOrigen.id);
});

test('3. Enlaces rotos: notas inexistentes o eliminadas se muestran sin errores; restaurar de papelera reactiva el enlace', async () => {
  const docDestino = await crearDocumento({ titulo: 'Nota Temporal a Eliminar' });
  await guardarDocumento(docDestino);

  // 1. Estado disponible
  const estadoInicial = await verificarEstadoNotaEnlace(docDestino.id);
  assert.equal(estadoInicial.disponible, true);
  assert.equal(estadoInicial.estado, 'disponible');
  assert.equal(estadoInicial.titulo, 'Nota Temporal a Eliminar');

  // 2. Mover a la papelera
  await enviarAPapelera(docDestino);
  const estadoPapelera = await verificarEstadoNotaEnlace(docDestino.id);
  assert.equal(estadoPapelera.disponible, false);
  assert.equal(estadoPapelera.estado, 'papelera');
  assert.ok(estadoPapelera.mensaje.includes('papelera'), 'Debe indicar que está en la papelera');

  // 3. Restaurar desde la papelera -> conserva el ID y se reactiva automáticamente
  await restaurarDePapelera(docDestino.id);
  const estadoRestaurado = await verificarEstadoNotaEnlace(docDestino.id);
  assert.equal(estadoRestaurado.disponible, true);
  assert.equal(estadoRestaurado.estado, 'disponible');

  // 4. Borrar definitivamente
  await borrarDocumentoDefinitivo(docDestino.id);
  const estadoBorrado = await verificarEstadoNotaEnlace(docDestino.id);
  assert.equal(estadoBorrado.disponible, false);
  assert.equal(estadoBorrado.estado, 'no-disponible');
  assert.ok(estadoBorrado.mensaje.includes('no disponible'), 'Debe mostrar «nota no disponible» sin arrojar errores');

  // 5. ID aleatorio inexistente
  const estadoInexistente = await verificarEstadoNotaEnlace('id-que-no-existe-12345');
  assert.equal(estadoInexistente.disponible, false);
  assert.equal(estadoInexistente.estado, 'no-disponible');
});

test('4. Mapas conceptuales: ramificar nodos y construir un mapa conceptual de 8 nodos', () => {
  // Nodo raíz (Nodo 1)
  const nodoRaiz = {
    id: 'nodo-raiz',
    tipo: 'figura',
    x: 400,
    y: 300,
    ancho: 140,
    alto: 60,
    z: 1,
    datos: {
      forma: 'rectangulo',
      texto: 'Concepto Raíz',
      borde: '#3b82f6',
      relleno: '#eff6ff',
      radioEsquinas: 8,
    },
  };
  const escena = new Escena([nodoRaiz]);

  // Crear 3 ramas hijas desde la raíz (Nodos 2, 3, 4)
  const rama1 = ramificarNodoMapaConceptual(escena, nodoRaiz.id, { direccion: 'derecha', texto: 'Rama 1' });
  assert.ok(rama1.nodoHijo);
  assert.ok(rama1.conector);
  assert.equal(rama1.conector.datos.anclajeInicio.elementoId, nodoRaiz.id);
  assert.equal(rama1.conector.datos.anclajeFin.elementoId, rama1.nodoHijo.id);

  const rama2 = ramificarNodoMapaConceptual(escena, nodoRaiz.id, { direccion: 'abajo', texto: 'Rama 2' });
  const rama3 = ramificarNodoMapaConceptual(escena, nodoRaiz.id, { direccion: 'izquierda', texto: 'Rama 3' });

  // Crear sub-ramas:
  // Desde rama1: 2 hijos (Nodos 5 y 6)
  const rama1_1 = ramificarNodoMapaConceptual(escena, rama1.nodoHijo.id, { direccion: 'derecha', texto: 'Detalle 1.1' });
  const rama1_2 = ramificarNodoMapaConceptual(escena, rama1.nodoHijo.id, { direccion: 'arriba', texto: 'Detalle 1.2' });

  // Desde rama2: 1 hijo (Nodo 7)
  const rama2_1 = ramificarNodoMapaConceptual(escena, rama2.nodoHijo.id, { direccion: 'abajo', texto: 'Detalle 2.1' });

  // Desde rama3: 1 hijo (Nodo 8)
  const rama3_1 = ramificarNodoMapaConceptual(escena, rama3.nodoHijo.id, { direccion: 'izquierda', texto: 'Detalle 3.1' });

  // Verificamos los 8 nodos totales y 7 conectores
  const elementos = escena.lista();
  const nodos = elementos.filter((el) => el.tipo === 'figura' && el.datos?.forma !== 'flecha' && el.datos?.forma !== 'linea');
  const conectores = elementos.filter((el) => el.tipo === 'figura' && (el.datos?.forma === 'flecha' || el.datos?.forma === 'linea'));

  assert.equal(nodos.length, 8, 'Debe haber exactamente 8 nodos en el mapa conceptual');
  assert.equal(conectores.length, 7, 'Debe haber exactamente 7 conectores enlazando la jerarquía');

  // Mover un nodo no desordena el resto (las coordenadas de los otros 7 nodos no cambian)
  const posNodo3Antes = { x: rama3.nodoHijo.x, y: rama3.nodoHijo.y };
  const posNodoRaizAntes = { x: nodoRaiz.x, y: nodoRaiz.y };

  // Desplazamos rama1.nodoHijo en la escena
  escena.ejecutar([
    {
      id: rama1.nodoHijo.id,
      antes: rama1.nodoHijo,
      despues: { ...rama1.nodoHijo, x: rama1.nodoHijo.x + 80, y: rama1.nodoHijo.y + 50 },
    },
  ]);

  const nodo3Despues = escena.get(rama3.nodoHijo.id);
  const nodoRaizDespues = escena.get(nodoRaiz.id);

  assert.equal(nodo3Despues.x, posNodo3Antes.x, 'El nodo 3 debe mantener intacta su posición X');
  assert.equal(nodo3Despues.y, posNodo3Antes.y, 'El nodo 3 debe mantener intacta su posición Y');
  assert.equal(nodoRaizDespues.x, posNodoRaizAntes.x, 'El nodo raíz debe mantener intacta su posición X');

  // Verificamos obtención de hijos
  const hijosRaiz = obtenerHijosDeNodo(escena, nodoRaiz.id);
  assert.equal(hijosRaiz.length, 3, 'El nodo raíz debe tener 3 ramas directas');
});

test('5. Calendario de exámenes local: cálculo de cuenta regresiva y próximo examen', async () => {
  // Limpiamos los exámenes de prueba
  const examenesPrevios = await listarExamenes();
  for (const ex of examenesPrevios) {
    await eliminarExamen(ex.id);
  }

  // Obtenemos fecha de hoy en formato YYYY-MM-DD
  const hoyObj = new Date();
  const hoyStr = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, '0')}-${String(hoyObj.getDate()).padStart(2, '0')}`;

  const mananaObj = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const mananaStr = `${mananaObj.getFullYear()}-${String(mananaObj.getMonth() + 1).padStart(2, '0')}-${String(mananaObj.getDate()).padStart(2, '0')}`;

  const enCincoDiasObj = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const enCincoDiasStr = `${enCincoDiasObj.getFullYear()}-${String(enCincoDiasObj.getMonth() + 1).padStart(2, '0')}-${String(enCincoDiasObj.getDate()).padStart(2, '0')}`;

  // Prueba de cuenta regresiva pura
  const cuentaHoy = calcularCuentaRegresivaExamen(hoyStr);
  assert.equal(cuentaHoy.dias, 0);
  assert.equal(cuentaHoy.texto, '¡Hoy!');
  assert.equal(cuentaHoy.urgente, true);

  const cuentaManana = calcularCuentaRegresivaExamen(mananaStr);
  assert.equal(cuentaManana.dias, 1);
  assert.equal(cuentaManana.texto, 'Mañana');
  assert.equal(cuentaManana.urgente, true);

  const cuenta5Dias = calcularCuentaRegresivaExamen(enCincoDiasStr);
  assert.equal(cuenta5Dias.dias, 5);
  assert.equal(cuenta5Dias.texto, 'En 5 días');
  assert.equal(cuenta5Dias.urgente, false);

  // Guardamos 2 exámenes
  const ex1 = await guardarExamen({
    materia: 'Histología Médica',
    titulo: 'Parcial 1: Tejidos Básicos',
    fecha: mananaStr,
    hora: '09:00',
    descripcion: 'Temas: Epitelial, conectivo, muscular y nervioso',
  });

  const ex2 = await guardarExamen({
    materia: 'Bioquímica Clínica',
    titulo: 'Final de Ciclo',
    fecha: enCincoDiasStr,
    hora: '14:00',
  });

  const lista = await listarExamenes();
  assert.equal(lista.length, 2);

  // Próximo examen debe ser el de mañana
  const prox = await obtenerProximoExamen();
  assert.ok(prox);
  assert.equal(prox.id, ex1.id);
  assert.equal(prox.materia, 'Histología Médica');
  assert.equal(prox.cuentaRegresiva.texto, 'Mañana');

  // Si completamos el examen 1, el próximo pasa a ser el examen 2
  await alternarCompletadoExamen(ex1.id);
  const proxDespues = await obtenerProximoExamen();
  assert.ok(proxDespues);
  assert.equal(proxDespues.id, ex2.id);
  assert.equal(proxDespues.materia, 'Bioquímica Clínica');
});

test('6. Marcadores de ubicación en pizarrón y favoritos en biblioteca', async () => {
  // Documento de pizarrón con marcadores de cámara
  const docPizarron = await crearDocumento({
    titulo: 'Pizarrón con marcadores de estudio',
    formato: 'pizarron',
    config: {
      marcadores: [
        { id: 'm1', nombre: 'Esquema Inicial', x: 0, y: 0, zoom: 1 },
        { id: 'm2', nombre: 'Zona de Fórmulas', x: 1200, y: 800, zoom: 1.5 },
      ],
    },
    favorito: true,
    abiertoEl: Date.now(),
  });

  assert.equal(docPizarron.config.marcadores.length, 2);
  assert.equal(docPizarron.config.marcadores[1].nombre, 'Zona de Fórmulas');
  assert.equal(docPizarron.favorito, true);

  // Guardar y recuperar
  await guardarDocumento(docPizarron);
  const recuperado = await obtenerDocumento(docPizarron.id);
  assert.equal(recuperado.favorito, true);
  assert.equal(recuperado.config.marcadores.length, 2);
});
