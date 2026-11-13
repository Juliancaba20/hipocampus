// Maquetación del texto enriquecido (Etapas 6 y 20A): decide dónde corta cada renglón y dónde va cada cosa.
// No dibuja ni toca el DOM: devuelve órdenes de dibujo relativas a la esquina del elemento
//   { alto, fondos: [{x,y,w,h,color}], textos: [{x,y,texto,fuente,color}], lineas: [{x1,y1,x2,y2,grosor,color}] }
// medidor = { ancho(fuente, texto), metricas(fuente) → { asc, desc } }
import { BLOQUES, COLOR_ENLACE, FIN_LISTA, MARCAS_VINETA, SANGRIA_LISTA, SANGRIA_PASO, TABLA, fuente, resolverEstilo } from './estilo.js';
import { bloquesDe, colorBaseDe, colorSeguro, etiquetaNumero, sanear, tamanoDe } from './modelo.js';

// Texto → unidades que no se parten: palabras (aunque cambien de formato a mitad), espacios y saltos.
function unidades(runs) {
  const us = [];
  let ult = null;
  for (const run of runs) {
    run.texto.split('\n').forEach((parte, i) => {
      if (i > 0) { us.push({ tipo: 'salto' }); ult = null; }
      for (const seg of parte.match(/\s+|\S+/g) || []) {
        const tipo = /^\s/.test(seg) ? 'espacio' : 'palabra';
        if (ult && ult.tipo === tipo) ult.piezas.push({ texto: seg, run });
        else { ult = { tipo, piezas: [{ texto: seg, run }] }; us.push(ult); }
      }
    });
  }
  return us;
}

// Reparte los fragmentos en renglones de ancho máximo `max`. Cada renglón: { frags: [{texto, run, ancho, x, espacio}], x }
function fluir(runs, max, fnt, medidor) {
  const lineas = [];
  let l = { frags: [], x: 0 };
  const cerrar = (esSalto = false) => {
    l.saltoForzado = esSalto;
    lineas.push(l);
    l = { frags: [], x: 0 };
  };
  const poner = (texto, run, ancho, espacio) => {
    const u = l.frags[l.frags.length - 1];
    if (u && u.run === run && u.espacio === espacio && u.x + u.ancho === l.x) { u.texto += texto; u.ancho += ancho; }
    else l.frags.push({ texto, run, ancho, x: l.x, espacio });
    l.x += ancho;
  };
  for (const u of unidades(runs)) {
    if (u.tipo === 'salto') { cerrar(true); continue; }
    const piezas = u.piezas.map((p) => ({ ...p, ancho: medidor.ancho(fnt(p.run), p.texto) }));
    const w = piezas.reduce((a, p) => a + p.ancho, 0);
    if (u.tipo === 'espacio') { piezas.forEach((p) => poner(p.texto, p.run, p.ancho, true)); continue; } // al final del renglón «cuelgan»
    if (l.x > 0 && l.x + w > max) cerrar(false);
    if (w <= max) { piezas.forEach((p) => poner(p.texto, p.run, p.ancho, false)); continue; }
    // Palabra más larga que el renglón: se parte por letras
    for (const p of piezas) {
      for (const ch of p.texto) {
        const cw = medidor.ancho(fnt(p.run), ch);
        if (l.x > 0 && l.x + cw > max) cerrar(false);
        poner(ch, p.run, cw, false);
      }
    }
  }
  cerrar(false);
  return lineas;
}

const vacioVisible = (f) => f.espacio || /^\s*$/.test(f.texto);

export function maquetar(datos, ancho, medidor, opciones = {}) {
  const tam = tamanoDe(datos);
  const colorBase = colorBaseDe(datos);
  const bloques = sanear(bloquesDe(datos));
  const estilos = opciones.estilos || null;
  const pasoGuia = datos.composicion === 'guiada' && Number.isFinite(opciones.interlineado) && opciones.interlineado > 0
    ? opciones.interlineado
    : 0;
  const ajustarAlPaso = (altura) => pasoGuia ? Math.max(pasoGuia, Math.ceil((altura - 1e-8) / pasoGuia) * pasoGuia) : altura;
  const ajustarEspacio = (altura) => pasoGuia ? Math.max(0, Math.round(altura / pasoGuia) * pasoGuia) : altura;
  const salida = { ancho, alto: 0, fondos: [], textos: [], lineas: [], enlaces: [], notasAlPie: [], ocultos: [] };
  const cont = []; // numeración por nivel
  let y = 0;
  let hueco = 0;

  // Pone en `salida` los renglones de un flujo. Devuelve la nueva y.
  function emitir(lineas, { x0, y0, max, alinear, bt, lh, negritaBase, colorPorDefecto = colorBase }) {
    let top = y0;
    lineas.forEach((l, lIdx) => {
      let fin = -1;
      l.frags.forEach((f, i) => { if (!vacioVisible(f)) fin = i; });
      if (fin < 0) {
        top += lh;
        return;
      }

      // Justificación o alineación horizontal
      const anchoLinea = l.frags[fin].x + l.frags[fin].ancho;
      const esUltima = lIdx === lineas.length - 1 || l.saltoForzado;
      const debeJustificar = alinear === 'justificado' && !esUltima;

      let fragsAjustados = l.frags.slice(0, fin + 1).map((f) => ({ ...f }));
      let off = 0;

      if (debeJustificar) {
        const sobra = Math.max(0, max - anchoLinea);
        let espaciosEnMedio = 0;
        for (let i = 0; i < fin; i++) {
          if (fragsAjustados[i].espacio) espaciosEnMedio++;
        }
        if (sobra > 0 && espaciosEnMedio > 0) {
          const extraPorEspacio = sobra / espaciosEnMedio;
          let acum = 0;
          for (let i = 0; i <= fin; i++) {
            fragsAjustados[i].x += acum;
            if (fragsAjustados[i].espacio && i < fin) {
              acum += extraPorEspacio;
              fragsAjustados[i].ancho += extraPorEspacio;
            }
          }
        }
      } else {
        off = alinear === 'centro' ? Math.max(0, (max - anchoLinea) / 2) : alinear === 'derecha' ? Math.max(0, max - anchoLinea) : 0;
      }

      // Calcular métricas de la línea considerando todos los fragmentos
      let maxAsc = 0;
      let maxDesc = 0;
      for (const f of fragsAjustados) {
        const rf = fuente(f.run, bt, negritaBase);
        const m = medidor.metricas(rf);
        if (f.run.script === 'sub') {
          maxDesc = Math.max(maxDesc, m.desc + m.asc * 0.35);
          maxAsc = Math.max(maxAsc, m.asc * 0.7);
        } else if (f.run.script === 'super') {
          maxAsc = Math.max(maxAsc, m.asc + m.asc * 0.5);
          maxDesc = Math.max(maxDesc, m.desc);
        } else {
          maxAsc = Math.max(maxAsc, m.asc);
          maxDesc = Math.max(maxDesc, m.desc);
        }
      }
      if (maxAsc === 0) {
        const m = medidor.metricas(fuente({}, bt, negritaBase));
        maxAsc = m.asc;
        maxDesc = m.desc;
      }

      const base = top + (lh - (maxAsc + maxDesc)) / 2 + maxAsc;

      // Agrupar fragmentos contiguos con el mismo formato
      const grupos = [];
      for (const f of fragsAjustados) {
        const u = grupos[grupos.length - 1];
        if (u && u.run === f.run) {
          u.texto += f.texto;
          u.ancho = f.x + f.ancho - u.x;
        } else {
          grupos.push({ run: f.run, texto: f.texto, x: f.x, ancho: f.ancho });
        }
      }

      for (const g of grupos) {
        const r = g.run;
        const x = x0 + off + g.x;
        const rf = fuente(r, bt, negritaBase);
        const rm = medidor.metricas(rf);
        const tRun = Number(r.tamano) > 0 ? Number(r.tamano) : bt;

        // Desplazamiento de línea de base para subíndice o superíndice
        let yTexto = base;
        if (r.script === 'sub') {
          yTexto = base + Math.round(tRun * 0.22);
        } else if (r.script === 'super') {
          yTexto = base - Math.round(tRun * 0.38);
        }

        const hl = colorSeguro(r.resaltado);
        if (hl) {
          salida.fondos.push({ x, y: yTexto - rm.asc, w: g.ancho, h: rm.asc + rm.desc, color: hl });
        }

        let col = colorSeguro(r.color) || (r.enlace ? COLOR_ENLACE : colorPorDefecto);
        if (g.texto.trim() !== '') {
          salida.textos.push({ x, y: yTexto, texto: g.texto, fuente: rf, color: col });
        }

        const grosor = Math.max(1, tRun / 18);
        if (r.subrayado || r.enlace) {
          salida.lineas.push({ x1: x, x2: x + g.ancho, y1: yTexto + tRun * 0.12, y2: yTexto + tRun * 0.12, grosor, color: col });
        }
        if (r.tachado) {
          salida.lineas.push({ x1: x, x2: x + g.ancho, y1: yTexto - tRun * 0.28, y2: yTexto - tRun * 0.28, grosor, color: col });
        }

        if (r.enlace) {
          salida.enlaces.push({
            x,
            y: yTexto - rm.asc,
            w: g.ancho,
            h: rm.asc + rm.desc,
            caja: {
              x,
              y: yTexto - rm.asc,
              ancho: g.ancho,
              alto: rm.asc + rm.desc,
            },
            enlace: r.enlace,
          });
        }

        if (r.notaAlPie) {
          salida.notasAlPie.push({
            texto: r.notaAlPie,
            x: x + g.ancho,
            y: yTexto,
            run: r,
          });
        }

        if (r.oculto && g.texto.trim() !== '') {
          salida.ocultos.push({
            x,
            y: yTexto - rm.asc,
            w: g.ancho,
            h: rm.asc + rm.desc,
            caja: {
              x,
              y: yTexto - rm.asc,
              ancho: g.ancho,
              alto: rm.asc + rm.desc,
            },
            texto: g.texto,
            indice: salida.ocultos.length,
            run: r,
          });
        }
      }
      top += lh;
    });
    return top;
  }

  bloques.forEach((b, i) => {
    const sig = bloques[i + 1];

    if (b.tipo === 'saltoPagina' || b.saltoPagina) {
      salida.lineas.push({ x1: 0, x2: ancho, y1: y + 10, y2: y + 10, grosor: 1, color: '#94a3b8', trazos: [5, 4] });
      const fuenteSalto = '11px system-ui, sans-serif';
      const wLabel = medidor.ancho(fuenteSalto, '— Salto de página —');
      salida.fondos.push({ x: (ancho - wLabel) / 2 - 4, y: y + 2, w: wLabel + 8, h: 16, color: '#ffffff' });
      salida.textos.push({ x: (ancho - wLabel) / 2, y: y + 13, texto: '— Salto de página —', fuente: fuenteSalto, color: '#64748b' });
      hueco = ajustarEspacio(tam * 1.2);
      y += 20 + hueco;
      return;
    }

    if (b.tipo === 'tabla') {
      cont.length = 0;
      const nfilas = b.filas.length;
      const ncol = b.filas[0] ? b.filas[0].length : 1;
      const bordeGrosor = Number.isFinite(+b.bordeGrosor) && +b.bordeGrosor >= 0 ? +b.bordeGrosor : TABLA.borde;
      const bordeColor = colorSeguro(b.bordeColor) || TABLA.colorBorde;
      const bordeEstilo = b.bordeEstilo || 'todos';

      // Anchos de columna configurables o proporcionales
      let colW = [];
      if (Array.isArray(b.anchosColumnas) && b.anchosColumnas.length === ncol) {
        const sumW = b.anchosColumnas.reduce((acc, v) => acc + (Number(v) > 0 ? Number(v) : 1), 0) || 1;
        colW = b.anchosColumnas.map((v) => ((Number(v) > 0 ? Number(v) : 1) / sumW) * ancho);
      } else {
        colW = Array.from({ length: ncol }, () => ancho / ncol);
      }
      const colX = [0];
      for (let c = 0; c < ncol; c++) {
        colX.push(c === ncol - 1 ? ancho : colX[c] + colW[c]);
      }

      const px = TABLA.padX * tam;
      const py = pasoGuia ? 0 : TABLA.padY * tam;
      const lh = pasoGuia || tam * BLOQUES.parrafo.interlinea;

      // Calcular flujos y alturas de contenido por celda
      const celdasVisibles = [];
      const alturas = Array(nfilas).fill(ajustarAlPaso(lh + 2 * py + bordeGrosor));

      b.filas.forEach((fila, r) => {
        const enc = b.encabezado && r === 0;
        fila.forEach((cel, c) => {
          if (cel.combinada) return;
          const cs = Math.min(ncol - c, cel.colspan || 1);
          const rs = Math.min(nfilas - r, cel.rowspan || 1);
          const wCelda = colX[c + cs] - colX[c];
          const maxTexto = Math.max(1, wCelda - 2 * px - bordeGrosor);
          const ls = fluir(cel.runs || [], maxTexto, (run) => fuente(run, tam, enc), medidor);
          const hTexto = ls.length * lh;
          celdasVisibles.push({ r, c, cs, rs, ls, cel, enc, wCelda, maxTexto, hTexto });

          if (rs === 1) {
            alturas[r] = Math.max(alturas[r], ajustarAlPaso(hTexto + 2 * py + bordeGrosor));
          }
        });
      });

      // Asegurar que las celdas con rowspan tengan altura total suficiente
      for (const cd of celdasVisibles) {
        if (cd.rs > 1) {
          const hRequerida = ajustarAlPaso(cd.hTexto + 2 * py + bordeGrosor);
          let hActual = 0;
          for (let k = 0; k < cd.rs; k++) hActual += alturas[cd.r + k];
          if (hRequerida > hActual) {
            alturas[cd.r + cd.rs - 1] += (hRequerida - hActual);
          }
        }
      }

      const tops = [y];
      alturas.forEach((h) => tops.push(tops[tops.length - 1] + h));
      const altoTotalTabla = tops[tops.length - 1] - y;

      // Fondos de celda y encabezado
      if (b.encabezado) {
        salida.fondos.push({ x: 0, y, w: ancho, h: alturas[0], color: TABLA.colorEncabezado });
      }
      for (const cd of celdasVisibles) {
        if (cd.cel.fondo) {
          salida.fondos.push({
            x: colX[cd.c],
            y: tops[cd.r],
            w: colX[cd.c + cd.cs] - colX[cd.c],
            h: tops[cd.r + cd.rs] - tops[cd.r],
            color: cd.cel.fondo,
          });
        }
      }

      // Dibujo de bordes según bordeEstilo
      const lin = (x1, y1, x2, y2) => {
        if (bordeGrosor > 0) {
          salida.lineas.push({ x1, y1, x2, y2, grosor: bordeGrosor, color: bordeColor });
        }
      };

      if (bordeEstilo !== 'ninguno' && bordeGrosor > 0) {
        // Líneas horizontales
        for (let r = 0; r <= nfilas; r++) {
          const esBordeExt = (r === 0 || r === nfilas);
          const debeDibujar = esBordeExt
            ? (bordeEstilo === 'todos' || bordeEstilo === 'grilla' || bordeEstilo === 'externo' || bordeEstilo === 'filas')
            : (bordeEstilo === 'todos' || bordeEstilo === 'grilla' || bordeEstilo === 'filas');
          if (!debeDibujar) continue;

          if (esBordeExt) {
            lin(0, tops[r] + 0.5, ancho, tops[r] + 0.5);
          } else {
            // Dividir por segmentos si alguna celda cruza con rowspan
            let xSegIni = 0;
            for (let c = 0; c < ncol; c++) {
              const cruzaRowspan = celdasVisibles.some((cv) => cv.c <= c && c < cv.c + cv.cs && cv.r < r && r < cv.r + cv.rs);
              if (cruzaRowspan) {
                if (colX[c] > xSegIni) lin(xSegIni, tops[r] + 0.5, colX[c], tops[r] + 0.5);
                xSegIni = colX[c + 1];
              }
            }
            if (ancho > xSegIni) lin(xSegIni, tops[r] + 0.5, ancho, tops[r] + 0.5);
          }
        }

        // Líneas verticales
        for (let c = 0; c <= ncol; c++) {
          const esBordeExt = (c === 0 || c === ncol);
          const debeDibujar = esBordeExt
            ? (bordeEstilo === 'todos' || bordeEstilo === 'grilla' || bordeEstilo === 'externo')
            : (bordeEstilo === 'todos' || bordeEstilo === 'grilla');
          if (!debeDibujar) continue;

          const vx = c === 0 ? 0.5 : c === ncol ? ancho - 0.5 : colX[c];
          if (esBordeExt) {
            lin(vx, y, vx, tops[nfilas] + bordeGrosor);
          } else {
            // Dividir por segmentos si alguna celda cruza con colspan
            let ySegIni = y;
            for (let r = 0; r < nfilas; r++) {
              const cruzaColspan = celdasVisibles.some((cv) => cv.r <= r && r < cv.r + cv.rs && cv.c < c && c < cv.c + cv.cs);
              if (cruzaColspan) {
                if (tops[r] > ySegIni) lin(vx, ySegIni, vx, tops[r]);
                ySegIni = tops[r + 1];
              }
            }
            if (tops[nfilas] + bordeGrosor > ySegIni) lin(vx, ySegIni, vx, tops[nfilas] + bordeGrosor);
          }
        }
      }

      // Emisión de texto por celda considerando alineación vertical
      for (const cd of celdasVisibles) {
        const hCelda = tops[cd.r + cd.rs] - tops[cd.r];
        const sobraY = Math.max(0, hCelda - 2 * py - bordeGrosor - cd.hTexto);
        let offY = 0;
        if (cd.cel.alinearV === 'centro') offY = Math.round(sobraY / 2);
        else if (cd.cel.alinearV === 'abajo') offY = Math.round(sobraY);

        emitir(cd.ls, {
          x0: colX[cd.c] + bordeGrosor / 2 + px,
          y0: tops[cd.r] + bordeGrosor / 2 + py + offY,
          max: cd.maxTexto,
          alinear: 'izquierda',
          bt: tam,
          lh,
          negritaBase: cd.enc,
        });
      }

      y = ajustarAlPaso(tops[nfilas] + bordeGrosor);
      hueco = ajustarEspacio(TABLA.despues * tam);
      y += hueco;
      return;
    }

    const def = BLOQUES[b.tipo] || BLOQUES.parrafo;
    const estiloDef = resolverEstilo(b, estilos);
    const factor = estiloDef.factor || def.factor || 1;
    const interlineaBloque = Number.isFinite(+b.interlineado) && +b.interlineado > 0
      ? +b.interlineado
      : (b.estilo ? (estiloDef.interlineado || def.interlinea) : def.interlinea);
    const bt = tam * factor;
    const lh = pasoGuia || (bt * interlineaBloque);
    const alinear = b.alinear || estiloDef.alinear || 'izquierda';
    const sangriaPaso = b.sangria !== undefined ? +b.sangria : (estiloDef.sangria || 0);
    const negritaBase = (b.negrita !== undefined ? b.negrita : estiloDef.negrita) || def.negrita;
    const despuesFactor = (b.estilo && estiloDef.despues !== undefined) ? estiloDef.despues : def.despues;
    const colorPorDefecto = colorSeguro(estiloDef.color) || colorBase;
    const resaltadoBloque = colorSeguro(estiloDef.resaltado);

    let x0 = 0;
    if (def.lista) {
      cont.length = b.nivel + 1;
      x0 = (b.nivel + 1) * SANGRIA_LISTA * tam;
    } else {
      cont.length = 0;
      if (sangriaPaso > 0) {
        x0 = sangriaPaso * SANGRIA_PASO * tam;
      }
    }

    const lineas = fluir(b.runs, Math.max(1, ancho - x0), (run) => fuente(run, bt, negritaBase), medidor);

    if (resaltadoBloque && lineas.length > 0) {
      const altoBloque = lineas.length * lh;
      salida.fondos.push({
        x: x0,
        y,
        w: Math.max(1, ancho - x0),
        h: altoBloque,
        color: resaltadoBloque,
      });
    }

    if (def.lista) {
      let marca;
      if (b.tipo === 'numero') {
        cont[b.nivel] = (b.inicio && b.inicio > 0) ? b.inicio : (cont[b.nivel] || 0) + 1;
        marca = etiquetaNumero(cont[b.nivel], b.nivel);
      } else {
        cont[b.nivel] = 0;
        marca = MARCAS_VINETA[b.nivel];
      }
      const fm = fuente({}, bt, false);
      const mm = medidor.metricas(fm);
      const base = y + (lh - (mm.asc + mm.desc)) / 2 + mm.asc;
      salida.textos.push({ x: x0 - 0.4 * bt - medidor.ancho(fm, marca), y: base, texto: marca, fuente: fm, color: colorPorDefecto });
    }

    y = emitir(lineas, { x0, y0: y, max: Math.max(1, ancho - x0), alinear, bt, lh, negritaBase, colorPorDefecto });
    const siguienteEnLista = sig && sig.tipo !== 'tabla' && BLOQUES[sig.tipo]?.lista && (sig.nivel > 0 || b.nivel > 0 || sig.tipo === b.tipo);
    hueco = ajustarEspacio((def.lista ? (siguienteEnLista ? despuesFactor : FIN_LISTA) : despuesFactor) * bt);
    y += hueco;
  });

  if (bloques.length) y -= hueco;
  salida.alto = bloques.length ? y : tam * BLOQUES.parrafo.interlinea;
  return salida;
}
