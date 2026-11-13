// Búsqueda y reemplazo dentro del documento abierto (Etapas 18B y 20B).
// Encuentra y reemplaza coincidencias en elementos de texto y tablas conservando el formato enriquecido,
// ordenadas por orden de lectura (página/tarjeta, y, x).
// Todas las sustituciones se ejecutan como una sola acción atómica en el historial de la escena.

import { normalizar } from '../../almacen/busqueda.js';
import { bloquesDe, crearRun, unirRuns } from '../texto/modelo.js';

const textoDeRuns = (runs) => (Array.isArray(runs) ? runs.map((r) => r?.texto || '').join('') : '');

// Busca todas las apariciones de una consulta dentro de una cadena
function buscarPosiciones(textoOriginal, consulta, coincidirMayusculas = false) {
  if (!textoOriginal || !consulta) return [];
  const posiciones = [];
  const len = consulta.length;
  if (!len) return [];

  if (coincidirMayusculas) {
    let pos = 0;
    while ((pos = textoOriginal.indexOf(consulta, pos)) !== -1) {
      posiciones.push({ indice: pos, longitud: len });
      pos += len;
    }
  } else {
    const tNorm = normalizar(textoOriginal);
    const qNorm = normalizar(consulta);
    if (!qNorm) return [];
    let pos = 0;
    while ((pos = tNorm.indexOf(qNorm, pos)) !== -1) {
      posiciones.push({ indice: pos, longitud: qNorm.length });
      pos += Math.max(1, qNorm.length);
    }
  }
  return posiciones;
}

// Extrae todas las coincidencias de un elemento
export function extraerCoincidenciasDeElemento(el, consulta, opciones = {}) {
  if (!el || typeof el !== 'object' || !consulta) return [];
  const coincidirMayusculas = !!opciones.coincidirMayusculas;
  const coincidencias = [];
  const contenedor = el.contenedor !== undefined ? el.contenedor : null;
  const ubicacionBase = {
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
        const numFilas = Math.max(1, filas.length);
        const altoFilaAprox = (el.alto || 100) / numFilas;

        filas.forEach((fila, fIdx) => {
          if (!Array.isArray(fila)) return;
          const numCols = Math.max(1, fila.length);
          const anchoColAprox = (el.ancho || 200) / numCols;

          fila.forEach((celda, cIdx) => {
            const txt = textoDeRuns(celda?.runs);
            const apariciones = buscarPosiciones(txt, consulta, coincidirMayusculas);

            apariciones.forEach((ap, apIdx) => {
              coincidencias.push({
                id: `${el.id}_t_${fIdx}_${cIdx}_${apIdx}`,
                elementoId: el.id,
                tipo: 'tabla',
                fila: fIdx + 1,
                columna: cIdx + 1,
                texto: txt,
                posicion: ap,
                ubicacion: {
                  ...ubicacionBase,
                  x: el.x + cIdx * anchoColAprox,
                  y: el.y + fIdx * altoFilaAprox,
                  ancho: anchoColAprox,
                  alto: altoFilaAprox,
                },
                cajaDestacada: {
                  x: el.x + cIdx * anchoColAprox,
                  y: el.y + fIdx * altoFilaAprox,
                  ancho: anchoColAprox,
                  alto: altoFilaAprox,
                  contenedor,
                },
              });
            });
          });
        });
      } else {
        const txt = textoDeRuns(b.runs);
        const apariciones = buscarPosiciones(txt, consulta, coincidirMayusculas);

        apariciones.forEach((ap, apIdx) => {
          coincidencias.push({
            id: `${el.id}_b_${bIdx}_${apIdx}`,
            elementoId: el.id,
            bloqueIdx: bIdx,
            tipo: 'texto',
            subtipo: b.tipo || 'parrafo',
            texto: txt,
            posicion: ap,
            ubicacion: ubicacionBase,
            cajaDestacada: {
              x: el.x,
              y: el.y,
              ancho: el.ancho,
              alto: el.alto,
              contenedor,
            },
          });
        });
      }
    });
  } else if (el.tipo === 'simbolo' && el.datos?.caracter) {
    const txt = String(el.datos.caracter);
    const ap = buscarPosiciones(txt, consulta, coincidirMayusculas);
    if (ap.length > 0) {
      coincidencias.push({
        id: `${el.id}_sim`,
        elementoId: el.id,
        tipo: 'simbolo',
        texto: txt,
        posicion: ap[0],
        ubicacion: ubicacionBase,
        cajaDestacada: {
          x: el.x,
          y: el.y,
          ancho: el.ancho,
          alto: el.alto,
          contenedor,
        },
      });
    }
  }

  return coincidencias;
}

// Busca todas las coincidencias en una lista de elementos y las ordena por flujo de lectura
export function buscarEnDocumento(consulta, elementos = [], opciones = {}) {
  if (!consulta || typeof consulta !== 'string' || !consulta.trim()) return [];

  const todas = [];
  for (const el of elementos) {
    const encontradas = extraerCoincidenciasDeElemento(el, consulta, opciones);
    for (const c of encontradas) todas.push(c);
  }

  // Ordenar por contenedor (página o tarjeta) y luego por coordenadas de lectura (Y, luego X)
  todas.sort((a, b) => {
    const cA = Number(a.ubicacion.contenedor);
    const cB = Number(b.ubicacion.contenedor);
    if (!Number.isNaN(cA) && !Number.isNaN(cB) && cA !== cB) {
      return cA - cB;
    }
    if (a.ubicacion.contenedor !== b.ubicacion.contenedor) {
      return String(a.ubicacion.contenedor || '').localeCompare(String(b.ubicacion.contenedor || ''));
    }
    return (a.ubicacion.y - b.ubicacion.y) || (a.ubicacion.x - b.ubicacion.x);
  });

  return todas;
}

// Reemplaza texto dentro de una lista de runs preservando formato
export function reemplazarEnRuns(runs, consulta, reemplazo, { coincidirMayusculas = false, limite = null } = {}) {
  if (!Array.isArray(runs) || !consulta) return { runs: runs || [], reemplazos: 0 };
  let contador = 0;
  const nuevosRuns = [];

  for (const r of runs) {
    const txt = r?.texto || '';
    if (!txt) continue;

    if (limite !== null && contador >= limite) {
      nuevosRuns.push({ ...r });
      continue;
    }

    const posList = buscarPosiciones(txt, consulta, coincidirMayusculas);
    if (!posList.length) {
      nuevosRuns.push({ ...r });
      continue;
    }

    let ultimoIdx = 0;
    for (const pos of posList) {
      if (limite !== null && contador >= limite) break;

      if (pos.indice > ultimoIdx) {
        nuevosRuns.push(crearRun(txt.slice(ultimoIdx, pos.indice), r));
      }
      nuevosRuns.push(crearRun(reemplazo, r));
      ultimoIdx = pos.indice + pos.longitud;
      contador++;
    }

    if (ultimoIdx < txt.length) {
      nuevosRuns.push(crearRun(txt.slice(ultimoIdx), r));
    }
  }

  return { runs: unirRuns(nuevosRuns), reemplazos: contador };
}

// Reemplaza ocurrencias dentro de elementos y lo aplica de manera atómica a la escena
export function reemplazarEnDocumento({
  consulta,
  reemplazo,
  coincidirMayusculas = false,
  reemplazarTodos = true,
  coincidenciaActiva = null,
  elementos = [],
  escena = null,
}) {
  if (!consulta || typeof consulta !== 'string' || !consulta.trim()) {
    return { cambios: [], totalReemplazos: 0 };
  }

  const cambios = [];
  let totalReemplazos = 0;
  const repStr = String(reemplazo ?? '');

  const listaBase = (Array.isArray(elementos) && elementos.length > 0) ? elementos : (escena ? escena.lista() : []);
  const elementosAProcesar = coincidenciaActiva && !reemplazarTodos
    ? listaBase.filter((e) => e.id === coincidenciaActiva.elementoId)
    : listaBase;

  for (const el of elementosAProcesar) {
    if (el.tipo !== 'texto' || !Array.isArray(el.datos?.bloques)) continue;

    let elementoCambio = false;
    let reemplazosEnEl = 0;

    const nuevosBloques = el.datos.bloques.map((b, bIdx) => {
      if (!b) return b;

      // Si es reemplazo individual y estamos en un bloque específico
      if (!reemplazarTodos && coincidenciaActiva && coincidenciaActiva.bloqueIdx !== undefined && coincidenciaActiva.bloqueIdx !== bIdx) {
        return b;
      }

      if (b.tipo === 'tabla') {
        const nuevasFilas = (Array.isArray(b.filas) ? b.filas : []).map((fila) =>
          (Array.isArray(fila) ? fila : []).map((celda) => {
            const res = reemplazarEnRuns(celda?.runs || [], consulta, repStr, {
              coincidirMayusculas,
              limite: reemplazarTodos ? null : Math.max(0, 1 - totalReemplazos),
            });
            if (res.reemplazos > 0) {
              elementoCambio = true;
              reemplazosEnEl += res.reemplazos;
              totalReemplazos += res.reemplazos;
            }
            return { ...celda, runs: res.runs };
          })
        );
        return { ...b, filas: nuevasFilas };
      }

      const res = reemplazarEnRuns(b.runs || [], consulta, repStr, {
        coincidirMayusculas,
        limite: reemplazarTodos ? null : Math.max(0, 1 - totalReemplazos),
      });

      if (res.reemplazos > 0) {
        elementoCambio = true;
        reemplazosEnEl += res.reemplazos;
        totalReemplazos += res.reemplazos;
      }
      return { ...b, runs: res.runs };
    });

    if (elementoCambio && reemplazosEnEl > 0) {
      const elActualizado = {
        ...el,
        modificado: Date.now(),
        datos: {
          ...el.datos,
          bloques: nuevosBloques,
        },
      };
      cambios.push({ id: el.id, antes: el, despues: elActualizado });
    }

    if (!reemplazarTodos && totalReemplazos > 0) break;
  }

  if (cambios.length > 0 && escena) {
    const descripcion = reemplazarTodos
      ? `Reemplazar todas las coincidencias de "${consulta}"`
      : `Reemplazar "${consulta}"`;
    escena.ejecutar(cambios, descripcion);
  }

  return { cambios, totalReemplazos };
}
