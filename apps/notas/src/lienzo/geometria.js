// Geometría del lienzo: cajas, impactos, manijas y redimensionado. Funciones puras.
export const MIN_TAM = 2;

export function normalizarRect(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), ancho: Math.abs(x2 - x1), alto: Math.abs(y2 - y1) };
}

export const rectsSeCruzan = (a, b) => a.x <= b.x + b.ancho && a.x + a.ancho >= b.x && a.y <= b.y + b.alto && a.y + a.alto >= b.y;

export function unirRects(rects) {
  if (!rects.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) { x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.ancho); y2 = Math.max(y2, r.y + r.alto); }
  return { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 };
}

// Todos los tipos de elementos son redimensionables con manijas y proporcionalidad
export const esRedimensionable = (el) => !!el && ['figura', 'imagen', 'texto', 'trazo', 'simbolo', 'icono'].includes(el.tipo);

// Formas básicas y avanzadas (Etapa 7 y 21A).
export const FORMAS = [
  'rectangulo', 'elipse', 'triangulo', 'rombo', 'linea', 'flecha',
  'estrella', 'hexagono', 'llave', 'nube', 'cilindro', 'cruz', 'flechaDoblada',
];
export const esLinea = (el) => el.tipo === 'figura' && (el.datos.forma === 'linea' || el.datos.forma === 'flecha');

export function extremosLinea(el) {
  const v = el.datos;
  const a = { x: v.volteoX ? el.x + el.ancho : el.x, y: v.volteoY ? el.y + el.alto : el.y };
  const b = { x: v.volteoX ? el.x : el.x + el.ancho, y: v.volteoY ? el.y : el.y + el.alto };
  return [a, b];
}

export function lineaDesdeExtremos(el, a, b) {
  const r = normalizarRect(a.x, a.y, b.x, b.y);
  return { ...el, ...r, datos: { ...el.datos, volteoX: b.x < a.x, volteoY: b.y < a.y } };
}

// n: 'p1' (inicio) o 'p2' (final). Devuelve la línea con ese extremo desplazado.
export function moverExtremo(el, n, dx, dy) {
  const [a, b] = extremosLinea(el);
  return n === 'p1' ? lineaDesdeExtremos(el, { x: a.x + dx, y: a.y + dy }, b) : lineaDesdeExtremos(el, a, { x: b.x + dx, y: b.y + dy });
}

// Vértices de polígonos dentro de la caja del elemento.
export function puntosForma(el) {
  const x2 = el.x + el.ancho, y2 = el.y + el.alto, xm = el.x + el.ancho / 2, ym = el.y + el.alto / 2;
  const f = el.datos?.forma;
  if (f === 'rombo') return [[xm, el.y], [x2, ym], [xm, y2], [el.x, ym]];
  if (f === 'hexagono') {
    const pts = [];
    const rx = el.ancho / 2, ry = el.alto / 2;
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 3;
      pts.push([xm + rx * Math.cos(ang), ym + ry * Math.sin(ang)]);
    }
    return pts;
  }
  if (f === 'estrella') {
    const pts = [];
    const rx = el.ancho / 2, ry = el.alto / 2;
    const irx = rx * 0.4, iry = ry * 0.4;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rX = i % 2 === 0 ? rx : irx;
      const rY = i % 2 === 0 ? ry : iry;
      pts.push([xm + rX * Math.cos(ang), ym + rY * Math.sin(ang)]);
    }
    return pts;
  }
  if (f === 'cruz') {
    const w3 = el.ancho / 3, h3 = el.alto / 3;
    return [
      [el.x + w3, el.y], [el.x + 2 * w3, el.y],
      [el.x + 2 * w3, el.y + h3], [el.x + el.ancho, el.y + h3],
      [el.x + el.ancho, el.y + 2 * h3], [el.x + 2 * w3, el.y + 2 * h3],
      [el.x + 2 * w3, el.y + el.alto], [el.x + w3, el.y + el.alto],
      [el.x + w3, el.y + 2 * h3], [el.x, el.y + 2 * h3],
      [el.x, el.y + h3], [el.x + w3, el.y + h3],
    ];
  }
  return [[xm, el.y], [x2, y2], [el.x, y2]]; // triangulo por defecto
}

export function puntoEnPoligono(pts, px, py, tol = 0) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
    if (distSegmento(px, py, xi, yi, xj, yj) <= tol) return true;
  }
  return dentro;
}

export function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ¿El punto toca el trazo? (cerca de la línea, contando su grosor y la tolerancia)
export function puntoEnTrazo(el, px, py, tol = 0) {
  const p = el.datos.puntos, r = tol + el.datos.grosor / 2;
  if (px < el.x - tol || px > el.x + el.ancho + tol || py < el.y - tol || py > el.y + el.alto + tol) return false;
  if (p.length === 1) return Math.hypot(px - p[0][0], py - p[0][1]) <= r;
  for (let i = 1; i < p.length; i++) if (distSegmento(px, py, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= r) return true;
  return false;
}

// Caja que contiene los puntos de un trazo, con la mitad del grosor de margen.
export function cajaDeTrazo(puntos, grosor) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of puntos) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
  const m = grosor / 2;
  return { x: x1 - m, y: y1 - m, ancho: x2 - x1 + grosor, alto: y2 - y1 + grosor };
}

// Quita puntos que no cambian la forma (Ramer–Douglas–Peucker, sin recursión). Conserva la presión.
export function simplificar(p, eps) {
  if (p.length < 3) return p;
  const guardar = new Uint8Array(p.length);
  guardar[0] = guardar[p.length - 1] = 1;
  const pila = [[0, p.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distSegmento(p[i][0], p[i][1], p[a][0], p[a][1], p[b][0], p[b][1]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) { guardar[idx] = 1; pila.push([a, idx], [idx, b]); }
  }
  return p.filter((_, i) => guardar[i]);
}

// Borrador de zona: quita los puntos que caen dentro del círculo y devuelve los tramos que sobreviven
// (o null si el círculo no toca el trazo). Antes interpola para que el corte sea parejo.
export function borrarZona(puntos, cx, cy, r) {
  const densos = [puntos[0]];
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    const pasos = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(r / 2, 0.5)));
    for (let k = 1; k <= pasos; k++) {
      const t = k / pasos;
      densos.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  let tocado = false, actual = [];
  const tramos = [];
  for (const q of densos) {
    if (Math.hypot(q[0] - cx, q[1] - cy) <= r) { tocado = true; if (actual.length) { tramos.push(actual); actual = []; } }
    else actual.push(q);
  }
  if (actual.length) tramos.push(actual);
  return tocado ? tramos : null;
}

export function puntoEnElemento(el, px, py, tol = 0) {
  if (el.tipo === 'trazo') return puntoEnTrazo(el, px, py, tol);
  if (esLinea(el)) {
    const [a, b] = extremosLinea(el);
    const radio = Math.max(el.datos.grosor || 2, 2) / 2 + tol;
    if (el.datos?.tipoConector === 'curvo') {
      const dx = b.x - a.x, dy = b.y - a.y;
      const factor = Math.max(30, Math.min(180, Math.hypot(dx, dy) * 0.45));
      let cp1 = { x: a.x, y: a.y }, cp2 = { x: b.x, y: b.y };
      const dirA = el.datos.anclajeInicio?.puerto;
      const dirB = el.datos.anclajeFin?.puerto;
      if (dirA === 'derecha') cp1 = { x: a.x + factor, y: a.y };
      else if (dirA === 'izquierda') cp1 = { x: a.x - factor, y: a.y };
      else if (dirA === 'arriba') cp1 = { x: a.x, y: a.y - factor };
      else if (dirA === 'abajo') cp1 = { x: a.x, y: a.y + factor };
      else cp1 = Math.abs(dx) >= Math.abs(dy) ? { x: a.x + dx * 0.5, y: a.y } : { x: a.x, y: a.y + dy * 0.5 };

      if (dirB === 'derecha') cp2 = { x: b.x + factor, y: b.y };
      else if (dirB === 'izquierda') cp2 = { x: b.x - factor, y: b.y };
      else if (dirB === 'arriba') cp2 = { x: b.x, y: b.y - factor };
      else if (dirB === 'abajo') cp2 = { x: b.x, y: b.y + factor };
      else cp2 = Math.abs(dx) >= Math.abs(dy) ? { x: b.x - dx * 0.5, y: b.y } : { x: b.x, y: b.y - dy * 0.5 };

      let prevX = a.x, prevY = a.y;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t;
        const curX = u * u * u * a.x + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * b.x;
        const curY = u * u * u * a.y + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * b.y;
        if (distSegmento(px, py, prevX, prevY, curX, curY) <= radio) return true;
        prevX = curX; prevY = curY;
      }
      return false;
    }
    return distSegmento(px, py, a.x, a.y, b.x, b.y) <= radio;
  }
  if (el.tipo === 'figura' && ['triangulo', 'rombo', 'hexagono', 'estrella', 'cruz'].includes(el.datos.forma)) return puntoEnPoligono(puntosForma(el), px, py, tol);
  if (el.tipo === 'figura' && el.datos.forma === 'elipse') {
    const rx = el.ancho / 2 + tol, ry = el.alto / 2 + tol;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (px - (el.x + el.ancho / 2)) / rx, dy = (py - (el.y + el.alto / 2)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return px >= el.x - tol && px <= el.x + el.ancho + tol && py >= el.y - tol && py <= el.y + el.alto + tol;
}

export function manijas(r) {
  const xm = r.x + r.ancho / 2, ym = r.y + r.alto / 2, x2 = r.x + r.ancho, y2 = r.y + r.alto;
  // Un texto solo se ensancha: su alto lo decide el contenido.
  if (r.tipo === 'texto') return [{ n: 'e', x: x2, y: ym }, { n: 'w', x: r.x, y: ym }];
  if (esLinea(r)) { const [a, b] = extremosLinea(r); return [{ n: 'p1', x: a.x, y: a.y }, { n: 'p2', x: b.x, y: b.y }]; }
  return [
    { n: 'nw', x: r.x, y: r.y }, { n: 'n', x: xm, y: r.y }, { n: 'ne', x: x2, y: r.y }, { n: 'e', x: x2, y: ym },
    { n: 'se', x: x2, y: y2 }, { n: 's', x: xm, y: y2 }, { n: 'sw', x: r.x, y: y2 }, { n: 'w', x: r.x, y: ym },
  ];
}

export function manijaEn(r, px, py, tol) {
  const m = manijas(r).find((h) => Math.abs(h.x - px) <= tol && Math.abs(h.y - py) <= tol);
  return m ? m.n : null;
}

export const CURSOR_MANIJA = { p1: 'crosshair', p2: 'crosshair', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

// Nuevo rectángulo al arrastrar una manija (dx, dy en unidades del mundo). Admite dar vuelta la figura.
export function redimensionar(orig, manija, dx, dy, proporcion = false) {
  let x1 = orig.x, y1 = orig.y, x2 = orig.x + orig.ancho, y2 = orig.y + orig.alto;
  if (manija.includes('w')) x1 += dx;
  if (manija.includes('e')) x2 += dx;
  if (manija.includes('n')) y1 += dy;
  if (manija.includes('s')) y2 += dy;
  if (proporcion && manija.length === 2 && orig.ancho > 0 && orig.alto > 0) {
    const r = orig.ancho / orig.alto;
    let w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    if (w / orig.ancho >= h / orig.alto) h = w / r; else w = h * r;
    const ax = manija.includes('w') ? orig.x + orig.ancho : orig.x;
    const ay = manija.includes('n') ? orig.y + orig.alto : orig.y;
    x1 = ax; y1 = ay;
    x2 = ax + (manija.includes('w') ? -w : w);
    y2 = ay + (manija.includes('n') ? -h : h);
  }
  const r = normalizarRect(x1, y1, x2, y2);
  return { ...r, ancho: Math.max(r.ancho, MIN_TAM), alto: Math.max(r.alto, MIN_TAM) };
}

export function trasladar(el, dx, dy) {
  if (el.tipo === 'trazo') {
    return { ...el, x: el.x + dx, y: el.y + dy, datos: { ...el.datos, puntos: el.datos.puntos.map(([x, y, p]) => [x + dx, y + dy, p]) } };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

// Escala un trazo entre dos cajas envolventes preservando el grosor lógico del lápiz
export function escalarTrazo(el, cajaNueva, cajaOrig = el) {
  const origAncho = Math.max(cajaOrig.ancho, 0.001);
  const origAlto = Math.max(cajaOrig.alto, 0.001);
  const escalaX = cajaNueva.ancho / origAncho;
  const escalaY = cajaNueva.alto / origAlto;
  const nuevosPuntos = el.datos.puntos.map(([px, py, p]) => {
    const nx = cajaNueva.x + (px - cajaOrig.x) * escalaX;
    const ny = cajaNueva.y + (py - cajaOrig.y) * escalaY;
    return [nx, ny, p];
  });
  const caja = cajaDeTrazo(nuevosPuntos, el.datos.grosor);
  return {
    ...el,
    x: caja.x,
    y: caja.y,
    ancho: caja.ancho,
    alto: caja.alto,
    datos: {
      ...el.datos,
      puntos: nuevosPuntos,
    },
  };
}

// Escala un símbolo entre dos cajas envolventes adaptando su tamaño tipográfico
export function escalarSimbolo(el, cajaNueva, cajaOrig = el) {
  const origAncho = Math.max(cajaOrig.ancho, 0.001);
  const origAlto = Math.max(cajaOrig.alto, 0.001);
  const escalaX = cajaNueva.ancho / origAncho;
  const escalaY = cajaNueva.alto / origAlto;
  const escala = Math.max(escalaX, escalaY);
  const nuevoTamano = Math.max(8, Math.min(300, Math.round((el.datos.tamano || 18) * escala)));
  const nx = cajaNueva.x + (el.x - cajaOrig.x) * escalaX;
  const ny = cajaNueva.y + (el.y - cajaOrig.y) * escalaY;
  const nw = Math.max(MIN_TAM, el.ancho * escalaX);
  const nh = Math.max(MIN_TAM, el.alto * escalaY);
  return {
    ...el,
    x: nx,
    y: ny,
    ancho: nw,
    alto: nh,
    datos: {
      ...el.datos,
      tamano: nuevoTamano,
    },
  };
}

// Escala cualquier elemento (figura, imagen, texto, trazo o símbolo)
export function escalarElemento(el, cajaNueva, cajaOrig = el) {
  if (el.tipo === 'trazo') return escalarTrazo(el, cajaNueva, cajaOrig);
  if (el.tipo === 'simbolo') return escalarSimbolo(el, cajaNueva, cajaOrig);
  const origAncho = Math.max(cajaOrig.ancho, 0.001);
  const origAlto = Math.max(cajaOrig.alto, 0.001);
  const escalaX = cajaNueva.ancho / origAncho;
  const escalaY = cajaNueva.alto / origAlto;
  if (esLinea(el)) {
    const [a, b] = extremosLinea(el);
    const na = { x: cajaNueva.x + (a.x - cajaOrig.x) * escalaX, y: cajaNueva.y + (a.y - cajaOrig.y) * escalaY };
    const nb = { x: cajaNueva.x + (b.x - cajaOrig.x) * escalaX, y: cajaNueva.y + (b.y - cajaOrig.y) * escalaY };
    return lineaDesdeExtremos(el, na, nb);
  }
  const nx = cajaNueva.x + (el.x - cajaOrig.x) * escalaX;
  const ny = cajaNueva.y + (el.y - cajaOrig.y) * escalaY;
  const nw = Math.max(MIN_TAM, el.ancho * escalaX);
  const nh = Math.max(MIN_TAM, el.alto * escalaY);
  return { ...el, x: nx, y: ny, ancho: nw, alto: nh };
}

// Determina si dos segmentos 2D se intersecan
export function segmentosSeCortan(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Criterio del Lazo: selecciona elementos rodeados o intersecados por el contorno a mano alzada
export function elementoTocadoPorLazo(el, puntosLazo) {
  if (!puntosLazo || puntosLazo.length < 3) return false;
  const cajaLazo = cajaDeTrazo(puntosLazo, 0);
  if (!rectsSeCruzan(cajaLazo, el)) return false;

  const n = puntosLazo.length;
  const cx = el.x + el.ancho / 2;
  const cy = el.y + el.alto / 2;
  if (puntoEnPoligono(puntosLazo, cx, cy, 2)) return true;

  if (el.tipo === 'trazo' && el.datos?.puntos) {
    const pts = el.datos.puntos;
    for (let i = 0; i < pts.length; i++) {
      if (puntoEnPoligono(puntosLazo, pts[i][0], pts[i][1], (el.datos.grosor || 2) / 2)) return true;
    }
    const paso = Math.max(1, Math.floor(pts.length / 50));
    for (let i = 0; i < pts.length - 1; i += paso) {
      const p1 = pts[i], p2 = pts[Math.min(pts.length - 1, i + paso)];
      for (let j = 0; j < n; j++) {
        const l1 = puntosLazo[j], l2 = puntosLazo[(j + 1) % n];
        if (segmentosSeCortan(p1[0], p1[1], p2[0], p2[1], l1[0], l1[1], l2[0], l2[1])) return true;
      }
    }
    return false;
  }

  if (esLinea(el)) {
    const [a, b] = extremosLinea(el);
    if (puntoEnPoligono(puntosLazo, a.x, a.y, 2) || puntoEnPoligono(puntosLazo, b.x, b.y, 2)) return true;
    for (let j = 0; j < n; j++) {
      const l1 = puntosLazo[j], l2 = puntosLazo[(j + 1) % n];
      if (segmentosSeCortan(a.x, a.y, b.x, b.y, l1[0], l1[1], l2[0], l2[1])) return true;
    }
    return false;
  }

  const esquinas = [
    [el.x, el.y],
    [el.x + el.ancho, el.y],
    [el.x + el.ancho, el.y + el.alto],
    [el.x, el.y + el.alto],
  ];
  for (const [ex, ey] of esquinas) {
    if (puntoEnPoligono(puntosLazo, ex, ey, 2)) return true;
  }
  for (let k = 0; k < 4; k++) {
    const e1 = esquinas[k], e2 = esquinas[(k + 1) % 4];
    for (let j = 0; j < n; j++) {
      const l1 = puntosLazo[j], l2 = puntosLazo[(j + 1) % n];
      if (segmentosSeCortan(e1[0], e1[1], e2[0], e2[1], l1[0], l1[1], l2[0], l2[1])) return true;
    }
  }

  if (puntosLazo[0][0] >= el.x && puntosLazo[0][0] <= el.x + el.ancho &&
      puntosLazo[0][1] >= el.y && puntosLazo[0][1] <= el.y + el.alto) {
    return true;
  }

  return false;
}

// ---------- Alinear y Distribuir (Etapa 17C) ----------

/**
 * Alinea una colección de elementos respecto a la caja que los engloba.
 * @param {Array<Object>} elementos - Elementos a alinear
 * @param {'izquierda'|'centro'|'derecha'|'arriba'|'medio'|'abajo'} direccion
 * @returns {Array<Object>} Nueva lista de elementos alineados
 */
export function alinearElementos(elementos, direccion) {
  if (!Array.isArray(elementos) || elementos.length < 2) return elementos;
  const caja = unirRects(elementos);
  if (!caja) return elementos;

  const minX = caja.x;
  const maxX = caja.x + caja.ancho;
  const centroX = caja.x + caja.ancho / 2;
  const minY = caja.y;
  const maxY = caja.y + caja.alto;
  const centroY = caja.y + caja.alto / 2;

  return elementos.map((el) => {
    let dx = 0;
    let dy = 0;
    if (direccion === 'izquierda') {
      dx = minX - el.x;
    } else if (direccion === 'centro') {
      dx = (centroX - el.ancho / 2) - el.x;
    } else if (direccion === 'derecha') {
      dx = (maxX - el.ancho) - el.x;
    } else if (direccion === 'arriba') {
      dy = minY - el.y;
    } else if (direccion === 'medio') {
      dy = (centroY - el.alto / 2) - el.y;
    } else if (direccion === 'abajo') {
      dy = (maxY - el.alto) - el.y;
    }
    return (dx !== 0 || dy !== 0) ? trasladar(el, dx, dy) : el;
  });
}

/**
 * Distribuye uniformemente 3 o más elementos a lo largo del eje horizontal o vertical.
 * @param {Array<Object>} elementos - Elementos a distribuir
 * @param {'horizontal'|'vertical'} direccion
 * @returns {Array<Object>} Nueva lista de elementos distribuidos
 */
export function distribuirElementos(elementos, direccion) {
  if (!Array.isArray(elementos) || elementos.length < 3) return elementos;
  const esH = direccion === 'horizontal';

  // Ordenar por su centro en el eje correspondiente
  const ordenados = [...elementos].sort((a, b) => {
    const ca = esH ? (a.x + a.ancho / 2) : (a.y + a.alto / 2);
    const cb = esH ? (b.x + b.ancho / 2) : (b.y + b.alto / 2);
    return ca - cb;
  });

  const primero = ordenados[0];
  const ultimo = ordenados[ordenados.length - 1];

  const totalDimension = ordenados.reduce((sum, el) => sum + (esH ? el.ancho : el.alto), 0);
  const span = esH
    ? (ultimo.x + ultimo.ancho - primero.x)
    : (ultimo.y + ultimo.alto - primero.y);

  const n = ordenados.length;
  const mapaNuevos = new Map();
  mapaNuevos.set(primero.id, primero);
  mapaNuevos.set(ultimo.id, ultimo);

  if (span > totalDimension) {
    // Si hay espacio positivo libre, distribuir huecos uniformes entre las cajas
    const hueco = (span - totalDimension) / (n - 1);
    let cursor = esH ? (primero.x + primero.ancho + hueco) : (primero.y + primero.alto + hueco);

    for (let i = 1; i < n - 1; i++) {
      const el = ordenados[i];
      const dx = esH ? (cursor - el.x) : 0;
      const dy = !esH ? (cursor - el.y) : 0;
      mapaNuevos.set(el.id, trasladar(el, dx, dy));
      cursor += (esH ? el.ancho : el.alto) + hueco;
    }
  } else {
    // Si se solapan o no hay espacio libre positivo, distribuir centros de forma equidistante
    const centroIni = esH ? (primero.x + primero.ancho / 2) : (primero.y + primero.alto / 2);
    const centroFin = esH ? (ultimo.x + ultimo.ancho / 2) : (ultimo.y + ultimo.alto / 2);
    const paso = (centroFin - centroIni) / (n - 1);

    for (let i = 1; i < n - 1; i++) {
      const el = ordenados[i];
      const targetCentro = centroIni + i * paso;
      const actualCentro = esH ? (el.x + el.ancho / 2) : (el.y + el.alto / 2);
      const delta = targetCentro - actualCentro;
      const dx = esH ? delta : 0;
      const dy = !esH ? delta : 0;
      mapaNuevos.set(el.id, trasladar(el, dx, dy));
    }
  }

  return elementos.map((el) => mapaNuevos.get(el.id) || el);
}

/**
 * Calcula guías inteligentes y ajuste magnético (snapping) al mover una selección.
 * @param {Object} caja - Bounding box de la selección movida en coordenadas tentativas
 * @param {Array<Object>} otrosElementos - Elementos estáticos de la escena
 * @param {Object} renglones - Configuración de renglones/cuadrícula
 * @param {number} umbral - Distancia máxima en unidades del mundo para enganchar
 * @param {boolean} imanActivo - Interruptor del imán (si es false, no altera nada)
 */
export function calcularSnapGuias(caja, otrosElementos = [], renglones = null, umbral = 6, imanActivo = true) {
  if (!imanActivo || !caja) {
    return { dx: 0, dy: 0, guias: [] };
  }

  const fuentesX = [caja.x, caja.x + caja.ancho / 2, caja.x + caja.ancho];
  const fuentesY = [caja.y, caja.y + caja.alto / 2, caja.y + caja.alto];

  const targetsX = [];
  const targetsY = [];

  // Objetivos desde otros elementos visibles
  const limiteElementos = otrosElementos.slice(0, 150);
  for (const t of limiteElementos) {
    targetsX.push(t.x, t.x + t.ancho / 2, t.x + t.ancho);
    targetsY.push(t.y, t.y + t.alto / 2, t.y + t.alto);
  }

  // Objetivos desde la cuadrícula de renglones si está activa
  if (renglones && renglones.activos && renglones.estilo !== 'liso') {
    const inter = Math.max(16, renglones.interlineado || 32);
    if (renglones.estilo === 'cuadriculado') {
      for (const fx of fuentesX) {
        targetsX.push(Math.round(fx / inter) * inter);
      }
    }
    if (renglones.estilo === 'cuadriculado' || renglones.estilo === 'rayado') {
      for (const fy of fuentesY) {
        targetsY.push(Math.round(fy / inter) * inter);
      }
    }
  }

  let mejorDx = 0;
  let minDistX = Infinity;
  let mejorGuiaX = null;

  for (const fx of fuentesX) {
    for (const tx of targetsX) {
      const d = tx - fx;
      const absD = Math.abs(d);
      if (absD <= umbral && absD < minDistX) {
        minDistX = absD;
        mejorDx = d;
        mejorGuiaX = tx;
      }
    }
  }

  let mejorDy = 0;
  let minDistY = Infinity;
  let mejorGuiaY = null;

  for (const fy of fuentesY) {
    for (const ty of targetsY) {
      const d = ty - fy;
      const absD = Math.abs(d);
      if (absD <= umbral && absD < minDistY) {
        minDistY = absD;
        mejorDy = d;
        mejorGuiaY = ty;
      }
    }
  }

  const guias = [];
  if (mejorGuiaX !== null) guias.push({ tipo: 'x', valor: mejorGuiaX });
  if (mejorGuiaY !== null) guias.push({ tipo: 'y', valor: mejorGuiaY });

  return { dx: mejorDx, dy: mejorDy, guias };
}


