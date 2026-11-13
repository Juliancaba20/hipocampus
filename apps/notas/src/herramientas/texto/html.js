// Conversión entre HTML y el modelo de texto (Etapas 6 y 20A).
//  · domAModelo / htmlAModelo: leen lo que hay en el editor o en el portapapeles (Word, web, Google Docs…).
//    Solo se conserva lo que el modelo conoce; nada del HTML original se copia tal cual.
//  · modeloAHtml: genera el HTML del editor y del portapapeles, siempre escapado.
import { CATALOGO_FUENTES, NIVEL_MAX, SANGRIA_MAX, SANGRIA_PASO, TABLA } from './estilo.js';
import { colorSeguro, crearRun, normalizarBloques, sanear, unirRuns } from './modelo.js';

const NOMBRES = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', purple: '#800080', gray: '#808080', grey: '#808080',
  cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', lime: '#00ff00',
  pink: '#ffc0cb', brown: '#a52a2a', navy: '#000080', teal: '#008080', silver: '#c0c0c0',
  maroon: '#800000', olive: '#808000', darkblue: '#00008b', darkred: '#8b0000', darkgreen: '#006400',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
};
const h2 = (n) => Math.max(0, Math.min(255, Math.round(+n))).toString(16).padStart(2, '0');

// Cualquier color CSS razonable → '#rrggbb' (o null si es transparente o desconocido).
export function colorAHex(valor) {
  if (!valor) return null;
  const v = String(valor).trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'inherit' || v === 'initial' || v === 'windowtext') return null;
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return `#${[...m[1]].map((c) => c + c).join('')}`;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) return m[2] === '00' ? null : `#${m[1]}`;
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return `#${h2(m[1])}${h2(m[2])}${h2(m[3])}`;
  }
  return NOMBRES[v] || null;
}

const BLOQUES_HTML = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'DL', 'DT', 'DD', 'FORM', 'FIELDSET', 'CENTER']);
const ESTRUCTURA = new Set([...BLOQUES_HTML, 'UL', 'OL', 'TABLE']);
const IGNORADOS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'IMG', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'O:P', 'HR']);

const estiloAttr = (el) => (el.getAttribute && el.getAttribute('style')) || '';

function extraerFamilia(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  if (s.includes('mono') || s.includes('courier') || s.includes('consolas') || s.includes('menlo')) return 'mono';
  if (s.includes('sans') || s.includes('arial') || s.includes('helvetica') || s.includes('bricolage') || s.includes('system-ui')) return 'sans';
  if (s.includes('serif') || s.includes('georgia') || s.includes('times')) return 'serif';
  return null;
}

function extraerTamanoPx(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  let m = /^([\d.]+)px$/.exec(s);
  if (m) {
    const px = parseFloat(m[1]);
    return Number.isFinite(px) && px >= 8 && px <= 140 ? Math.round(px) : null;
  }
  m = /^([\d.]+)pt$/.exec(s);
  if (m) {
    const px = parseFloat(m[1]) * (96 / 72);
    return Number.isFinite(px) && px >= 8 && px <= 140 ? Math.round(px) : null;
  }
  return null;
}

function formatoDe(el, base, op) {
  const t = el.tagName.toUpperCase();
  const f = { ...base };
  if (t === 'B' || t === 'STRONG') f.negrita = true;
  else if (t === 'I' || t === 'EM' || t === 'CITE' || t === 'VAR') f.cursiva = true;
  else if (t === 'U' || t === 'INS') f.subrayado = true;
  else if (t === 'S' || t === 'STRIKE' || t === 'DEL') f.tachado = true;
  else if (t === 'SUB') f.script = 'sub';
  else if (t === 'SUP') {
    f.script = 'super';
    const pie = el.getAttribute('data-nt-nota-pie');
    if (pie) f.notaAlPie = pie;
  }
  else if (t === 'A') {
    const href = el.getAttribute('href');
    if (href) {
      f.enlace = {
        tipo: el.getAttribute('data-nt-link-tipo') || 'web',
        url: href,
        notaId: el.getAttribute('data-nt-nota-id') || null,
      };
    }
  }
  else if (t === 'FONT') {
    const c = colorAHex(el.getAttribute('color')); if (c) f.color = c;
    const face = extraerFamilia(el.getAttribute('face')); if (face) f.fuente = face;
    const size = parseInt(el.getAttribute('size'), 10);
    if (size >= 1 && size <= 7) {
      const mapaTam = [10, 12, 14, 18, 24, 32, 48];
      f.tamano = mapaTam[size - 1];
    }
  }

  if (el.classList?.contains?.('nt-oculto') || el.getAttribute?.('data-nt-oculto') === '1') {
    f.oculto = true;
  }

  const s = el.style;
  if (s) {
    const w = String(s.fontWeight || '').trim();
    if (w) f.negrita = /^(bold|bolder|[6-9]00)$/.test(w);
    const fs = String(s.fontStyle || '').trim();
    if (fs) f.cursiva = /^(italic|oblique)/.test(fs);
    const d = String(s.textDecorationLine || s.textDecoration || '');
    if (d) {
      if (/underline/.test(d)) f.subrayado = true;
      if (/line-through/.test(d)) f.tachado = true;
      if (/^\s*none/.test(d)) { f.subrayado = false; f.tachado = false; }
    }
    const c = colorAHex(s.color);
    if (c) f.color = c;
    let bg = colorAHex(s.backgroundColor);
    if (!bg) { const m = /mso-highlight:\s*([a-z]+)/i.exec(estiloAttr(el)); if (m) bg = NOMBRES[m[1].toLowerCase()] || null; }
    if (bg && bg !== '#ffffff') f.resaltado = bg;

    const va = String(s.verticalAlign || '').trim().toLowerCase();
    if (va === 'sub') f.script = 'sub';
    else if (va === 'super') f.script = 'super';

    const fam = extraerFamilia(s.fontFamily);
    if (fam) f.fuente = fam;

    const tpx = extraerTamanoPx(s.fontSize);
    if (tpx) f.tamano = tpx;
  }
  // El color de tinta base y el negro de una página pegada no se guardan: así el texto sigue el color del bloque.
  if (f.color && (f.color === op.colorBase || (op.colapsar && f.color === '#000000'))) delete f.color;
  return f;
}

function alinearDe(el) {
  const a = String((el.style && el.style.textAlign) || (el.getAttribute && el.getAttribute('align')) || '').toLowerCase();
  return a === 'center' ? 'centro' : a === 'right' || a === 'end' ? 'derecha' : a === 'justify' ? 'justificado' : undefined;
}

function extrasDeBloque(el) {
  const ex = {};
  const al = alinearDe(el);
  if (al) ex.alinear = al;
  if (el.getAttribute) {
    const attrEstilo = el.getAttribute('data-nt-estilo');
    if (attrEstilo) ex.estilo = attrEstilo.slice(0, 50);
    const attrSalto = el.getAttribute('data-nt-salto-pagina');
    if (attrSalto === '1') ex.saltoPagina = true;

    const attrSangria = parseInt(el.getAttribute('data-nt-sangria') || el.getAttribute('data-sangria'), 10);
    if (Number.isFinite(attrSangria) && attrSangria > 0) {
      ex.sangria = Math.min(SANGRIA_MAX, attrSangria);
    }
  }
  const s = el.style;
  if (s) {
    const lh = parseFloat(s.lineHeight);
    if (Number.isFinite(lh) && lh >= 0.8 && lh <= 3) ex.interlineado = Math.round(lh * 100) / 100;
    const ml = s.marginLeft || s.paddingLeft;
    if (ml && ex.sangria === undefined) {
      const mlStr = String(ml).trim();
      if (mlStr.endsWith('em')) {
        const em = parseFloat(mlStr);
        if (Number.isFinite(em) && em > 0) {
          ex.sangria = Math.min(SANGRIA_MAX, Math.max(1, Math.round(em / SANGRIA_PASO)));
        }
      } else if (mlStr.endsWith('pt')) {
        const pt = parseFloat(mlStr);
        if (Number.isFinite(pt) && pt > 12) {
          ex.sangria = Math.min(SANGRIA_MAX, Math.max(1, Math.round(pt / 18)));
        }
      } else {
        const px = parseFloat(mlStr);
        if (Number.isFinite(px) && px > 15) {
          ex.sangria = Math.min(SANGRIA_MAX, Math.max(1, Math.round(px / 24)));
        }
      }
    }
  }
  return ex;
}

function tipoDe(t) { return t === 'H1' ? 'titulo1' : t === 'H2' ? 'titulo2' : /^H[3-6]$/.test(t) ? 'titulo3' : 'parrafo'; }

// Listas de Word: <p style="mso-list:l0 level2 lfo1"> con una marca dentro de un span «mso-list:Ignore».
function listaMso(el) {
  const m = /mso-list:\s*([^;]+)/i.exec(estiloAttr(el));
  if (!m || /^\s*(none|ignore)/i.test(m[1])) return null;
  const nivel = Math.max(0, Math.min(NIVEL_MAX, (+(/level(\d+)/i.exec(m[1]) || [0, 1])[1] || 1) - 1));
  const marca = [...el.querySelectorAll('span')].find((s) => /mso-list:\s*ignore/i.test(estiloAttr(s)));
  const txt = marca ? marca.textContent.trim() : '';
  return { tipo: /^(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]/.test(txt) ? 'numero' : 'vineta', nivel };
}

class Constructor {
  constructor(colapsar) { this.colapsar = colapsar; this.bloques = []; this.actual = null; this.pre = 0; }

  abrir(tipo, extra = {}) { this.cerrar(); this.actual = { tipo, ...extra, runs: [], explicito: true }; }

  cerrar() {
    const b = this.actual;
    this.actual = null;
    if (!b) return;
    this._terminar(b);
    if (b.explicito || b.runs.some((r) => r.texto.trim() !== '')) {
      const { explicito, ...limpio } = b; void explicito;
      if (limpio.alinear === undefined) delete limpio.alinear;
      if (limpio.nivel === undefined) delete limpio.nivel;
      if (limpio.interlineado === undefined) delete limpio.interlineado;
      if (limpio.sangria === undefined) delete limpio.sangria;
      if (limpio.estilo === undefined) delete limpio.estilo;
      if (!limpio.saltoPagina) delete limpio.saltoPagina;
      this.bloques.push(limpio);
    }
  }

  saltoPagina() {
    this.cerrar();
    this.bloques.push({ tipo: 'saltoPagina', saltoPagina: true, runs: [] });
  }

  texto(str, fmt) {
    if (!str) return;
    if (!this.actual) this.actual = { tipo: 'parrafo', runs: [], explicito: false };
    let s = str.replace(/\u200b/g, '');
    if (this.colapsar && !this.pre) s = s.replace(/[ \t\r\n\f]+/g, ' ').replace(/\u00a0/g, '\uE000');
    else s = s.replace(/\u00a0/g, ' ');
    this.actual.runs.push(crearRun(s, fmt));
  }

  salto(fmt) {
    if (!this.actual) this.actual = { tipo: 'parrafo', runs: [], explicito: false };
    this.actual.runs.push(crearRun('\n', fmt));
  }

  tabla(t) { this.cerrar(); if (t) this.bloques.push(t); }

  _terminar(b) {
    if (this.colapsar) {
      let prev = '\n';
      for (const r of b.runs) {
        let out = '';
        for (const ch of r.texto) {
          if (ch === ' ' && (prev === ' ' || prev === '\n')) continue;
          if (ch === '\n' && prev === ' ') out = out.replace(/ $/, '');
          out += ch; prev = ch;
        }
        r.texto = out;
      }
      const u = b.runs[b.runs.length - 1];
      if (u) u.texto = u.texto.replace(/ $/, '');
    }
    const u = b.runs[b.runs.length - 1];
    if (u) u.texto = u.texto.replace(/\n$/, ''); // el <br> final es solo el marcador de línea vacía
    b.runs.forEach((r) => { r.texto = r.texto.replace(/\uE000/g, ' '); });
    b.runs = unirRuns(b.runs);
  }
}

const tieneHijosBloque = (el) => [...el.children].some((h) => ESTRUCTURA.has(h.tagName.toUpperCase()));

function hijos(el, fmt, c, op) { for (const h of [...el.childNodes]) recorrer(h, fmt, c, op); }

function item(li, tipo, nivel, fmt, c, op) {
  const n = Math.min(nivel, NIVEL_MAX);
  c.abrir(tipo, { nivel: n, ...extrasDeBloque(li) });
  const f = formatoDe(li, fmt, op);
  for (const h of [...li.childNodes]) {
    const t = h.nodeType === 1 ? h.tagName.toUpperCase() : '';
    if (t === 'UL' || t === 'OL') { listar(h, n + 1, f, c, op); continue; }
    if (BLOQUES_HTML.has(t)) {
      if (!c.actual) c.abrir(tipo, { nivel: n, ...extrasDeBloque(h) });
      else if (c.actual.runs.length) c.salto(f);
      if (c.actual && !c.actual.alinear) { const a = alinearDe(h); if (a) c.actual.alinear = a; }
      hijos(h, formatoDe(h, f, op), c, op);
      continue;
    }
    recorrer(h, f, c, op);
  }
  c.cerrar();
}

function listar(lista, nivel, fmt, c, op) {
  const tipo = lista.tagName.toUpperCase() === 'OL' ? 'numero' : 'vineta';
  c.cerrar();
  for (const h of [...lista.childNodes]) {
    if (h.nodeType !== 1) continue;
    const t = h.tagName.toUpperCase();
    if (t === 'LI') item(h, tipo, nivel, fmt, c, op);
    else if (t === 'UL' || t === 'OL') listar(h, nivel + 1, fmt, c, op);
    else recorrer(h, fmt, c, op);
  }
  c.cerrar();
}

function celda(td, op) {
  const sub = new Constructor(op.colapsar);
  hijos(td, {}, sub, op);
  sub.cerrar();
  const runs = [];
  sub.bloques.filter((b) => b.tipo !== 'tabla').forEach((b, i) => { if (i > 0) runs.push(crearRun('\n')); runs.push(...b.runs); });
  const cData = { runs: unirRuns(runs) };

  const cs = parseInt(td.getAttribute('colspan'), 10);
  if (Number.isFinite(cs) && cs > 1) cData.colspan = Math.min(TABLA.maxColumnas, cs);
  const rs = parseInt(td.getAttribute('rowspan'), 10);
  if (Number.isFinite(rs) && rs > 1) cData.rowspan = Math.min(TABLA.maxFilas, rs);

  const bg = colorAHex(td.style?.backgroundColor || td.getAttribute('bgcolor'));
  if (bg && bg !== '#ffffff') cData.fondo = bg;

  const va = String(td.style?.verticalAlign || td.getAttribute('valign') || '').trim().toLowerCase();
  if (va === 'middle' || va === 'center') cData.alinearV = 'centro';
  else if (va === 'bottom') cData.alinearV = 'abajo';

  return cData;
}

function tabla(el, op) {
  const trs = [...el.querySelectorAll('tr')].filter((tr) => tr.closest('table') === el).slice(0, TABLA.maxFilas);
  if (!trs.length) return null;

  // Reconstruir grilla bidimensional resolviendo colspan y rowspan
  const grid = [];
  for (let r = 0; r < trs.length; r++) {
    if (!grid[r]) grid[r] = [];
    const tr = trs[r];
    let colIdx = 0;
    for (const td of [...tr.children]) {
      const t = td.tagName.toUpperCase();
      if (t !== 'TD' && t !== 'TH') continue;
      while (grid[r][colIdx]) colIdx++;
      if (colIdx >= TABLA.maxColumnas) break;

      const cData = celda(td, op);
      const cs = Math.min(TABLA.maxColumnas - colIdx, cData.colspan || 1);
      const rs = Math.min(TABLA.maxFilas - r, cData.rowspan || 1);
      if (cs > 1) cData.colspan = cs; else delete cData.colspan;
      if (rs > 1) cData.rowspan = rs; else delete cData.rowspan;

      grid[r][colIdx] = cData;

      for (let dr = 0; dr < rs; dr++) {
        const trgR = r + dr;
        if (!grid[trgR]) grid[trgR] = [];
        for (let dc = 0; dc < cs; dc++) {
          if (dr === 0 && dc === 0) continue;
          grid[trgR][colIdx + dc] = { runs: [], combinada: true };
        }
      }
      colIdx += cs;
    }
  }

  const maxCols = Math.max(1, ...grid.map((f) => (f ? f.length : 0)));
  const filas = [];
  for (let r = 0; r < trs.length; r++) {
    const fila = [];
    for (let c = 0; c < maxCols; c++) {
      fila.push((grid[r] && grid[r][c]) || { runs: [] });
    }
    filas.push(fila);
  }
  if (!filas.length) return null;

  const primera = trs[0] ? [...trs[0].children].filter((x) => /^T[DH]$/i.test(x.tagName)) : [];
  const encabezado = el.getAttribute('data-enc') === '1' || (primera.length > 0 && primera.every((x) => x.tagName.toUpperCase() === 'TH'));
  const res = { tipo: 'tabla', encabezado, filas };

  // Anchos de columnas si están especificados en <col> o celdas
  const cols = [...el.querySelectorAll('col')].filter((c) => c.closest('table') === el);
  if (cols.length === maxCols) {
    const anchos = cols.map((c) => parseFloat(c.style?.width || c.getAttribute('width')) || 1);
    if (anchos.every((w) => w > 0)) res.anchosColumnas = anchos;
  }

  // Atributos de bordes
  const attrBordeEstilo = el.getAttribute('data-borde-estilo');
  if (attrBordeEstilo) res.bordeEstilo = attrBordeEstilo;
  const attrBordeColor = colorAHex(el.getAttribute('data-borde-color') || el.style?.borderColor);
  if (attrBordeColor) res.bordeColor = attrBordeColor;
  const attrBordeGrosor = parseInt(el.getAttribute('data-borde-grosor') || el.style?.borderWidth, 10);
  if (Number.isFinite(attrBordeGrosor)) res.bordeGrosor = attrBordeGrosor;

  return res;
}

function recorrer(nodo, fmt, c, op) {
  if (nodo.nodeType === 3) { c.texto(nodo.nodeValue, fmt); return; }
  if (nodo.nodeType !== 1) return;
  const t = nodo.tagName.toUpperCase();
  if (IGNORADOS.has(t)) return;
  if (/mso-list:\s*ignore/i.test(estiloAttr(nodo))) return;
  if (t === 'BR') { c.salto(fmt); return; }
  if (t === 'HR' && (nodo.getAttribute('data-nt-salto-pagina') === '1' || (nodo.className && nodo.className.includes('nt-salto-pagina')))) {
    c.saltoPagina();
    return;
  }
  if (t === 'TABLE') { c.tabla(tabla(nodo, op)); return; }
  if (t === 'UL' || t === 'OL') { listar(nodo, 0, fmt, c, op); return; }
  const f = formatoDe(nodo, fmt, op);
  if (BLOQUES_HTML.has(t)) {
    if (tieneHijosBloque(nodo)) { c.cerrar(); hijos(nodo, f, c, op); c.cerrar(); return; }
    const mso = listaMso(nodo);
    const ex = extrasDeBloque(nodo);
    if (mso) c.abrir(mso.tipo, { nivel: mso.nivel, ...ex });
    else c.abrir(tipoDe(t), ex);
    if (t === 'PRE') c.pre++;
    hijos(nodo, f, c, op);
    if (t === 'PRE') c.pre--;
    c.cerrar();
    return;
  }
  hijos(nodo, f, c, op);
}

// raiz: elemento del editor o <body> de un documento analizado. colapsar: aplicar las reglas de espacios de HTML (contenido externo).
export function domAModelo(raiz, { colapsar = false, colorBase = null } = {}) {
  const op = { colapsar, colorBase };
  const c = new Constructor(colapsar);
  hijos(raiz, {}, c, op);
  c.cerrar();
  return normalizarBloques(c.bloques);
}

export function htmlAModelo(html, opciones = {}) {
  const DP = globalThis.DOMParser || (globalThis.window && globalThis.window.DOMParser);
  if (!DP || !html) return [];
  const doc = new DP().parseFromString(String(html), 'text/html');
  return domAModelo(doc.body, { colapsar: true, ...opciones });
}

// ---------- modelo → HTML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function runsAHtml(runs) {
  return runs.map((r) => {
    const est = [];
    if (r.negrita) est.push('font-weight:700');
    if (r.cursiva) est.push('font-style:italic');
    const dec = [r.subrayado && 'underline', r.tachado && 'line-through'].filter(Boolean);
    if (dec.length) est.push(`text-decoration:${dec.join(' ')}`);
    const c = colorSeguro(r.color); if (c) est.push(`color:${c}`);
    const h = colorSeguro(r.resaltado); if (h) est.push(`background-color:${h}`);
    if (r.fuente && r.fuente !== 'serif' && CATALOGO_FUENTES[r.fuente]) {
      est.push(`font-family:${CATALOGO_FUENTES[r.fuente].familia}`);
    }
    if (r.tamano && Number.isFinite(+r.tamano)) {
      est.push(`font-size:${Math.round(+r.tamano)}px`);
    }
    let t = esc(r.texto).replace(/\n/g, '<br>');
    if (r.script === 'sub') t = `<sub>${t}</sub>`;
    else if (r.script === 'super') t = `<sup>${t}</sup>`;
    if (est.length) t = `<span style="${est.join(';')}">${t}</span>`;
    if (r.oculto) t = `<span class="nt-oculto" data-nt-oculto="1">${t}</span>`;

    if (r.enlace && r.enlace.url) {
      const notaAttr = r.enlace.notaId ? ` data-nt-nota-id="${esc(r.enlace.notaId)}"` : '';
      t = `<a href="${esc(r.enlace.url)}" target="_blank" rel="noopener noreferrer" data-nt-link-tipo="${esc(r.enlace.tipo || 'web')}"${notaAttr}>${t}</a>`;
    }
    if (r.notaAlPie) {
      t += `<sup class="nt-nota-pie" data-nt-nota-pie="${esc(r.notaAlPie)}">[*]</sup>`;
    }
    return t;
  }).join('');
}

function interiorBloque(runs) {
  const h = runsAHtml(runs);
  if (!runs.length) return '<br>';
  return runs[runs.length - 1].texto.endsWith('\n') ? `${h}<br>` : h;
}

const estiloBloque = (b) => {
  const est = [];
  if (b.alinear && b.alinear !== 'izquierda') {
    est.push(`text-align:${b.alinear === 'centro' ? 'center' : b.alinear === 'derecha' ? 'right' : 'justify'}`);
  }
  if (b.interlineado && Number.isFinite(+b.interlineado)) {
    est.push(`line-height:${b.interlineado}`);
  }
  if (b.sangria && Number.isFinite(+b.sangria)) {
    est.push(`margin-left:${b.sangria * SANGRIA_PASO}em`);
  }
  let extraAttrs = '';
  if (b.estilo) {
    extraAttrs += ` data-nt-estilo="${esc(b.estilo)}"`;
  }
  return (est.length ? ` style="${est.join(';')}"` : '') + extraAttrs;
};

// relleno: añade un párrafo vacío tras una tabla final, para poder seguir escribiendo debajo.
export function modeloAHtml(bloques, { relleno = false } = {}) {
  const lista = sanear(bloques);
  let out = '';
  const pila = [];
  const cerrarListas = (hasta = 0) => { while (pila.length > hasta) out += `</li></${pila.pop()}>`; };
  for (const b of lista) {
    if (b.tipo === 'saltoPagina' || b.saltoPagina) {
      cerrarListas();
      out += '<hr data-nt-salto-pagina="1" class="nt-salto-pagina">';
      continue;
    }
    if (b.tipo === 'vineta' || b.tipo === 'numero') {
      const tag = b.tipo === 'numero' ? 'ol' : 'ul';
      const n = Math.min(b.nivel, pila.length);
      cerrarListas(n + 1);
      if (pila.length === n + 1) {
        if (pila[n] !== tag) { out += `</li></${pila.pop()}>`; } else out += '</li>';
      }
      while (pila.length < n + 1) { out += `<${tag}>`; pila.push(tag); }
      out += `<li${estiloBloque(b)}>${interiorBloque(b.runs)}`;
      continue;
    }
    cerrarListas();
    if (b.tipo === 'tabla') {
      let tAttrs = b.encabezado ? ' data-enc="1"' : '';
      if (b.bordeEstilo) tAttrs += ` data-borde-estilo="${esc(b.bordeEstilo)}"`;
      if (b.bordeColor) tAttrs += ` data-borde-color="${esc(b.bordeColor)}"`;
      if (b.bordeGrosor !== undefined) tAttrs += ` data-borde-grosor="${b.bordeGrosor}"`;

      let colgroupHtml = '';
      if (Array.isArray(b.anchosColumnas) && b.anchosColumnas.length) {
        const sum = b.anchosColumnas.reduce((acc, v) => acc + v, 0) || 1;
        colgroupHtml = `<colgroup>${b.anchosColumnas.map((w) => `<col style="width:${Math.round((w / sum) * 10000) / 100}%">`).join('')}</colgroup>`;
      }

      const filasHtml = b.filas.map((f) => {
        const celdasHtml = f.map((c) => {
          if (c.combinada) return '';
          let attrs = '';
          if (c.colspan > 1) attrs += ` colspan="${c.colspan}"`;
          if (c.rowspan > 1) attrs += ` rowspan="${c.rowspan}"`;
          const estilosTd = [];
          if (c.fondo) estilosTd.push(`background-color:${c.fondo}`);
          if (c.alinearV === 'centro') estilosTd.push('vertical-align:middle');
          else if (c.alinearV === 'abajo') estilosTd.push('vertical-align:bottom');
          if (estilosTd.length) attrs += ` style="${estilosTd.join(';')}"`;
          const contenido = c.runs.length ? interiorBloque(c.runs) : '<br>';
          return `<td${attrs}>${contenido}</td>`;
        }).join('');
        return `<tr>${celdasHtml}</tr>`;
      }).join('');

      out += `<table${tAttrs}>${colgroupHtml}<tbody>${filasHtml}</tbody></table>`;
      continue;
    }
    const tag = b.tipo === 'titulo1' ? 'h1' : b.tipo === 'titulo2' ? 'h2' : b.tipo === 'titulo3' ? 'h3' : 'p';
    out += `<${tag}${estiloBloque(b)}>${interiorBloque(b.runs)}</${tag}>`;
  }
  cerrarListas();
  if (!lista.length || (relleno && lista[lista.length - 1].tipo === 'tabla')) out += '<p><br></p>';
  return out;
}
