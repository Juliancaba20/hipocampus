import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Tipografías de la web, autoalojadas (funcionan sin conexión)
import './estilos/tipografias.css';
import './estilos/variables.css';
import './estilos/tema.css';
import './estilos/biblioteca.css';
import './estilos/editor.css';
import './estilos/impresion.css';
import App from './app/App.jsx';
import { iniciarPWA } from './pwa/pwa.js';

iniciarPWA();

// El texto de las notas se dibuja en un canvas: se piden las tipografías de antemano para que estén listas
// al abrir un documento (cuando terminan de cargar, el lienzo vuelve a medir y a dibujar).
if (typeof document !== 'undefined' && document.fonts?.load) {
  [
    '400 20px "Source Serif 4 Variable"',
    'italic 400 20px "Source Serif 4 Variable"',
    '700 20px "Source Serif 4 Variable"',
    '400 20px "Bricolage Grotesque Variable"',
    '700 20px "Bricolage Grotesque Variable"',
  ].forEach((f) => document.fonts.load(f).catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
