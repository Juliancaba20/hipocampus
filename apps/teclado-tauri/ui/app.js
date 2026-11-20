// Teclado Científico (versión Tauri): pantalla. La lógica sin pantalla está en logica.js.
(function () {
  'use strict';

  const VERSION = '2.0.0';
  // Espacio transparente alrededor del teclado (sombra). Se lee de estilos.css para tener un solo valor.
  const px = (nombre) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nombre)) || 0;
  let M = { izq: 14, der: 14, sup: 0, inf: 24 };
  const reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const puedeAnimar = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function' && !reducirMovimiento;
  const T = window.__TAURI__ || null;
  const invocar = T ? T.core.invoke : () => Promise.reject(new Error('Fuera de Tauri'));
  const ventana = T ? T.window.getCurrentWindow() : null;
  const D = DATOS;
  const L = Logica;

  // Los errores de la pantalla se anotan en diagnostico.log (junto a config.json).
  function informar(mensaje) { try { invocar('registrar_error', { mensaje: String(mensaje) }).catch(() => {}); } catch (_) {} }
  window.addEventListener('error', (e) => informar(`${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => informar('promesa rechazada: ' + (e.reason && e.reason.message || e.reason)));

  const $ = (id) => document.getElementById(id);
  const raiz = document.documentElement;
  const el = {
    ventana: $('ventana'), pestanas: $('pestanas'), indicador: $('indicador'), nombre: $('nombre'),
    recientes: $('recientes'), cuadricula: $('cuadricula'), config: $('config'), aviso: $('aviso'),
    compacto: $('b-compacto'), iconoCompacto: $('icono-compacto'),
  };

  let estado = L.normalizarConfig({}, D);
  let info = { plataforma: 'windows', inicio: false, bandeja: false };
  let temaVisible = null;  // tema que se está mostrando (puede ir detrás de estado.tema mientras corre un barrido)
  let enConfig = false;
  let escala = 1;
  const teclas = [];       // botones de la cuadrícula (se reutilizan; nunca se vuelven a crear)
  const slots = [];        // botones de recientes
  const refs = {};         // controles del panel de configuración

  // ---------- utilidades ----------
  const crear = (etiqueta, atributos = {}, texto) => {
    const nodo = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(atributos)) nodo.setAttribute(k, v);
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  };

  let temporizadorAviso = null;
  function avisar(texto, segundos = 5) {
    el.aviso.textContent = texto;
    el.aviso.classList.add('visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => el.aviso.classList.remove('visible'), segundos * 1000);
  }

  function mostrarNombre(texto) {
    el.nombre.textContent = texto && estado.nombres ? texto : '';
  }

  // ---------- guardado (junta varios cambios seguidos en una sola escritura) ----------
  let temporizadorGuardado = null;
  function guardar() {
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = setTimeout(() => {
      const cambios = {
        version: VERSION, pagina: estado.pagina, recientes: estado.recientes, compacto: estado.compacto,
        tema: estado.tema, tamano: estado.tamano, alpha: estado.alpha, nombres: estado.nombres,
        arriba: estado.arriba, atajo: estado.atajo,
      };
      if (estado.x !== null && estado.y !== null) { cambios.x = estado.x; cambios.y = estado.y; }
      invocar('guardar_config', { cambios }).catch(() => {});
    }, 300);
  }

  // ---------- aspecto ----------
  function poner(nodo, tema) {
    for (const [clave, valor] of Object.entries(D.temas[tema])) nodo.style.setProperty('--' + clave.replace('_', '-'), valor);
  }
  function aplicarTema() {
    poner(raiz, estado.tema);
    temaVisible = estado.tema;
  }

  // Cambio de color con un barrido de izquierda a derecha. El teclado nuevo ya está debajo, con
  // todo en uso; encima corre una copia con los colores anteriores que se va descubriendo. La
  // copia no recibe clics y no cambia nada: si se toca una tecla en medio del barrido, se escribe
  // y se anima igual. Si se elige otro color mientras corre, este termina y luego se hace el último.
  function barrerA(tema) {
    if (tema === temaVisible) return Promise.resolve();
    const anterior = temaVisible;
    if (!puedeAnimar || el.ventana.classList.contains('oculta')) {
      poner(raiz, tema); temaVisible = tema;
      return Promise.resolve();
    }
    const caja = el.ventana.getBoundingClientRect();
    const capa = document.createElement('div');
    capa.id = 'barrido';
    capa.setAttribute('aria-hidden', 'true');
    capa.style.width = caja.width + 'px';
    capa.style.height = caja.height + 'px';
    const copia = el.ventana.cloneNode(true);   // conserva los id: así hereda todos los estilos
    copia.classList.add('ventana-anterior');
    copia.style.width = caja.width + 'px';
    poner(copia, anterior);                     // colores viejos, fijos en esta copia
    const linea = document.createElement('div');
    linea.className = 'linea';
    capa.append(copia, linea);
    document.body.append(capa);                 // misma tarea que el cambio de abajo: no hay un cuadro intermedio
    poner(raiz, tema);
    temaVisible = tema;

    const opciones = { duration: 380, easing: 'cubic-bezier(.5, .05, .25, 1)', fill: 'forwards' };
    try {
      const a = copia.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: `inset(0 0 0 ${caja.width}px)` }], opciones);
      linea.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${caja.width + 32}px)` }], opciones);
      return a.finished.catch(() => {}).then(() => capa.remove());
    } catch (e) {
      informar('barrido: ' + e.message);
      capa.remove();
      return Promise.resolve();
    }
  }
  const pedirTema = L.crearCola(barrerA);
  function aplicarTamano() {
    const m = D.tamanos[estado.tamano];
    raiz.style.setProperty('--ancho', m.ancho + 'px');
    raiz.style.setProperty('--alto', m.alto + 'px');
    raiz.style.setProperty('--letra', m.letra + 'px');
  }
  function aplicarAlpha() { raiz.style.setProperty('--alpha', String(estado.alpha)); }

  // ---------- teclas ----------
  // ---------- animaciones (todas en transform/opacidad: no tocan los colores del tema) ----------
  const SUAVE = 'cubic-bezier(.2, .8, .3, 1)';
  function pulso(boton) {
    if (!puedeAnimar) return;
    boton.animate([{ transform: 'scale(1)' }, { transform: 'scale(.88)', offset: 0.3 }, { transform: 'scale(1)' }],
                  { duration: 260, easing: SUAVE });
    try {
      boton.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 340, easing: 'ease-out', pseudoElement: '::after' });
    } catch (_) { /* sin destello en motores que no lo admiten */ }
  }
  function entradaDePagina() {
    if (!puedeAnimar) return;
    const columnas = D.columnas;
    teclas.forEach((b, i) => {
      if (b.hidden) return;
      b.animate([{ opacity: 0, transform: 'translateY(7px) scale(.9)' }, { opacity: 1, transform: 'none' }],
                { duration: 220, delay: (i % columnas) * 14, easing: SUAVE, fill: 'backwards' });
    });
  }
  // Los recientes que cambian de lugar se deslizan; el nuevo aparece con un pequeño rebote.
  function animarRecientes(antes) {
    if (!puedeAnimar) return;
    const paso = slots.length > 1 ? slots[1].offsetLeft - slots[0].offsetLeft : 0;
    slots.forEach((b, i) => {
      const s = estado.recientes[i];
      if (!s || antes[i] === s) return;
      const desde = antes.indexOf(s);
      if (desde === -1) {
        b.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
                  { duration: 300, easing: SUAVE });
      } else {
        b.animate([{ transform: `translateX(${(desde - i) * paso}px)` }, { transform: 'none' }], { duration: 240, easing: SUAVE });
      }
    });
  }

  function pintarTecla(boton, simbolo) {
    boton.dataset.simbolo = simbolo || '';
    boton.classList.remove('vacia');
    boton.hidden = false;
    boton.textContent = '';
    if (!simbolo) return;
    if (L.conPunto(simbolo, D)) {
      const base = simbolo[0];
      boton.append(crear('span', { class: 'letra-punto' + (base === base.toLowerCase() ? ' minuscula' : '') }, base));
    } else {
      boton.textContent = simbolo;
    }
    boton.setAttribute('aria-label', D.nombres[simbolo] || simbolo);
  }

  function construirTeclas() {
    const maximo = Math.max(...Object.values(D.paginas).map((p) => p.length));
    for (let i = 0; i < maximo; i++) {
      const b = crear('button', { type: 'button', class: 'tecla', tabindex: '-1' });
      el.cuadricula.append(b);
      teclas.push(b);
    }
    for (let i = 0; i < D.maxRecientes; i++) {
      const b = crear('button', { type: 'button', class: 'tecla reciente vacia', tabindex: '-1' });
      el.recientes.append(b);
      slots.push(b);
    }
  }

  // Cambiar de pestaña o de recientes solo cambia el texto de botones que ya existen.
  function pintarPagina() {
    const lista = D.paginas[estado.pagina];
    teclas.forEach((b, i) => {
      if (i < lista.length) pintarTecla(b, lista[i]);
      else { b.hidden = true; b.dataset.simbolo = ''; }
    });
    for (const b of el.pestanas.querySelectorAll('button')) {
      b.setAttribute('aria-selected', String(b.dataset.pagina === estado.pagina));
    }
    moverIndicador();
  }
  function pintarRecientes() {
    slots.forEach((b, i) => {
      const s = estado.recientes[i];
      if (s) { pintarTecla(b, s); } else {
        b.dataset.simbolo = ''; b.textContent = ''; b.classList.add('vacia'); b.removeAttribute('aria-label');
      }
    });
  }
  function moverIndicador() {
    const activa = el.pestanas.querySelector('button[aria-selected="true"]');
    if (!activa) return;
    el.indicador.style.width = activa.offsetWidth - 14 + 'px';
    el.indicador.style.transform = `translateX(${activa.offsetLeft + 7}px)`;
  }

  function construirPestanas() {
    for (const pagina of Object.keys(D.paginas)) {
      const b = crear('button', { type: 'button', role: 'tab', tabindex: '-1', 'data-pagina': pagina }, pagina);
      b.addEventListener('click', () => {
        if (estado.pagina === pagina) return;
        estado.pagina = pagina; pintarPagina(); entradaDePagina(); guardar();
      });
      b.addEventListener('pointerenter', () => mostrarNombre(''));
      el.pestanas.append(b);
    }
  }

  // ---------- escribir ----------
  async function escribirSimbolo(simbolo) {
    if (!simbolo) return;
    const antes = estado.recientes;
    estado.recientes = L.agregarReciente(estado.recientes, simbolo, D);
    pintarRecientes();
    animarRecientes(antes);
    guardar();
    try {
      await invocar('escribir', { texto: simbolo });
    } catch (e) {
      try {
        await invocar('copiar', { texto: simbolo });
        avisar(`No se pudo escribir directamente; ${simbolo} quedó copiado: péguelo con Ctrl+V.`, 6);
      } catch (_) {
        avisar('No se pudo escribir el símbolo en el otro programa.', 6);
      }
    }
  }

  function engancharTeclas(contenedor) {
    contenedor.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.tecla');
      if (b && b.dataset.simbolo) pulso(b);
    });
    contenedor.addEventListener('click', (e) => {
      const b = e.target.closest('.tecla');
      if (b && b.dataset.simbolo) escribirSimbolo(b.dataset.simbolo);
    });
    contenedor.addEventListener('pointerover', (e) => {
      const b = e.target.closest('.tecla');
      if (b) mostrarNombre(b.dataset.simbolo ? D.nombres[b.dataset.simbolo] : '');
    });
    contenedor.addEventListener('pointerleave', () => mostrarNombre(''));
  }

  // ---------- configuración ----------
  function fila(titulo, controles, claseTitulo) {
    const f = crear('div', { class: 'fila' });
    f.append(crear('span', claseTitulo ? { class: claseTitulo } : {}, titulo));
    const c = crear('div', { class: 'control' });
    c.append(...controles);
    f.append(c);
    el.config.append(f);
    return f;
  }
  function interruptor(clave, alAlternar) {
    const b = crear('button', { type: 'button', role: 'switch', class: 'interruptor', tabindex: '-1', 'aria-checked': 'false' });
    b.addEventListener('click', alAlternar);
    refs[clave] = b;
    return b;
  }

  function construirConfig() {
    refs.muestras = {};
    for (const nombre of Object.keys(D.temas)) {
      const b = crear('button', { type: 'button', class: 'muestra', tabindex: '-1', 'aria-label': nombre, title: nombre });
      b.style.background = D.temas[nombre].acento;
      b.addEventListener('click', () => { estado.tema = nombre; sincronizarConfig(); guardar(); pedirTema(nombre); });
      refs.muestras[nombre] = b;
    }
    fila('Color', Object.values(refs.muestras));

    refs.tamanos = {};
    for (const nombre of Object.keys(D.tamanos)) {
      const b = crear('button', { type: 'button', class: 'opcion', tabindex: '-1', 'aria-pressed': 'false' }, nombre);
      b.addEventListener('click', () => { estado.tamano = nombre; aplicarTamano(); sincronizarConfig(); guardar(); });
      refs.tamanos[nombre] = b;
    }
    fila('Tamaño de teclas', Object.values(refs.tamanos));

    const menos = crear('button', { type: 'button', class: 'opcion paso', tabindex: '-1', 'aria-label': 'Menos transparencia' }, '−');
    const mas = crear('button', { type: 'button', class: 'opcion paso', tabindex: '-1', 'aria-label': 'Más opacidad' }, '+');
    refs.alpha = crear('span', { id: 'valor-alpha' });
    menos.addEventListener('click', () => cambiarAlpha(-0.05));
    mas.addEventListener('click', () => cambiarAlpha(0.05));
    fila('Transparencia', [menos, refs.alpha, mas]);

    fila('Mostrar nombres', [interruptor('nombres', () => { estado.nombres = !estado.nombres; sincronizarConfig(); guardar(); })]);
    fila('Siempre encima', [interruptor('arriba', alternarArriba)]);
    fila('Abrir al iniciar el sistema', [interruptor('inicio', alternarInicio)]);
    refs.atajo = crear('span', { class: 'secundario' });
    fila('Atajo', [refs.atajo]);
    const restablecer = crear('button', { type: 'button', class: 'opcion', tabindex: '-1' }, 'Valores originales');
    restablecer.addEventListener('click', restablecerTodo);
    fila('Restablecer', [restablecer]);
    el.config.append(crear('div', { class: 'pie' }, `Versión ${VERSION} (prueba) · motor Tauri`));
  }

  // Refleja el estado en los controles ya creados (no se vuelve a crear nada).
  function sincronizarConfig() {
    for (const [n, b] of Object.entries(refs.muestras)) b.setAttribute('aria-pressed', String(n === estado.tema));
    for (const [n, b] of Object.entries(refs.tamanos)) b.setAttribute('aria-pressed', String(n === estado.tamano));
    refs.alpha.textContent = Math.round(estado.alpha * 100) + ' %';
    refs.nombres.setAttribute('aria-checked', String(estado.nombres));
    refs.arriba.setAttribute('aria-checked', String(estado.arriba));
    refs.inicio.setAttribute('aria-checked', String(info.inicio));
    refs.atajo.textContent = L.textoAtajo(estado.atajo);
  }

  function cambiarAlpha(paso) {
    estado.alpha = L.limitarAlpha(estado.alpha + paso, D);
    aplicarAlpha(); sincronizarConfig(); guardar();
  }
  function alternarArriba() {
    estado.arriba = !estado.arriba;
    if (ventana) ventana.setAlwaysOnTop(estado.arriba).catch(() => {});
    sincronizarConfig(); guardar();
  }
  async function alternarInicio() {
    try {
      info.inicio = await invocar('inicio_cambiar', { activo: !info.inicio });
    } catch (e) {
      avisar('No se pudo cambiar el inicio automático.', 5);
    }
    sincronizarConfig();
  }
  function restablecerTodo() {
    const valores = L.normalizarConfig({}, D);
    Object.assign(estado, { tema: valores.tema, tamano: valores.tamano, alpha: valores.alpha, nombres: valores.nombres });
    if (estado.arriba !== valores.arriba) alternarArriba();
    sincronizarConfig(); guardar();
    aplicarTamano(); aplicarAlpha();
    pedirTema(valores.tema);
  }

  function alternarConfig(abrir) {
    enConfig = abrir === undefined ? !enConfig : abrir;
    document.body.classList.toggle('en-config', enConfig);
    if (enConfig) { sincronizarConfig(); } else { requestAnimationFrame(moverIndicador); }
    $('b-config').setAttribute('aria-expanded', String(enConfig));
  }
  function alternarCompacto() {
    if (enConfig) alternarConfig(false);
    estado.compacto = !estado.compacto;
    document.body.classList.toggle('compacto', estado.compacto);
    el.iconoCompacto.setAttribute('d', estado.compacto ? 'M4 6l4 4 4-4' : 'M4 10l4-4 4 4');
    mostrarNombre(estado.compacto ? 'Expandir' : 'Modo compacto');
    guardar();
  }

  // ---------- ventana: tamaño y posición ----------
  let ultimoTamano = '';
  function ajustarVentana() {
    if (!ventana) return;
    const r = el.ventana.getBoundingClientRect();
    const ancho = Math.ceil(r.width + M.izq + M.der), alto = Math.ceil(r.height + M.sup + M.inf);
    const clave = ancho + 'x' + alto;
    if (clave === ultimoTamano) return;
    ultimoTamano = clave;
    ventana.setSize(new T.window.LogicalSize(ancho, alto)).catch(() => {});
  }

  // Pantallas disponibles (zona de trabajo: sin la barra de tareas), en píxeles físicos.
  async function pantallas() {
    return (await T.window.availableMonitors()).map((m) => {
      const z = m.workArea || { position: m.position, size: m.size };
      return { x: z.position.x, y: z.position.y, ancho: z.size.width, alto: z.size.height };
    });
  }
  // Rectángulo visible del teclado (sin el margen de la sombra), en píxeles físicos.
  function cajaVisible(x, y) {
    const r = el.ventana.getBoundingClientRect();
    return { x, y, ancho: Math.round(r.width * escala), alto: Math.round(r.height * escala) };
  }
  async function moverA(x, y) {
    await ventana.setPosition(new T.window.PhysicalPosition(Math.round(x - M.izq * escala), Math.round(y - M.sup * escala)));
  }

  async function colocarVentana() {
    escala = await ventana.scaleFactor();
    const lista = await pantallas();
    if (estado.x !== null && estado.y !== null) {
      // Si quedó parcialmente fuera (otra pantalla, otra resolución), se corrige al entrar.
      const c = L.ajustarADentro(cajaVisible(estado.x, estado.y), lista);
      estado.x = c.x; estado.y = c.y;
    } else if (lista.length) {
      const caja = cajaVisible(0, 0);
      const c = L.ajustarADentro({ ...caja, x: lista[0].x + lista[0].ancho - caja.ancho - 48 * escala, y: lista[0].y + 80 * escala }, lista);
      estado.x = Math.round(c.x); estado.y = Math.round(c.y);
    }
    if (estado.x !== null) await moverA(estado.x, estado.y);
  }

  // Al soltar el teclado se lo acomoda dentro de la pantalla: puede quedar pegado a cualquier
  // borde (incluido el superior) pero no con una parte afuera.
  let temporizadorMovimiento = null;
  function vigilarMovimiento() {
    ventana.onMoved(({ payload }) => {
      clearTimeout(temporizadorMovimiento);
      temporizadorMovimiento = setTimeout(async () => {
        let x = payload.x + Math.round(M.izq * escala), y = payload.y + Math.round(M.sup * escala);
        try {
          const c = L.ajustarADentro(cajaVisible(x, y), await pantallas());
          if (c.x !== x || c.y !== y) { x = c.x; y = c.y; await moverA(x, y); }
        } catch (_) { /* si no se puede consultar, se deja donde está */ }
        estado.x = x; estado.y = y;
        guardar();
      }, 250);
    });
  }

  // ---------- arranque ----------
  async function iniciar() {
    M = { izq: px('--m-izq'), der: px('--m-der'), sup: px('--m-sup'), inf: px('--m-inf') };
    construirPestanas();
    construirTeclas();
    construirConfig();
    engancharTeclas(el.cuadricula);
    engancharTeclas(el.recientes);

    // Ningún botón toma el foco: así el programa que se está usando lo conserva.
    document.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    $('b-config').addEventListener('click', () => alternarConfig());
    $('b-cerrar').addEventListener('click', () => { if (enConfig) alternarConfig(false); else if (ventana) ventana.close(); });
    $('b-minimizar').addEventListener('click', () => {
      // Con ícono en la bandeja se oculta (se vuelve con un clic en el ícono o con el atajo);
      // si no hay bandeja, se minimiza.
      if (info.bandeja) invocar('ocultar').catch(() => {}); else if (ventana) ventana.minimize();
    });
    el.compacto.addEventListener('click', alternarCompacto);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && enConfig) alternarConfig(false); });

    if (T) {
      try {
        const inicial = await invocar('estado_inicial');
        estado = L.normalizarConfig(inicial.config, D);
        info = { plataforma: inicial.plataforma, inicio: inicial.inicio_automatico, bandeja: inicial.bandeja };
        const minimizar = $('b-minimizar');
        const texto = info.bandeja ? 'Ocultar (ícono junto al reloj o ' + L.textoAtajo(estado.atajo) + ')' : 'Minimizar';
        minimizar.title = texto; minimizar.setAttribute('aria-label', texto);
        if (inicial.atajo_error) avisarAtajo(inicial.atajo_error);
      } catch (e) { /* se usan los valores predeterminados */ }
      T.event.listen('atajo-error', (e) => avisarAtajo(e.payload));
    }

    informar('animaciones: ' + (puedeAnimar ? 'sí' : 'no') + (reducirMovimiento ? ' (el sistema pide reducir movimiento)' : ''));
    aplicarTema(); aplicarTamano(); aplicarAlpha();
    document.body.classList.toggle('compacto', estado.compacto);
    el.iconoCompacto.setAttribute('d', estado.compacto ? 'M4 6l4 4 4-4' : 'M4 10l4-4 4 4');
    pintarPagina(); pintarRecientes(); sincronizarConfig();

    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
    moverIndicador();
    if (ventana) {
      new ResizeObserver(() => requestAnimationFrame(ajustarVentana)).observe(el.ventana);
      ajustarVentana();
      await colocarVentana();
      await ventana.setAlwaysOnTop(estado.arriba);
      vigilarMovimiento();
    }
    // Recién ahora se muestra: ya está todo armado y en su lugar (sin parpadeo al abrir).
    // (No se usa requestAnimationFrame: con la ventana oculta el navegador no lo ejecuta.)
    el.ventana.classList.remove('oculta');
    await new Promise((r) => setTimeout(r, 60));
    if (ventana) await ventana.show();
  }

  function avisarAtajo(motivo) {
    const texto = L.textoAtajo(estado.atajo) || 'El atajo';
    avisar(`No se pudo activar el atajo ${texto}: quizá otra aplicación ya lo usa (${motivo}).`, 12);
  }

  iniciar();
})();
