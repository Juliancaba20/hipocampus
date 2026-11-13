/**
 * Generador de documentos PDF sintéticos para pruebas de carga y estrés.
 * Crea documentos de 10, 50 o 100 páginas A4 con contenido variado
 * (títulos, textos, figuras geométricas y diagramas) para simular PDFs reales.
 */
import { jsPDF } from 'jspdf';

export async function generarPdfPrueba({
  numPaginas = 100,
  onProgreso = null,
} = {}) {
  const t0 = performance.now();
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const ancho = 595.28;
  const alto = 841.89;

  for (let i = 1; i <= numPaginas; i++) {
    if (i > 1) {
      doc.addPage('a4', 'portrait');
    }

    // Encabezado
    doc.setFillColor(243, 244, 246);
    doc.rect(40, 35, ancho - 80, 45, 'F');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(16);
    doc.text(`Documento de Evaluación — Página ${i} de ${numPaginas}`, 55, 62);

    // Subtítulo y metadatos
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado sintéticamente para benchmark de virtualización | Etapa 19 · Paso 1`, 55, 105);

    // Diagrama o marco geométrico de prueba
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(1);
    doc.rect(50, 125, ancho - 100, 220);

    // Contenido gráfico representativo
    const colorIndice = i % 4;
    const colores = [
      [59, 130, 246], // Azul
      [16, 185, 129], // Verde
      [245, 158, 11], // Ámbar
      [139, 92, 246], // Violeta
    ];
    const [r, g, b] = colores[colorIndice];
    doc.setFillColor(r, g, b);
    doc.circle(130, 235, 45, 'F');

    doc.setFillColor(255, 255, 255);
    doc.circle(130, 235, 20, 'F');

    doc.setDrawColor(r, g, b);
    doc.setLineWidth(2);
    doc.line(210, 165, 480, 165);
    doc.line(210, 205, 480, 205);
    doc.line(210, 245, 480, 245);
    doc.line(210, 285, 480, 285);

    // Texto simulado variado
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(11);
    for (let p = 0; p < 8; p++) {
      const yPos = 380 + p * 42;
      doc.setFontSize(11);
      doc.text(
        `Sección ${i}.${p + 1}: Este párrafo valida la nitidez tipográfica y la resolución adaptativa (LOD).`,
        55,
        yPos
      );
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(
        `Los vectores de texto se renderizan dinámicamente con PDF.js según el nivel de zoom y DPR de la pantalla.`,
        55,
        yPos + 15
      );
      doc.setTextColor(55, 65, 81);
    }

    // Pie de página
    doc.setDrawColor(229, 231, 235);
    doc.line(50, alto - 50, ancho - 50, alto - 50);
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text(`Página ${i} de ${numPaginas}`, ancho / 2 - 25, alto - 35);

    if (onProgreso && i % 10 === 0) {
      onProgreso(i, numPaginas);
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  const t1 = performance.now();

  return {
    arrayBuffer,
    pesoBytes: arrayBuffer.byteLength,
    numPaginas,
    tiempoGeneracionMs: Math.round(t1 - t0),
  };
}
