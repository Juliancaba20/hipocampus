import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import './globals.css';
import Nav from './Nav';
import Link from 'next/link';
import { GoogleTagManager } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/next';

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

// Google Tag Manager: solo se carga en producción, para que las visitas de desarrollo no ensucien las estadísticas.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-WGZJCV8X';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {process.env.NODE_ENV === 'production' && <GoogleTagManager gtmId={GTM_ID} />}
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
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
