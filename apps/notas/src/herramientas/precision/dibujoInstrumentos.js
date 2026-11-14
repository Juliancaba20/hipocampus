// Renderizado visual de instrumentos de precisión (Regla, Escuadra, Transportador) en canvas 2D.
// Acabado profesional estilo acrílico translúcido con marcas nítidas e indicadores de ángulo (Etapa 24).

import {
  TIPOS_INSTRUMENTO,
  PX_POR_CM,
  PX_POR_MM,
  radianesAGrados,
} from './instrumentos.js';

/**
 * Dibuja el instrumento de precisión activo sobre el canvas.
 * Se dibuja en coordenadas de pantalla aplicando la matriz de la cámara.
 */
export function dibujarInstrumento(ctx, instrumento, camara, anchoPantalla, altoPantalla) {
  if (!instrumento || !instrumento.activo || instrumento.tipo === TIPOS_INSTRUMENTO.NINGUNO) {
    return;
  }

  ctx.save();

  // Convertir origen del instrumento a coordenadas de pantalla
  const cx = (instrumento.x - camara.x) * camara.zoom;
  const cy = (instrumento.y - camara.y) * camara.zoom;

  // Trasladar y rotar según el ángulo del instrumento
  ctx.translate(cx, cy);
  ctx.rotate(instrumento.angulo);

  const zoom = camara.zoom;

  switch (instrumento.tipo) {
    case TIPOS_INSTRUMENTO.REGLA:
      dibujarReglaCanvas(ctx, instrumento, zoom);
      break;
    case TIPOS_INSTRUMENTO.ESCUADRA:
      dibujarEscuadraCanvas(ctx, instrumento, zoom);
      break;
    case TIPOS_INSTRUMENTO.TRANSPORTADOR:
      dibujarTransportadorCanvas(ctx, instrumento, zoom);
      break;
    default:
      break;
  }

  ctx.restore();
}

/**
 * Renderizado de la Regla con marcas en cm y mm y dial de rotación.
 */
function dibujarReglaCanvas(ctx, regla, zoom) {
  const largo = regla.longitud * zoom;
  const ancho = regla.ancho * zoom;
  const pxMm = PX_POR_MM * zoom;
  const pxCm = PX_POR_CM * zoom;

  // 1. Cuerpo de la regla (acrílico translúcido con sombra suave)
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.35)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, largo, ancho, 8 * Math.min(1.5, Math.max(0.6, zoom)));
  } else {
    ctx.rect(0, 0, largo, ancho);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. Líneas y marcas milimétricas / centimétricas en borde superior (y = 0)
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.font = `600 ${Math.max(9, Math.round(10 * Math.min(1.4, zoom)))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const totalMm = Math.floor(regla.longitudCm * 10);
  ctx.beginPath();
  ctx.lineWidth = 1;

  for (let mm = 0; mm <= totalMm; mm++) {
    const xPos = mm * pxMm;
    if (xPos > largo) break;

    const esCm = mm % 10 === 0;
    const esMedioCm = mm % 5 === 0;
    const altoMarca = esCm ? 16 * Math.min(1.2, zoom) : esMedioCm ? 11 * Math.min(1.2, zoom) : 6 * Math.min(1.2, zoom);

    // Marca borde superior
    ctx.moveTo(xPos, 0);
    ctx.lineTo(xPos, altoMarca);

    // Marca borde inferior
    ctx.moveTo(xPos, ancho);
    ctx.lineTo(xPos, ancho - (esCm ? altoMarca * 0.75 : altoMarca * 0.5));

    // Número de centímetro en borde superior
    if (esCm && xPos < largo - 10) {
      const numCm = mm / 10;
      ctx.fillText(String(numCm), xPos, altoMarca + 3);
    }
  }
  ctx.stroke();

  // 3. Dial de control central (Ángulo y asa para rotar y mover)
  const centroX = largo / 2;
  const centroY = ancho / 2;
  const radioDial = Math.max(18, Math.min(28, 22 * zoom));

  ctx.save();
  ctx.beginPath();
  ctx.arc(centroX, centroY, radioDial, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 6;
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();

  // Línea indicadora de dirección central
  ctx.beginPath();
  ctx.moveTo(centroX - radioDial + 4, centroY);
  ctx.lineTo(centroX + radioDial - 4, centroY);
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Texto del ángulo actual en grados
  const grados = Math.round(radianesAGrados(regla.angulo));
  ctx.fillStyle = '#1e3a8a';
  ctx.font = `bold ${Math.max(10, Math.round(11 * Math.min(1.3, zoom)))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${grados}°`, centroX, centroY);

  ctx.restore();
}

/**
 * Renderizado de la Escuadra con catetos graduados, ángulo recto e hipotenusa.
 */
function dibujarEscuadraCanvas(ctx, escuadra, zoom) {
  const catA = escuadra.catetoA * zoom;
  const catB = escuadra.catetoB * zoom;
  const pxMm = PX_POR_MM * zoom;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

  // Triángulo exterior
  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.35)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(catA, 0);
  ctx.lineTo(0, catB);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Recorte interior translúcido (ventana interior para ver el dibujo debajo)
  const inset = Math.max(22, 28 * zoom);
  if (catA > inset * 2.5 && catB > inset * 2.5) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inset, inset);
    ctx.lineTo(catA - inset * 1.5, inset);
    ctx.lineTo(inset, catB - inset * 1.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Graduación en cateto base (horizontal)
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.font = `600 ${Math.max(9, Math.round(10 * Math.min(1.3, zoom)))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;

  ctx.beginPath();
  const maxMmBase = Math.floor(catA / pxMm);
  for (let mm = 0; mm <= maxMmBase; mm++) {
    const xPos = mm * pxMm;
    const esCm = mm % 10 === 0;
    const esMedioCm = mm % 5 === 0;
    const h = esCm ? 14 * Math.min(1.2, zoom) : esMedioCm ? 9 * Math.min(1.2, zoom) : 5 * Math.min(1.2, zoom);

    ctx.moveTo(xPos, 0);
    ctx.lineTo(xPos, h);

    if (esCm && xPos > 12 && xPos < catA - 15) {
      ctx.fillText(String(mm / 10), xPos, h + 2);
    }
  }

  // Graduación en cateto vertical
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const maxMmVert = Math.floor(catB / pxMm);
  for (let mm = 0; mm <= maxMmVert; mm++) {
    const yPos = mm * pxMm;
    const esCm = mm % 10 === 0;
    const esMedioCm = mm % 5 === 0;
    const w = esCm ? 14 * Math.min(1.2, zoom) : esMedioCm ? 9 * Math.min(1.2, zoom) : 5 * Math.min(1.2, zoom);

    ctx.moveTo(0, yPos);
    ctx.lineTo(w, yPos);

    if (esCm && yPos > 12 && yPos < catB - 15) {
      ctx.fillText(String(mm / 10), w + 2, yPos);
    }
  }
  ctx.stroke();

  // Marcas de ángulos en los vértices
  ctx.fillStyle = '#2563eb';
  ctx.font = `bold ${Math.max(10, Math.round(11 * Math.min(1.2, zoom)))}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('90°', 10, 14);

  const angA = escuadra.tipoTriangulo === '30-60-90' ? '30°' : '45°';
  const angB = escuadra.tipoTriangulo === '30-60-90' ? '60°' : '45°';
  ctx.textAlign = 'right';
  ctx.fillText(angA, catA - 12, 14);
  ctx.textAlign = 'left';
  ctx.fillText(angB, 8, catB - 12);
}

/**
 * Renderizado del Transportador con retícula de grados y centro de lectura.
 */
function dibujarTransportadorCanvas(ctx, transportador, zoom) {
  const R = transportador.radio * zoom;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

  // Cuerpo semicircular
  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.35)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  // Semicírculo superior (de 0 a PI en sentido antihorario o de PI a 0)
  ctx.arc(0, 0, R, Math.PI, 0, false);
  ctx.lineTo(R, 0);
  ctx.lineTo(-R, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Recorte semicircular interior para visión
  const rInterior = R * 0.45;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, rInterior, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Cruz central de origen `+`
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 8);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Graduación de ángulos de 0° a 180°
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.font = `600 ${Math.max(9, Math.round(10 * Math.min(1.2, zoom)))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.beginPath();
  for (let deg = 0; deg <= 180; deg++) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const es10 = deg % 10 === 0;
    const es5 = deg % 5 === 0;
    const len = es10 ? 14 * Math.min(1.2, zoom) : es5 ? 9 * Math.min(1.2, zoom) : 5 * Math.min(1.2, zoom);

    const rExt = R;
    const rInt = R - len;

    ctx.moveTo(rExt * cos, -rExt * sin);
    ctx.lineTo(rInt * cos, -rInt * sin);
  }
  ctx.stroke();

  // Etiquetas numéricas cada 10° o 30°
  const pasoEtiqueta = R > 120 ? 10 : 30;
  for (let deg = 0; deg <= 180; deg += pasoEtiqueta) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rNum = R - 22 * Math.min(1.2, zoom);
    ctx.fillText(String(deg), rNum * cos, -rNum * sin);
  }
}
