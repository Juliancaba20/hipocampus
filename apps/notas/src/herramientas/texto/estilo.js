// Estilo común del texto con teclado (Etapas 6 y 20A). Lo usan la maquetación del lienzo y el editor,
// y el CSS del editor se genera desde estas mismas constantes: así lo que se ve al escribir
// y lo que queda dibujado en el lienzo no pueden desalinearse.

export const CATALOGO_FUENTES = {
  serif: {
    id: 'serif',
    nombre: 'Serif (griego)',
    familia: "'Source Serif 4 Variable', Georgia, serif",
  },
  sans: {
    id: 'sans',
    nombre: 'Sans',
    familia: "'Bricolage Grotesque Variable', system-ui, -apple-system, sans-serif",
  },
  mono: {
    id: 'mono',
    nombre: 'Mono',
    familia: "'ui-monospace', 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
  },
};

export const FUENTE_PREDETERMINADA = 'serif';
export const FUENTE_TEXTO = CATALOGO_FUENTES.serif.familia;
export const TAMANO_TEXTO = 20; // tamaño base por defecto, en unidades del mundo
export const COLOR_TEXTO = '#14192b';
export const TAMANOS_TEXTO = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128];

export const INTERLINEADOS = [1.0, 1.15, 1.3, 1.4, 1.5, 2.0];
export const SANGRIA_PASO = 1.5; // em por paso de sangría de bloque
export const SANGRIA_MAX = 5;

// factor: tamaño respecto de la base · interlinea: altura de renglón · despues: separación posterior (en em del bloque)
export const BLOQUES = {
  parrafo: { factor: 1, negrita: false, interlinea: 1.4, despues: 0.4 },
  titulo1: { factor: 1.9, negrita: true, interlinea: 1.2, despues: 0.5 },
  titulo2: { factor: 1.5, negrita: true, interlinea: 1.25, despues: 0.45 },
  titulo3: { factor: 1.25, negrita: true, interlinea: 1.3, despues: 0.4 },
  vineta: { factor: 1, negrita: false, interlinea: 1.4, despues: 0.15, lista: true },
  numero: { factor: 1, negrita: false, interlinea: 1.4, despues: 0.15, lista: true },
};
export const ETIQUETA_BLOQUE = { parrafo: 'p', titulo1: 'h1', titulo2: 'h2', titulo3: 'h3' };
export const ALINEACIONES = ['izquierda', 'centro', 'derecha', 'justificado'];

export const SANGRIA_LISTA = 1.6; // em por nivel
export const FIN_LISTA = 0.4; // separación tras terminar una lista (em)
export const NIVEL_MAX = 2;
export const MARCAS_VINETA = ['•', '◦', '▪'];

export const TABLA = { padX: 0.5, padY: 0.35, despues: 0.5, borde: 1, colorBorde: '#b9c4e0', colorEncabezado: '#eaf0ff', maxFilas: 200, maxColumnas: 12 };

export const COLOR_ENLACE = '#1a73e8';

export const ESTILOS_PREDETERMINADOS = {
  normal: {
    id: 'normal',
    nombre: 'Texto normal',
    tipo: 'parrafo',
    factor: 1,
    negrita: false,
    cursiva: false,
    fuente: 'serif',
    color: '#14192b',
    alinear: 'izquierda',
    interlineado: 1.4,
    despues: 0.4,
    sangria: 0,
  },
  titulo: {
    id: 'titulo',
    nombre: 'Título',
    tipo: 'titulo1',
    factor: 1.9,
    negrita: true,
    cursiva: false,
    fuente: 'serif',
    color: '#14192b',
    alinear: 'izquierda',
    interlineado: 1.2,
    despues: 0.5,
    sangria: 0,
  },
  subtitulo: {
    id: 'subtitulo',
    nombre: 'Subtítulo',
    tipo: 'titulo2',
    factor: 1.45,
    negrita: true,
    cursiva: false,
    fuente: 'serif',
    color: '#14192b',
    alinear: 'izquierda',
    interlineado: 1.25,
    despues: 0.4,
    sangria: 0,
  },
  definicion: {
    id: 'definicion',
    nombre: 'Definición',
    tipo: 'parrafo',
    factor: 1,
    negrita: false,
    cursiva: true,
    fuente: 'serif',
    color: '#1a365d',
    alinear: 'izquierda',
    interlineado: 1.4,
    despues: 0.4,
    sangria: 1,
  },
  importante: {
    id: 'importante',
    nombre: 'Importante',
    tipo: 'parrafo',
    factor: 1.05,
    negrita: true,
    cursiva: false,
    fuente: 'sans',
    color: '#b45309',
    alinear: 'izquierda',
    interlineado: 1.35,
    despues: 0.4,
    sangria: 0,
    resaltado: '#fef3c7',
  },
  cita: {
    id: 'cita',
    nombre: 'Cita',
    tipo: 'parrafo',
    factor: 1,
    negrita: false,
    cursiva: true,
    fuente: 'serif',
    color: '#4b5563',
    alinear: 'izquierda',
    interlineado: 1.4,
    despues: 0.4,
    sangria: 1,
  },
};

export function obtenerCatalogoEstilos(estilosDoc = null) {
  if (!estilosDoc || typeof estilosDoc !== 'object') {
    return { ...ESTILOS_PREDETERMINADOS };
  }
  return { ...ESTILOS_PREDETERMINADOS, ...estilosDoc };
}

export function resolverEstilo(bloque, catalogoEstilos = null) {
  const cat = obtenerCatalogoEstilos(catalogoEstilos);
  const b = bloque || {};
  if (b.estilo && cat[b.estilo]) {
    return cat[b.estilo];
  }
  if (b.tipo === 'titulo1') return cat.titulo || ESTILOS_PREDETERMINADOS.titulo;
  if (b.tipo === 'titulo2') return cat.subtitulo || ESTILOS_PREDETERMINADOS.subtitulo;
  if (b.tipo === 'titulo3') return cat.subtitulo || ESTILOS_PREDETERMINADOS.subtitulo;
  return cat.normal || ESTILOS_PREDETERMINADOS.normal;
}

export function resolverFamilia(fuenteId) {
  return CATALOGO_FUENTES[fuenteId]?.familia || CATALOGO_FUENTES.serif.familia;
}

export function fuente(run = {}, tam, negritaBase = false) {
  const f = typeof run === 'object' && run !== null ? run : {};
  let t = Number(f.tamano) > 0 ? Number(f.tamano) : tam;
  if (f.script === 'sub' || f.script === 'super') {
    t = Math.max(8, Math.round(t * 0.72));
  }
  const familia = resolverFamilia(f.fuente);
  return `${f.cursiva ? 'italic ' : ''}${f.negrita || negritaBase ? 700 : 400} ${t}px ${familia}`;
}

// CSS estructural del editor, derivado de las constantes anteriores. El selector [data-nt-editor]
// marca el elemento editable; los colores y recuadros viven en estilos/editor.css.
export function cssEditor() {
  const R = '[data-nt-editor]';
  const p = BLOQUES.parrafo, L = BLOQUES.vineta;
  const css = [
    `${R}{font-family:${FUENTE_TEXTO};line-height:${p.interlinea};white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;}`,
    `${R} p,${R} div{margin:0 0 ${p.despues}em;}`,
    ...['titulo1', 'titulo2', 'titulo3'].map((t, i) => `${R} h${i + 1}{font-size:${BLOQUES[t].factor}em;line-height:${BLOQUES[t].interlinea};font-weight:700;margin:0 0 ${BLOQUES[t].despues}em;}`),
    `${R} ul,${R} ol{margin:0 0 ${FIN_LISTA}em;padding:0 0 0 ${SANGRIA_LISTA}em;}`,
    `${R} ul ul,${R} ul ol,${R} ol ul,${R} ol ol{margin:0;}`,
    `${R} li{margin:${L.despues}em 0 0;}`,
    `${R}>ul>li:first-child,${R}>ol>li:first-child{margin-top:0;}`,
    // Marcas por profundidad, iguales a las que dibuja el lienzo (•/◦/▪, 1./a./i.)
    `${R} ul{list-style-type:disc;}`, `${R} ul ul,${R} ul ol{list-style-type:circle;}`,
    `${R} ul ul ul,${R} ul ol ul,${R} ol ul ul,${R} ol ol ul{list-style-type:square;}`,
    `${R} ol{list-style-type:decimal;}`, `${R} ul ol,${R} ol ol{list-style-type:lower-alpha;}`,
    `${R} ul ul ol,${R} ul ol ol,${R} ol ul ol,${R} ol ol ol{list-style-type:lower-roman;}`,
    // Subíndice y superíndice
    `${R} sub,${R} sup{font-size:0.72em;line-height:0;position:relative;vertical-align:baseline;}`,
    `${R} sub{bottom:-0.24em;}`,
    `${R} sup{top:-0.4em;}`,
    // Enlaces
    `${R} a{color:${COLOR_ENLACE};text-decoration:underline;cursor:pointer;}`,
    `${R} a:hover{opacity:0.85;}`,
    // Notas al pie
    `${R} sup.nt-nota-pie{font-weight:600;color:#2563eb;cursor:help;padding:0 2px;}`,
    // Texto oculto (cloze) en edición
    `${R} .nt-oculto,${R} [data-nt-oculto="1"]{background:rgba(59,130,246,0.18);border-bottom:2px dashed #2563eb;border-radius:3px;padding:0 2px;}`,
    // Salto de página manual
    `${R} hr.nt-salto-pagina,${R} [data-nt-salto-pagina="1"]{border:none;border-top:2px dashed #94a3b8;margin:1.5em 0;position:relative;text-align:center;height:1px;overflow:visible;}`,
    `${R} hr.nt-salto-pagina::after,${R} [data-nt-salto-pagina="1"]::after{content:"— Salto de página —";position:relative;top:-10px;background:#ffffff;padding:0 10px;font-size:11px;color:#64748b;font-weight:500;}`,
    // Justificado
    `${R} [data-nt-justificado="1"],${R} p[style*="text-align: justify"],${R} p[style*="text-align:justify"]{text-align:justify;text-justify:inter-word;}`,
    `${R} table{border-collapse:collapse;table-layout:fixed;width:100%;margin:0 0 ${TABLA.despues}em;}`,
    `${R} td,${R} th{border:${TABLA.borde}px solid ${TABLA.colorBorde};padding:${TABLA.padY}em ${TABLA.padX}em;vertical-align:top;font-weight:400;text-align:left;line-height:${p.interlinea};overflow-wrap:break-word;}`,
    `${R} td p,${R} td div,${R} th p,${R} th div{margin:0;}`,
    `${R} table[data-enc="1"] tr:first-child>*{background:${TABLA.colorEncabezado};font-weight:700;}`,
    `${R}>:last-child{margin-bottom:0;}`,
    `${R}[data-nt-guiado="1"]{line-height:var(--nt-paso);}`,
    `${R}[data-nt-guiado="1"] p,${R}[data-nt-guiado="1"] div{line-height:var(--nt-paso);margin:0 0 var(--nt-gap-parrafo);}`,
    ...['titulo1', 'titulo2', 'titulo3'].map((t, i) => `${R}[data-nt-guiado="1"] h${i + 1}{line-height:var(--nt-lh-${i + 1});margin:0 0 var(--nt-gap-titulo-${i + 1});}`),
    `${R}[data-nt-guiado="1"] ul,${R}[data-nt-guiado="1"] ol{margin:0 0 var(--nt-gap-lista);}`,
    `${R}[data-nt-guiado="1"] li{line-height:var(--nt-paso);margin:0;}`,
    `${R}[data-nt-guiado="1"] table{margin:0 0 var(--nt-gap-tabla);}`,
    `${R}[data-nt-guiado="1"] td,${R}[data-nt-guiado="1"] th{line-height:var(--nt-paso);padding:0 ${TABLA.padX}em;}`,
  ];
  return css.join('\n');
}
