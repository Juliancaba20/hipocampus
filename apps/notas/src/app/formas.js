// Formas que ofrece el pizarrón (nombre interno, texto del botón, trazo del ícono).
// Incluye formas básicas y formas avanzadas (Etapa 21A):
// estrella, hexágono, llave, nube, cilindro, cruz y flecha doblada.
export const LISTA_FORMAS = [
  ['rectangulo', 'Rectángulo (R)', 'M4 6h16v12H4z'],
  ['elipse', 'Elipse (E)', 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z'],
  ['triangulo', 'Triángulo', 'M12 5l8 14H4z'],
  ['rombo', 'Rombo', 'M12 4l8 8-8 8-8-8z'],
  ['linea', 'Línea (L)', 'M5 19L19 5'],
  ['flecha', 'Flecha (A)', 'M5 19L19 5M10 5h9v9'],
  ['estrella', 'Estrella', 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1L12 2z'],
  ['hexagono', 'Hexágono', 'M12 3l8 4.6v9.2L12 21l-8-4.6V7.6L12 3z'],
  ['llave', 'Llave', 'M9 3c-1.7 0-3 1.3-3 3v4c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v4c0 1.7 1.3 3 3 3h2v-2H9c-.6 0-1-.4-1-1v-4c0-1.7-1.3-3-3-3 1.7 0 3-1.3 3-3V6c0-.6.4-1 1-1h2V3H9z'],
  ['nube', 'Nube', 'M19.4 15a4 4 0 0 0-1.4-7.8 6 6 0 0 0-11 1.8 4 4 0 0 0 .5 8h12z'],
  ['cilindro', 'Cilindro', 'M5 7c0-2.2 3.1-4 7-4s7 1.8 7 4v10c0 2.2-3.1 4-7 4s-7-1.8-7-4V7zm0 0c0 2.2 3.1 4 7 4s7-1.8 7-4'],
  ['cruz', 'Cruz', 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z'],
  ['flechaDoblada', 'Flecha doblada', 'M6 18h6a4 4 0 0 0 4-4V5m-4 4l4-4 4 4'],
];

export const ICONOS_FORMA = Object.fromEntries(LISTA_FORMAS.map(([k, , d]) => [k, d]));
export const NOMBRES_FORMA = Object.fromEntries(LISTA_FORMAS.map(([k, n]) => [k, n]));
export const ES_FORMA = (h) => h in ICONOS_FORMA;
