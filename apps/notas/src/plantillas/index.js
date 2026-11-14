// Módulo de Plantillas de Documentos (Etapa 21C).
// Plantillas del sistema (clase, resumen, Cornell, repaso, cuadro comparativo, línea de tiempo)
// y gestión de plantillas propias guardadas por el usuario.

import { guardarDocumento } from '../almacen/documentos.js';
import { guardarElementos } from '../almacen/elementos.js';
import { obtenerAjuste, guardarAjuste } from '../almacen/ajustes.js';
import { crearDocumento, nuevoId, FORMATOS, MODOS_ESCRITURA, TIPOS_ELEMENTO } from '../almacen/modelo.js';
import { ANCHO_A4, ALTO_A4 } from '../formatos/paginas.js';
import { remaparAnclajesConectores } from '../lienzo/conectores.js';
import { ESTILOS_PREDETERMINADOS } from '../herramientas/texto/estilo.js';

export const CLAVE_PLANTILLAS_PROPIAS = 'plantillas.personalizadas';

/**
 * Las plantillas del sistema escriben sus textos en formato abreviado: { t: 'texto', e: 'idDeEstilo' }.
 * El modelo de texto usa { tipo, estilo, runs: [{ texto }] }; sin esta conversión el texto se descartaba
 * al abrir la nota y las plantillas quedaban vacías.
 */
export function bloquesDePlantilla(bloques) {
  if (!Array.isArray(bloques)) return bloques;
  return bloques.map((b) => {
    if (!b || typeof b !== 'object' || Array.isArray(b.runs) || typeof b.t !== 'string') return b;
    const est = ESTILOS_PREDETERMINADOS[b.e];
    return { tipo: est?.tipo || 'parrafo', ...(est ? { estilo: b.e } : {}), runs: [{ texto: b.t }] };
  });
}

/**
 * En las plantillas, `tamano` indica el tamaño final deseado del primer bloque. Como los estilos de
 * título y subtítulo multiplican el tamaño base (×1,9 y ×1,45), se divide para no obtener títulos gigantes.
 */
export function tamanoBaseDePlantilla(datos) {
  const tam = Number(datos?.tamano) || 15;
  const primero = Array.isArray(datos?.bloques) ? datos.bloques[0] : null;
  const factor = ESTILOS_PREDETERMINADOS[primero?.e]?.factor || 1;
  if (factor <= 1 || tam < 16) return tam;
  return Math.max(13, Math.round(tam / factor));
}

/**
 * Plantillas predefinidas del sistema.
 * Son puramente datos estáticos y ligeros en memoria.
 */
export const PLANTILLAS_SISTEMA = [
  // 1. Cornell (Páginas A4)
  {
    id: 'cornell',
    nombre: 'Método Cornell',
    icono: '',
    descripcion: 'Apuntes con columna izquierda para ideas clave y preguntas, notas de clase y resumen inferior.',
    formato: FORMATOS.PAGINAS,
    escritura: MODOS_ESCRITURA.AMBOS,
    estiloRenglones: 'rayado',
    categoria: 'estudio',
    esPropia: false,
    config: {
      cantidadPaginas: 1,
      tamanoHoja: 'A4',
      orientacion: 'vertical',
      margen: 'normal',
    },
    elementos: [
      // Encabezado
      {
        id: 'c-encabezado',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 48,
        y: 44,
        ancho: 698,
        alto: 80,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Apuntes Cornell · Tema:', e: 'titulo' },
            { t: 'Materia / Asignatura: ___________________  ·  Fecha: _______________', e: 'subtitulo' },
          ],
          tamano: 22,
          color: '#14192b',
        },
      },
      // Separador horizontal superior
      {
        id: 'c-sep-h1',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 48,
        y: 130,
        ancho: 698,
        alto: 0,
        contenedor: 1,
        datos: { forma: 'linea', borde: '#cbd5e1', grosor: 2, opacidad: 0.9 },
      },
      // Columna izquierda: Ideas clave / Preguntas
      {
        id: 'c-ideas',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 48,
        y: 145,
        ancho: 210,
        alto: 730,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Ideas clave y preguntas', e: 'importante' },
            { t: '• ¿Cuál es el concepto principal?\n• Puntos para recordar\n• Posibles preguntas de examen', e: 'normal' },
          ],
          tamano: 15,
          color: '#2350d8',
        },
      },
      // Separador vertical entre columnas
      {
        id: 'c-sep-v',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 270,
        y: 130,
        ancho: 0,
        alto: 770,
        contenedor: 1,
        datos: { forma: 'linea', borde: '#cbd5e1', grosor: 2, opacidad: 0.9 },
      },
      // Columna derecha: Notas detalladas
      {
        id: 'c-notas',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 285,
        y: 145,
        ancho: 460,
        alto: 730,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Notas de la sesión', e: 'subtitulo' },
            { t: 'Desarrollo de los conceptos explicados en clase:\n- Use viñetas, esquemas o abreviaturas.\n- Deje espacio entre ideas para añadir aclaraciones.', e: 'normal' },
          ],
          tamano: 15,
          color: '#334155',
        },
      },
      // Separador horizontal inferior
      {
        id: 'c-sep-h2',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 48,
        y: 900,
        ancho: 698,
        alto: 0,
        contenedor: 1,
        datos: { forma: 'linea', borde: '#2350d8', grosor: 2.5, opacidad: 0.9 },
      },
      // Bloque inferior: Resumen
      {
        id: 'c-resumen',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 48,
        y: 915,
        ancho: 698,
        alto: 150,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Resumen sintético', e: 'importante' },
            { t: 'Sintetice en 2 o 3 oraciones las conclusiones principales y la idea central de la clase.', e: 'normal' },
          ],
          tamano: 15,
          color: '#1e293b',
        },
      },
    ],
  },

  // 2. Resumen (Páginas A4)
  {
    id: 'resumen',
    nombre: 'Resumen temático',
    icono: '',
    descripcion: 'Estructura para sintetizar lecturas, artículos o temas con conceptos clave y conclusiones.',
    formato: FORMATOS.PAGINAS,
    escritura: MODOS_ESCRITURA.AMBOS,
    estiloRenglones: 'rayado',
    categoria: 'estudio',
    esPropia: false,
    config: {
      cantidadPaginas: 1,
      tamanoHoja: 'A4',
      orientacion: 'vertical',
      margen: 'normal',
    },
    elementos: [
      {
        id: 'res-titulo',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 54,
        y: 50,
        ancho: 686,
        alto: 90,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Resumen: [Título del Tema o Lectura]', e: 'titulo' },
            { t: 'Autor / Fuente: _________________  ·  Fecha de lectura: _______________', e: 'subtitulo' },
          ],
          tamano: 22,
          color: '#14192b',
        },
      },
      // Caja idea central
      {
        id: 'res-caja-tesis',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 54,
        y: 150,
        ancho: 686,
        alto: 110,
        contenedor: 1,
        datos: { forma: 'rectangulo', relleno: '#eff6ff', borde: '#3b82f6', grosor: 2, radioEsquinas: 8, opacidad: 1 },
      },
      {
        id: 'res-texto-tesis',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 74,
        y: 165,
        ancho: 646,
        alto: 80,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Idea central / Tesis principal', e: 'importante' },
            { t: 'Escriba aquí la tesis o el mensaje fundamental que el texto busca transmitir.', e: 'normal' },
          ],
          tamano: 16,
          color: '#1e40af',
        },
      },
      // Puntos clave
      {
        id: 'res-puntos',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 54,
        y: 285,
        ancho: 686,
        alto: 450,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Puntos clave y desarrollo', e: 'subtitulo' },
            { t: '1. Primer concepto fundamental:\n   - Argumentos y datos de respaldo.\n2. Segundo concepto fundamental:\n   - Relación con otros temas conocidos.\n3. Términos y definiciones a recordar:\n   - Concepto A: definición clara y precisa.', e: 'normal' },
          ],
          tamano: 16,
          color: '#334155',
        },
      },
      // Caja conclusiones
      {
        id: 'res-caja-concl',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 54,
        y: 780,
        ancho: 686,
        alto: 150,
        contenedor: 1,
        datos: { forma: 'rectangulo', relleno: '#f8fafc', borde: '#94a3b8', grosor: 1.5, radioEsquinas: 8, opacidad: 1 },
      },
      {
        id: 'res-texto-concl',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 74,
        y: 795,
        ancho: 646,
        alto: 120,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Conclusiones y aplicaciones prácticas', e: 'importante' },
            { t: '¿Cómo se aplica esto en la práctica o en el examen? Síntesis reflexiva del contenido.', e: 'normal' },
          ],
          tamano: 15,
          color: '#1e293b',
        },
      },
    ],
  },

  // 3. Clase (Páginas A4)
  {
    id: 'clase',
    nombre: 'Apuntes de clase',
    icono: '',
    descripcion: 'Diseño para registrar asignaturas con objetivos, explicación de temas y tareas pendientes.',
    formato: FORMATOS.PAGINAS,
    escritura: MODOS_ESCRITURA.AMBOS,
    estiloRenglones: 'cuadriculado',
    categoria: 'estudio',
    esPropia: false,
    config: {
      cantidadPaginas: 1,
      tamanoHoja: 'A4',
      orientacion: 'vertical',
      margen: 'normal',
    },
    elementos: [
      {
        id: 'cl-tit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 50,
        y: 45,
        ancho: 694,
        alto: 80,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Clase: [Nombre de la Asignatura]', e: 'titulo' },
            { t: 'Profesor(a): ___________________  ·  Sesión N.°: _____  ·  Fecha: ____________', e: 'subtitulo' },
          ],
          tamano: 22,
          color: '#14192b',
        },
      },
      {
        id: 'cl-caja-obj',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 50,
        y: 135,
        ancho: 694,
        alto: 85,
        contenedor: 1,
        datos: { forma: 'rectangulo', relleno: '#fefce8', borde: '#eab308', grosor: 2, radioEsquinas: 8, opacidad: 1 },
      },
      {
        id: 'cl-txt-obj',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 68,
        y: 147,
        ancho: 658,
        alto: 60,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Objetivos de aprendizaje de la sesión', e: 'importante' },
            { t: '• Comprender los conceptos esenciales expuestos hoy.\n• Identificar dudas y puntos a consultar.', e: 'normal' },
          ],
          tamano: 15,
          color: '#854d0e',
        },
      },
      {
        id: 'cl-txt-cuerpo',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 50,
        y: 240,
        ancho: 694,
        alto: 580,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Desarrollo del tema', e: 'subtitulo' },
            { t: 'Notas de clase, fórmulas, definiciones y ejemplos trabajados por el docente:', e: 'normal' },
            { t: '', e: 'normal' },
            { t: 'Dudas planteadas durante la explicación:', e: 'subtitulo' },
            { t: '- Pregunta 1:\n- Pregunta 2:', e: 'normal' },
          ],
          tamano: 16,
          color: '#334155',
        },
      },
      {
        id: 'cl-caja-tareas',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 50,
        y: 860,
        ancho: 694,
        alto: 130,
        contenedor: 1,
        datos: { forma: 'rectangulo', relleno: '#f1f5f9', borde: '#64748b', grosor: 1.5, radioEsquinas: 8, opacidad: 1 },
      },
      {
        id: 'cl-txt-tareas',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 68,
        y: 875,
        ancho: 658,
        alto: 100,
        contenedor: 1,
        datos: {
          bloques: [
            { t: 'Tareas, lecturas y entregas próximas', e: 'importante' },
            { t: '☐ Ejercicios asignados para la próxima clase.\n☐ Lectura del capítulo correspondiente.', e: 'normal' },
          ],
          tamano: 15,
          color: '#334155',
        },
      },
    ],
  },

  // 4. Repaso con pasos de revelado (Tarjetas)
  {
    id: 'repaso',
    nombre: 'Tarjetas de repaso',
    icono: '',
    descripcion: 'Fichas de estudio activas con revelado progresivo de conceptos por pasos (1, 2 y 3).',
    formato: FORMATOS.TARJETAS,
    escritura: MODOS_ESCRITURA.AMBOS,
    estiloRenglones: 'liso',
    categoria: 'estudio',
    esPropia: false,
    config: {
      tamano: '16:9',
      tarjetas: [
        {
          id: 'tarjeta-repaso-1',
          titulo: 'Anatomía del corazón',
          diseno: 'titulo-contenido',
          notasOrador: 'Enfatizar que las aurículas reciben sangre y los ventrículos la expulsan.',
        },
        {
          id: 'tarjeta-repaso-2',
          titulo: 'Circulación mayor y menor',
          diseno: 'titulo-contenido',
          notasOrador: 'Recordar el circuito pulmonar vs sistémico.',
        },
      ],
      tarjetaActiva: 'tarjeta-repaso-1',
    },
    elementos: [
      // Tarjeta 1 - Paso 0 / Base (Siempre visible)
      {
        id: 'rep1-tit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 40,
        ancho: 680,
        alto: 60,
        contenedor: 'tarjeta-repaso-1',
        pasoEstudio: null,
        datos: {
          bloques: [{ t: 'Cavidades Cardíacas', e: 'titulo' }],
          tamano: 28,
          color: '#14192b',
        },
      },
      // Tarjeta 1 - Paso 1: Pregunta inicial
      {
        id: 'rep1-p1',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 120,
        ancho: 680,
        alto: 70,
        contenedor: 'tarjeta-repaso-1',
        pasoEstudio: 1,
        datos: {
          bloques: [
            { t: 'Pregunta de repaso (Paso 1):', e: 'importante' },
            { t: '¿Cuáles son las cuatro cavidades del corazón y qué función cumple cada una?', e: 'normal' },
          ],
          tamano: 18,
          color: '#1e40af',
        },
      },
      // Tarjeta 1 - Paso 2: Respuesta y detalles
      {
        id: 'rep1-p2',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 210,
        ancho: 680,
        alto: 100,
        contenedor: 'tarjeta-repaso-1',
        pasoEstudio: 2,
        datos: {
          bloques: [
            { t: 'Respuesta fundamental (Paso 2):', e: 'subtitulo' },
            { t: '• Aurícula derecha e izquierda: cavidades receptoras superiores.\n• Ventrículo derecho e izquierdo: cavidades de bombeo inferiores con pared muscular.', e: 'normal' },
          ],
          tamano: 17,
          color: '#15803d',
        },
      },
      // Tarjeta 1 - Paso 3: Mnemotecnia y conclusión
      {
        id: 'rep1-p3',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 330,
        ancho: 680,
        alto: 80,
        contenedor: 'tarjeta-repaso-1',
        pasoEstudio: 3,
        datos: {
          bloques: [
            { t: 'Regla mnemotécnica (Paso 3):', e: 'definicion' },
            { t: '«Las Aurículas Arriba reciben, los Ventrículos Viajan y expulsan».', e: 'normal' },
          ],
          tamano: 16,
          color: '#7e22ce',
        },
      },

      // Tarjeta 2 - Base
      {
        id: 'rep2-tit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 40,
        ancho: 680,
        alto: 60,
        contenedor: 'tarjeta-repaso-2',
        pasoEstudio: null,
        datos: {
          bloques: [{ t: 'Circuitos Sanguíneos', e: 'titulo' }],
          tamano: 28,
          color: '#14192b',
        },
      },
      // Tarjeta 2 - Paso 1
      {
        id: 'rep2-p1',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 130,
        ancho: 680,
        alto: 80,
        contenedor: 'tarjeta-repaso-2',
        pasoEstudio: 1,
        datos: {
          bloques: [
            { t: '¿En qué se diferencian la circulación mayor y la menor?', e: 'importante' },
          ],
          tamano: 20,
          color: '#1e40af',
        },
      },
      // Tarjeta 2 - Paso 2
      {
        id: 'rep2-p2',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 60,
        y: 230,
        ancho: 680,
        alto: 150,
        contenedor: 'tarjeta-repaso-2',
        pasoEstudio: 2,
        datos: {
          bloques: [
            { t: 'Explicación completa:', e: 'subtitulo' },
            { t: '• Circulación menor (pulmonar): del ventrículo derecho a los pulmones para oxigenar la sangre y regresa a la aurícula izquierda.\n• Circulación mayor (sistémica): del ventrículo izquierdo a todo el organismo y regresa a la aurícula derecha.', e: 'normal' },
          ],
          tamano: 17,
          color: '#15803d',
        },
      },
    ],
  },

  // 5. Cuadro comparativo (Pizarrón infinito)
  {
    id: 'cuadro-comparativo',
    nombre: 'Cuadro comparativo',
    icono: '',
    descripcion: 'Pizarrón libre con matriz estructurada para cotejar criterios, características y diferencias.',
    formato: FORMATOS.PIZARRON,
    escritura: MODOS_ESCRITURA.AMBOS,
    estiloRenglones: 'cuadriculado',
    categoria: 'diagrama',
    esPropia: false,
    config: {},
    elementos: [
      {
        id: 'cmp-titulo',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 80,
        y: 50,
        ancho: 800,
        alto: 70,
        contenedor: null,
        datos: {
          bloques: [
            { t: 'Cuadro Comparativo: [Concepto A] vs [Concepto B]', e: 'titulo' },
          ],
          tamano: 26,
          color: '#14192b',
        },
      },
      // Cabecera Columna Criterios
      {
        id: 'cmp-col-crit',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 80,
        y: 140,
        ancho: 220,
        alto: 50,
        contenedor: null,
        datos: { forma: 'rectangulo', relleno: '#f1f5f9', borde: '#475569', grosor: 2, radioEsquinas: 6 },
      },
      {
        id: 'cmp-txt-crit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 95,
        y: 152,
        ancho: 190,
        alto: 30,
        contenedor: null,
        datos: { bloques: [{ t: 'CRITERIO', e: 'importante' }], tamano: 16, color: '#1e293b' },
      },
      // Cabecera Columna Opción A
      {
        id: 'cmp-col-a',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 320,
        y: 140,
        ancho: 280,
        alto: 50,
        contenedor: null,
        datos: { forma: 'rectangulo', relleno: '#eff6ff', borde: '#2563eb', grosor: 2, radioEsquinas: 6 },
      },
      {
        id: 'cmp-txt-a',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 335,
        y: 152,
        ancho: 250,
        alto: 30,
        contenedor: null,
        datos: { bloques: [{ t: 'ELEMENTO A', e: 'importante' }], tamano: 16, color: '#1e40af' },
      },
      // Cabecera Columna Opción B
      {
        id: 'cmp-col-b',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 620,
        y: 140,
        ancho: 280,
        alto: 50,
        contenedor: null,
        datos: { forma: 'rectangulo', relleno: '#f0fdf4', borde: '#16a34a', grosor: 2, radioEsquinas: 6 },
      },
      {
        id: 'cmp-txt-b',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 635,
        y: 152,
        ancho: 250,
        alto: 30,
        contenedor: null,
        datos: { bloques: [{ t: 'ELEMENTO B', e: 'importante' }], tamano: 16, color: '#166534' },
      },
      // Fila 1: Definición
      {
        id: 'cmp-f1-crit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 85,
        y: 215,
        ancho: 210,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: '1. Definición', e: 'subtitulo' }], tamano: 16, color: '#334155' },
      },
      {
        id: 'cmp-f1-a',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 325,
        y: 215,
        ancho: 270,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: 'Definición precisa del elemento A y alcance.', e: 'normal' }], tamano: 15, color: '#334155' },
      },
      {
        id: 'cmp-f1-b',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 625,
        y: 215,
        ancho: 270,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: 'Definición precisa del elemento B y alcance.', e: 'normal' }], tamano: 15, color: '#334155' },
      },
      // Fila 2: Ventajas
      {
        id: 'cmp-f2-crit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 85,
        y: 320,
        ancho: 210,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: '2. Ventajas principales', e: 'subtitulo' }], tamano: 16, color: '#334155' },
      },
      {
        id: 'cmp-f2-a',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 325,
        y: 320,
        ancho: 270,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: '• Mayor eficiencia\n• Menor costo o complejidad', e: 'normal' }], tamano: 15, color: '#334155' },
      },
      {
        id: 'cmp-f2-b',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 625,
        y: 320,
        ancho: 270,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: '• Mayor precisión\n• Mayor flexibilidad operativa', e: 'normal' }], tamano: 15, color: '#334155' },
      },
      // Fila 3: Casos de uso
      {
        id: 'cmp-f3-crit',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 85,
        y: 425,
        ancho: 210,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: '3. ¿Cuándo elegirlo?', e: 'subtitulo' }], tamano: 16, color: '#334155' },
      },
      {
        id: 'cmp-f3-a',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 325,
        y: 425,
        ancho: 270,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: 'Ideal para situaciones estándar o rápidas.', e: 'normal' }], tamano: 15, color: '#334155' },
      },
      {
        id: 'cmp-f3-b',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 625,
        y: 425,
        ancho: 270,
        alto: 80,
        contenedor: null,
        datos: { bloques: [{ t: 'Ideal para situaciones críticas o de alta exactitud.', e: 'normal' }], tamano: 15, color: '#334155' },
      },
    ],
  },

  // 6. Línea de tiempo (Pizarrón infinito)
  {
    id: 'linea-tiempo',
    nombre: 'Línea de tiempo',
    icono: '',
    descripcion: 'Eje cronológico con hitos numerados, fechas y descripciones interconectadas.',
    formato: FORMATOS.PIZARRON,
    escritura: MODOS_ESCRITURA.AMBOS,
    estiloRenglones: 'cuadriculado',
    categoria: 'diagrama',
    esPropia: false,
    config: {},
    elementos: [
      {
        id: 'lt-titulo',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 80,
        y: 60,
        ancho: 800,
        alto: 60,
        contenedor: null,
        datos: {
          bloques: [{ t: 'Línea de Tiempo Cronológica: [Tema Histórico o Proceso]', e: 'titulo' }],
          tamano: 26,
          color: '#14192b',
        },
      },
      // Eje central con flecha
      {
        id: 'lt-eje',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 80,
        y: 300,
        ancho: 840,
        alto: 0,
        contenedor: null,
        datos: { forma: 'flecha', borde: '#2563eb', grosor: 4, opacidad: 1 },
      },
      // Hito 1
      {
        id: 'lt-h1-caja',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 100,
        y: 160,
        ancho: 180,
        alto: 80,
        contenedor: null,
        datos: { forma: 'rectangulo', relleno: '#eff6ff', borde: '#3b82f6', grosor: 2, radioEsquinas: 8 },
      },
      {
        id: 'lt-h1-txt',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 110,
        y: 170,
        ancho: 160,
        alto: 60,
        contenedor: null,
        datos: {
          bloques: [
            { t: 'Fase 1 · Origen', e: 'importante' },
            { t: 'Año / Fecha inicial', e: 'normal' },
          ],
          tamano: 14,
          color: '#1e40af',
        },
      },
      {
        id: 'lt-h1-punto',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 180,
        y: 290,
        ancho: 20,
        alto: 20,
        contenedor: null,
        datos: { forma: 'circulo', relleno: '#2563eb', borde: '#ffffff', grosor: 3 },
      },
      // Conector Hito 1
      {
        id: 'lt-h1-con',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 190,
        y: 240,
        ancho: 0,
        alto: 50,
        contenedor: null,
        datos: { forma: 'linea', borde: '#93c5fd', grosor: 2, estiloBorde: 'guiones', anclajeInicio: { elementoId: 'lt-h1-caja', puerto: 'abajo' }, anclajeFin: { elementoId: 'lt-h1-punto', puerto: 'arriba' } },
      },

      // Hito 2 (abajo)
      {
        id: 'lt-h2-punto',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 420,
        y: 290,
        ancho: 20,
        alto: 20,
        contenedor: null,
        datos: { forma: 'circulo', relleno: '#16a34a', borde: '#ffffff', grosor: 3 },
      },
      {
        id: 'lt-h2-caja',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 340,
        y: 350,
        ancho: 180,
        alto: 80,
        contenedor: null,
        datos: { forma: 'rectangulo', relleno: '#f0fdf4', borde: '#22c55e', grosor: 2, radioEsquinas: 8 },
      },
      {
        id: 'lt-h2-txt',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 350,
        y: 360,
        ancho: 160,
        alto: 60,
        contenedor: null,
        datos: {
          bloques: [
            { t: 'Fase 2 · Desarrollo', e: 'importante' },
            { t: 'Hito intermedio', e: 'normal' },
          ],
          tamano: 14,
          color: '#166534',
        },
      },
      // Conector Hito 2
      {
        id: 'lt-h2-con',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 430,
        y: 310,
        ancho: 0,
        alto: 40,
        contenedor: null,
        datos: { forma: 'linea', borde: '#86efac', grosor: 2, estiloBorde: 'guiones', anclajeInicio: { elementoId: 'lt-h2-punto', puerto: 'abajo' }, anclajeFin: { elementoId: 'lt-h2-caja', puerto: 'arriba' } },
      },

      // Hito 3 (arriba)
      {
        id: 'lt-h3-caja',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 640,
        y: 160,
        ancho: 180,
        alto: 80,
        contenedor: null,
        datos: { forma: 'rectangulo', relleno: '#faf5ff', borde: '#a855f7', grosor: 2, radioEsquinas: 8 },
      },
      {
        id: 'lt-h3-txt',
        tipo: TIPOS_ELEMENTO.TEXTO,
        x: 650,
        y: 170,
        ancho: 160,
        alto: 60,
        contenedor: null,
        datos: {
          bloques: [
            { t: 'Fase 3 · Actualidad', e: 'importante' },
            { t: 'Culminación / Estado final', e: 'normal' },
          ],
          tamano: 14,
          color: '#6b21a8',
        },
      },
      {
        id: 'lt-h3-punto',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 720,
        y: 290,
        ancho: 20,
        alto: 20,
        contenedor: null,
        datos: { forma: 'circulo', relleno: '#9333ea', borde: '#ffffff', grosor: 3 },
      },
      // Conector Hito 3
      {
        id: 'lt-h3-con',
        tipo: TIPOS_ELEMENTO.FIGURA,
        x: 730,
        y: 240,
        ancho: 0,
        alto: 50,
        contenedor: null,
        datos: { forma: 'linea', borde: '#d8b4fe', grosor: 2, estiloBorde: 'guiones', anclajeInicio: { elementoId: 'lt-h3-caja', puerto: 'abajo' }, anclajeFin: { elementoId: 'lt-h3-punto', puerto: 'arriba' } },
      },
    ],
  },
];

/**
 * Obtiene la lista de plantillas guardadas por el usuario.
 */
export async function listarPlantillasPropias() {
  const lista = await obtenerAjuste(CLAVE_PLANTILLAS_PROPIAS, []);
  return Array.isArray(lista) ? lista : [];
}

/**
 * Guarda una nueva plantilla personalizada propia a partir de un documento y sus elementos.
 * Admite tanto guardarPlantillaPropia({ doc, elementos, nombre, descripcion, icono })
 * como guardarPlantillaPropia(doc, elementos, { nombre, descripcion, icono }).
 */
export async function guardarPlantillaPropia(arg1, arg2, arg3) {
  let doc, elementos, nombre, descripcion, icono;
  if (arg1 && typeof arg1 === 'object' && ('formato' in arg1 || 'titulo' in arg1)) {
    doc = arg1;
    elementos = arg2 || [];
    const opts = arg3 || {};
    nombre = opts.nombre;
    descripcion = opts.descripcion || '';
    icono = opts.icono || '';
  } else {
    const opts = arg1 || {};
    doc = opts.doc;
    elementos = opts.elementos || [];
    nombre = opts.nombre;
    descripcion = opts.descripcion || '';
    icono = opts.icono || '';
  }

  if (!doc) throw new Error('Se requiere un documento de origen para crear la plantilla.');
  const nombreLimpio = String(nombre || doc.titulo || 'Mi plantilla').trim().slice(0, 80);
  if (!nombreLimpio) throw new Error('El nombre de la plantilla no puede estar vacío.');

  const plantillas = await listarPlantillasPropias();
  const id = `propia_${nuevoId()}`;

  // Sanea elementos para que no conserven el ID del documento origen
  const elementosPlantilla = (elementos || []).map((el) => {
    const { id: elId, documentoId, ...resto } = el;
    return {
      id: elId, // Se conserva ID relativo para remapeo de conectores
      ...resto,
    };
  });

  const nueva = {
    id,
    nombre: nombreLimpio,
    descripcion: String(descripcion || '').trim().slice(0, 200),
    formato: doc.formato || FORMATOS.PIZARRON,
    escritura: doc.escritura || MODOS_ESCRITURA.AMBOS,
    estiloRenglones: doc.renglones?.estilo || 'rayado',
    config: doc.config ? JSON.parse(JSON.stringify(doc.config)) : {},
    renglones: doc.renglones ? JSON.parse(JSON.stringify(doc.renglones)) : null,
    elementos: elementosPlantilla,
    icono: icono || '',
    esPropia: true,
    creado: Date.now(),
  };

  const actualizadas = [nueva, ...plantillas.filter((p) => p.id !== id)];
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, actualizadas);
  return nueva;
}

/**
 * Renombra una plantilla propia existente.
 */
export async function renombrarPlantillaPropia(id, nuevoNombre) {
  const nombreLimpio = String(nuevoNombre || '').trim().slice(0, 80);
  if (!nombreLimpio) throw new Error('El nombre no puede estar vacío.');
  const plantillas = await listarPlantillasPropias();
  const actualizadas = plantillas.map((p) => (p.id === id ? { ...p, nombre: nombreLimpio } : p));
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, actualizadas);
  return actualizadas.find((p) => p.id === id);
}

/**
 * Elimina una plantilla propia guardada por el usuario.
 */
export async function eliminarPlantillaPropia(id) {
  const plantillas = await listarPlantillasPropias();
  const actualizadas = plantillas.filter((p) => p.id !== id);
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, actualizadas);
  return actualizadas;
}

/**
 * Importa o restaura una colección de plantillas personalizadas (usado en copias de respaldo).
 */
export async function importarPlantillasPropias(plantillasExternas = []) {
  if (!Array.isArray(plantillasExternas) || !plantillasExternas.length) return [];
  const actuales = await listarPlantillasPropias();
  const mapa = new Map(actuales.map((p) => [p.id, p]));

  for (const ext of plantillasExternas) {
    if (!ext || !ext.nombre || !ext.formato) continue;
    const id = ext.id || `propia_${nuevoId()}`;
    mapa.set(id, {
      ...ext,
      id,
      esPropia: true,
    });
  }

  const fusionadas = Array.from(mapa.values());
  await guardarAjuste(CLAVE_PLANTILLAS_PROPIAS, fusionadas);
  return fusionadas;
}

/**
 * Devuelve todas las plantillas disponibles (sistema + usuario).
 */
export async function listarTodasLasPlantillas() {
  const propias = await listarPlantillasPropias();
  return [...PLANTILLAS_SISTEMA, ...propias];
}

/**
 * Obtiene una plantilla por su ID.
 */
export async function obtenerPlantillaPorId(id) {
  const todas = await listarTodasLasPlantillas();
  return todas.find((p) => p.id === id) || null;
}

/**
 * Crea y persiste un documento nuevo a partir de una plantilla dada.
 * Clona todos los elementos con IDs nuevos y remapea anclajes de conectores.
 */
export async function crearDocumentoDesdePlantilla(plantilla, opciones = {}) {
  if (!plantilla) throw new Error('Plantilla inválida o no especificada.');

  const opts = typeof opciones === 'string' ? { titulo: opciones } : (opciones || {});
  const { titulo = '', carpetaId = null, guardar = true } = opts;

  const tituloFinal = String(titulo || plantilla.nombre || 'Nuevo documento').trim();
  const docBase = crearDocumento({
    titulo: tituloFinal,
    formato: plantilla.formato,
    escritura: plantilla.escritura || MODOS_ESCRITURA.AMBOS,
    estiloRenglones: plantilla.estiloRenglones || 'rayado',
    carpetaId: carpetaId || null,
    config: plantilla.config ? JSON.parse(JSON.stringify(plantilla.config)) : {},
  });

  const docGuardado = guardar ? await guardarDocumento(docBase) : docBase;

  // Mapear elementos con IDs únicos nuevos
  const mapaIds = new Map();
  const base = Date.now();
  const elementosClonados = (plantilla.elementos || []).map((el, indice) => {
    const nuevoIdEl = nuevoId();
    mapaIds.set(el.id, nuevoIdEl);
    const clon = JSON.parse(JSON.stringify(el));
    if (clon.tipo === TIPOS_ELEMENTO.TEXTO && clon.datos) {
      clon.datos.tamano = tamanoBaseDePlantilla(clon.datos);
      clon.datos.bloques = bloquesDePlantilla(clon.datos.bloques);
    }
    return {
      ...clon,
      id: nuevoIdEl,
      documentoId: docGuardado.id,
      // Apilado: el orden de definición de la plantilla manda (los últimos quedan por encima)
      z: Number.isFinite(clon.z) && clon.z !== 0 ? clon.z : indice,
      creado: base + indice,
      modificado: base,
    };
  });

  // Remapar conectores si se conectaban entre elementos de la plantilla
  const elementosFinales = remaparAnclajesConectores(elementosClonados, mapaIds);

  if (guardar && elementosFinales.length > 0) {
    await guardarElementos(elementosFinales);
  }

  return { doc: docGuardado, elementos: elementosFinales };
}
