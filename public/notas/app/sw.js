// Service worker de Anotomía (Etapa 13). Se genera en la compilación (sw/generar.mjs): las dos constantes
// siguientes se completan con la huella del contenido y la lista de archivos de la app.
// No usa nada fuera de su propia carpeta.
const VERSION = '46349c01cc40';
const CACHE = 'anotomia-' + VERSION;
const ARCHIVOS = [
  "./assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2",
  "./assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2",
  "./assets/core-CwBWH9_g.js",
  "./assets/dist-js-BH310aLH.js",
  "./assets/dist-js-Bq4C-2Yy.js",
  "./assets/dist-js-DE9Ux1YK.js",
  "./assets/dist-js-MUY8iCit.js",
  "./assets/event-D6iU7675.js",
  "./assets/index-B7dDT4S4.css",
  "./assets/index-xLrJOTFR.js",
  "./assets/source-serif-4-greek-wght-italic-CUp-f2uw.woff2",
  "./assets/source-serif-4-greek-wght-normal-BpXpdlRW.woff2",
  "./assets/source-serif-4-latin-ext-wght-italic-B_cmBfNX.woff2",
  "./assets/source-serif-4-latin-ext-wght-normal-BVZ5su8S.woff2",
  "./assets/source-serif-4-latin-wght-italic-B-rCj6ir.woff2",
  "./assets/source-serif-4-latin-wght-normal-DMe4EKeb.woff2",
  "./favicon.svg",
  "./iconos/apple-touch-icon.png",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/icono-mascara-512.png",
  "./",
  "./manifest.webmanifest",
  "./index.html"
];
const BASE = new URL('./', self.location).href;
const INICIO = new URL('./index.html', BASE).href;

self.addEventListener('install', (evento) => {
  // No se llama a skipWaiting aquí: la versión nueva espera hasta que la persona acepte actualizar,
  // para no cambiar el código de la app en medio de una nota.
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS.map((a) => new Request(new URL(a, BASE).href, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k.startsWith('anotomia-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SALTAR_ESPERA') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return; // solo lo propio

  if (pedido.mode === 'navigate') {
    // La app es de una sola pantalla: cualquier navegación abre la copia guardada del inicio.
    evento.respondWith(caches.match(INICIO).then((r) => r || fetch(pedido)));
    return;
  }
  evento.respondWith(
    caches.match(pedido, { ignoreSearch: true }).then((r) => r || fetch(pedido)),
  );
});
