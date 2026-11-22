// Notas de la versión del Teclado Científico. Las muestra /teclado/novedades.
//
// ► CÓMO PUBLICAR LAS NOTAS DE UNA VERSIÓN NUEVA
//   Agregue un objeto al PRINCIPIO de NOTAS_TECLADO (la versión más reciente va primero) y suba el cambio a
//   GitHub junto con la versión nueva. En cuanto haya al menos una versión con notas, la página /teclado
//   muestra sola el enlace «Notas de la versión», sin tocar nada más. Mientras la lista esté vacía, el enlace
//   no aparece.
//
//   Ejemplo (copie, quite los «//» y complete):
//   {
//     version: '1.7',                       // tal como figura en la descarga
//     fecha: 'Diciembre de 2026',
//     titulo: 'Título corto de la versión',
//     resumen: 'Una oración que resuma qué trae esta versión.',
//     secciones: [
//       { titulo: 'Novedades', items: ['Primera novedad.', 'Segunda novedad.'] },
//       { titulo: 'Mejoras', items: ['Primera mejora.'] },
//       { titulo: 'Correcciones', items: ['Primera corrección.'] },
//     ],
//   },
//   Las secciones son libres: puede usar solo «Novedades», o agregar otras. Cada texto va en una oración.

export const NOTAS_TECLADO = [
  // ── Notas de la versión 2.0 ─────────────────────────────────────────────────────────────────
  // Ya están escritas. Cuando publique la 2.0, BORRE las marcas «//» de las líneas de abajo (hasta el
  // cierre «},») para que aparezcan en la web junto con la nueva descarga. No las active antes: la
  // página mostraría notas de una versión que todavía no se puede descargar.
  //
  // {
  //   version: '2.0',
  //   fecha: 'Noviembre de 2026',
  //   titulo: 'Un teclado nuevo, más fluido y con mejor aspecto',
  //   resumen: 'El teclado se rehizo con otra tecnología: abre más rápido, se ve más nítido y prolijo, y tiene animaciones suaves. Mantiene los mismos símbolos y su configuración.',
  //   secciones: [
  //     {
  //       titulo: 'Novedades',
  //       items: [
  //         'Diseño nuevo: bordes redondeados con sombra, íconos nítidos y una transparencia que afecta solo al fondo, de modo que las letras se ven siempre claras.',
  //         'Animaciones suaves: un destello y un pequeño rebote al tocar una tecla, entrada escalonada al cambiar de pestaña, símbolos recientes que se deslizan y un barrido de color de izquierda a derecha al cambiar de tema.',
  //         'Las animaciones no bloquean el uso: se puede seguir escribiendo mientras corren y siempre terminan bien.',
  //         'Ícono junto al reloj (barra de tareas en Windows y Linux, barra de menús en Mac): el botón «–» oculta el teclado y un clic en el ícono lo vuelve a mostrar. También con Ctrl+Alt+G.',
  //         'Ya no aparece en Alt+Tab ni en la barra de tareas, así que no se interpone al cambiar entre sus documentos.',
  //       ],
  //     },
  //     {
  //       titulo: 'Mejoras',
  //       items: [
  //         'Puede quedar pegado a cualquier borde de la pantalla, incluido el superior. Si se arrastra con una parte afuera, vuelve solo adentro.',
  //         'Mantiene los mismos símbolos, colores y tamaños, y conserva su posición, color y símbolos recientes al pasar desde la versión anterior.',
  //         'Si ya tenía activado «Abrir al iniciar el sistema», sigue activado.',
  //       ],
  //     },
  //     {
  //       titulo: 'Para tener en cuenta',
  //       items: [
  //         'En Windows necesita WebView2, que ya viene con Windows 11 y con Windows 10 actualizado.',
  //         'En Mac es una versión en prueba: puede pedir el permiso de Accesibilidad la primera vez.',
  //         'En Linux se distribuye como un solo archivo (AppImage): si no abre, ejecútelo con --appimage-extract-and-run.',
  //       ],
  //     },
  //   ],
  // },
  {
    version: '1.8.2',
    fecha: 'Noviembre de 2026',
    titulo: 'Fin del aviso permanente de actualización',
    resumen: 'Corrige el aviso de «hay una versión nueva» que seguía apareciendo después de actualizar.',
    secciones: [
      {
        titulo: 'Correcciones',
        items: [
          'Después de actualizar, el teclado seguía avisando que había una versión nueva aunque ya estuviera instalada; al pasar a esta versión el aviso desaparece.',
          'Desde ahora el número de versión de cada descarga se toma de su etiqueta de publicación, de modo que no puede volver a quedar desfasado.',
        ],
      },
      {
        titulo: 'Incluye todo lo de la versión 1.8',
        items: ['Esta versión no cambia nada más: trae las mejoras de la 1.8 que se detallan abajo.'],
      },
    ],
  },
  {
    version: '1.8.1',
    fecha: 'Noviembre de 2026',
    titulo: 'Misma versión, publicada de nuevo',
    resumen: 'No trae cambios respecto de la 1.8: el programa es el mismo.',
    secciones: [
      {
        titulo: 'Importante',
        items: ['Por un error de numeración, esta publicación seguía mostrando el aviso de actualización; se corrige en la 1.8.2.'],
      },
    ],
  },
  {
    version: '1.8',
    fecha: 'Noviembre de 2026',
    titulo: 'Sin parpadeos, inicio automático y animaciones',
    resumen: 'El teclado se siente más fluido: no parpadea y estrena animaciones suaves, además de poder abrirse al iniciar el sistema.',
    secciones: [
      {
        titulo: 'Novedades',
        items: [
          'Nuevo interruptor «Abrir al iniciar el sistema» en la configuración (Windows, macOS y Linux); viene apagado de fábrica.',
          'Animaciones suaves: un destello de color al tocar una tecla, entrada escalonada de las teclas al cambiar de pestaña y un barrido de izquierda a derecha al cambiar de color.',
          'Las animaciones no bloquean el uso: se puede seguir tocando teclas, pasando el mouse y cambiando de pestaña mientras corren, y siempre terminan en el estado correcto.',
        ],
      },
      {
        titulo: 'Mejoras',
        items: [
          'El teclado ya no parpadea al abrirse: la ventana se muestra recién cuando está terminada y en su lugar.',
          'Cambiar el color, el tamaño de las teclas, la transparencia o cualquier interruptor de la configuración ya no produce parpadeos.',
          'Al cambiar de pestaña las teclas se reutilizan en lugar de crearse de nuevo.',
          'Se respeta el ajuste de Windows «mostrar animaciones»: si está desactivado, los cambios son inmediatos.',
        ],
      },
    ],
  },
];
