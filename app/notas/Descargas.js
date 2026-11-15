'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Mismos archivos que usa la app: repositorio, nombres de los programas, regla de qué sistema recibe qué y textos.
import {
  PROGRAMAS, urlDescarga, programaQueAdmite, consultarPublicacion, hayProgramaPublicado,
} from '../../apps/notas/src/pwa/escritorio.js';
import { PRIMERA_VEZ, ACTUALIZACION, NOTAS_DEL_NAVEGADOR } from '../../apps/notas/src/pwa/textosProgramas.js';

const URL_APP = '/notas/app/index.html';

const ORDEN = ['windows', 'mac', 'linux', 'android'];
const DETALLE = {
  windows: 'Archivo .exe para Windows 10 y 11 de 64 bits, se abre con doble clic',
  mac: 'Archivo .dmg para Mac con chip Apple o Intel',
  linux: 'Archivo .AppImage para Linux de 64 bits',
  android: 'Archivo .apk para celulares y tablets Android',
  online: 'Se usa en el navegador y se instala como aplicación, sin descargar archivos. Para iPad, iPhone y cualquier otro equipo',
};

function Tarjeta({ nombre, detalle, recomendada, href, boton, noDisponible }) {
  const contenido = (
    <>
      <span>
        {recomendada && <em className="recomendado">Recomendado para su equipo</em>}
        <b>{nombre}</b>
        <small>{noDisponible ? 'Todavía no está publicado. Disponible en la próxima versión.' : detalle}</small>
      </span>
      <span className="boton">{noDisponible ? 'No disponible todavía' : boton}</span>
    </>
  );
  if (noDisponible) return <div className="descarga no-disponible" aria-disabled="true">{contenido}</div>;
  return <a className={`descarga${recomendada ? ' es-su-equipo' : ''}`} href={href}>{contenido}</a>;
}

// Todas las versiones a la vista, como en el Teclado Científico: Windows, Mac, Linux, Android y la versión online.
// La de su dispositivo sale resaltada. Los enlaces funcionan sin JavaScript (apuntan a la publicación fija);
// con JavaScript se detecta el equipo y se consulta qué versiones están publicadas.
// La regla de qué dispositivo recibe qué está en apps/notas/src/pwa/escritorio.js.
export default function Descargas() {
  const [recomendada, setRecomendada] = useState(null); // 'windows' | 'mac' | 'linux' | 'android' | 'online'
  const [publicacion, setPublicacion] = useState(null); // null mientras se consulta

  useEffect(() => {
    setRecomendada(programaQueAdmite() || 'online'); // iPad, iPhone, Chromebook, Windows antiguo…: la versión online
    let vivo = true;
    consultarPublicacion().then((p) => { if (vivo) setPublicacion(p); });
    return () => { vivo = false; };
  }, []);

  return (
    <>
      <section className="src" style={{ paddingTop: '2rem' }}>
        <h2 className="t" style={{ marginTop: 0 }}>Descarga</h2>
        <p className="mut">Elija la versión para su dispositivo. En iPad, iPhone y cualquier otro equipo se usa la versión online, que también se instala como aplicación.</p>
      </section>

      <div className="descargas nt-descargas">
        {ORDEN.map((id) => (
          <Tarjeta
            key={id}
            nombre={PROGRAMAS[id].nombre}
            detalle={DETALLE[id]}
            recomendada={recomendada === id}
            href={urlDescarga(id)}
            boton="Descargar"
            noDisponible={!!publicacion && !hayProgramaPublicado(publicacion, id)}
          />
        ))}
        <Tarjeta
          nombre="Versión online"
          detalle={DETALLE.online}
          recomendada={recomendada === 'online'}
          href={recomendada === 'online' ? `${URL_APP}#instalar` : URL_APP}
          boton="Abrir Anotomía"
        />
      </div>
      <div className="version-fila">
        {publicacion?.version && <p className="mut version">Versión actual de los programas: <b>{publicacion.version}</b></p>}
        <Link className="mas" href="/notas/novedades">Ver las notas de la versión</Link>
      </div>

      <div className="dos-col nt-ayuda">
        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>La primera vez</h2>
          {ORDEN.map((id) => (
            <details key={id}>
              <summary>{PROGRAMAS[id].nombre}</summary>
              <ol>{PRIMERA_VEZ[id].map((paso) => <li key={paso}>{paso}</li>)}</ol>
            </details>
          ))}
          <details>
            <summary>iPad e iPhone (versión online)</summary>
            <ol>
              <li>Abra Anotomía en Safari (otros navegadores no permiten instalar en iPad).</li>
              <li>Pulse el botón Compartir, el cuadrado con una flecha hacia arriba.</li>
              <li>Elija «Agregar a pantalla de inicio» y luego «Agregar».</li>
            </ol>
          </details>
        </section>

        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>Actualizaciones y notas anteriores</h2>
          <p><b>Windows, Mac y Linux.</b> {ACTUALIZACION.computadora}</p>
          <p><b>Android.</b> {ACTUALIZACION.android}</p>
          <p><b>Versión online.</b> Se actualiza sola al abrirla con conexión a internet.</p>
          <p>{NOTAS_DEL_NAVEGADOR}</p>
        </section>
      </div>
    </>
  );
}
