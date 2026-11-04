import Link from 'next/link';
import Descargas from './Descargas';
import { urlRepo } from './config';

export const viewport = { themeColor: '#b8351f' };

export const metadata = {
  title: 'Teclado Científico',
  description: 'Teclado flotante para escribir letras griegas y símbolos científicos (subíndices, flechas, química y medicina) con un clic en sus resúmenes. Windows, Mac y Linux.',
  openGraph: {
    title: 'Teclado Científico',
    description: 'Un teclado flotante para escribir letras griegas y símbolos en sus resúmenes: clic en el símbolo y se escribe donde esté el cursor. Disponible para Windows, Mac y Linux.',
    locale: 'es_AR',
    type: 'website',
    images: [{ url: '/teclado/vista-previa.png', width: 1200, height: 630, alt: 'Teclado Científico: letras α β γ Δ μ y una vista del teclado flotante con sus pestañas, el botón de configuración y la fila de símbolos recientes' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function Teclado() {
  return (
    <main className="page" data-tema="teclado">
      <header className="top">
        <h1>Teclado Científico</h1>
        <p className="sub">Un teclado flotante y de tamaño reducido que queda visible sobre otras aplicaciones. Haga clic en una letra o un símbolo y se escribe donde esté el cursor, sin copiar ni pegar.</p>
      </header>

      <figure className="vista">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/teclado/captura-teclado.gif"
          width="629"
          height="306"
          alt="Vista del teclado en varios colores: una barra con las pestañas α, Α, ±, H₂ y ∫, el botón de configuración ⚙, una fila de símbolos usados recientemente y la cuadrícula de letras y símbolos. Al pasar el mouse sobre un símbolo, la barra muestra su nombre."
        />
        <figcaption className="mut">Así se ve, en distintos colores. Captura en Linux; en Windows y Mac la tipografía cambia levemente.</figcaption>
      </figure>

      <figure className="vista">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/teclado/captura-configuracion.png"
          width="629"
          height="514"
          alt="Panel de configuración del teclado: color (seis temas), tamaño de teclas, transparencia, mostrar nombres, siempre encima, buscar actualizaciones, atajo y restablecer."
        />
        <figcaption className="mut">El botón ⚙ abre la configuración: color, tamaño de las teclas, transparencia y más.</figcaption>
      </figure>

      <section className="src" style={{ paddingTop: '2rem' }}>
        <h2 className="t" style={{ marginTop: 0 }}>Descarga</h2>
        <p className="aviso-movil" role="note"><b>Este programa es para computadoras</b> (Windows, Mac o Linux). Si está en un celular o una tablet, abra esta página desde su computadora para descargarlo.</p>
      </section>

      <Descargas />


      <div className="dos-col">
        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>Cómo se usa</h2>
          <ol>
            <li>Abra el programa: aparece una barra pequeña que queda siempre visible.</li>
            <li>Haga clic en su documento y deje el cursor donde quiere escribir.</li>
            <li>Haga clic en una letra del teclado. Las pestañas α, Α, ±, H₂ y ∫ cambian entre minúsculas, mayúsculas, símbolos, química o medicina (subíndices, superíndices, ⇌, ∑, ∝) y fisiología (V̇, Q̇, ∫, ∂).</li>
            <li>El botón ⚙ abre la configuración: puede elegir el color del teclado, el tamaño de las teclas, la transparencia y si el teclado queda siempre encima.</li>
            <li>Pase el mouse sobre un símbolo para ver su nombre. La fila de arriba repite los últimos que usó.</li>
          </ol>
          <p className="mut">El botón ▴ reduce el teclado a una sola fila. La configuración se guarda sola. En Windows y en Linux con X11, <code>Ctrl+Alt+G</code> lo oculta y lo vuelve a mostrar.</p>
        </section>

        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>La primera vez</h2>
          <details>
            <summary>Windows</summary>
            <p>Puede aparecer "Windows protegió su PC". Elija <em>Más información</em> y luego <em>Ejecutar de todas formas</em>. El programa no tiene firma digital, por eso Windows avisa, pero no instala nada ni se conecta a internet. Algunos antivirus pueden advertir lo mismo por esa razón.</p>
          </details>
          <details>
            <summary>Mac (macOS Sequoia o posterior)</summary>
            <ol>
              <li>Descomprima el .zip y mueva la aplicación a la carpeta Aplicaciones.</li>
              <li>Ábrala con doble clic. macOS mostrará un aviso de que no pudo verificarla: ciérrelo.</li>
              <li>Abra Ajustes del Sistema &gt; Privacidad y seguridad, baje hasta la sección <em>Seguridad</em> y pulse <em>Abrir igualmente</em>. Confirme con su contraseña o Touch ID.</li>
              <li>En Privacidad y seguridad &gt; Accesibilidad, active la aplicación para que pueda escribir en otros programas.</li>
            </ol>
            <p>En macOS 14 o anterior también sirve hacer clic derecho sobre la aplicación y elegir <em>Abrir</em>. Versión en prueba.</p>
          </details>
          <details>
            <summary>Linux</summary>
            <p>Descomprima el archivo con <code>tar -xzf TecladoCientifico-Linux.tar.gz</code> y ejecute <code>./TecladoCientifico</code>. Funciona en entornos con X11; en Wayland puede no escribir (el programa avisa). Versión en prueba.</p>
          </details>
        </section>
      </div>

      <section className="src" style={{ paddingTop: '2rem' }}>
        <p>El teclado funciona sin conexión a internet.</p>
        <Link className="btn" href="/contacto">Informar un problema</Link>
        <a className="btn" href={`${urlRepo}/releases`}>Todas las versiones</a>
      </section>
    </main>
  );
}
