// Acceso de bajo nivel a IndexedDB. La interfaz de la app nunca lo usa directamente:
// pasa por documentos.js y elementos.js. Si algún día el guardado cambia (por ejemplo,
// archivos reales en el instalador de PC), solo se reescribe esta capa.

// Nombre interno de la base: se mantiene aunque la app se llame Anotomía, para no perder los datos ya guardados.
const NOMBRE_BD = 'notas-app';
const VERSION_BD = 3;
let promesaBD = null;

export function abrirBD() {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((resolver, rechazar) => {
    if (typeof indexedDB === 'undefined') {
      rechazar(new Error('Este navegador no permite guardar notas en el dispositivo.'));
      return;
    }
    const pedido = indexedDB.open(NOMBRE_BD, VERSION_BD);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains('documentos')) {
        const docs = bd.createObjectStore('documentos', { keyPath: 'id' });
        docs.createIndex('modificado', 'modificado');
      }
      if (!bd.objectStoreNames.contains('elementos')) {
        const els = bd.createObjectStore('elementos', { keyPath: 'id' });
        els.createIndex('documentoId', 'documentoId');
      }
      if (!bd.objectStoreNames.contains('blobs')) {
        bd.createObjectStore('blobs', { keyPath: 'id' }); // imágenes (Etapa 11)
      }
      if (!bd.objectStoreNames.contains('ajustes')) {
        bd.createObjectStore('ajustes', { keyPath: 'clave' });
      }
      if (!bd.objectStoreNames.contains('indice_busqueda')) {
        const idx = bd.createObjectStore('indice_busqueda', { keyPath: 'documentoId' });
        idx.createIndex('enPapelera', 'enPapelera');
        idx.createIndex('modificado', 'modificado');
      }
      if (!bd.objectStoreNames.contains('repeticion')) {
        const rep = bd.createObjectStore('repeticion', { keyPath: 'id' });
        rep.createIndex('documentoId', 'documentoId');
        rep.createIndex('tarjetaId', 'tarjetaId');
        rep.createIndex('fechaRepaso', 'fechaRepaso');
      }
    };
    pedido.onsuccess = () => {
      const bd = pedido.result;
      bd.onversionchange = () => { bd.close(); promesaBD = null; };
      resolver(bd);
    };
    pedido.onerror = () => rechazar(pedido.error);
    pedido.onblocked = () => rechazar(new Error('Cierre las otras pestañas de la app y vuelva a intentar.'));
  });
  promesaBD.catch(() => { promesaBD = null; });
  return promesaBD;
}

export async function cerrarBD() {
  if (!promesaBD) return;
  const bd = await promesaBD;
  bd.close();
  promesaBD = null;
}

export function pedido(r) {
  return new Promise((resolver, rechazar) => {
    r.onsuccess = () => resolver(r.result);
    r.onerror = () => rechazar(r.error);
  });
}

export const EVENTO_ESPACIO_LLENO = 'anotomia:espacio-lleno';

export function esErrorCuota(error) {
  return !!error && (
    error.name === 'QuotaExceededError'
    || error.code === 22
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || String(error.message || '').toLowerCase().includes('quota')
  );
}

function avisarSiEsCuota(error) {
  if (esErrorCuota(error) && typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(new CustomEvent(EVENTO_ESPACIO_LLENO, { detail: { error } }));
    } catch {
      /* ignorar en entornos sin DOM completo */
    }
  }
}

// Ejecuta `trabajo(tx)` dentro de una transacción y resuelve cuando se confirmó en disco.
// `trabajo` solo debe esperar pedidos de IndexedDB (no otras promesas), o la transacción se cierra.
export async function transaccion(almacenes, modo, trabajo) {
  const bd = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(almacenes, modo);
    let resultado;
    tx.oncomplete = () => resolver(resultado);
    tx.onerror = () => { avisarSiEsCuota(tx.error); rechazar(tx.error); };
    tx.onabort = () => {
      const err = tx.error || new Error('Se canceló el guardado.');
      avisarSiEsCuota(err);
      rechazar(err);
    };
    Promise.resolve(trabajo(tx)).then((r) => { resultado = r; }, (e) => {
      avisarSiEsCuota(e);
      try { tx.abort(); } catch { /* ya cerrada */ }
      rechazar(e);
    });
  });
}
