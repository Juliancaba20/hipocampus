// Dibujo del texto enriquecido en el lienzo (Etapa 6): mide con canvas, guarda la maquetación
// en caché y ejecuta las órdenes de dibujo que devuelve maquetar().
import { BLOQUES, fuente } from './estilo.js';
import { maquetar } from './maquetar.js';
import { tamanoDe } from './modelo.js';

const tamDeFuente = (f) => parseFloat(/([\d.]+)px/.exec(f)?.[1]) || 16;
let ctxMedida;
let version = 0;
const anchos = new Map();
const metricas = new Map();

function contexto() {
  if (ctxMedida !== undefined) return ctxMedida;
  try { ctxMedida = (typeof document !== 'undefined' && document.createElement('canvas').getContext('2d')) || null; } catch { ctxMedida = null; }
  return ctxMedida;
}

// Mide con el canvas real; sin canvas (pruebas) se estima, con valores estables.
export const medidorCanvas = {
  ancho(f, texto) {
    const k = `${f}|${texto}`;
    let w = anchos.get(k);
    if (w === undefined) {
      const ctx = contexto();
      let m;
      if (ctx) { ctx.font = f; m = ctx.measureText(texto); }
      w = m && typeof m.width === 'number' ? m.width : texto.length * tamDeFuente(f) * 0.55;
      if (anchos.size > 20000) anchos.clear();
      anchos.set(k, w);
    }
    return w;
  },
  metricas(f) {
    let m = metricas.get(f);
    if (!m) {
      const t = tamDeFuente(f);
      const ctx = contexto();
      let r;
      if (ctx) { ctx.font = f; r = ctx.measureText('Hg'); }
      const asc = r && Number.isFinite(r.fontBoundingBoxAscent) ? r.fontBoundingBoxAscent : t * 0.95;
      const desc = r && Number.isFinite(r.fontBoundingBoxDescent) ? r.fontBoundingBoxDescent : t * 0.25;
      m = { asc, desc };
      metricas.set(f, m);
    }
    return m;
  },
};

// Hay que llamarla cuando termina de cargar una tipografía: las medidas anteriores ya no valen.
export function invalidarMetricas() { version++; anchos.clear(); metricas.clear(); }

const cache = new WeakMap(); // datos → { ancho, version, medidor, interlineado, estilos, layout }
export function layoutDe(datos, ancho, medidor = medidorCanvas, opciones = {}) {
  const interlineado = datos.composicion === 'guiada' ? opciones.interlineado : null;
  const estilos = opciones.estilos || null;
  const c = cache.get(datos);
  if (c && c.ancho === ancho && c.version === version && c.medidor === medidor && c.interlineado === interlineado && c.estilos === estilos) return c.layout;
  const layout = maquetar(datos, ancho, medidor, { interlineado, estilos });
  cache.set(datos, { ancho, version, medidor, interlineado, estilos, layout });
  return layout;
}

// Distancia desde el borde superior del texto hasta la línea de base de su primer renglón (para apoyarlo en un renglón del fondo).
export function baseDelPrimerRenglon(datos, ancho, opciones = {}) {
  const L = layoutDe(datos, ancho, medidorCanvas, opciones);
  if (L.textos.length) return L.textos[0].y;
  const t = tamanoDe(datos), m = medidorCanvas.metricas(fuente({}, t));
  const lh = datos.composicion === 'guiada' && opciones.interlineado > 0 ? opciones.interlineado : t * BLOQUES.parrafo.interlinea;
  return (lh - (m.asc + m.desc)) / 2 + m.asc;
}

export function pintarTexto(ctx, el, guia, estilos = null, opcionesOculto = null) {
  const L = layoutDe(el.datos, el.ancho, medidorCanvas, { interlineado: guia?.interlineado, estilos });
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.globalAlpha = 1;
  for (const f of L.fondos) { ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, f.w, f.h); }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let fa = '', ca = '';
  for (const t of L.textos) {
    if (t.fuente !== fa) { ctx.font = t.fuente; fa = t.fuente; }
    if (t.color !== ca) { ctx.fillStyle = t.color; ca = t.color; }
    ctx.fillText(t.texto, t.x, t.y);
  }
  ctx.lineCap = 'butt';
  for (const l of L.lineas) {
    ctx.strokeStyle = l.color; ctx.lineWidth = l.grosor;
    if (l.trazos) ctx.setLineDash(l.trazos); else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
  }

  // Representación visual de texto oculto (cloze)
  if (Array.isArray(L.ocultos) && L.ocultos.length > 0) {
    if (opcionesOculto && opcionesOculto.activo) {
      for (const oc of L.ocultos) {
        const clave = `${el.id}-${oc.indice}`;
        const estaRevelado = (opcionesOculto.revelados && opcionesOculto.revelados.has(clave)) || !!opcionesOculto.revelarTodo;
        const rx = oc.x - 2, ry = oc.y - 1, rw = oc.w + 4, rh = oc.h + 2;

        if (!estaRevelado) {
          // Tapado: caja opaca con [...]
          ctx.fillStyle = '#eff6ff';
          const radio = Math.min(4, rh / 2);
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, radio);
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.stroke();
          } else {
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.strokeRect(rx, ry, rw, rh);
          }
          ctx.fillStyle = '#1d4ed8';
          ctx.font = `bold ${Math.max(11, Math.min(16, rh * 0.7))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('[...]', rx + rw / 2, ry + rh / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        } else {
          // Revelado: resaltado verde suave y línea punteada
          ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(rx, ry + rh);
          ctx.lineTo(rx + rw, ry + rh);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    } else if (!opcionesOculto?.modoImpresionLimpio) {
      // Modo edición o vista regular: marca visual de cloze
      for (const oc of L.ocultos) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
        ctx.fillRect(oc.x - 2, oc.y, oc.w + 4, oc.h);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(oc.x - 2, oc.y + oc.h);
        ctx.lineTo(oc.x + oc.w + 2, oc.y + oc.h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  ctx.restore();
}
