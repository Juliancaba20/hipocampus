import { Children } from 'react';
import { VIGENCIA } from '../lib/legal';

// Estructura común de las páginas legales.
// Cada título «h2» y lo que le sigue forman una tarjeta; las tarjetas se acomodan en dos columnas continuas en pantallas anchas.
// Las páginas siguen escribiéndose igual que antes: una lista plana de h2, párrafos, listas y tablas.
function agruparEnSecciones(children) {
  const grupos = [];
  Children.toArray(children).forEach((hijo) => {
    if (hijo?.type === 'h2' || grupos.length === 0) grupos.push([hijo]);
    else grupos[grupos.length - 1].push(hijo);
  });
  return grupos;
}

export default function Documento({ titulo, resumen, children }) {
  const grupos = agruparEnSecciones(children);
  return (
    <main className="page">
      <header className="top legal-top">
        <h1>{titulo}</h1>
        <p className="sub">{resumen}</p>
      </header>
      <article className="legal">
        <p className="nota"><strong>Última actualización:</strong> {VIGENCIA}.</p>
        {grupos.map((grupo, i) => (
          <section key={i} className="legal-sec">{grupo}</section>
        ))}
      </article>
    </main>
  );
}
