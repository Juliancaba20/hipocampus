// Índice de texto y búsqueda global para Anotomía (Etapa 18A).
// Indexa títulos, texto de bloques, celdas de tablas, etiquetas y materias.
// Almacén propio en IndexedDB ('indice_busqueda'), actualizado de forma incremental
// cuando el autoguardado persiste cambios, con reconstrucción completa y barra de progreso.

import { pedido, transaccion } from './db.js';
import { obtenerDocumento } from './documentos.js';
import { listarElementos } from './elementos.js';
import { listarCarpetas } from './carpetas.js';
import { bloquesDe } from '../herramientas/texto/modelo.js';

// Normaliza texto quitando tildes y diacríticos, pasando a minúsculas y recortando espacios.
// Coincide exactamente con el criterio del buscador de símbolos científicos.
export function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const textoDeRuns = (runs) => (Array.isArray(runs) ? runs.map((r) => r?.texto || '').join('') : '');

// Extrae los fragmentos textuales indexables de un elemento con su ubicación
export function extraerTextoDeElemento(el) {
  if (!el || typeof el !== 'object') return [];
  const entradas = [];
  const contenedor = el.contenedor !== undefined ? el.contenedor : null;
  const ubicacion = {
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
    ancho: Number(el.ancho) || 0,
    alto: Number(el.alto) || 0,
    contenedor,
  };

  if (el.tipo === 'texto') {
    const bloques = bloquesDe(el.datos);
    bloques.forEach((b, bIdx) => {
      if (!b) return;
      if (b.tipo === 'tabla') {
        const filas = Array.isArray(b.filas) ? b.filas : [];
        filas.forEach((fila, fIdx) => {
          if (!Array.isArray(fila)) return;
          fila.forEach((celda, cIdx) => {
            const txt = textoDeRuns(celda?.runs).trim();
            if (txt) {
              entradas.push({
                id: `${el.id}_t_${fIdx}_${cIdx}`,
                elementoId: el.id,
                tipo: 'tabla',
                fila: fIdx + 1,
                columna: cIdx + 1,
                texto: txt,
                textoNormalizado: normalizar(txt),
                ubicacion,
              });
            }
          });
        });
      } else {
        const txt = textoDeRuns(b.runs).trim();
        if (txt) {
          entradas.push({
            id: `${el.id}_b_${bIdx}`,
            elementoId: el.id,
            tipo: 'texto',
            subtipo: b.tipo || 'parrafo',
            texto: txt,
            textoNormalizado: normalizar(txt),
            ubicacion,
          });
        }
      }
    });
  } else if (el.tipo === 'simbolo' && el.datos?.caracter) {
    const txt = String(el.datos.caracter).trim();
    if (txt) {
      entradas.push({
        id: `${el.id}_sim`,
        elementoId: el.id,
        tipo: 'simbolo',
        texto: txt,
        textoNormalizado: normalizar(txt),
        ubicacion,
      });
    }
  }

  return entradas;
}

// Construye el documento de índice completo para un registro
export function construirEntradaIndice(doc, elementos = [], carpeta = null) {
  const entradas = [];

  // Título del documento
  if (doc.titulo) {
    entradas.push({
      id: 'titulo',
      tipo: 'titulo',
      texto: doc.titulo,
      textoNormalizado: normalizar(doc.titulo),
      ubicacion: null,
    });
  }

  // Materia / Cuaderno
  const nombreMateria = carpeta?.nombre || (typeof doc.materia === 'string' ? doc.materia : '');
  if (nombreMateria) {
    entradas.push({
      id: 'materia',
      tipo: 'materia',
      texto: nombreMateria,
      textoNormalizado: normalizar(nombreMateria),
      ubicacion: null,
    });
  }

  // Etiquetas
  if (Array.isArray(doc.etiquetas)) {
    doc.etiquetas.forEach((tag, idx) => {
      const limpia = String(tag || '').trim().replace(/^#+/, '');
      if (limpia) {
        entradas.push({
          id: `tag_${idx}`,
          tipo: 'etiqueta',
          texto: `#${limpia}`,
          textoNormalizado: normalizar(limpia),
          ubicacion: null,
        });
      }
    });
  }

  // Contenido de elementos
  if (Array.isArray(elementos)) {
    for (const el of elementos) {
      const sub = extraerTextoDeElemento(el);
      for (const s of sub) entradas.push(s);
    }
  }

  return {
    documentoId: doc.id,
    titulo: doc.titulo || 'Sin título',
    formato: doc.formato || 'pizarron',
    carpetaId: doc.carpetaId || null,
    materia: nombreMateria,
    etiquetas: Array.isArray(doc.etiquetas) ? [...doc.etiquetas] : [],
    enPapelera: doc.papelera !== null && doc.papelera !== undefined,
    modificado: doc.modificado || Date.now(),
    entradas,
  };
}

export function guardarEnIndice(registro) {
  return transaccion(['indice_busqueda'], 'readwrite', (tx) => {
    return pedido(tx.objectStore('indice_busqueda').put(registro));
  });
}

export function eliminarDeIndice(documentoId) {
  return transaccion(['indice_busqueda'], 'readwrite', (tx) => {
    return pedido(tx.objectStore('indice_busqueda').delete(documentoId));
  });
}

export function obtenerDeIndice(documentoId) {
  return transaccion(['indice_busqueda'], 'readonly', (tx) => {
    return pedido(tx.objectStore('indice_busqueda').get(documentoId));
  });
}

export function listarIndice({ incluirPapelera = false } = {}) {
  return transaccion(['indice_busqueda'], 'readonly', async (tx) => {
    const todos = await pedido(tx.objectStore('indice_busqueda').getAll());
    if (incluirPapelera) return todos;
    return todos.filter((r) => !r.enPapelera);
  });
}

// Reconstruye el índice completo desde cero. No bloquea la interfaz gracias a
// segmentación por lotes y pausas para el bucle de eventos.
export async function reconstruirIndice(alProgreso = null) {
  alProgreso?.({ estado: 'iniciando', procesados: 0, total: 0, porcentaje: 0 });

  // 1. Obtener todos los documentos (activos y papelera) y las carpetas
  const [todosDocs, carpetas] = await Promise.all([
    transaccion(['documentos'], 'readonly', (tx) => pedido(tx.objectStore('documentos').getAll())),
    listarCarpetas().catch(() => []),
  ]);

  const mapCarpetas = new Map(carpetas.map((c) => [c.id, c]));
  const total = todosDocs.length;

  // 2. Vaciar almacén de índice
  await transaccion(['indice_busqueda'], 'readwrite', (tx) => {
    return pedido(tx.objectStore('indice_busqueda').clear());
  });

  if (total === 0) {
    alProgreso?.({ estado: 'completado', procesados: 0, total: 0, porcentaje: 100 });
    return { procesados: 0, total: 0 };
  }

  // 3. Procesar documentos por lotes para no bloquear el hilo de ejecución principal
  const LOTE = 8;
  let procesados = 0;

  for (let i = 0; i < total; i += LOTE) {
    const bloque = todosDocs.slice(i, i + LOTE);
    await Promise.all(bloque.map(async (doc) => {
      let elementos = [];
      try {
        elementos = await listarElementos(doc.id);
      } catch {
        elementos = [];
      }
      const reg = construirEntradaIndice(doc, elementos, mapCarpetas.get(doc.carpetaId));
      await guardarEnIndice(reg);
      procesados++;
      alProgreso?.({
        estado: 'indexando',
        procesados,
        total,
        porcentaje: Math.round((procesados / total) * 100),
        docActual: doc.titulo,
      });
    }));

    // Ceder control al event loop (permitir repintado del DOM o requestIdleCallback)
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  alProgreso?.({ estado: 'completado', procesados: total, total, porcentaje: 100 });
  return { procesados: total, total };
}

// Cola de indexación incremental para autoguardado no bloqueante
const colaPendientes = new Map();
let temporizadorCola = null;
let colaEjecutando = false;

async function vaciarColaIndexacion() {
  if (colaEjecutando || colaPendientes.size === 0) return;
  colaEjecutando = true;

  try {
    const tareas = [...colaPendientes.entries()];
    colaPendientes.clear();

    const carpetas = await listarCarpetas().catch(() => []);
    const mapCarpetas = new Map(carpetas.map((c) => [c.id, c]));

    for (const [docId, datos] of tareas) {
      try {
        let doc = datos.doc;
        if (!doc) doc = await obtenerDocumento(docId);
        if (!doc) {
          // Documento borrado
          await eliminarDeIndice(docId);
          continue;
        }

        let elementos = datos.elementos;
        if (!elementos) elementos = await listarElementos(docId);

        const carpeta = mapCarpetas.get(doc.carpetaId);
        const reg = construirEntradaIndice(doc, elementos, carpeta);
        await guardarEnIndice(reg);
      } catch {
        /* no interrumpir si un documento aislado falla */
      }
    }
  } finally {
    colaEjecutando = false;
    if (colaPendientes.size > 0) {
      programarProcesamientoCola();
    }
  }
}

function programarProcesamientoCola() {
  if (temporizadorCola) return;
  const ejecutar = () => {
    temporizadorCola = null;
    vaciarColaIndexacion();
  };

  if (typeof requestIdleCallback !== 'undefined') {
    temporizadorCola = requestIdleCallback(ejecutar, { timeout: 1500 });
  } else {
    temporizadorCola = setTimeout(ejecutar, 100);
  }
}

// Programa la actualización de un documento en el índice sin bloquear
export function programarActualizacionIndice(docId, { doc = null, elementos = null } = {}) {
  if (!docId) return;
  colaPendientes.set(docId, { doc, elementos, fecha: Date.now() });
  programarProcesamientoCola();
}

// Extrae un fragmento de texto con contexto alrededor de la coincidencia y partes para resaltar
export function extraerFragmentoConResaltado(textoOriginal, textoNormalizado, consultaNorm, margen = 40) {
  const tNorm = textoNormalizado || normalizar(textoOriginal);
  const qNorm = consultaNorm || '';
  const idx = tNorm.indexOf(qNorm);

  if (idx === -1) {
    const corto = String(textoOriginal || '').slice(0, margen * 2);
    return {
      fragmento: corto,
      partes: [{ texto: corto, coincide: false }],
    };
  }

  // Margen de contexto antes y después
  const inicio = Math.max(0, idx - margen);
  const fin = Math.min(textoOriginal.length, idx + qNorm.length + margen);

  const tieneAntes = inicio > 0;
  const tieneDespues = fin < textoOriginal.length;

  const segmento = textoOriginal.slice(inicio, fin);
  const posRelativa = idx - inicio;
  const lenMatch = qNorm.length;

  const parteAntes = segmento.slice(0, posRelativa);
  const parteCoincide = segmento.slice(posRelativa, posRelativa + lenMatch);
  const parteDespues = segmento.slice(posRelativa + lenMatch);

  const partes = [];
  if (tieneAntes) partes.push({ texto: '… ', coincide: false });
  if (parteAntes) partes.push({ texto: parteAntes, coincide: false });
  if (parteCoincide) partes.push({ texto: parteCoincide, coincide: true });
  if (parteDespues) partes.push({ texto: parteDespues, coincide: false });
  if (tieneDespues) partes.push({ texto: ' …', coincide: false });

  const textoFragmento = (tieneAntes ? '… ' : '') + segmento + (tieneDespues ? ' …' : '');

  return {
    fragmento: textoFragmento,
    partes,
  };
}

// Busca una consulta en el índice de documentos.
// Devuelve los resultados agrupados por documento con sus fragmentos y coordenadas exactas.
export async function buscarEnIndice(consulta, { incluirPapelera = false } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const q = normalizar(consulta);
  if (!q) {
    return { resultados: [], totalCoincidencias: 0, tiempoMs: 0 };
  }

  // Palabras individuales si la consulta tiene múltiples términos
  const terminos = q.split(/\s+/).filter(Boolean);
  const registros = await listarIndice({ incluirPapelera });
  const resultados = [];
  let totalCoincidencias = 0;

  for (const reg of registros) {
    if (!reg || !Array.isArray(reg.entradas)) continue;
    if (reg.enPapelera && !incluirPapelera) continue;

    const coincidenciasDoc = [];

    for (const ent of reg.entradas) {
      if (!ent.textoNormalizado) continue;

      // Verificamos si contiene la consulta completa o todos los términos individuales
      const coincideCompleto = ent.textoNormalizado.includes(q);
      const coincidenTodosTerminos = terminos.length > 1 && terminos.every((t) => ent.textoNormalizado.includes(t));

      if (coincideCompleto || coincidenTodosTerminos) {
        // Usar término principal para el resaltado
        const terminoParaResaltar = coincideCompleto ? q : terminos[0];
        const { fragmento, partes } = extraerFragmentoConResaltado(ent.texto, ent.textoNormalizado, terminoParaResaltar);

        coincidenciasDoc.push({
          id: ent.id,
          elementoId: ent.elementoId || null,
          tipo: ent.tipo,
          subtipo: ent.subtipo || null,
          fila: ent.fila || null,
          columna: ent.columna || null,
          textoOriginal: ent.texto,
          fragmento,
          partes,
          ubicacion: ent.ubicacion || null,
        });
      }
    }

    if (coincidenciasDoc.length > 0) {
      totalCoincidencias += coincidenciasDoc.length;

      // Ponderación de relevancia: título y materia tienen mayor peso
      let puntuacion = 0;
      if (normalizar(reg.titulo).includes(q)) puntuacion += 100;
      if (normalizar(reg.materia).includes(q)) puntuacion += 50;
      if (Array.isArray(reg.etiquetas) && reg.etiquetas.some((t) => normalizar(t).includes(q))) puntuacion += 40;
      puntuacion += coincidenciasDoc.length * 5;

      resultados.push({
        documentoId: reg.documentoId,
        titulo: reg.titulo,
        formato: reg.formato,
        materia: reg.materia,
        carpetaId: reg.carpetaId,
        etiquetas: reg.etiquetas || [],
        enPapelera: reg.enPapelera,
        modificado: reg.modificado,
        puntuacion,
        coincidencias: coincidenciasDoc,
      });
    }
  }

  // Ordenar por relevancia descendente, luego por fecha de modificación
  resultados.sort((a, b) => b.puntuacion - a.puntuacion || b.modificado - a.modificado);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const tiempoMs = Math.round((t1 - t0) * 10) / 10;

  return {
    resultados,
    totalCoincidencias,
    tiempoMs,
  };
}
