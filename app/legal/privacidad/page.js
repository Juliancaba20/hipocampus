import Link from 'next/link';
import Documento from '../Documento';
import { titularTexto } from '../../lib/legal';

export const metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos trata Hipocampus, para qué, con quién se comparten y cómo ejercer sus derechos.',
};

export default function Privacidad() {
  return (
    <Documento
      titulo="Política de privacidad"
      resumen="Qué datos se tratan, para qué, con quién se comparten y cómo puede ejercer sus derechos."
    >
      <h2>1. Responsable</h2>
      <p>
        El responsable del tratamiento de los datos personales descriptos en esta política es {titularTexto()} (en
        adelante, el «Titular»). Contacto: <Link href="/contacto">formulario de contacto</Link>. El tratamiento se rige por la
        Ley 25.326 de Protección de los Datos Personales, su decreto reglamentario y sus normas complementarias.
      </p>

      <h2>2. Lo esencial</h2>
      <ul>
        <li><strong>Anotomía y Teclado Científico no envían al Titular lo que usted escribe ni sus notas.</strong> Esos contenidos permanecen en su dispositivo.</li>
        <li>No hay cuentas, registro ni publicidad.</li>
        <li>El sitio mide visitas de forma agregada y sin cookies.</li>
        <li>Los únicos datos que usted entrega de forma voluntaria son los del formulario de contacto.</li>
      </ul>

      <h2>3. Qué datos se tratan y para qué</h2>
      <table>
        <thead>
          <tr><th>Situación</th><th>Datos</th><th>Finalidad</th><th>Quién los procesa</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Formulario de contacto</td>
            <td>Tipo de mensaje, texto y, si usted lo escribe, su correo electrónico</td>
            <td>Leer y responder su error, sugerencia o consulta</td>
            <td>Vercel (alojamiento) y Resend (envío del correo al Titular)</td>
          </tr>
          <tr>
            <td>Visita al sitio</td>
            <td>Dirección IP y datos técnicos del navegador, en registros de servidor</td>
            <td>Funcionamiento, seguridad y prevención de abusos</td>
            <td>Vercel</td>
          </tr>
          <tr>
            <td>Estadísticas de visitas</td>
            <td>Páginas vistas, país, tipo de dispositivo, sin identificar a la persona</td>
            <td>Saber qué herramientas se usan para mejorarlas</td>
            <td>Vercel Web Analytics</td>
          </tr>
          <tr>
            <td>Descarga y actualización de los programas</td>
            <td>Su dirección IP y datos técnicos del pedido, visibles para GitHub</td>
            <td>Ofrecer descargas y avisar de versiones nuevas</td>
            <td>GitHub</td>
          </tr>
        </tbody>
      </table>
      <p>
        Los datos se tratan sobre la base de su consentimiento (por ejemplo, al enviar el formulario) y del interés legítimo de mantener el sitio funcionando y seguro.
      </p>

      <h2>4. Estadísticas y cookies</h2>
      <p>
        El sitio utiliza Vercel Web Analytics, que mide las visitas de forma agregada y no usa cookies ni identifica a
        las personas. No se utilizan herramientas de publicidad ni de seguimiento de terceros.
      </p>

      <h2>5. Aplicaciones Anotomía y Teclado Científico</h2>
      <ul>
        <li>Las notas, imágenes y configuraciones de Anotomía se guardan solo en su dispositivo (en el navegador o en los archivos <code>.nota</code> que usted elija). No se suben a ningún servidor.</li>
        <li>El Teclado Científico no incluye estadísticas de uso ni envía a ningún servidor lo que usted escribe.</li>
        <li>Ambos programas se conectan a GitHub únicamente para buscar y descargar versiones nuevas. En esa conexión GitHub puede ver su dirección IP, conforme a su propia política de privacidad.</li>
      </ul>

      <h2>6. Transferencias internacionales y proveedores</h2>
      <p>
        Vercel, Resend y GitHub son empresas con servidores fuera de la Argentina, por lo que sus datos pueden
        ser tratados en otros países, incluso en algunos que no ofrecen un nivel de protección equivalente al
        argentino. Al enviar el formulario, usted presta su consentimiento para esa
        transferencia. El Titular no vende sus datos ni los cede para publicidad.
      </p>

      <h2>7. Conservación</h2>
      <p>
        Los mensajes del formulario se conservan mientras sean necesarios para atender su consulta y mejorar el sitio, y
        se eliminan a su pedido. Los datos técnicos y las estadísticas se conservan según las políticas de cada
        proveedor.
      </p>

      <h2>8. Sus derechos</h2>
      <p>
        Usted puede acceder a sus datos, y solicitar su rectificación, actualización o supresión (artículos 14 a 16 de la
        Ley 25.326), escribiendo por el <Link href="/contacto">formulario de contacto</Link> e indicando qué desea y,
        si quiere una respuesta, un correo donde recibirla. Se le responderá dentro de los plazos legales.
      </p>
      <p>
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso en forma gratuita a
        intervalos no inferiores a seis meses, salvo que acredite un interés legítimo, conforme al artículo 14,
        inciso 3, de la Ley 25.326. La Agencia de Acceso a la Información Pública, en su carácter de órgano de control
        de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan por el
        incumplimiento de las normas sobre protección de datos personales.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Se aplican medidas razonables de seguridad: conexión cifrada (HTTPS), claves protegidas en el servidor y
        acceso restringido a los mensajes recibidos. Ningún sistema es completamente inviolable, por lo que no
        puede garantizarse una seguridad absoluta.
      </p>

      <h2>10. Menores de edad</h2>
      <p>
        Los Servicios están pensados para estudiantes universitarios y no se dirigen a menores de 13 años. Si usted es
        madre, padre o tutor y cree que un menor envió datos, escríbanos y los eliminaremos.
      </p>

      <h2>11. Cambios en esta política</h2>
      <p>
        Esta política puede actualizarse. La fecha de la última actualización figura al comienzo de la página.
      </p>
    </Documento>
  );
}
