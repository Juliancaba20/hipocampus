// Portapapeles interno de Anotomía (Etapa 17A).
// Permite copiar, cortar, pegar y duplicar cualquier elemento (trazos, figuras,
// textos, imágenes y símbolos) dentro del mismo documento, entre documentos
// distintos y entre formatos (pizarrón, tarjetas, páginas A4).
// No usa crypto.randomUUID(): utiliza nuevoId() de modelo.js.

import { nuevoId } from '../almacen/modelo.js';
import { trasladar, unirRects } from './geometria.js';
import { remaparAnclajesConectores } from './conectores.js';
import { yDePagina } from '../formatos/paginas.js';

const CLAVE_STORAGE = 'anotomia.portapapeles';
export const TIPO_MIME_ELEMENTOS = 'application/x-anotomia-elementos';

let memoriaPortapapeles = null;
let contadorPegadosConsecutivos = 0;

// Intenta sincronizar desde sessionStorage al cargar el módulo
try {
  if (typeof sessionStorage !== 'undefined') {
    const guardado = sessionStorage.getItem(CLAVE_STORAGE);
    if (guardado) {
      const parsed = JSON.parse(guardado);
      if (parsed && Array.isArray(parsed.elementos) && parsed.elementos.length > 0) {
        memoriaPortapapeles = parsed;
      }
    }
  }
} catch {
  // Ignorar errores de acceso a sessionStorage (por ejemplo, restricciones de cookies/storage)
}

/**
 * Guarda una colección de elementos en el portapapeles.
 * @param {Array<Object>} elementos - Elementos a copiar
 * @param {Object} origen - Metadatos de procedencia: { documentoId, formato, contenedor, caja }
 */
export function guardarEnPortapapeles(elementos, origen = {}) {
  if (!Array.isArray(elementos) || elementos.length === 0) return false;

  const clones = structuredClone(elementos);
  const caja = origen.caja || unirRects(clones);

  memoriaPortapapeles = {
    elementos: clones,
    origen: {
      documentoId: origen.documentoId || '',
      formato: origen.formato || 'pizarron',
      contenedor: origen.contenedor ?? null,
      caja: caja ? { ...caja } : null,
    },
    guardadoEn: Date.now(),
  };

  contadorPegadosConsecutivos = 0;

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify(memoriaPortapapeles));
    }
  } catch {
    // Si la cuota de sessionStorage se excede o está bloqueada, la copia en memoria subsiste
  }

  return true;
}

/**
 * Indica si el portapapeles contiene elementos listos para pegar.
 */
export function hayContenidoEnPortapapeles() {
  if (memoriaPortapapeles && Array.isArray(memoriaPortapapeles.elementos) && memoriaPortapapeles.elementos.length > 0) {
    return true;
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const guardado = sessionStorage.getItem(CLAVE_STORAGE);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (parsed && Array.isArray(parsed.elementos) && parsed.elementos.length > 0) {
          memoriaPortapapeles = parsed;
          return true;
        }
      }
    }
  } catch {
    /* ignorar */
  }
  return false;
}

/**
 * Obtiene el contenido actual del portapapeles e incrementa el contador de pegados consecutivos.
 */
export function obtenerDePortapapeles() {
  if (!hayContenidoEnPortapapeles()) return null;

  contadorPegadosConsecutivos++;

  return {
    elementos: structuredClone(memoriaPortapapeles.elementos),
    origen: { ...memoriaPortapapeles.origen },
    contador: contadorPegadosConsecutivos,
  };
}

/**
 * Limpia el portapapeles interno.
 */
export function limpiarPortapapeles() {
  memoriaPortapapeles = null;
  contadorPegadosConsecutivos = 0;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CLAVE_STORAGE);
    }
  } catch {
    /* ignorar */
  }
}

/**
 * Calcula los elementos transformados para ser pegados en el destino según formato y contenedor.
 * Genera nuevos identificadores, reasigna contenedor, actualiza fechas y orden Z.
 *
 * @param {Object} paquete - { elementos, origen, contador }
 * @param {Object} contextoDestino - {
 *   documentoId: string,
 *   formato: 'pizarron' | 'tarjetas' | 'paginas',
 *   contenedor: string | number | null,
 *   camara: { x, y, zoom },
 *   vistaAncho: number,
 *   vistaAlto: number,
 *   marco: Object | Array | null,
 *   zMax: number
 * }
 * @returns {Array<Object>} Lista de nuevos elementos listos para insertar en la escena
 */
export function prepararElementosParaPegar(paquete, contextoDestino) {
  if (!paquete || !Array.isArray(paquete.elementos) || paquete.elementos.length === 0) return [];

  const { elementos, origen, contador = 1 } = paquete;
  const {
    documentoId,
    formato = 'pizarron',
    contenedor = null,
    camara = { x: 0, y: 0, zoom: 1 },
    vistaAncho = 800,
    vistaAlto = 600,
    marco = null,
  } = contextoDestino;

  let zMaxActual = Number.isFinite(contextoDestino.zMax) ? contextoDestino.zMax : 0;
  const ahora = Date.now();
  const cajaOrigen = origen?.caja || unirRects(elementos) || { x: 0, y: 0, ancho: 100, alto: 100 };

  const mismoDoc = origen?.documentoId === documentoId;
  const mismoFormato = origen?.formato === formato;
  const mismoContenedor = mismoDoc && mismoFormato && (origen?.contenedor === contenedor);

  // Desplazamiento base por cada pegado consecutivo
  const pasoOffset = 24;
  let dx = 0;
  let dy = 0;

  if (formato === 'paginas') {
    // Destino: Páginas A4
    const paginaDestino = typeof contenedor === 'number' && contenedor > 0
      ? contenedor
      : (typeof contenedor === 'function' ? contenedor() : 1);
    const yBaseDestino = yDePagina(paginaDestino);

    if (mismoDoc && mismoFormato && origen.contenedor === paginaDestino) {
      // Mismo documento y misma página: desplazamiento leve respecto al original
      dx = pasoOffset * contador;
      dy = pasoOffset * contador;
    } else if (mismoFormato && origen?.contenedor) {
      // Entre páginas A4: conservar posición relativa dentro de la página
      const yBaseOrigen = yDePagina(origen.contenedor);
      const dyRelativo = cajaOrigen.y - yBaseOrigen;
      const xRelativo = cajaOrigen.x;
      dx = xRelativo - cajaOrigen.x + pasoOffset * (contador - 1);
      dy = (yBaseDestino + dyRelativo) - cajaOrigen.y + pasoOffset * (contador - 1);
    } else {
      // Desde Pizarrón o Tarjetas hacia A4: centrar horizontalmente y colocar arriba en la página activa
      const xObjetivo = Math.max(60, Math.round((794 - cajaOrigen.ancho) / 2));
      const yObjetivo = yBaseDestino + 80;
      dx = xObjetivo - cajaOrigen.x + pasoOffset * (contador - 1);
      dy = yObjetivo - cajaOrigen.y + pasoOffset * (contador - 1);
    }
  } else if (formato === 'tarjetas') {
    // Destino: Tarjetas
    const medTarjeta = (marco && !Array.isArray(marco) && marco.ancho && marco.alto)
      ? marco
      : { ancho: 1120, alto: 630 };

    if (mismoContenedor) {
      // Misma tarjeta: leve desplazamiento
      dx = pasoOffset * contador;
      dy = pasoOffset * contador;
    } else if (mismoFormato) {
      // De otra tarjeta: misma posición en la tarjeta con leve desplazamiento por pegados consecutivos
      dx = pasoOffset * (contador - 1);
      dy = pasoOffset * (contador - 1);
    } else {
      // Desde Pizarrón o A4 a Tarjetas: ubicar dentro de la tarjeta
      const xObjetivo = Math.max(40, Math.round((medTarjeta.ancho - cajaOrigen.ancho) / 2));
      const yObjetivo = Math.max(40, Math.round((medTarjeta.alto - cajaOrigen.alto) / 2));
      dx = xObjetivo - cajaOrigen.x + pasoOffset * (contador - 1);
      dy = yObjetivo - cajaOrigen.y + pasoOffset * (contador - 1);
    }
  } else {
    // Destino: Pizarrón infinito
    if (mismoDoc) {
      dx = pasoOffset * contador;
      dy = pasoOffset * contador;
    } else {
      // Entre documentos o desde otros formatos: si la caja origen cae dentro de la vista actual,
      // la respetamos con leve desplazamiento; si cae fuera de vista, la traemos al centro de la cámara.
      const centroCamaraX = camara.x + (vistaAncho / (2 * (camara.zoom || 1)));
      const centroCamaraY = camara.y + (vistaAlto / (2 * (camara.zoom || 1)));
      const centroCajaX = cajaOrigen.x + cajaOrigen.ancho / 2;
      const centroCajaY = cajaOrigen.y + cajaOrigen.alto / 2;

      const mitadAnchoVista = (vistaAncho / (2 * (camara.zoom || 1))) * 1.2;
      const mitadAltoVista = (vistaAlto / (2 * (camara.zoom || 1))) * 1.2;

      const fueraDeVista = Math.abs(centroCajaX - centroCamaraX) > mitadAnchoVista
        || Math.abs(centroCajaY - centroCamaraY) > mitadAltoVista;

      if (fueraDeVista || !mismoFormato) {
        dx = (centroCamaraX - centroCajaX) + pasoOffset * (contador - 1);
        dy = (centroCamaraY - centroCajaY) + pasoOffset * (contador - 1);
      } else {
        dx = pasoOffset * contador;
        dy = pasoOffset * contador;
      }
    }
  }

  // Contenedor que recibirán los elementos nuevos
  let contenedorFinal = null;
  if (formato === 'tarjetas') {
    contenedorFinal = typeof contenedor === 'string' ? contenedor : (marco?.id || null);
  } else if (formato === 'paginas') {
    contenedorFinal = typeof contenedor === 'number'
      ? contenedor
      : (typeof contenedor === 'function' ? contenedor() : 1);
  }

  const mapaGrupos = new Map();
  const mapaIds = new Map();

  const preparados = elementos.map((orig) => {
    const nuevoIdGenerado = nuevoId();
    mapaIds.set(orig.id, nuevoIdGenerado);

    const clon = structuredClone(orig);
    const movido = trasladar(clon, dx, dy);

    // En páginas A4, si contenedor es dinámico se calcula a partir de la coordenada Y resultante
    let c = contenedorFinal;
    if (formato === 'paginas' && typeof contextoDestino.contenedor === 'function') {
      c = contextoDestino.contenedor(movido.y);
    }

    let nuevoGrupoId = null;
    if (orig.grupoId) {
      if (!mapaGrupos.has(orig.grupoId)) {
        mapaGrupos.set(orig.grupoId, nuevoId());
      }
      nuevoGrupoId = mapaGrupos.get(orig.grupoId);
    }

    return {
      ...movido,
      id: nuevoIdGenerado,
      documentoId,
      contenedor: c,
      z: ++zMaxActual,
      grupoId: nuevoGrupoId,
      bloqueado: !!orig.bloqueado,
      creado: ahora,
      modificado: ahora,
    };
  });

  return remaparAnclajesConectores(preparados, mapaIds);
}
