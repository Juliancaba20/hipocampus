import Link from 'next/link';
import Documento from '../Documento';
import { JURISDICCION, titularTexto } from '../../lib/legal';

export const metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de uso del sitio Hipocampus y de sus aplicaciones (Anotomía y Teclado Científico).',
};

export default function Terminos() {
  return (
    <Documento
      titulo="Términos y condiciones de uso"
      resumen="Reglas básicas para usar el sitio y las aplicaciones. Le pedimos que las lea antes de utilizarlos."
    >
      <h2>1. Quién ofrece estos servicios</h2>
      <p>
        El sitio web Hipocampus y las aplicaciones Anotomía y Teclado Científico (en adelante, los «Servicios») son
        ofrecidos por {titularTexto()} (en adelante, el «Titular»). Para comunicarse con el Titular utilice
        el <Link href="/contacto">formulario de contacto</Link>.
      </p>

      <h2>2. Aceptación</h2>
      <p>
        Al ingresar al sitio, instalar o abrir cualquiera de las aplicaciones, usted declara haber leído y aceptado estos
        términos y la <Link href="/legal/privacidad">Política de privacidad</Link>. Si no está de acuerdo, no use los
        Servicios.
      </p>

      <h2>3. Qué comprenden los Servicios</h2>
      <ul>
        <li>El sitio web con sus herramientas de estudio (métodos de estudio, cálculo de promedio y otras).</li>
        <li>Anotomía: aplicación de notas para estudiantes, disponible en el navegador y como programa para Windows, Mac, Linux y Android.</li>
        <li>Teclado Científico: teclado flotante de letras griegas y símbolos, para Windows, Mac y Linux.</li>
      </ul>
      <p>Los Servicios se ofrecen de forma gratuita y pueden cambiar, interrumpirse o dejar de ofrecerse en cualquier momento.</p>

      <h2>4. Licencia de uso</h2>
      <p>
        El Titular le otorga una licencia personal, gratuita, no exclusiva, intransferible y revocable para usar los
        Servicios con fines de estudio y uso personal. Esta licencia no implica la venta ni la cesión de ningún derecho
        de propiedad intelectual.
      </p>
      <p>Sin autorización previa y por escrito del Titular, usted no puede:</p>
      <ul>
        <li>copiar, reproducir, publicar o redistribuir los Servicios, su código, su diseño o sus contenidos, en forma total o parcial, ni ofrecer copias modificadas o con otro nombre;</li>
        <li>vender, alquilar, sublicenciar o utilizar los Servicios con fines comerciales;</li>
        <li>descompilar, desensamblar o intentar obtener el código fuente, salvo en la medida en que la ley argentina lo permita expresamente;</li>
        <li>eliminar o alterar los avisos de derechos de autor, las marcas o los nombres;</li>
        <li>extraer contenidos de forma masiva o automatizada, ni interferir con el funcionamiento o la seguridad de los Servicios;</li>
        <li>alojar los Servicios en otro sitio o presentarlos como propios.</li>
      </ul>
      <p>Queda a salvo la copia de resguardo y las demás facultades que la ley reconoce al usuario legítimo de un programa.</p>

      <h2>5. Propiedad intelectual</h2>
      <p>
        Los Servicios, incluidos su software (código fuente y programas compilados), diseño, textos, imágenes, nombres y
        logotipos, están protegidos por la Ley 11.723 de Propiedad Intelectual y por los tratados internacionales en
        la materia. Todos los derechos están reservados. Los nombres «Hipocampus», «Anotomía» y «Teclado Científico»,
        así como sus logotipos, son identificaciones propias del Titular. Los componentes de terceros se rigen por sus
        propias licencias, detalladas en <Link href="/legal/derechos-de-autor">Derechos de autor y licencias</Link>.
      </p>

      <h2>6. Sus notas y sus datos</h2>
      <p>
        Las notas que usted crea en Anotomía son suyas. Se guardan en su dispositivo (o en los archivos que usted
        elija) y el Titular no tiene acceso a ellas. Por eso <strong>usted es responsable de hacer copias de seguridad</strong>:
        el navegador, el sistema operativo o el dispositivo pueden borrar datos sin aviso, y el Titular no puede
        recuperarlos. Más información en la <Link href="/legal/privacidad">Política de privacidad</Link>.
      </p>
      <p>
        Usted declara tener derecho a usar los contenidos que incorpore a sus notas (imágenes, documentos PDF, textos) y
        se compromete a no usar los Servicios para infringir derechos de terceros.
      </p>

      <h2>7. Contenido educativo: no es asesoramiento médico</h2>
      <p>
        Los contenidos del sitio (por ejemplo, los métodos de estudio) y las herramientas tienen una finalidad
        exclusivamente educativa e informativa. No constituyen asesoramiento médico, diagnóstico ni tratamiento, y no
        reemplazan los textos oficiales de la carrera, a los docentes ni el criterio profesional. No los utilice para
        tomar decisiones sobre la salud de una persona.
      </p>

      <h2>8. Uso aceptable</h2>
      <p>
        Usted se compromete a usar los Servicios conforme a la ley y a estos términos, y a no enviar por el formulario de
        contacto contenidos ilícitos, ofensivos, publicitarios o malintencionados, ni datos sensibles de terceros.
      </p>

      <h2>9. Actualizaciones</h2>
      <p>
        Los programas de escritorio pueden buscar versiones nuevas al abrirse y ofrecer instalarlas. Para ello se
        conectan a GitHub, como se explica en la Política de privacidad. El Titular puede modificar, corregir o retirar
        funciones y versiones.
      </p>

      <h2>10. Sin garantías y limitación de responsabilidad</h2>
      <p>
        Los Servicios se ofrecen «tal como están», sin garantía de funcionamiento ininterrumpido, de ausencia de errores
        ni de adecuación a un fin particular. En la máxima medida que permita la ley, el Titular no responde por la
        pérdida de notas o archivos, por la interrupción del servicio, por errores en los contenidos ni por daños
        derivados del uso o de la imposibilidad de uso. Esto no limita los derechos irrenunciables que la
        legislación argentina pueda reconocerle.
      </p>

      <h2>11. Enlaces y servicios de terceros</h2>
      <p>
        El sitio enlaza a servicios de terceros (por ejemplo, Instagram, X o GitHub) y utiliza proveedores de
        infraestructura. El Titular no controla ni responde por sus contenidos, políticas o disponibilidad.
      </p>

      <h2>12. Reclamos por derechos de autor</h2>
      <p>
        Si considera que algún contenido de los Servicios infringe un derecho suyo, escriba por
        el <Link href="/contacto">formulario de contacto</Link> eligiendo «Otro motivo», indicando qué contenido es, su
        ubicación, y por qué entiende que lo infringe. Se analizará el reclamo y se responderá a la brevedad.
      </p>

      <h2>13. Cambios en estos términos</h2>
      <p>
        El Titular puede actualizar estos términos. La fecha de la última actualización figura al comienzo. El uso de
        los Servicios después de un cambio implica su aceptación.
      </p>

      <h2>14. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Para cualquier controversia, las partes se
        someten a los tribunales ordinarios de {JURISDICCION}, sin perjuicio de la competencia que la ley establezca
        de forma imperativa a su favor.
      </p>
    </Documento>
  );
}
