// Gestión de copias de seguridad, recordatorios periódicos y File System Access API (Etapa 12).

import { obtenerAjuste, guardarAjuste, estadoAlmacenamiento, listarDocumentos, listarElementos, listarCarpetas, listarExamenes } from '../almacen/index.js';
import { empaquetarColeccion } from './formato.js';
import { prepararRecursosDeElementos } from './exportar.js';

export const INTERVALOS_COPIA = [
  { dias: 0, etiqueta: 'Nunca' },
  { dias: 7, etiqueta: 'Cada 7 días' },
  { dias: 14, etiqueta: 'Cada 14 días (recomendado)' },
  { dias: 30, etiqueta: 'Cada 30 días' },
];

export const CLAVE_INTERVALO = 'copias.intervalo';
export const CLAVE_ULTIMA_FECHA = 'copias.ultimaFecha';

// Obtiene la configuración de copias de seguridad
export async function obtenerConfiguracionCopias() {
  const intervalo = await obtenerAjuste(CLAVE_INTERVALO, 14);
  const ultimaFecha = await obtenerAjuste(CLAVE_ULTIMA_FECHA, 0);
  return { intervalo: Number(intervalo), ultimaFecha: Number(ultimaFecha) };
}

// Guarda la configuración de copias de seguridad
export async function guardarConfiguracionCopias({ intervalo, ultimaFecha }) {
  if (intervalo !== undefined) await guardarAjuste(CLAVE_INTERVALO, Number(intervalo));
  if (ultimaFecha !== undefined) await guardarAjuste(CLAVE_ULTIMA_FECHA, Number(ultimaFecha));
}

// Registra que se ha realizado una copia de seguridad exitosa
export async function registrarCopiaRealizada() {
  const ahora = Date.now();
  await guardarAjuste(CLAVE_ULTIMA_FECHA, ahora);
  return ahora;
}

// Comprueba si debe mostrarse el recordatorio de copia de seguridad
// Solo avisa si:
// 1. El intervalo no es 'Nunca' (0).
// 2. Hay documentos activos en la biblioteca.
// 3. Pasaron más días que el intervalo configurado desde la última copia.
// 4. Existen modificaciones posteriores a la última copia de seguridad.
export function comprobarNecesidadCopia(documentos, { intervalo = 14, ultimaFecha = 0 } = {}) {
  if (!intervalo || intervalo <= 0) return false;
  if (!Array.isArray(documentos) || documentos.length === 0) return false;

  const msIntervalo = intervalo * 24 * 60 * 60 * 1000;
  // Si nunca se hizo una copia, se cuenta desde la nota más antigua (no desde 1970), para no avisar el primer día.
  const referencia = ultimaFecha || Math.min(...documentos.map((d) => d.creado || d.modificado || Date.now()));
  const tiempoTranscurrido = Date.now() - referencia;

  if (tiempoTranscurrido < msIntervalo) return false;

  // Verificar si hay cambios sin copiar
  const hayCambiosSinCopiar = documentos.some((d) => (d.modificado || 0) > (ultimaFecha || 0));
  return hayCambiosSinCopiar;
}

// Comprueba el espacio de almacenamiento y si supera el 80 %
export async function verificarAlmacenamiento() {
  const estado = await estadoAlmacenamiento();
  const porcentaje = estado.cuota > 0 ? Math.round((estado.usado / estado.cuota) * 100) : 0;
  const alerta = estado.cuota > 0 && (estado.usado / estado.cuota) >= 0.8;
  return {
    ...estado,
    porcentaje,
    alerta,
  };
}

// Comprueba si el navegador actual soporta la File System Access API (Chrome, Edge, Opera)
export function soportaCarpetaLocal() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

// Permite al usuario seleccionar una carpeta local para guardar copias
export async function solicitarCarpetaLocal() {
  if (!soportaCarpetaLocal()) {
    throw new Error('Su navegador no admite la selección directa de carpetas locales. Utilice la exportación manual de archivos.');
  }
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

// La carpeta elegida se recuerda en los ajustes (IndexedDB admite guardar la referencia a la carpeta).
// El navegador puede volver a pedir permiso al abrir la app de nuevo: eso se resuelve con un toque.
export const CLAVE_CARPETA = 'copias.carpeta';

export async function obtenerCarpetaGuardada() {
  try {
    const guardada = await obtenerAjuste(CLAVE_CARPETA, null);
    return guardada && typeof guardada.getFileHandle === 'function' ? guardada : null;
  } catch {
    return null;
  }
}

export async function guardarCarpetaElegida(handle) {
  try {
    await guardarAjuste(CLAVE_CARPETA, handle);
    return true;
  } catch {
    return false; // si el navegador no permite guardarla, se vuelve a pedir la próxima vez
  }
}

export async function olvidarCarpetaGuardada() {
  await guardarAjuste(CLAVE_CARPETA, null);
}

export async function tienePermisoEscritura(handle, { pedir = false } = {}) {
  if (!handle) return false;
  const opciones = { mode: 'readwrite' };
  try {
    if (typeof handle.queryPermission !== 'function') return true;
    if ((await handle.queryPermission(opciones)) === 'granted') return true;
    if (!pedir || typeof handle.requestPermission !== 'function') return false;
    return (await handle.requestPermission(opciones)) === 'granted';
  } catch {
    return false;
  }
}

// Usa la carpeta recordada si todavía hay permiso; si no, pide elegir una y la recuerda.
// `elegirOtra: true` fuerza el selector (para cambiar de carpeta).
export async function resolverCarpetaDeCopias({ elegirOtra = false } = {}) {
  if (!elegirOtra) {
    const guardada = await obtenerCarpetaGuardada();
    if (guardada && (await tienePermisoEscritura(guardada, { pedir: true }))) return guardada;
  }
  const elegida = await solicitarCarpetaLocal();
  await guardarCarpetaElegida(elegida);
  return elegida;
}

// Guarda un archivo directamente en la carpeta local seleccionada
export async function escribirArchivoEnCarpeta(directorioHandle, nombreArchivo, bytes) {
  const fileHandle = await directorioHandle.getFileHandle(nombreArchivo, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

// Realiza una copia de seguridad directa en una carpeta local seleccionada
export async function realizarCopiaEnCarpeta(directorioHandle) {
  const documentos = await listarDocumentos({ papelera: false });
  const items = [];

  for (const doc of documentos) {
    const elementos = await listarElementos(doc.id);
    const recursos = await prepararRecursosDeElementos(elementos, doc);
    let repasos = [];
    if (doc.formato === 'tarjetas') {
      try {
        const { listarEstadosRepasoDocumento } = await import('../almacen/repeticion.js');
        repasos = await listarEstadosRepasoDocumento(doc.id);
      } catch {
        repasos = [];
      }
    }
    items.push({ documento: doc, elementos, recursos, repasos });
  }

  const carpetas = await listarCarpetas();
  let plantillas = [];
  try {
    const { listarPlantillasPropias } = await import('../plantillas/index.js');
    plantillas = await listarPlantillasPropias();
  } catch {}
  let examenes = [];
  try { examenes = await listarExamenes(); } catch { /* sin exámenes */ }
  const bytes = await empaquetarColeccion(items, carpetas, plantillas, examenes);
  const fechaStr = new Date().toISOString().slice(0, 10);
  const nombre = `Anotomia_Copia_${fechaStr}.anotomia-respaldo`;

  await escribirArchivoEnCarpeta(directorioHandle, nombre, bytes);
  await registrarCopiaRealizada();
  return { nombreArchivo: nombre, cantidad: items.length, plantillas: plantillas.length };
}
