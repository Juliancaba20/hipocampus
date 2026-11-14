// Sistema de Repetición Espaciada (SRS) local (Etapa 22C).
// Implementa una variante del algoritmo SM-2 (SuperMemo 2),
// almacén IndexedDB de repasos, cálculo de colas diarias, límites de tarjetas nuevas
// y métricas de racha y porcentaje de aciertos.

import { pedido, transaccion } from './db.js';
import { obtenerAjuste, guardarAjuste } from './ajustes.js';

export const CALIFICACIONES = {
  OTRA_VEZ: 'otra-vez',
  DIFICIL: 'dificil',
  BIEN: 'bien',
  FACIL: 'facil',
};

export const METADATOS_CALIFICACION = {
  'otra-vez': {
    id: 'otra-vez',
    etiqueta: 'Otra vez',
    tecla: '1',
    calidad: 1,
    color: '#ef4444',
    descripcion: 'No la recordé. Reiniciar aprendizaje.',
  },
  'dificil': {
    id: 'dificil',
    etiqueta: 'Difícil',
    tecla: '2',
    calidad: 2,
    color: '#f59e0b',
    descripcion: 'Recordada con esfuerzo significativo o titubeo.',
  },
  'bien': {
    id: 'bien',
    etiqueta: 'Bien',
    tecla: '3',
    calidad: 3,
    color: '#3b82f6',
    descripcion: 'Recordada correctamente con esfuerzo normal.',
  },
  'facil': {
    id: 'facil',
    etiqueta: 'Fácil',
    tecla: '4',
    calidad: 4,
    color: '#10b981',
    descripcion: 'Recordada de inmediato y con total seguridad.',
  },
};

export const FACILIDAD_INICIAL = 2.50;
export const FACILIDAD_MINIMA = 1.30;
export const LIMITE_NUEVAS_DEFECTO = 20;
export const CLAVE_AJUSTE_LIMITE_NUEVAS = 'repeticion.limiteNuevas';

/**
 * Obtiene la fecha actual en formato ISO 'YYYY-MM-DD' en la zona horaria LOCAL.
 * El uso estricto de la fecha local evita desfasajes de cambio de día o desfases UTC.
 */
export function obtenerFechaHoyISO(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Suma una cantidad de días a una fecha ISO ('YYYY-MM-DD') manteniendo la hora al mediodía (12:00)
 * para ser totalmente inmune a cambios de horario de verano/invierno (DST) o desajustes de huso horario.
 * Soporta de manera natural años bisiestos y transiciones de fin de mes o año.
 */
export function sumarDiasISO(fechaISO, dias) {
  if (!fechaISO || typeof fechaISO !== 'string') return obtenerFechaHoyISO();
  const partes = fechaISO.split('-');
  if (partes.length !== 3) return obtenerFechaHoyISO();
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Number.isFinite(dia)) return obtenerFechaHoyISO();

  const d = new Date(anio, mes - 1, dia, 12, 0, 0, 0);
  d.setDate(d.getDate() + Number(dias || 0));
  return obtenerFechaHoyISO(d);
}

/**
 * Calcula la diferencia en días naturales entre dos fechas ISO ('YYYY-MM-DD').
 * Devuelve un valor positivo si fechaISO2 es posterior a fechaISO1.
 */
export function diasEntreFechasISO(fechaISO1, fechaISO2) {
  if (!fechaISO1 || !fechaISO2) return 0;
  const [y1, m1, d1] = fechaISO1.split('-').map(Number);
  const [y2, m2, d2] = fechaISO2.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1, 12, 0, 0, 0);
  const date2 = new Date(y2, m2 - 1, d2, 12, 0, 0, 0);
  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Formatea un intervalo en días para presentación amigable y concisa en botones de calificación.
 */
export function formatearIntervaloParaBoton(intervalo) {
  if (!Number.isFinite(intervalo) || intervalo <= 0) return '< 1 d';
  if (intervalo === 1) return '1 d';
  if (intervalo < 30) return `${intervalo} d`;
  if (intervalo < 365) {
    const meses = Math.round(intervalo / 30);
    return `${meses} m`;
  }
  const anios = (intervalo / 365).toFixed(1).replace('.0', '');
  return `${anios} a`;
}

/**
 * Algoritmo SM-2 adaptado para repetición espaciada local.
 *
 * JUSTIFICACIÓN DE ELECCIÓN:
 * - SM-2 es el estándar local por excelencia (base matemática probada en SuperMemo y Anki).
 * - No requiere conexión, redes neuronales ni procesamiento en la nube; se ejecuta en microsegundos en el cliente.
 * - Es determinista, interpretable y almacena un estado compacto y ligero por tarjeta.
 *
 * PARÁMETROS DOCUMENTADOS:
 * - Facilidad inicial (Ease Factor, EF): 2.50.
 * - Facilidad mínima: 1.30. Impide que tarjetas con dificultades queden estancadas para siempre con intervalos de 1 día.
 * - Calificaciones:
 *   1. «Otra vez» (calidad 1): reinicia repeticiones a 0, intervalo = 1 día. EF disminuye en 0.20. Estado = 'aprendiendo'.
 *   2. «Difícil» (calidad 2): si es nueva, intervalo = 1 día; si ya tenía repaso, avanza a round(intervalo * 1.20) días.
 *      EF disminuye en 0.15. Estado = 'repaso'.
 *   3. «Bien» (calidad 3): rep 1 -> 1 día; rep 2 -> 6 días; rep n -> round(intervalo * EF). EF se mantiene estable (+0.0).
 *      Estado = 'repaso'.
 *   4. «Fácil» (calidad 4): rep 1 -> 4 días; rep 2 -> 8 días; rep n -> round(intervalo * EF * 1.30).
 *      EF aumenta en +0.15. Estado = 'repaso'.
 */
export function calcularRepasoSM2(estadoActual, calificacion, fechaHoyISO = obtenerFechaHoyISO()) {
  const estado = estadoActual ? { ...estadoActual } : {
    repeticiones: 0,
    facilidad: FACILIDAD_INICIAL,
    intervalo: 0,
    estado: 'nueva',
    historial: [],
  };

  let reps = typeof estado.repeticiones === 'number' ? estado.repeticiones : 0;
  let facilidad = typeof estado.facilidad === 'number' && Number.isFinite(estado.facilidad)
    ? estado.facilidad
    : FACILIDAD_INICIAL;
  let intervaloPrevio = typeof estado.intervalo === 'number' && Number.isFinite(estado.intervalo)
    ? estado.intervalo
    : 0;

  let nuevoIntervalo = 1;
  let nuevoEstado = 'repaso';

  switch (calificacion) {
    case CALIFICACIONES.OTRA_VEZ: {
      reps = 0;
      nuevoIntervalo = 1;
      facilidad = Math.max(FACILIDAD_MINIMA, facilidad - 0.20);
      nuevoEstado = 'aprendiendo';
      break;
    }
    case CALIFICACIONES.DIFICIL: {
      if (reps === 0) {
        nuevoIntervalo = 1;
        reps = 1;
      } else {
        nuevoIntervalo = Math.max(1, Math.round(intervaloPrevio * 1.20));
      }
      facilidad = Math.max(FACILIDAD_MINIMA, facilidad - 0.15);
      nuevoEstado = 'repaso';
      break;
    }
    case CALIFICACIONES.BIEN: {
      if (reps === 0) {
        nuevoIntervalo = 1;
        reps = 1;
      } else if (reps === 1) {
        nuevoIntervalo = 6;
        reps = 2;
      } else {
        nuevoIntervalo = Math.max(1, Math.round(intervaloPrevio * facilidad));
        reps += 1;
      }
      nuevoEstado = 'repaso';
      break;
    }
    case CALIFICACIONES.FACIL: {
      if (reps === 0) {
        nuevoIntervalo = 4;
        reps = 1;
      } else if (reps === 1) {
        nuevoIntervalo = 8;
        reps = 2;
      } else {
        nuevoIntervalo = Math.max(1, Math.round(intervaloPrevio * facilidad * 1.30));
        reps += 1;
      }
      facilidad = Math.round((facilidad + 0.15) * 100) / 100;
      nuevoEstado = 'repaso';
      break;
    }
    default:
      nuevoIntervalo = 1;
      break;
  }

  facilidad = Math.max(FACILIDAD_MINIMA, Math.round(facilidad * 100) / 100);
  const fechaRepaso = sumarDiasISO(fechaHoyISO, nuevoIntervalo);
  const ahora = Date.now();

  const historialPrevio = Array.isArray(estado.historial) ? estado.historial : [];
  const nuevoHistorial = [
    ...historialPrevio.slice(-49), // Resumen compacto: últimas 50 calificaciones
    {
      fecha: fechaHoyISO,
      calificacion,
      intervalo: nuevoIntervalo,
      facilidad,
      timestamp: ahora,
    },
  ];

  return {
    id: `${estado.documentoId || ''}:${estado.tarjetaId || ''}`,
    version: 1,
    documentoId: estado.documentoId,
    tarjetaId: estado.tarjetaId,
    fechaRepaso,
    intervalo: nuevoIntervalo,
    facilidad,
    repeticiones: reps,
    estado: nuevoEstado,
    ultimoRepaso: ahora,
    historial: nuevoHistorial,
  };
}

/**
 * Predice los intervalos que resultarían de elegir cada una de las 4 opciones de calificación,
 * permitiendo mostrarlos de antemano al usuario sobre cada botón.
 */
export function predecirIntervalos(estadoActual, fechaHoyISO = obtenerFechaHoyISO()) {
  const predicciones = {};
  for (const cal of Object.values(CALIFICACIONES)) {
    const res = calcularRepasoSM2(estadoActual, cal, fechaHoyISO);
    predicciones[cal] = {
      intervalo: res.intervalo,
      etiqueta: formatearIntervaloParaBoton(res.intervalo),
      fechaRepaso: res.fechaRepaso,
    };
  }
  return predicciones;
}

/**
 * Genera la clave compuesta `${documentoId}:${tarjetaId}` usada como id principal en el almacén.
 */
export function claveRepeticion(documentoId, tarjetaId) {
  return `${documentoId}:${tarjetaId}`;
}

// =========================================================================
// ACCESO Y GESTIÓN EN INDEXEDDB
// =========================================================================

export async function obtenerEstadoRepaso(documentoId, tarjetaId) {
  if (!documentoId || !tarjetaId) return null;
  const id = claveRepeticion(documentoId, tarjetaId);
  return transaccion(['repeticion'], 'readonly', (tx) => pedido(tx.objectStore('repeticion').get(id)));
}

export async function guardarEstadoRepaso(estado) {
  if (!estado || !estado.documentoId || !estado.tarjetaId) return null;
  const id = claveRepeticion(estado.documentoId, estado.tarjetaId);
  const registro = {
    ...estado,
    id,
    version: estado.version || 1,
    historial: Array.isArray(estado.historial) ? estado.historial.slice(-50) : [],
  };
  await transaccion(['repeticion'], 'readwrite', (tx) => pedido(tx.objectStore('repeticion').put(registro)));
  return registro;
}

export async function listarEstadosRepasoDocumento(documentoId) {
  if (!documentoId) return [];
  return transaccion(['repeticion'], 'readonly', async (tx) => {
    const store = tx.objectStore('repeticion');
    return pedido(store.index('documentoId').getAll(documentoId));
  });
}

export async function listarTodosEstadosRepaso() {
  return transaccion(['repeticion'], 'readonly', (tx) => pedido(tx.objectStore('repeticion').getAll()));
}

export async function eliminarEstadosRepasoDocumento(documentoId) {
  if (!documentoId) return 0;
  return transaccion(['repeticion'], 'readwrite', async (tx) => {
    const store = tx.objectStore('repeticion');
    const claves = await pedido(store.index('documentoId').getAllKeys(documentoId));
    for (const k of claves) {
      store.delete(k);
    }
    return claves.length;
  });
}

export async function eliminarEstadoRepasoTarjeta(documentoId, tarjetaId) {
  if (!documentoId || !tarjetaId) return;
  const id = claveRepeticion(documentoId, tarjetaId);
  await transaccion(['repeticion'], 'readwrite', (tx) => {
    tx.objectStore('repeticion').delete(id);
  });
}

export async function guardarLoteEstadosRepaso(estados) {
  if (!Array.isArray(estados) || estados.length === 0) return 0;
  await transaccion(['repeticion'], 'readwrite', (tx) => {
    const store = tx.objectStore('repeticion');
    for (const est of estados) {
      if (est && est.documentoId && est.tarjetaId) {
        const id = claveRepeticion(est.documentoId, est.tarjetaId);
        store.put({ ...est, id });
      }
    }
  });
  return estados.length;
}

// =========================================================================
// COLAS DE REPASO Y ESTADÍSTICAS
// =========================================================================

/**
 * Obtiene el límite configurado de tarjetas nuevas por día.
 */
export async function obtenerLimiteNuevas() {
  const v = await obtenerAjuste(CLAVE_AJUSTE_LIMITE_NUEVAS, LIMITE_NUEVAS_DEFECTO);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(200, Math.max(1, Math.round(n))) : LIMITE_NUEVAS_DEFECTO;
}

/**
 * Guarda el límite configurado de tarjetas nuevas por día.
 */
export async function guardarLimiteNuevas(nuevoLimite) {
  const n = Math.min(200, Math.max(1, Math.round(Number(nuevoLimite) || LIMITE_NUEVAS_DEFECTO)));
  await guardarAjuste(CLAVE_AJUSTE_LIMITE_NUEVAS, n);
  return n;
}

/**
 * Determina la cola de tarjetas para repasar hoy de un documento específico.
 * Incluye:
 * 1. Tarjetas en curso cuya fechaRepaso <= fechaHoyISO.
 * 2. Tarjetas nuevas (sin registro o estado 'nueva'), hasta el límite diario configurado.
 */
export function construirColaDocumento({
  tarjetas = [],
  estados = [],
  documentoId = '',
  limiteNuevas = LIMITE_NUEVAS_DEFECTO,
  fechaHoyISO = obtenerFechaHoyISO(),
}) {
  const mapaEstados = new Map();
  for (const est of estados) {
    if (est && est.tarjetaId) {
      mapaEstados.set(est.tarjetaId, est);
    }
  }

  const paraRepaso = [];
  const nuevas = [];

  for (const tarjeta of tarjetas) {
    if (!tarjeta || !tarjeta.id) continue;
    const est = mapaEstados.get(tarjeta.id);

    if (!est || est.estado === 'nueva') {
      nuevas.push({
        tarjeta,
        estado: est || {
          id: claveRepeticion(documentoId, tarjeta.id),
          documentoId,
          tarjetaId: tarjeta.id,
          repeticiones: 0,
          facilidad: FACILIDAD_INICIAL,
          intervalo: 0,
          estado: 'nueva',
          historial: [],
        },
        esNueva: true,
      });
    } else if (est.fechaRepaso && est.fechaRepaso <= fechaHoyISO) {
      paraRepaso.push({
        tarjeta,
        estado: est,
        esNueva: false,
      });
    }
  }

  // Ordenar repasos pendientes por fecha más antigua primero (mayor urgencia)
  paraRepaso.sort((a, b) => (a.estado.fechaRepaso || '').localeCompare(b.estado.fechaRepaso || ''));

  // Aplicar límite diario configurable de nuevas tarjetas
  const nuevasAdmitidas = nuevas.slice(0, Math.max(0, limiteNuevas));

  const items = [...paraRepaso, ...nuevasAdmitidas];

  return {
    items,
    cantidadRepaso: paraRepaso.length,
    cantidadNuevas: nuevasAdmitidas.length,
    totalNuevasDisponibles: nuevas.length,
    total: items.length,
  };
}

/**
 * Calcula estadísticas completas a partir de la lista de registros de repaso:
 * - Tarjetas repasadas hoy
 * - Racha de días consecutivos con al menos un repaso
 * - Porcentaje de aciertos (calificaciones 'bien' o 'facil' sobre el total histórico)
 * - Distribución de calificaciones
 */
export function calcularEstadisticasRepaso(todosEstados = [], fechaHoyISO = obtenerFechaHoyISO()) {
  const historialCompleto = [];
  const fechasConRepaso = new Set();
  let tarjetasRepasadasHoy = 0;

  const distribucion = {
    'otra-vez': 0,
    'dificil': 0,
    'bien': 0,
    'facil': 0,
  };

  let conteoEstados = {
    nuevas: 0,
    aprendiendo: 0,
    repaso: 0,
  };

  for (const est of todosEstados) {
    if (!est) continue;
    if (est.estado === 'aprendiendo') conteoEstados.aprendiendo++;
    else if (est.estado === 'repaso') conteoEstados.repaso++;
    else conteoEstados.nuevas++;

    if (Array.isArray(est.historial)) {
      for (const h of est.historial) {
        if (!h || !h.fecha) continue;
        historialCompleto.push(h);
        fechasConRepaso.add(h.fecha);

        if (h.fecha === fechaHoyISO) {
          tarjetasRepasadasHoy++;
        }

        if (distribucion[h.calificacion] !== undefined) {
          distribucion[h.calificacion]++;
        }
      }
    }
  }

  // Cálculo de porcentaje de aciertos
  const totalHistorico = historialCompleto.length;
  const aciertos = distribucion.bien + distribucion.facil;
  const porcentajeAciertos = totalHistorico > 0
    ? Math.round((aciertos / totalHistorico) * 100)
    : 100;

  // Cálculo de racha de días consecutivos
  let racha = 0;
  let cursorFecha = fechaHoyISO;

  // Si hoy aún no se repasó nada, la racha se evalúa desde ayer para no romperla antes de que termine el día
  if (!fechasConRepaso.has(fechaHoyISO)) {
    cursorFecha = sumarDiasISO(fechaHoyISO, -1);
  }

  while (fechasConRepaso.has(cursorFecha)) {
    racha++;
    cursorFecha = sumarDiasISO(cursorFecha, -1);
  }

  return {
    repasadasHoy: tarjetasRepasadasHoy,
    rachaDias: racha,
    porcentajeAciertos,
    totalRepasosHistorico: totalHistorico,
    totalAciertos: aciertos,
    distribucion,
    conteoEstados,
  };
}

/**
 * Resumen de repaso para toda la biblioteca de documentos.
 * Devuelve conteos por materia y general.
 */
export async function obtenerResumenRepasoBiblioteca(documentos = [], carpetas = [], fechaHoyISO = obtenerFechaHoyISO()) {
  const limiteNuevas = await obtenerLimiteNuevas();
  const todosEstados = await listarTodosEstadosRepaso();

  // Agrupar estados por documentoId
  const estadosPorDoc = new Map();
  for (const est of todosEstados) {
    if (!est || !est.documentoId) continue;
    if (!estadosPorDoc.has(est.documentoId)) {
      estadosPorDoc.set(est.documentoId, []);
    }
    estadosPorDoc.get(est.documentoId).push(est);
  }

  let totalGeneral = 0;
  let totalRepasosGeneral = 0;
  let totalNuevasGeneral = 0;
  const conteoPorDoc = {};
  const conteoPorCarpeta = {};
  const carpetasMap = new Map((carpetas || []).map((c) => [c.id, c]));

  for (const doc of documentos) {
    if (!doc || doc.formato !== 'tarjetas' || doc.papelera) continue;
    const tarjetas = Array.isArray(doc.config?.tarjetas) ? doc.config.tarjetas : [];
    const estados = estadosPorDoc.get(doc.id) || [];

    const cola = construirColaDocumento({
      tarjetas,
      estados,
      documentoId: doc.id,
      limiteNuevas,
      fechaHoyISO,
    });

    conteoPorDoc[doc.id] = cola;
    totalGeneral += cola.total;
    totalRepasosGeneral += cola.cantidadRepaso;
    totalNuevasGeneral += cola.cantidadNuevas;

    const carpetaKey = doc.carpetaId && carpetasMap.has(doc.carpetaId) ? doc.carpetaId : 'sin-carpeta';
    conteoPorCarpeta[carpetaKey] = (conteoPorCarpeta[carpetaKey] || 0) + cola.total;
  }

  const estadisticas = calcularEstadisticasRepaso(todosEstados, fechaHoyISO);

  return {
    totalGeneral,
    totalRepasosGeneral,
    totalNuevasGeneral,
    limiteNuevas,
    conteoPorDoc,
    conteoPorCarpeta,
    estadisticas,
  };
}
