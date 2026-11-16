'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { REPO, ARCHIVOS, urlUltima } from './config';
import { NOTAS_TECLADO } from './novedades';

const SISTEMAS = [
  { id: 'windows', nombre: 'Windows', detalle: 'Archivo .exe, se abre con doble clic' },
  { id: 'mac', nombre: 'Mac', detalle: 'Archivo .zip, para Mac con chip M1 o posterior. Versión en prueba' },
  { id: 'linux', nombre: 'Linux', detalle: 'Archivo .tar.gz, para escritorio con X11. Versión en prueba' },
];

function detectarSistema() {
  const ua = navigator.userAgent || '';
  const tactil = (navigator.maxTouchPoints || 0) > 1;
  if (/Android|iPhone|iPad|iPod/i.test(ua) || (tactil && /Mac/i.test(ua))) return null;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'mac';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return null;
}

// Las descargas funcionan sin JavaScript: los enlaces apuntan a "la última versión".
// Con JavaScript se busca además el número de versión publicado.
export default function Descargas() {
  const [so, setSo] = useState(null);
  const [version, setVersion] = useState(null);
  const [enlaces, setEnlaces] = useState({});

  useEffect(() => {
    setSo(detectarSistema());

    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 6000);
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: control.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((lista) => {
        // La primera publicación (la más reciente) que tenga archivos del teclado.
        for (const pub of lista) {
          if (pub.draft || pub.prerelease) continue;
          const urls = {};
          for (const [id, nombre] of Object.entries(ARCHIVOS)) {
            const a = (pub.assets || []).find((x) => x.name === nombre);
            if (a && String(a.browser_download_url).startsWith('https://github.com/')) urls[id] = a.browser_download_url;
          }
          if (!Object.keys(urls).length) continue;
          const m = String(pub.tag_name || '').match(/(\d+(?:\.\d+)+)\s*$/);
          if (m) setVersion(m[1]);
          setEnlaces(urls);
          break;
        }
      })
      .catch(() => {}) // sin conexión o límite de GitHub: quedan los enlaces a la última versión
      .finally(() => clearTimeout(espera));

    return () => { clearTimeout(espera); control.abort(); };
  }, []);

  return (
    <>
      <div className="descargas">
        {SISTEMAS.map((s) => (
          <a key={s.id} className={`descarga${so === s.id ? ' es-su-equipo' : ''}`} href={enlaces[s.id] || urlUltima(ARCHIVOS[s.id])}>
            <span>
              {so === s.id && <em className="recomendado">Recomendado para su equipo</em>}
              <b>{s.nombre}</b>
              <small>{s.detalle}</small>
            </span>
            <span className="boton">Descargar</span>
          </a>
        ))}
      </div>
      {(version || NOTAS_TECLADO.length > 0) && (
        <div className="version-fila">
          {version && <p className="mut version">Versión actual: <b>{version}</b></p>}
          {NOTAS_TECLADO.length > 0 && <Link className="mas" href="/teclado/novedades">Ver las notas de la versión</Link>}
        </div>
      )}
    </>
  );
}
