// Lógica sin pantalla del teclado (se prueba con Node: `node --test ui/pruebas/*.test.js`).
(function (raiz) {
  'use strict';

  function entero(v) {
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
  }

  // Transparencia entre el mínimo y 1, con dos decimales (0,96 -> 96 %).
  function limitarAlpha(valor, datos) {
    const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : datos.alphaPredeterminada;
    return Math.round(Math.min(1, Math.max(datos.alphaMinima, n)) * 100) / 100;
  }

  function simbolosValidos(datos) {
    return new Set(Object.values(datos.paginas).flat());
  }

  // Deja solo símbolos que existen, sin repetidos y como máximo `maxRecientes`.
  function normalizarRecientes(lista, datos) {
    if (!Array.isArray(lista)) return [];
    const validos = simbolosValidos(datos);
    const salida = [];
    for (const s of lista) {
      if (typeof s === 'string' && validos.has(s) && !salida.includes(s)) salida.push(s);
    }
    return salida.slice(0, datos.maxRecientes);
  }

  // El último usado pasa al principio.
  function agregarReciente(lista, simbolo, datos) {
    return [simbolo, ...lista.filter((s) => s !== simbolo)].slice(0, datos.maxRecientes);
  }

  // «ctrl+alt+g» -> «Ctrl+Alt+G» (para mostrar).
  function textoAtajo(texto) {
    if (typeof texto !== 'string' || !texto.includes('+')) return '';
    return texto
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
      .join('+');
  }

  function conPunto(simbolo, datos) {
    return simbolo.length === 2 && simbolo[1] === datos.punto;
  }

  // Convierte lo que haya en el archivo de configuración (que puede venir de la versión de
  // Python, de una futura o estar dañado) en un estado válido.
  function normalizarConfig(cruda, datos) {
    const c = cruda && typeof cruda === 'object' && !Array.isArray(cruda) ? cruda : {};
    return {
      tema: c.tema in datos.temas ? c.tema : datos.temaPredeterminado,
      tamano: c.tamano in datos.tamanos ? c.tamano : datos.tamanoPredeterminado,
      alpha: limitarAlpha(c.alpha, datos),
      nombres: typeof c.nombres === 'boolean' ? c.nombres : true,
      arriba: typeof c.arriba === 'boolean' ? c.arriba : true,
      compacto: typeof c.compacto === 'boolean' ? c.compacto : false,
      pagina: c.pagina in datos.paginas ? c.pagina : Object.keys(datos.paginas)[0],
      recientes: normalizarRecientes(c.recientes, datos),
      atajo: typeof c.atajo === 'string' && c.atajo ? c.atajo : datos.atajoPredeterminado,
      x: entero(c.x),
      y: entero(c.y),
    };
  }

  // ¿El punto (x, y) cae dentro de alguna pantalla? Cada pantalla: {x, y, ancho, alto}.
  function dentroDePantallas(x, y, pantallas) {
    return pantallas.some((p) => x >= p.x && y >= p.y && x < p.x + p.ancho && y < p.y + p.alto);
  }

  // Mantiene el teclado (x, y, ancho, alto, en píxeles de pantalla) dentro de la pantalla en la
  // que está su centro; si el centro quedó fuera de todas, usa la más cercana. Puede quedar
  // pegado a cualquier borde, pero nunca con una parte fuera. Devuelve {x, y}.
  function ajustarADentro(caja, pantallas) {
    if (!pantallas.length) return { x: caja.x, y: caja.y };
    const cx = caja.x + caja.ancho / 2, cy = caja.y + caja.alto / 2;
    let elegida = pantallas.find((p) => cx >= p.x && cy >= p.y && cx < p.x + p.ancho && cy < p.y + p.alto);
    if (!elegida) {
      const distancia = (p) => {
        const dx = Math.max(p.x - cx, 0, cx - (p.x + p.ancho)), dy = Math.max(p.y - cy, 0, cy - (p.y + p.alto));
        return dx * dx + dy * dy;
      };
      elegida = pantallas.reduce((a, b) => (distancia(b) < distancia(a) ? b : a));
    }
    const limite = (valor, minimo, tamano, espacio) =>
      espacio >= tamano ? Math.min(Math.max(valor, minimo), minimo + espacio - tamano) : minimo;
    return { x: limite(caja.x, elegida.x, caja.ancho, elegida.ancho),
             y: limite(caja.y, elegida.y, caja.alto, elegida.alto) };
  }

  // Cola para animaciones que no deben pisarse: ejecuta de a una; si llegan pedidos mientras
  // una está en curso, la que está en curso TERMINA y después se hace solo el último pedido.
  // Devuelve una promesa que se cumple cuando ya no queda nada pendiente.
  function crearCola(ejecutar) {
    let activa = false, hay = false, ultimo;
    async function pedir(valor) {
      if (activa) { ultimo = valor; hay = true; return; }
      activa = true;
      try { await ejecutar(valor); } catch (_) { /* un fallo no bloquea los siguientes */ } finally { activa = false; }
      if (hay) { const siguiente = ultimo; hay = false; ultimo = undefined; await pedir(siguiente); }
    }
    return pedir;
  }

  const api = { limitarAlpha, normalizarRecientes, agregarReciente, textoAtajo, conPunto,
                normalizarConfig, dentroDePantallas, ajustarADentro, crearCola, simbolosValidos };
  if (typeof module !== 'undefined') module.exports = api;
  else raiz.Logica = api;
})(typeof window !== 'undefined' ? window : globalThis);
