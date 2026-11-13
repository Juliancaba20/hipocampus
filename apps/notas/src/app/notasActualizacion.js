// Notas de actualización de Anotomía.
// Es un módulo de datos puro (sin React): lo usan la ventana «Novedades» de la app (web y versiones
// descargables) y puede importarlo cualquier página de la web, por ejemplo la de /notas.
//
// Para publicar una versión nueva: agregar un objeto al PRINCIPIO de NOTAS_ACTUALIZACION,
// actualizar VERSION_APP y la versión de package.json (hay una prueba que verifica que coincidan).

export const VERSION_APP = '1.3.0';

/** Cómo se muestra la versión a las personas: «1.3» (se omite el «.0» final). */
export function versionVisible(v = VERSION_APP) {
  return String(v).replace(/\.0$/, '');
}

export const NOTAS_ACTUALIZACION = [
  {
    version: '1.3.0',
    fecha: 'Noviembre de 2026',
    titulo: 'Más herramientas para estudiar',
    resumen: 'La versión 1.3 suma edición avanzada, PDF, búsqueda, estudio con repaso espaciado y muchas correcciones.',
    secciones: [
      {
        titulo: 'Novedades',
        items: [
          'Edición del lienzo: agrupar, bloquear, alinear y distribuir objetos, con guías e imán.',
          'Búsqueda en todas sus notas y dentro de la nota abierta.',
          'Exportación a PDF (hoja A4 real) y a imagen.',
          'Anotar PDF: abra un PDF y escriba, dibuje o resalte sobre sus páginas.',
          'Páginas A4 más completas: encabezado y pie, índice, estilos de párrafo, notas al pie y texto justificado.',
          'Biblioteca de 80 íconos y pegatinas de estudio, y lápices favoritos.',
          'Seis plantillas de estudio (Cornell, resumen, apuntes de clase, tarjetas de repaso, cuadro comparativo y línea de tiempo) y plantillas propias.',
          'Estudio: tarjetas de doble cara, modo estudio paso a paso, oclusión de imagen, texto oculto y repaso espaciado con estadísticas.',
          'Conexiones: enlaces entre notas, marcadores de ubicación, mapas conceptuales, favoritas y recientes.',
          'Calendario de exámenes con cuenta regresiva en la biblioteca.',
          'Herramientas de precisión: regla, escuadra, transportador y corrección automática de formas.',
        ],
      },
      {
        titulo: 'Mejoras',
        items: [
          '«Encuadrar pág.» ahora muestra la hoja completa en pantalla.',
          'En las hojas A4, el texto nuevo se extiende hasta el margen derecho.',
          'Las notas creadas desde un PDF nacen sin renglones, para no tapar el texto del documento.',
          'Los botones de color y los del modo estudio tienen mejor contraste y se leen con claridad.',
          'La biblioteca muestra mejor las favoritas, los filtros y el nombre de la aplicación.',
          'Los avisos de repaso de la biblioteca se pueden ocultar desde «Repaso» y ya no quedan debajo del botón «Fijar».',
          'Lápices favoritos a su medida: hasta 12, con «Editar» para agregar, quitar, renombrar y ajustar cada uno, y «Restablecer».',
          'Los elementos enlazados a otra nota muestran una insignia visible, y la barra indica con qué nota están enlazados.',
          'En el editor, la barra de zoom y la de páginas (o de tarjetas) se muestran una al lado de la otra.',
          'Las hojas se crean siempre en formato vertical.',
        ],
      },
      {
        titulo: 'Correcciones',
        items: [
          'La biblioteca podía no abrirse; esto afectaba a los exámenes, las favoritas y las recientes.',
          'Al exportar, importar o restaurar una copia de seguridad se perdían el texto de los mapas conceptuales, los enlaces de figuras e imágenes, las favoritas y las notas del orador largas. Ahora se conservan.',
          'Al duplicar o importar una nota como copia, las flechas y conectores quedaban unidos a las formas originales. Ahora siguen a las de la copia.',
          'Las copias de seguridad ahora incluyen el calendario de exámenes.',
          'El PDF exportado medía más que una hoja A4; ahora mide 210 × 297 mm.',
          'Las plantillas se creaban sin texto y, a veces, con cajas que lo tapaban.',
          'La cuenta regresiva de los exámenes se adelantaba un día por la noche.',
          'Los botones de la barra de selección (enlazar nota, bloquear, alinear y agrupar) no respondían al clic.',
          'En «Íconos y pegatinas» ahora se puede elegir el color (el selector quedaba recortado) y el botón de cerrar se ve bien.',
          'La barra de zoom y la de páginas quedan a la misma altura.',
          'Con la corrección de formas, la línea enderezada queda entre el punto donde empezó y donde se suelta, y no se corta al mantener el lápiz.',
          'Al escribir el encabezado o el pie de página, el cursor ya no se sale del campo letra por letra.',
          'Las ventanas de estilos de párrafo, tabla de contenido, encabezado y pie, configurar página, repaso, exámenes y ayuda usan la tipografía de la aplicación.',
          'Se rehicieron los íconos mal dibujados, entre ellos el bisturí, el microscopio, el ADN, el átomo y la molécula.',
          'Los PDF de más de 500 páginas ya no se recortan al importar una copia de seguridad.',
        ],
      },
    ],
  },
];

export function ultimaVersion() {
  return NOTAS_ACTUALIZACION[0];
}

/** Texto en formato Markdown (para el README, un lanzamiento de GitHub o la página de descarga). */
export function notasEnMarkdown(notas = NOTAS_ACTUALIZACION) {
  return notas.map((n) => {
    const partes = [`## Anotomía ${versionVisible(n.version)} · ${n.fecha}`, `**${n.titulo}.** ${n.resumen}`];
    n.secciones.forEach((s) => partes.push(`### ${s.titulo}\n${s.items.map((i) => `- ${i}`).join('\n')}`));
    return partes.join('\n\n');
  }).join('\n\n---\n\n');
}
