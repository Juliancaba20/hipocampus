/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { agentUpgrade: 'security' },
  // Las fuentes de las historias de Instagram se leen del disco: hay que incluirlas en el despliegue.
  outputFileTracingIncludes: { '/api/frase-historia': ['./app/api/frase-historia/fuentes/**'] },
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
