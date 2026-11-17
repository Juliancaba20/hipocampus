# Teclado Científico 2.0 (prueba en Tauri)

Versión de prueba del teclado con otro motor (Tauri: Rust y la ventana web del propio sistema), para **comparar con el teclado de Python** (`apps/teclado`, versión 1.8) antes de decidir si lo reemplaza. No toca ni la versión de Python ni su publicación.

## Qué cambia respecto del teclado de Python

- Mismo contenido: los símbolos, los nombres, los 6 temas y los tamaños se **generan a partir del programa de Python** (`tools/generar_datos.py`), no se copian a mano.
- Misma configuración: usa el mismo archivo (`%APPDATA%\TecladoCientifico\config.json`) y las mismas claves; al abrirlo por primera vez conserva posición, color, tamaño, transparencia, recientes y atajo.
- Aspecto nuevo: bordes redondeados y sombra reales, íconos nítidos, transiciones suaves (color, interruptores, pestaña activa), transparencia por píxel. Respeta «reducir animaciones» del sistema.
- Sin parpadeos por diseño: las teclas, los recientes y el panel de configuración se crean una sola vez y los cambios solo modifican lo que cambia; la ventana se muestra recién cuando está armada y en su lugar.
- No roba el foco: la ventana se crea como «sin foco» (en Windows, `WS_EX_NOACTIVATE`) y ningún botón toma el foco del navegador interno.
- Escritura: Rust envía el símbolo como texto Unicode (`SendInput` en Windows). Si no se puede, lo copia al portapapeles y avisa.
- Atajo global (`Ctrl+Alt+G` por defecto), instancia única, inicio automático con el sistema (interruptor en ⚙; al iniciar el sistema se abre con `--inicio` y, si ya hay otra copia, no molesta).
- Los errores de la pantalla se anotan en `diagnostico.log`, junto a `config.json`.

## Cómo obtener el .exe para probarlo

1. Suba la carpeta `apps/teclado-tauri` y el archivo `.github/workflows/probar-teclado-tauri.yml` al repositorio.
2. En GitHub: **Actions > Probar Teclado (Tauri) > Run workflow**.
3. Cuando termine (unos 10 minutos la primera vez), abra la ejecución y descargue el artefacto **TecladoCientifico-Windows-prueba** (un .zip con `TecladoCientifico-2.0-prueba.exe`).
4. Windows puede mostrar la advertencia de SmartScreen (no está firmado): «Más información > Ejecutar de todas formas».

Requisito: Windows 10 u 11 con **WebView2** (viene con Windows 11 y con Windows 10 actualizado).

Para compilarlo en su PC: instalar Rust (con las herramientas de C++ de Visual Studio) y ejecutar, dentro de `src-tauri`, `cargo build --release --features custom-protocol`. El .exe queda en `src-tauri\target\release`.

## Qué comprobar en Windows (en este orden)

Lo único que no pude verificar fuera de Windows son los puntos 1 a 4: son justamente el motivo de la prueba.

1. **Foco (lo más importante).** Abra el Bloc de notas, deje el cursor escribiendo, haga clic en varias teclas. Esperado: los símbolos aparecen en el Bloc de notas y el cursor sigue ahí, sin parpadear la barra de título del Bloc de notas (que no pase a gris). Repítalo en Word y en el navegador.
2. **Transparencia y bordes.** Esperado: esquinas redondeadas con sombra y sin marco ni fondo negro o blanco alrededor. Cambie la transparencia (⚙ > Transparencia) y confirme que se ve el escritorio detrás.
3. **Minimizar y volver.** Botón «–» y luego clic en el ícono de la barra de tareas. Y el atajo `Ctrl+Alt+G` (ocultar y mostrar).
4. **Pantallas con escala 125 % o 150 %.** El tamaño de las teclas y el ancho de la ventana deben verse igual que a 100 %; arrástrela entre dos monitores si tiene.
5. **Parpadeos.** Abra el programa varias veces; cambie color, tamaño de teclas, transparencia y los interruptores. No debería verse ningún destello.
6. **Memoria y arranque.** En el Administrador de tareas sume «Teclado Científico» y los procesos «Microsoft Edge WebView2» que cuelgan de él, y compare con el teclado de Python abierto. Anote también cuánto tarda en aparecer. Es el dato clave para decidir.
7. **Inicio automático.** Active el interruptor, reinicie la PC y confirme que se abre solo. Debe figurar en *Configuración > Aplicaciones > Inicio*.
8. **Configuración heredada.** Con el teclado de Python 1.x ya usado, abra este: debería respetar posición y color.
9. **Segunda copia.** Ábralo dos veces: la segunda no debe quedar abierta.

Si algo falla, envíeme: qué pasó, el archivo `diagnostico.log` (carpeta `%APPDATA%\TecladoCientifico`) y la versión de Windows.

**Si el punto 1 falla** (el programa de atrás pierde el foco al hacer clic), el plan es que Rust recuerde la última ventana activa y se la devuelva justo antes de escribir; está previsto, pero conviene medirlo primero antes de agregar código que no se pueda comprobar.

## Estructura

```
apps/teclado-tauri/
  ui/                 pantalla (HTML, CSS y JavaScript sin dependencias ni compilación)
    datos.js          símbolos, nombres, temas y tamaños (generado desde Python)
    logica.js         reglas sin pantalla (recientes, transparencia, configuración)
    app.js            interfaz
    pruebas/          pruebas con Node: node --test ui/pruebas/*.test.js
  src-tauri/          programa en Rust
    src/lib.rs        ventana, atajo, inicio automático, instancia única
    src/teclear.rs    escritura de símbolos
    src/config.rs     config.json (mismo archivo que Python) y diagnostico.log
    src/atajo.rs      formato «ctrl+alt+g»
  tools/generar_datos.py   regenera ui/datos.js desde apps/teclado
```

Pruebas: `node --test ui/pruebas/*.test.js` y `cargo test` (dentro de `src-tauri`; en Linux hacen falta las bibliotecas de Tauri: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libxdo-dev`).

## Falta para poder reemplazar al teclado de Python

- Actualización automática (Tauri usa claves de firma minisign, como Anotomía) y flujo de publicación `teclado-v2.x`.
- Decidir qué pasa con quienes ya tienen la 1.x: el .exe nuevo podría publicarse con el mismo nombre de archivo, pero hay que probar esa ruta antes.
- macOS (permiso de Accesibilidad, `.app` firmado) y Linux (Wayland no admite atajo global).
- Instalador o versión portátil: decidir (hoy es un solo .exe, como el de Python).
