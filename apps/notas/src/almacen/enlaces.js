// Gestión de enlaces entre notas y detección de enlaces entrantes (Backlinks).
// Etapa 23: Enlaces entre notas y manejo de enlaces rotos/papelera.

import { pedido, transaccion } from './db.js';
import { listarDocumentos, obtenerDocumento } from './documentos.js';
import { listarElementos } from './elementos.js';

/**
 * Verifica la disponibilidad de una nota destino enlazada.
 * Comportamiento documentado:
 * - Si la nota existe y está activa: { disponible: true, estado: 'disponible', doc }
 * - Si está en la papelera: { disponible: false, estado: 'papelera', doc, mensaje: 'Nota en papelera (recuperable)' }
 * - Si fue eliminada definitivamente: { disponible: false, estado: 'no-disponible', mensaje: 'Nota no disponible' }
 *
 * Al restaurar una nota de la papelera, al conservar su identificador original (id),
 * todos los enlaces entrantes existentes vuelven a estar operativos automáticamente sin intervención manual.
 */
export async function verificarEstadoNotaEnlace(notaId) {
  if (!notaId) {
    return { disponible: false, estado: 'no-disponible', mensaje: 'Enlace sin identificador de nota' };
  }

  try {
    const doc = await obtenerDocumento(notaId);
    if (!doc) {
      return { disponible: false, estado: 'no-disponible', mensaje: 'Nota no disponible' };
    }
    if (doc.papelera !== null && doc.papelera !== undefined) {
      return {
        disponible: false,
        estado: 'papelera',
        doc,
        titulo: doc.titulo || '',
        mensaje: 'Nota en papelera (recuperable al restaurar)',
      };
    }
    return {
      disponible: true,
      estado: 'disponible',
      doc,
      titulo: doc.titulo || '',
      mensaje: doc.titulo || 'Nota disponible',
    };
  } catch (err) {
    return { disponible: false, estado: 'error', mensaje: 'Error al consultar nota: ' + err.message };
  }
}

/**
 * Extrae todos los identificadores de notas referenciadas en un elemento.
 * Detecta enlaces tanto en textos enriquecidos (data-nt-nota-id) como en propiedades
 * de enlace de figuras, imágenes y otros elementos.
 */
export function extraerEnlacesDeElemento(elemento) {
  if (!elemento) return [];
  const enlaces = [];

  // 1. Enlace en propiedad directa o datos del elemento (figuras, imágenes, etc.)
  const enlaceDirecto = elemento.enlace || elemento.datos?.enlace;
  if (enlaceDirecto && enlaceDirecto.tipo === 'nota' && enlaceDirecto.notaId) {
    enlaces.push({
      notaId: enlaceDirecto.notaId,
      titulo: enlaceDirecto.titulo || '',
      tipo: 'elemento',
      origen: elemento.tipo || 'elemento',
      elementoId: elemento.id,
      tipoElemento: elemento.tipo,
    });
  }

  // 2. Enlaces dentro de bloques de texto enriquecido (HTML / modelo)
  if (elemento.tipo === 'texto' && elemento.datos) {
    const bloques = elemento.datos.bloques || [];
    for (const b of bloques) {
      const corridas = Array.isArray(b.runs) ? b.runs : Array.isArray(b.corridas) ? b.corridas : [];
      for (const corrida of corridas) {
        if (corrida && corrida.enlace && corrida.enlace.tipo === 'nota' && corrida.enlace.notaId) {
          enlaces.push({
            notaId: corrida.enlace.notaId,
            titulo: corrida.enlace.url || corrida.texto || corrida.t || '',
            tipo: 'texto',
            origen: 'texto',
            elementoId: elemento.id,
            texto: corrida.texto || corrida.t || '',
          });
        }
      }
    }

    // Análisis de respaldo en HTML crudo si existe
    if (typeof elemento.datos.html === 'string' && elemento.datos.html.includes('data-nt-nota-id')) {
      const regex = /data-nt-nota-id=["']([^"']+)["']/g;
      let match;
      while ((match = regex.exec(elemento.datos.html)) !== null) {
        const idEncontrado = match[1];
        if (idEncontrado && !enlaces.some((e) => e.notaId === idEncontrado)) {
          enlaces.push({
            notaId: idEncontrado,
            titulo: '',
            tipo: 'texto',
            origen: 'texto',
            elementoId: elemento.id,
          });
        }
      }
    }
  }

  return enlaces;
}

/**
 * Busca todas las notas de la biblioteca que enlazan hacia el documentoId especificado.
 * Devuelve un listado estructurado de enlaces entrantes (backlinks).
 */
export async function buscarNotasQueEnlazanA(documentoIdDestino) {
  if (!documentoIdDestino) return [];

  const todosDocs = await listarDocumentos({ papelera: false });
  const entrantes = [];

  for (const doc of todosDocs) {
    if (doc.id === documentoIdDestino) continue; // No contar auto-referencias

    try {
      const elementos = (Array.isArray(doc.elementos) && doc.elementos.length > 0)
        ? doc.elementos
        : await listarElementos(doc.id);
      const coincidencias = [];

      for (const el of elementos) {
        const enlacesEl = extraerEnlacesDeElemento(el);
        for (const enl of enlacesEl) {
          if (enl.notaId === documentoIdDestino) {
            coincidencias.push(enl);
          }
        }
      }

      if (coincidencias.length > 0) {
        entrantes.push({
          docId: doc.id,
          documentoId: doc.id,
          titulo: doc.titulo || 'Sin título',
          formato: doc.formato,
          materia: doc.materia || null,
          modificado: doc.modificado,
          cantidadEnlaces: coincidencias.length,
          detalles: coincidencias,
        });
      }
    } catch {
      // Ignorar errores en notas individuales para no romper la consulta completa
    }
  }

  return entrantes;
}

/**
 * Obtiene todos los enlaces salientes presentes en un documento y verifica el estado actual
 * de cada nota enlazada (si está activa, en papelera o no disponible).
 */
export async function obtenerEnlacesSalientesDocumento(docOId, elementosDocumento = null) {
  if (!docOId) return [];

  const documentoId = typeof docOId === 'string' ? docOId : docOId.id;
  let elementos = elementosDocumento;
  if (!elementos && typeof docOId === 'object' && Array.isArray(docOId.elementos)) {
    elementos = docOId.elementos;
  }
  if (!elementos) {
    try {
      elementos = await listarElementos(documentoId);
    } catch {
      return [];
    }
  }

  const salientes = [];
  const idsVistos = new Set();

  for (const el of elementos) {
    const enlaces = extraerEnlacesDeElemento(el);
    for (const enl of enlaces) {
      salientes.push(enl);
      idsVistos.add(enl.notaId);
    }
  }

  // Verificar el estado de cada nota destino
  const estados = await Promise.all(
    [...idsVistos].map(async (id) => {
      const info = await verificarEstadoNotaEnlace(id);
      return [id, info];
    })
  );
  const mapaEstados = new Map(estados);

  return salientes.map((s) => ({
    ...s,
    estadoDestino: mapaEstados.get(s.notaId) || { disponible: false, estado: 'no-disponible', mensaje: 'Nota no disponible' },
  }));
}
