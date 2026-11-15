// Indicaciones para buscadores: no indexar las rutas internas de la API.
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
  };
}
