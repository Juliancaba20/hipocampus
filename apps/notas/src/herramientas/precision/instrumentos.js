// Instrumentos de precisión: Regla, Escuadra y Transportador (Etapa 24).
// Funciones puras de geometría, marcas de escala (cm / mm / grados) y snap magnético de trazo.

export const TIPOS_INSTRUMENTO = {
  NINGUNO: 'ninguno',
  REGLA: 'regla',
  ESCUADRA: 'escuadra',
  TRANSPORTADOR: 'transportador',
};

// Escala estándar de pantalla: ~37.8 píxeles de mundo por centímetro (equivalente a 96 DPI / 2.54 cm).
export const PX_POR_CM = 37.795;
export const PX_POR_MM = PX_POR_CM / 10;

/**
 * Normaliza un ángulo en radianes al rango [-PI, PI].
 */
export function normalizarAngulo(rad) {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Convierte radianes a grados legibles en el rango [0, 360) o [-180, 180].
 */
export function radianesAGrados(rad) {
  const g = (rad * 180) / Math.PI;
  return ((g % 360) + 360) % 360;
}

export function gradosARadianes(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Crea la configuración por defecto de la regla.
 */
export function crearRegla({ x = 200, y = 300, angulo = 0, longitudCm = 15 } = {}) {
  const largo = longitudCm * PX_POR_CM;
  const ancho = 64; // altura/ancho de la regla en coordenadas del mundo
  return {
    tipo: TIPOS_INSTRUMENTO.REGLA,
    x,
    y,
    angulo, // en radianes
    longitudCm,
    longitud: largo,
    ancho,
    activo: true,
  };
}

/**
 * Crea la configuración por defecto de la escuadra (45-45-90 o 30-60-90).
 */
export function crearEscuadra({
  x = 300,
  y = 300,
  angulo = 0,
  tipoTriangulo = '45-45-90',
  catetoBaseCm = 10,
  catetoACm,
} = {}) {
  const baseCm = catetoACm ?? catetoBaseCm;
  const base = baseCm * PX_POR_CM;
  let altura = base;
  if (tipoTriangulo === '30-60-90') {
    altura = base * Math.tan(gradosARadianes(60));
  }
  const angulos = tipoTriangulo === '30-60-90'
    ? { a: 90, b: 30, c: 60 }
    : { a: 90, b: 45, c: 45 };

  return {
    tipo: TIPOS_INSTRUMENTO.ESCUADRA,
    x,
    y,
    angulo,
    tipoTriangulo,
    catetoBaseCm: baseCm,
    catetoACm: baseCm,
    catetoA: base,
    catetoB: altura,
    angulos,
    activo: true,
  };
}

/**
 * Crea la configuración por defecto del transportador de ángulos.
 */
export function crearTransportador({ x = 400, y = 300, angulo = 0, radioCm = 5 } = {}) {
  const radio = radioCm * PX_POR_CM;
  return {
    tipo: TIPOS_INSTRUMENTO.TRANSPORTADOR,
    x,
    y,
    angulo,
    radioCm,
    radio,
    activo: true,
  };
}

/**
 * Transforma un punto del mundo al sistema de coordenadas local del instrumento.
 */
export function mundoALocal(instrumento, punto) {
  const dx = punto.x - instrumento.x;
  const dy = punto.y - instrumento.y;
  const cos = Math.cos(-instrumento.angulo);
  const sin = Math.sin(-instrumento.angulo);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

/**
 * Transforma un punto local del instrumento al sistema de coordenadas del mundo.
 */
export function localAMundo(instrumento, puntoLocal) {
  const cos = Math.cos(instrumento.angulo);
  const sin = Math.sin(instrumento.angulo);
  return {
    x: instrumento.x + (puntoLocal.x * cos - puntoLocal.y * sin),
    y: instrumento.y + (puntoLocal.x * sin + puntoLocal.y * cos),
  };
}

/**
 * Proyecta y realiza snap magnético de un punto sobre los bordes de la regla.
 * Si el punto está cerca del borde superior (y ≈ 0) o inferior (y ≈ ancho),
 * se proyecta exactamente sobre la línea de dicho borde.
 *
 * @param {Object} regla
 * @param {{ x: number, y: number }} puntoMundo
 * @param {number} umbralSnap - distancia máxima para activar el snap en unidades del mundo
 * @returns {{ punto: { x: number, y: number }, snappeado: boolean, borde: string|null }}
 */
export function snapPuntoARegla(regla, puntoMundo, umbralSnap = 24) {
  if (!regla || regla.tipo !== TIPOS_INSTRUMENTO.REGLA) {
    return { punto: puntoMundo, snappeado: false, borde: null };
  }

  const loc = mundoALocal(regla, puntoMundo);

  // Extensión horizontal permitida (con ligero margen de tolerancia en extremos)
  const margenExtremos = umbralSnap * 0.75;
  if (loc.x < -margenExtremos || loc.x > regla.longitud + margenExtremos) {
    return { punto: puntoMundo, snappeado: false, borde: null };
  }

  // Clampear X dentro de la regla
  const xClamped = Math.max(0, Math.min(regla.longitud, loc.x));

  // Distancia a borde superior (y = 0) y borde inferior (y = regla.ancho)
  const distBordeSuperior = Math.abs(loc.y);
  const distBordeInferior = Math.abs(loc.y - regla.ancho);

  if (distBordeSuperior <= umbralSnap && distBordeSuperior <= distBordeInferior) {
    const localSnap = { x: xClamped, y: 0 };
    return {
      punto: localAMundo(regla, localSnap),
      snappeado: true,
      borde: 'superior',
      distanciaCm: xClamped / PX_POR_CM,
    };
  }

  if (distBordeInferior <= umbralSnap) {
    const localSnap = { x: xClamped, y: regla.ancho };
    return {
      punto: localAMundo(regla, localSnap),
      snappeado: true,
      borde: 'inferior',
      distanciaCm: xClamped / PX_POR_CM,
    };
  }

  return { punto: puntoMundo, snappeado: false, borde: null };
}

/**
 * Proyecta y realiza snap magnético de un punto sobre los bordes de la escuadra.
 * Bordes:
 * 1. Base horizontal (y = 0, de x=0 a x=catetoA)
 * 2. Cateto vertical perpendicular (x = 0, de y=0 a y=catetoB)
 * 3. Hipotenusa (recta que une (catetoA, 0) con (0, catetoB))
 */
export function snapPuntoAEscuadra(escuadra, puntoMundo, umbralSnap = 24) {
  if (!escuadra || escuadra.tipo !== TIPOS_INSTRUMENTO.ESCUADRA) {
    return { punto: puntoMundo, snappeado: false, borde: null };
  }

  const loc = mundoALocal(escuadra, puntoMundo);
  const { catetoA, catetoB } = escuadra;
  const margen = umbralSnap * 0.75;

  let mejorDist = Infinity;
  let mejorPuntoLocal = null;
  let mejorBorde = null;

  // 1. Borde base (y = 0)
  if (loc.x >= -margen && loc.x <= catetoA + margen) {
    const d = Math.abs(loc.y);
    if (d < mejorDist && d <= umbralSnap) {
      mejorDist = d;
      mejorPuntoLocal = { x: Math.max(0, Math.min(catetoA, loc.x)), y: 0 };
      mejorBorde = 'base';
    }
  }

  // 2. Borde vertical (x = 0)
  if (loc.y >= -margen && loc.y <= catetoB + margen) {
    const d = Math.abs(loc.x);
    if (d < mejorDist && d <= umbralSnap) {
      mejorDist = d;
      mejorPuntoLocal = { x: 0, y: Math.max(0, Math.min(catetoB, loc.y)) };
      mejorBorde = 'perpendicular';
    }
  }

  // 3. Hipotenusa: recta de (catetoA, 0) a (0, catetoB)
  // Ecuación de la recta: x/A + y/B = 1 => B*x + A*y - A*B = 0
  const A = catetoA;
  const B = catetoB;
  const hipoLen = Math.hypot(A, B);
  const distHipo = Math.abs(B * loc.x + A * loc.y - A * B) / hipoLen;

  if (distHipo <= umbralSnap && distHipo < mejorDist) {
    // Proyección sobre el segmento de la hipotenusa
    // Vector director desde (A, 0) hacia (0, B): (-A, B)
    const vx = -A;
    const vy = B;
    const t = ((loc.x - A) * vx + loc.y * vy) / (hipoLen * hipoLen);
    const tClamped = Math.max(0, Math.min(1, t));
    const hx = A + tClamped * vx;
    const hy = tClamped * vy;
    mejorDist = distHipo;
    mejorPuntoLocal = { x: hx, y: hy };
    mejorBorde = 'hipotenusa';
  }

  if (mejorPuntoLocal) {
    return {
      punto: localAMundo(escuadra, mejorPuntoLocal),
      snappeado: true,
      borde: mejorBorde,
      segmento: mejorBorde,
    };
  }

  return { punto: puntoMundo, snappeado: false, borde: null, segmento: null };
}

/**
 * Proyecta y realiza snap magnético de un punto sobre el transportador.
 * Soporta:
 * 1. Borde semicircular (radio exacto R)
 * 2. Línea base horizontal (diámetro de -R a +R en y=0)
 * 3. Trazado radial desde el centro (ángulo medido con lectura precisa)
 */
export function snapPuntoATransportador(transportador, puntoMundo, umbralSnap = 24) {
  if (!transportador || transportador.tipo !== TIPOS_INSTRUMENTO.TRANSPORTADOR) {
    return { punto: puntoMundo, snappeado: false, borde: null };
  }

  const loc = mundoALocal(transportador, puntoMundo);
  const R = transportador.radio;
  const margen = umbralSnap * 0.75;
  const distCentro = Math.hypot(loc.x, loc.y);

  // 1. Línea base horizontal (y = 0, entre -R y R)
  if (loc.x >= -R - margen && loc.x <= R + margen) {
    const distBase = Math.abs(loc.y);
    if (distBase <= umbralSnap && (loc.y >= -umbralSnap && loc.y <= umbralSnap * 1.5)) {
      const xClamped = Math.max(-R, Math.min(R, loc.x));
      return {
        punto: localAMundo(transportador, { x: xClamped, y: 0 }),
        snappeado: true,
        borde: 'base',
        segmento: 'base',
        anguloGrados: loc.x >= 0 ? 0 : 180,
      };
    }
  }

  // 2. Arco semicircular (y <= 0 o y >= 0 según semicírculo superior)
  // El transportador semicircular tradicional tiene el arco en y <= 0 (hacia arriba)
  const distAlArco = Math.abs(distCentro - R);
  if (distAlArco <= umbralSnap && loc.y <= umbralSnap) {
    const anguloRad = Math.atan2(-loc.y, loc.x); // 0 a PI
    const anguloDeg = Math.round((anguloRad * 180) / Math.PI);
    const anguloSnap = (anguloDeg * Math.PI) / 180;
    const localSnap = {
      x: R * Math.cos(anguloSnap),
      y: -R * Math.sin(anguloSnap),
    };
    return {
      punto: localAMundo(transportador, localSnap),
      snappeado: true,
      borde: 'arco',
      segmento: 'arco',
      anguloGrados: anguloDeg,
    };
  }

  // 3. Trazado radial desde el centro hacia afuera
  if (distCentro > 15 && distCentro < R + umbralSnap) {
    const anguloRad = Math.atan2(-loc.y, loc.x);
    if (anguloRad >= -0.1 && anguloRad <= Math.PI + 0.1) {
      const anguloDeg = (anguloRad * 180) / Math.PI;
      // Snap magnético angular a múltiplos de 5° o 15° si está a menos de 2°
      let anguloFinalDeg = anguloDeg;
      const pasoSnap = 5;
      const masCercano = Math.round(anguloDeg / pasoSnap) * pasoSnap;
      if (Math.abs(anguloDeg - masCercano) <= 2.2) {
        anguloFinalDeg = masCercano;
      }
      const radFinal = (anguloFinalDeg * Math.PI) / 180;
      const dClamped = Math.min(R, distCentro);
      const localRadial = {
        x: dClamped * Math.cos(radFinal),
        y: -dClamped * Math.sin(radFinal),
      };
      return {
        punto: localAMundo(transportador, localRadial),
        snappeado: true,
        borde: 'radial',
        anguloGrados: Math.round(anguloFinalDeg),
      };
    }
  }

  return { punto: puntoMundo, snappeado: false, borde: null };
}

/**
 * Snap genérico según el instrumento activo actual.
 */
export function aplicarSnapInstrumento(instrumento, puntoMundo, umbralSnap = 24) {
  if (!instrumento || !instrumento.activo) {
    return { punto: puntoMundo, snappeado: false, borde: null };
  }

  switch (instrumento.tipo) {
    case TIPOS_INSTRUMENTO.REGLA:
      return snapPuntoARegla(instrumento, puntoMundo, umbralSnap);
    case TIPOS_INSTRUMENTO.ESCUADRA:
      return snapPuntoAEscuadra(instrumento, puntoMundo, umbralSnap);
    case TIPOS_INSTRUMENTO.TRANSPORTADOR:
      return snapPuntoATransportador(instrumento, puntoMundo, umbralSnap);
    default:
      return { punto: puntoMundo, snappeado: false, borde: null };
  }
}
