// Gestión de calendario de exámenes y cuenta regresiva local.
// Etapa 23: Calendario de exámenes simple con fechas por materia y cuenta regresiva.
// Aviso documentado: Recordatorio puramente local en la app; no se prometen notificaciones push fuera de la app.

import { obtenerAjuste, guardarAjuste } from './ajustes.js';
import { nuevoId } from './modelo.js';

const CLAVE_AJUSTES_EXAMENES = 'examenes.lista';

// Fecha para mostrar: «2026-11-06» (cómo se guarda) → «06/11/2026» (día, mes y año).
export function formatearFechaExamen(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}

// «Hoy» según el reloj del dispositivo (no UTC): en Argentina, después de las 21:00 la fecha UTC ya es la de mañana.
export function fechaLocalISO(d = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Normaliza un registro de examen asegurando campos válidos.
 */
export function normalizarExamen(raw = {}) {
  return {
    id: raw.id || nuevoId('examen'),
    materia: (raw.materia || '').trim(),
    titulo: (raw.titulo || '').trim() || 'Examen',
    fecha: raw.fecha || '', // Formato YYYY-MM-DD
    hora: raw.hora || '',   // Formato HH:mm opcional
    descripcion: (raw.descripcion || '').trim(),
    completado: !!raw.completado,
    creado: raw.creado || Date.now(),
    modificado: raw.modificado || Date.now(),
  };
}

/**
 * Obtiene la lista completa de exámenes guardados en el almacenamiento local.
 */
export async function listarExamenes() {
  try {
    const lista = await obtenerAjuste(CLAVE_AJUSTES_EXAMENES, []);
    if (!Array.isArray(lista)) return [];
    return lista.map(normalizarExamen).sort((a, b) => {
      // Ordenar por fecha y hora ascendente
      const fA = `${a.fecha || '9999-99-99'} ${a.hora || '00:00'}`;
      const fB = `${b.fecha || '9999-99-99'} ${b.hora || '00:00'}`;
      return fA.localeCompare(fB);
    });
  } catch {
    return [];
  }
}

/**
 * Guarda o actualiza un examen en el almacenamiento.
 */
export async function guardarExamen(examen) {
  const norm = normalizarExamen(examen);
  norm.modificado = Date.now();
  const actuales = await listarExamenes();
  const idx = actuales.findIndex((e) => e.id === norm.id);
  let nuevaLista;
  if (idx >= 0) {
    nuevaLista = [...actuales];
    nuevaLista[idx] = norm;
  } else {
    nuevaLista = [...actuales, norm];
  }
  await guardarAjuste(CLAVE_AJUSTES_EXAMENES, nuevaLista);
  return norm;
}

/**
 * Restaura exámenes de un respaldo: agrega los que no existen y, si el id coincide,
 * conserva el más reciente. Nunca borra los exámenes actuales.
 */
export async function importarExamenes(lista) {
  if (!Array.isArray(lista) || !lista.length) return 0;
  const actuales = await listarExamenes();
  const porId = new Map(actuales.map((e) => [e.id, e]));
  let cambios = 0;
  for (const nuevo of lista.map(normalizarExamen)) {
    const previo = porId.get(nuevo.id);
    if (!previo || (nuevo.modificado || 0) > (previo.modificado || 0)) {
      porId.set(nuevo.id, nuevo);
      cambios++;
    }
  }
  if (cambios) await guardarAjuste(CLAVE_AJUSTES_EXAMENES, [...porId.values()]);
  return cambios;
}

/**
 * Elimina un examen del calendario.
 */
export async function eliminarExamen(id) {
  if (!id) return;
  const actuales = await listarExamenes();
  const filtrados = actuales.filter((e) => e.id !== id);
  await guardarAjuste(CLAVE_AJUSTES_EXAMENES, filtrados);
}

/**
 * Alterna el estado de completado de un examen.
 */
export async function alternarCompletadoExamen(id) {
  const actuales = await listarExamenes();
  const item = actuales.find((e) => e.id === id);
  if (!item) return null;
  item.completado = !item.completado;
  item.modificado = Date.now();
  await guardarAjuste(CLAVE_AJUSTES_EXAMENES, actuales);
  return item;
}

/**
 * Calcula la diferencia en días y texto de cuenta regresiva para una fecha de examen.
 * Respeta la fecha actual y evita desajustes por husos horarios.
 */
export function calcularCuentaRegresivaExamen(fechaISO, fechaHoyISO = null) {
  if (!fechaISO || typeof fechaISO !== 'string') {
    return { dias: 0, texto: 'Fecha no definida', urgente: false, pasado: false };
  }

  const hoyStr = fechaHoyISO || fechaLocalISO();
  const [y1, m1, d1] = hoyStr.split('-').map(Number);
  const [y2, m2, d2] = fechaISO.split('-').map(Number);

  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffDias = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));

  if (diffDias === 0) {
    return { dias: 0, texto: '¡Hoy!', urgente: true, pasado: false };
  }
  if (diffDias === 1) {
    return { dias: 1, texto: 'Mañana', urgente: true, pasado: false };
  }
  if (diffDias > 1) {
    return {
      dias: diffDias,
      texto: `En ${diffDias} días`,
      urgente: diffDias <= 3,
      pasado: false,
    };
  }
  if (diffDias === -1) {
    return { dias: -1, texto: 'Ayer', urgente: false, pasado: true };
  }
  return {
    dias: diffDias,
    texto: `Pasó hace ${Math.abs(diffDias)} días`,
    urgente: false,
    pasado: true,
  };
}

/**
 * Obtiene el próximo examen no completado más cercano.
 */
export async function obtenerProximoExamen(fechaHoyISO = null) {
  const lista = await listarExamenes();
  const pendientes = lista.filter((e) => !e.completado && e.fecha);
  if (!pendientes.length) return null;

  const hoyStr = fechaHoyISO || fechaLocalISO();
  // Filtrar exámenes de hoy en adelante, ordenados por fecha
  const futuros = pendientes
    .filter((e) => e.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const proximo = futuros[0] || pendientes[0];
  const cuenta = calcularCuentaRegresivaExamen(proximo.fecha, hoyStr);
  return {
    ...proximo,
    examen: proximo,
    cuenta,
    cuentaRegresiva: cuenta,
  };
}
