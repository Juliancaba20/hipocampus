// Modelo de datos de la app de notas (Etapa 2).
// Todo lo que se guarda pasa por estas funciones, así el formato queda en un solo lugar.

export const VERSION_ESQUEMA = 3;

export const FORMATOS = {
  PIZARRON: 'pizarron',
  PAGINAS: 'paginas',
  TARJETAS: 'tarjetas',
};

export const TIPOS_ELEMENTO = {
  TEXTO: 'texto',
  TRAZO: 'trazo',
  IMAGEN: 'imagen',
  SIMBOLO: 'simbolo',
  FIGURA: 'figura',
  ICONO: 'icono',
};

// Los renglones son una capa de fondo del documento: nunca mueven ni cambian nada de lo escrito.
export const RENGLONES_POR_DEFECTO = {
  estilo: 'rayado', // liso | rayado | cuadriculado | puntos
  activos: true, // interruptor general: apagados no se ven ni alinean
  modo: 'siempre', // siempre | breve (aparecen un momento al activarlos) | ocultos
  duracion: 2, // segundos que se ven en modo «breve»: 1 o 2
  interlineado: 32, // separación entre renglones, en unidades del mundo
  color: '#2350d8',
  intensidad: 0.35, // 0,05 a 1
  alinear: false, // acomodar lo nuevo a la guía (solo si se activa)
};

// Identificador único. No se usa crypto.randomUUID() porque no existe en conexiones
// no seguras (por ejemplo, la tablet abriendo http://192.168.x.x durante el desarrollo).
export function nuevoId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const MODOS_ESCRITURA = { AMBOS: 'ambos', MANO: 'mano', TECLADO: 'teclado' };

export function crearDocumento({
  titulo = 'Sin título',
  formato = FORMATOS.PIZARRON,
  config = {},
  escritura = MODOS_ESCRITURA.AMBOS,
  estiloRenglones,
  carpetaId = null,
  etiquetas = [],
  favorito = false,
  abiertoEl = null,
} = {}) {
  const ahora = Date.now();
  return {
    id: nuevoId(),
    version: VERSION_ESQUEMA,
    titulo,
    formato,
    creado: ahora,
    modificado: ahora,
    papelera: null, // fecha de envío a la papelera, o null
    escritura, // ambos | mano | teclado
    renglones: { ...RENGLONES_POR_DEFECTO, ...(estiloRenglones ? { estilo: estiloRenglones } : {}) },
    carpetaId: carpetaId || null,
    etiquetas: Array.isArray(etiquetas) ? etiquetas : [],
    favorito: !!favorito,
    abiertoEl: abiertoEl || null,
    // Ajustes propios de cada formato (tamaño de tarjeta, orden de tarjetas, márgenes de página…)
    config,
  };
}

// Un elemento es todo lo que se dibuja o escribe sobre un documento.
// contenedor: null en el pizarrón; id de tarjeta en tarjetas; número de página en páginas A4.
// datos según el tipo:
//   texto:   { bloques, tamano, color }  (Etapa 6, ver herramientas/texto/modelo.js; los antiguos { contenido } se siguen leyendo)
//   trazo:   { puntos: [[x, y, presion], ...], color, grosor, opacidad, herramienta }
//   imagen:  { blobId, anchoOriginal, altoOriginal }
//   simbolo: { caracter, tamano, color }
//   figura:  { forma: 'rectangulo' | 'elipse', relleno, borde, grosor }
// Todos los elementos tienen x, y, ancho, alto (caja que los contiene) y z (orden de apilado).
// Además soportan grupoId (para agrupar unidades atómicas) y bloqueado (para proteger contra edición accidental).
export function crearElemento(documentoId, tipo, { x = 0, y = 0, ancho = 0, alto = 0, z = 0, contenedor = null, cara = 'anverso', datos = {}, grupoId = null, bloqueado = false } = {}) {
  const ahora = Date.now();
  return { id: nuevoId(), documentoId, tipo, x, y, ancho, alto, z, contenedor, cara: cara === 'reverso' ? 'reverso' : 'anverso', datos, grupoId: grupoId || null, bloqueado: !!bloqueado, creado: ahora, modificado: ahora };
}
