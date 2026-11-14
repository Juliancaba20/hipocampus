import { visibleEnMundo } from './camara.js';
import { pintarTexto } from '../herramientas/texto/pintar.js';
import { FUENTE_TEXTO } from '../herramientas/texto/estilo.js';
import { esLinea, extremosLinea, manijas, puntosForma, rectsSeCruzan } from './geometria.js';
import { puntosControlConectorCurvo } from './conectores.js';
import { dibujarRenglones } from './renglones.js';
import { imagenEnCache } from '../herramientas/imagenes/recursos.js';
import { pintarMascarasDeImagen } from './oclusion.js';
import { dibujarInstrumento } from '../herramientas/precision/dibujoInstrumentos.js';


// Insignia «enlace a otra nota»: círculo azul con una cadena trazada como vector.
const TRAZADO_ENLACE = typeof Path2D !== 'undefined' ? new Path2D('M9 15l6 -6 M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464 M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463') : null;
function dibujarInsigniaEnlace(ctx, bx, by) {
  // Círculo azul con aro blanco: bien visible sobre cualquier fondo
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bx, by, 12.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(bx, by, 10.5, 0, Math.PI * 2);
  ctx.fill();
  if (!TRAZADO_ENLACE) return;
  ctx.save();
  ctx.translate(bx - 7, by - 7);
  ctx.scale(14 / 24, 14 / 24);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(TRAZADO_ENLACE);
  ctx.restore();
}

const AZUL = '#2350d8';

const ancho = (g, p) => g * (0.35 + 1.3 * p); // la presión 0,5 da el grosor elegido

// Trazo suavizado con curvas por los puntos medios. Con lápiz sensible a la presión (variable)
// cada tramo lleva su propio grosor; en los demás casos es una sola línea (sin manchas al ser translúcida).
export function dibujarTrazo(ctx, d, zoom = 1) {
  const p = d.puntos;
  if (!p.length) return;
  ctx.globalAlpha = d.opacidad ?? 1;
  ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (zoom < 0.5 && p.length > 6) {
    // Vista alejada: se salta parte de los puntos y se une con rectas (a esa escala no se nota y cuesta mucho menos).
    const paso = Math.max(1, Math.floor(0.6 / zoom));
    ctx.lineWidth = d.grosor;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = paso; i < p.length - 1; i += paso) ctx.lineTo(p[i][0], p[i][1]);
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0], p[0][1], (d.variable ? ancho(d.grosor, p[0][2]) : d.grosor) / 2, 0, Math.PI * 2); ctx.fill();
  } else if (p.length === 2) {
    ctx.lineWidth = d.variable ? ancho(d.grosor, (p[0][2] + p[1][2]) / 2) : d.grosor;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.stroke();
  } else if (!d.variable) {
    ctx.lineWidth = d.grosor;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  } else {
    const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (let i = 0; i < p.length - 1; i++) {
      const ini = i === 0 ? p[0] : medio(p[i - 1], p[i]);
      const fin = i === p.length - 2 ? p[p.length - 1] : medio(p[i], p[i + 1]);
      ctx.lineWidth = ancho(d.grosor, p[i][2]);
      ctx.beginPath(); ctx.moveTo(ini[0], ini[1]);
      if (i === 0 || i === p.length - 2) ctx.lineTo(fin[0], fin[1]); else ctx.quadraticCurveTo(p[i][0], p[i][1], fin[0], fin[1]);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function aplicarSombra(ctx, sombra) {
  if (sombra && sombra.activa && (sombra.desenfoque > 0 || sombra.x !== 0 || sombra.y !== 0)) {
    ctx.shadowColor = sombra.color || 'rgba(20, 25, 43, 0.35)';
    ctx.shadowBlur = Math.min(100, Math.max(0, sombra.desenfoque || 8));
    ctx.shadowOffsetX = sombra.x || 2;
    ctx.shadowOffsetY = sombra.y || 4;
    return true;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  return false;
}

export function limpiarSombra(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function aplicarEstiloBorde(ctx, estilo, grosor = 1) {
  if (estilo === 'guiones') {
    ctx.setLineDash([Math.max(4, grosor * 3), Math.max(3, grosor * 2)]);
  } else if (estilo === 'puntos') {
    ctx.setLineDash([Math.max(2, grosor), Math.max(2, grosor * 1.5)]);
  } else {
    ctx.setLineDash([]);
  }
}

export function trazarRectanguloRedondeado(ctx, x, y, w, h, r = 0) {
  const radio = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radio <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radio);
    return;
  }
  ctx.moveTo(x + radio, y);
  ctx.lineTo(x + w - radio, y);
  ctx.arcTo(x + w, y, x + w, y + radio, radio);
  ctx.lineTo(x + w, y + h - radio);
  ctx.arcTo(x + w, y + h, x + w - radio, y + h, radio);
  ctx.lineTo(x + radio, y + h);
  ctx.arcTo(x, y + h, x, y + h - radio, radio);
  ctx.lineTo(x, y + radio);
  ctx.arcTo(x, y, x + radio, y, radio);
  ctx.closePath();
}

export function parsearDegradadoCss(ctx, cssStr, rect) {
  try {
    const anguloMatch = cssStr.match(/(\d+)deg/);
    const angulo = anguloMatch ? parseInt(anguloMatch[1], 10) : 90;
    const colores = [];
    const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*(\d+%)?/g;
    let m;
    while ((m = colorRegex.exec(cssStr)) !== null) {
      const col = m[1];
      const pct = m[2] ? parseFloat(m[2]) / 100 : null;
      colores.push({ col, pct });
    }
    if (!colores.length) return '#ffffff';
    const paradas = colores.map((c, i) => ({
      pos: c.pct !== null ? c.pct : (i / Math.max(1, colores.length - 1)),
      color: c.col,
    }));
    return crearDegradadoCanvas(ctx, { angulo, paradas }, rect);
  } catch {
    return '#ffffff';
  }
}

export function crearDegradadoCanvas(ctx, { angulo = 90, paradas = [] }, rect) {
  if (!paradas || !paradas.length) return '#ffffff';
  const rad = ((angulo - 90) * Math.PI) / 180;
  const cx = rect.x + rect.ancho / 2;
  const cy = rect.y + rect.alto / 2;
  const d = Math.hypot(rect.ancho, rect.alto) / 2;
  const x1 = cx - Math.cos(rad) * d;
  const y1 = cy - Math.sin(rad) * d;
  const x2 = cx + Math.cos(rad) * d;
  const y2 = cy + Math.sin(rad) * d;

  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const p of paradas) {
    const pos = Math.max(0, Math.min(1, p.pos ?? 0));
    try {
      grad.addColorStop(pos, p.color);
    } catch {
      // Ignorar color con formato inválido
    }
  }
  return grad;
}

export function obtenerEstiloRelleno(ctx, relleno, rect) {
  if (!relleno) return null;
  if (typeof relleno === 'string') {
    if (relleno.startsWith('linear-gradient')) {
      return parsearDegradadoCss(ctx, relleno, rect);
    }
    return relleno;
  }
  if (typeof relleno === 'object' && relleno.tipo === 'lineal') {
    return crearDegradadoCanvas(ctx, relleno, rect);
  }
  return null;
}

export function dibujarFondoEnRect(ctx, fondo, rect) {
  if (!fondo) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    return;
  }
  if (typeof fondo === 'string') {
    if (fondo.startsWith('linear-gradient')) {
      ctx.fillStyle = parsearDegradadoCss(ctx, fondo, rect);
    } else if (fondo === 'pizarron-verde' || fondo === 'verde-pizarra') {
      ctx.fillStyle = '#1b4332';
    } else if (fondo === 'pizarron-negro' || fondo === 'negro-pizarra') {
      ctx.fillStyle = '#1e293b';
    } else {
      ctx.fillStyle = fondo;
    }
    ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    return;
  }
  if (typeof fondo === 'object') {
    if (fondo.tipo === 'degradado' || fondo.tipo === 'lineal') {
      ctx.fillStyle = crearDegradadoCanvas(ctx, fondo, rect);
      ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    } else if (fondo.tipo === 'pizarron') {
      ctx.fillStyle = fondo.color || (fondo.estilo === 'verde' ? '#1b4332' : '#1e293b');
      ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    } else if (fondo.tipo === 'color' && fondo.color) {
      ctx.fillStyle = fondo.color;
      ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    }
  }
}

// Línea o flecha conector (soporta línea recta y curva, Etapa 21B).
function dibujarLinea(ctx, el) {
  const d = el.datos, [a, b] = extremosLinea(el);
  const g = d.grosor > 0 ? d.grosor : 2;
  ctx.save();
  if (d.opacidad !== undefined) ctx.globalAlpha = Math.max(0.05, Math.min(1, d.opacidad));
  aplicarSombra(ctx, d.sombra);
  aplicarEstiloBorde(ctx, d.estiloBorde, g);
  ctx.strokeStyle = d.borde || '#14192b';
  ctx.lineWidth = g;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const esCurvo = d.tipoConector === 'curvo';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);

  let ang = 0;
  if (esCurvo) {
    const { cp1, cp2 } = puntosControlConectorCurvo(a, b, d.anclajeInicio, d.anclajeFin);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
    ang = Math.atan2(b.y - cp2.y, b.x - cp2.x);
  } else {
    ctx.lineTo(b.x, b.y);
    ang = Math.atan2(b.y - a.y, b.x - a.x);
  }

  if (d.forma === 'flecha') {
    const largo = Math.min(Math.max(12, g * 4), Math.hypot(b.x - a.x, b.y - a.y) * 0.6 + 6);
    for (const s of [-1, 1]) {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - largo * Math.cos(ang + s * 0.5), b.y - largo * Math.sin(ang + s * 0.5));
    }
  }
  ctx.stroke();
  limpiarSombra(ctx);
  ctx.restore();
}

export function recorteImagenSeguro(recorte = {}) {
  const x = Math.max(0, Math.min(0.99, Number.isFinite(recorte.x) ? recorte.x : 0));
  const y = Math.max(0, Math.min(0.99, Number.isFinite(recorte.y) ? recorte.y : 0));
  const ancho = Math.max(0.01, Math.min(1 - x, Number.isFinite(recorte.ancho) ? recorte.ancho : 1));
  const alto = Math.max(0.01, Math.min(1 - y, Number.isFinite(recorte.alto) ? recorte.alto : 1));
  return { x, y, ancho, alto };
}

export function pintarImagen(ctx, el, imagen, opcionesOculto = null) {
  const d = el.datos || {};
  if (ctx.save) ctx.save();
  if (d.opacidad !== undefined) ctx.globalAlpha = Math.max(0.05, Math.min(1, d.opacidad));
  aplicarSombra(ctx, d.sombra);

  if (!imagen) {
    ctx.fillStyle = '#e8eefc'; ctx.fillRect(el.x, el.y, el.ancho, el.alto);
    ctx.strokeStyle = '#b9c7e4'; ctx.lineWidth = 1; ctx.strokeRect(el.x, el.y, el.ancho, el.alto);
    limpiarSombra(ctx);
    if (Array.isArray(d.mascaras) && d.mascaras.length > 0) {
      pintarMascarasDeImagen(ctx, el, opcionesOculto);
    }
    if (ctx.restore) ctx.restore();
    return;
  }

  const marco = d.marco || 'ninguno';
  const radio = d.radioEsquinas !== undefined ? d.radioEsquinas : 0;
  const tieneBorde = d.borde && d.grosor > 0;
  const requiereRecorte = marco === 'circulo' || (marco === 'redondeado' && radio > 0);

  if (requiereRecorte && ctx.save && ctx.beginPath && ctx.clip) {
    ctx.save();
    ctx.beginPath();
    if (marco === 'circulo') {
      if (ctx.ellipse) ctx.ellipse(el.x + el.ancho / 2, el.y + el.alto / 2, el.ancho / 2, el.alto / 2, 0, 0, Math.PI * 2);
    } else {
      trazarRectanguloRedondeado(ctx, el.x, el.y, el.ancho, el.alto, radio);
    }
    ctx.clip();
  }

  const recorte = recorteImagenSeguro(d.recorte);
  const iw = imagen.naturalWidth || imagen.width, ih = imagen.naturalHeight || imagen.height;
  ctx.drawImage(imagen, recorte.x * iw, recorte.y * ih, recorte.ancho * iw, recorte.alto * ih, el.x, el.y, el.ancho, el.alto);

  if (requiereRecorte && ctx.restore) {
    ctx.restore();
  }

  if (tieneBorde && ctx.stroke) {
    limpiarSombra(ctx);
    ctx.lineWidth = d.grosor;
    ctx.strokeStyle = d.borde;
    aplicarEstiloBorde(ctx, d.estiloBorde, d.grosor);
    if (ctx.beginPath) ctx.beginPath();
    if (marco === 'circulo') {
      if (ctx.ellipse) ctx.ellipse(el.x + el.ancho / 2, el.y + el.alto / 2, el.ancho / 2, el.alto / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (radio > 0) {
      trazarRectanguloRedondeado(ctx, el.x, el.y, el.ancho, el.alto, radio);
      ctx.stroke();
    } else if (ctx.strokeRect) {
      ctx.strokeRect(el.x, el.y, el.ancho, el.alto);
    }
  }

  limpiarSombra(ctx);

  // Máscaras de oclusión sobre la imagen (Etapa 22B)
  if (Array.isArray(d.mascaras) && d.mascaras.length > 0) {
    pintarMascarasDeImagen(ctx, el, opcionesOculto);
  }

  // Insignia de enlace a otra nota en imágenes (Etapa 23)
  const enlaceImg = el.enlace || d.enlace;
  if (enlaceImg && (enlaceImg.tipo === 'nota' || enlaceImg.notaId)) {
    ctx.save();
    limpiarSombra(ctx);
    const bx = el.x + el.ancho - 12;
    const by = el.y + 12;
    dibujarInsigniaEnlace(ctx, bx, by);
    ctx.restore();
  }

  if (ctx.restore) ctx.restore();
}

export function pintarIcono(ctx, el) {
  const d = el.datos || {};
  ctx.save();
  ctx.globalAlpha = d.opacidad !== undefined ? Math.max(0.05, Math.min(1, d.opacidad)) : 1;
  aplicarSombra(ctx, d.sombra);

  const cx = el.x, cy = el.y, w = el.ancho, h = el.alto;
  const escalaX = w / 24, escalaY = h / 24;

  ctx.translate(cx, cy);
  ctx.scale(escalaX, escalaY);

  if (d.d) {
    let path = null;
    if (typeof Path2D !== 'undefined') {
      try {
        path = new Path2D(d.d);
      } catch {}
    }
    if (path) {
      if (d.modo === 'relleno') {
        ctx.fillStyle = d.color || '#2350d8';
        ctx.fill(path);
      } else {
        ctx.strokeStyle = d.color || '#2350d8';
        ctx.lineWidth = (d.grosor || 2) * (24 / Math.max(w, h));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        aplicarEstiloBorde(ctx, d.estiloBorde, ctx.lineWidth);
        ctx.stroke(path);
      }
      if (d.borde && d.borde !== d.color) {
        ctx.strokeStyle = d.borde;
        ctx.lineWidth = Math.max(0.5, (d.grosor || 2) * (24 / Math.max(w, h)) * 0.5);
        ctx.stroke(path);
      }
    }
  }
  limpiarSombra(ctx);
  ctx.restore();
}

function trazarForma(ctx, el, d) {
  ctx.beginPath();
  const f = d.forma;
  if (f === 'elipse') {
    ctx.ellipse(el.x + el.ancho / 2, el.y + el.alto / 2, el.ancho / 2, el.alto / 2, 0, 0, Math.PI * 2);
  } else if (f === 'triangulo' || f === 'rombo' || f === 'hexagono' || f === 'estrella' || f === 'cruz') {
    const pts = puntosForma(el);
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  } else if (f === 'cilindro') {
    const he = Math.min(el.alto * 0.25, 40);
    const ry = he / 2, rx = el.ancho / 2, cx = el.x + rx;
    ctx.moveTo(el.x, el.y + ry);
    ctx.lineTo(el.x, el.y + el.alto - ry);
    ctx.ellipse(cx, el.y + el.alto - ry, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(el.x + el.ancho, el.y + ry);
    ctx.ellipse(cx, el.y + ry, rx, ry, 0, 0, Math.PI, true);
    ctx.closePath();
  } else if (f === 'nube') {
    const x = el.x, y = el.y, w = el.ancho, h = el.alto;
    ctx.moveTo(x + w * 0.2, y + h * 0.78);
    ctx.bezierCurveTo(x + w * 0.02, y + h * 0.78, x, y + h * 0.5, x + w * 0.16, y + h * 0.38);
    ctx.bezierCurveTo(x + w * 0.12, y + h * 0.15, x + w * 0.36, y + h * 0.08, x + w * 0.5, y + h * 0.22);
    ctx.bezierCurveTo(x + w * 0.64, y + h * 0.08, x + w * 0.88, y + h * 0.15, x + w * 0.84, y + h * 0.38);
    ctx.bezierCurveTo(x + w, y + h * 0.5, x + w * 0.98, y + h * 0.78, x + w * 0.8, y + h * 0.78);
    ctx.closePath();
  } else if (f === 'llave') {
    const x = el.x, y = el.y, w = el.ancho, h = el.alto;
    const r = Math.min(w * 0.3, h * 0.1);
    ctx.moveTo(x + w * 0.8, y);
    ctx.quadraticCurveTo(x + w * 0.4, y, x + w * 0.4, y + r);
    ctx.lineTo(x + w * 0.4, y + h / 2 - r);
    ctx.quadraticCurveTo(x + w * 0.4, y + h / 2, x + w * 0.1, y + h / 2);
    ctx.quadraticCurveTo(x + w * 0.4, y + h / 2, x + w * 0.4, y + h / 2 + r);
    ctx.lineTo(x + w * 0.4, y + h - r);
    ctx.quadraticCurveTo(x + w * 0.4, y + h, x + w * 0.8, y + h);
  } else if (f === 'flechaDoblada' || f === 'flecha_doblada') {
    const x = el.x, y = el.y, w = el.ancho, h = el.alto;
    const grosor = Math.min(w, h) * 0.28;
    const altoPunta = Math.min(h * 0.4, 32);
    const anchoPunta = Math.min(w * 0.5, 36);
    ctx.moveTo(x, y + h - grosor);
    ctx.lineTo(x + w - grosor, y + h - grosor);
    ctx.lineTo(x + w - grosor, y + altoPunta);
    ctx.lineTo(x + w - grosor - (anchoPunta - grosor) / 2, y + altoPunta);
    ctx.lineTo(x + w - grosor / 2, y);
    ctx.lineTo(x + w + (anchoPunta - grosor) / 2, y + altoPunta);
    ctx.lineTo(x + w, y + altoPunta);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else {
    // rectangulo
    trazarRectanguloRedondeado(ctx, el.x, el.y, el.ancho, el.alto, d.radioEsquinas || 0);
  }
}

function dibujarElemento(ctx, el, zoom = 1, guiaTexto = null, alImagenLista = null, estilos = null, opcionesOculto = null) {
  const d = el.datos || {};
  ctx.globalAlpha = 1;

  if (el.tipo === 'figura') {
    if (esLinea(el)) { dibujarLinea(ctx, el); return; }
    ctx.save();
    ctx.globalAlpha = d.opacidad !== undefined ? Math.max(0.05, Math.min(1, d.opacidad)) : 1;
    aplicarSombra(ctx, d.sombra);

    trazarForma(ctx, el, d);

    if (d.relleno) {
      const estiloRelleno = obtenerEstiloRelleno(ctx, d.relleno, el);
      if (estiloRelleno) {
        ctx.fillStyle = estiloRelleno;
        ctx.fill();
      }
    }

    if (d.borde && d.grosor > 0) {
      ctx.lineWidth = d.grosor;
      ctx.strokeStyle = d.borde;
      ctx.lineJoin = 'round';
      aplicarEstiloBorde(ctx, d.estiloBorde, d.grosor);
      ctx.stroke();
      if (d.forma === 'cilindro') {
        // Trazar el borde del óvalo superior del cilindro
        const he = Math.min(el.alto * 0.25, 40);
        const ry = he / 2, rx = el.ancho / 2, cx = el.x + rx;
        ctx.beginPath();
        ctx.ellipse(cx, el.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Texto o etiqueta interior en figuras (nodos de mapas conceptuales, Etapa 23)
    if (d.texto || d.etiqueta) {
      const txt = String(d.texto || d.etiqueta);
      ctx.save();
      limpiarSombra(ctx);
      ctx.fillStyle = d.colorTexto || '#1e293b';
      const tam = Math.max(11, Math.min(22, d.tamanoTexto || 14));
      ctx.font = `600 ${tam}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, el.x + el.ancho / 2, el.y + el.alto / 2, Math.max(20, el.ancho - 16));
      ctx.restore();
    }

    // Insignia de enlace a otra nota (Etapa 23)
    const enlaceObj = el.enlace || d.enlace;
    if (enlaceObj && (enlaceObj.tipo === 'nota' || enlaceObj.notaId)) {
      ctx.save();
      limpiarSombra(ctx);
      const bx = el.x + el.ancho - 12;
      const by = el.y + 12;
      dibujarInsigniaEnlace(ctx, bx, by);
      ctx.restore();
    }

    limpiarSombra(ctx);
    ctx.restore();
  } else if (el.tipo === 'trazo') {
    dibujarTrazo(ctx, d, zoom);
  } else if (el.tipo === 'texto' && Array.isArray(d.bloques)) {
    pintarTexto(ctx, el, guiaTexto, estilos, opcionesOculto);
  } else if (el.tipo === 'texto' || el.tipo === 'simbolo') {
    const tam = d.tamano || 18;
    ctx.fillStyle = d.color || '#14192b';
    ctx.font = `${tam}px ${FUENTE_TEXTO}`;
    ctx.textBaseline = 'top';
    (el.tipo === 'simbolo' ? [d.caracter] : String(d.contenido || '').split('\n')).forEach((linea, i) => ctx.fillText(linea, el.x, el.y + i * tam * 1.3));
  } else if (el.tipo === 'imagen') {
    pintarImagen(ctx, el, imagenEnCache(d.blobId, ctx.canvas, alImagenLista), opcionesOculto);
  } else if (el.tipo === 'icono') {
    pintarIcono(ctx, el);
  }

  // Insignia de enlace en los elementos que no la dibujan por su cuenta (textos, símbolos, íconos y trazos)
  if (['texto', 'simbolo', 'icono', 'trazo'].includes(el.tipo)) {
    const enl = el.enlace || d.enlace;
    if (enl && (enl.tipo === 'nota' || enl.notaId) && Number.isFinite(el.x) && Number.isFinite(el.ancho)) {
      ctx.save();
      limpiarSombra(ctx);
      dibujarInsigniaEnlace(ctx, el.x + el.ancho - 4, el.y - 4);
      ctx.restore();
    }
  }
}

// Dibuja la insignia de elemento bloqueado (candado visible)
function dibujarInsigniaBloqueo(ctx, cx, cy, seleccionada) {
  ctx.save();
  ctx.fillStyle = seleccionada ? '#d97706' : 'rgba(75, 85, 99, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 2.8, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(cx - 3.5, cy - 2, 7, 5.5);
  ctx.restore();
}

export function dibujar(ctx, opciones) {
  const {
    camara, ancho: an, alto: al, dpr, lista, escena, seleccion, marco, lazo = null, mostrarManijas,
    trazoActivo, fondoCache, borrador, ocultoId = null, renglones = null, guiaTexto = null,
    marcoDocumento = null, dibujadosPrevio = 0, alImagenLista = null, guiasSnap = null,
    resaltadosBusqueda = null, coincidenciaActiva = null, contenedor = null, alPedirFondoMarco = null,
    estilos = null, puertosConector = null, puertoConectorActivo = null,
  } = opciones;
  const ancho = an, alto = al;
  if (fondoCache) {
    // Mientras se escribe: la escena ya dibujada se reutiliza y solo se redibuja el trazo en curso.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fondoCache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (trazoActivo) {
      ctx.save(); ctx.scale(camara.zoom, camara.zoom); ctx.translate(-camara.x, -camara.y);
      dibujarTrazo(ctx, trazoActivo);
      ctx.restore();
    }
    return { dibujados: dibujadosPrevio };
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const listaMarcos = Array.isArray(marcoDocumento)
    ? marcoDocumento
    : (marcoDocumento ? [marcoDocumento] : null);

  if (listaMarcos && listaMarcos.length) {
    // Mesa de trabajo alrededor de las hojas o fichas
    ctx.fillStyle = '#e8ecf4';
    ctx.fillRect(0, 0, ancho, alto);

    for (const m of listaMarcos) {
      const mx = (m.x - camara.x) * camara.zoom;
      const my = (m.y - camara.y) * camara.zoom;
      const mw = m.ancho * camara.zoom;
      const mh = m.alto * camara.zoom;
      // Solo dibujar marcos visibles en la vista actual
      if (mx + mw < 0 || mx > ancho || my + mh < 0 || my > alto) continue;

      ctx.save();
      ctx.shadowColor = 'rgba(20, 25, 43, 0.16)';
      ctx.shadowBlur = 18 * Math.min(2, Math.max(0.5, camara.zoom));
      ctx.shadowOffsetY = 4 * Math.min(2, Math.max(0.5, camara.zoom));
      const fondoMarco = m.fondo || opciones.fondoDocumento || opciones.fondoMarco || null;
      if (fondoMarco) {
        dibujarFondoEnRect(ctx, fondoMarco, { x: mx, y: my, ancho: mw, alto: mh });
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx, my, mw, mh);
      }
      ctx.restore();

      // Renderizado del fondo de la página (ej. página de PDF con sus vectores y textos)
      if (alPedirFondoMarco) {
        const fondo = alPedirFondoMarco(m.numero, camara.zoom);
        if (fondo) {
          try {
            ctx.drawImage(fondo, mx, my, mw, mh);
          } catch {}
        }
      }

      ctx.strokeStyle = '#c5ceea';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, mw, mh);

      if (m.encabezadoTexto) {
        ctx.fillStyle = '#6b7280';
        ctx.font = `${Math.max(10, Math.round(12 * camara.zoom))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(m.encabezadoTexto, mx + mw / 2, my + Math.max(14, 22 * camara.zoom));
      }

      // Notas al pie al pie de la página correspondiente
      if (Array.isArray(m.notasAlPie) && m.notasAlPie.length > 0) {
        const cantNotas = m.notasAlPie.length;
        const pasoNota = Math.max(12, Math.round(15 * camara.zoom));
        const margenInf = Math.max(26, Math.round(36 * camara.zoom));
        const ySep = my + mh - margenInf - (cantNotas * pasoNota);

        // Línea divisoria
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, Math.round(1 * camara.zoom));
        ctx.beginPath();
        const sepX = mx + Math.max(20, Math.round(60 * camara.zoom));
        ctx.moveTo(sepX, ySep);
        ctx.lineTo(sepX + Math.max(60, Math.round(120 * camara.zoom)), ySep);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.font = `${Math.max(8, Math.round(11 * camara.zoom))}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        m.notasAlPie.forEach((n, idx) => {
          const ny = ySep + (idx + 1) * pasoNota - 2;
          ctx.fillText(`${n.numero}. ${n.texto}`, sepX, ny);
        });
      }

      const textoPie = m.pieTexto || (m.mostrarNumero ? `Página ${m.numero}` : '');
      if (textoPie) {
        ctx.fillStyle = '#868e96';
        ctx.font = `${Math.max(10, Math.round(12 * camara.zoom))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(textoPie, mx + mw / 2, my + mh - Math.max(10, 14 * camara.zoom));
      }
    }
  } else {
    const fondoCanvas = opciones.fondoCanvas || opciones.fondoDocumento || null;
    if (fondoCanvas) {
      dibujarFondoEnRect(ctx, fondoCanvas, { x: 0, y: 0, ancho, alto });
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ancho, alto);
    }
  }

  // Renglones: capa de fondo, debajo de todo y sin relación con los elementos (Etapa 8).
  if (renglones) dibujarRenglones(ctx, renglones.cfg, camara, ancho, alto, renglones.opacidad, marcoDocumento);
  const vista = visibleEnMundo(camara, ancho, alto);

  const margen = 12 / camara.zoom;
  const zona = { x: vista.x - margen, y: vista.y - margen, ancho: vista.ancho + 2 * margen, alto: vista.alto + 2 * margen };
  let dibujados = 0;
  ctx.save();
  ctx.scale(camara.zoom, camara.zoom);
  ctx.translate(-camara.x, -camara.y);
  const diminuto = 0.5 / camara.zoom; // un trazo más chico que medio píxel no se ve: no se dibuja
  for (const el of lista) {
    if (el.id === ocultoId || !rectsSeCruzan(el, zona)) continue; // el texto que se está editando lo muestra el editor
    if (el.tipo === 'trazo' && el.ancho < diminuto && el.alto < diminuto) continue;
    dibujarElemento(ctx, el, camara.zoom, guiaTexto, alImagenLista ? (canvas) => alImagenLista(canvas, opciones) : null, estilos, opciones.opcionesOculto);
    dibujados++;
  }
  if (trazoActivo) dibujarTrazo(ctx, trazoActivo);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Insignias visibles para elementos bloqueados en la escena
  for (const el of lista) {
    if (el.bloqueado && rectsSeCruzan(el, zona)) {
      const bx = (el.x + el.ancho - camara.x) * camara.zoom + 2;
      const by = (el.y - camara.y) * camara.zoom - 2;
      dibujarInsigniaBloqueo(ctx, bx, by, seleccion.has(el.id));
    }
  }

  // Guías inteligentes magnéticas activas durante el arrastre
  if (guiasSnap && guiasSnap.length) {
    ctx.save();
    ctx.strokeStyle = '#e11d48'; // Magenta/rojo vibrante de guía inteligente
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const g of guiasSnap) {
      if (g.tipo === 'x') {
        const sx = (g.valor - camara.x) * camara.zoom;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, alto);
        ctx.stroke();
      } else if (g.tipo === 'y') {
        const sy = (g.valor - camara.y) * camara.zoom;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(ancho, sy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Resaltado de coincidencias de búsqueda en el documento (Etapa 18B)
  if (resaltadosBusqueda && Array.isArray(resaltadosBusqueda) && resaltadosBusqueda.length) {
    ctx.save();
    for (const r of resaltadosBusqueda) {
      if (!r) continue;
      if (contenedor && r.contenedor && r.contenedor !== contenedor) continue;
      const rx = (r.x - camara.x) * camara.zoom;
      const ry = (r.y - camara.y) * camara.zoom;
      const rw = r.ancho * camara.zoom;
      const rh = r.alto * camara.zoom;

      if (rx + rw < -10 || rx > ancho + 10 || ry + rh < -10 || ry > alto + 10) continue;

      const esActiva = coincidenciaActiva && coincidenciaActiva.id === r.id;

      if (esActiva) {
        // Coincidencia activa: marco dorado prominente con relleno suave
        ctx.fillStyle = 'rgba(245, 158, 11, 0.40)';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);
        ctx.strokeRect(rx - 3, ry - 3, rw + 6, rh + 6);
      } else {
        // Otras coincidencias: resaltado suave amarillo translúcido
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.55)';
        ctx.lineWidth = 1;
        ctx.fillRect(rx - 2, ry - 2, rw + 4, rh + 4);
        ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);
      }
    }
    ctx.restore();
  }

  // Selección, manijas y marco, en píxeles de pantalla para que no cambien de grosor con el zoom.
  for (const id of seleccion) {
    const el = escena.get(id);
    if (!el) continue;
    const x = (el.x - camara.x) * camara.zoom - 3, y = (el.y - camara.y) * camara.zoom - 3;
    const w = el.ancho * camara.zoom + 6, h = el.alto * camara.zoom + 6;
    if (x > ancho || y > alto || x + w < 0 || y + h < 0) continue;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = el.bloqueado ? '#d97706' : AZUL;
    if (el.bloqueado) {
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  }
  if (mostrarManijas) {
    if (mostrarManijas.esGrupo) {
      const gx = (mostrarManijas.x - camara.x) * camara.zoom, gy = (mostrarManijas.y - camara.y) * camara.zoom;
      const gw = mostrarManijas.ancho * camara.zoom, gh = mostrarManijas.alto * camara.zoom;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = AZUL;
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = AZUL;
    for (const m of manijas(mostrarManijas)) {
      const x = (m.x - camara.x) * camara.zoom, y = (m.y - camara.y) * camara.zoom;
      ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10);
    }
  }
  if (marco) {
    const x = (marco.x - camara.x) * camara.zoom, y = (marco.y - camara.y) * camara.zoom;
    ctx.fillStyle = 'rgba(35,80,216,0.08)'; ctx.fillRect(x, y, marco.ancho * camara.zoom, marco.alto * camara.zoom);
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeRect(x, y, marco.ancho * camara.zoom, marco.alto * camara.zoom); ctx.setLineDash([]);
  }
  if (lazo && lazo.length > 1) {
    ctx.save();
    ctx.beginPath();
    const p0x = (lazo[0][0] - camara.x) * camara.zoom;
    const p0y = (lazo[0][1] - camara.y) * camara.zoom;
    ctx.moveTo(p0x, p0y);
    for (let i = 1; i < lazo.length; i++) {
      const px = (lazo[i][0] - camara.x) * camara.zoom;
      const py = (lazo[i][1] - camara.y) * camara.zoom;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(35,80,216,0.08)';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = AZUL;
    ctx.stroke();
    ctx.restore();
  }
  if (borrador) {
    ctx.beginPath(); ctx.arc(borrador.x, borrador.y, borrador.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,25,43,0.05)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,25,43,0.55)'; ctx.stroke();
  }
  if (Array.isArray(puertosConector) && puertosConector.length > 0) {
    ctx.save();
    for (const p of puertosConector) {
      const px = (p.x - camara.x) * camara.zoom;
      const py = (p.y - camara.y) * camara.zoom;
      const esActivo = puertoConectorActivo && puertoConectorActivo.elementoId === p.elementoId && puertoConectorActivo.id === p.id;
      ctx.beginPath();
      ctx.arc(px, py, (esActivo ? 6 : 4) * Math.min(1.5, Math.max(0.7, camara.zoom)), 0, Math.PI * 2);
      ctx.fillStyle = esActivo ? '#2563eb' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = (esActivo ? 2.5 : 1.5) * Math.min(1.5, Math.max(0.7, camara.zoom));
      ctx.strokeStyle = esActivo ? '#1d4ed8' : '#3b82f6';
      ctx.stroke();
    }
    ctx.restore();
  }
  if (opciones.instrumentoPrecision) {
    dibujarInstrumento(ctx, opciones.instrumentoPrecision, camara, ancho, alto);
  }
  return { dibujados };
}
