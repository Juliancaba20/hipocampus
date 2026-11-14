import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { generarSW } from '../sw/generar.mjs';
import { crearGestorPWA, EVENTO_GUARDAR_TODO } from '../src/pwa/gestor.js';

const plantilla = readFileSync(new URL('../sw/sw.plantilla.js', import.meta.url), 'utf-8');
const leerPublico = (r) => readFileSync(new URL('../public/' + r, import.meta.url));

// ---------- generación del service worker ----------
test('generarSW: la versión depende del contenido y la lista incluye el inicio', () => {
  const arch = ['assets/a.js', 'index.html'];
  const t1 = generarSW(plantilla, arch, () => 'uno');
  const t2 = generarSW(plantilla, arch, () => 'uno');
  const t3 = generarSW(plantilla, arch, () => 'dos');
  assert.equal(t1, t2);
  assert.notEqual(t1, t3);
  assert.match(t1, /"\.\/assets\/a\.js"/);
  assert.match(t1, /"\.\/index\.html"/);
  assert.doesNotMatch(t1, /__VERSION__|__ARCHIVOS__/);
  assert.throws(() => generarSW('sin marcadores', arch, () => 'x'), /marcadores/);
});

// ---------- comportamiento del service worker (ejecutado con un entorno simulado) ----------
function entornoSW(archivos = ['assets/a.js', 'index.html'], version = 'v1', cachesExistentes = {}) {
  const texto = generarSW(plantilla, archivos, () => version);
  const cache = 'anotomia-' + texto.match(/const VERSION = '([0-9a-f]+)'/)[1];
  const oyentes = {};
  const almacenes = { ...cachesExistentes };
  const llamadas = { skipWaiting: 0, claim: 0, fetch: [] };
  const caches = {
    open: async (n) => ({ addAll: async (reqs) => { almacenes[n] = Array.from(reqs, (r) => r.url); } }),
    keys: async () => Object.keys(almacenes),
    delete: async (n) => { delete almacenes[n]; return true; },
    match: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      return Object.values(almacenes).some((l) => Array.isArray(l) && l.includes(url)) ? { desdeCache: url } : undefined;
    },
  };
  const self = {
    location: new URL('https://ejemplo.test/notas/sw.js'),
    addEventListener: (n, f) => { oyentes[n] = f; },
    skipWaiting: () => { llamadas.skipWaiting++; },
    clients: { claim: async () => { llamadas.claim++; } },
  };
  class Request { constructor(url, o) { this.url = url; this.o = o; } }
  const contexto = vm.createContext({ self, caches, URL, Request, fetch: async (r) => { llamadas.fetch.push(r.url); return { red: r.url }; }, Promise });
  vm.runInContext(texto, contexto);
  const esperar = async (nombre, evento = {}) => { let p; await oyentes[nombre]({ ...evento, waitUntil: (x) => { p = x; } }); await p; };
  const pedir = async (req) => { let r; oyentes.fetch({ request: req, respondWith: (p) => { r = p; } }); return r === undefined ? undefined : await r; };
  return { oyentes, almacenes, llamadas, esperar, pedir, cache };
}

test('SW: instala guardando los archivos con la ruta correcta y sin saltar la espera', async () => {
  const e = entornoSW();
  await e.esperar('install');
  assert.deepEqual(e.almacenes[e.cache].sort(), [
    'https://ejemplo.test/notas/', 'https://ejemplo.test/notas/assets/a.js', 'https://ejemplo.test/notas/index.html',
  ].sort());
  assert.equal(e.llamadas.skipWaiting, 0, 'no debe actualizarse sola');
});

test('SW: al activar borra las cachés viejas de Anotomía y respeta las ajenas', async () => {
  const e = entornoSW(undefined, 'v2', { 'anotomia-viejaaaa1111': [], 'otra-app': [] });
  e.almacenes[e.cache] = [];
  await e.esperar('activate');
  assert.deepEqual(Object.keys(e.almacenes).sort(), [e.cache, 'otra-app'].sort());
  assert.equal(e.llamadas.claim, 1);
});

test('SW: solo salta la espera cuando se lo piden', () => {
  const e = entornoSW();
  e.oyentes.message({ data: { tipo: 'OTRO' } });
  assert.equal(e.llamadas.skipWaiting, 0);
  e.oyentes.message({ data: { tipo: 'SALTAR_ESPERA' } });
  assert.equal(e.llamadas.skipWaiting, 1);
});

test('SW: sin conexión sirve el inicio, los archivos guardados y no toca lo ajeno', async () => {
  const e = entornoSW();
  await e.esperar('install');
  const nav = await e.pedir({ method: 'GET', mode: 'navigate', url: 'https://ejemplo.test/notas/?x=1' });
  assert.equal(nav.desdeCache, 'https://ejemplo.test/notas/index.html');
  const js = await e.pedir({ method: 'GET', mode: 'cors', url: 'https://ejemplo.test/notas/assets/a.js' });
  assert.equal(js.desdeCache, 'https://ejemplo.test/notas/assets/a.js');
  assert.equal(await e.pedir({ method: 'POST', url: 'https://ejemplo.test/notas/x' }), undefined);
  assert.equal(await e.pedir({ method: 'GET', mode: 'cors', url: 'https://otro.test/notas/x.js' }), undefined);
  assert.equal(await e.pedir({ method: 'GET', mode: 'cors', url: 'https://ejemplo.test/otra-ruta/x.js' }), undefined);
  assert.equal(e.llamadas.fetch.length, 0, 'nada de lo propio debía ir a la red');
});

// ---------- manifiesto, íconos e index.html ----------
test('manifiesto: campos obligatorios, rutas relativas e íconos con el tamaño declarado', () => {
  const m = JSON.parse(leerPublico('manifest.webmanifest'));
  assert.equal(m.name, 'Anotomía');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'es');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  const propositos = m.icons.map((i) => i.purpose);
  assert.ok(propositos.includes('any') && propositos.includes('maskable'));
  for (const ic of m.icons) {
    assert.ok(!ic.src.startsWith('/'), 'las rutas deben ser relativas para poder publicar en /notas');
    const png = leerPublico(ic.src);
    assert.equal(png.readUInt32BE(16), parseInt(ic.sizes), `ancho de ${ic.src}`);
    assert.equal(png.readUInt32BE(20), parseInt(ic.sizes), `alto de ${ic.src}`);
  }
  assert.ok(m.icons.some((i) => parseInt(i.sizes) >= 512));
  assert.ok(existsSync(new URL('../public/iconos/apple-touch-icon.png', import.meta.url)));
});

test('index.html: manifiesto, ícono de iPad y ninguna tipografía externa', () => {
  const h = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
  assert.match(h, /rel="manifest"/);
  assert.match(h, /rel="apple-touch-icon"/);
  assert.match(h, /apple-mobile-web-app-capable/);
  assert.match(h, /name="theme-color"/);
  assert.doesNotMatch(h, /googleapis|gstatic/);
});

// ---------- gestor de instalación y actualización ----------
function entornoGestor({ controlador = true, waiting = false, produccion = true } = {}) {
  const win = new EventTarget();
  win.CustomEvent = CustomEvent;
  win.document = Object.assign(new EventTarget(), { readyState: 'complete', visibilityState: 'visible' });
  win.matchMedia = () => ({ matches: false, addEventListener() {} });
  win.setInterval = () => 0;
  let recargas = 0;
  win.location = { reload: () => { recargas++; } };
  const mensajes = [];
  const swEspera = { postMessage: (m) => mensajes.push(m) };
  const instalando = Object.assign(new EventTarget(), { state: 'installing' });
  const reg = Object.assign(new EventTarget(), { active: {}, waiting: waiting ? swEspera : null, installing: null, update: async () => {} });
  const sw = Object.assign(new EventTarget(), { controller: controlador ? {} : null, register: async (url) => { sw.url = url; return reg; } });
  const nav = { onLine: true, serviceWorker: sw };
  const gestor = crearGestorPWA({ nav, win, urlSW: './sw.js', produccion });
  return { gestor, win, nav, sw, reg, instalando, swEspera, mensajes, recargas: () => recargas };
}
const turno = () => new Promise((r) => setImmediate(r));

test('gestor: en desarrollo no registra el service worker', async () => {
  const e = entornoGestor({ produccion: false });
  e.gestor.iniciar(); await turno();
  assert.equal(e.sw.url, undefined);
});

test('gestor: registra el service worker y detecta una versión nueva en espera', async () => {
  const e = entornoGestor({ waiting: true });
  e.gestor.iniciar(); await turno();
  assert.equal(e.sw.url, './sw.js');
  assert.equal(e.gestor.obtener().actualizacionLista, true);
});

test('gestor: una actualización descubierta después también avisa; la primera instalación no', async () => {
  const a = entornoGestor({ controlador: true });
  a.gestor.iniciar(); await turno();
  assert.equal(a.gestor.obtener().actualizacionLista, false);
  a.reg.installing = a.instalando; a.reg.dispatchEvent(new Event('updatefound'));
  a.instalando.state = 'installed'; a.instalando.dispatchEvent(new Event('statechange'));
  assert.equal(a.gestor.obtener().actualizacionLista, true);

  const b = entornoGestor({ controlador: false });
  b.gestor.iniciar(); await turno();
  b.reg.installing = b.instalando; b.reg.dispatchEvent(new Event('updatefound'));
  b.instalando.state = 'installed'; b.instalando.dispatchEvent(new Event('statechange'));
  assert.equal(b.gestor.obtener().actualizacionLista, false, 'la primera instalación no es una actualización');
  assert.equal(b.gestor.obtener().lista, true);
});

test('gestor: actualizar guarda todo primero, luego pide el cambio y recarga una sola vez', async () => {
  const e = entornoGestor({ waiting: true });
  e.gestor.iniciar(); await turno();
  const orden = [];
  e.win.addEventListener(EVENTO_GUARDAR_TODO, (ev) => {
    ev.detail.promesas.push(new Promise((r) => setTimeout(() => { orden.push('guardado'); r(); }, 20)));
  });
  const original = e.swEspera.postMessage;
  e.swEspera.postMessage = (m) => { orden.push('mensaje'); original(m); };
  assert.equal(await e.gestor.aplicarActualizacion(), true);
  assert.deepEqual(orden, ['guardado', 'mensaje']);
  assert.deepEqual(e.mensajes, [{ tipo: 'SALTAR_ESPERA' }]);
  assert.equal(e.recargas(), 0, 'no recarga hasta que el nuevo service worker tome el control');
  e.sw.dispatchEvent(new Event('controllerchange'));
  e.sw.dispatchEvent(new Event('controllerchange'));
  assert.equal(e.recargas(), 1);
});

test('gestor: sin versión en espera, actualizar no hace nada', async () => {
  const e = entornoGestor();
  e.gestor.iniciar(); await turno();
  assert.equal(await e.gestor.aplicarActualizacion(), false);
});

test('gestor: instalación con un botón y estado de conexión', async () => {
  const e = entornoGestor();
  e.gestor.iniciar();
  assert.equal(await e.gestor.instalar(), 'no-disponible');
  let prevenido = false; let mostrado = false;
  const ev = Object.assign(new Event('beforeinstallprompt'), { preventDefault() { prevenido = true; }, prompt() { mostrado = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  e.win.dispatchEvent(ev);
  assert.equal(prevenido, true);
  assert.equal(e.gestor.obtener().instalable, true);
  assert.equal(await e.gestor.instalar(), 'accepted');
  assert.equal(mostrado, true);
  assert.equal(e.gestor.obtener().instalable, false);
  e.win.dispatchEvent(new Event('appinstalled'));
  assert.equal(e.gestor.obtener().instalada, true);
  e.win.dispatchEvent(new Event('offline'));
  assert.equal(e.gestor.obtener().sinConexion, true);
  e.win.dispatchEvent(new Event('online'));
  assert.equal(e.gestor.obtener().sinConexion, false);
});

// ---------- el autoguardado responde al pedido de «guardar todo» ----------
test('autoguardado: guarda lo pendiente cuando se pide guardar todo antes de actualizar', async () => {
  const win = new EventTarget();
  globalThis.window = win;
  try {
    const { crearAutoguardado } = await import('../src/almacen/autoguardado.js');
    const guardados = [];
    const auto = crearAutoguardado(async (d) => { guardados.push(d); }, { espera: 60000 });
    auto.programar('cambio-pendiente');
    const detalle = { promesas: [] };
    win.dispatchEvent(new CustomEvent(EVENTO_GUARDAR_TODO, { detail: detalle }));
    await Promise.allSettled(detalle.promesas);
    assert.deepEqual(guardados, ['cambio-pendiente']);
    auto.destruir();
  } finally {
    delete globalThis.window;
  }
});

// ---------- precarga del procesador de PDF en el service worker (Etapa 19) ----------
test('SW: precarga y sirve el procesador worker de PDF para funcionamiento sin conexión', async () => {
  const archivos = ['assets/pdf.worker.js', 'assets/index.js', 'index.html'];
  const e = entornoSW(archivos);
  await e.esperar('install');

  // Comprobar que el worker de PDF quedó almacenado en la caché
  const cacheUrls = e.almacenes[e.cache];
  assert.ok(cacheUrls.includes('https://ejemplo.test/notas/assets/pdf.worker.js'), 'El worker de PDF debe precachearse');

  // Comprobar que una petición offline al worker se responde directamente desde la caché local sin red
  const respuestaWorker = await e.pedir({
    method: 'GET',
    mode: 'cors',
    url: 'https://ejemplo.test/notas/assets/pdf.worker.js',
  });
  assert.ok(respuestaWorker);
  assert.equal(respuestaWorker.desdeCache, 'https://ejemplo.test/notas/assets/pdf.worker.js');
  assert.equal(e.llamadas.fetch.length, 0, 'No debe realizar ninguna petición de red');
});
