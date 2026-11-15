/** @type {import('next').NextConfig} */

const enDesarrollo = process.env.NODE_ENV !== 'production';

// ---- Política de seguridad de contenido (CSP) ----
// Se publica en modo «solo informe» (Report-Only): el navegador NO bloquea nada, solo avisa en la consola
// (F12 > Consola) si algo incumpliera la política. Se prueba una semana navegando todo el sitio y las
// aplicaciones; si no aparecen avisos, se cambia MODO_CSP por 'Content-Security-Policy' para que se aplique.
const MODO_CSP = 'Content-Security-Policy-Report-Only';

const comun = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

// Sitio: Vercel Analytics.
const cspSitio = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com https://vitals.vercel-insights.com",
  ...comun,
].join('; ');

// Anotomía (/notas/app): trabaja con archivos locales, imágenes, PDF y un service worker.
const cspAnotomia = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com https://github.com",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "manifest-src 'self'",
  ...comun,
].join('; ');

// Cabeceras que sí se aplican de inmediato (no rompen nada).
const cabecerasBase = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig = {
  experimental: { agentUpgrade: 'security' },
  poweredByHeader: false, // no anunciar la tecnología del servidor
  // Las fuentes de las historias de Instagram se leen del disco: hay que incluirlas en el despliegue.
  outputFileTracingIncludes: { '/api/frase-historia': ['./app/api/frase-historia/fuentes/**'] },
  async headers() {
    return [
      { source: '/:path*', headers: [...cabecerasBase, { key: MODO_CSP, value: cspSitio }] },
      // Esta regla va después y reemplaza la CSP del sitio solo para Anotomía.
      { source: '/notas/app/:path*', headers: [{ key: MODO_CSP, value: cspAnotomia }] },
    ];
  },
  async redirects() {
    // Anotomía es una app estática en public/notas/app. Su dirección de entrada es index.html:
    // así el service worker y la instalación (alcance /notas/app/) funcionan siempre,
    // con o sin barra final.
    return [
      { source: '/notas/app', destination: '/notas/app/index.html', permanent: false },
    ];
  },
};

export default nextConfig;
