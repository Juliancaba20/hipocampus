import Link from 'next/link';
import NotasDeVersion from '../../NotasDeVersion';
import { NOTAS_TECLADO } from '../novedades';

export const viewport = { themeColor: '#b8351f' };

export const metadata = {
  title: 'Teclado Científico: notas de la versión',
  description: 'Todo lo que trae cada versión del Teclado Científico: novedades, mejoras y correcciones.',
};

export default function NovedadesTeclado() {
  return (
    <main className="page" data-tema="teclado">
      <header className="top legal-top">
        <p className="migas"><Link href="/teclado">← Teclado Científico</Link></p>
        <h1>Notas de la versión</h1>
        <p className="sub">Novedades, mejoras y correcciones de cada versión del Teclado Científico, de la más reciente a la más antigua.</p>
      </header>
      {NOTAS_TECLADO.length > 0 ? (
        <NotasDeVersion notas={NOTAS_TECLADO} />
      ) : (
        <section className="src nv-vacio" style={{ paddingTop: '2rem' }}>
          <p>Todavía no hay notas de versión publicadas. Aparecerán aquí a partir de la próxima versión.</p>
          <Link className="btn" href="/teclado">Volver al Teclado Científico</Link>
        </section>
      )}
    </main>
  );
}
