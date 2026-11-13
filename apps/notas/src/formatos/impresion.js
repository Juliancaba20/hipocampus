import { ALTO_A4, ANCHO_A4, dimensionesHoja } from './paginas.js';
import { HOJA_A4_MM, distribucionHoja, tamanoImpreso } from './tarjetas.js';
import { liberarImagenesCanvas } from '../herramientas/imagenes/recursos.js';

// Resolución de dibujo según cuántas hojas se imprimen (más hojas = menos memoria por hoja).
export function factorResolucion(cantidad, { alto = 3, medio = 2, bajo = 1.5 } = {}) {
  if (cantidad <= 6) return alto;
  if (cantidad <= 15) return medio;
  return bajo;
}

// Inicia la impresión y libera la memoria de los lienzos cuando termina.
export function imprimirContenedor(cont) {
  const limpiar = () => {
    window.removeEventListener('afterprint', limpiar);
    setTimeout(() => {
      cont.querySelectorAll('canvas').forEach(liberarImagenesCanvas);
      cont.innerHTML = '';
    }, 1000);
  };
  window.addEventListener('afterprint', limpiar);
  setTimeout(() => window.print(), 200);
}

const mm = (v) => `${Math.round(v * 100) / 100}mm`;

// Arma las hojas A4 con las tarjetas a su tamaño real (o reducidas para que quepan).
// dibujarEn(canvas, tarjeta, indice, factor) pinta cada tarjeta. Los textos se insertan como texto, nunca como HTML.
export function construirHojasTarjetas(cont, { tarjetas, med, porHoja, marcas, titulo, dibujarEn, factor, ambasCaras = true }) {
  cont.innerHTML = '';
  const { columnas, filas, porHoja: n } = distribucionHoja(porHoja);
  const tam = tamanoImpreso(med, n);

  // Expandir tarjetas que tienen doble cara si ambasCaras está activo
  const items = [];
  for (const t of tarjetas) {
    if (ambasCaras && t.dobleCara) {
      items.push({ ...t, caraImpresion: 'anverso', subRotulo: 'Anverso' });
      items.push({ ...t, caraImpresion: 'reverso', subRotulo: 'Reverso' });
    } else {
      items.push({ ...t, caraImpresion: 'anverso', subRotulo: t.dobleCara ? 'Anverso' : '' });
    }
  }

  for (let ini = 0; ini < items.length; ini += n) {
    const hoja = document.createElement('div');
    hoja.className = 'nt-hoja-tarjetas';
    hoja.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;
    hoja.style.gridTemplateRows = `repeat(${filas}, 1fr)`;
    hoja.style.padding = mm(HOJA_A4_MM.margen);
    items.slice(ini, ini + n).forEach((t, k) => {
      const idx = ini + k;
      const celda = document.createElement('div');
      celda.className = 'nt-celda-tarjeta';
      const caja = document.createElement('div');
      caja.className = `nt-tarjeta-impresa${marcas ? ' nt-tarjeta-impresa--marcas' : ''}`;
      caja.style.width = mm(tam.anchoMm);
      caja.style.height = mm(tam.altoMm);
      const cv = document.createElement('canvas');
      cv.width = Math.round(med.ancho * factor);
      cv.height = Math.round(med.alto * factor);
      dibujarEn(cv, t, idx, factor);
      caja.appendChild(cv);
      if (marcas) ['tl', 'tr', 'bl', 'br'].forEach((c) => {
        const m = document.createElement('i');
        m.className = `nt-marca nt-marca--${c}`;
        caja.appendChild(m);
      });
      const rotulo = document.createElement('div');
      rotulo.className = 'nt-tarjeta-impresa__rotulo';
      const sufijo = t.subRotulo ? ` · ${t.subRotulo}` : '';
      rotulo.textContent = `${titulo} · ${t.titulo}${sufijo} (${idx + 1}/${items.length})`;
      celda.appendChild(caja);
      celda.appendChild(rotulo);
      hoja.appendChild(celda);
    });
    cont.appendChild(hoja);
  }
  return cont.children.length;
}

// Arma las hojas para imprimir con alta resolución según el tamaño y orientación de la hoja (A4, Carta, A5).
// dibujarEn(canvas, numeroHoja, indice, factor) pinta cada hoja. Los textos se insertan con textContent.
export function construirHojasPaginas(cont, { cantidad, paginas, titulo = '', dibujarEn, factor = 1, encabezado = null, pie = null, config = null }) {
  cont.innerHTML = '';
  const dims = dimensionesHoja(config);
  const anchoPx = dims.ancho;
  const altoPx = dims.alto;
  const anchoMm = dims.anchoMm;
  const altoMm = dims.altoMm;
  const tamanoCss = dims.tamanoCss || 'A4';
  const orientacion = dims.orientacion === 'horizontal' ? 'landscape' : 'portrait';

  // Inyectar o actualizar regla @page dinámica para tamaño y orientación exactos
  if (typeof document !== 'undefined') {
    let estiloImpr = document.getElementById('nt-estilo-pagina-dinamico');
    if (!estiloImpr) {
      estiloImpr = document.createElement('style');
      estiloImpr.id = 'nt-estilo-pagina-dinamico';
      document.head.appendChild(estiloImpr);
    }
    estiloImpr.textContent = `@media print { @page { size: ${tamanoCss} ${orientacion}; margin: 0; } }`;
  }

  const lista = paginas && paginas.length ? paginas : Array.from({ length: Math.max(1, cantidad || 1) }, (_, i) => i + 1);
  for (let idx = 0; idx < lista.length; idx++) {
    const num = lista[idx];
    const numeroHoja = typeof num === 'object' && num !== null ? (num.numero ?? (idx + 1)) : num;
    const tituloHoja = typeof num === 'object' && num !== null && num.titulo ? num.titulo : `Página ${numeroHoja}`;

    const hoja = document.createElement('div');
    hoja.className = 'nt-pagina-impresa';
    hoja.style.width = `${anchoMm}mm`;
    hoja.style.height = `${altoMm}mm`;

    const textoEncabezado = encabezado && encabezado.activo
      ? (encabezado.texto ? (encabezado.numeracion ? `${encabezado.texto} · Página ${numeroHoja} de ${lista.length}` : encabezado.texto) : (encabezado.numeracion ? `Página ${numeroHoja} de ${lista.length}` : ''))
      : '';
    const textoPie = pie && pie.activo
      ? (pie.texto ? (pie.numeracion ? `${pie.texto} · Página ${numeroHoja} de ${lista.length}` : pie.texto) : (pie.numeracion ? `Página ${numeroHoja} de ${lista.length}` : ''))
      : '';

    const rotulo = document.createElement('div');
    rotulo.className = 'nt-pagina-impresa__rotulo';
    rotulo.textContent = textoEncabezado || (titulo ? `${titulo} · ${tituloHoja}` : tituloHoja);
    hoja.appendChild(rotulo);

    const cv = document.createElement('canvas');
    cv.width = Math.round(anchoPx * factor);
    cv.height = Math.round(altoPx * factor);
    if (dibujarEn) {
      dibujarEn(cv, numeroHoja, idx, factor);
    }
    hoja.appendChild(cv);

    const notas = (typeof num === 'object' && Array.isArray(num?.notasAlPie)) ? num.notasAlPie : [];
    if (notas && notas.length > 0) {
      const notasEl = document.createElement('div');
      notasEl.className = 'nt-pagina-impresa__notas-pie';
      notas.forEach((n) => {
        const item = document.createElement('div');
        item.textContent = `${n.numero}. ${n.texto}`;
        notasEl.appendChild(item);
      });
      hoja.appendChild(notasEl);
    }

    if (textoPie) {
      const pieEl = document.createElement('div');
      pieEl.className = 'nt-pagina-impresa__pie';
      pieEl.textContent = textoPie;
      hoja.appendChild(pieEl);
    }

    cont.appendChild(hoja);
  }
  return cont.children.length;
}

// Arma la hoja A4 con el contenido completo del pizarrón encuadrado
export function construirHojasPizarron(cont, { titulo = '', dibujarEn, factor = 2 }) {
  cont.innerHTML = '';
  const docDom = cont?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!docDom) return 0;

  const hoja = docDom.createElement('div');
  hoja.className = 'nt-pagina-impresa nt-hoja-pizarron';

  const rotulo = docDom.createElement('div');
  rotulo.className = 'nt-pagina-impresa__rotulo';
  rotulo.textContent = titulo ? `${titulo} · Pizarrón completo` : 'Pizarrón completo';
  hoja.appendChild(rotulo);

  const cv = docDom.createElement('canvas');
  cv.width = Math.round(ANCHO_A4 * factor);
  cv.height = Math.round(ALTO_A4 * factor);
  if (dibujarEn) {
    dibujarEn(cv, factor);
  }
  hoja.appendChild(cv);
  cont.appendChild(hoja);
  return 1;
}


