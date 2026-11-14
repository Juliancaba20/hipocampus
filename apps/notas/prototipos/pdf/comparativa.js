/**
 * Módulo comparativo entre:
 * Enfoque A: PDF.js con lectura nativa y virtualización bajo demanda.
 * Enfoque B: Conversión completa de cada página a imagen (PNG/JPEG) al importar.
 */

export const DATOS_COMPARATIVA_TEORICA = {
  documento100Paginas: {
    enfoqueA_PdfJs: {
      nombre: 'Enfoque A: PDF.js (Vectorial bajo demanda)',
      tiempoImportacionMs: 120, // ~100-250ms solo abrir y leer tabla xref
      tiempoImportacionTexto: 'Instantáneo (< 250 ms)',
      almacenamientoBytes: 3.2 * 1024 * 1024, // 3.2 MB (el archivo PDF original tal cual)
      almacenamientoTexto: '~3.2 MB (1 solo archivo binario en IndexedDB)',
      memoriaRamGpu: '~25 MB – 45 MB fija (solo 3-5 páginas visibles a la vez)',
      memoriaTexto: 'Constante, independiente de si son 10 o 500 páginas',
      calidadZoom: 'Vectorial 100% nítida a cualquier aumento (0.25× a 5×)',
      edicionFutura: 'Permite seleccionar texto, copiar, buscar palabras y enlaces',
      bundleAppGzip: '+491 KB (worker incluido, se precachea offline una sola vez)',
      experienciaUsuario: 'Apertura inmediata, el usuario no espera',
    },
    enfoqueB_Imagenes: {
      nombre: 'Enfoque B: Rasterizar a imágenes al importar',
      tiempoImportacionMs: 25000, // 25 - 40 segundos para rasterizar 100 páginas
      tiempoImportacionTexto: 'Lento (20 a 45 segundos de barra de espera)',
      almacenamientoBytesJpeg: 28 * 1024 * 1024, // ~28 MB a 150 DPI JPEG compresión 80%
      almacenamientoBytesPng: 140 * 1024 * 1024, // ~140 MB a 150 DPI PNG sin pérdida
      almacenamientoTexto: '~28 MB (JPEG) o ~140 MB (PNG) en IndexedDB',
      memoriaRamGpu: 'Riesgo alto de desborde si se cargan muchas miniaturas/texturas',
      memoriaTexto: 'Creciente con la cantidad de páginas en memoria',
      calidadZoom: 'Se pixela al acercar salvo que se guarden imágenes gigantescas',
      edicionFutura: 'No hay texto seleccionable (solo píxeles estáticos)',
      bundleAppGzip: '0 KB adicional de PDF.js (o mínimo si usa canvas nativo)',
      experienciaUsuario: 'Pantalla de carga prolongada antes de poder ver la primera página',
    },
  },
};

/**
 * Ejecuta una prueba empírica en el navegador de rasterizado de N páginas
 * para medir el tiempo real que tomaría el Enfoque B en el dispositivo actual.
 */
export async function medirRasterizadoImagenes({
  pdfDoc,
  maxPaginas = 10,
  formato = 'image/jpeg',
  calidad = 0.8,
  escala = 1.5,
  onProgreso = null,
}) {
  const total = Math.min(pdfDoc.numPages, maxPaginas);
  const t0 = performance.now();
  let totalBytes = 0;
  const tiemposPagina = [];

  for (let i = 1; i <= total; i++) {
    const tp0 = performance.now();
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: escala });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Convertir a Blob (simula guardado en IndexedDB)
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, formato, calidad)
    );

    totalBytes += blob ? blob.size : 0;
    const tp1 = performance.now();
    tiemposPagina.push(tp1 - tp0);

    // Liberar canvas
    canvas.width = 0;
    canvas.height = 0;

    if (onProgreso) {
      onProgreso(i, total, totalBytes);
    }
  }

  const t1 = performance.now();
  const tiempoTotalMs = Math.round(t1 - t0);
  const tiempoPromedioPaginaMs = Math.round(tiempoTotalMs / total);
  const pesoEstimado100PaginasMb = (
    ((totalBytes / total) * 100) /
    (1024 * 1024)
  ).toFixed(1);
  const tiempoEstimado100PaginasSeg = Math.round(
    (tiempoPromedioPaginaMs * 100) / 1000
  );

  return {
    paginasProbadas: total,
    tiempoTotalMs,
    tiempoPromedioPaginaMs,
    totalBytesProbados: totalBytes,
    pesoPromedioPorPaginaKb: Math.round(totalBytes / total / 1024),
    proyeccion100Paginas: {
      tiempoSegundos: tiempoEstimado100PaginasSeg,
      pesoMb: pesoEstimado100PaginasMb,
    },
  };
}
