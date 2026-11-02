'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CARRERAS } from './carreras';
import { calcular, formatear, leerEntrada, leerNota, NOTA_APROBACION } from './calculo';

// Las notas se guardan solo en el navegador de cada persona (sin cuentas ni servidor).
// Los interruptores del CBC y del inglés NO se guardan: cada vez que se entra a la página vienen desactivados.
const CLAVE = 'hipocampus-promedio-v1';

function nuevoId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function Calculadora() {
  const [cargado, setCargado] = useState(false);
  const [carreraId, setCarreraId] = useState(CARRERAS[0].id);
  const [datos, setDatos] = useState({}); // { [idCarrera]: { materias: {...}, propias: [...] } }
  const [incluir, setIncluir] = useState({}); // bloques opcionales activados (siempre arranca vacío)
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [bloqueNuevo, setBloqueNuevo] = useState('');

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (g && typeof g === 'object') {
        if (CARRERAS.some((c) => c.id === g.carrera)) setCarreraId(g.carrera);
        if (g.datos && typeof g.datos === 'object') setDatos(g.datos);
      }
    } catch {
      // Almacenamiento bloqueado o dañado: se empieza vacío.
    }
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ carrera: carreraId, datos }));
    } catch {
      // Sin espacio o bloqueado: la calculadora sigue funcionando, pero no recuerda las notas.
    }
  }, [cargado, carreraId, datos]);

  const carrera = CARRERAS.find((c) => c.id === carreraId) ?? CARRERAS[0];
  const guardado = datos[carrera.id] ?? {};
  const materiasGuardadas = guardado.materias && typeof guardado.materias === 'object' ? guardado.materias : {};
  const propias = Array.isArray(guardado.propias) ? guardado.propias.filter((p) => p && p.id && p.nombre) : [];
  const resultado = calcular(carrera, propias, materiasGuardadas, incluir);
  const bloquesFijos = carrera.bloques.filter((b) => !b.opcional);
  const bloqueParaNueva = bloquesFijos.some((b) => b.id === bloqueNuevo) ? bloqueNuevo : bloquesFijos[0].id;

  function cambiarCarrera(id) {
    setCarreraId(id);
    setIncluir({});
    setNombreNuevo('');
    setBloqueNuevo('');
  }

  function actualizar(fn) {
    setDatos((prev) => {
      const actual = prev[carrera.id] ?? {};
      const base = {
        materias: actual.materias && typeof actual.materias === 'object' ? actual.materias : {},
        propias: Array.isArray(actual.propias) ? actual.propias : [],
      };
      return { ...prev, [carrera.id]: fn(base) };
    });
  }
  function cambiarMateria(id, fn) {
    actualizar((c) => ({ ...c, materias: { ...c.materias, [id]: fn(leerEntrada(c.materias[id])) } }));
  }
  const ponerNota = (id, i, texto) =>
    cambiarMateria(id, (e) => ({ ...e, notas: e.notas.map((t, k) => (k === i ? texto.replace(/\D/g, '') : t)) }));
  const agregarNota = (id) => cambiarMateria(id, (e) => ({ ...e, notas: [...e.notas, ''] }));
  const quitarNota = (id, i) =>
    cambiarMateria(id, (e) => {
      const notas = e.notas.filter((_, k) => k !== i);
      return { ...e, notas: notas.length ? notas : [''] };
    });

  function agregarPropia(ev) {
    ev.preventDefault();
    const nombre = nombreNuevo.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!nombre) return;
    actualizar((c) => ({ ...c, propias: [...c.propias, { id: nuevoId(), nombre, bloque: bloqueParaNueva }] }));
    setNombreNuevo('');
  }
  function quitarPropia(id) {
    actualizar((c) => {
      const materias = { ...c.materias };
      delete materias[id];
      return { ...c, materias, propias: c.propias.filter((p) => p.id !== id) };
    });
  }
  function borrarTodo() {
    if (!window.confirm('¿Borrar todas las notas y materias agregadas de esta carrera? Esta acción no se puede deshacer.')) return;
    setDatos((prev) => {
      const siguiente = { ...prev };
      delete siguiente[carrera.id];
      return siguiente;
    });
  }

  // Se llama como función (no como componente) para que los campos no se vuelvan a crear en cada tecla y conserven el foco.
  function filaMateria(m, propia) {
    const e = leerEntrada(materiasGuardadas[m.id]);
    const hayError = e.notas.some((t) => leerNota(t).error);
    return (
      <li className="pm-materia" key={m.id}>
        <div className="pm-info">
          <p className="pm-nombre">{m.nombre}</p>
          {propia && (
            <button type="button" className="pm-mini pm-quitar" onClick={() => quitarPropia(m.id)}>
              Quitar esta materia
            </button>
          )}
        </div>
        <div className="pm-notas" role="group" aria-label={`Notas de ${m.nombre}`}>
          {e.notas.map((t, i) => {
            const r = leerNota(t);
            const clase = 'pm-nota' + (r.n !== undefined && r.n < NOTA_APROBACION ? ' pm-aplazo' : '');
            return (
              <span className="pm-nw" key={i}>
                <input
                  className={clase}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={2}
                  value={t}
                  placeholder={i === 0 ? 'Nota' : `Nota ${i + 1}`}
                  aria-label={`${m.nombre}: nota ${i + 1}`}
                  aria-invalid={r.error ? 'true' : undefined}
                  onChange={(ev) => ponerNota(m.id, i, ev.target.value)}
                />
                {i > 0 && (
                  <button type="button" className="pm-x" aria-label={`Quitar la nota ${i + 1} de ${m.nombre}`} onClick={() => quitarNota(m.id, i)}>
                    ×
                  </button>
                )}
              </span>
            );
          })}
          <button type="button" className="pm-mini" onClick={() => agregarNota(m.id)}>
            + Otra nota
          </button>
        </div>
        {hayError && (
          <small className="pm-error" role="alert">
            Escriba la nota final como un número entero del 0 al 10. Esa nota no se tiene en cuenta hasta corregirla.
          </small>
        )}
      </li>
    );
  }

  return (
    <div className="pm-raiz">
    <div className="grid">
      <aside aria-label="Carrera, opciones y resultado">
        <h2>Carrera</h2>
        <select className="pm-select" value={carrera.id} onChange={(ev) => cambiarCarrera(ev.target.value)} aria-label="Carrera">
          {CARRERAS.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
          <option disabled>Más carreras: próximamente</option>
        </select>

        {carrera.bloques.some((b) => b.opcional) && (
          <>
            <h2>Incluir en el promedio</h2>
            <div className="pm-opciones">
              {carrera.bloques.filter((b) => b.opcional).map((b) => (
                <label className="pm-check" key={b.id}>
                  <input
                    type="checkbox"
                    checked={incluir[b.id] === true}
                    onChange={(ev) => setIncluir((prev) => ({ ...prev, [b.id]: ev.target.checked }))}
                  />
                  <span>{b.opcional.etiqueta}<small>{b.opcional.ayuda}</small></span>
                </label>
              ))}
            </div>
          </>
        )}

        <h2>Promedio</h2>
        <div className="pm-resultado" aria-live="polite">
          <p className="pm-promedio">{resultado.promedio === null ? '—' : formatear(resultado.promedio)}</p>
          {resultado.promedio === null ? (
            <p className="mut">Cargue al menos una nota para ver el promedio.</p>
          ) : (
            <ul className="pm-datos">
              <li>{resultado.cantidadNotas} {resultado.cantidadNotas === 1 ? 'nota' : 'notas'} en {resultado.materiasConNota} {resultado.materiasConNota === 1 ? 'materia' : 'materias'}</li>
              <li>{resultado.aplazos} {resultado.aplazos === 1 ? 'nota menor' : 'notas menores'} a {NOTA_APROBACION}</li>
            </ul>
          )}
        </div>

        <button type="button" className="pm-mini pm-borrar" onClick={borrarTodo}>Borrar todas las notas</button>
      </aside>

      <section aria-label="Materias y notas">
        <div className="note" role="note">
          <p><b>Habrá más carreras próximamente.</b> Por ahora está disponible Medicina (UBA). ¿Quiere que se agregue la suya? <Link href="/contacto">Sugiérala aquí</Link>.</p>
        </div>

        {resultado.bloques.map(({ bloque, materias, promedio, conNota }) => (
          <section className="pm-grupo" key={bloque.id} aria-labelledby={`pm-${bloque.id}`}>
            <div className="pm-cab">
              <h2 id={`pm-${bloque.id}`}>{bloque.titulo}</h2>
              <span className="pm-pill">
                {promedio === null ? 'Sin notas' : `Promedio ${formatear(promedio)} · ${conNota} ${conNota === 1 ? 'materia' : 'materias'}`}
              </span>
            </div>
            {bloque.descripcion && <p className="mut pm-desc">{bloque.descripcion}</p>}
            <ul className="pm-materias">
              {materias.map((m) => filaMateria(m, propias.some((p) => p.id === m.id)))}
            </ul>
          </section>
        ))}

        <section className="pm-agregar" aria-labelledby="pm-agregar-t">
          <h2 className="t" id="pm-agregar-t">¿Falta una materia?</h2>
          <p>Agréguela y elija dónde mostrarla. Queda guardada solo en este navegador.</p>
          <form className="pm-form" onSubmit={agregarPropia}>
            <label>
              <span>Nombre de la materia</span>
              <input type="text" className="pm-texto" maxLength={80} value={nombreNuevo} onChange={(ev) => setNombreNuevo(ev.target.value)} placeholder="Por ejemplo, una optativa" />
            </label>
            <label>
              <span>Mostrar en</span>
              <select className="pm-select" value={bloqueParaNueva} onChange={(ev) => setBloqueNuevo(ev.target.value)}>
                {bloquesFijos.map((b) => (
                  <option key={b.id} value={b.id}>{b.titulo}</option>
                ))}
              </select>
            </label>
            <button className="btn pm-agregar-btn" type="submit" disabled={!nombreNuevo.trim()}>Agregar materia</button>
          </form>
        </section>
      </section>
    </div>
    {/* Solo en pantallas chicas: el promedio queda a la vista mientras se cargan las notas (el resultado completo está arriba). */}
    <div className="pm-barra" aria-hidden="true">
      <span>Promedio</span>
      <b>{resultado.promedio === null ? '—' : formatear(resultado.promedio)}</b>
    </div>
    </div>
  );
}
