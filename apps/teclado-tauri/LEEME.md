# Teclado Científico 2.0 (prueba en Tauri)

Versión de prueba del teclado con otro motor (Tauri: Rust y la ventana web del propio sistema), para **comparar con el teclado de Python** (`apps/teclado`, versión 1.8) antes de decidir si lo reemplaza. No toca ni la versión de Python ni su publicación.

## Qué cambia respecto del teclado de Python

- Mismo contenido: los símbolos, los nombres, los 6 temas y los tamaños se **generan a partir del programa de Python** (`tools/generar_datos.py`), no se copian a mano.
- Misma configuración: usa el mismo archivo (`%APPDATA%\TecladoCientifico\config.json`) y las mismas claves; al abrirlo por primera vez conserva posición, color, tamaño, transparencia, recientes y atajo.
- Aspecto nuevo: bordes redondeados y sombra reales, íconos nítidos, transparencia por píxel. Respeta «reducir animaciones» del sistema.
- Animaciones (no bloquean ni se interrumpen): destello y pequeño rebote al tocar una tecla, entrada en cascada al cambiar de pestaña, recientes que se deslizan y barrido de color de izquierda a derecha (0,38 s) al cambiar de tema. El barrido corre sobre una copia de la pantalla que no recibe clics: el teclado de abajo ya está en el color nuevo y se puede usar enseguida; si se elige otro color a mitad de camino, el que corre termina y luego se hace el último.
- Se puede dejar pegado a cualquier borde de la pantalla, incluido el superior (no hay margen transparente arriba). Al soltarlo se lo acomoda para que no quede con una parte afuera, igual que en la versión de Python. Si al abrirlo la posición guardada quedó fuera (otro monitor), se corrige.
- No aparece en Alt+Tab ni en la barra de tareas (en Windows se le pone el estilo de «ventana de herramientas»): antes, como siempre está encima, Alt+Tab alternaba entre el programa de atrás y el teclado. El botón «–» lo oculta junto al reloj; se vuelve con un clic en el ícono (o con el atajo). Si no hay bandeja, minimiza.
- Nitidez: usa «Segoe UI» (la misma tipografía que la versión de Python) y la transparencia se aplica solo a los fondos, no a las letras, para que los símbolos se vean siempre opacos. Una ventana transparente no puede usar ClearType (el suavizado de subpíxeles de Windows), así que el texto puede verse algo menos «duro» que en la versión de Python; si sigue notándose, la alternativa es una ventana sin transparencia.
- Sin parpadeos por diseño: las teclas, los recientes y el panel de configuración se crean una sola vez y los cambios solo modifican lo que cambia; la ventana se muestra recién cuando está armada y en su lugar.
- No roba el foco: la ventana se crea como «sin foco» (en Windows, `WS_EX_NOACTIVATE`) y ningún botón toma el foco del navegador interno.
- Escritura: Rust envía el símbolo como texto Unicode (`SendInput` en Windows). Si no se puede, lo copia al portapapeles y avisa.
- Atajo global (`Ctrl+Alt+G` por defecto), instancia única, inicio automático con el sistema (interruptor en ⚙; al iniciar el sistema se abre con `--inicio` y, si ya hay otra copia, no molesta).
- Los errores de la pantalla se anotan en `diagnostico.log`, junto a `config.json`.

## Cómo obtener los archivos para probarlo

1. Suba la carpeta `apps/teclado-tauri` y los archivos de `.github/workflows` (`compilar-teclado-2.yml` y `compilar-teclado.yml`) al repositorio.
2. En GitHub: **Actions > Compilar Teclado Científico 2 > Run workflow**. Compila Windows, Linux y Mac **sin publicar nada**.
3. Cuando termine (10 a 25 minutos la primera vez), abra la ejecución y descargue los artefactos del final de la página: `TecladoCientifico-Windows.exe`, `TecladoCientifico-Linux.tar.gz` y `TecladoCientifico-Mac.zip`.
4. Windows puede mostrar la advertencia de SmartScreen (no está firmado): «Más información > Ejecutar de todas formas».

Requisito en Windows: **WebView2** (viene con Windows 11 y con Windows 10 actualizado).

Para compilar en su PC (solo Windows): instalar Rust con las herramientas de C++ de Visual Studio y, dentro de `src-tauri`, `cargo build --release --features custom-protocol`. El .exe queda en `src-tauri\target\release`.

## Qué comprobar en Windows (en este orden)

Lo único que no pude verificar fuera de Windows son los puntos 1 a 5 y el 10: son justamente el motivo de la prueba.

1. **Foco (lo más importante).** Abra el Bloc de notas, deje el cursor escribiendo, haga clic en varias teclas. Esperado: los símbolos aparecen en el Bloc de notas y el cursor sigue ahí, sin parpadear la barra de título del Bloc de notas (que no pase a gris). Repítalo en Word y en el navegador.
2. **Transparencia y bordes.** Esperado: esquinas redondeadas con sombra y sin marco ni fondo negro o blanco alrededor. Cambie la transparencia (⚙ > Transparencia) y confirme que se ve el escritorio detrás.
3. **Minimizar y volver.** Botón «–» y luego clic en el ícono de la barra de tareas. Y el atajo `Ctrl+Alt+G` (ocultar y mostrar).
4. **Pantallas con escala 125 % o 150 %.** El tamaño de las teclas y el ancho de la ventana deben verse igual que a 100 %; arrástrela entre dos monitores si tiene.
5. **Parpadeos.** Abra el programa varias veces; cambie color, tamaño de teclas, transparencia y los interruptores. No debería verse ningún destello.
6. **Memoria y arranque.** En el Administrador de tareas sume «Teclado Científico» y los procesos «Microsoft Edge WebView2» que cuelgan de él, y compare con el teclado de Python abierto. Anote también cuánto tarda en aparecer. Es el dato clave para decidir.
7. **Inicio automático.** Active el interruptor, reinicie la PC y confirme que se abre solo. Debe figurar en *Configuración > Aplicaciones > Inicio*.
8. **Configuración heredada.** Con el teclado de Python 1.x ya usado, abra este: debería respetar posición y color.
9. **Segunda copia.** Ábralo dos veces: la segunda no debe quedar abierta.
10. **Alt+Tab.** Con el PDF y el resumen abiertos, haga clic en varias teclas y use Alt+Tab: debe alternar solo entre el PDF y el resumen, sin pasar por el teclado.
11. **Borde superior y bordes.** Arrástrelo hasta el borde de arriba: debe quedar pegado, sin franja. Intente dejarlo con una parte afuera: al soltarlo debe volver adentro.
12. **Nitidez.** Compare las letras con el teclado de Python al 100 % de zoom de Windows (y con su escala real). Si le parece menos nítido, dígamelo con una captura de ambos.
13. **Animaciones.** Toque teclas muy rápido, cambie de pestaña y cambie de color varias veces seguidas, incluso tocando teclas durante el barrido: nada debe trabarse ni quedar a medias.

Si algo falla, envíeme: qué pasó, el archivo `diagnostico.log` (carpeta `%APPDATA%\TecladoCientifico`) y la versión de Windows.

**Si el punto 1 falla** (el programa de atrás pierde el foco al hacer clic), el plan es que Rust recuerde la última ventana activa y se la devuelva justo antes de escribir; está previsto, pero conviene medirlo primero antes de agregar código que no se pueda comprobar.

## Estructura

```
apps/teclado-tauri/
  MAC_MOTOR           «tauri» o «python»: qué se publica como TecladoCientifico-Mac.zip
  ui/                 pantalla (HTML, CSS y JavaScript sin dependencias ni compilación)
    datos.js          símbolos, nombres, temas y tamaños (generado desde Python)
    logica.js         reglas sin pantalla (recientes, transparencia, ajuste a pantalla, cola de animaciones)
    app.js            interfaz y animaciones
    pruebas/          pruebas con Node: node --test ui/pruebas/*.test.js
  src-tauri/          programa en Rust
    src/lib.rs        ventana, atajo, bandeja, instancia única
    src/inicio.rs     inicio automático (mismo nombre de entrada que la 1.x)
    src/teclear.rs    escritura de símbolos
    src/config.rs     config.json (mismo archivo que Python) y diagnostico.log
    src/atajo.rs      formato «ctrl+alt+g»
    src/ventana_windows.rs   quita el teclado de Alt+Tab (solo Windows)
    Info.plist        aplicación sin ícono en el Dock (Mac)
  tools/
    generar_datos.py  regenera ui/datos.js desde apps/teclado
    fijar_version.py  toma la versión de la etiqueta (la usa la compilación)
    probar_version.py pruebas de lo anterior: python -m unittest tools.probar_version
    probar_arranque.sh  arranca el programa en una pantalla virtual y comprueba que la interfaz cargó (Linux)
```

Pruebas: `node --test ui/pruebas/*.test.js` y `cargo test` (dentro de `src-tauri`; en Linux hacen falta las bibliotecas de Tauri: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `libayatana-appindicator3-dev`).

## Publicar la versión 2.0 (y las siguientes)

1. Pruebe primero con **Run workflow** (arriba) y verifique en Windows los puntos de la lista. Si puede, pruebe también el Mac y el Linux (ver abajo).
2. Para publicar: *Releases > Draft a new release*, etiqueta **`teclado-v2.0`** (siempre mayor que la última publicada; nunca repita una), *Publish release*. El flujo compila los tres sistemas y sube al release los tres archivos con los **mismos nombres** que usa la web y que esperan los actualizadores de la 1.x: `TecladoCientifico-Windows.exe`, `TecladoCientifico-Mac.zip` y `TecladoCientifico-Linux.tar.gz`. Si falta alguno, **no publica nada** (la web quedaría con un enlace roto).
3. **El número de versión sale de la etiqueta**: el flujo lo escribe en `Cargo.toml` y `tauri.conf.json` antes de compilar (y en Linux comprueba que el ejecutable lo informe con `--version`). No hay que editar versiones a mano. Es el arreglo del error de la 1.7 y la 1.8.1, publicadas con programas que por dentro decían otra versión y por eso avisaban de una «versión nueva» para siempre.
4. Suba también los cambios de la web de ese día: en `app/teclado/novedades.js` hay un bloque con las **notas de la 2.0 ya escritas, comentado**: borre las marcas `//` para activarlo en el momento de publicar.
5. Las etiquetas `teclado-v1.*` las sigue compilando el flujo «Compilar Teclado Científico» (versión de Python); las `teclado-v2.*` y mayores, este.

### Cómo llegan los usuarios de la 1.x
Las versiones 1.5 en adelante buscan releases `teclado-v…` mayores y, si el usuario hace clic en ↑, descargan `TecladoCientifico-Windows.exe` (o el `.tar.gz` en Linux) y se reemplazan por él: el 2.0 llega por ese camino sin descargar nada desde la web. El 2.0 reconoce el inicio automático de la 1.x, conserva su configuración, borra el `.old` que deja la actualización y reintenta el atajo si la copia anterior tarda en soltarlo. (En Mac la 1.x solo avisa y abre la página de descargas.)

### Linux
Se distribuye como **AppImage** (lleva adentro WebKit y todo lo demás) dentro de un `.tar.gz` con un archivo llamado `TecladoCientifico`: es el formato que espera el actualizador de la 1.x. Necesita FUSE 2 para abrirse con doble clic; si no la tiene, ejecutarlo con `./TecladoCientifico --appimage-extract-and-run`. La compilación prueba el arranque en una pantalla virtual y falla si la interfaz no carga. Límites (los mismos de la 1.x): en sesiones Wayland el atajo global no funciona y el teclado solo escribe en programas que corran sobre XWayland; sin ícono de bandeja (GNOME sin extensión) el botón «–» se oculta, porque una ventana oculta no tendría cómo volver.

### Mac (en prueba, sin verificar)
Se genera una app universal (Apple Silicon e Intel) sin ícono en el Dock (`LSUIElement`), firmada «ad hoc»: la primera vez hay que abrirla con clic derecho > Abrir, y concederle el permiso de **Accesibilidad** para que pueda escribir. **No pude verificar en una Mac si la ventana evita robar el foco al tocar una tecla** (en macOS eso suele requerir un tipo de ventana especial que Tauri no trae de serie). Por eso, antes de publicar el 2.0, pruebe el `TecladoCientifico-Mac.zip` que genera **Run workflow** en una Mac: abra un documento, toque símbolos y confirme que aparecen ahí. Si no funciona, no hace falta frenar la publicación: cambie la palabra del archivo `MAC_MOTOR` de `tauri` a `python` y el release publicará como `TecladoCientifico-Mac.zip` el teclado de la 1.x (ya probado en Mac).

### Páginas de la web que habrá que ajustar al publicar la 2.0
`app/teclado/page.js` todavía describe la versión de Python (por ejemplo, el requisito de `pynput` en Linux y las notas de «versión en prueba» de Mac y Linux). Conviene ajustarlas cuando salga el 2.0; puedo prepararlo.

## Falta para más adelante

- Actualización automática propia de la 2.x (Tauri usa claves de firma minisign, como Anotomía). Mientras tanto, quien tenga la 2.0 la actualiza descargando de la web.
- Firma del programa (hoy no está firmado: SmartScreen en Windows y Gatekeeper en Mac avisan).
- Instalador: hoy es un solo archivo, como el de Python.
