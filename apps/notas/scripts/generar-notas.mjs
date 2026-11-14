// Genera NOTAS_DE_ACTUALIZACION.md a partir de src/app/notasActualizacion.js (fuente única).
// Uso: npm run notas
import { writeFileSync } from 'node:fs';
import { notasEnMarkdown } from '../src/app/notasActualizacion.js';
writeFileSync(new URL('../NOTAS_DE_ACTUALIZACION.md', import.meta.url), '# Notas de actualización de Anotomía\n\n' + notasEnMarkdown() + '\n');
console.log('NOTAS_DE_ACTUALIZACION.md actualizado');
