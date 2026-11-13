// Archivos reales en el disco (programa de Windows, Mac y Linux): «Guardar», «Guardar como…» y «Abrir…», como en Word.
//
// Cada documento puede estar VINCULADO a un archivo .nota que la persona eligió. Desde ese momento, cada vez que el
// documento se guarda con cambios, el archivo se vuelve a escribir (con una pequeña espera para agrupar los
// cambios rápidos). La biblioteca interna (IndexedDB) sigue funcionando igual: es la copia de trabajo y el respaldo.
//
// El vínculo (documento → ruta) no viaja dentro del archivo .nota: es un dato de este equipo y se guarda en los ajustes.
// El gestor no conoce Tauri ni IndexedDB: recibe todo inyectado, para poder probarlo.

import { obtenerAjuste, guardarAjuste, obtenerDocumento, EVENTO_DOCUMENTO_GUARDADO } from '../almacen/index.js';
import { empaquetarDesdeAlmacen, nombreArchivoSeguro } from './exportar.js';
import { esProgramaDeComputadora } from '../pwa/escritorio.js';

export const CLAVE_RUTAS = 'disco.rutas'; // { [idDocumento]: { ruta, escrito } }  («escrito»: cuándo se escribió por última vez)
export const CLAVE_SIN_PREGUNTAR = 'disco.sinPreguntar'; // [idDocumento]: notas por las que la persona pidió no volver a preguntar

// Nombre del archivo dentro de una ruta de Windows, Mac o Linux
export function nombreDeRuta(ruta) {
  return String(ruta || '').split(/[\\/]/).filter(Boolean).pop() || '';
}

// Un archivo leído del disco, listo para entrar por el importador. Lleva anotada su ruta para poder vincularlo.
export function archivoDesdeDisco({ ruta, nombre, bytes }) {
  const archivo = new File([bytes], nombre || nombreDeRuta(ruta), { type: 'application/x-anotomia-nota' });
  archivo.rutaDisco = ruta;
  return archivo;
}

export function crearGestorDisco({
  api, // { elegirDondeGuardar({nombre}), elegirArchivos(), escribir(ruta, bytes), leer(ruta), existe(ruta) }
  leerAjuste, // (clave, porDefecto) => Promise
  guardarAjuste: escribirAjuste, // (clave, valor) => Promise
  obtenerDoc, // (id) => Promise<documento | undefined>
  empaquetar, // (documento) => Promise<Uint8Array>
  ahora = () => Date.now(),
  esperaMs = 900,
}) {
  let rutas = null; // se carga una vez; después se mantiene en memoria y en los ajustes
  let cargando = null;
  const temporizadores = new Map(); // id → temporizador de escritura pendiente
  const colas = new Map(); // id → escritura en curso (una por documento, en orden)
  const oyentesError = new Set();

  async function cargar() {
    if (rutas) return rutas;
    cargando ||= leerAjuste(CLAVE_RUTAS, {}).then((v) => { rutas = v && typeof v === 'object' ? { ...v } : {}; return rutas; });
    return cargando;
  }
  const persistirRutas = () => escribirAjuste(CLAVE_RUTAS, { ...rutas });
  const avisarError = (info) => oyentesError.forEach((f) => f(info));

  async function rutaDe(id) { return (await cargar())[id]?.ruta || null; }
  async function todas() { return { ...(await cargar()) }; }

  async function vincular(id, ruta) {
    await cargar();
    rutas[id] = { ruta, escrito: ahora() };
    await persistirRutas();
  }

  async function desvincular(id) {
    await cargar();
    clearTimeout(temporizadores.get(id));
    temporizadores.delete(id);
    if (!rutas[id]) return;
    delete rutas[id];
    await persistirRutas();
  }

  // «Guardar como…»: elige dónde, escribe y, si corresponde, vincula el documento a ese archivo.
  // Devuelve { ruta, nombre } o null si la persona canceló.
  async function guardarComo(doc, bytes, { vincular: vincularDoc = true } = {}) {
    const ruta = await api.elegirDondeGuardar({ nombre: nombreArchivoSeguro(doc.titulo, 'nota') });
    if (!ruta) return null;
    await api.escribir(ruta, bytes);
    if (vincularDoc) await vincular(doc.id, ruta);
    return { ruta, nombre: nombreDeRuta(ruta) || nombreArchivoSeguro(doc.titulo, 'nota') };
  }

  // Copia completa u otro archivo suelto: se elige dónde guardar, sin vincular nada.
  async function guardarCopia(bytes, nombre) {
    const ruta = await api.elegirDondeGuardar({ nombre });
    if (!ruta) return null;
    await api.escribir(ruta, bytes);
    return { ruta, nombre: nombreDeRuta(ruta) || nombre };
  }

  // Escribe ahora el archivo de un documento vinculado. Devuelve true si escribió, false si no hay vínculo o falló.
  function escribirYa(id) {
    clearTimeout(temporizadores.get(id));
    temporizadores.delete(id);
    const previa = colas.get(id) || Promise.resolve();
    const tarea = previa.then(async () => {
      await cargar();
      const vinculo = rutas[id];
      if (!vinculo) return false;
      const doc = await obtenerDoc(id);
      if (!doc) return false;
      try {
        const bytes = await empaquetar(doc);
        await api.escribir(vinculo.ruta, bytes);
        if (rutas[id]) { rutas[id] = { ruta: vinculo.ruta, escrito: ahora() }; await persistirRutas(); }
        return true;
      } catch (err) {
        avisarError({ id, titulo: doc.titulo, ruta: vinculo.ruta, mensaje: err?.message || String(err) });
        return false;
      }
    });
    colas.set(id, tarea.catch(() => false));
    return tarea;
  }

  // Programa la escritura con una espera (el documento se guardó con cambios). No hace nada si no está vinculado.
  async function programarEscritura(id) {
    await cargar();
    if (!rutas[id]) return;
    clearTimeout(temporizadores.get(id));
    temporizadores.set(id, setTimeout(() => { escribirYa(id).catch(() => {}); }, esperaMs));
  }

  // Escribe ya todo lo que estaba esperando y espera a que termine (antes de actualizar o de cerrar).
  async function vaciar() {
    const pendientes = [...temporizadores.keys()];
    await Promise.all(pendientes.map((id) => escribirYa(id)));
    await Promise.all([...colas.values()]);
  }

  // Al abrir el programa: los documentos vinculados cuyo archivo quedó atrás (por ejemplo, porque se cerró la
  // ventana antes de que se escribiera) se escriben, y los que ya no tienen su archivo se desvinculan y se informan.
  // Devuelve [{ id, titulo, ruta }] con los archivos que faltan.
  async function sincronizarAlIniciar() {
    await cargar();
    const faltantes = [];
    for (const [id, vinculo] of Object.entries({ ...rutas })) {
      const doc = await obtenerDoc(id);
      if (!doc) { await desvincular(id); continue; }
      let existe = true;
      try { existe = await api.existe(vinculo.ruta); } catch { existe = true; /* sin permiso o disco no disponible: no se toca */ }
      if (!existe) { faltantes.push({ id, titulo: doc.titulo, ruta: vinculo.ruta }); await desvincular(id); continue; }
      if ((doc.modificado || 0) > (vinculo.escrito || 0)) await escribirYa(id);
    }
    return faltantes;
  }

  // «Abrir…»: la persona elige uno o varios archivos. Devuelve [{ ruta, nombre, bytes }]
  async function abrirDialogo() {
    const elegidos = await api.elegirArchivos();
    const salida = [];
    for (const ruta of elegidos || []) salida.push(await leerRuta(ruta));
    return salida;
  }
  async function leerRuta(ruta) {
    return { ruta, nombre: nombreDeRuta(ruta), bytes: await api.leer(ruta) };
  }

  // Notas por las que la persona pidió no volver a recibir la pregunta de «¿guardar como archivo?» al cerrarlas
  async function debePreguntar(id) {
    if (await rutaDe(id)) return false;
    const lista = await leerAjuste(CLAVE_SIN_PREGUNTAR, []);
    return !(Array.isArray(lista) && lista.includes(id));
  }
  async function noPreguntarMas(id) {
    const lista = await leerAjuste(CLAVE_SIN_PREGUNTAR, []);
    const nueva = Array.isArray(lista) ? lista : [];
    if (!nueva.includes(id)) await escribirAjuste(CLAVE_SIN_PREGUNTAR, [...nueva, id]);
  }

  return {
    rutaDe, todas, vincular, desvincular,
    guardarComo, guardarCopia, escribirYa, programarEscritura, vaciar, sincronizarAlIniciar,
    abrirDialogo, leerRuta, debePreguntar, noPreguntarMas,
    suscribirErrores(f) { oyentesError.add(f); return () => oyentesError.delete(f); },
  };
}

// Conexión real con las ventanas de abrir/guardar y con el disco (se carga solo cuando hace falta)
async function crearApiTauri() {
  const [dialogo, fs] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
  const filtroNota = { name: 'Documento de Anotomía', extensions: ['nota'] };
  const filtrosGuardado = {
    nota: filtroNota,
    'anotomia-respaldo': { name: 'Copia de seguridad de Anotomía', extensions: ['anotomia-respaldo'] },
    pdf: { name: 'Documento PDF', extensions: ['pdf'] },
    png: { name: 'Imagen PNG', extensions: ['png'] },
    jpg: { name: 'Imagen JPG', extensions: ['jpg', 'jpeg'] },
  };
  return {
    // El filtro del diálogo sigue la extensión del nombre (.nota, copia de seguridad, PDF o imagen)
    elegirDondeGuardar: ({ nombre }) => {
      const ext = String(nombre || '').split('.').pop().toLowerCase();
      const filtro = filtrosGuardado[ext];
      return dialogo.save({ title: 'Guardar archivo', defaultPath: nombre, filters: filtro ? [filtro] : undefined });
    },
    elegirArchivos: async () => {
      const r = await dialogo.open({
        title: 'Abrir documento', multiple: true,
        filters: [{ name: 'Documentos de Anotomía', extensions: ['nota', 'anotomia-respaldo'] }],
      });
      return r == null ? [] : (Array.isArray(r) ? r : [r]);
    },
    escribir: (ruta, bytes) => fs.writeFile(ruta, bytes),
    leer: (ruta) => fs.readFile(ruta),
    existe: (ruta) => fs.exists(ruta),
  };
}

let instancia = null;
export function discoDelPrograma() {
  if (instancia) return instancia;
  let apiPromesa = null;
  const llamar = (nombre) => async (...args) => { apiPromesa ||= crearApiTauri(); return (await apiPromesa)[nombre](...args); };
  instancia = crearGestorDisco({
    api: { elegirDondeGuardar: llamar('elegirDondeGuardar'), elegirArchivos: llamar('elegirArchivos'), escribir: llamar('escribir'), leer: llamar('leer'), existe: llamar('existe') },
    leerAjuste: obtenerAjuste,
    guardarAjuste,
    obtenerDoc: obtenerDocumento,
    empaquetar: (doc) => empaquetarDesdeAlmacen(doc),
  });
  return instancia;
}

// Hace que cada documento guardado con cambios escriba también su archivo (solo en el programa de computadora).
// Devuelve la función para desactivarlo.
export function activarGuardadoEnArchivos() {
  if (typeof window === 'undefined' || !esProgramaDeComputadora()) return () => {};
  const disco = discoDelPrograma();
  const alGuardar = (e) => { disco.programarEscritura(e.detail?.id).catch(() => {}); };
  const alGuardarTodo = (e) => { e.detail?.promesas?.push(disco.vaciar()); };
  window.addEventListener(EVENTO_DOCUMENTO_GUARDADO, alGuardar);
  window.addEventListener('anotomia:guardar-todo', alGuardarTodo);
  return () => {
    window.removeEventListener(EVENTO_DOCUMENTO_GUARDADO, alGuardar);
    window.removeEventListener('anotomia:guardar-todo', alGuardarTodo);
  };
}
