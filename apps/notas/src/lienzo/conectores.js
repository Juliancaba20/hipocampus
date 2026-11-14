// Conectores entre elementos (Etapa 21B).
// Manejo de puertos de anclaje, líneas curvas y rectas, y seguimiento dinámico
// al mover o redimensionar las figuras conectadas.

import { extremosLinea, lineaDesdeExtremos, normalizarRect } from './geometria.js';

export const PUERTOS_CONECTOR = [
  { id: 'arriba', nombre: 'Arriba' },
  { id: 'abajo', nombre: 'Abajo' },
  { id: 'izquierda', nombre: 'Izquierda' },
  { id: 'derecha', nombre: 'Derecha' },
  { id: 'centro', nombre: 'Centro' },
];

/**
 * Calcula los puertos magnéticos de anclaje de un elemento en coordenadas del mundo.
 */
export function calcularPuertosElemento(el) {
  if (!el || !Number.isFinite(el.x) || !Number.isFinite(el.y) || !Number.isFinite(el.ancho) || !Number.isFinite(el.alto)) {
    return [];
  }
  const xm = el.x + el.ancho / 2;
  const ym = el.y + el.alto / 2;

  return [
    { id: 'arriba', x: xm, y: el.y, elementoId: el.id },
    { id: 'abajo', x: xm, y: el.y + el.alto, elementoId: el.id },
    { id: 'izquierda', x: el.x, y: ym, elementoId: el.id },
    { id: 'derecha', x: el.x + el.ancho, y: ym, elementoId: el.id },
    { id: 'centro', x: xm, y: ym, elementoId: el.id },
  ];
}

/**
 * Devuelve la posición { x, y } de un puerto específico de un elemento.
 */
export function posicionPuertoElemento(el, puertoId = 'centro') {
  if (!el) return null;
  const xm = el.x + el.ancho / 2;
  const ym = el.y + el.alto / 2;

  switch (puertoId) {
    case 'arriba': return { x: xm, y: el.y };
    case 'abajo': return { x: xm, y: el.y + el.alto };
    case 'izquierda': return { x: el.x, y: ym };
    case 'derecha': return { x: el.x + el.ancho, y: ym };
    case 'centro':
    default:
      return { x: xm, y: ym };
  }
}

/**
 * Busca el puerto más cercano a un punto (px, py) entre una lista de elementos candidatos.
 * @param {Array<Object>} elementos - Elementos del lienzo
 * @param {number} px - Coordenada X
 * @param {number} py - Coordenada Y
 * @param {number} radio - Radio máximo de atracción magnética
 * @param {string|null} excluirId - ID de elemento a excluir (por ejemplo, el propio conector)
 */
export function buscarPuertoCercano(elementos, px, py, radio = 26, excluirId = null) {
  let mejor = null;
  let distMin = radio * radio;

  for (const el of elementos) {
    if (!el || el.id === excluirId) continue;
    // Excluir conectores como destino de anclaje para evitar ciclos
    if (el.tipo === 'figura' && (el.datos?.forma === 'linea' || el.datos?.forma === 'flecha')) continue;

    const puertos = calcularPuertosElemento(el);
    for (const p of puertos) {
      const dx = px - p.x;
      const dy = py - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= distMin) {
        distMin = d2;
        mejor = { ...p, elemento: el };
      }
    }
  }

  return mejor;
}

/**
 * Calcula los puntos de control Bézier para un conector curvo.
 */
export function puntosControlConectorCurvo(a, b, anclajeA = null, anclajeB = null) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const factor = Math.max(30, Math.min(180, dist * 0.45));

  let cp1 = { x: a.x, y: a.y };
  let cp2 = { x: b.x, y: b.y };

  const dirA = anclajeA?.puerto;
  const dirB = anclajeB?.puerto;

  if (dirA === 'derecha') cp1 = { x: a.x + factor, y: a.y };
  else if (dirA === 'izquierda') cp1 = { x: a.x - factor, y: a.y };
  else if (dirA === 'arriba') cp1 = { x: a.x, y: a.y - factor };
  else if (dirA === 'abajo') cp1 = { x: a.x, y: a.y + factor };
  else {
    // Si no tiene puerto asignado, curvatura suave según eje dominante
    if (Math.abs(dx) >= Math.abs(dy)) {
      cp1 = { x: a.x + dx * 0.5, y: a.y };
    } else {
      cp1 = { x: a.x, y: a.y + dy * 0.5 };
    }
  }

  if (dirB === 'derecha') cp2 = { x: b.x + factor, y: b.y };
  else if (dirB === 'izquierda') cp2 = { x: b.x - factor, y: b.y };
  else if (dirB === 'arriba') cp2 = { x: b.x, y: b.y - factor };
  else if (dirB === 'abajo') cp2 = { x: b.x, y: b.y + factor };
  else {
    if (Math.abs(dx) >= Math.abs(dy)) {
      cp2 = { x: b.x - dx * 0.5, y: b.y };
    } else {
      cp2 = { x: b.x, y: b.y - dy * 0.5 };
    }
  }

  return { cp1, cp2 };
}

/**
 * Muestrea puntos a lo largo de una curva cúbica de Bézier para detección de clics o cálculos.
 */
export function muestrearCurvaBezier(a, cp1, cp2, b, pasos = 16) {
  const pts = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * a.x + 3 * uu * t * cp1.x + 3 * u * tt * cp2.x + ttt * b.x;
    const y = uuu * a.y + 3 * uu * t * cp1.y + 3 * u * tt * cp2.y + ttt * b.y;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Determina si un conector está anclado a un elemento dado.
 */
export function conectorAncladoA(conector, elementoId) {
  if (!conector || !conector.datos || !elementoId) return false;
  const d = conector.datos;
  return (d.anclajeInicio && d.anclajeInicio.elementoId === elementoId)
    || (d.anclajeFin && d.anclajeFin.elementoId === elementoId);
}

/**
 * Actualiza la geometría de los conectores en la escena cuando uno o más elementos cambian.
 * @param {Array<Object>} elementosModificados - Lista de elementos recién movidos o transformados
 * @param {Object} escena - Instancia de Escena
 * @returns {Array<Object>} Lista de cambios para transitorio o registrar: [{ id, antes, despues }]
 */
export function actualizarConectoresDeElementos(elementosModificados, escena) {
  if (!elementosModificados || !elementosModificados.length || !escena) return [];

  // Mapa de elementos actualizados por ID
  const mapaModificados = new Map();
  for (const el of elementosModificados) {
    if (el && el.id) mapaModificados.set(el.id, el);
  }

  const cambiosConectores = [];
  const procesados = new Set();
  const lista = Array.isArray(escena) ? escena : (typeof escena.lista === 'function' ? escena.lista() : []);
  const obtener = (id) => (typeof escena.get === 'function' ? escena.get(id) : lista.find((e) => e.id === id));

  for (const el of lista) {
    if (!el || el.tipo !== 'figura') continue;
    const forma = el.datos?.forma;
    if (forma !== 'linea' && forma !== 'flecha') continue;

    const d = el.datos;
    const anclajeA = d.anclajeInicio;
    const anclajeB = d.anclajeFin;

    const inicioAfectado = anclajeA?.elementoId && mapaModificados.has(anclajeA.elementoId);
    const finAfectado = anclajeB?.elementoId && mapaModificados.has(anclajeB.elementoId);

    if (!inicioAfectado && !finAfectado) continue;
    if (procesados.has(el.id)) continue;
    procesados.add(el.id);

    const [aActual, bActual] = extremosLinea(el);
    let nuevoA = { ...aActual };
    let nuevoB = { ...bActual };

    if (anclajeA?.elementoId) {
      const formaA = mapaModificados.get(anclajeA.elementoId) || obtener(anclajeA.elementoId);
      if (formaA) {
        const pos = posicionPuertoElemento(formaA, anclajeA.puerto);
        if (pos) nuevoA = pos;
      }
    }

    if (anclajeB?.elementoId) {
      const formaB = mapaModificados.get(anclajeB.elementoId) || obtener(anclajeB.elementoId);
      if (formaB) {
        const pos = posicionPuertoElemento(formaB, anclajeB.puerto);
        if (pos) nuevoB = pos;
      }
    }

    // Si ambos extremos siguen existiendo y tienen posiciones válidas
    const conectorActualizado = lineaDesdeExtremos(el, nuevoA, nuevoB);
    cambiosConectores.push({
      id: el.id,
      antes: el,
      despues: conectorActualizado,
    });
  }

  return cambiosConectores;
}

/**
 * Si se elimina una forma, desancla limpiamente cualquier conector que apuntaba a ella.
 * El conector permanece en su posición sin errores.
 */
export function desanclarConectoresDeIdsBorrados(idsBorrados, escena) {
  if (!idsBorrados || !idsBorrados.length || !escena) return [];
  const conjuntoBorrados = new Set(idsBorrados);
  const cambios = [];
  const lista = Array.isArray(escena) ? escena : (typeof escena.lista === 'function' ? escena.lista() : []);

  for (const el of lista) {
    if (!el || el.tipo !== 'figura') continue;
    const forma = el.datos?.forma;
    if (forma !== 'linea' && forma !== 'flecha') continue;

    const d = el.datos;
    let cambio = false;
    let anclajeInicio = d.anclajeInicio;
    let anclajeFin = d.anclajeFin;

    if (anclajeInicio && conjuntoBorrados.has(anclajeInicio.elementoId)) {
      anclajeInicio = null;
      cambio = true;
    }
    if (anclajeFin && conjuntoBorrados.has(anclajeFin.elementoId)) {
      anclajeFin = null;
      cambio = true;
    }

    if (cambio) {
      const actualizado = {
        ...el,
        datos: {
          ...d,
          anclajeInicio,
          anclajeFin,
        },
      };
      cambios.push({ id: el.id, antes: el, despues: actualizado });
    }
  }

  return cambios;
}

/**
 * Remapa los anclajes de conectores clonados cuando se copian y pegan figuras con sus conectores.
 */
export function remaparAnclajesConectores(elementosClonados, mapaIds) {
  if (!Array.isArray(elementosClonados) || !mapaIds) return elementosClonados;

  return elementosClonados.map((el) => {
    if (!el || el.tipo !== 'figura') return el;
    const forma = el.datos?.forma;
    if (forma !== 'linea' && forma !== 'flecha') return el;

    const d = el.datos;
    let anclajeInicio = d.anclajeInicio ? { ...d.anclajeInicio } : null;
    let anclajeFin = d.anclajeFin ? { ...d.anclajeFin } : null;

    if (anclajeInicio && mapaIds.has(anclajeInicio.elementoId)) {
      anclajeInicio.elementoId = mapaIds.get(anclajeInicio.elementoId);
    } else if (anclajeInicio && !mapaIds.has(anclajeInicio.elementoId)) {
      // Si la forma anclada no fue copiada junta, queda libre sin error
      anclajeInicio = null;
    }

    if (anclajeFin && mapaIds.has(anclajeFin.elementoId)) {
      anclajeFin.elementoId = mapaIds.get(anclajeFin.elementoId);
    } else if (anclajeFin && !mapaIds.has(anclajeFin.elementoId)) {
      anclajeFin = null;
    }

    return {
      ...el,
      datos: {
        ...d,
        anclajeInicio,
        anclajeFin,
      },
    };
  });
}
