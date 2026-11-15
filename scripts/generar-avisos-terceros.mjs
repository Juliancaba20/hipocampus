// Regenera THIRD_PARTY_NOTICES.md a partir de las dependencias instaladas (sitio y Anotomía).
// Uso (desde la raíz, con `npm ci` hecho en la raíz y en apps/notas): node scripts/generar-avisos-terceros.mjs
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const PROYECTOS = [['Sitio web (Next.js)', '.'], ['Anotomía', 'apps/notas']];
const grupos = new Map();

for (const [proyecto, cwd] of PROYECTOS) {
  const arbol = JSON.parse(execSync('npm ls --omit=dev --all --json', { cwd, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }) || '{}');
  const nombres = new Map();
  (function recorrer(d) { for (const [n, v] of Object.entries(d.dependencies || {})) { nombres.set(n, v.version); recorrer(v); } })(arbol);
  for (const [nombre, version] of [...nombres].sort()) {
    const base = path.join(cwd, 'node_modules', nombre);
    const pj = path.join(base, 'package.json');
    if (!existsSync(pj)) continue;
    const j = JSON.parse(readFileSync(pj, 'utf8'));
    const licencia = j.license || String(j.licenses || 'ver paquete');
    const archivo = readdirSync(base).find((f) => /^(licen[sc]e|copying)/i.test(f));
    const texto = archivo ? readFileSync(path.join(base, archivo), 'utf8').trim() : '';
    const clave = createHash('sha256').update(licencia + texto).digest('hex');
    if (!grupos.has(clave)) grupos.set(clave, { licencia, texto, paquetes: [] });
    grupos.get(clave).paquetes.push(`${nombre}@${version} (${proyecto})`);
  }
}

let md = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
const inicio = md.indexOf('## Componentes cuya licencia se reproduce abajo');
const fin = md.indexOf('## Otros componentes');
if (inicio < 0 || fin < 0) throw new Error('No se encontraron las marcas de THIRD_PARTY_NOTICES.md');
let bloque = '## Componentes cuya licencia se reproduce abajo\n\n';
for (const g of [...grupos.values()].sort((a, b) => a.licencia.localeCompare(b.licencia))) {
  bloque += `### ${g.licencia}\n\nPaquetes: ${g.paquetes.sort().join(', ')}\n\n\`\`\`text\n${g.texto || '(El paquete no incluye archivo de licencia; ver su repositorio.)'}\n\`\`\`\n\n`;
}
writeFileSync('THIRD_PARTY_NOTICES.md', md.slice(0, inicio) + bloque + md.slice(fin));
console.log(`THIRD_PARTY_NOTICES.md actualizado (${grupos.size} licencias distintas).`);
