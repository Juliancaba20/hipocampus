// Importación atómica y segura de archivos .nota y respaldos (Etapa 12).
// Valida, sanea, detecta duplicados y persiste en IndexedDB de forma transaccional.

import { transaccion, pedido } from '../almacen/db.js';
import { nuevoId } from '../almacen/modelo.js';
import { obtenerDocumento } from '../almacen/documentos.js';
import { guardarCarpeta } from '../almacen/carpetas.js';
import { base64AUint8Array, desempaquetarArchivo } from './formato.js';
import { remaparAnclajesConectores } from '../lienzo/conectores.js';
import { importarExamenes } from '../almacen/examenes.js';

// Prepara (sin tocar la base) el documento y los elementos que se van a guardar según la decisión tomada.
function prepararItem({ documento, elementos }, decision) {
  let docAGuardar = { ...documento };
  let elementosAGuardar = elementos.map((el) => ({ ...el }));

  if (decision === 'conservar-ambos') {
    const nuevoDocId = nuevoId();
    docAGuardar = {
      ...docAGuardar,
      id: nuevoDocId,
      titulo: `${docAGuardar.titulo} (copia)`,
      modificado: Date.now(),
    };

    // Mapeo de IDs viejos a nuevos
    const mapaIds = new Map();
    for (const el of elementosAGuardar) {
      mapaIds.set(el.id, nuevoId());
    }

    elementosAGuardar = remaparAnclajesConectores(elementosAGuardar, mapaIds);
    elementosAGuardar = elementosAGuardar.map((el) => {
      const nuevoElId = mapaIds.get(el.id) || nuevoId();
      return {
        ...el,
        id: nuevoElId,
        documentoId: nuevoDocId,
        // Si el contenedor era un ID de elemento de este mismo doc, lo remapeamos
        contenedor: mapaIds.has(el.contenedor) ? mapaIds.get(el.contenedor) : el.contenedor,
      };
    });
  }
  return { docAGuardar, elementosAGuardar };
}

// Escribe un documento dentro de una transacción ya abierta. Solo espera pedidos de IndexedDB.
// Devuelve la cantidad de imágenes que se omitieron por no tener su recurso (ni en el archivo ni en la biblioteca).
async function escribirItem(tx, { documento, elementos, recursos, repasos }, decision) {
  const docStore = tx.objectStore('documentos');
  const elStore = tx.objectStore('elementos');
  const blobStore = tx.objectStore('blobs');
  const { docAGuardar, elementosAGuardar } = prepararItem({ documento, elementos }, decision);

  // 1. Si es reemplazar, borrar elementos previos del documento
  if (decision === 'reemplazar') {
    const clavesViejas = await pedido(elStore.index('documentoId').getAllKeys(docAGuardar.id));
    for (const k of clavesViejas) elStore.delete(k);
  }

  // 2. Guardar recursos (blobs de imágenes) si no existen
  const idsDisponibles = new Set();
  for (const rec of recursos) {
    if (!rec || !rec.base64 || typeof rec.base64 !== 'string') {
      throw new Error('El recurso de imagen no contiene datos Base64 válidos.');
    }
    idsDisponibles.add(rec.id);
    const existente = await pedido(blobStore.get(rec.id));
    if (!existente) {
      let bytes;
      try {
        bytes = base64AUint8Array(rec.base64);
      } catch {
        throw new Error('El archivo contiene una imagen dañada (datos Base64 inválidos).');
      }
      blobStore.put({
        id: rec.id,
        blob: new Blob([bytes], { type: rec.tipo || 'image/png' }),
        tipo: rec.tipo || 'image/png',
        nombre: rec.nombre || 'imagen',
        tamano: rec.tamano || bytes.byteLength,
        creado: Date.now(),
      });
    }
  }

  // 3. Guardar documento y elementos; las imágenes sin recurso se omiten (y se informa)
  docStore.put(docAGuardar);
  let imagenesOmitidas = 0;
  for (const el of elementosAGuardar) {
    if (el.tipo === 'imagen') {
      const bid = el.datos?.blobId;
      if (!idsDisponibles.has(bid) && !(await pedido(blobStore.get(bid)))) {
        imagenesOmitidas++;
        continue;
      }
    }
    elStore.put({ ...el, documentoId: docAGuardar.id });
  }

  // 4. Repasos de repetición espaciada:
  // Si la decisión es 'reemplazar', se restauran los repasos del archivo.
  // Si la decisión es 'conservar-ambos' (copia duplicada), el progreso empieza desde cero.
  if (tx.db.objectStoreNames.contains('repeticion')) {
    const repStore = tx.objectStore('repeticion');
    if (decision === 'reemplazar') {
      const clavesViejasRep = await pedido(repStore.index('documentoId').getAllKeys(docAGuardar.id));
      for (const k of clavesViejasRep) repStore.delete(k);
      if (Array.isArray(repasos)) {
        for (const r of repasos) {
          if (r && r.tarjetaId) {
            repStore.put({
              ...r,
              documentoId: docAGuardar.id,
              id: `${docAGuardar.id}:${r.tarjetaId}`,
            });
          }
        }
      }
    }
  }

  return { documento: docAGuardar, imagenesOmitidas };
}

// Guarda varios documentos en UNA sola transacción: si algo falla, no se guarda ninguno.
// lote: [{ item: { documento, elementos, recursos, repasos }, decision }]
export async function persistirLoteImportado(lote) {
  const activos = lote.filter((l) => l.decision !== 'omitir');
  const resultados = lote.map((l) => ({ accion: l.decision === 'omitir' ? 'omitido' : l.decision, documento: l.item.documento, imagenesOmitidas: 0 }));
  if (activos.length === 0) return resultados;

  await transaccion(['documentos', 'elementos', 'blobs', 'repeticion'], 'readwrite', async (tx) => {
    for (let i = 0; i < lote.length; i++) {
      if (lote[i].decision === 'omitir') continue;
      const r = await escribirItem(tx, lote[i].item, lote[i].decision);
      resultados[i].documento = r.documento;
      resultados[i].imagenesOmitidas = r.imagenesOmitidas;
    }
  });
  return resultados;
}

// Guarda un documento importado de forma atómica en IndexedDB
export async function persistirDocumentoImportado(item, decision = 'reemplazar') {
  const [res] = await persistirLoteImportado([{ item, decision }]);
  return res;
}

// Procesa una lista de archivos File provenientes de input[type=file] o Drag & Drop
// solicitarDecision: async ({ docExistente, docNuevo, nombreArchivo }) => 'reemplazar' | 'conservar-ambos' | 'omitir'
// alImportar({ documento, accion, archivo, coleccion }): se llama por cada documento que entró a la biblioteca
// (el programa de computadora lo usa para vincular el documento al archivo del que salió).
export async function importarArchivos(archivos, { solicitarDecision, alImportar } = {}) {
  const lista = Array.from(archivos);
  const resultados = {
    importados: 0,
    reemplazados: 0,
    conservados: 0,
    omitidos: 0,
    imagenesOmitidas: 0,
    documentos: [],
    errores: [],
  };

  let decisionParaTodos = null;

  for (const archivo of lista) {
    try {
      if (archivo.size > 100 * 1024 * 1024) {
        throw new Error(`El archivo «${archivo.name}» supera el límite permitido de 100 MB.`);
      }

      const buffer = await archivo.arrayBuffer();
      const desempaquetado = await desempaquetarArchivo(buffer);

      const items = desempaquetado.tipo === 'coleccion' ? desempaquetado.items : [desempaquetado];

      // 1. Se decide qué hacer con cada documento (sin escribir nada todavía)
      const lote = [];
      for (const item of items) {
        const existente = await obtenerDocumento(item.documento.id);
        let decision = 'reemplazar';

        if (existente) {
          if (decisionParaTodos) {
            decision = decisionParaTodos;
          } else if (typeof solicitarDecision === 'function') {
            const respuesta = await solicitarDecision({
              docExistente: existente,
              docNuevo: item.documento,
              nombreArchivo: archivo.name,
              totalPendientes: items.length,
            });
            decision = respuesta.decision;
            if (respuesta.aplicarATodos) {
              decisionParaTodos = decision;
            }
          }
        }
        lote.push({ item, decision });
      }

      // 2. Se guarda todo el archivo en una única transacción: o entra completo o no entra nada
      const guardados = await persistirLoteImportado(lote);
      for (const res of guardados) {
        if (res.accion === 'reemplazar') resultados.reemplazados++;
        else if (res.accion === 'conservar-ambos') resultados.conservados++;
        else if (res.accion === 'omitido') resultados.omitidos++;

        if (res.accion !== 'omitido') {
          resultados.importados++;
          resultados.documentos.push({ id: res.documento.id, accion: res.accion });
          try { await alImportar?.({ documento: res.documento, accion: res.accion, archivo, coleccion: desempaquetado.tipo === 'coleccion' }); } catch { /* el aviso no debe impedir la importación */ }
        }
        resultados.imagenesOmitidas += res.imagenesOmitidas || 0;
      }

      // Si el respaldo contenía carpetas, incorporarlas a la biblioteca
      if (Array.isArray(desempaquetado.carpetas) && desempaquetado.carpetas.length > 0) {
        for (const c of desempaquetado.carpetas) {
          try {
            await guardarCarpeta(c);
          } catch {
            /* ignorar fallos en carpetas individuales */
          }
        }
      }

      // Si el respaldo contenía exámenes del calendario, restaurarlos sin pisar los actuales
      if (Array.isArray(desempaquetado.examenes) && desempaquetado.examenes.length > 0) {
        try { await importarExamenes(desempaquetado.examenes); } catch { /* no interrumpir la importación */ }
      }

      // Si el respaldo contenía plantillas personalizadas, restaurarlas
      if (Array.isArray(desempaquetado.plantillas) && desempaquetado.plantillas.length > 0) {
        try {
          const { importarPlantillasPropias } = await import('../plantillas/index.js');
          await importarPlantillasPropias(desempaquetado.plantillas);
        } catch {
          /* ignorar fallos en plantillas */
        }
      }
    } catch (err) {
      resultados.errores.push({
        archivo: archivo.name,
        mensaje: err.message || 'Error desconocido al importar el archivo.',
      });
    }
  }

  return resultados;
}
