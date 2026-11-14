// Formato Páginas (Etapas 10 y 20C): hojas continuas una debajo de otra, como un documento.
// Dimensiones estándar:
// - A4: 794 × 1123 px (210 × 297 mm)
// - Carta: 816 × 1056 px (216 × 279 mm)
// - A5: 559 × 794 px (148 × 210 mm)
// Orientación: vertical y horizontal.
// Márgenes: normal, estrecho, moderado, ancho y personalizado.
export const ANCHO_A4 = 794;
export const ALTO_A4 = 1123;
export const ESPACIO_PAGINAS = 50; // Separación visual entre hojas consecutivas
export const PASO_PAGINA = ALTO_A4 + ESPACIO_PAGINAS; // 1173 px

export const TAMANOS_HOJA = {
  a4: { id: 'a4', nombre: 'A4 (210 × 297 mm)', ancho: 794, alto: 1123, anchoMm: 210, altoMm: 297, css: 'A4' },
  carta: { id: 'carta', nombre: 'Carta (216 × 279 mm)', ancho: 816, alto: 1056, anchoMm: 215.9, altoMm: 279.4, css: 'letter' },
  a5: { id: 'a5', nombre: 'A5 (148 × 210 mm)', ancho: 559, alto: 794, anchoMm: 148, altoMm: 210, css: 'A5' },
};

export const PERFILES_MARGENES = {
  normal: { id: 'normal', nombre: 'Normal (1.6 cm)', superior: 60, inferior: 60, izquierdo: 60, derecho: 60 },
  estrecho: { id: 'estrecho', nombre: 'Estrecho (1.0 cm)', superior: 36, inferior: 36, izquierdo: 36, derecho: 36 },
  moderado: { id: 'moderado', nombre: 'Moderado (sup/inf 1.6 cm, izq/der 1.2 cm)', superior: 60, inferior: 60, izquierdo: 45, derecho: 45 },
  ancho: { id: 'ancho', nombre: 'Ancho (sup/inf 1.6 cm, izq/der 2.4 cm)', superior: 60, inferior: 60, izquierdo: 90, derecho: 90 },
};

export const MARGENES_A4 = PERFILES_MARGENES.normal;

// Calcula las dimensiones efectivas de la hoja según tamaño y orientación
export function dimensionesHoja(config = null) {
  const tamId = (config?.tamanoHoja || 'a4').toLowerCase();
  const base = TAMANOS_HOJA[tamId] || TAMANOS_HOJA.a4;
  const esHorizontal = config?.orientacion === 'horizontal';
  return {
    id: base.id,
    nombre: base.nombre,
    ancho: esHorizontal ? base.alto : base.ancho,
    alto: esHorizontal ? base.ancho : base.alto,
    anchoMm: esHorizontal ? base.altoMm : base.anchoMm,
    altoMm: esHorizontal ? base.anchoMm : base.altoMm,
    orientacion: esHorizontal ? 'horizontal' : 'vertical',
    tamanoCss: base.css,
  };
}

export const anchoHoja = (config = null) => dimensionesHoja(config).ancho;
export const altoHoja = (config = null) => dimensionesHoja(config).alto;
export const pasoPagina = (config = null) => altoHoja(config) + ESPACIO_PAGINAS;

export function margenesHoja(config = null) {
  const m = config?.margenes;
  if (!m) return { ...MARGENES_A4 };
  if (typeof m === 'string' && PERFILES_MARGENES[m.toLowerCase()]) {
    const p = PERFILES_MARGENES[m.toLowerCase()];
    return { superior: p.superior, inferior: p.inferior, izquierdo: p.izquierdo, derecho: p.derecho };
  }
  return {
    superior: Number.isFinite(+m.superior) ? +m.superior : 60,
    inferior: Number.isFinite(+m.inferior) ? +m.inferior : 60,
    izquierdo: Number.isFinite(+m.izquierdo) ? +m.izquierdo : 60,
    derecho: Number.isFinite(+m.derecho) ? +m.derecho : 60,
  };
}

// Devuelve el rectángulo de una página en el espacio continuo del mundo
export function marcoDePagina(numero, config = null) {
  const n = Math.max(1, Math.round(numero || 1));
  const dims = config?.dimensionesPaginas;
  if (Array.isArray(dims) && dims.length > 0) {
    let yActual = 0;
    for (let i = 1; i < n; i++) {
      const dimPrev = dims[i - 1] || dims[0];
      yActual += (dimPrev.alto || ALTO_A4) + ESPACIO_PAGINAS;
    }
    const dim = dims[n - 1] || dims[0];
    return {
      x: 0,
      y: yActual,
      ancho: dim.ancho || ANCHO_A4,
      alto: dim.alto || ALTO_A4,
      numero: n,
      fondo: config?.fondo || null,
    };
  }
  const dimsH = dimensionesHoja(config);
  const paso = dimsH.alto + ESPACIO_PAGINAS;
  const idx = n - 1;
  return {
    x: 0,
    y: idx * paso,
    ancho: dimsH.ancho,
    alto: dimsH.alto,
    numero: n,
    fondo: config?.fondo || null,
  };
}

// Devuelve la lista completa de marcos para las N páginas del documento
export function marcosDePaginas(cantidad, config = null) {
  const n = Math.max(1, Math.round(cantidad || 1));
  const dims = config?.dimensionesPaginas;
  if (Array.isArray(dims) && dims.length > 0) {
    const lista = [];
    let yActual = 0;
    for (let i = 1; i <= n; i++) {
      const dim = dims[i - 1] || dims[0];
      const ancho = dim.ancho || ANCHO_A4;
      const alto = dim.alto || ALTO_A4;
      lista.push({
        x: 0,
        y: yActual,
        ancho,
        alto,
        numero: i,
      });
      yActual += alto + ESPACIO_PAGINAS;
    }
    return lista;
  }
  return Array.from({ length: n }, (_, i) => marcoDePagina(i + 1, config));
}

// Determina el número de página (1-indexado) según la coordenada vertical Y del mundo
export function paginaEnY(y, config = null) {
  if (y <= 0) return 1;
  const dims = config?.dimensionesPaginas;
  if (Array.isArray(dims) && dims.length > 0) {
    let yActual = 0;
    for (let i = 0; i < dims.length; i++) {
      const alto = (dims[i].alto || ALTO_A4) + ESPACIO_PAGINAS;
      if (y < yActual + alto) return i + 1;
      yActual += alto;
    }
    return dims.length;
  }
  const paso = pasoPagina(config);
  return Math.floor(y / paso) + 1;
}

// Devuelve el inicio Y de una página específica
export function yDePagina(numero, config = null) {
  const n = Math.max(1, Math.round(numero || 1));
  const dims = config?.dimensionesPaginas;
  if (Array.isArray(dims) && dims.length > 0) {
    let yActual = 0;
    for (let i = 1; i < n; i++) {
      const dim = dims[i - 1] || dims[0];
      yActual += (dim.alto || ALTO_A4) + ESPACIO_PAGINAS;
    }
    return yActual;
  }
  const paso = pasoPagina(config);
  return (n - 1) * paso;
}

// Normaliza la configuración del formato de páginas
export function normalizarPaginasConfig(config = {}) {
  const cantidad = Math.max(1, Math.round(+config.cantidadPaginas || (Array.isArray(config.paginas) ? config.paginas.length : 1)));
  const activa = Math.max(1, Math.min(cantidad, Math.round(+config.paginaActiva || 1)));
  const tamanoHoja = (config.tamanoHoja && TAMANOS_HOJA[config.tamanoHoja.toLowerCase()])
    ? config.tamanoHoja.toLowerCase()
    : 'a4';
  const orientacion = config.orientacion === 'horizontal' ? 'horizontal' : 'vertical';

  return {
    ...config,
    cantidadPaginas: cantidad,
    paginaActiva: activa,
    tamanoHoja,
    orientacion,
    margenes: margenesHoja(config),
    imprimirRenglones: config.imprimirRenglones !== undefined ? !!config.imprimirRenglones : false,
    flujoAutomatico: config.flujoAutomatico !== undefined ? !!config.flujoAutomatico : false,
    encabezado: {
      activo: !!config.encabezado?.activo,
      texto: typeof config.encabezado?.texto === 'string' ? config.encabezado.texto : '',
      numeracion: !!config.encabezado?.numeracion,
    },
    pie: {
      activo: !!config.pie?.activo,
      texto: typeof config.pie?.texto === 'string' ? config.pie.texto : '',
      numeracion: !!config.pie?.numeracion,
    },
  };
}

// Formatea el texto de encabezado o pie para una página específica (número y total)
export function formatearTextoGuiaPagina(configuracion, numero, total) {
  if (!configuracion || !configuracion.activo) return '';
  const partes = [];
  const txt = (configuracion.texto || '').trim();
  if (txt) partes.push(txt);
  if (configuracion.numeracion) {
    partes.push(`Página ${numero} de ${total}`);
  }
  return partes.join(' · ');
}

// Obtiene el último número correlativo alcanzado en una lista de bloques
export function obtenerUltimoNumeroLista(bloques) {
  if (!Array.isArray(bloques)) return 0;
  let cont = 0;
  for (const b of bloques) {
    if (b.tipo === 'numero') {
      cont = (b.inicio && b.inicio > 0) ? b.inicio : cont + 1;
    }
  }
  return cont;
}

// Configura el inicio de la lista numerada en el primer bloque tipo 'numero'
export function continuarListaNumeradaEnBloques(bloques, numeroInicial) {
  if (!Array.isArray(bloques) || !(numeroInicial > 0)) return bloques;
  let primerNumero = false;
  return bloques.map((b) => {
    if (b.tipo === 'numero' && !primerNumero) {
      primerNumero = true;
      return { ...b, inicio: numeroInicial };
    }
    return b;
  });
}

// Divide un elemento de texto o tabla entre la página actual y la siguiente conservando correlatividad.
// Respeta saltos de página y divide tablas por filas si desbordan la página.
export function partirTextoPorDesborde(el, marco, nuevoIdFn, config = null) {
  if (el.tipo !== 'texto' || !Array.isArray(el.datos?.bloques) || !el.datos.bloques.length) {
    return null;
  }
  const bloques = el.datos.bloques;
  const marg = margenesHoja(config);

  // Caso: el bloque contiene un salto de página manual
  const idxSalto = bloques.findIndex((b) => b.tipo === 'saltoPagina' || b.saltoPagina);
  if (idxSalto >= 0) {
    const puntoCorte = idxSalto === 0 ? 1 : idxSalto;
    let bloquesParte1 = bloques.slice(0, puntoCorte).filter((b) => b.tipo !== 'saltoPagina' && !b.saltoPagina);
    let bloquesParte2 = bloques.slice(puntoCorte).filter((b) => b.tipo !== 'saltoPagina' && !b.saltoPagina);
    if (!bloquesParte1.length) bloquesParte1 = [{ tipo: 'parrafo', runs: [] }];
    if (!bloquesParte2.length) bloquesParte2 = [{ tipo: 'parrafo', runs: [] }];

    const ultimoNumero = obtenerUltimoNumeroLista(bloquesParte1);
    const bloquesParte2Ajustados = ultimoNumero > 0
      ? continuarListaNumeradaEnBloques(bloquesParte2, ultimoNumero + 1)
      : bloquesParte2;

    const elemento1 = { ...el, datos: { ...el.datos, bloques: bloquesParte1 } };
    const numActual = marco.numero || paginaDeElemento(el, config) || 1;
    const paginaSiguiente = numActual + 1;
    const elemento2 = {
      ...el,
      id: nuevoIdFn(),
      y: yDePagina(paginaSiguiente, config) + marg.superior,
      contenedor: paginaSiguiente,
      creado: Date.now(),
      modificado: Date.now(),
      datos: { ...el.datos, bloques: bloquesParte2Ajustados },
    };
    return { elemento1, elemento2, paginaSiguiente };
  }

  // Desborde vertical por altura disponible en la página
  const alturaDisponible = Math.max(80, (marco.y + marco.alto - marg.inferior) - el.y);
  if (alturaDisponible >= el.alto || el.alto <= 0) return null;

  // Si el elemento es una sola tabla de múltiples filas
  if (bloques.length === 1 && bloques[0].tipo === 'tabla' && Array.isArray(bloques[0].filas) && bloques[0].filas.length > 1) {
    const t = bloques[0];
    const totalFilas = t.filas.length;
    const prop = Math.max(0.1, Math.min(0.9, alturaDisponible / el.alto));
    const corteFila = Math.max(1, Math.min(totalFilas - 1, Math.floor(totalFilas * prop)));

    const filas1 = t.filas.slice(0, corteFila);
    // En la página 2, si la tabla original tenía encabezado, repetir la fila de encabezado
    const filas2 = t.encabezado ? [t.filas[0], ...t.filas.slice(corteFila)] : t.filas.slice(corteFila);

    const elemento1 = { ...el, datos: { ...el.datos, bloques: [{ ...t, filas: filas1 }] } };
    const numActual = marco.numero || paginaDeElemento(el, config) || 1;
    const paginaSiguiente = numActual + 1;
    const elemento2 = {
      ...el,
      id: nuevoIdFn(),
      y: yDePagina(paginaSiguiente, config) + marg.superior,
      contenedor: paginaSiguiente,
      creado: Date.now(),
      modificado: Date.now(),
      datos: { ...el.datos, bloques: [{ ...t, filas: filas2 }] },
    };
    return { elemento1, elemento2, paginaSiguiente };
  }

  if (bloques.length <= 1) return null;

  const proporcion = Math.max(0.1, Math.min(0.9, alturaDisponible / el.alto));
  const puntoCorte = Math.max(1, Math.min(bloques.length - 1, Math.floor(bloques.length * proporcion)));

  const bloquesParte1 = bloques.slice(0, puntoCorte);
  const bloquesParte2 = bloques.slice(puntoCorte);

  const ultimoNumero = obtenerUltimoNumeroLista(bloquesParte1);
  const bloquesParte2Ajustados = ultimoNumero > 0
    ? continuarListaNumeradaEnBloques(bloquesParte2, ultimoNumero + 1)
    : bloquesParte2;

  const elemento1 = { ...el, datos: { ...el.datos, bloques: bloquesParte1 } };
  const numActual = marco.numero || paginaDeElemento(el, config) || 1;
  const paginaSiguiente = numActual + 1;
  const elemento2 = {
    ...el,
    id: nuevoIdFn(),
    y: yDePagina(paginaSiguiente, config) + marg.superior,
    contenedor: paginaSiguiente,
    creado: Date.now(),
    modificado: Date.now(),
    datos: { ...el.datos, bloques: bloquesParte2Ajustados },
  };

  return { elemento1, elemento2, paginaSiguiente };
}

/**
 * COMPORTAMIENTO DOCUMENTADO AL CAMBIAR CONFIGURACIÓN DE HOJA (Etapa 20C):
 * - Cada elemento dibujado a mano (trazo) o colocado (texto, figura, imagen) pertenece
 *   a una página específica P del documento.
 * - Su posición relativa dentro de la página (dx = x, dy = y - yInicioPagina) se mantiene
 *   exactamente igual al cambiar el tamaño de hoja, la orientación (vertical/horizontal) o los márgenes.
 * - Los puntos de los trazos a mano alzada (trazos con lápiz, resaltador o borrador) se desplazan
 *   únicamente en vertical por la diferencia de altura/paso entre páginas (deltaY = yNuevaPagina - yViejaPagina).
 * - No se aplican deformaciones, rotaciones no solicitadas ni escalados anisotrópicos a los trazos,
 *   preservando la proporción geométrica y legibilidad original de dibujos, diagramas y firmas.
 * - Los renglones de fondo, encabezados, pies de página y numeración se adaptan a las nuevas dimensiones.
 */
export function migrarElementosPorCambioHoja(elementos, configVieja = null, configNueva = null) {
  if (!Array.isArray(elementos)) return [];
  const cVieja = normalizarPaginasConfig(configVieja || {});
  const cNueva = normalizarPaginasConfig(configNueva || {});

  return elementos.map((el) => {
    const pag = Math.max(1, Number(el.contenedor) || paginaDeElemento(el, cVieja));
    const yVieja = yDePagina(pag, cVieja);
    const yNueva = yDePagina(pag, cNueva);
    const deltaY = yNueva - yVieja;

    if (deltaY === 0) return el;

    const nuevo = {
      ...el,
      y: el.y + deltaY,
      contenedor: pag,
      modificado: Date.now(),
    };

    if (el.tipo === 'trazo' && el.datos?.puntos) {
      nuevo.datos = {
        ...el.datos,
        puntos: el.datos.puntos.map(([px, py, pr]) => [px, py + deltaY, pr]),
      };
    }

    return nuevo;
  });
}

// Página a la que pertenece un elemento: se decide siempre por su posición actual (el centro vertical),
// así sigue siendo correcta aunque el elemento se haya movido de una hoja a otra o cruce un borde.
export function paginaDeElemento(el, config = null) {
  return paginaEnY((el.y || 0) + (el.alto || 0) / 2, config);
}

export function desbordeDePagina(el, margenes = null, config = null) {
  const m = margenes || margenesHoja(config);
  const pagina = paginaDeElemento(el, config);
  const marco = marcoDePagina(pagina, config);
  return {
    pagina,
    superior: el.y < marco.y + m.superior,
    inferior: el.y + el.alto > marco.y + marco.alto - m.inferior,
    izquierdo: el.x < marco.x + m.izquierdo,
    derecho: el.x + el.ancho > marco.x + marco.ancho - m.derecho,
  };
}

export function cabeEnPagina(el, margenes = null, config = null) {
  const m = margenes || margenesHoja(config);
  const dims = dimensionesHoja(config);
  return el.ancho <= dims.ancho - m.izquierdo - m.derecho
    && el.alto <= dims.alto - m.superior - m.inferior;
}

export function moverElementoAPagina(el, numero, margenes = null, config = null) {
  const m = margenes || margenesHoja(config);
  const dims = dimensionesHoja(config);
  const destino = Math.max(1, Math.round(numero || 1));
  const xMin = m.izquierdo;
  const xMax = dims.ancho - m.derecho - el.ancho;
  return {
    ...el,
    x: Math.max(xMin, Math.min(el.x, xMax)),
    y: yDePagina(destino, config) + m.superior,
    contenedor: destino,
  };
}

// Filtra los elementos que corresponden a una página determinada.
// Si se indica la cantidad de páginas, la última recoge también lo que haya quedado más abajo.
export function elementosDePagina(elementos, numero, cantidad = 0, config = null) {
  const n = Math.max(1, Math.round(numero || 1));
  return elementos.filter((el) => {
    const p = paginaDeElemento(el, config);
    return p === n || (cantidad > 0 && n === cantidad && p > n);
  });
}

// Clona los elementos de una página desplazando sus coordenadas a la página de destino
export function duplicarElementosPagina(elementos, numOrigen, numDestino, nuevoIdFn, cantidad = 0, config = null) {
  const deltaY = yDePagina(numDestino, config) - yDePagina(numOrigen, config);

  return elementosDePagina(elementos, numOrigen, cantidad, config).map((el) => {
    const desplazado = {
      ...el,
      id: nuevoIdFn(),
      contenedor: numDestino,
      y: el.y + deltaY,
      creado: Date.now(),
      modificado: Date.now(),
    };

    // Si es un trazo, desplazar cada punto
    if (el.tipo === 'trazo' && el.datos?.puntos) {
      desplazado.datos = {
        ...el.datos,
        puntos: el.datos.puntos.map(([px, py, pr]) => [px, py + deltaY, pr]),
      };
    }
    return desplazado;
  });
}

// Cambios para quitar una página: borra sus elementos y sube un lugar los de las páginas siguientes.
export function cambiosEliminarPagina(elementos, numero, cantidad, config = null) {
  const aBorrar = new Set(elementosDePagina(elementos, numero, cantidad, config).map((e) => e.id));
  const paso = pasoPagina(config);
  const cambios = [];
  for (const el of elementos) {
    if (aBorrar.has(el.id)) { cambios.push({ id: el.id, antes: el, despues: null }); continue; }
    const p = paginaDeElemento(el, config);
    if (p <= numero) continue;
    const nuevo = { ...el, y: el.y - paso, contenedor: p - 1 };
    if (el.tipo === 'trazo' && el.datos?.puntos) nuevo.datos = { ...el.datos, puntos: el.datos.puntos.map(([px, py, pr]) => [px, py - paso, pr]) };
    cambios.push({ id: el.id, antes: el, despues: nuevo });
  }
  return cambios;
}

// Extrae todas las notas al pie del documento, las numera correlativamente (1, 2, 3…)
// y las agrupa por la página A4 correspondiente.
export function extraerNotasAlPieDocumento(elementos = [], config = null) {
  const mapaPorPagina = new Map();
  if (!Array.isArray(elementos)) return mapaPorPagina;

  // Ordenar elementos en orden de lectura: página (o contenedor), Y, luego X
  const ordenados = [...elementos].sort((a, b) => {
    const pA = Number(a.contenedor) || paginaDeElemento(a);
    const pB = Number(b.contenedor) || paginaDeElemento(b);
    if (pA !== pB) return pA - pB;
    return (a.y - b.y) || (a.x - b.x);
  });

  let correlativo = 1;
  for (const el of ordenados) {
    if (el.tipo !== 'texto' || !Array.isArray(el.datos?.bloques)) continue;
    const pag = Math.max(1, Number(el.contenedor) || paginaDeElemento(el));

    for (const b of el.datos.bloques) {
      if (b.tipo === 'tabla') {
        const filas = Array.isArray(b.filas) ? b.filas : [];
        for (const fila of filas) {
          if (!Array.isArray(fila)) continue;
          for (const celda of fila) {
            for (const r of (celda?.runs || [])) {
              if (r.notaAlPie) {
                if (!mapaPorPagina.has(pag)) mapaPorPagina.set(pag, []);
                mapaPorPagina.get(pag).push({
                  numero: correlativo++,
                  texto: String(r.notaAlPie).trim(),
                });
              }
            }
          }
        }
      } else {
        for (const r of (b.runs || [])) {
          if (r.notaAlPie) {
            if (!mapaPorPagina.has(pag)) mapaPorPagina.set(pag, []);
            mapaPorPagina.get(pag).push({
              numero: correlativo++,
              texto: String(r.notaAlPie).trim(),
            });
          }
        }
      }
    }
  }

  return mapaPorPagina;
}

// Genera la lista de entradas para la Tabla de Contenido a partir de los títulos y subtítulos del documento
export function generarIndiceContenido(elementos = [], config = null, estilos = null) {
  const entradas = [];
  if (!Array.isArray(elementos)) return entradas;

  const ordenados = [...elementos].sort((a, b) => {
    const pA = Number(a.contenedor) || paginaDeElemento(a);
    const pB = Number(b.contenedor) || paginaDeElemento(b);
    if (pA !== pB) return pA - pB;
    return (a.y - b.y) || (a.x - b.x);
  });

  for (const el of ordenados) {
    if (el.tipo !== 'texto' || !Array.isArray(el.datos?.bloques)) continue;
    if (el.datos?.esTablaContenido) continue; // no indexarse a sí misma

    const pag = Math.max(1, Number(el.contenedor) || paginaDeElemento(el));

    el.datos.bloques.forEach((b, idx) => {
      if (!b || b.tipo === 'tabla' || b.tipo === 'saltoPagina') return;

      const txt = Array.isArray(b.runs) ? b.runs.map((r) => r.texto || '').join('').trim() : '';
      if (!txt) return;

      let nivel = null;
      if (b.tipo === 'titulo1' || b.estilo === 'titulo') nivel = 1;
      else if (b.tipo === 'titulo2' || b.estilo === 'subtitulo') nivel = 2;
      else if (b.tipo === 'titulo3') nivel = 3;

      if (nivel !== null) {
        entradas.push({
          elementoId: el.id,
          bloqueIdx: idx,
          texto: txt,
          nivel,
          pagina: pag,
          y: el.y,
        });
      }
    });
  }

  return entradas;
}

// Crea los bloques formateados de un elemento de texto de Tabla de Contenido
export function crearBloquesTablaContenido(entradas = []) {
  const bloques = [
    {
      tipo: 'titulo2',
      estilo: 'subtitulo',
      alinear: 'izquierda',
      runs: [{ texto: 'Tabla de contenido', negrita: true }],
    },
  ];

  if (!entradas.length) {
    bloques.push({
      tipo: 'parrafo',
      estilo: 'normal',
      runs: [{ texto: '(No se encontraron títulos ni subtítulos en el documento)', cursiva: true, color: '#6c757d' }],
    });
    return bloques;
  }

  entradas.forEach((e) => {
    const sangria = Math.max(0, e.nivel - 1);
    const puntos = ' ' + '. '.repeat(Math.max(4, 28 - Math.round(e.texto.length * 0.7) - sangria * 3)) + ' ';
    bloques.push({
      tipo: 'parrafo',
      estilo: 'normal',
      sangria,
      runs: [
        {
          texto: e.texto,
          negrita: e.nivel === 1,
          enlace: { tipo: 'nota', url: `#pag-${e.pagina}`, notaId: null, bloqueId: e.elementoId },
        },
        {
          texto: puntos,
          color: '#94a3b8',
        },
        {
          texto: `Pág. ${e.pagina}`,
          negrita: e.nivel === 1,
          color: '#1e293b',
        },
      ],
    });
  });

  return bloques;
}
