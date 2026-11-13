/**
 * Controlador de interfaz y orquestador del prototipo de lectura PDF
 * Etapa 19 · Paso 1
 */

import { generarPdfPrueba } from './generador-pdf.js';
import { VisorPdfVirtualizado } from './prototipo-pdf.js';
import { DATOS_COMPARATIVA_TEORICA, medirRasterizadoImagenes } from './comparativa.js';

let visor = null;
let documentoActualData = null;

// Elementos DOM
const visorContenedor = document.getElementById('visor-scroll-contenedor');
const btnGenerar100 = document.getElementById('btn-generar-100');
const btnCargarArchivo = document.getElementById('btn-cargar-archivo');
const inputArchivo = document.getElementById('input-archivo-pdf');
const btnZoomMenos = document.getElementById('btn-zoom-menos');
const btnZoomMas = document.getElementById('btn-zoom-mas');
const btnZoomAjustar = document.getElementById('btn-zoom-ajustar');
const selectZoom = document.getElementById('select-zoom');
const selectCuota = document.getElementById('select-cuota');
const selectBuffer = document.getElementById('select-buffer');
const checkLod = document.getElementById('check-lod');

// HUD elementos
const hudTiempoApertura = document.getElementById('hud-tiempo-apertura');
const hudPaginasMemoria = document.getElementById('hud-paginas-memoria');
const hudMemoriaVram = document.getElementById('hud-memoria-vram');
const hudFps = document.getElementById('hud-fps');
const hudTiempoRender = document.getElementById('hud-tiempo-render');
const hudLod = document.getElementById('hud-lod');

// Pestañas
const pestanasBtns = document.querySelectorAll('.pestana-btn');
const paneles = {
  visor: document.getElementById('panel-visor'),
  comparativa: document.getElementById('panel-comparativa'),
  informe: document.getElementById('panel-informe'),
};

// Módulo de prueba de imágenes
const btnTestRasterizado = document.getElementById('btn-test-rasterizado');
const resultadoRasterizado = document.getElementById('resultado-rasterizado');
const barraRasterizado = document.getElementById('barra-rasterizado-progreso');

// Inicializar Visor
function inicializarVisor() {
  visor = new VisorPdfVirtualizado(visorContenedor, {
    bufferPaginas: parseInt(selectBuffer.value, 10),
    maxCanvasesActivos: parseInt(selectCuota.value, 10),
    usarLodAdaptativo: checkLod.checked,
    onMetricasUpdate: (metricas) => {
      hudTiempoApertura.textContent = `${metricas.tiempoAperturaMs} ms`;
      hudPaginasMemoria.textContent = `${metricas.paginasEnMemoria} / ${metricas.numPaginas}`;
      hudMemoriaVram.textContent = `${metricas.memoriaTexturasMb} MB`;
      hudFps.textContent = `${metricas.fpsActual} FPS`;
      hudFps.className = `telemetria-valor ${metricas.fpsActual >= 50 ? 'verde' : metricas.fpsActual >= 30 ? 'ambar' : 'rojo'}`;
      hudTiempoRender.textContent = `${metricas.tiempoUltimoRenderMs} ms`;
      hudLod.textContent = `DPR ${metricas.dprActual}× (${Math.round(metricas.zoomActual * 100)}%)`;

      // Sincronizar select si no fue por usuario
      const zoomPorcentaje = `${Math.round(metricas.zoomActual * 100)}%`;
      if (selectZoom.value !== zoomPorcentaje && Array.from(selectZoom.options).some(o => o.value === zoomPorcentaje)) {
        selectZoom.value = zoomPorcentaje;
      }
    },
    onPaginaVisible: (numPagina, total) => {
      const indicador = document.getElementById('indicador-pagina-actual');
      if (indicador) {
        indicador.textContent = `Página ${numPagina} de ${total}`;
      }
    },
  });
}

// Cargar 100 páginas sintéticas
async function generarYCargar100Paginas() {
  btnGenerar100.disabled = true;
  btnGenerar100.textContent = '⏳ Generando 100 págs...';

  try {
    const resultado = await generarPdfPrueba({
      numPaginas: 100,
      onProgreso: (p, t) => {
        btnGenerar100.textContent = `⏳ ${p}/${t} págs...`;
      },
    });

    documentoActualData = resultado.arrayBuffer;
    btnGenerar100.textContent = '⏳ Cargando en PDF.js...';

    await visor.cargarDocumento(resultado.arrayBuffer, 'benchmark-100-paginas.pdf');
    btnGenerar100.textContent = '⚡ Recargar 100 Páginas';
  } catch (err) {
    console.error('Error al generar o cargar PDF:', err);
    alert('Error al generar o cargar PDF: ' + err.message);
    btnGenerar100.textContent = '⚡ Generar y Cargar 100 Págs';
  } finally {
    btnGenerar100.disabled = false;
  }
}

// Cargar archivo del usuario
function configurarCargaArchivo() {
  btnCargarArchivo.addEventListener('click', () => inputArchivo.click());

  inputArchivo.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    btnCargarArchivo.disabled = true;
    btnCargarArchivo.textContent = '⏳ Leyendo archivo...';

    try {
      const buffer = await file.arrayBuffer();
      documentoActualData = buffer;
      await visor.cargarDocumento(buffer, file.name);
      btnCargarArchivo.textContent = `📄 ${file.name.slice(0, 15)}...`;
    } catch (err) {
      alert('Error al abrir el PDF seleccionado: ' + err.message);
      btnCargarArchivo.textContent = '📂 Abrir PDF Local';
    } finally {
      btnCargarArchivo.disabled = false;
    }
  });
}

// Controles de Zoom
function configurarZoom() {
  btnZoomMenos.addEventListener('click', () => {
    visor.setZoom(visor.zoom - 0.25);
  });

  btnZoomMas.addEventListener('click', () => {
    visor.setZoom(visor.zoom + 0.25);
  });

  btnZoomAjustar.addEventListener('click', () => {
    if (!visor.viewportBase) return;
    const anchoDisponible = visorContenedor.clientWidth - 60;
    const zoomAjustado = anchoDisponible / visor.viewportBase.width;
    visor.setZoom(zoomAjustado);
  });

  selectZoom.addEventListener('change', () => {
    const valor = parseFloat(selectZoom.value) / 100;
    if (!isNaN(valor)) {
      visor.setZoom(valor);
    }
  });

  selectCuota.addEventListener('change', () => {
    visor.opciones.maxCanvasesActivos = parseInt(selectCuota.value, 10);
    visor.actualizarPaginasVisibles();
  });

  selectBuffer.addEventListener('change', () => {
    visor.opciones.bufferPaginas = parseInt(selectBuffer.value, 10);
    visor.actualizarPaginasVisibles();
  });

  checkLod.addEventListener('change', () => {
    visor.opciones.usarLodAdaptativo = checkLod.checked;
    visor.actualizarPaginasVisibles();
  });
}

// Pestañas
function configurarPestanas() {
  pestanasBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pestana = btn.dataset.pestana;
      pestanasBtns.forEach((b) => b.classList.remove('activa'));
      btn.classList.add('activa');

      Object.keys(paneles).forEach((k) => {
        paneles[k].classList.remove('activa');
      });
      paneles[pestana].classList.add('activa');

      if (pestana === 'visor' && visor) {
        visor.actualizarPaginasVisibles();
      }
    });
  });
}

// Prueba empírica de rasterizado de imágenes
function configurarTestRasterizado() {
  btnTestRasterizado.addEventListener('click', async () => {
    if (!visor.pdfDoc) {
      alert('Por favor carga primero el PDF de 100 páginas con el botón "Generar y Cargar 100 Páginas".');
      return;
    }

    btnTestRasterizado.disabled = true;
    btnTestRasterizado.textContent = '⏳ Rasterizando 10 páginas de muestra...';
    barraRasterizado.style.width = '0%';

    try {
      const resultado = await medirRasterizadoImagenes({
        pdfDoc: visor.pdfDoc,
        maxPaginas: 10,
        formato: 'image/jpeg',
        calidad: 0.8,
        escala: 1.5,
        onProgreso: (actual, total) => {
          const pct = Math.round((actual / total) * 100);
          barraRasterizado.style.width = `${pct}%`;
          btnTestRasterizado.textContent = `⏳ Rasterizando: ${actual}/${total} (${pct}%)...`;
        },
      });

      resultadoRasterizado.innerHTML = `
        <div class="tarjeta-destacada">
          <h4>📊 Resultados del Test Empírico (Dispositivo Actual):</h4>
          <ul>
            <li><strong>Tiempo para 10 páginas:</strong> ${resultado.tiempoTotalMs} ms (${resultado.tiempoPromedioPaginaMs} ms por página).</li>
            <li><strong>Peso de 10 páginas (JPEG 80%):</strong> ${(resultado.totalBytesProbados / 1024).toFixed(0)} KB (~${resultado.pesoPromedioPorPaginaKb} KB por página).</li>
            <li><strong>🚨 Proyección para 100 páginas completas:</strong>
              <ul>
                <li>Tiempo de bloqueo en importación: <strong class="resaltado-rojo">${resultado.proyeccion100Paginas.tiempoSegundos} segundos</strong> de espera obligatoria.</li>
                <li>Almacenamiento permanente en IndexedDB: <strong class="resaltado-rojo">~${resultado.proyeccion100Paginas.pesoMb} MB</strong> (frente a solo 0.25 MB - 3 MB del archivo original en PDF.js).</li>
              </ul>
            </li>
          </ul>
        </div>
      `;
    } catch (err) {
      resultadoRasterizado.innerHTML = `<div class="tarjeta-riesgo">Error al ejecutar medición: ${err.message}</div>`;
    } finally {
      btnTestRasterizado.disabled = false;
      btnTestRasterizado.textContent = '▶ Ejecutar Test de Rasterizado Empírico (10 páginas)';
    }
  });
}

// Auto-arranque al cargar el DOM
window.addEventListener('DOMContentLoaded', async () => {
  inicializarVisor();
  configurarCargaArchivo();
  configurarZoom();
  configurarPestanas();
  configurarTestRasterizado();

  // Auto-cargar documento de 100 páginas al iniciar para demostración inmediata
  await generarYCargar100Paginas();
});
