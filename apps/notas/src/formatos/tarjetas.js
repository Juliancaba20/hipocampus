// Formato Tarjetas (Etapa 9): fichas de estudio para una idea por tarjeta.
// Manejo de tamaños, proporciones, lista de tarjetas y contenedor de elementos.
import { nuevoId, TIPOS_ELEMENTO, crearElemento } from '../almacen/modelo.js';

// Escala física: 5 unidades del lienzo = 1 mm de papel. Así A6 y A5 miden lo que dicen al imprimir.
export const PX_POR_MM = 5;
export const MM_MIN = 40;
export const MM_MAX = 400;

export const DISENOS_TARJETA = {
  'en-blanco': { id: 'en-blanco', nombre: 'En blanco', descripcion: 'Lienzo libre sin guías de diseño' },
  'titulo': { id: 'titulo', nombre: 'Título', descripcion: 'Título central destacado' },
  'titulo-contenido': { id: 'titulo-contenido', nombre: 'Título y contenido', descripcion: 'Título superior y cuerpo de texto' },
  'dos-columnas': { id: 'dos-columnas', nombre: 'Dos columnas', descripcion: 'Título y dos columnas comparativas' },
  'imagen-texto': { id: 'imagen-texto', nombre: 'Imagen con texto', descripcion: 'Espacio para imagen a la izquierda y texto a la derecha' },
};

export const LISTA_DISENOS_TARJETA = Object.values(DISENOS_TARJETA);

const enMm = (ancho, alto, nombre) => ({ ancho, alto, nombre, anchoMm: ancho / PX_POR_MM, altoMm: alto / PX_POR_MM });

export const PROPORCIONES_TARJETA = {
  '16:9': enMm(1120, 630, '16:9 (Panorámica)'),
  '4:3': enMm(960, 720, '4:3 (Estándar)'),
  A6: enMm(740, 525, 'A6 (Ficha clásica, 148 × 105 mm)'),
  A5: enMm(1050, 740, 'A5 (Ficha grande, 210 × 148 mm)'),
};

const acotarMm = (v, defecto) => {
  if (v === '' || v === null || v === undefined) return defecto;
  if (typeof v === 'string' && !v.trim()) return defecto;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MM_MAX, Math.max(MM_MIN, Math.round(n))) : defecto;
};

export function normalizarPersonalizado(p) {
  return { anchoMm: acotarMm(p?.anchoMm, 150), altoMm: acotarMm(p?.altoMm, 100) };
}

export function medidasTarjeta(tamano = '16:9', personalizado = null) {
  if (tamano === 'personalizado') {
    const { anchoMm, altoMm } = normalizarPersonalizado(personalizado);
    return enMm(anchoMm * PX_POR_MM, altoMm * PX_POR_MM, `Personalizado (${anchoMm} × ${altoMm} mm)`);
  }
  return PROPORCIONES_TARJETA[tamano] || PROPORCIONES_TARJETA['16:9'];
}

// Normaliza la configuración de tarjetas dentro de doc.config
export function normalizarTarjetasConfig(config = {}) {
  const tamano = config.tamano === 'personalizado' || (config.tamano && PROPORCIONES_TARJETA[config.tamano]) ? config.tamano : '16:9';
  const tarjetas = Array.isArray(config.tarjetas) && config.tarjetas.length > 0
    ? config.tarjetas.map((t, idx) => ({
      id: t.id || nuevoId(),
      titulo: typeof t.titulo === 'string' ? t.titulo : `Tarjeta ${idx + 1}`,
      diseno: DISENOS_TARJETA[t.diseno] ? t.diseno : 'en-blanco',
      disenoReverso: DISENOS_TARJETA[t.disenoReverso] ? t.disenoReverso : 'en-blanco',
      notasOrador: typeof t.notasOrador === 'string' ? t.notasOrador : '',
      fondo: t.fondo || null,
      fondoReverso: t.fondoReverso || null,
      dobleCara: !!t.dobleCara,
    }))
    : [{ id: nuevoId(), titulo: 'Tarjeta 1', diseno: 'en-blanco', disenoReverso: 'en-blanco', notasOrador: '', fondo: null, fondoReverso: null, dobleCara: false }];

  const activa = config.tarjetaActiva && tarjetas.some((t) => t.id === config.tarjetaActiva)
    ? config.tarjetaActiva
    : tarjetas[0].id;

  return {
    ...config,
    tamano,
    personalizado: normalizarPersonalizado(config.personalizado),
    tarjetas,
    tarjetaActiva: activa,
    imprimirRenglones: config.imprimirRenglones !== undefined ? !!config.imprimirRenglones : false,
    porHoja: [1, 2, 4, 6].includes(config.porHoja) ? config.porHoja : 1,
    marcasDeCorte: !!config.marcasDeCorte,
  };
}

// Mueve una tarjeta de una posición a otra (devuelve una lista nueva).
export function moverTarjeta(lista, desde, hasta) {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) return lista;
  const copia = [...lista];
  const [t] = copia.splice(desde, 1);
  copia.splice(hasta, 0, t);
  return copia;
}

// Calcula el índice de destino al arrastrar una tarjeta sobre una lista vertical (tira) o cuadrícula.
export function calcularDestinoArrastre(rects, pos) {
  if (!rects || !rects.length) return 0;
  if (rects.length === 1) return 0;

  const y = typeof pos === 'number' ? pos : (pos?.y ?? 0);
  const x = typeof pos === 'object' ? (pos?.x ?? 0) : 0;

  const normalizados = rects.map((r) => {
    const top = r.top !== undefined ? r.top : (r.y !== undefined ? r.y : 0);
    const bottom = r.bottom !== undefined ? r.bottom : (top + (r.alto || r.height || 0));
    const left = r.left !== undefined ? r.left : (r.x !== undefined ? r.x : undefined);
    const right = r.right !== undefined ? r.right : (left !== undefined ? left + (r.ancho || r.width || 0) : undefined);
    return { top, bottom, left, right };
  });

  const esVertical = normalizados.every(
    (r) => r.left === undefined || Math.abs(r.left - (normalizados[0].left || 0)) < 10,
  );

  if (esVertical) {
    const primerCentro = normalizados[0].top + (normalizados[0].bottom - normalizados[0].top) / 2;
    if (y < primerCentro) return 0;

    const ult = normalizados[normalizados.length - 1];
    const ultCentro = ult.top + (ult.bottom - ult.top) / 2;
    if (y >= ultCentro) return normalizados.length - 1;

    for (let i = 0; i < normalizados.length - 1; i++) {
      const c1 = normalizados[i].top + (normalizados[i].bottom - normalizados[i].top) / 2;
      const c2 = normalizados[i + 1].top + (normalizados[i + 1].bottom - normalizados[i + 1].top) / 2;
      if (y >= c1 && y < c2) {
        return (y - c1 < c2 - y) ? i : i + 1;
      }
    }
    return normalizados.length - 1;
  }

  // Cuadrícula 2D
  let mejorDist = Infinity;
  let mejorIndice = 0;

  for (let i = 0; i < normalizados.length; i++) {
    const r = normalizados[i];
    const cx = r.left !== undefined && r.right !== undefined ? (r.left + r.right) / 2 : 0;
    const cy = r.top + (r.bottom - r.top) / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < mejorDist) {
      mejorDist = dist;
      mejorIndice = i;
    }
  }

  return Math.max(0, Math.min(normalizados.length - 1, mejorIndice));
}

// Distribución de tarjetas por hoja A4 vertical: 1, 2, 4 o 6.
export const HOJA_A4_MM = { ancho: 210, alto: 297, margen: 10, aire: 6 };
const REJILLAS = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3] };

export function distribucionHoja(porHoja = 1) {
  const [columnas, filas] = REJILLAS[porHoja] || REJILLAS[1];
  return { columnas, filas, porHoja: columnas * filas };
}

// Tamaño con que sale impresa una tarjeta: nunca más grande que el real, y reducida solo si no cabe en su celda.
export function tamanoImpreso(med, porHoja = 1) {
  const { columnas, filas } = distribucionHoja(porHoja);
  const celdaAncho = (HOJA_A4_MM.ancho - 2 * HOJA_A4_MM.margen) / columnas - 2 * HOJA_A4_MM.aire;
  const celdaAlto = (HOJA_A4_MM.alto - 2 * HOJA_A4_MM.margen) / filas - 2 * HOJA_A4_MM.aire - 6; // 6 mm para el rótulo
  const escala = Math.min(1, celdaAncho / med.anchoMm, celdaAlto / med.altoMm);
  return { anchoMm: med.anchoMm * escala, altoMm: med.altoMm * escala, escala };
}

// Filtra los elementos correspondientes a una tarjeta específica y opcionalmente a su cara ('anverso' | 'reverso')
export function elementosDeTarjeta(elementos, tarjetaId, caraOPrimera = null, esPrimeraTarjeta = false) {
  const cara = typeof caraOPrimera === 'string' ? caraOPrimera : null;
  const esPrimera = typeof caraOPrimera === 'boolean' ? caraOPrimera : !!esPrimeraTarjeta;
  return elementos.filter((el) => {
    const coincide = el.contenedor === tarjetaId || (esPrimera && (!el.contenedor || el.contenedor === 'null'));
    if (!coincide) return false;
    if (cara === 'anverso') return !el.cara || el.cara === 'anverso';
    if (cara === 'reverso') return el.cara === 'reverso';
    return true;
  });
}

// Reubica un elemento de tarjeta que quedó fuera de sus límites. Devuelve el mismo objeto si ya está dentro.
export function reubicarEnTarjeta(el, medidas) {
  const fueraY = el.y + (el.alto || 0) < 0 || el.y > medidas.alto;
  const fueraX = el.x + (el.ancho || 0) < 0 || el.x > medidas.ancho;
  if (!fueraY && !fueraX) return el;
  return {
    ...el,
    x: Math.min(Math.max(0, el.x), Math.max(0, medidas.ancho - (el.ancho || 0))),
    y: Math.min(Math.max(0, el.y), Math.max(0, medidas.alto - (el.alto || 0))),
  };
}

// Documentos antiguos: los elementos que no pertenecen a ninguna tarjeta pasan a la primera.
// No modifica la lista recibida. Devuelve { elementos, cambiados } (cambiados = los que hay que volver a guardar).
export function asignarHuerfanos(elementos, primeraTarjetaId) {
  const cambiados = [];
  const nuevos = elementos.map((el) => {
    if (el.contenedor && el.contenedor !== 'null') return el;
    const mod = { ...el, contenedor: primeraTarjetaId };
    cambiados.push(mod);
    return mod;
  });
  return { elementos: nuevos, cambiados };
}

// Clona los elementos de una tarjeta para duplicarla
export function duplicarElementosTarjeta(elementos, origenId, destinoId, nuevoIdFn = nuevoId) {
  return elementos
    .filter((el) => el.contenedor === origenId)
    .map((el) => ({
      ...el,
      id: nuevoIdFn(),
      contenedor: destinoId,
      cara: el.cara || 'anverso',
      creado: Date.now(),
      modificado: Date.now(),
    }));
}

/**
 * Aplica o cambia el diseño predefinido de una tarjeta sin perder su contenido.
 * Reorganiza armónicamente los textos existentes en la estructura del diseño
 * y conserva intactos todos los dibujos, trazos, figuras e imágenes.
 */
export function cambiarDisenoTarjeta(elementos, tarjetaId, nuevoDiseno, med = { ancho: 1120, alto: 630 }, documentoId = '', cara = 'anverso') {
  const caraValida = cara === 'reverso' ? 'reverso' : 'anverso';
  const deTarjeta = elementos.filter((e) => e.contenedor === tarjetaId && (caraValida === 'reverso' ? e.cara === 'reverso' : (!e.cara || e.cara === 'anverso')));
  const textos = deTarjeta.filter((e) => e.tipo === TIPOS_ELEMENTO.TEXTO);
  const imagenes = deTarjeta.filter((e) => e.tipo === TIPOS_ELEMENTO.IMAGEN);
  const cambios = [];

  if (nuevoDiseno === 'en-blanco') {
    return { cambios };
  }

  const margenH = Math.round(med.ancho * 0.08);
  const anchoUtil = med.ancho - margenH * 2;
  const ahora = Date.now();
  let zMax = elementos.reduce((m, e) => Math.max(m, e.z || 0), 0);

  if (nuevoDiseno === 'titulo') {
    if (textos.length > 0) {
      const primerTexto = textos[0];
      const actualizado = {
        ...primerTexto,
        x: margenH,
        y: Math.round(med.alto * 0.36),
        ancho: anchoUtil,
        modificado: ahora,
        datos: {
          ...primerTexto.datos,
          tamano: Math.max(28, primerTexto.datos?.tamano || 32),
        },
      };
      cambios.push({ id: primerTexto.id, antes: primerTexto, despues: actualizado });
    } else {
      const nuevo = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: margenH,
        y: Math.round(med.alto * 0.36),
        ancho: anchoUtil,
        alto: 80,
        z: ++zMax,
        contenedor: tarjetaId,
        cara: caraValida,
        datos: {
          bloques: [{ t: 'Título de la ficha', e: 'titulo' }],
          tamano: 32,
          color: '#14192b',
        },
      });
      cambios.push({ id: nuevo.id, antes: null, despues: nuevo });
    }
  } else if (nuevoDiseno === 'titulo-contenido') {
    const yTitulo = Math.round(med.alto * 0.08);
    const altoTitulo = Math.round(med.alto * 0.16);
    const yCuerpo = yTitulo + altoTitulo + 20;
    const altoCuerpo = med.alto - yCuerpo - Math.round(med.alto * 0.08);

    if (textos.length >= 2) {
      const t1 = textos[0];
      const t2 = textos[1];
      const act1 = { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 28 } };
      const act2 = { ...t2, x: margenH, y: yCuerpo, ancho: anchoUtil, alto: Math.max(t2.alto, altoCuerpo), modificado: ahora, datos: { ...t2.datos, tamano: 18 } };
      cambios.push({ id: t1.id, antes: t1, despues: act1 });
      cambios.push({ id: t2.id, antes: t2, despues: act2 });
    } else if (textos.length === 1) {
      const t1 = textos[0];
      const act1 = { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 28 } };
      cambios.push({ id: t1.id, antes: t1, despues: act1 });
      const nuevoCuerpo = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: margenH,
        y: yCuerpo,
        ancho: anchoUtil,
        alto: altoCuerpo,
        z: ++zMax,
        contenedor: tarjetaId,
        cara: caraValida,
        datos: {
          bloques: [{ t: 'Agregue aquí los conceptos, definiciones o puntos clave…', e: 'normal' }],
          tamano: 18,
          color: '#334155',
        },
      });
      cambios.push({ id: nuevoCuerpo.id, antes: null, despues: nuevoCuerpo });
    } else {
      const nuevoTit = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: margenH,
        y: yTitulo,
        ancho: anchoUtil,
        alto: altoTitulo,
        z: ++zMax,
        contenedor: tarjetaId,
        cara: caraValida,
        datos: { bloques: [{ t: 'Título principal', e: 'titulo' }], tamano: 28, color: '#14192b' },
      });
      const nuevoCuerpo = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: margenH,
        y: yCuerpo,
        ancho: anchoUtil,
        alto: altoCuerpo,
        z: ++zMax,
        contenedor: tarjetaId,
        cara: caraValida,
        datos: { bloques: [{ t: 'Desarrollo de la idea o notas de estudio…', e: 'normal' }], tamano: 18, color: '#334155' },
      });
      cambios.push({ id: nuevoTit.id, antes: null, despues: nuevoTit });
      cambios.push({ id: nuevoCuerpo.id, antes: null, despues: nuevoCuerpo });
    }
  } else if (nuevoDiseno === 'dos-columnas') {
    const yTitulo = Math.round(med.alto * 0.08);
    const altoTitulo = Math.round(med.alto * 0.14);
    const yCols = yTitulo + altoTitulo + 20;
    const altoCols = med.alto - yCols - Math.round(med.alto * 0.08);
    const anchoCol = Math.round((anchoUtil - 30) / 2);
    const xCol1 = margenH;
    const xCol2 = margenH + anchoCol + 30;

    if (textos.length >= 3) {
      const [t1, t2, t3] = textos;
      cambios.push({ id: t1.id, antes: t1, despues: { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 26 } } });
      cambios.push({ id: t2.id, antes: t2, despues: { ...t2, x: xCol1, y: yCols, ancho: anchoCol, modificado: ahora, datos: { ...t2.datos, tamano: 17 } } });
      cambios.push({ id: t3.id, antes: t3, despues: { ...t3, x: xCol2, y: yCols, ancho: anchoCol, modificado: ahora, datos: { ...t3.datos, tamano: 17 } } });
    } else if (textos.length === 2) {
      const [t1, t2] = textos;
      cambios.push({ id: t1.id, antes: t1, despues: { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 26 } } });
      cambios.push({ id: t2.id, antes: t2, despues: { ...t2, x: xCol1, y: yCols, ancho: anchoCol, modificado: ahora, datos: { ...t2.datos, tamano: 17 } } });
      const nuevoCol2 = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xCol2, y: yCols, ancho: anchoCol, alto: altoCols, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Segunda columna…', e: 'normal' }], tamano: 17, color: '#334155' },
      });
      cambios.push({ id: nuevoCol2.id, antes: null, despues: nuevoCol2 });
    } else if (textos.length === 1) {
      const [t1] = textos;
      cambios.push({ id: t1.id, antes: t1, despues: { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 26 } } });
      const col1 = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xCol1, y: yCols, ancho: anchoCol, alto: altoCols, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Columna 1: Concepto A…', e: 'normal' }], tamano: 17, color: '#334155' },
      });
      const col2 = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xCol2, y: yCols, ancho: anchoCol, alto: altoCols, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Columna 2: Concepto B…', e: 'normal' }], tamano: 17, color: '#334155' },
      });
      cambios.push({ id: col1.id, antes: null, despues: col1 });
      cambios.push({ id: col2.id, antes: null, despues: col2 });
    } else {
      const tit = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: margenH, y: yTitulo, ancho: anchoUtil, alto: altoTitulo, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Comparación / Dos columnas', e: 'titulo' }], tamano: 26, color: '#14192b' },
      });
      const col1 = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xCol1, y: yCols, ancho: anchoCol, alto: altoCols, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Columna 1: Concepto A…', e: 'normal' }], tamano: 17, color: '#334155' },
      });
      const col2 = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xCol2, y: yCols, ancho: anchoCol, alto: altoCols, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Columna 2: Concepto B…', e: 'normal' }], tamano: 17, color: '#334155' },
      });
      cambios.push({ id: tit.id, antes: null, despues: tit });
      cambios.push({ id: col1.id, antes: null, despues: col1 });
      cambios.push({ id: col2.id, antes: null, despues: col2 });
    }
  } else if (nuevoDiseno === 'imagen-texto') {
    const yTitulo = Math.round(med.alto * 0.08);
    const altoTitulo = Math.round(med.alto * 0.14);
    const yZona = yTitulo + altoTitulo + 20;
    const altoZona = med.alto - yZona - Math.round(med.alto * 0.08);
    const anchoImg = Math.round((anchoUtil - 30) * 0.46);
    const xImg = margenH;
    const xTexto = margenH + anchoImg + 30;
    const anchoTexto = anchoUtil - anchoImg - 30;

    if (imagenes.length > 0) {
      const img = imagenes[0];
      const actImg = { ...img, x: xImg, y: yZona, ancho: anchoImg, alto: altoZona, modificado: ahora };
      cambios.push({ id: img.id, antes: img, despues: actImg });
    }

    if (textos.length >= 2) {
      const [t1, t2] = textos;
      cambios.push({ id: t1.id, antes: t1, despues: { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 26 } } });
      cambios.push({ id: t2.id, antes: t2, despues: { ...t2, x: xTexto, y: yZona, ancho: anchoTexto, modificado: ahora, datos: { ...t2.datos, tamano: 18 } } });
    } else if (textos.length === 1) {
      const [t1] = textos;
      cambios.push({ id: t1.id, antes: t1, despues: { ...t1, x: margenH, y: yTitulo, ancho: anchoUtil, modificado: ahora, datos: { ...t1.datos, tamano: 26 } } });
      const txt = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xTexto, y: yZona, ancho: anchoTexto, alto: altoZona, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Descripción o análisis del esquema / imagen…', e: 'normal' }], tamano: 18, color: '#334155' },
      });
      cambios.push({ id: txt.id, antes: null, despues: txt });
    } else {
      const tit = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: margenH, y: yTitulo, ancho: anchoUtil, alto: altoTitulo, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Esquema y notas', e: 'titulo' }], tamano: 26, color: '#14192b' },
      });
      const txt = crearElemento(documentoId, TIPOS_ELEMENTO.TEXTO, {
        x: xTexto, y: yZona, ancho: anchoTexto, alto: altoZona, z: ++zMax, contenedor: tarjetaId,
        datos: { bloques: [{ t: 'Descripción del esquema o anotaciones clave…', e: 'normal' }], tamano: 18, color: '#334155' },
      });
      cambios.push({ id: tit.id, antes: null, despues: tit });
      cambios.push({ id: txt.id, antes: null, despues: txt });
    }
  }

  return { cambios };
}
