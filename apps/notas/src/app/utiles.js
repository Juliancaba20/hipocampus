export const NOMBRE_FORMATO = { pizarron: 'Pizarrón', paginas: 'Páginas A4', tarjetas: 'Tarjetas' };

export function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const inicioDelDia = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function fechaRelativa(t) {
  const dias = Math.round((inicioDelDia(Date.now()) - inicioDelDia(t)) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  return new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

export const TEXTO_ESTADO = { 'sin-cambios': '', pendiente: 'Cambios sin guardar…', guardando: 'Guardando…', guardado: 'Guardado', error: 'No se pudo guardar', 'error-espacio': 'Sin espacio en el dispositivo' };
