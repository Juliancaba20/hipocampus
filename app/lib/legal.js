// Datos legales del sitio y de las aplicaciones. Los usan el pie de página, las páginas /legal/* y el aviso de estadísticas.
//
// ⚠ ANTES DE PUBLICAR: complete TITULAR con su nombre y apellido tal como figuran en su DNI.
//   Es la persona que figura como titular de los derechos y como responsable del tratamiento de datos.
//   Si se deja vacío, los textos usan solamente la marca «Hipocampus».
//
// Los textos de /legal/* son una base redactada como punto de partida: conviene que un/a abogado/a
// matriculado/a los revise antes de darlos por definitivos (ver docs/PROTECCION_LEGAL_Y_SEGURIDAD.md).

export const MARCA = 'Hipocampus';
export const TITULAR = 'Julian Oscar Mico';
export const ANIO_INICIO = 2026;
export const VIGENCIA = '14 de noviembre de 2026';
export const JURISDICCION = 'la Ciudad Autónoma de Buenos Aires';

export const titularTexto = () => (TITULAR ? `${TITULAR} («${MARCA}»)` : MARCA);

export function anios() {
  const actual = new Date().getFullYear();
  return actual > ANIO_INICIO ? `${ANIO_INICIO}–${actual}` : String(ANIO_INICIO);
}

export const avisoCopyright = () => `© ${anios()} ${TITULAR || MARCA}. Todos los derechos reservados.`;
