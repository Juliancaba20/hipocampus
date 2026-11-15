import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import './globals.css';
import Nav from './Nav';
import Link from 'next/link';
import { Analytics } from '@vercel/analytics/next';
import { avisoCopyright } from './lib/legal';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hipocampus.vercel.app'),
  title: { default: 'Hipocampus', template: '%s | Hipocampus' },
  description: 'Recursos de estudio pensados para estudiantes de medicina.',
  openGraph: {
    siteName: 'Hipocampus',
    title: 'Hipocampus',
    description: 'Recursos de estudio pensados para estudiantes de medicina.',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', colorScheme: 'light', themeColor: '#0f766e' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <a className="skip" href="#contenido">Saltar al contenido</a>
        <div className="wrap">
          <Nav />
          <div id="contenido">{children}</div>
          <footer>
            <p>Hecho por un estudiante de medicina, para estudiantes. ¿Encontró un error o tiene una sugerencia? <Link href="/contacto">Infórmelo aquí</Link>.</p>
            <nav className="redes-sociales" aria-label="Redes sociales">
              <a href="https://www.instagram.com/hipocampus.web/" target="_blank" rel="noopener noreferrer">Instagram: @hipocampus.web</a>
              <a href="https://x.com/Hipocampusweb" target="_blank" rel="noopener noreferrer">X: @Hipocampusweb</a>
            </nav>
            <nav className="legal-links" aria-label="Información legal">
              <Link href="/legal/terminos">Términos y condiciones</Link> · <Link href="/legal/privacidad">Política de privacidad</Link> · <Link href="/legal/derechos-de-autor">Derechos de autor y licencias</Link>
            </nav>
            <p className="legal-links">{avisoCopyright()}</p>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
