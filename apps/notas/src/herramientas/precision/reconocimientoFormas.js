// Reconocimiento y corrección automática de formas geométricas (Etapa 24).
// Detecta pausas («hold-to-snap») al final del trazo y convierte trazos a mano alzada
// en líneas rectas, círculos/elipses, rectángulos y triángulos limpios.

export const TIPOS_FORMA_CORREGIDA = {
  LINEA: 'linea',
  CIRCULO: 'circulo',
  ELIPSE: 'elipse',
  RECTANGULO: 'rectangulo',
  TRIANGULO: 'triangulo',
  FLECHA: 'flecha',
};

/**
 * Distancia euclídea entre dos puntos [x, y].
 */
function dist(p1, p2) {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

/**
 * Longitud total acumulada de un camino poligonal.
 */
function longitudCamino(puntos) {
  let len = 0;
  for (let i = 1; i < puntos.length; i++) {
    len += dist(puntos[i - 1], puntos[i]);
  }
  return len;
}

/**
 * Caja envolvente de una lista de puntos.
 */
function cajaPuntos(puntos) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of puntos) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  return {
    x: minX,
    y: minY,
    ancho: Math.max(1, maxX - minX),
    alto: Math.max(1, maxY - minY),
    centroX: (minX + maxX) / 2,
    centroY: (minY + maxY) / 2,
  };
}

/**
 * Simplificación básica de camino usando Ramer-Douglas-Peucker.
 */
export function simplificarPuntos(puntos, epsilon = 2) {
  if (puntos.length <= 2) return puntos;

  let maxDist = 0;
  let maxIdx = 0;
  const pInicio = puntos[0];
  const pFin = puntos[puntos.length - 1];

  const dx = pFin[0] - pInicio[0];
  const dy = pFin[1] - pInicio[1];
  const len2 = dx * dx + dy * dy;

  for (let i = 1; i < puntos.length - 1; i++) {
    const p = puntos[i];
    let d;
    if (len2 === 0) {
      d = dist(p, pInicio);
    } else {
      const t = Math.max(0, Math.min(1, ((p[0] - pInicio[0]) * dx + (p[1] - pInicio[1]) * dy) / len2));
      const projX = pInicio[0] + t * dx;
      const projY = pInicio[1] + t * dy;
      d = Math.hypot(p[0] - projX, p[1] - projY);
    }
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const izq = simplificarPuntos(puntos.slice(0, maxIdx + 1), epsilon);
    const der = simplificarPuntos(puntos.slice(maxIdx), epsilon);
    return [...izq.slice(0, -1), ...der];
  }

  return [pInicio, pFin];
}

/**
 * Arma la corrección de una línea recta entre dos puntos. Guarda el sentido (volteo) para que la figura
 * quede exactamente entre el punto donde empezó el trazo y el punto donde terminó, en cualquier dirección.
 */
export function construirLineaRecta(pInicio, pFin, confianza = 1) {
  return {
    tipo: TIPOS_FORMA_CORREGIDA.LINEA,
    confianza,
    puntos: [
      [pInicio[0], pInicio[1], pInicio[2] ?? 0.5],
      [pFin[0], pFin[1], pFin[2] ?? 0.5],
    ],
    datosFigura: {
      forma: 'linea',
      x: Math.min(pInicio[0], pFin[0]),
      y: Math.min(pInicio[1], pFin[1]),
      ancho: Math.abs(pFin[0] - pInicio[0]),
      alto: Math.abs(pFin[1] - pInicio[1]),
      volteoX: pFin[0] < pInicio[0],
      volteoY: pFin[1] < pInicio[1],
      p1: { x: pInicio[0], y: pInicio[1] },
      p2: { x: pFin[0], y: pFin[1] },
    },
  };
}

/**
 * Intenta reconocer si el trazo es una línea recta.
 */
function reconocerLinea(puntos, caja, lenCamino) {
  const pInicio = puntos[0];
  const pFin = puntos[puntos.length - 1];
  const distExtremos = dist(pInicio, pFin);

  // Relación entre la distancia directa y la longitud total del trazo
  const rectitud = distExtremos / Math.max(1, lenCamino);

  if (rectitud > 0.88 && distExtremos > 15) {
    return construirLineaRecta(pInicio, pFin, rectitud);
  }

  return null;
}

/**
 * Intenta reconocer si el trazo es un círculo o elipse.
 */
function reconocerCirculoOElipse(puntos, caja, lenCamino) {
  const pInicio = puntos[0];
  const pFin = puntos[puntos.length - 1];
  const distCierre = dist(pInicio, pFin);

  // Debe ser un trazo cerrado o casi cerrado
  const diametroAprox = (caja.ancho + caja.alto) / 2;
  const esCerrado = distCierre < diametroAprox * 0.35 || distCierre < 45;

  if (!esCerrado || lenCamino < 40) return null;

  // Centroide
  const cx = caja.centroX;
  const cy = caja.centroY;

  // Medir distancias radiales normalizadas respecto al radio de la elipse
  const rx = caja.ancho / 2;
  const ry = caja.alto / 2;

  if (rx < 6 || ry < 6) return null;

  let sumaError = 0;
  for (const p of puntos) {
    const nx = (p[0] - cx) / rx;
    const ny = (p[1] - cy) / ry;
    const radioNormalizado = Math.hypot(nx, ny);
    sumaError += Math.abs(radioNormalizado - 1);
  }
  const errorMedio = sumaError / puntos.length;

  if (errorMedio < 0.22) {
    const proporcion = caja.ancho / caja.alto;
    const esCirculo = proporcion >= 0.82 && proporcion <= 1.22;

    const rFinal = esCirculo ? (rx + ry) / 2 : null;
    const x = esCirculo ? cx - rFinal : caja.x;
    const y = esCirculo ? cy - rFinal : caja.y;
    const w = esCirculo ? rFinal * 2 : caja.ancho;
    const h = esCirculo ? rFinal * 2 : caja.alto;

    // Generar muestras continuas para el trazo suave
    const pts = [];
    const numPuntos = 48;
    for (let i = 0; i <= numPuntos; i++) {
      const ang = (i / numPuntos) * Math.PI * 2;
      const px = cx + (esCirculo ? rFinal : rx) * Math.cos(ang);
      const py = cy + (esCirculo ? rFinal : ry) * Math.sin(ang);
      pts.push([px, py, 0.5]);
    }

    return {
      tipo: esCirculo ? TIPOS_FORMA_CORREGIDA.CIRCULO : TIPOS_FORMA_CORREGIDA.ELIPSE,
      confianza: 1 - errorMedio,
      puntos: pts,
      datosFigura: {
        forma: 'elipse',
        x,
        y,
        ancho: w,
        alto: h,
        esCirculo,
      },
    };
  }

  return null;
}

/**
 * Intenta reconocer polígonos cerrados (rectángulos y triángulos).
 */
function reconocerPoligono(puntos, caja, lenCamino) {
  const pInicio = puntos[0];
  const pFin = puntos[puntos.length - 1];
  const distCierre = dist(pInicio, pFin);
  const perimetroCaja = (caja.ancho + caja.alto) * 2;

  const esCerrado = distCierre < perimetroCaja * 0.22 || distCierre < 40;
  if (!esCerrado || puntos.length < 8) return null;

  // Simplificar fuertemente el trazo para encontrar vértices clave
  const epsilon = Math.max(6, Math.min(20, perimetroCaja * 0.04));
  const vertices = simplificarPuntos(puntos, epsilon);

  // Asegurar cierre
  if (dist(vertices[0], vertices[vertices.length - 1]) > 10) {
    vertices.push(vertices[0]);
  }

  const numLados = vertices.length - 1;

  // Cálculo de área con fórmula del lazador (Shoelace)
  let areaPoligono = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    areaPoligono += vertices[i][0] * vertices[i + 1][1] - vertices[i + 1][0] * vertices[i][1];
  }
  areaPoligono = Math.abs(areaPoligono) / 2;
  const areaCaja = Math.max(1, caja.ancho * caja.alto);
  const ratioArea = areaPoligono / areaCaja;

  // Caso 1: Triángulo (3 lados o 4 con vértice repetido, ratio de área aprox ~0.35 - 0.65)
  if (numLados === 3 || (numLados === 4 && ratioArea < 0.68)) {
    const v = vertices.slice(0, 3);
    const pts = [...v, v[0]].map((p) => [p[0], p[1], 0.5]);
    return {
      tipo: TIPOS_FORMA_CORREGIDA.TRIANGULO,
      confianza: 0.85,
      puntos: pts,
      datosFigura: {
        forma: 'triangulo',
        x: caja.x,
        y: caja.y,
        ancho: caja.ancho,
        alto: caja.alto,
        vertices: v,
      },
    };
  }

  // Caso 2: Rectángulo / Cuadrado (4 lados aproximados, ratio de área >= 0.82)
  // Un círculo tiene ratio máximo PI/4 = 0.785, por lo que nunca superará 0.81
  if (numLados >= 4 && numLados <= 6 && ratioArea >= 0.82) {
    if (areaCaja > 100) {
      // Generar esquinas del rectángulo limpio
      const esquinas = [
        [caja.x, caja.y, 0.5],
        [caja.x + caja.ancho, caja.y, 0.5],
        [caja.x + caja.ancho, caja.y + caja.alto, 0.5],
        [caja.x, caja.y + caja.alto, 0.5],
        [caja.x, caja.y, 0.5],
      ];
      return {
        tipo: TIPOS_FORMA_CORREGIDA.RECTANGULO,
        confianza: 0.88,
        puntos: esquinas,
        datosFigura: {
          forma: 'rectangulo',
          x: caja.x,
          y: caja.y,
          ancho: caja.ancho,
          alto: caja.alto,
        },
      };
    }
  }

  return null;
}

/**
 * Función principal de análisis de formas.
 * Toma los puntos acumulados de un trazo libre y retorna la forma geométrica corregida
 * o null si no se detecta una forma clara.
 *
 * @param {Array<Array<number>>} puntos - Array de [x, y, presion]
 * @returns {Object|null}
 */
export function reconocerForma(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 6) return null;

  const caja = cajaPuntos(puntos);
  const lenCamino = longitudCamino(puntos);

  // 1. Probar línea recta
  const resLinea = reconocerLinea(puntos, caja, lenCamino);
  if (resLinea) return resLinea;

  // 2. Probar polígonos (rectángulo, triángulo)
  const resPoligono = reconocerPoligono(puntos, caja, lenCamino);
  if (resPoligono) return resPoligono;

  // 3. Probar círculo o elipse
  const resCirculo = reconocerCirculoOElipse(puntos, caja, lenCamino);
  if (resCirculo) return resCirculo;

  return null;
}
