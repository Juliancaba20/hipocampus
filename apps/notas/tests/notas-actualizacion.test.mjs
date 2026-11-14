import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION_APP, NOTAS_ACTUALIZACION, notasEnMarkdown } from '../src/app/notasActualizacion.js';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

test('la versión de la app coincide con package.json y con la última nota', () => {
  const pkg = JSON.parse(leer('../package.json'));
  assert.equal(pkg.version, VERSION_APP);
  assert.equal(NOTAS_ACTUALIZACION[0].version, VERSION_APP);
});

test('cada versión tiene fecha, título, resumen y secciones con contenido', () => {
  const vistas = new Set();
  for (const n of NOTAS_ACTUALIZACION) {
    assert.ok(/^\d+\.\d+\.\d+$/.test(n.version), `versión inválida: ${n.version}`);
    assert.ok(!vistas.has(n.version), `versión repetida: ${n.version}`);
    vistas.add(n.version);
    for (const campo of ['fecha', 'titulo', 'resumen']) assert.ok(n[campo]?.trim(), `${n.version}: falta ${campo}`);
    assert.ok(n.secciones.length > 0);
    for (const s of n.secciones) {
      assert.ok(s.titulo && s.items.length > 0, `${n.version}: sección vacía`);
      for (const i of s.items) assert.ok(i.trim().length > 10 && i.length < 400, `texto dudoso: ${i}`);
    }
  }
});

test('NOTAS_DE_ACTUALIZACION.md está al día (ejecute «npm run notas» si falla)', () => {
  assert.equal(leer('../NOTAS_DE_ACTUALIZACION.md'), '# Notas de actualización de Anotomía\n\n' + notasEnMarkdown() + '\n');
});

test('la versión se muestra como «1.3» (sin «.0» final) y sigue el orden 1.2 → 1.3', async () => {
  const { versionVisible } = await import('../src/app/notasActualizacion.js');
  assert.equal(versionVisible('1.3.0'), '1.3');
  assert.equal(versionVisible('1.3.1'), '1.3.1');
  assert.equal(VERSION_APP, '1.3.0');
});
