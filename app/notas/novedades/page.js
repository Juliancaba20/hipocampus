import Link from 'next/link';
import NotasDeVersion from '../../NotasDeVersion';
// Misma fuente única que usa la ventana «Novedades» de la app: al publicar una versión nueva en
// apps/notas/src/app/notasActualizacion.js, esta página se actualiza sola.
import { NOTAS_ACTUALIZACION, versionVisible } from '../../../apps/notas/src/app/notasActualizacion.js';

export const viewport = { themeColor: '#1d4ed8' };

export const metadata = {
  title: 'Anotomía: notas de la versión',
  description: 'Todo lo que trae cada versión de Anotomía: novedades, mejoras y correcciones.',
};

export default function NovedadesNotas() {
  const notas = NOTAS_ACTUALIZACION.map((n) => ({ ...n, etiqueta: versionVisible(n.version) }));
  return (
    <main className="page" data-tema="notas">
      <header className="top legal-top">
        <p className="migas"><Link href="/notas">← Anotomía</Link></p>
        <h1>Notas de la versión</h1>
        <p className="sub">Novedades, mejoras y correcciones de cada versión de Anotomía, de la más reciente a la más antigua.</p>
      </header>
      <NotasDeVersion notas={notas} />
    </main>
  );
}
