// Gestión de Lápices Favoritos (Etapa 24).
// Hasta 12 ajustes personalizables de pluma/lápiz/resaltador con acceso a un toque y persistencia.
// Cada persona arma su propia bandeja: puede agregar, quitar (incluso todos) y modificar los favoritos.

import { obtenerAjuste, guardarAjuste } from '../../almacen/ajustes.js';

export const CLAVE_AJUSTES_LAPICES = 'lapices.favoritos';
export const MAXIMO_LAPICES_FAVORITOS = 12;

export const LAPICES_POR_DEFECTO = [
  {
    id: 'lapiz-1',
    nombre: 'Boli fino azul',
    herramienta: 'lapiz',
    color: '#2350d8',
    grosor: 2,
    opacidad: 1.0,
  },
  {
    id: 'lapiz-2',
    nombre: 'Boli negro',
    herramienta: 'lapiz',
    color: '#14192b',
    grosor: 3,
    opacidad: 1.0,
  },
  {
    id: 'lapiz-3',
    nombre: 'Corrector rojo',
    herramienta: 'lapiz',
    color: '#d6336c',
    grosor: 2.5,
    opacidad: 1.0,
  },
  {
    id: 'lapiz-4',
    nombre: 'Resaltador amarillo',
    herramienta: 'resaltador',
    color: '#ffd84d',
    grosor: 18,
    opacidad: 0.45,
  },
];

/**
 * Carga la lista de lápices favoritos desde el almacén de ajustes.
 */
export async function cargarLapicesFavoritos() {
  try {
    const guardados = await obtenerAjuste(CLAVE_AJUSTES_LAPICES, null);
    if (Array.isArray(guardados)) {
      // La lista guardada manda, aunque la persona haya quitado todos los favoritos
      return guardados.slice(0, MAXIMO_LAPICES_FAVORITOS);
    }
    return [...LAPICES_POR_DEFECTO];
  } catch {
    return [...LAPICES_POR_DEFECTO];
  }
}

/**
 * Guarda la lista de lápices favoritos en el almacén de ajustes.
 */
export async function guardarLapicesFavoritos(lista) {
  if (!Array.isArray(lista)) return;
  const normalizados = lista.slice(0, MAXIMO_LAPICES_FAVORITOS).map((l, idx) => ({
    id: l.id || `lapiz-${idx + 1}`,
    nombre: l.nombre || `Lápiz ${idx + 1}`,
    herramienta: l.herramienta === 'resaltador' ? 'resaltador' : 'lapiz',
    color: l.color || '#2350d8',
    grosor: Math.max(1, Math.min(50, Number(l.grosor) || 2)),
    opacidad: Math.max(0.1, Math.min(1.0, Number(l.opacidad) || 1.0)),
  }));
  await guardarAjuste(CLAVE_AJUSTES_LAPICES, normalizados);
  return normalizados;
}

/**
 * Actualiza un lápiz favorito específico.
 */
export async function actualizarLapizFavorito(idx, nuevoAjuste) {
  const actuales = await cargarLapicesFavoritos();
  if (idx < 0 || idx >= actuales.length) return actuales;
  actuales[idx] = {
    ...actuales[idx],
    ...nuevoAjuste,
  };
  return guardarLapicesFavoritos(actuales);
}

/**
 * Vuelve a la bandeja de favoritos que trae la aplicación.
 */
export async function restablecerLapicesFavoritos() {
  return guardarLapicesFavoritos(LAPICES_POR_DEFECTO);
}
