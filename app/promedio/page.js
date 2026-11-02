import Link from 'next/link';
import Calculadora from './Calculadora';
import { CARRERAS } from './carreras';

export const viewport = { themeColor: '#15803d' };

export const metadata = {
  title: 'Calculadora de promedio',
  description: 'Cargue las notas de sus materias y calcule el promedio de su carrera. Disponible para Medicina (UBA); habrá más carreras próximamente.',
};

export default function Promedio() {
  const medicina = CARRERAS[0];
  return (
    <main className="page" data-tema="promedio">
      <header className="top">
        <h1>Calculadora de promedio</h1>
        <p className="sub">Cargue las notas de cada materia y vea el promedio de su carrera al instante. Sin cuentas: sus notas quedan guardadas solo en su navegador.</p>
      </header>

      <Calculadora />

      <div className="dos-col" style={{ paddingTop: '1rem' }}>
        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>Cómo se calcula</h2>
          <ul className="pm-reglas">
            <li>Se promedian <b>todas las notas cargadas</b>, aprobadas o no: una nota menor a 4 también cuenta.</li>
            <li>Una materia sin notas se considera <b>no finalizada</b> y no entra en el promedio.</li>
            <li>Si rindió una materia más de una vez, cargue cada nota con «+ Otra nota».</li>
            <li>En una materia <b>promocionada</b>, escriba el promedio de los parciales: es su nota final.</li>
            <li>El <b>CBC</b> y el <b>curso de inglés</b> vienen desactivados: se suman solo si usted lo elige.</li>
          </ul>
        </section>
        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>Sobre los datos</h2>
          <p>El resultado es orientativo: la facultad puede redondear o contar las notas de otra manera, y esta página no reemplaza al certificado analítico oficial.</p>
          <p>Plan cargado para Medicina (UBA): {medicina.plan} Se armó con lo que publica la Facultad y con otras fuentes, y puede tener diferencias con el suyo: si falta o sobra una materia, agréguela o déjela sin notas, y <Link href="/contacto">avísenos aquí</Link>.</p>
          <p className="mut">Fuente: <a href={medicina.fuente.url}>{medicina.fuente.texto}</a>.</p>
        </section>
      </div>
    </main>
  );
}
