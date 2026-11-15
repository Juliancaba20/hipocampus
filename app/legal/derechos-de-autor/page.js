import Link from 'next/link';
import Documento from '../Documento';
import { avisoCopyright, titularTexto } from '../../lib/legal';

export const metadata = {
  title: 'Derechos de autor y licencias',
  description: 'Titularidad de los derechos de Hipocampus, Anotomía y Teclado Científico, y licencias de los componentes de terceros.',
};

const TERCEROS = [
  ['Next.js, React, Vite', 'Sitio web y Anotomía', 'MIT'],
  ['PDF.js (pdfjs-dist)', 'Lectura de PDF en Anotomía', 'Apache-2.0'],
  ['jsPDF', 'Exportación a PDF en Anotomía', 'MIT'],
  ['Tauri y sus complementos', 'Programas de escritorio y Android de Anotomía', 'MIT o Apache-2.0'],
  ['sharp', 'Generación de imágenes en el servidor', 'Apache-2.0'],
  ['@vercel/analytics', 'Estadísticas del sitio', 'MPL-2.0'],
  ['Bricolage Grotesque (tipografía)', 'Sitio, Anotomía e imágenes', 'SIL Open Font License 1.1'],
  ['Source Serif 4 (tipografía)', 'Sitio, Anotomía e imágenes', 'SIL Open Font License 1.1'],
  ['Tabler Icons (algunos íconos)', 'Anotomía', 'MIT'],
  ['pynput y python-xlib', 'Teclado Científico para Mac y Linux', 'LGPL-3.0 y LGPL-2.1 o posterior'],
  ['Python (Tkinter) y PyInstaller', 'Teclado Científico', 'Licencia PSF; GPL-2.0 con excepción para los programas generados'],
];

export default function DerechosDeAutor() {
  return (
    <Documento
      titulo="Derechos de autor y licencias"
      resumen="Quién es titular de qué, qué puede y qué no puede hacer con los Servicios, y qué componentes de terceros se utilizan."
    >
      <h2>1. Titularidad</h2>
      <p>{avisoCopyright()}</p>
      <p>
        El software de Hipocampus, Anotomía y Teclado Científico —en su código fuente y en sus programas
        compilados—, el diseño, los textos propios, las imágenes y los logotipos son obra de {titularTexto()} y
        están protegidos por la Ley 11.723 de Propiedad Intelectual y por los convenios internacionales de los que la
        República Argentina es parte. La protección rige desde la creación de la obra, sin necesidad de registro ni de
        un aviso expreso.
      </p>

      <h2>2. Qué puede hacer</h2>
      <ul>
        <li>Usar el sitio y las aplicaciones para estudiar y para uso personal, sin costo.</li>
        <li>Instalar los programas en sus propios dispositivos y hacer una copia de resguardo.</li>
        <li>Imprimir o exportar sus propias notas, y compartirlas libremente: son suyas.</li>
        <li>Enlazar al sitio y compartir su dirección.</li>
      </ul>

      <h2>3. Qué no puede hacer sin autorización escrita</h2>
      <ul>
        <li>Copiar, republicar o redistribuir el sitio, las aplicaciones, su código o su diseño, aunque se cambien nombres, colores o textos.</li>
        <li>Ofrecer versiones modificadas o derivadas, o presentarlas como propias.</li>
        <li>Usar los Servicios o sus contenidos con fines comerciales.</li>
        <li>Quitar avisos de derechos de autor o nombres.</li>
      </ul>
      <p>
        La disponibilidad pública de un archivo o de un repositorio de código no implica licencia para copiarlo ni
        reutilizarlo. Para solicitar una autorización, escriba por el <Link href="/contacto">formulario de contacto</Link> (opción «Otro motivo»).
      </p>

      <h2>4. Marcas y nombres</h2>
      <p>
        «Hipocampus», «Anotomía», «Teclado Científico» y sus logotipos son identificaciones propias del Titular. Su uso por
        terceros requiere autorización escrita.
      </p>

      <h2>5. Componentes de terceros</h2>
      <p>
        Los Servicios incluyen software y recursos de terceros que se rigen por sus propias licencias, las cuales
        siguen vigentes y no se ven modificadas por estos avisos. Se reconoce a sus autores:
      </p>
      <table>
        <thead>
          <tr><th>Componente</th><th>Uso</th><th>Licencia</th></tr>
        </thead>
        <tbody>
          {TERCEROS.map(([nombre, uso, licencia]) => (
            <tr key={nombre}><td>{nombre}</td><td>{uso}</td><td>{licencia}</td></tr>
          ))}
        </tbody>
      </table>
      <p>
        El texto completo de estas licencias está disponible en los paquetes originales de cada componente y en el
        archivo <code>THIRD_PARTY_NOTICES.md</code> que acompaña a los programas.
      </p>

      <h2>6. Contenidos de terceros</h2>
      <ul>
        <li>Las frases del día son citas breves de autores clásicos, con indicación de su origen.</li>
        <li>Los resúmenes de métodos de estudio son de elaboración propia y citan, con enlace, las publicaciones científicas en las que se basan; esas obras pertenecen a sus autores y editoriales.</li>
        <li>Los documentos, imágenes y textos que usted incorpore a sus notas son de su responsabilidad.</li>
      </ul>

      <h2>7. Reclamos</h2>
      <p>
        Si cree que algún contenido infringe un derecho suyo, consulte la cláusula 12 de los{' '}
        <Link href="/legal/terminos">Términos y condiciones</Link> para saber cómo informarlo.
      </p>
    </Documento>
  );
}
