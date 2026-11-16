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

export const NOTAS_TECLADO = [];
