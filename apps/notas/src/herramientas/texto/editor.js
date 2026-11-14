// Editor de texto con teclado (Etapas 6 y 20A). Es un elemento editable (contenteditable) que se coloca
// encima del lienzo, con la misma posición y escala que tendrá el texto una vez dibujado.
// Usa el teclado, el corrector y la selección nativos del dispositivo (importante en iPad y Android).
// No conoce React ni el motor: avisa lo que pasa con las funciones alCambiar / alTerminar / alPuntoDeControl.
import { mundoAPantalla } from '../../lienzo/camara.js';
import {
  BLOQUES,
  ETIQUETA_BLOQUE,
  FIN_LISTA,
  NIVEL_MAX,
  SANGRIA_MAX,
  SANGRIA_PASO,
  TABLA,
  TAMANOS_TEXTO,
  cssEditor,
  resolverFamilia,
} from './estilo.js';
import { colorAHex, domAModelo, htmlAModelo, modeloAHtml, runsAHtml } from './html.js';
import { bloquesDe, colorBaseDe, contarTexto, esVacio, tamanoDe, textoAModelo } from './modelo.js';
import {
  ajustarAnchoColumna,
  alternarEncabezado,
  celdaDe,
  celdaVecina,
  colMas,
  colMenos,
  combinarCeldas,
  cursorAlFinal,
  dividirCelda,
  establecerAlineacionVertical,
  establecerBordeTabla,
  establecerFondoCelda,
  filaMas,
  filaMenos,
  insertarTabla,
  quitarTabla,
} from './tabla.js';

function inyectarEstilo(doc) {
  if (doc.getElementById('nt-estilo-texto')) return;
  const s = doc.createElement('style');
  s.id = 'nt-estilo-texto';
  s.textContent = cssEditor();
  doc.head.appendChild(s);
}

const DIFERIDO = (f) => (typeof queueMicrotask === 'function' ? queueMicrotask(f) : Promise.resolve().then(f));

function detectarFamilia(str) {
  if (!str) return 'serif';
  const s = String(str).toLowerCase();
  if (s.includes('mono') || s.includes('courier') || s.includes('consolas') || s.includes('menlo')) return 'mono';
  if (s.includes('bricolage') || s.includes('sans') || s.includes('arial') || s.includes('helvetica') || s.includes('system-ui')) return 'sans';
  return 'serif';
}

export class EditorTexto {
  // capa: elemento donde se coloca · el: { x, y, ancho, datos } del elemento que se edita
  constructor(capa, { el, camara, guia = null, alImagen, alCambiar, alTerminar, alPuntoDeControl, alTamano }) {
    this.capa = capa;
    this.doc = capa.ownerDocument;
    this.win = this.doc.defaultView;
    this.el = el;
    this.camara = camara;
    this.guia = el.datos?.composicion === 'guiada' ? guia : null;
    this.alImagen = alImagen || (() => {});
    this.tamano = tamanoDe(el.datos);
    this.colorBase = colorBaseDe(el.datos);
    this.alCambiar = alCambiar || (() => {});
    this.alTerminar = alTerminar || (() => {});
    this.alPuntoDeControl = alPuntoDeControl || (() => {});
    this.alTamano = alTamano || (() => {});
    this.cerrado = false;
    this._rango = null;
    this._estado = null;
    this._control = null;
    this._formatoCopiado = null;
    inyectarEstilo(this.doc);

    const r = this.raiz = this.doc.createElement('div');
    r.className = 'nt-texto-ed';
    r.setAttribute('data-nt-editor', '');
    r.setAttribute('contenteditable', 'true');
    r.setAttribute('role', 'textbox');
    r.setAttribute('aria-multiline', 'true');
    r.setAttribute('aria-label', 'Texto. Pulse Escape para terminar de escribir.');
    r.setAttribute('lang', 'es');
    r.setAttribute('spellcheck', 'true');
    r.setAttribute('autocapitalize', 'sentences');
    r.style.width = `${el.ancho}px`;
    r.style.fontSize = `${this.tamano}px`;
    r.style.color = this.colorBase;
    r.innerHTML = modeloAHtml(bloquesDe(el.datos), { relleno: true });
    capa.appendChild(r);
    this._aplicarGuia();
    this.posicionar(camara);

    this._on = [
      [r, 'input', () => this._alEntrada()],
      [r, 'keydown', (e) => this._tecla(e)],
      [r, 'paste', (e) => this._pegar(e)],
      [r, 'blur', (e) => this._alPerderFoco(e)],
      [r, 'mouseup', () => this._alMouseUp()],
      [r, 'click', (e) => this._alClic(e)],
      [r, 'dragover', (e) => e.preventDefault()],
      [r, 'drop', (e) => this._soltarArchivo(e)],
      [this.doc, 'selectionchange', () => this._alSeleccion()],
      [r, 'mousemove', (e) => {
        const td = celdaDe(e.target, this.raiz);
        if (!td) { r.style.cursor = ''; return; }
        const rect = td.getBoundingClientRect();
        const bordeDer = Math.abs(e.clientX - rect.right) < 7;
        r.style.cursor = (bordeDer && td.nextElementSibling) ? 'col-resize' : '';
      }],
      [r, 'mousedown', (e) => {
        const td = celdaDe(e.target, this.raiz);
        if (!td) return;
        const rect = td.getBoundingClientRect();
        const bordeDer = Math.abs(e.clientX - rect.right) < 7;
        if (bordeDer && td.nextElementSibling) {
          e.preventDefault();
          e.stopPropagation();
          let startX = e.clientX;
          const alMover = (ev) => {
            const delta = (ev.clientX - startX) / (this.camara?.zoom || 1);
            if (Math.abs(delta) >= 6) {
              ajustarAnchoColumna(td, delta > 0 ? 0.04 : -0.04);
              startX = ev.clientX;
              this._alEntrada();
            }
          };
          const alSoltar = () => {
            this.win.removeEventListener('mousemove', alMover);
            this.win.removeEventListener('mouseup', alSoltar);
          };
          this.win.addEventListener('mousemove', alMover);
          this.win.addEventListener('mouseup', alSoltar);
        }
      }],
    ];
    this._on.forEach(([o, t, f]) => o.addEventListener(t, f));
    this._cmd('defaultParagraphSeparator', 'p');
  }

  // ---------- posición ----------
  posicionar(camara = this.camara) {
    this.camara = camara;
    const p = mundoAPantalla(camara, this.el.x, this.el.y);
    this.raiz.style.transform = `translate(${p.x}px, ${p.y}px) scale(${camara.zoom})`;
  }

  rect() { return this.raiz.getBoundingClientRect(); }

  _aplicarGuia() {
    const paso = this.guia?.interlineado;
    if (!(paso > 0)) { this.raiz.removeAttribute('data-nt-guiado'); return; }
    this.raiz.setAttribute('data-nt-guiado', '1');
    this.raiz.style.setProperty('--nt-paso', `${paso}px`);
    for (const [i, tipo] of ['titulo1', 'titulo2', 'titulo3'].entries()) {
      const def = BLOQUES[tipo], altoNatural = this.tamano * def.factor * def.interlinea;
      this.raiz.style.setProperty(`--nt-lh-${i + 1}`, `${Math.max(paso, Math.ceil(altoNatural / paso) * paso)}px`);
      this.raiz.style.setProperty(`--nt-gap-titulo-${i + 1}`, `${Math.max(0, Math.round((this.tamano * def.factor * def.despues) / paso) * paso)}px`);
    }
    this.raiz.style.setProperty('--nt-gap-parrafo', `${Math.max(0, Math.round((this.tamano * BLOQUES.parrafo.despues) / paso) * paso)}px`);
    this.raiz.style.setProperty('--nt-gap-lista', `${Math.max(0, Math.round((this.tamano * FIN_LISTA) / paso) * paso)}px`);
    this.raiz.style.setProperty('--nt-gap-tabla', `${Math.max(0, Math.round((this.tamano * TABLA.despues) / paso) * paso)}px`);
  }

  // ---------- foco y selección ----------
  enfocar(punto) {
    try { this.raiz.focus({ preventScroll: true }); } catch { this.raiz.focus(); }
    let hecho = false;
    if (punto && typeof punto.x === 'number') {
      try {
        let r = null;
        if (this.doc.caretPositionFromPoint) { const c = this.doc.caretPositionFromPoint(punto.x, punto.y); if (c) { r = this.doc.createRange(); r.setStart(c.offsetNode, c.offset); r.collapse(true); } }
        else if (this.doc.caretRangeFromPoint) r = this.doc.caretRangeFromPoint(punto.x, punto.y);
        if (r && this.raiz.contains(r.startContainer)) { const s = this.win.getSelection(); s.removeAllRanges(); s.addRange(r); hecho = true; }
      } catch { /* se deja el cursor al final */ }
    }
    if (!hecho) { const ult = this.raiz.lastElementChild; if (ult) cursorAlFinal(this.win, ult); }
    this._guardarSeleccion();
    this._refrescar();
  }

  insertarTextoDirecto(texto) {
    this._restaurarSeleccion();
    if (this._cmd('insertText', texto)) { this._guardarSeleccion(); this._alEntrada(); return true; }
    const s = this.win.getSelection();
    if (!s?.rangeCount) return false;
    const rango = s.getRangeAt(0);
    if (!this.raiz.contains(rango.startContainer)) return false;
    rango.deleteContents();
    const nodo = this.doc.createTextNode(texto);
    rango.insertNode(nodo);
    rango.setStartAfter(nodo); rango.collapse(true);
    s.removeAllRanges(); s.addRange(rango);
    this._alEntrada();
    return true;
  }

  puntoInsercion() {
    const s = this.win.getSelection();
    if (!s?.rangeCount || !this.raiz.contains(s.anchorNode)) return null;
    const rango = s.getRangeAt(0).cloneRange();
    rango.collapse(true);
    const r = rango.getBoundingClientRect?.();
    if (r && Number.isFinite(r.left) && (r.height || r.width)) return { x: r.left, y: r.bottom || r.top };
    const caja = this.rect();
    if (caja && (caja.height || caja.width)) return { x: caja.left, y: caja.bottom };
    return null;
  }

  _dentro() { const s = this.win.getSelection(); return !!(s && s.rangeCount && this.raiz.contains(s.anchorNode)); }
  _guardarSeleccion() { const s = this.win.getSelection(); if (s && s.rangeCount && this.raiz.contains(s.anchorNode)) this._rango = s.getRangeAt(0).cloneRange(); }
  _restaurarSeleccion() {
    if (!this._dentro() && this._rango) { const s = this.win.getSelection(); s.removeAllRanges(); s.addRange(this._rango); }
    if (this.doc.activeElement !== this.raiz) { try { this.raiz.focus({ preventScroll: true }); } catch { /* sin foco */ } }
  }

  _alSeleccion() {
    if (this.cerrado || !this._dentro()) return;
    this._guardarSeleccion();
    this._refrescar();
  }

  _alMouseUp() {
    if (this._formatoCopiado) {
      const s = this.win.getSelection();
      if (s && s.rangeCount && !s.isCollapsed && this._dentro()) {
        this.aplicarFormatoCopiado();
      }
    }
  }

  _alClic(e) {
    const a = e.target?.closest?.('a');
    if (a && a.href) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        try { this.win.open(a.href, '_blank', 'noopener,noreferrer'); } catch {}
      }
    }
  }

  _alPerderFoco(e) {
    if (this.cerrado) return;
    const r = e.relatedTarget;
    if (r && r.closest && r.closest('[data-nt-barra],[data-nt-barra-panel]')) return;
    DIFERIDO(() => { if (!this.cerrado && this.doc.activeElement !== this.raiz) this.alTerminar('blur'); });
  }

  // ---------- eventos ----------
  _alEntrada() {
    this._refrescar();
    clearTimeout(this._control);
    this._control = setTimeout(() => this.alPuntoDeControl(), 450);
  }

  _tecla(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { e.preventDefault(); this.alTerminar('esc'); return; }
    if (e.key === 'Tab') { e.preventDefault(); this._tab(e.shiftKey); return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); this.alTerminar('esc'); return; }
    if (mod && e.shiftKey && !e.altKey) {
      const acc = {
        KeyX: ['tachado'],
        KeyC: ['oculto'],
        Digit7: ['lista', 'numero'],
        Digit8: ['lista', 'vineta'],
        KeyL: ['alinear', 'izquierda'],
        KeyE: ['alinear', 'centro'],
        KeyR: ['alinear', 'derecha'],
        KeyJ: ['alinear', 'justificado'],
        Digit0: ['bloque', 'parrafo'],
        Digit1: ['bloque', 'titulo1'],
        Digit2: ['bloque', 'titulo2'],
        Digit3: ['bloque', 'titulo3'],
      }[e.code];
      if (acc) { e.preventDefault(); this.aplicar(acc[0], acc[1]); }
    }
  }

  _tab(atras) {
    const est = this.estado();
    if (est.enTabla) {
      const td = this._celda();
      if (td) celdaVecina(this.win, td, atras);
    } else {
      this.aplicar('sangria', atras ? 'menos' : 'mas');
    }
    this._alEntrada();
  }

  _pegar(e) {
    const dt = e.clipboardData;
    if (!dt) return;
    const archivo = [...(dt.items || [])].filter((item) => item.kind === 'file' && /^image\/(jpeg|png|webp)$/i.test(item.type)).map((item) => item.getAsFile()).find(Boolean);
    if (archivo) { e.preventDefault(); e.stopPropagation(); this.alImagen(archivo, this.puntoInsercion()); return; }
    e.preventDefault();
    const html = dt.getData('text/html');
    let bloques = html && html.trim() ? htmlAModelo(html, { colorBase: this.colorBase }) : [];
    if (esVacio(bloques)) bloques = textoAModelo(dt.getData('text/plain'));
    if (esVacio(bloques)) return;
    this.insertarBloques(bloques);
  }

  _soltarArchivo(e) {
    const archivo = [...(e.dataTransfer?.files || [])].find((f) => /^image\/(jpeg|png|webp)$/i.test(f.type));
    if (!archivo) { e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation();
    this.alImagen(archivo, { x: e.clientX, y: e.clientY });
  }

  // Un solo párrafo se inserta en línea (dentro de la frase); varios bloques, tal cual.
  insertarBloques(bloques) {
    this._restaurarSeleccion();
    const simple = bloques.length === 1 && bloques[0].tipo === 'parrafo';
    const html = simple ? runsAHtml(bloques[0].runs) : modeloAHtml(bloques);
    let ok = false;
    try { ok = this.doc.execCommand('insertHTML', false, html); } catch { ok = false; }
    if (!ok) {
      const s = this.win.getSelection();
      if (s && s.rangeCount) {
        const r = s.getRangeAt(0);
        r.deleteContents();
        const t = this.doc.createElement('template');
        t.innerHTML = html;
        r.insertNode(t.content);
        r.collapse(false);
      } else this.raiz.insertAdjacentHTML('beforeend', html);
      this._alEntrada();
    }
  }

  // ---------- comandos ----------
  _cmd(nombre, valor = null) {
    try { return !!this.doc.execCommand(nombre, false, valor); } catch { return false; }
  }

  _celda() { const s = this.win.getSelection(); return celdaDe(s && s.rangeCount && this._dentro() ? s.anchorNode : this._rango && this._rango.startContainer, this.raiz); }

  _bloqueActual() {
    const s = this.win.getSelection();
    let nodo = s && s.rangeCount && this._dentro() ? s.anchorNode : this._rango && this._rango.startContainer;
    if (!nodo || !this.raiz.contains(nodo)) nodo = this.raiz.firstChild || this.raiz;
    let n = nodo.nodeType === 1 ? nodo : nodo.parentElement;
    while (n && n !== this.raiz) {
      if (/^(P|DIV|H[1-6]|LI)$/.test(n.tagName)) return n;
      n = n.parentElement;
    }
    return null;
  }

  _aplicarEstiloEnSeleccion(estilos) {
    this._restaurarSeleccion();
    const s = this.win.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed || !this._dentro()) return;
    const rango = s.getRangeAt(0);
    const span = this.doc.createElement('span');
    Object.assign(span.style, estilos);
    try {
      span.appendChild(rango.extractContents());
      rango.insertNode(span);
      const nuevoRango = this.doc.createRange();
      nuevoRango.selectNodeContents(span);
      s.removeAllRanges();
      s.addRange(nuevoRango);
      this._guardarSeleccion();
    } catch {
      /* fallback silencioso */
    }
  }

  deshacer() { this._restaurarSeleccion(); this._cmd('undo'); this._refrescar(); }
  rehacer() { this._restaurarSeleccion(); this._cmd('redo'); this._refrescar(); }

  aplicar(accion, valor, extra = null) {
    this._restaurarSeleccion();
    this._cmd('styleWithCSS', true);
    const est = this.estado();
    const sinBloques = est.enTabla; // en celdas solo hay formato de letra
    switch (accion) {
      case 'negrita': this._cmd('bold'); break;
      case 'cursiva': this._cmd('italic'); break;
      case 'subrayado': this._cmd('underline'); break;
      case 'tachado': this._cmd('strikeThrough'); break;
      case 'subindice': this._cmd('subscript'); break;
      case 'superindice': this._cmd('superscript'); break;
      case 'color': this._cmd('foreColor', valor || this.colorBase); break;
      case 'resaltado': if (!this._cmd('hiliteColor', valor || 'transparent')) this._cmd('backColor', valor || 'transparent'); break;
      case 'fuente': this._aplicarFuente(valor); break;
      case 'tamano': this._fijarTamano(valor); break;
      case 'interlineado': this._fijarInterlineado(valor); break;
      case 'sangria': this._fijarSangria(valor); break;
      case 'copiarFormato': this.copiarFormato(); break;
      case 'pegarFormato': this.aplicarFormatoCopiado(); break;
      case 'estilo': this._aplicarEstilo(valor); break;
      case 'enlace': this._aplicarEnlace(valor); break;
      case 'notaAlPie': this._insertarNotaAlPie(valor); break;
      case 'saltoPagina': this._insertarSaltoPagina(); break;
      case 'oculto': this._alternarOculto(); break;
      case 'bloque': {
        if (sinBloques) break;
        if (est.lista) this._cmd(est.lista === 'numero' ? 'insertOrderedList' : 'insertUnorderedList');
        this._cmd('formatBlock', valor === est.bloque && valor !== 'parrafo' ? 'p' : ETIQUETA_BLOQUE[valor] || 'p');
        break;
      }
      case 'lista': {
        if (sinBloques) break;
        if (est.bloque !== 'parrafo') this._cmd('formatBlock', 'p');
        this._cmd(valor === 'numero' ? 'insertOrderedList' : 'insertUnorderedList');
        break;
      }
      case 'alinear': {
        if (sinBloques) break;
        const mapa = {
          izquierda: 'justifyLeft',
          centro: 'justifyCenter',
          derecha: 'justifyRight',
          justificado: 'justifyFull',
        };
        this._cmd(mapa[valor] || 'justifyLeft');
        break;
      }
      case 'tabla': this._tabla(valor, extra); break;
      default: break;
    }
    this._alEntrada();
  }

  _aplicarEstilo(estiloId) {
    const bloque = this._bloqueActual();
    if (!bloque) return;
    if (estiloId && estiloId !== 'normal') {
      bloque.setAttribute('data-nt-estilo', estiloId);
      if (estiloId === 'titulo') this._cmd('formatBlock', 'h1');
      else if (estiloId === 'subtitulo') this._cmd('formatBlock', 'h2');
      else this._cmd('formatBlock', 'p');
    } else {
      bloque.removeAttribute('data-nt-estilo');
      this._cmd('formatBlock', 'p');
    }
  }

  _aplicarEnlace(valor) {
    this._restaurarSeleccion();
    if (!valor) {
      this._cmd('unlink');
      return;
    }
    const url = typeof valor === 'string' ? valor : (valor.url || '#');
    const tipo = (typeof valor === 'object' && valor.tipo) || 'web';
    const notaId = typeof valor === 'object' ? valor.notaId : null;

    const s = this.win.getSelection();
    if (!s || !s.rangeCount || !this._dentro()) return;
    const rango = s.getRangeAt(0);

    if (s.isCollapsed) {
      const a = this.doc.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('data-nt-link-tipo', tipo);
      if (notaId) a.setAttribute('data-nt-nota-id', notaId);
      a.textContent = url;
      rango.insertNode(a);
      rango.setStartAfter(a);
      rango.collapse(true);
      s.removeAllRanges();
      s.addRange(rango);
    } else {
      this._cmd('createLink', url);
      let nodo = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
      const a = nodo?.closest('a') || this.raiz.querySelector(`a[href="${url}"]`);
      if (a) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-nt-link-tipo', tipo);
        if (notaId) a.setAttribute('data-nt-nota-id', notaId);
      }
    }
  }

  _insertarNotaAlPie(texto) {
    this._restaurarSeleccion();
    const s = this.win.getSelection();
    if (!s || !s.rangeCount || !this._dentro()) return;
    const rango = s.getRangeAt(0);
    const sup = this.doc.createElement('sup');
    sup.className = 'nt-nota-pie';
    sup.setAttribute('data-nt-nota-pie', String(texto || ''));
    sup.textContent = '[*]';
    rango.insertNode(sup);
    rango.setStartAfter(sup);
    rango.collapse(true);
    s.removeAllRanges();
    s.addRange(rango);
  }

  _insertarSaltoPagina() {
    this._restaurarSeleccion();
    const s = this.win.getSelection();
    if (!s || !s.rangeCount || !this._dentro()) return;
    const rango = s.getRangeAt(0);
    const hr = this.doc.createElement('hr');
    hr.className = 'nt-salto-pagina';
    hr.setAttribute('data-nt-salto-pagina', '1');
    const p = this.doc.createElement('p');
    p.innerHTML = '<br>';
    rango.insertNode(p);
    rango.insertNode(hr);
    rango.setStartAfter(p);
    rango.collapse(true);
    s.removeAllRanges();
    s.addRange(rango);
  }

  _alternarOculto() {
    this._restaurarSeleccion();
    const s = this.win.getSelection();
    if (!s || !s.rangeCount || !this._dentro()) return;
    const rango = s.getRangeAt(0);

    let nodo = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
    const clozeActual = nodo?.closest?.('.nt-oculto, [data-nt-oculto="1"]');

    if (clozeActual && this.raiz.contains(clozeActual)) {
      const parent = clozeActual.parentNode;
      while (clozeActual.firstChild) {
        parent.insertBefore(clozeActual.firstChild, clozeActual);
      }
      parent.removeChild(clozeActual);
      this._alEntrada();
      return;
    }

    if (s.isCollapsed) return;

    const span = this.doc.createElement('span');
    span.className = 'nt-oculto';
    span.setAttribute('data-nt-oculto', '1');
    try {
      span.appendChild(rango.extractContents());
      rango.insertNode(span);
      const nuevoRango = this.doc.createRange();
      nuevoRango.selectNodeContents(span);
      s.removeAllRanges();
      s.addRange(nuevoRango);
    } catch {
      /* fallback */
    }
    this._alEntrada();
  }

  _aplicarFuente(fuenteId) {
    const fam = resolverFamilia(fuenteId);
    this._restaurarSeleccion();
    const s = this.win.getSelection();
    if (s && s.rangeCount && !s.isCollapsed && this._dentro()) {
      this._aplicarEstiloEnSeleccion({ fontFamily: fam });
    } else {
      this._cmd('fontName', fam);
    }
  }

  _fijarTamano(v) {
    const s = this.win.getSelection();
    const tieneSeleccion = s && s.rangeCount && !s.isCollapsed && this._dentro();
    const tamActual = this.tamano;
    let n = tamActual;
    if (v === 'mas') n = TAMANOS_TEXTO.find((t) => t > n + 0.01) ?? n;
    else if (v === 'menos') n = [...TAMANOS_TEXTO].reverse().find((t) => t < n - 0.01) ?? n;
    else if (v > 0) n = Math.round(v);

    if (tieneSeleccion) {
      this._aplicarEstiloEnSeleccion({ fontSize: `${n}px` });
    } else {
      if (n === this.tamano) return;
      this.tamano = n;
      this.raiz.style.fontSize = `${n}px`;
      this._aplicarGuia();
      this.alTamano(n);
    }
  }

  _fijarInterlineado(v) {
    const bloque = this._bloqueActual();
    if (bloque) {
      bloque.style.lineHeight = String(v);
    }
  }

  _fijarSangria(v) {
    const est = this.estado();
    if (est.lista) {
      if (v === 'menos') this._cmd('outdent');
      else if (est.nivel < NIVEL_MAX) this._cmd('indent');
      return;
    }
    const bloque = this._bloqueActual();
    if (bloque) {
      const actual = parseInt(bloque.getAttribute('data-nt-sangria') || '0', 10) || 0;
      const nuevo = v === 'mas' ? Math.min(SANGRIA_MAX, actual + 1) : Math.max(0, actual - 1);
      if (nuevo > 0) {
        bloque.setAttribute('data-nt-sangria', String(nuevo));
        bloque.style.marginLeft = `${nuevo * SANGRIA_PASO}em`;
      } else {
        bloque.removeAttribute('data-nt-sangria');
        bloque.style.marginLeft = '';
      }
    }
  }

  copiarFormato() {
    const est = this.estado();
    this._formatoCopiado = {
      negrita: est.negrita,
      cursiva: est.cursiva,
      subrayado: est.subrayado,
      tachado: est.tachado,
      subindice: est.subindice,
      superindice: est.superindice,
      color: est.color,
      resaltado: est.resaltado,
      fuente: est.fuente,
      tamano: est.tamano,
    };
    this._refrescar();
  }

  aplicarFormatoCopiado() {
    if (!this._formatoCopiado) return;
    const f = this._formatoCopiado;
    const s = this.win.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed || !this._dentro()) return;

    const estilos = {};
    if (f.negrita !== undefined) estilos.fontWeight = f.negrita ? '700' : '400';
    if (f.cursiva !== undefined) estilos.fontStyle = f.cursiva ? 'italic' : 'normal';
    const dec = [f.subrayado && 'underline', f.tachado && 'line-through'].filter(Boolean);
    estilos.textDecoration = dec.length ? dec.join(' ') : 'none';
    if (f.color) estilos.color = f.color;
    if (f.resaltado) estilos.backgroundColor = f.resaltado;
    if (f.fuente) estilos.fontFamily = resolverFamilia(f.fuente);
    if (f.tamano) estilos.fontSize = `${f.tamano}px`;

    this._aplicarEstiloEnSeleccion(estilos);
    if (f.subindice) this._cmd('subscript');
    if (f.superindice) this._cmd('superscript');

    this._formatoCopiado = null;
    this._alEntrada();
  }

  _tabla(op, extra) {
    const td = this._celda();
    switch (op) {
      case 'insertar': if (!td) insertarTabla(this.win, this.raiz, 3, 3); break;
      case 'fila+': if (td) filaMas(this.win, td, true); break;
      case 'fila-': if (td) filaMenos(this.win, this.raiz, td); break;
      case 'col+': if (td) colMas(this.win, td, true); break;
      case 'col-': if (td) colMenos(this.win, this.raiz, td); break;
      case 'borrar': if (td) quitarTabla(this.win, this.raiz, td); break;
      case 'encabezado': if (td) alternarEncabezado(td); break;
      case 'combinar': if (td) combinarCeldas(this.win, td); break;
      case 'dividir': if (td) dividirCelda(this.win, td); break;
      case 'fondo': if (td) establecerFondoCelda(td, extra); break;
      case 'alinearV': if (td) establecerAlineacionVertical(td, extra); break;
      case 'bordes': if (td) establecerBordeTabla(td, extra); break;
      case 'anchoCol': if (td) ajustarAnchoColumna(td, extra); break;
      default: break;
    }
    this._guardarSeleccion();
    this._alEntrada();
  }

  // ---------- estado para la barra ----------
  _consulta(cmd) { try { return !!this.doc.queryCommandState(cmd); } catch { return false; } }

  estado() {
    const s = this.win.getSelection();
    let nodo = s && s.rangeCount && this._dentro() ? s.anchorNode : this._rango && this._rango.startContainer;
    if (!nodo || !this.raiz.contains(nodo)) nodo = this.raiz.firstChild || this.raiz;
    let n = nodo.nodeType === 1 ? nodo : nodo.parentElement;
    let td = null, li = null, enc = null, bloque = null, listas = 0;
    let fuenteDetectada = 'serif';
    let tamanoDetectado = this.tamano;
    let esSub = false;
    let esSuper = false;
    let ocultoDetectado = false;
    let colorDetectado = null;
    let resaltadoDetectado = null;

    let enlaceDetectado = null;
    let notaAlPieDetectada = null;
    let probe = n;
    while (probe && probe !== this.raiz) {
      const t = probe.tagName;
      if (t === 'SUB') esSub = true;
      if ((probe.classList && probe.classList.contains('nt-oculto')) || probe.getAttribute?.('data-nt-oculto') === '1') {
        ocultoDetectado = true;
      }
      if (t === 'SUP') {
        if (probe.classList && probe.classList.contains('nt-nota-pie')) {
          notaAlPieDetectada = probe.getAttribute('data-nt-nota-pie') || probe.title || '';
        } else {
          esSuper = true;
        }
      }
      if (t === 'A' && !enlaceDetectado) {
        enlaceDetectado = {
          url: probe.getAttribute('href') || '',
          tipo: probe.getAttribute('data-nt-link-tipo') || 'web',
          notaId: probe.getAttribute('data-nt-nota-id') || null,
        };
      }
      if (probe.style) {
        if (!colorDetectado && probe.style.color) colorDetectado = colorAHex(probe.style.color);
        if (!resaltadoDetectado && probe.style.backgroundColor) resaltadoDetectado = colorAHex(probe.style.backgroundColor);
        if (fuenteDetectada === 'serif' && probe.style.fontFamily) fuenteDetectada = detectarFamilia(probe.style.fontFamily);
        if (tamanoDetectado === this.tamano && probe.style.fontSize) {
          const px = parseFloat(probe.style.fontSize);
          if (Number.isFinite(px) && px > 0) tamanoDetectado = Math.round(px);
        }
      }
      probe = probe.parentElement;
    }

    while (n && n !== this.raiz) {
      const t = n.tagName;
      if ((t === 'TD' || t === 'TH') && !td) td = n;
      if (t === 'LI' && !li) li = n;
      if (/^H[1-6]$/.test(t) && !enc) enc = n;
      if ((t === 'UL' || t === 'OL')) listas++;
      if (!bloque && /^(P|DIV|H[1-6]|LI)$/.test(t)) bloque = n;
      n = n.parentElement;
    }

    let alinear = 'izquierda';
    let interlineado = 1.4;
    let sangria = 0;
    let estiloDetectado = 'normal';
    if (bloque) {
      estiloDetectado = bloque.getAttribute('data-nt-estilo') || 'normal';
      const a = (bloque.style && bloque.style.textAlign) || '';
      alinear = a === 'center' ? 'centro' : a === 'right' || a === 'end' ? 'derecha' : a === 'justify' ? 'justificado' : 'izquierda';
      if (bloque.style && bloque.style.lineHeight) {
        const lh = parseFloat(bloque.style.lineHeight);
        if (Number.isFinite(lh) && lh > 0) interlineado = lh;
      }
      const sAttr = parseInt(bloque.getAttribute('data-nt-sangria') || '0', 10);
      if (sAttr > 0) sangria = sAttr;
    }
    const tabla = td && td.closest('table');
    const lista = li ? (li.parentElement && li.parentElement.tagName === 'OL' ? 'numero' : 'vineta') : null;

    // Conteo de palabras y caracteres
    let textoSel = '';
    if (s && s.rangeCount && !s.isCollapsed && this._dentro()) {
      textoSel = s.toString();
    }
    const conteoSeleccion = textoSel.trim() ? contarTexto(textoSel) : null;
    const textoTotal = this.raiz.innerText || this.raiz.textContent || '';
    const conteoTotal = contarTexto(textoTotal);

    return {
      activo: true,
      negrita: this._consulta('bold') && !enc,
      cursiva: this._consulta('italic'),
      subrayado: this._consulta('underline'),
      tachado: this._consulta('strikeThrough'),
      oculto: ocultoDetectado,
      subindice: esSub || this._consulta('subscript'),
      superindice: esSuper || this._consulta('superscript'),
      color: colorDetectado,
      resaltado: resaltadoDetectado,
      fuente: fuenteDetectada,
      bloque: enc ? `titulo${Math.min(+enc.tagName[1], 3)}` : 'parrafo',
      estilo: estiloDetectado,
      enlace: enlaceDetectado,
      notaAlPie: notaAlPieDetectada,
      lista,
      nivel: lista ? Math.max(0, listas - 1) : 0,
      sangria,
      interlineado,
      alinear,
      tamano: tamanoDetectado,
      enTabla: !!td,
      encabezado: !!(tabla && tabla.getAttribute('data-enc') === '1'),
      celdaFondo: td ? colorAHex(td.style?.backgroundColor || td.getAttribute('bgcolor')) : null,
      celdaAlinearV: td ? (td.style?.verticalAlign === 'middle' ? 'centro' : td.style?.verticalAlign === 'bottom' ? 'abajo' : 'arriba') : 'arriba',
      celdaColspan: td ? (parseInt(td.getAttribute('colspan'), 10) || 1) : 1,
      celdaRowspan: td ? (parseInt(td.getAttribute('rowspan'), 10) || 1) : 1,
      tablaBordes: tabla ? (tabla.getAttribute('data-borde-estilo') || 'todos') : 'todos',
      conteoTotal,
      conteoSeleccion,
      pincelActivo: !!this._formatoCopiado,
    };
  }

  _refrescar() { this._estado = this.estado(); this.alCambiar(this._estado); }
  estadoActual() { return this._estado || (this._estado = this.estado()); }

  // ---------- contenido ----------
  leer() { return domAModelo(this.raiz, { colorBase: this.colorBase }); }

  destruir() {
    if (this.cerrado) return;
    this.cerrado = true;
    clearTimeout(this._control);
    this._on.forEach(([o, t, f]) => o.removeEventListener(t, f));
    this.raiz.remove();
  }
}
