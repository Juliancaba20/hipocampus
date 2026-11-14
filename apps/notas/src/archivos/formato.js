// Formato propio de archivo «.nota» (Etapa 12).
// Empaqueta y desempaqueta documentos de forma autónoma con datos, elementos e imágenes.

import { FORMATOS, MODOS_ESCRITURA, RENGLONES_POR_DEFECTO, TIPOS_ELEMENTO, nuevoId } from '../almacen/modelo.js';
import { sanear as sanearBloquesTexto, sanearEnlace as sanearEnlaceTexto } from '../herramientas/texto/modelo.js';
import { normalizarTarjetasConfig } from '../formatos/tarjetas.js';
import { normalizarPaginasConfig } from '../formatos/paginas.js';

export const ID_APP = 'anotomia';
export const VERSION_FORMATO = 3;
export const MIME_TIPO_NOTA = 'application/x-anotomia-nota';

// Convierte ArrayBuffer a Base64 en bloques seguros para no desbordar la pila de llamadas
export function arrayBufferABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binario = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binario);
}

// Convierte Base64 a Uint8Array
export function base64AUint8Array(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

// Comprime bytes con Gzip usando CompressionStream nativo si está disponible
export async function comprimirBytes(bytes) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Response(bytes).body.pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return bytes;
    }
  }
  return bytes;
}

// Descomprime bytes con Gzip si detecta los bytes mágicos 0x1F, 0x8B
export async function descomprimirBytes(bytes) {
  if (bytes && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
        const buf = await new Response(stream).arrayBuffer();
        return new Uint8Array(buf);
      } catch (e) {
        throw new Error('El archivo comprimido está dañado o no se pudo descomprimir: ' + e.message);
      }
    }
  }
  return bytes;
}

// Migraciones de esquema entre versiones del archivo .nota
export const MIGRACIONES = {
  // Versión 2: añade grupoId y bloqueado a los elementos sin pérdida de datos
  2: (datos) => {
    const normalizar = (el) => {
      if (!el || typeof el !== 'object') return;
      if (el.grupoId === undefined) el.grupoId = null;
      if (el.bloqueado === undefined) el.bloqueado = false;
    };
    if (Array.isArray(datos.elementos)) {
      datos.elementos.forEach(normalizar);
    }
    if (datos.tipo === 'coleccion' && Array.isArray(datos.items)) {
      for (const item of datos.items) {
        if (item && Array.isArray(item.elementos)) {
          item.elementos.forEach(normalizar);
        }
      }
    }
    return datos;
  },
  // Versión 3: añade cara ('anverso' / 'reverso') a los elementos para tarjetas de doble cara
  3: (datos) => {
    const normalizar = (el) => {
      if (!el || typeof el !== 'object') return;
      if (el.cara === undefined) el.cara = 'anverso';
    };
    if (Array.isArray(datos.elementos)) {
      datos.elementos.forEach(normalizar);
    }
    if (datos.tipo === 'coleccion' && Array.isArray(datos.items)) {
      for (const item of datos.items) {
        if (item && Array.isArray(item.elementos)) {
          item.elementos.forEach(normalizar);
        }
      }
    }
    return datos;
  },
};

export function migrarArchivo(datos) {
  if (!datos || typeof datos !== 'object') {
    throw new Error('El archivo no contiene un formato de datos reconocible.');
  }
  if (!datos.formatoApp || String(datos.formatoApp).toLowerCase() !== ID_APP.toLowerCase()) {
    throw new Error('El archivo seleccionado no pertenece a la aplicación Anotomía.');
  }
  const version = datos.versionArchivo || 1;
  if (version > VERSION_FORMATO) {
    throw new Error(`El archivo fue creado con una versión más reciente (${version}) de Anotomía. Actualice la aplicación para poder abrirlo.`);
  }

  let actual = { ...datos };
  for (let v = version + 1; v <= VERSION_FORMATO; v++) {
    if (typeof MIGRACIONES[v] === 'function') {
      actual = MIGRACIONES[v](actual);
      actual.versionArchivo = v;
    }
  }
  return actual;
}

// Empaqueta un único documento con sus elementos, recursos y repasos en un Uint8Array (.nota)
export async function empaquetarDocumento(documento, elementos = [], recursos = [], repasos = []) {
  const estructura = {
    formatoApp: ID_APP,
    versionArchivo: VERSION_FORMATO,
    exportado: Date.now(),
    tipo: 'documento',
    documento,
    elementos,
    recursos,
    repasos: Array.isArray(repasos) ? repasos : [],
  };
  const json = JSON.stringify(estructura);
  const bytes = new TextEncoder().encode(json);
  return comprimirBytes(bytes);
}

// Empaqueta múltiples documentos en un solo archivo de copia de respaldo
export async function empaquetarColeccion(items, carpetas = [], plantillas = [], examenes = []) {
  const estructura = {
    formatoApp: ID_APP,
    versionArchivo: VERSION_FORMATO,
    exportado: Date.now(),
    tipo: 'coleccion',
    items, // cada uno: { documento, elementos, recursos }
    carpetas: Array.isArray(carpetas) ? carpetas : [],
    plantillas: Array.isArray(plantillas) ? plantillas : [],
    examenes: Array.isArray(examenes) ? examenes : [],
  };
  const json = JSON.stringify(estructura);
  const bytes = new TextEncoder().encode(json);
  return comprimirBytes(bytes);
}

// Desempaqueta y valida un archivo .nota o de respaldo desde un ArrayBuffer o Uint8Array
export async function desempaquetarArchivo(entrada) {
  let bytes;
  if (typeof Blob !== 'undefined' && entrada instanceof Blob) {
    bytes = new Uint8Array(await entrada.arrayBuffer());
  } else if (entrada instanceof ArrayBuffer) {
    bytes = new Uint8Array(entrada);
  } else if (entrada instanceof Uint8Array) {
    bytes = entrada;
  } else if (entrada?.buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(entrada.buffer, entrada.byteOffset, entrada.byteLength);
  } else {
    bytes = new Uint8Array(entrada);
  }
  bytes = await descomprimirBytes(bytes);
  let texto = '';
  try {
    texto = new TextDecoder('utf-8').decode(bytes);
  } catch {
    throw new Error('El archivo no contiene texto legible ni codificación UTF-8 válida.');
  }

  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no contiene un formato JSON válido o está dañado.');
  }

  const migrado = migrarArchivo(datos);

  if (migrado.tipo === 'coleccion') {
    const itemsValidos = (Array.isArray(migrado.items) ? migrado.items : []).map((it) => sanearDocumentoImportado(it));
    const carpetasValidas = Array.isArray(migrado.carpetas)
      ? migrado.carpetas.filter((c) => c && typeof c === 'object' && c.nombre).map((c) => ({
        id: String(c.id || nuevoId()),
        nombre: String(c.nombre).slice(0, 100).trim(),
        color: String(c.color || '#2350d8'),
        creado: typeof c.creado === 'number' ? c.creado : Date.now(),
      }))
      : [];
    const plantillasValidas = Array.isArray(migrado.plantillas) ? migrado.plantillas : [];
    return {
      tipo: 'coleccion',
      items: itemsValidos,
      carpetas: carpetasValidas,
      plantillas: plantillasValidas,
      examenes: sanearExamenesImportados(migrado.examenes),
      exportado: migrado.exportado || Date.now(),
    };
  }

  // Por defecto, tipo 'documento'
  const unico = sanearDocumentoImportado(migrado);
  return {
    tipo: 'documento',
    ...unico,
    exportado: migrado.exportado || Date.now(),
  };
}


// Límites para que un archivo dañado o malicioso no pueda congelar ni romper los editores.
const MAX_PAGINAS = 2000; // un libro de texto en PDF puede superar las 500 páginas
const MAX_TARJETAS = 500;
const COORD_MAX = 1e7;
const CLAVES_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);

// Copia un valor JSON descartando claves peligrosas, números no finitos y estructuras demasiado profundas o grandes.
function limpiarJson(valor, profundidad = 0) {
  if (profundidad > 6) return undefined;
  if (valor === null || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === 'string') return valor.slice(0, 20000); // notas del orador, encabezados, etc.
  if (Array.isArray(valor)) {
    return valor.slice(0, 3000).map((v) => limpiarJson(v, profundidad + 1)).filter((v) => v !== undefined);
  }
  if (typeof valor === 'object') {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVES_PROHIBIDAS.has(k)) continue;
      const limpio = limpiarJson(v, profundidad + 1);
      if (limpio !== undefined) salida[k] = limpio;
    }
    return salida;
  }
  return undefined;
}

// Sanea la configuración propia de cada formato (cámara, páginas, tarjetas…) de un documento importado.
export function sanearConfigImportada(formato, configCruda) {
  const base = limpiarJson(configCruda && typeof configCruda === 'object' && !Array.isArray(configCruda) ? configCruda : {}) || {};

  const c = base.camara;
  if (c !== undefined) {
    const valida = c && typeof c === 'object' && esNumeroFinito(c.x) && esNumeroFinito(c.y)
      && esNumeroFinito(c.zoom) && c.zoom >= 0.02 && c.zoom <= 50
      && Math.abs(c.x) <= COORD_MAX && Math.abs(c.y) <= COORD_MAX;
    if (!valida) delete base.camara;
  }

  if (formato === FORMATOS.PAGINAS) {
    base.cantidadPaginas = Math.min(MAX_PAGINAS, Math.max(1, Math.round(+base.cantidadPaginas || 1)));
    return normalizarPaginasConfig(base);
  }
  if (formato === FORMATOS.TARJETAS) {
    if (Array.isArray(base.tarjetas)) {
      base.tarjetas = base.tarjetas
        .filter((t) => t && typeof t === 'object' && !Array.isArray(t))
        .slice(0, MAX_TARJETAS)
        .map((t) => ({ ...t, id: typeof t.id === 'string' && t.id.trim() ? t.id.trim().slice(0, 100) : undefined }));
    }
    return normalizarTarjetasConfig(base);
  }
  return base;
}

// Sanea el enlace de un elemento. Conserva el título de la nota enlazada, que el panel de enlaces entrantes usa.
function sanearEnlaceElemento(enl) {
  if (!enl || typeof enl !== 'object') return null;
  if (enl.tipo === 'nota') {
    if (typeof enl.notaId !== 'string' || !enl.notaId.trim()) return null;
    return {
      tipo: 'nota',
      notaId: enl.notaId.trim().slice(0, 100),
      titulo: typeof enl.titulo === 'string' ? enl.titulo.replace(/[<>]/g, '').slice(0, 200) : '',
    };
  }
  const url = sanearEnlaceTexto(enl);
  return url ? { tipo: 'web', url: url.url } : null;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const esColorValido = (c) => typeof c === 'string' && HEX_COLOR.test(c);
const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n);

// Sanear de forma exhaustiva los datos importados (tratar todo archivo como no confiable)
export function sanearDocumentoImportado(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Los datos del documento no tienen una estructura válida.');
  }
  const rawDoc = item.documento || item;
  if (!rawDoc || typeof rawDoc !== 'object') {
    throw new Error('No se encontraron los datos del documento en el archivo.');
  }

  // 1. Sanear Documento
  const formatosValidos = Object.values(FORMATOS);
  const formato = formatosValidos.includes(rawDoc.formato) ? rawDoc.formato : FORMATOS.PIZARRON;
  const modosEscritura = Object.values(MODOS_ESCRITURA);
  const escritura = modosEscritura.includes(rawDoc.escritura) ? rawDoc.escritura : MODOS_ESCRITURA.AMBOS;
  const tituloLimpio = String(rawDoc.titulo || 'Sin título')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 200) || 'Sin título';

  const docId = typeof rawDoc.id === 'string' && rawDoc.id.trim().length > 0 ? rawDoc.id.trim() : nuevoId();
  const creado = esNumeroFinito(rawDoc.creado) ? rawDoc.creado : Date.now();
  const modificado = esNumeroFinito(rawDoc.modificado) ? rawDoc.modificado : Date.now();

  const renglones = {
    ...RENGLONES_POR_DEFECTO,
    ...(rawDoc.renglones && typeof rawDoc.renglones === 'object' ? rawDoc.renglones : {}),
  };
  // Asegurar valores válidos en renglones
  if (!['liso', 'rayado', 'cuadriculado', 'puntos'].includes(renglones.estilo)) renglones.estilo = 'rayado';
  if (!['siempre', 'breve', 'ocultos'].includes(renglones.modo)) renglones.modo = 'siempre';
  if (!esNumeroFinito(renglones.interlineado) || renglones.interlineado < 16 || renglones.interlineado > 120) renglones.interlineado = 32;
  if (!esColorValido(renglones.color)) renglones.color = '#2350d8';
  if (!esNumeroFinito(renglones.intensidad)) renglones.intensidad = 0.35;
  renglones.intensidad = Math.max(0.05, Math.min(1, renglones.intensidad));

  const documento = {
    id: docId,
    version: VERSION_FORMATO,
    titulo: tituloLimpio,
    formato,
    creado,
    modificado,
    papelera: null,
    escritura,
    renglones,
    carpetaId: (typeof rawDoc.carpetaId === 'string' && rawDoc.carpetaId.trim()) ? rawDoc.carpetaId.trim().slice(0, 100) : null,
    favorito: !!rawDoc.favorito,
    abiertoEl: esNumeroFinito(rawDoc.abiertoEl) ? rawDoc.abiertoEl : null,
    etiquetas: Array.isArray(rawDoc.etiquetas)
      ? rawDoc.etiquetas.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 40)).slice(0, 30)
      : [],
    config: sanearConfigImportada(formato, rawDoc.config),
  };

  // 2. Sanear Elementos
  const rawElementos = Array.isArray(item.elementos) ? item.elementos : [];
  const elementos = [];
  const tiposValidos = Object.values(TIPOS_ELEMENTO);

  for (const el of rawElementos) {
    if (!el || typeof el !== 'object') continue;
    if (!tiposValidos.includes(el.tipo)) continue;
    if (!esNumeroFinito(el.x) || !esNumeroFinito(el.y) || !esNumeroFinito(el.ancho) || !esNumeroFinito(el.alto)) continue;
    if (Math.abs(el.x) > COORD_MAX || Math.abs(el.y) > COORD_MAX || el.ancho < 0 || el.alto < 0 || el.ancho > COORD_MAX || el.alto > COORD_MAX) continue;

    const elId = typeof el.id === 'string' && el.id.trim().length > 0 ? el.id.trim() : nuevoId();
    const z = esNumeroFinito(el.z) ? el.z : 0;
    const contenedor = (typeof el.contenedor === 'string' && el.contenedor.length <= 100) || esNumeroFinito(el.contenedor) ? el.contenedor : null;
    const datosOriginales = el.datos && typeof el.datos === 'object' ? el.datos : {};
    let datosSaneados = {};

    if (el.tipo === TIPOS_ELEMENTO.TEXTO) {
      const bloques = sanearBloquesTexto(datosOriginales.bloques || []);
      const tamano = esNumeroFinito(datosOriginales.tamano) ? Math.max(4, Math.min(400, datosOriginales.tamano)) : 18;
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#14192b';
      datosSaneados = { bloques, tamano, color };
    } else if (el.tipo === TIPOS_ELEMENTO.TRAZO) {
      const puntos = (Array.isArray(datosOriginales.puntos) ? datosOriginales.puntos : []).filter(
        (p) => Array.isArray(p) && esNumeroFinito(p[0]) && esNumeroFinito(p[1])
      );
      if (!puntos.length) continue;
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#14192b';
      const grosor = esNumeroFinito(datosOriginales.grosor) ? Math.max(0.5, Math.min(100, datosOriginales.grosor)) : 3;
      const opacidad = esNumeroFinito(datosOriginales.opacidad) ? Math.max(0.05, Math.min(1, datosOriginales.opacidad)) : 1;
      const herramienta = ['lapiz', 'resaltador', 'borrador'].includes(datosOriginales.herramienta) ? datosOriginales.herramienta : 'lapiz';
      datosSaneados = { puntos, color, grosor, opacidad, herramienta };
    } else if (el.tipo === TIPOS_ELEMENTO.FIGURA) {
      const formasValidas = ['rectangulo', 'elipse', 'triangulo', 'rombo', 'linea', 'flecha', 'estrella', 'hexagono', 'llave', 'nube', 'cilindro', 'cruz', 'flechaDoblada', 'flecha_doblada'];
      const forma = formasValidas.includes(datosOriginales.forma) ? datosOriginales.forma : 'rectangulo';
      const borde = esColorValido(datosOriginales.borde) ? datosOriginales.borde : '#2350d8';
      let relleno = null;
      if (esColorValido(datosOriginales.relleno)) {
        relleno = datosOriginales.relleno;
      } else if (typeof datosOriginales.relleno === 'string' && datosOriginales.relleno.startsWith('linear-gradient')) {
        relleno = datosOriginales.relleno;
      } else if (datosOriginales.relleno && typeof datosOriginales.relleno === 'object' && datosOriginales.relleno.tipo === 'lineal') {
        relleno = {
          tipo: 'lineal',
          angulo: esNumeroFinito(datosOriginales.relleno.angulo) ? datosOriginales.relleno.angulo : 90,
          paradas: (Array.isArray(datosOriginales.relleno.paradas) ? datosOriginales.relleno.paradas : []).map((p) => ({
            pos: esNumeroFinito(p.pos) ? Math.max(0, Math.min(1, p.pos)) : 0,
            color: esColorValido(p.color) ? p.color : '#2350d8',
          })),
        };
      }
      const grosor = esNumeroFinito(datosOriginales.grosor) ? Math.max(0, Math.min(40, datosOriginales.grosor)) : 3;
      const estiloBorde = ['solido', 'guiones', 'puntos'].includes(datosOriginales.estiloBorde) ? datosOriginales.estiloBorde : 'solido';
      const radioEsquinas = esNumeroFinito(datosOriginales.radioEsquinas) ? Math.max(0, Math.min(200, datosOriginales.radioEsquinas)) : 0;
      const opacidad = esNumeroFinito(datosOriginales.opacidad) ? Math.max(0.05, Math.min(1, datosOriginales.opacidad)) : 1;
      const sombra = datosOriginales.sombra && typeof datosOriginales.sombra === 'object' ? {
        activa: !!datosOriginales.sombra.activa,
        color: esColorValido(datosOriginales.sombra.color) ? datosOriginales.sombra.color : 'rgba(0, 0, 0, 0.35)',
        desenfoque: esNumeroFinito(datosOriginales.sombra.desenfoque) ? Math.max(0, Math.min(100, datosOriginales.sombra.desenfoque)) : 8,
        x: esNumeroFinito(datosOriginales.sombra.x) ? Math.max(-100, Math.min(100, datosOriginales.sombra.x)) : 2,
        y: esNumeroFinito(datosOriginales.sombra.y) ? Math.max(-100, Math.min(100, datosOriginales.sombra.y)) : 4,
      } : null;

      const tipoConector = datosOriginales.tipoConector === 'curvo' ? 'curvo' : 'recto';
      const sanearAnclaje = (anc) => {
        if (!anc || typeof anc !== 'object') return null;
        if (typeof anc.elementoId !== 'string' || !anc.elementoId.trim()) return null;
        const puerto = typeof anc.puerto === 'string' && anc.puerto.trim() ? anc.puerto.trim().slice(0, 30) : 'centro';
        return { elementoId: anc.elementoId.trim().slice(0, 100), puerto };
      };
      const anclajeInicio = sanearAnclaje(datosOriginales.anclajeInicio);
      const anclajeFin = sanearAnclaje(datosOriginales.anclajeFin);

      datosSaneados = {
        forma, borde, relleno, grosor, estiloBorde, radioEsquinas, opacidad, sombra,
        volteoX: !!datosOriginales.volteoX,
        volteoY: !!datosOriginales.volteoY,
        tipoConector, anclajeInicio, anclajeFin,
      };
      // Nodos de mapas conceptuales (Etapa 23): texto propio de la figura
      if (typeof datosOriginales.texto === 'string') datosSaneados.texto = datosOriginales.texto.slice(0, 2000);
      if (esColorValido(datosOriginales.colorTexto)) datosSaneados.colorTexto = datosOriginales.colorTexto;
      if (esNumeroFinito(datosOriginales.tamanoTexto)) datosSaneados.tamanoTexto = Math.max(6, Math.min(200, datosOriginales.tamanoTexto));
      if (typeof datosOriginales.tipoNodoMapa === 'string') datosSaneados.tipoNodoMapa = datosOriginales.tipoNodoMapa.slice(0, 30);
    } else if (el.tipo === TIPOS_ELEMENTO.SIMBOLO) {
      const caracter = typeof datosOriginales.caracter === 'string' ? datosOriginales.caracter.slice(0, 4) : '?';
      const tamano = esNumeroFinito(datosOriginales.tamano) ? Math.max(4, Math.min(600, datosOriginales.tamano)) : 32;
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#14192b';
      datosSaneados = { caracter, tamano, color };
    } else if (el.tipo === TIPOS_ELEMENTO.ICONO) {
      const nombre = typeof datosOriginales.nombre === 'string' ? datosOriginales.nombre.slice(0, 100) : 'Ícono';
      const iconoId = typeof datosOriginales.iconoId === 'string' ? datosOriginales.iconoId.slice(0, 100) : 'icono';
      const d = typeof datosOriginales.d === 'string' ? datosOriginales.d : '';
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#2350d8';
      const borde = esColorValido(datosOriginales.borde) ? datosOriginales.borde : null;
      const grosor = esNumeroFinito(datosOriginales.grosor) ? Math.max(0, Math.min(40, datosOriginales.grosor)) : 2;
      const modo = datosOriginales.modo === 'relleno' ? 'relleno' : 'trazo';
      const opacidad = esNumeroFinito(datosOriginales.opacidad) ? Math.max(0.05, Math.min(1, datosOriginales.opacidad)) : 1;
      const sombra = datosOriginales.sombra && typeof datosOriginales.sombra === 'object' ? {
        activa: !!datosOriginales.sombra.activa,
        color: esColorValido(datosOriginales.sombra.color) ? datosOriginales.sombra.color : 'rgba(0, 0, 0, 0.35)',
        desenfoque: esNumeroFinito(datosOriginales.sombra.desenfoque) ? Math.max(0, Math.min(100, datosOriginales.sombra.desenfoque)) : 8,
        x: esNumeroFinito(datosOriginales.sombra.x) ? Math.max(-100, Math.min(100, datosOriginales.sombra.x)) : 2,
        y: esNumeroFinito(datosOriginales.sombra.y) ? Math.max(-100, Math.min(100, datosOriginales.sombra.y)) : 4,
      } : null;
      datosSaneados = { nombre, iconoId, d, color, borde, grosor, modo, opacidad, sombra };
    } else if (el.tipo === TIPOS_ELEMENTO.IMAGEN) {
      if (!datosOriginales.blobId || typeof datosOriginales.blobId !== 'string') continue;
      const marco = ['ninguno', 'redondeado', 'circulo'].includes(datosOriginales.marco) ? datosOriginales.marco : 'ninguno';
      const radioEsquinas = esNumeroFinito(datosOriginales.radioEsquinas) ? Math.max(0, Math.min(200, datosOriginales.radioEsquinas)) : 16;
      const borde = esColorValido(datosOriginales.borde) ? datosOriginales.borde : null;
      const grosor = esNumeroFinito(datosOriginales.grosor) ? Math.max(0, Math.min(40, datosOriginales.grosor)) : 2;
      const estiloBorde = ['solido', 'guiones', 'puntos'].includes(datosOriginales.estiloBorde) ? datosOriginales.estiloBorde : 'solido';
      const opacidad = esNumeroFinito(datosOriginales.opacidad) ? Math.max(0.05, Math.min(1, datosOriginales.opacidad)) : 1;
      const sombra = datosOriginales.sombra && typeof datosOriginales.sombra === 'object' ? {
        activa: !!datosOriginales.sombra.activa,
        color: esColorValido(datosOriginales.sombra.color) ? datosOriginales.sombra.color : 'rgba(0, 0, 0, 0.35)',
        desenfoque: esNumeroFinito(datosOriginales.sombra.desenfoque) ? Math.max(0, Math.min(100, datosOriginales.sombra.desenfoque)) : 8,
        x: esNumeroFinito(datosOriginales.sombra.x) ? Math.max(-100, Math.min(100, datosOriginales.sombra.x)) : 2,
        y: esNumeroFinito(datosOriginales.sombra.y) ? Math.max(-100, Math.min(100, datosOriginales.sombra.y)) : 4,
      } : null;

      datosSaneados = {
        blobId: datosOriginales.blobId,
        anchoOriginal: esNumeroFinito(datosOriginales.anchoOriginal) ? datosOriginales.anchoOriginal : el.ancho,
        altoOriginal: esNumeroFinito(datosOriginales.altoOriginal) ? datosOriginales.altoOriginal : el.alto,
        marco,
        radioEsquinas,
        borde,
        grosor,
        estiloBorde,
        opacidad,
        sombra,
        recorte: datosOriginales.recorte && typeof datosOriginales.recorte === 'object' ? {
          x: esNumeroFinito(datosOriginales.recorte.x) ? datosOriginales.recorte.x : 0,
          y: esNumeroFinito(datosOriginales.recorte.y) ? datosOriginales.recorte.y : 0,
          ancho: esNumeroFinito(datosOriginales.recorte.ancho) ? datosOriginales.recorte.ancho : 1,
          alto: esNumeroFinito(datosOriginales.recorte.alto) ? datosOriginales.recorte.alto : 1,
        } : null,
        mascaras: Array.isArray(datosOriginales.mascaras)
          ? datosOriginales.mascaras
            .filter((m) => m && typeof m === 'object')
            .slice(0, 100)
            .map((m) => ({
              id: typeof m.id === 'string' && m.id.trim() ? m.id.trim().slice(0, 50) : nuevoId(),
              forma: m.forma === 'elipse' ? 'elipse' : 'rectangulo',
              rx: esNumeroFinito(m.rx) ? Math.max(0, Math.min(0.99, m.rx)) : 0,
              ry: esNumeroFinito(m.ry) ? Math.max(0, Math.min(0.99, m.ry)) : 0,
              rw: esNumeroFinito(m.rw) ? Math.max(0.005, Math.min(1, m.rw)) : 0.15,
              rh: esNumeroFinito(m.rh) ? Math.max(0.005, Math.min(1, m.rh)) : 0.08,
              texto: typeof m.texto === 'string' ? m.texto.slice(0, 150) : '',
              color: esColorValido(m.color) ? m.color : null,
            }))
          : [],
      };
    }

    // Enlace a otra nota o a la web (Etapa 23): vale para cualquier tipo de elemento
    const enlaceElemento = sanearEnlaceElemento(datosOriginales.enlace || el.enlace);
    if (enlaceElemento) datosSaneados.enlace = enlaceElemento;

    const grupoId = (typeof el.grupoId === 'string' && el.grupoId.trim().length > 0)
      ? el.grupoId.trim().slice(0, 100)
      : null;
    const bloqueado = !!el.bloqueado;
    const pasoEstudio = esNumeroFinito(el.pasoEstudio) && el.pasoEstudio > 0 ? Math.min(50, Math.round(el.pasoEstudio)) : null;
    const cara = el.cara === 'reverso' ? 'reverso' : 'anverso';

    elementos.push({
      id: elId,
      documentoId: docId,
      tipo: el.tipo,
      x: el.x,
      y: el.y,
      ancho: el.ancho,
      alto: el.alto,
      z,
      contenedor,
      cara,
      datos: datosSaneados,
      ...(enlaceElemento ? { enlace: enlaceElemento } : {}),
      grupoId,
      bloqueado,
      pasoEstudio,
      creado: esNumeroFinito(el.creado) ? el.creado : creado,
      modificado: esNumeroFinito(el.modificado) ? el.modificado : modificado,
    });
  }

  // 3. Sanear Recursos (blobs / imágenes en base64)
  const rawRecursos = Array.isArray(item.recursos) ? item.recursos : [];
  const recursos = [];
  const MIME_IMAGEN = /^(image\/(png|jpeg|jpg|webp|svg\+xml|gif)|application\/pdf)$/i; // el PDF de fondo también es un recurso

  for (const rec of rawRecursos) {
    if (!rec || typeof rec !== 'object') continue;
    if (!rec.id || typeof rec.id !== 'string') continue;
    if (!rec.base64 || typeof rec.base64 !== 'string') continue;
    const tipo = MIME_IMAGEN.test(rec.tipo) ? rec.tipo.toLowerCase() : 'image/png';
    const nombre = String(rec.nombre || 'imagen').replace(/[<>]/g, '').slice(0, 100);
    recursos.push({
      id: rec.id,
      tipo,
      nombre,
      tamano: esNumeroFinito(rec.tamano) ? rec.tamano : Math.round(rec.base64.length * 0.75),
      base64: rec.base64,
    });
  }

  // 4. Sanear Repasos (Repetición Espaciada / SRS)
  const rawRepasos = Array.isArray(item.repasos) ? item.repasos : [];
  const repasos = sanearRepasosImportados(rawRepasos, docId);

  return { documento, elementos, recursos, repasos };
}

// Sanea los registros de repetición espaciada importados
export function sanearRepasosImportados(rawRepasos, docIdDefecto = '') {
  if (!Array.isArray(rawRepasos)) return [];
  const repasos = [];
  const estadosValidos = ['nueva', 'aprendiendo', 'repaso'];

  for (const r of rawRepasos) {
    if (!r || typeof r !== 'object') continue;
    if (!r.tarjetaId || typeof r.tarjetaId !== 'string') continue;
    const docId = typeof r.documentoId === 'string' && r.documentoId.trim() ? r.documentoId.trim() : docIdDefecto;
    const tarjetaId = String(r.tarjetaId).slice(0, 100);
    const fechaRepaso = typeof r.fechaRepaso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.fechaRepaso) ? r.fechaRepaso : null;
    const intervalo = typeof r.intervalo === 'number' && Number.isFinite(r.intervalo) ? Math.max(0, Math.round(r.intervalo)) : 0;
    const facilidad = typeof r.facilidad === 'number' && Number.isFinite(r.facilidad) ? Math.max(1.3, Math.min(10, r.facilidad)) : 2.5;
    const repeticiones = typeof r.repeticiones === 'number' && Number.isFinite(r.repeticiones) ? Math.max(0, Math.round(r.repeticiones)) : 0;
    const estado = estadosValidos.includes(r.estado) ? r.estado : 'repaso';
    const ultimoRepaso = typeof r.ultimoRepaso === 'number' ? r.ultimoRepaso : Date.now();
    const historial = Array.isArray(r.historial)
      ? r.historial.filter((h) => h && typeof h === 'object').slice(-50).map((h) => ({
        fecha: typeof h.fecha === 'string' ? h.fecha.slice(0, 10) : '',
        calificacion: ['otra-vez', 'dificil', 'bien', 'facil'].includes(h.calificacion) ? h.calificacion : 'bien',
        intervalo: typeof h.intervalo === 'number' ? Math.max(0, Math.round(h.intervalo)) : 1,
        facilidad: typeof h.facilidad === 'number' ? Math.max(1.3, Math.min(10, h.facilidad)) : 2.5,
        timestamp: typeof h.timestamp === 'number' ? h.timestamp : Date.now(),
      }))
      : [];

    repasos.push({
      id: `${docId}:${tarjetaId}`,
      documentoId: docId,
      tarjetaId,
      version: 1,
      fechaRepaso,
      intervalo,
      facilidad,
      repeticiones,
      estado,
      ultimoRepaso,
      historial,
    });
  }

  return repasos;
}

// Sanea los exámenes del calendario que vienen en un respaldo (Etapa 23).
export function sanearExamenesImportados(crudos) {
  if (!Array.isArray(crudos)) return [];
  const limpiar = (v, max) => String(v || '').replace(/[<>]/g, '').trim().slice(0, max);
  return crudos.slice(0, 500).filter((e) => e && typeof e === 'object').map((e) => ({
    id: typeof e.id === 'string' && e.id.trim() ? e.id.trim().slice(0, 100) : nuevoId(),
    materia: limpiar(e.materia, 100),
    titulo: limpiar(e.titulo, 200) || 'Examen',
    fecha: typeof e.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha) ? e.fecha : '',
    hora: typeof e.hora === 'string' && /^\d{2}:\d{2}$/.test(e.hora) ? e.hora : '',
    descripcion: limpiar(e.descripcion, 1000),
    completado: !!e.completado,
    creado: esNumeroFinito(e.creado) ? e.creado : Date.now(),
    modificado: esNumeroFinito(e.modificado) ? e.modificado : Date.now(),
  }));
}
