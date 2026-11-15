// Lista de notas de versión, común a Anotomía (/notas/novedades) y al Teclado Científico (/teclado/novedades).
// Cada versión es un desplegable (la más reciente viene abierta) y sus secciones se reparten en columnas.
// Formato de cada versión: { version, etiqueta?, fecha, titulo, resumen, secciones: [{ titulo, items: [texto, …] }] }
export default function NotasDeVersion({ notas }) {
  return (
    <div className="nv">
      {notas.map((n, i) => (
        <details className="nv-version" key={n.version} open={i === 0}>
          <summary>
            <span className="nv-etiqueta">Versión {n.etiqueta || n.version}</span>
            <span className="nv-fecha">{n.fecha}</span>
          </summary>
          <div className="nv-cuerpo">
            <h2 className="nv-titulo">{n.titulo}</h2>
            {n.resumen && <p className="nv-resumen">{n.resumen}</p>}
            <div className="nv-secciones">
              {n.secciones.map((s) => (
                <section className="nv-seccion" key={s.titulo}>
                  <h3>{s.titulo}</h3>
                  <ul>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
                </section>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
