// Editor visual de oclusión de imagen (Etapa 22B)
// Permite dibujar máscaras rectangulares y elípticas sobre una imagen,
// asignar etiquetas de texto opcionales y probar el modo estudio en tiempo real.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal.jsx';
import { nuevoId } from '../almacen/modelo.js';
import { imagenEnCache } from '../herramientas/imagenes/recursos.js';
import { sanearMascara, trazarFiguraMascara } from '../lienzo/oclusion.js';

export default function ModalOclusionImagen({ imagen, motorRef, alCerrar, alEstudiar }) {
  const motor = motorRef?.current;
  const canvasRef = useRef(null);

  // Lista de máscaras en edición local (con historial propio dentro del modal)
  const [mascaras, setMascaras] = useState(() => {
    const orig = Array.isArray(imagen?.datos?.mascaras) ? imagen.datos.mascaras : [];
    return orig.map((m, idx) => sanearMascara(m, idx)).filter(Boolean);
  });

  const [herramienta, setHerramienta] = useState('rectangulo'); // 'rectangulo' | 'elipse' | 'seleccionar'
  const [mascaraSelId, setMascaraSelId] = useState(null);

  // Modo de prueba de estudio dentro del modal
  const [modoPrueba, setModoPrueba] = useState(false);
  const [subModoEstudio, setSubModoEstudio] = useState('todas'); // 'todas' | 'una'
  const [reveladasPrueba, setReveladasPrueba] = useState(() => new Set());
  const [indiceUnaPrueba, setIndiceUnaPrueba] = useState(0);

  // Estado de interacción de arrastre en el canvas
  const arrastreRef = useRef(null);
  const [trazoTemp, setTrazoTemp] = useState(null);

  // Dimensiones calculadas del visor
  const [dimensionesVisor, setDimensionesVisor] = useState({ ancho: 680, alto: 460 });

  const mascaraSeleccionada = mascaras.find((m) => m.id === mascaraSelId);

  // Aplicar cambios a la imagen y guardar en el motor con historial
  const guardarCambios = useCallback((nuevasMascaras = mascaras) => {
    if (!motor || !imagen) return;
    motor.actualizarMascarasImagen(
      imagen.id,
      nuevasMascaras,
      `Modificar máscaras de oclusión (${nuevasMascaras.length})`,
    );
  }, [motor, imagen, mascaras]);

  // Añadir una nueva máscara
  const agregarMascara = useCallback((forma = herramienta === 'elipse' ? 'elipse' : 'rectangulo') => {
    const id = nuevoId();
    // Colocarla en el centro con un tamaño relativo razonable (20% ancho, 10% alto)
    const nueva = sanearMascara({
      id,
      forma,
      rx: 0.4,
      ry: 0.4,
      rw: 0.2,
      rh: 0.1,
      texto: `Etiqueta ${mascaras.length + 1}`,
      color: null,
    });
    const siguiente = [...mascaras, nueva];
    setMascaras(siguiente);
    setMascaraSelId(id);
    guardarCambios(siguiente);
  }, [herramienta, mascaras, guardarCambios]);

  // Actualizar una máscara existente
  const actualizarMascara = useCallback((id, parche) => {
    const siguiente = mascaras.map((m) => (m.id === id ? { ...m, ...parche } : m));
    setMascaras(siguiente);
    guardarCambios(siguiente);
  }, [mascaras, guardarCambios]);

  // Eliminar máscara
  const eliminarMascara = useCallback((id) => {
    const siguiente = mascaras.filter((m) => m.id !== id);
    setMascaras(siguiente);
    if (mascaraSelId === id) setMascaraSelId(null);
    guardarCambios(siguiente);
  }, [mascaras, mascaraSelId, guardarCambios]);

  // Eliminar todas las máscaras
  const limpiarTodas = useCallback(() => {
    if (!mascaras.length) return;
    setMascaras([]);
    setMascaraSelId(null);
    guardarCambios([]);
  }, [mascaras.length, guardarCambios]);

  // Dibujar en el canvas del modal
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgCargada = imagenEnCache(imagen.datos.blobId, canvas, () => {
      // Al terminar de cargar imagen, redibujar
      setDimensionesVisor((d) => ({ ...d }));
    });

    const dpr = window.devicePixelRatio || 1;
    const w = dimensionesVisor.ancho;
    const h = dimensionesVisor.alto;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Fondo neutro cuadriculado sutil
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    if (imgCargada) {
      const iw = imgCargada.naturalWidth || imgCargada.width || w;
      const ih = imgCargada.naturalHeight || imgCargada.height || h;
      const factorEscala = Math.min((w - 20) / iw, (h - 20) / ih);
      const dw = Math.round(iw * factorEscala);
      const dh = Math.round(ih * factorEscala);
      const dx = Math.round((w - dw) / 2);
      const dy = Math.round((h - dh) / 2);

      // Dibujar imagen
      ctx.drawImage(imgCargada, dx, dy, dw, dh);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, dw, dh);

      // Dibujar máscaras
      mascaras.forEach((m, idx) => {
        const mx = dx + m.rx * dw;
        const my = dy + m.ry * dh;
        const mw = m.rw * dw;
        const mh = m.rh * dh;

        const esSeleccionada = !modoPrueba && m.id === mascaraSelId;
        let tapada = true;
        let esObjetivoActivo = false;

        if (modoPrueba) {
          if (subModoEstudio === 'todas') {
            tapada = !reveladasPrueba.has(m.id);
          } else {
            esObjetivoActivo = idx === indiceUnaPrueba;
            tapada = esObjetivoActivo && !reveladasPrueba.has(m.id);
          }
        }

        trazarFiguraMascara(ctx, mx, my, mw, mh, m.forma);

        if (tapada) {
          // Máscara cubierta
          ctx.fillStyle = esObjetivoActivo ? '#ea580c' : (m.color || '#2563eb');
          ctx.fill();

          ctx.strokeStyle = esSeleccionada ? '#fbbf24' : (esObjetivoActivo ? '#c2410c' : '#1d4ed8');
          ctx.lineWidth = esSeleccionada ? 3 : (esObjetivoActivo ? 2.5 : 1.5);
          if (esSeleccionada) ctx.setLineDash([4, 2]);
          ctx.stroke();
          ctx.setLineDash([]);

          const textoBadge = modoPrueba ? `[${idx + 1}]` : (m.texto ? m.texto : `[${idx + 1}]`);
          const tamTexto = Math.max(9, Math.min(14, Math.floor(mh * 0.55)));
          ctx.fillStyle = '#ffffff';
          ctx.font = `600 ${tamTexto}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(textoBadge, mx + mw / 2, my + mh / 2, Math.max(10, mw - 6));
        } else {
          // Máscara revelada (modo prueba de estudio)
          if (subModoEstudio === 'una' && !esObjetivoActivo) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.stroke();
            ctx.setLineDash([]);

            if (m.texto) {
              const tamTexto = Math.max(8, Math.min(12, Math.floor(mh * 0.5)));
              ctx.fillStyle = '#1e40af';
              ctx.font = `500 ${tamTexto}px system-ui, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(m.texto, mx + mw / 2, my + mh / 2, Math.max(10, mw - 4));
            }
          } else {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.20)';
            ctx.fill();
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.stroke();
            ctx.setLineDash([]);

            const textoBadge = m.texto ? m.texto : `[${idx + 1}]`;
            const tamTexto = Math.max(9, Math.min(14, Math.floor(mh * 0.55)));
            ctx.fillStyle = '#15803d';
            ctx.font = `bold ${tamTexto}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(textoBadge, mx + mw / 2, my + mh / 2, Math.max(10, mw - 6));
          }
        }

        // Manijas de esquina si está seleccionada en modo edición
        if (esSeleccionada) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          const rH = 4;
          [
            [mx, my],
            [mx + mw, my],
            [mx + mw, my + mh],
            [mx, my + mh],
          ].forEach(([hx, hy]) => {
            ctx.fillRect(hx - rH, hy - rH, rH * 2, rH * 2);
            ctx.strokeRect(hx - rH, hy - rH, rH * 2, rH * 2);
          });
        }
      });

      // Máscara temporal mientras se dibuja con el ratón
      if (trazoTemp && !modoPrueba) {
        trazarFiguraMascara(ctx, trazoTemp.x, trazoTemp.y, trazoTemp.w, trazoTemp.h, herramienta);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cargando imagen...', w / 2, h / 2);
    }

    ctx.restore();
  }, [imagen, mascaras, mascaraSelId, modoPrueba, subModoEstudio, reveladasPrueba, indiceUnaPrueba, trazoTemp, herramienta, dimensionesVisor]);

  // Manejo de eventos de ratón sobre el canvas de oclusión
  function alBajar(e) {
    const canvas = canvasRef.current;
    if (!canvas || !imagen) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imgCargada = imagenEnCache(imagen.datos.blobId);
    if (!imgCargada) return;

    const w = dimensionesVisor.ancho;
    const h = dimensionesVisor.alto;
    const iw = imgCargada.naturalWidth || imgCargada.width || w;
    const ih = imgCargada.naturalHeight || imgCargada.height || h;
    const factorEscala = Math.min((w - 20) / iw, (h - 20) / ih);
    const dw = Math.round(iw * factorEscala);
    const dh = Math.round(ih * factorEscala);
    const dx = Math.round((w - dw) / 2);
    const dy = Math.round((h - dh) / 2);

    // Modo prueba de estudio: tocar sobre una máscara para revelarla
    if (modoPrueba) {
      for (let i = mascaras.length - 1; i >= 0; i--) {
        const m = mascaras[i];
        const mx = dx + m.rx * dw;
        const my = dy + m.ry * dh;
        const mw = m.rw * dw;
        const mh = m.rh * dh;
        if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
          if (subModoEstudio === 'todas') {
            setReveladasPrueba((prev) => {
              const sig = new Set(prev);
              if (sig.has(m.id)) sig.delete(m.id); else sig.add(m.id);
              return sig;
            });
          } else if (i === indiceUnaPrueba) {
            setReveladasPrueba((prev) => {
              const sig = new Set(prev);
              if (sig.has(m.id)) sig.delete(m.id); else sig.add(m.id);
              return sig;
            });
          }
          return;
        }
      }
      return;
    }

    // Modo selección / edición: detectar clic sobre máscara existente
    if (herramienta === 'seleccionar') {
      for (let i = mascaras.length - 1; i >= 0; i--) {
        const m = mascaras[i];
        const mx = dx + m.rx * dw;
        const my = dy + m.ry * dh;
        const mw = m.rw * dw;
        const mh = m.rh * dh;
        if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
          setMascaraSelId(m.id);
          arrastreRef.current = {
            tipo: 'mover',
            id: m.id,
            inicioX: x,
            inicioY: y,
            mOrig: { ...m },
            dx,
            dy,
            dw,
            dh,
          };
          return;
        }
      }
      setMascaraSelId(null);
      return;
    }

    // Modo dibujo de nueva máscara (rectángulo o elipse): iniciar trazo dentro de la imagen
    if (x >= dx && x <= dx + dw && y >= dy && y <= dy + dh) {
      arrastreRef.current = {
        tipo: 'crear',
        inicioX: x,
        inicioY: y,
        dx,
        dy,
        dw,
        dh,
      };
      setTrazoTemp({ x, y, w: 0, h: 0 });
    }
  }

  function alMover(e) {
    const arr = arrastreRef.current;
    if (!arr) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (arr.tipo === 'crear') {
      const bx = Math.min(arr.inicioX, x);
      const by = Math.min(arr.inicioY, y);
      const bw = Math.abs(x - arr.inicioX);
      const bh = Math.abs(y - arr.inicioY);
      setTrazoTemp({ x: bx, y: by, w: bw, h: bh });
    } else if (arr.tipo === 'mover') {
      const deltaX = (x - arr.inicioX) / arr.dw;
      const deltaY = (y - arr.inicioY) / arr.dh;
      const nRx = Math.max(0, Math.min(1 - arr.mOrig.rw, arr.mOrig.rx + deltaX));
      const nRy = Math.max(0, Math.min(1 - arr.mOrig.rh, arr.mOrig.ry + deltaY));
      actualizarMascara(arr.id, { rx: nRx, ry: nRy });
    }
  }

  function alSoltar() {
    const arr = arrastreRef.current;
    arrastreRef.current = null;
    if (!arr) return;

    if (arr.tipo === 'crear' && trazoTemp) {
      setTrazoTemp(null);
      if (trazoTemp.w >= 10 && trazoTemp.h >= 10) {
        const rx = Math.max(0, Math.min(0.99, (trazoTemp.x - arr.dx) / arr.dw));
        const ry = Math.max(0, Math.min(0.99, (trazoTemp.y - arr.dy) / arr.dh));
        const rw = Math.max(0.01, Math.min(1 - rx, trazoTemp.w / arr.dw));
        const rh = Math.max(0.01, Math.min(1 - ry, trazoTemp.h / arr.dh));

        const nueva = sanearMascara({
          id: nuevoId(),
          forma: herramienta === 'elipse' ? 'elipse' : 'rectangulo',
          rx,
          ry,
          rw,
          rh,
          texto: `Etiqueta ${mascaras.length + 1}`,
          color: null,
        });

        const siguiente = [...mascaras, nueva];
        setMascaras(siguiente);
        setMascaraSelId(nueva.id);
        guardarCambios(siguiente);
      }
    }
  }

  return (
    <Modal titulo="Oclusión de imagen (máscaras de estudio)" alCerrar={alCerrar} ancho={940}>
      <div style={{ display: 'grid', gap: '12px' }}>
        {/* Barra superior de herramientas y modos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Herramienta:</span>
            <button
              type="button"
              className={`nt-btn-sm ${herramienta === 'rectangulo' && !modoPrueba ? 'nt-btn-sm--on' : ''}`}
              onClick={() => { setHerramienta('rectangulo'); setModoPrueba(false); }}
              title="Dibujar máscara rectangular"
            >
              Rectángulo
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${herramienta === 'elipse' && !modoPrueba ? 'nt-btn-sm--on' : ''}`}
              onClick={() => { setHerramienta('elipse'); setModoPrueba(false); }}
              title="Dibujar máscara elíptica / redonda"
            >
              Elipse
            </button>
            <button
              type="button"
              className={`nt-btn-sm ${herramienta === 'seleccionar' && !modoPrueba ? 'nt-btn-sm--on' : ''}`}
              onClick={() => { setHerramienta('seleccionar'); setModoPrueba(false); }}
              title="Seleccionar y mover máscaras existentes"
            >
              Mover / Seleccionar
            </button>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {/* Alternador de prueba de estudio */}
            <button
              type="button"
              className={`nt-btn-sm ${modoPrueba ? 'nt-btn-sm--on' : ''}`}
              style={{
                background: modoPrueba ? '#dbeafe' : undefined,
                color: modoPrueba ? '#1d4ed8' : undefined,
                borderColor: modoPrueba ? '#3b82f6' : undefined,
                fontWeight: 600,
              }}
              onClick={() => {
                setModoPrueba(!modoPrueba);
                setReveladasPrueba(new Set());
              }}
            >
              {modoPrueba ? <>Volver a editar</> : <>Probar modo estudio</>}
            </button>

            {modoPrueba && (
              <div style={{ display: 'inline-flex', gap: '4px', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                <button
                  type="button"
                  className={`nt-btn-sm ${subModoEstudio === 'todas' ? 'nt-btn-sm--on' : ''}`}
                  onClick={() => { setSubModoEstudio('todas'); setReveladasPrueba(new Set()); }}
                  title="Ocultar todas las máscaras y revelarlas una por una"
                >
                  Ocultar todas
                </button>
                <button
                  type="button"
                  className={`nt-btn-sm ${subModoEstudio === 'una' ? 'nt-btn-sm--on' : ''}`}
                  onClick={() => { setSubModoEstudio('una'); setReveladasPrueba(new Set()); }}
                  title="Ocultar una sola máscara a la vez para estudiar con contexto"
                >
                  Ocultar una
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Área central con el lienzo interactivo y el panel lateral de propiedades */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '14px', alignItems: 'start' }}>
          {/* Contenedor del Canvas */}
          <div
            style={{
              position: 'relative',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: modoPrueba ? 'pointer' : (herramienta === 'seleccionar' ? 'grab' : 'crosshair'),
              minHeight: '440px',
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={alBajar}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              aria-label="Editor de máscaras de imagen"
            />

            {modoPrueba && subModoEstudio === 'una' && mascaras.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.88)',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <span>Máscara {indiceUnaPrueba + 1} de {mascaras.length}</span>
                <button
                  type="button"
                  className="nt-btn-sm"
                  style={{ color: '#ffffff', padding: '2px 6px' }}
                  disabled={indiceUnaPrueba <= 0}
                  onClick={() => { setIndiceUnaPrueba((i) => Math.max(0, i - 1)); setReveladasPrueba(new Set()); }}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="nt-btn-sm"
                  style={{ color: '#ffffff', padding: '2px 6px' }}
                  disabled={indiceUnaPrueba >= mascaras.length - 1}
                  onClick={() => { setIndiceUnaPrueba((i) => Math.min(mascaras.length - 1, i + 1)); setReveladasPrueba(new Set()); }}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>

          {/* Panel lateral: lista de máscaras y edición de la máscara seleccionada */}
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                Máscaras ({mascaras.length})
              </span>
              <button
                type="button"
                className="nt-btn-sm"
                style={{ fontSize: '11px' }}
                onClick={() => agregarMascara()}
                title="Añadir máscara al centro de la imagen"
              >
                + Añadir
              </button>
            </div>

            {/* Inspector de la máscara seleccionada */}
            {mascaraSeleccionada ? (
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                  Máscara seleccionada
                </strong>

                <label style={{ display: 'grid', gap: '3px', fontSize: '11px', color: '#475569' }}>
                  Etiqueta / Texto oculto:
                  <input
                    type="text"
                    value={mascaraSeleccionada.texto}
                    placeholder="Ej. Ventrículo izquierdo"
                    style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    onChange={(e) => actualizarMascara(mascaraSeleccionada.id, { texto: e.target.value })}
                  />
                </label>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Forma:</span>
                  <button
                    type="button"
                    className={`nt-btn-sm ${mascaraSeleccionada.forma === 'rectangulo' ? 'nt-btn-sm--on' : ''}`}
                    onClick={() => actualizarMascara(mascaraSeleccionada.id, { forma: 'rectangulo' })}
                  >
                    Rect.
                  </button>
                  <button
                    type="button"
                    className={`nt-btn-sm ${mascaraSeleccionada.forma === 'elipse' ? 'nt-btn-sm--on' : ''}`}
                    onClick={() => actualizarMascara(mascaraSeleccionada.id, { forma: 'elipse' })}
                  >
                    Elipse
                  </button>
                </div>

                <button
                  type="button"
                  className="nt-btn-sm"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', marginTop: '4px' }}
                  onClick={() => eliminarMascara(mascaraSeleccionada.id)}
                >
                  Eliminar máscara
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
                Arrastre sobre la imagen para crear una máscara, o seleccione una de la lista.
              </div>
            )}

            {/* Lista compacta de máscaras creadas */}
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                display: 'grid',
                gap: '4px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '4px',
                background: '#ffffff',
              }}
            >
              {mascaras.map((m, i) => (
                <div
                  key={m.id}
                  onClick={() => { setMascaraSelId(m.id); setModoPrueba(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    background: m.id === mascaraSelId ? '#e0f2fe' : '#f8fafc',
                    color: m.id === mascaraSelId ? '#0369a1' : '#334155',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.texto || `Máscara ${i + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); eliminarMascara(m.id); }}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                    title="Eliminar"
                  >
                    Cerrar
                  </button>
                </div>
              ))}
            </div>

            {mascaras.length > 0 && (
              <button
                type="button"
                className="nt-btn-sm"
                style={{ color: '#64748b', fontSize: '10px', justifySelf: 'start' }}
                onClick={limpiarTodas}
              >
                Limpiar todas las máscaras
              </button>
            )}
          </div>
        </div>

        {/* Acciones del pie de modal */}
        <div className="nt-acciones" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {mascaras.length > 0 && alEstudiar && (
              <button
                type="button"
                className="nt-btn"
                style={{ background: '#2563eb', color: '#ffffff', borderColor: '#2563eb' }}
                onClick={() => {
                  guardarCambios();
                  alCerrar();
                  alEstudiar(imagen);
                }}
              >
                Iniciar modo estudio
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="nt-btn nt-btn--primario"
              onClick={() => {
                guardarCambios();
                alCerrar();
              }}
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
