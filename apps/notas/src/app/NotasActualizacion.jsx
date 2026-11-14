import { NOTAS_ACTUALIZACION, versionVisible } from './notasActualizacion.js';

// Lista de notas de actualización. Se usa en la ventana «Novedades» y en la pestaña de la ayuda.
export default function NotasActualizacion({ notas = NOTAS_ACTUALIZACION, soloUltima = false }) {
  const lista = soloUltima ? notas.slice(0, 1) : notas;
  return (
    <div className="nt-novedades">
      {lista.map((n) => (
        <section key={n.version} className="nt-novedades__version" aria-label={`Versión ${versionVisible(n.version)}`}>
          <header className="nt-novedades__cabecera">
            <span className="nt-novedades__etiqueta">Versión {versionVisible(n.version)}</span>
            <span className="nt-novedades__fecha">{n.fecha}</span>
          </header>
          <h3 className="nt-novedades__titulo">{n.titulo}</h3>
          <p className="nt-novedades__resumen">{n.resumen}</p>
          {n.secciones.map((s) => (
            <div key={s.titulo} className="nt-novedades__seccion">
              <h4>{s.titulo}</h4>
              <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
