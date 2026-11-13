// Creación y manipulación de nodos en mapas conceptuales (Etapa 23).
// Permite ramificar un nodo hijo desde un nodo padre con un conector automático (Etapa 21B).
// Mover un nodo no desordena los demás nodos del mapa.

import { crearElemento, nuevoId, TIPOS_ELEMENTO } from '../almacen/modelo.js';
import { extremosLinea, lineaDesdeExtremos } from '../lienzo/geometria.js';
import { posicionPuertoElemento } from '../lienzo/conectores.js';

/**
 * Calcula la posición óptima de un nuevo nodo hijo en base al padre, dirección y hermanos existentes.
 */
export function calcularPosicionNodoHijo(padre, hermanos = [], direccion = 'derecha') {
  const anchoHijo = Math.max(120, Math.min(220, padre.ancho || 160));
  const altoHijo = Math.max(44, Math.min(80, padre.alto || 54));
  const margenX = 70;
  const margenY = 30;

  // Filtrar hermanos que salen en la misma dirección
  const cantidadMismaDir = hermanos.length;

  let x = padre.x;
  let y = padre.y;
  let puertoPadre = 'derecha';
  let puertoHijo = 'izquierda';

  switch (direccion) {
    case 'derecha': {
      x = padre.x + padre.ancho + margenX;
      puertoPadre = 'derecha';
      puertoHijo = 'izquierda';
      if (cantidadMismaDir === 0) {
        y = padre.y + (padre.alto - altoHijo) / 2;
      } else {
        // Distribuir verticalmente los hermanos
        const paso = altoHijo + margenY;
        const indiceAlternado = (cantidadMismaDir % 2 === 1)
          ? Math.ceil(cantidadMismaDir / 2)
          : -Math.floor(cantidadMismaDir / 2);
        y = padre.y + (padre.alto - altoHijo) / 2 + (indiceAlternado * paso);
      }
      break;
    }
    case 'abajo': {
      y = padre.y + padre.alto + margenY + 30;
      puertoPadre = 'abajo';
      puertoHijo = 'arriba';
      if (cantidadMismaDir === 0) {
        x = padre.x + (padre.ancho - anchoHijo) / 2;
      } else {
        const paso = anchoHijo + margenX;
        const indiceAlternado = (cantidadMismaDir % 2 === 1)
          ? Math.ceil(cantidadMismaDir / 2)
          : -Math.floor(cantidadMismaDir / 2);
        x = padre.x + (padre.ancho - anchoHijo) / 2 + (indiceAlternado * paso);
      }
      break;
    }
    case 'izquierda': {
      x = padre.x - anchoHijo - margenX;
      puertoPadre = 'izquierda';
      puertoHijo = 'derecha';
      if (cantidadMismaDir === 0) {
        y = padre.y + (padre.alto - altoHijo) / 2;
      } else {
        const paso = altoHijo + margenY;
        const indiceAlternado = (cantidadMismaDir % 2 === 1)
          ? Math.ceil(cantidadMismaDir / 2)
          : -Math.floor(cantidadMismaDir / 2);
        y = padre.y + (padre.alto - altoHijo) / 2 + (indiceAlternado * paso);
      }
      break;
    }
    case 'arriba': {
      y = padre.y - altoHijo - margenY - 30;
      puertoPadre = 'arriba';
      puertoHijo = 'abajo';
      if (cantidadMismaDir === 0) {
        x = padre.x + (padre.ancho - anchoHijo) / 2;
      } else {
        const paso = anchoHijo + margenX;
        const indiceAlternado = (cantidadMismaDir % 2 === 1)
          ? Math.ceil(cantidadMismaDir / 2)
          : -Math.floor(cantidadMismaDir / 2);
        x = padre.x + (padre.ancho - anchoHijo) / 2 + (indiceAlternado * paso);
      }
      break;
    }
    default:
      break;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    ancho: Math.round(anchoHijo),
    alto: Math.round(altoHijo),
    puertoPadre,
    puertoHijo,
  };
}

/**
 * Busca los conectores hijos que parten del nodo especificado.
 */
export function obtenerHijosDeNodo(arg1, arg2 = []) {
  let nodoId;
  let elementos;

  if (typeof arg1 === 'string') {
    nodoId = arg1;
    elementos = Array.isArray(arg2)
      ? arg2
      : (typeof arg2?.lista === 'function' ? arg2.lista() : []);
  } else if (arg1 && typeof arg1.lista === 'function') {
    elementos = arg1.lista();
    nodoId = typeof arg2 === 'string' ? arg2 : arg2?.id;
  } else if (arg1 && arg1.id && typeof arg2 !== 'string') {
    nodoId = arg1.id;
    elementos = Array.isArray(arg2)
      ? arg2
      : (typeof arg2?.lista === 'function' ? arg2.lista() : []);
  } else {
    nodoId = typeof arg2 === 'string' ? arg2 : arg2?.id;
    elementos = Array.isArray(arg1)
      ? arg1
      : (typeof arg1?.lista === 'function' ? arg1.lista() : []);
  }

  if (!nodoId) return [];
  const hijos = [];
  for (const el of elementos) {
    if (el?.tipo === 'figura' && (el.datos?.forma === 'linea' || el.datos?.forma === 'flecha' || el.datos?.anclajeInicio)) {
      const anclajeInicio = el.datos?.anclajeInicio;
      const anclajeFin = el.datos?.anclajeFin;
      if (anclajeInicio?.elementoId === nodoId && anclajeFin?.elementoId) {
        const nodoHijo = elementos.find((e) => e.id === anclajeFin.elementoId);
        if (nodoHijo) {
          hijos.push({ conector: el, nodo: nodoHijo, direccion: anclajeInicio.puerto });
        }
      }
    }
  }
  return hijos;
}

/**
 * Crea un nodo hijo conectado atómicamente al nodo padre en la escena.
 * Retorna { nuevoNodo, nuevoConector, nodoHijo, conector }
 */
export function ramificarNodoMapaConceptual(escenaOArg, padreIdArg, opcionesArg = {}) {
  let escena, padreId, direccion, texto, documentoId;
  if (escenaOArg && escenaOArg.escena) {
    ({ escena, padreId, direccion = 'derecha', texto = 'Concepto derivado', documentoId = null } = escenaOArg);
  } else {
    escena = escenaOArg;
    padreId = padreIdArg;
    direccion = opcionesArg?.direccion || 'derecha';
    texto = opcionesArg?.texto || 'Concepto derivado';
    documentoId = opcionesArg?.documentoId || null;
  }
  if (!escena) return null;
  const padre = typeof escena.get === 'function' ? escena.get(padreId) : (typeof escena.obtener === 'function' ? escena.obtener(padreId) : null);
  if (!padre) return null;

  const listaActual = escena.lista();
  const hijosActuales = obtenerHijosDeNodo(padreId, listaActual).filter(
    (h) => h.direccion === direccion
  );

  const pos = calcularPosicionNodoHijo(padre, hijosActuales.map((h) => h.nodo), direccion);

  // Paleta armónica basada en el padre
  const colorBorde = padre.datos?.borde || '#2563eb';
  const estiloPadre = padre.datos || {};

  // Crear nodo hijo (figura con texto)
  const nuevoNodo = crearElemento(documentoId || padre.documentoId, TIPOS_ELEMENTO.FIGURA, {
    x: pos.x,
    y: pos.y,
    ancho: pos.ancho,
    alto: pos.alto,
    z: escena.zMax() + 1,
    contenedor: padre.contenedor || null,
    cara: padre.cara || 'anverso',
    datos: {
      forma: estiloPadre.forma === 'elipse' ? 'elipse' : 'rectangulo',
      borde: colorBorde,
      grosor: Math.max(1.5, Math.min(3, estiloPadre.grosor || 2)),
      relleno: '#ffffff',
      radioEsquinas: estiloPadre.radioEsquinas !== undefined ? estiloPadre.radioEsquinas : 8,
      texto,
      colorTexto: '#1e293b',
      tamanoTexto: 14,
      tipoNodoMapa: 'concepto',
    },
  });

  // Calcular puntos de anclaje para el conector
  const pInicio = posicionPuertoElemento(padre, pos.puertoPadre);
  const pHijo = posicionPuertoElemento(nuevoNodo, pos.puertoHijo);

  // Crear conector (flecha curva elegante de Etapa 21B)
  const conectorBase = crearElemento(documentoId || padre.documentoId, TIPOS_ELEMENTO.FIGURA, {
    x: Math.min(pInicio.x, pHijo.x),
    y: Math.min(pInicio.y, pHijo.y),
    ancho: Math.abs(pHijo.x - pInicio.x) || 1,
    alto: Math.abs(pHijo.y - pInicio.y) || 1,
    z: escena.zMax() + 2,
    contenedor: padre.contenedor || null,
    cara: padre.cara || 'anverso',
    datos: {
      forma: 'flecha',
      tipoConector: 'curvo',
      borde: colorBorde,
      grosor: 2,
      estiloBorde: 'solido',
      anclajeInicio: { elementoId: padre.id, puerto: pos.puertoPadre },
      anclajeFin: { elementoId: nuevoNodo.id, puerto: pos.puertoHijo },
    },
  });

  const nuevoConector = lineaDesdeExtremos(conectorBase, pInicio, pHijo);

  // Registrar operación en el historial atómico
  escena.ejecutar([
    { id: nuevoNodo.id, antes: null, despues: nuevoNodo },
    { id: nuevoConector.id, antes: null, despues: nuevoConector },
  ], 'crear nodo de mapa conceptual');

  return {
    nuevoNodo,
    nuevoConector,
    nodoHijo: nuevoNodo,
    conector: nuevoConector,
  };
}
