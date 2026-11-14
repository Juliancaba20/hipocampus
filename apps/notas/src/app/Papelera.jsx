import { useCallback, useEffect, useState } from 'react';
import { listarDocumentos, restaurarDePapelera, borrarDocumentoDefinitivo, vaciarPapelera } from '../almacen/index.js';
import { Confirmar } from './Modal.jsx';
import { Miniatura } from './SelectorFormato.jsx';
import { NOMBRE_FORMATO } from './utiles.js';

const DIAS = 30;
const diasRestantes = (t) => Math.max(0, DIAS - Math.floor((Date.now() - t) / 86400000));

export default function Papelera({ volver, avisarCambio }) {
  const [docs, setDocs] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { tipo, doc }
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try { setDocs(await listarDocumentos({ papelera: true })); avisarCambio(); } catch (e) { setError(e.message); setDocs([]); }
  }, [avisarCambio]);
  useEffect(() => {
    let activo = true;
    listarDocumentos({ papelera: true })
      .then((lista) => { if (activo) setDocs(lista); })
      .catch((e) => { if (activo) { setError(e.message); setDocs([]); } });
    return () => { activo = false; };
  }, []);

  async function restaurar(d) { await restaurarDePapelera(d); await recargar(); }
  async function confirmado() {
    const { tipo, doc } = confirmar;
    setConfirmar(null);
    if (tipo === 'uno') await borrarDocumentoDefinitivo(doc.id); else await vaciarPapelera();
    await recargar();
  }

  return (
    <div className="nt-pantalla">
      <header className="nt-cabecera">
        <button className="nt-btn" onClick={volver}>Volver</button>
        <div className="nt-logo">Papelera</div>
        <button className="nt-btn nt-btn--peligro-suave" disabled={!docs?.length} onClick={() => setConfirmar({ tipo: 'todo' })}>Vaciar papelera</button>
      </header>
      <main className="nt-biblioteca">
        <p className="nt-texto-suave">Las notas se eliminan definitivamente a los {DIAS} días de estar aquí.</p>
        {error && <p className="nt-aviso" role="alert">{error}</p>}
        {docs === null ? <p className="nt-texto-suave">Cargando…</p> : docs.length === 0 ? (
          <div className="nt-vacio"><p className="nt-sub">La papelera está vacía</p></div>
        ) : (
          <ul className="nt-items nt-items--lista">
            {docs.map((d) => (
              <li className="nt-item nt-item--papelera" key={d.id}>
                <div className="nt-item__abrir" style={{ cursor: 'default' }}>
                  <Miniatura formato={d.formato} />
                  <span className="nt-item__datos"><strong>{d.titulo}</strong><span>{NOMBRE_FORMATO[d.formato]} · se elimina en {diasRestantes(d.papelera)} días</span></span>
                </div>
                <div className="nt-fila nt-item__acciones">
                  <button className="nt-btn" onClick={() => restaurar(d)}>Restaurar</button>
                  <button className="nt-btn nt-btn--peligro-suave" onClick={() => setConfirmar({ tipo: 'uno', doc: d })}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      {confirmar && (
        <Confirmar
          titulo={confirmar.tipo === 'uno' ? 'Eliminar para siempre' : 'Vaciar la papelera'}
          texto={confirmar.tipo === 'uno' ? `«${confirmar.doc.titulo}» se eliminará definitivamente y no podrá recuperarse.` : 'Todas las notas de la papelera se eliminarán definitivamente y no podrán recuperarse.'}
          textoBoton="Eliminar" alConfirmar={confirmado} alCerrar={() => setConfirmar(null)} />
      )}
    </div>
  );
}
