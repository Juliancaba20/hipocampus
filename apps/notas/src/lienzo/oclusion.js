// Oclusión de imagen (Etapa 22B): modelo, cálculo de coordenadas relativas,
// detección de colisiones y renderizado de máscaras para estudio activo.
import { nuevoId } from '../almacen/modelo.js';

/**
 * Normaliza y valida una máscara de oclusión.
 * Coordenadas rx, ry, rw, rh relativas al ancho y alto de la imagen (0..1).
 */
export function sanearMascara(m, indice = 0) {
  if (!m || typeof m !== 'object') return null;
  const id = typeof m.id === 'string' && m.id.trim() ? m.id.trim() : nuevoId();
  const forma = m.forma === 'elipse' ? 'elipse' : 'rectangulo';
  const rx = Number.isFinite(m.rx) ? Math.max(0, Math.min(0.99, m.rx)) : 0;
  const ry = Number.isFinite(m.ry) ? Math.max(0, Math.min(0.99, m.ry)) : 0;
  const rw = Number.isFinite(m.rw) ? Math.max(0.005, Math.min(1 - rx, m.rw)) : 0.15;
  const rh = Number.isFinite(m.rh) ? Math.max(0.005, Math.min(1 - ry, m.rh)) : 0.08;
  const texto = typeof m.texto === 'string' ? m.texto.trim().slice(0, 150) : '';
  const color = typeof m.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : null;
  return { id, forma, rx, ry, rw, rh, texto, color };
}

/**
 * Calcula las coordenadas y dimensiones absolutas en el mundo a partir de las relativas.
 */
export function mascaraAbsoluta(m, el) {
  return {
    id: m.id,
    x: el.x + m.rx * el.ancho,
    y: el.y + m.ry * el.alto,
    ancho: m.rw * el.ancho,
    alto: m.rh * el.alto,
    forma: m.forma,
    texto: m.texto,
    color: m.color,
  };
}

/**
 * Convierte un rectángulo absoluto del mundo a coordenadas relativas a la imagen.
 */
export function mascaraRelativa(rect, el, opciones = {}) {
  const iw = Math.max(1, el.ancho);
  const ih = Math.max(1, el.alto);
  const rx = Math.max(0, Math.min(0.99, (rect.x - el.x) / iw));
  const ry = Math.max(0, Math.min(0.99, (rect.y - el.y) / ih));
  const rw = Math.max(0.005, Math.min(1 - rx, rect.ancho / iw));
  const rh = Math.max(0.005, Math.min(1 - ry, rect.alto / ih));
  return {
    id: opciones.id || nuevoId(),
    forma: opciones.forma === 'elipse' ? 'elipse' : 'rectangulo',
    rx,
    ry,
    rw,
    rh,
    texto: opciones.texto || '',
    color: opciones.color || null,
  };
}

/**
 * Comprueba si un punto (px, py) en coordenadas del mundo cae dentro de una máscara.
 */
export function puntoEnMascara(px, py, m, el) {
  const mx = el.x + m.rx * el.ancho;
  const my = el.y + m.ry * el.alto;
  const mw = m.rw * el.ancho;
  const mh = m.rh * el.alto;

  if (m.forma === 'elipse') {
    const cx = mx + mw / 2;
    const cy = my + mh / 2;
    const rx = mw / 2;
    const ry = mh / 2;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  // rectangulo
  return px >= mx && px <= mx + mw && py >= my && py <= my + mh;
}

/**
 * Busca si un punto colisiona con alguna máscara de las imágenes dadas.
 * Devuelve { elemento, mascara, indice } o null.
 */
export function buscarMascaraEnPunto(px, py, elementos) {
  for (let i = elementos.length - 1; i >= 0; i--) {
    const el = elementos[i];
    if (el.tipo !== 'imagen' || !Array.isArray(el.datos?.mascaras)) continue;
    const mascaras = el.datos.mascaras;
    for (let j = mascaras.length - 1; j >= 0; j--) {
      const m = mascaras[j];
      if (puntoEnMascara(px, py, m, el)) {
        return { elemento: el, mascara: m, indice: j };
      }
    }
  }
  return null;
}

/**
 * Traza la figura geométrica de la máscara (rectángulo o elipse) en el contexto 2D.
 */
export function trazarFiguraMascara(ctx, x, y, w, h, forma, radio = 4) {
  if (forma === 'elipse') {
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
    } else {
      ctx.arc(x + w / 2, y + h / 2, Math.max(1, Math.min(w, h) / 2), 0, Math.PI * 2);
    }
  } else {
    ctx.beginPath();
    const r = Math.min(radio, w / 2, h / 2);
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  }
}

/**
 * Pinta todas las máscaras de una imagen con soporte de modo estudio y modo edición.
 */
export function pintarMascarasDeImagen(ctx, el, opcionesOculto = null) {
  const d = el.datos || {};
  const mascaras = Array.isArray(d.mascaras) ? d.mascaras : [];
  if (!mascaras.length) return;

  const enModoEstudio = !!opcionesOculto?.activo;
  const modoOclusion = opcionesOculto?.modoOclusion === 'una' ? 'una' : 'todas';
  const revelarTodo = !!opcionesOculto?.revelarTodo;
  const revelados = opcionesOculto?.reveladosMascaras || opcionesOculto?.revelados || new Set();
  const mascaraActivaId = opcionesOculto?.mascaraActivaId || null;
  const indiceMascaraActiva = typeof opcionesOculto?.indiceMascaraActiva === 'number'
    ? opcionesOculto.indiceMascaraActiva
    : (typeof opcionesOculto?.indiceMascaraUna === 'number' ? opcionesOculto.indiceMascaraUna : 0);

  ctx.save();

  for (let idx = 0; idx < mascaras.length; idx++) {
    const m = mascaras[idx];
    const mx = el.x + m.rx * el.ancho;
    const my = el.y + m.ry * el.alto;
    const mw = m.rw * el.ancho;
    const mh = m.rh * el.alto;
    const clave = `${el.id}-${m.id}`;

    let tapada = true;
    let esObjetivoActivo = false;

    if (!enModoEstudio) {
      tapada = true;
    } else if (modoOclusion === 'todas') {
      tapada = !revelarTodo && !revelados.has(clave);
    } else {
      esObjetivoActivo = (mascaraActivaId && m.id === mascaraActivaId) || (!mascaraActivaId && idx === indiceMascaraActiva);
      if (esObjetivoActivo) {
        tapada = !revelarTodo && !revelados.has(clave);
      } else {
        tapada = false;
      }
    }

    trazarFiguraMascara(ctx, mx, my, mw, mh, m.forma);

    if (tapada) {
      // Máscara tapada: caja opaca
      const fondoBase = esObjetivoActivo ? '#ea580c' : (m.color || '#2563eb');
      ctx.fillStyle = fondoBase;
      ctx.fill();

      ctx.strokeStyle = esObjetivoActivo ? '#c2410c' : '#1d4ed8';
      ctx.lineWidth = esObjetivoActivo ? 2.5 : 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      // Número o texto
      const textoBadge = enModoEstudio ? `[${idx + 1}]` : (m.texto ? m.texto : `[${idx + 1}]`);
      const tamTexto = Math.max(9, Math.min(14, Math.floor(mh * 0.55)));
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${tamTexto}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textoBadge, mx + mw / 2, my + mh / 2, Math.max(10, mw - 6));
    } else {
      // Máscara revelada
      if (enModoEstudio) {
        if (modoOclusion === 'una' && !esObjetivoActivo) {
          // Contexto en «ocultar una»
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
          // Objetivo revelado con éxito
          ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
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
    }
  }

  ctx.restore();
}
