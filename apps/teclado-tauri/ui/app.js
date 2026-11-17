// Teclado Científico (versión Tauri): pantalla. La lógica sin pantalla está en logica.js.
(function () {
  'use strict';

  const VERSION = '2.0.0';
  const MARGEN = 16; // igual que --margen en estilos.css
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
  let info = { plataforma: 'windows', inicio: false };
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
  function aplicarTema() {
    const t = D.temas[estado.tema];
    for (const [clave, valor] of Object.entries(t)) raiz.style.setProperty('--' + clave.replace('_', '-'), valor);
  }
  function aplicarTamano() {
    const m = D.tamanos[estado.tamano];
    raiz.style.setProperty('--ancho', m.ancho + 'px');
    raiz.style.setProperty('--alto', m.alto + 'px');
    raiz.style.setProperty('--letra', m.letra + 'px');
  }
  function aplicarAlpha() { raiz.style.setProperty('--alpha', String(estado.alpha)); }

  // ---------- teclas ----------
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
      b.addEventListener('click', () => { estado.pagina = pagina; pintarPagina(); guardar(); });
      b.addEventListener('pointerenter', () => mostrarNombre(''));
      el.pestanas.append(b);
    }
  }

  // ---------- escribir ----------
  async function escribirSimbolo(simbolo) {
    if (!simbolo) return;
    estado.recientes = L.agregarReciente(estado.recientes, simbolo, D);
    pintarRecientes();
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
      b.addEventListener('click', () => { estado.tema = nombre; aplicarTema(); sincronizarConfig(); guardar(); });
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
    aplicarTema(); aplicarTamano(); aplicarAlpha(); sincronizarConfig(); guardar();
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
    const ancho = Math.ceil(r.width + 2 * MARGEN), alto = Math.ceil(r.height + 2 * MARGEN);
    const clave = ancho + 'x' + alto;
    if (clave === ultimoTamano) return;
    ultimoTamano = clave;
    ventana.setSize(new T.window.LogicalSize(ancho, alto)).catch(() => {});
  }

  async function colocarVentana() {
    escala = await ventana.scaleFactor();
    const margenFisico = Math.round(MARGEN * escala);
    const monitores = (await T.window.availableMonitors()).map((m) => ({
      x: m.position.x, y: m.position.y, ancho: m.size.width, alto: m.size.height }));
    if (estado.x !== null && estado.y !== null && L.dentroDePantallas(estado.x, estado.y, monitores)) {
      await ventana.setPosition(new T.window.PhysicalPosition(estado.x - margenFisico, estado.y - margenFisico));
    } else if (monitores.length) {
      const m = monitores[0], r = el.ventana.getBoundingClientRect();
      estado.x = Math.round(m.x + m.ancho - r.width * escala - 48 * escala);
      estado.y = Math.round(m.y + 80 * escala);
      await ventana.setPosition(new T.window.PhysicalPosition(estado.x - margenFisico, estado.y - margenFisico));
    }
  }

  let temporizadorMovimiento = null;
  function vigilarMovimiento() {
    ventana.onMoved(({ payload }) => {
      clearTimeout(temporizadorMovimiento);
      temporizadorMovimiento = setTimeout(() => {
        const m = Math.round(MARGEN * escala);
        estado.x = payload.x + m; estado.y = payload.y + m;
        guardar();
      }, 400);
    });
  }

  // ---------- arranque ----------
  async function iniciar() {
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
    $('b-minimizar').addEventListener('click', () => ventana && ventana.minimize());
    el.compacto.addEventListener('click', alternarCompacto);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && enConfig) alternarConfig(false); });

    if (T) {
      try {
        const inicial = await invocar('estado_inicial');
        estado = L.normalizarConfig(inicial.config, D);
        info = { plataforma: inicial.plataforma, inicio: inicial.inicio_automatico };
        if (inicial.atajo_error) avisarAtajo(inicial.atajo_error);
      } catch (e) { /* se usan los valores predeterminados */ }
      T.event.listen('atajo-error', (e) => avisarAtajo(e.payload));
    }

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
