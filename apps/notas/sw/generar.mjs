// Generación del service worker a partir de la plantilla y de los archivos compilados.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Lista (con rutas relativas y «/») de todos los archivos de una carpeta, ordenada.
// Se omiten los .woff: cada tipografía ya trae su .woff2, que es el que usan todos los navegadores actuales.
export function listarArchivos(carpeta, excluir = ['sw.js']) {
  const salida = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else {
        const rel = relative(carpeta, ruta).split(sep).join('/');
        if (!excluir.includes(rel) && !rel.endsWith('.woff')) salida.push(rel);
      }
    }
  };
  recorrer(carpeta);
  return salida.sort();
}

// Devuelve el texto del service worker. La versión cambia si cambia cualquier archivo de la app.
export function generarSW(plantilla, archivos, leer) {
  const hash = createHash('sha256');
  for (const a of archivos) { hash.update(a); hash.update(leer(a)); }
  const version = hash.digest('hex').slice(0, 12);
  const lista = archivos.map((a) => (a === 'index.html' ? './' : './' + a));
  if (!lista.includes('./index.html')) lista.push('./index.html');
  if (!plantilla.includes("const VERSION = '__VERSION__';") || !plantilla.includes('const ARCHIVOS = __ARCHIVOS__;')) {
    throw new Error('La plantilla del service worker no tiene los marcadores esperados.');
  }
  return plantilla
    .replace("const VERSION = '__VERSION__';", () => `const VERSION = '${version}';`)
    .replace('const ARCHIVOS = __ARCHIVOS__;', () => `const ARCHIVOS = ${JSON.stringify(lista, null, 2)};`);
}

// Plugin de Vite: al terminar la compilación escribe dist/sw.js.
export function pluginServiceWorker(rutaPlantilla) {
  let carpetaSalida = 'dist';
  return {
    name: 'anotomia-service-worker',
    apply: 'build',
    configResolved(cfg) {
      const out = cfg.build?.outDir || 'dist';
      if (cfg.root && existsSync(join(cfg.root, out))) {
        carpetaSalida = join(cfg.root, out);
      } else if (existsSync(join(process.cwd(), out))) {
        carpetaSalida = join(process.cwd(), out);
      } else {
        carpetaSalida = join(process.cwd(), out);
      }
    },
    closeBundle() {
      if (!existsSync(carpetaSalida)) return;
      const archivos = listarArchivos(carpetaSalida);
      const texto = generarSW(readFileSync(rutaPlantilla, 'utf-8'), archivos, (a) => readFileSync(join(carpetaSalida, a)));
      writeFileSync(join(carpetaSalida, 'sw.js'), texto);
    },
  };
}
