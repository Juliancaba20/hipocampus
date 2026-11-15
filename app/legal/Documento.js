import { VIGENCIA } from '../lib/legal';

// Estructura común de las páginas legales.
export default function Documento({ titulo, resumen, children }) {
  return (
    <main className="page">
      <header className="top legal-top">
        <h1>{titulo}</h1>
        <p className="sub">{resumen}</p>
      </header>
      <article className="legal">
        <p className="nota"><strong>Última actualización:</strong> {VIGENCIA}.</p>
        {children}
      </article>
    </main>
  );
}
