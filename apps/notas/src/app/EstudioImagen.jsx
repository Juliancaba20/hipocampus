// Modo estudio interactivo de imagen con oclusión (Etapa 22B)
// Funciona en tarjetas, pizarrón y páginas para repasar diagramas y esquemas anatómicos.
// Soporta los dos modos de estudio requeridos:
// - «ocultar todas»: se tapan todas las máscaras y se revelan al tocar una por una
// - «ocultar una»: se tapa una máscara a la vez para estudiar con contexto y se avanza
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { imagenEnCache, liberarImagenesCanvas } from '../herramientas/imagenes/recursos.js';
import { trazarFiguraMascara } from '../lienzo/oclusion.js';

export default function EstudioImagen({ imagen, onSalir }) {
  const canvasRef = useRef(null);
  const escenarioRef = useRef(null);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });

  const mascaras = useMemo(() => (Array.isArray(imagen?.datos?.mascaras) ? imagen.datos.mascaras : []), [imagen]);

  // Modo de oclusión: 'todas' | 'una'
  const [modoOclusion, setModoOclusion] = useState('todas');
  const [reveladas, setReveladas] = useState(() => new Set());
  const [indiceUna, setIndiceUna] = useState(0);

  const total = mascaras.length;

  // Medida del escenario disponible
  useEffect(() => {
    const el = escenarioRef.current;
    if (!el) return undefined;
    const medir = () => setTamano({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => liberarImagenesCanvas(canvasRef.current), []);

  // Revelar o tapar todas
  const revelarTodas = useCallback(() => {
    setReveladas(new Set(mascaras.map((m) => m.id)));
  }, [mascaras]);

  const reiniciar = useCallback(() => {
    setReveladas(new Set());
  }, []);

  const avanzarUna = useCallback(() => {
    setIndiceUna((i) => Math.min(total - 1, i + 1));
    setReveladas(new Set());
  }, [total]);

  const retrocederUna = useCallback(() => {
    setIndiceUna((i) => Math.max(0, i - 1));
    setReveladas(new Set());
  }, []);

  // Atajos de teclado
  useEffect(() => {
    function alTecla(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSalir();
        return;
      }
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setModoOclusion((m) => (m === 'todas' ? 'una' : 'todas'));
        setReveladas(new Set());
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        revelarTodas();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reiniciar();
        return;
      }
      if (modoOclusion === 'una') {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          avanzarUna();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          retrocederUna();
        }
      }
    }
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [onSalir, modoOclusion, revelarTodas, reiniciar, avanzarUna, retrocederUna]);

  // Dibujar imagen y máscaras interactivas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagen || !tamano.ancho || !tamano.alto) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgCargada = imagenEnCache(imagen.datos.blobId, canvas, () => {
      setTamano((t) => ({ ...t }));
    });

    const w = tamano.ancho;
    const h = tamano.alto;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (imgCargada) {
      const iw = imgCargada.naturalWidth || imgCargada.width || w;
      const ih = imgCargada.naturalHeight || imgCargada.height || h;
      const factorEscala = Math.min((w - 40) / iw, (h - 40) / ih);
      const dw = Math.round(iw * factorEscala);
      const dh = Math.round(ih * factorEscala);
      const dx = Math.round((w - dw) / 2);
      const dy = Math.round((h - dh) / 2);

      // Marco de sombra para destacar la imagen sobre el fondo oscuro
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(imgCargada, dx, dy, dw, dh);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Dibujar cada máscara
      mascaras.forEach((m, idx) => {
        const mx = dx + m.rx * dw;
        const my = dy + m.ry * dh;
        const mw = m.rw * dw;
        const mh = m.rh * dh;

        let tapada = true;
        let esObjetivoActivo = false;

        if (modoOclusion === 'todas') {
          tapada = !reveladas.has(m.id);
        } else {
          esObjetivoActivo = idx === indiceUna;
          tapada = esObjetivoActivo && !reveladas.has(m.id);
        }

        trazarFiguraMascara(ctx, mx, my, mw, mh, m.forma);

        if (tapada) {
          // Máscara tapada: caja opaca
          const fondo = esObjetivoActivo ? '#ea580c' : (m.color || '#2563eb');
          ctx.fillStyle = fondo;
          ctx.fill();

          ctx.strokeStyle = esObjetivoActivo ? '#c2410c' : '#1d4ed8';
          ctx.lineWidth = esObjetivoActivo ? 3 : 1.5;
          ctx.stroke();

          // Número de etiqueta
          const badge = `[${idx + 1}]`;
          const tamTexto = Math.max(10, Math.min(16, Math.floor(mh * 0.55)));
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${tamTexto}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badge, mx + mw / 2, my + mh / 2, Math.max(10, mw - 6));
        } else {
          // Máscara revelada
          if (modoOclusion === 'una' && !esObjetivoActivo) {
            // Contexto visual de las demás máscaras
            ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.stroke();
            ctx.setLineDash([]);

            if (m.texto) {
              const tamTexto = Math.max(9, Math.min(13, Math.floor(mh * 0.5)));
              ctx.fillStyle = '#93c5fd';
              ctx.font = `500 ${tamTexto}px system-ui, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(m.texto, mx + mw / 2, my + mh / 2, Math.max(10, mw - 4));
            }
          } else {
            // Objetivo revelado en verde
            ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
            ctx.fill();
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 2]);
            ctx.stroke();
            ctx.setLineDash([]);

            const badge = m.texto ? m.texto : `[${idx + 1}]`;
            const tamTexto = Math.max(10, Math.min(15, Math.floor(mh * 0.55)));
            ctx.fillStyle = '#22c55e';
            ctx.font = `bold ${tamTexto}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badge, mx + mw / 2, my + mh / 2, Math.max(10, mw - 6));
          }
        }
      });
    }

    ctx.restore();
  }, [imagen, mascaras, tamano, modoOclusion, reveladas, indiceUna]);

  // Clic sobre máscara para revelar / tapar
  function alClic(e) {
    const canvas = canvasRef.current;
    if (!canvas || !imagen) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imgCargada = imagenEnCache(imagen.datos.blobId);
    if (!imgCargada) return;

    const w = tamano.ancho;
    const h = tamano.alto;
    const iw = imgCargada.naturalWidth || imgCargada.width || w;
    const ih = imgCargada.naturalHeight || imgCargada.height || h;
    const factorEscala = Math.min((w - 40) / iw, (h - 40) / ih);
    const dw = Math.round(iw * factorEscala);
    const dh = Math.round(ih * factorEscala);
    const dx = Math.round((w - dw) / 2);
    const dy = Math.round((h - dh) / 2);

    for (let i = mascaras.length - 1; i >= 0; i--) {
      const m = mascaras[i];
      const mx = dx + m.rx * dw;
      const my = dy + m.ry * dh;
      const mw = m.rw * dw;
      const mh = m.rh * dh;

      // Hit test según forma
      let impacto = false;
      if (m.forma === 'elipse') {
        const cx = mx + mw / 2;
        const cy = my + mh / 2;
        const rx = mw / 2;
        const ry = mh / 2;
        if (rx > 0 && ry > 0) {
          impacto = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
        }
      } else {
        impacto = x >= mx && x <= mx + mw && y >= my && y <= my + mh;
      }

      if (impacto) {
        if (modoOclusion === 'todas') {
          setReveladas((prev) => {
            const sig = new Set(prev);
            if (sig.has(m.id)) sig.delete(m.id);
            else sig.add(m.id);
            return sig;
          });
        } else if (i === indiceUna) {
          setReveladas((prev) => {
            const sig = new Set(prev);
            if (sig.has(m.id)) sig.delete(m.id);
            else sig.add(m.id);
            return sig;
          });
        }
        return;
      }
    }
  }

  const cantidadReveladas = reveladas.size;

  return (
    <div
      className="nt-estudio"
      role="dialog"
      aria-modal="true"
      aria-label="Modo estudio de oclusión de imagen"
      tabIndex={-1}
    >
      <header className="nt-estudio__cab" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="nt-estudio__titulo" style={{ fontWeight: 600 }}>
            {imagen.datos?.nombre || 'Oclusión de imagen'}
          </span>
          <span className="nt-estudio__indicador" aria-live="polite">
            {modoOclusion === 'todas'
              ? `${total} máscaras • ${cantidadReveladas} reveladas`
              : `Máscara ${indiceUna + 1} de ${total}`}
          </span>
        </div>

        {/* Selector de modo: Ocultar todas vs Ocultar una */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(30, 41, 59, 0.7)', padding: '3px 6px', borderRadius: '20px' }}>
          <button
            type="button"
            className={`nt-btn ${modoOclusion === 'todas' ? 'nt-btn--activo' : ''}`}
            style={{ fontSize: '12px', padding: '3px 10px' }}
            onClick={() => { setModoOclusion('todas'); setReveladas(new Set()); }}
            title="Tapar todas las máscaras para estudiarlas en conjunto"
          >
            Ocultar todas
          </button>
          <button
            type="button"
            className={`nt-btn ${modoOclusion === 'una' ? 'nt-btn--activo' : ''}`}
            style={{ fontSize: '12px', padding: '3px 10px' }}
            onClick={() => { setModoOclusion('una'); setReveladas(new Set()); }}
            title="Tapar una sola máscara por turno para estudiar con contexto"
          >
            Ocultar una
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {modoOclusion === 'una' && (
            <>
              <button
                type="button"
                className="nt-btn"
                disabled={indiceUna <= 0}
                onClick={retrocederUna}
                title="Máscara anterior (Flecha izquierda)"
              >
                Anterior
              </button>
              <button
                type="button"
                className="nt-btn"
                disabled={indiceUna >= total - 1}
                onClick={avanzarUna}
                title="Máscara siguiente (Espacio o Flecha derecha)"
              >
                Siguiente
              </button>
            </>
          )}

          {modoOclusion === 'todas' && (
            <button
              type="button"
              className="nt-btn"
              onClick={cantidadReveladas < total ? revelarTodas : reiniciar}
              title="Revelar todas las máscaras (Tecla A) o reiniciar (Tecla R)"
            >
              {cantidadReveladas < total ? <>Revelar todas (A)</> : <>Reiniciar (R)</>}
            </button>
          )}

          <button
            type="button"
            className="nt-btn"
            onClick={onSalir}
            aria-label="Salir del modo estudio"
          >
            Salir (Esc)
          </button>
        </div>
      </header>

      <div
        ref={escenarioRef}
        className="nt-estudio__escenario"
        onClick={alClic}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <canvas ref={canvasRef} className="nt-estudio__tarjeta" aria-label="Lienzo de estudio de oclusión" />
      </div>
    </div>
  );
}
