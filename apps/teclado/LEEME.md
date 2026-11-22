# Teclado Científico (programa de escritorio)

Teclado flotante para escribir letras griegas y símbolos con un clic. Funciona en Windows, Mac y Linux. La página de descargas es parte del sitio: `app/teclado/` en la raíz de este repositorio (ruta `/teclado`).

## Contenido de esta carpeta

- `teclado_griego.py`: el programa.
- `icono.png`, `icono.ico`, `icono.icns`: íconos para cada sistema.
- La compilación automática está en `.github/workflows/compilar-teclado.yml` (raíz del repositorio).

## Publicar una versión nueva

1. Modifique `teclado_griego.py` y suba el cambio a GitHub. **No hace falta tocar `VERSION`**: desde la 1.8.2 la compilación toma el número de la etiqueta (paso 2) y lo escribe dentro del programa. (Conviene dejar también `VERSION` al día en el código, pero ya no depende de eso.)
2. En GitHub: *Releases > Draft a new release*. En *Choose a tag* escriba `teclado-v1.5` (la etiqueta debe empezar con `teclado-v` y terminar con el número de versión; **siempre mayor que la última publicada**: nunca reutilice una etiqueta ni publique el mismo número dos veces), elija *Create new tag* y luego *Publish release*.
3. Espere unos 5 minutos y revise la pestaña *Actions*: deben aparecer tres tareas en verde (Windows, macOS, Linux). Al terminar, los tres archivos quedan adjuntos al release: `TecladoCientifico-Windows.exe`, `TecladoCientifico-Mac.zip` y `TecladoCientifico-Linux.tar.gz`.
4. La página `/teclado` enlaza siempre a la última versión publicada y toma el número de la etiqueta. No hay que editar nada en el sitio.

Notas:
- La compilación usa el código que existe **en el momento de crear la etiqueta**. Por eso conviene subir primero el cambio del programa (paso 1) y recién después publicar el release.
- Si un release quedó mal (archivos con otro nombre o de una versión equivocada), bórrelo junto con su etiqueta (*Releases > Delete*, y luego *Tags* para borrar la etiqueta) y vuelva a crearlo. Si ya lo descargó gente, es mejor publicar una versión **nueva** (por ejemplo `teclado-v1.8.3`) que repetir la anterior.
- **La versión de cada descarga es la de su etiqueta.** El paso «Fijar la versión según la etiqueta» de la compilación la escribe en `VERSION` y, en Linux, comprueba que el ejecutable la informe (`--version`); si no coincide, la compilación falla y no se publica nada. Esto evita el error de las etiquetas `teclado-v1.7` y `teclado-v1.8.1`, publicadas con programas que por dentro decían 1.6 y 1.8: esos programas se actualizaban, pero seguían creyéndose de la versión anterior y avisaban de una «versión nueva» para siempre.
- También puede ejecutar la compilación a mano desde *Actions > Compilar Teclado Científico > Run workflow*, eligiendo una etiqueta existente.

## Actualización automática (desde la versión 1.5)

- Al abrirse (y cada 6 horas), el programa consulta en GitHub si hay una versión del teclado más nueva. Si la hay, aparece un botón **↑** en la barra y un aviso; con un clic descarga la versión nueva, la verifica (tamaño y huella SHA-256 que publica GitHub), reemplaza su propio archivo y se reinicia. La configuración se conserva.
- **Windows y Linux:** se actualiza solo. **Mac:** el botón abre la página de descarga (la aplicación no está firmada y no puede reemplazarse a sí misma).
- Si la carpeta donde está el programa no permite escribir (por ejemplo, `C:\Program Files`), o algo falla, el botón abre la página de la versión en el navegador.
- Tras actualizar, queda un archivo `.old` junto al programa; se borra solo unos segundos después.
- Para desactivar la búsqueda, con el programa cerrado agregue `"buscar_actualizaciones": false` en `config.json`.
- **Las versiones 1.4 y anteriores no tienen esta función:** se descarga la 1.5 una única vez a mano; de ahí en adelante se actualiza sola.
- Para que una versión sea detectada, la etiqueta del release debe ser `teclado-vX.Y` (como indica «Publicar una versión nueva») y no estar marcada como *pre-release*.
- Pruebas: desde esta carpeta, `python -m unittest pruebas.probar_actualizacion -v` (en Linux sin pantalla, anteponga `xvfb-run -a`).

## Novedades de la versión 1.8.2

- **Corrige el aviso permanente de actualización.** Las descargas `teclado-v1.7` y `teclado-v1.8.1` llevaban escrita por dentro una versión anterior a su etiqueta (1.6 y 1.8). Quien se actualizaba a ellas seguía viendo «hay una versión nueva», porque el programa comparaba su versión (la vieja) con la última publicada. La 1.8.1 tenía exactamente el mismo código que la 1.8. A partir de la 1.8.2 la versión de cada descarga se toma de su etiqueta, con comprobación automática al compilar (ver «Publicar una versión nueva»). Quien tenga la 1.8 o la 1.8.1 verá una sola vez más el aviso: al actualizar a la 1.8.2 desaparece.
- No cambia nada más respecto de la 1.8.
- Pruebas nuevas: `python -m unittest pruebas.probar_version -v`.

## Novedades de la versión 1.8

- **Sin parpadeos al cambiar la configuración:** el color, el tamaño de las teclas, la transparencia y los interruptores se actualizan sobre lo que ya está en pantalla, en lugar de volver a crear el panel y las teclas. El panel de configuración se arma una sola vez y el número de transparencia tiene ancho fijo, para que «−» y «+» no se muevan al hacer clic seguido. Al cambiar el tamaño de las teclas ya no se dibuja cada pestaña para medirla: la medida se calcula.
- **Sin parpadeo al abrir:** la ventana se arma oculta y se muestra recién cuando está terminada y en su lugar (antes se veía aparecer en otra posición y completarse).
- **Abrir al iniciar el sistema:** nuevo interruptor en ⚙ (apagado de fábrica). Funciona con el programa descargado, no con el script. Usa el mecanismo propio de cada sistema: en Windows aparece en *Configuración > Aplicaciones > Inicio* y en el Administrador de tareas (si se lo desactiva allí, el programa lo respeta); en Mac es un agente de usuario en `~/Library/LaunchAgents`; en Linux es un archivo en `~/.config/autostart`. Si el programa cambia de carpeta, corrige solo la ruta registrada. Al iniciar el sistema se abre con el argumento `--inicio`: si ya hay otra copia abierta, sale sin mostrar ningún aviso.
- **Animaciones suaves, sin bloquear el uso:** al tocar una tecla hace un destello de color; al cambiar de pestaña las teclas entran en cascada de izquierda a derecha; y al cambiar de color hay un barrido de izquierda a derecha (unos 0,3 s). Todo se hace con temporizadores, no con bucles: se puede seguir tocando teclas, pasando el mouse y cambiando de pestaña mientras corre, y nada de eso lo interrumpe. Si se elige otro color a mitad de un barrido, el que está en curso termina y después se hace el último elegido. Al terminar, todo se repinta con el color definitivo. Se respeta el ajuste «mostrar animaciones» de Windows (si está desactivado, los cambios son inmediatos).
- Cambiar de pestaña ya no destruye y vuelve a crear las teclas: se reutilizan (otra fuente de parpadeo menos).
- En Windows, la transparencia al 100 % se entrega como 99,9 % (se ve igual) para que Windows no cambie el modo de la ventana al pasar por 100 %.
- Pruebas nuevas: `python -m unittest pruebas.probar_sin_parpadeo pruebas.probar_inicio_automatico pruebas.probar_animaciones -v` (en Linux sin pantalla, anteponga `xvfb-run -a`). Las de parpadeo comprueban que ningún cambio de configuración destruya o cree widgets.
- Pendiente de comprobar en una PC con Windows y en Mac: que el parpadeo haya desaparecido a simple vista y que el inicio automático funcione tras reiniciar.

## Novedades de la versión 1.6

- Nueva pestaña **∫** (fisiología y matemática): V̇, v̇ y Q̇ (letra con punto encima, para flujos), integral, derivada parcial, lógica, ⊕ ⊖, ♂ ♀ y tilde/cruz.
- La pestaña **±** suma −, ÷, ≡, ≅, ∼, ≪ y ≫.
- ² y ³ aparecen también en la pestaña **H₂**. Son el mismo símbolo: en la fila de recientes figuran una sola vez.
- **Diseño nuevo:** teclas de esquinas redondeadas y separadas, recientes con contorno, pestaña activa subrayada y una línea que separa los recientes. El punto de V̇, v̇ y Q̇ se dibuja centrado sobre la letra. Las esquinas y los círculos se dibujan con bordes suavizados (imágenes PNG generadas por el propio programa; si el Tk del sistema no admite PNG se usa un dibujo sin suavizar).
- **Botón ⚙ (configuración):** color (Medianoche, Océano, Bosque, Violeta, Grafito y Claro), tamaño de las teclas (pequeño, normal, grande), transparencia (60 % a 100 %), mostrar u ocultar los nombres al pasar el mouse, «Siempre encima» (sí/no), activar o desactivar la búsqueda de actualizaciones, y «Restablecer». Todo se guarda en `config.json` (claves `tema`, `tamano`, `alpha`, `nombres`, `arriba`).
- El atajo se muestra en la configuración, pero se sigue cambiando en `config.json` (ver más abajo).
- El ancho del teclado no cambia. Se actualiza solo desde la 1.5.

## Uso del teclado

- **Escribir:** haga clic en un símbolo y se escribe donde esté el cursor. Al pasar el mouse por encima, la barra superior muestra su nombre.
- **Recientes:** la fila de arriba repite los últimos 9 símbolos usados.
- **Configuración:** el botón `⚙` abre el panel; elegir una pestaña lo cierra. Desde la 1.8 incluye «Abrir al iniciar el sistema».
- **Modo compacto:** el botón `▴` deja solo la barra y la fila de recientes; `▾` lo expande (elegir una pestaña también lo expande).
- **Ocultar y mostrar:** con el atajo **Ctrl+Alt+G** (solo Windows y Linux con X11). Si el teclado no aparece, pruebe el atajo: puede estar oculto.
- **Si no puede escribir** (por ejemplo, en un programa que se ejecuta como administrador), el teclado lo avisa y copia el símbolo para pegarlo con Ctrl+V.

### Cambiar el atajo

El programa guarda su configuración en un archivo `config.json`:

- Windows: `%APPDATA%\TecladoCientifico\config.json`
- Mac: `~/Library/Application Support/TecladoCientifico/config.json`
- Linux: `~/.config/TecladoCientifico/config.json`

Con el programa cerrado, edite la línea `"atajo"`. Formato: modificadores (`ctrl`, `alt`, `shift`, `win`) más una letra, número o tecla F1 a F12, unidos con `+`; por ejemplo `"ctrl+shift+k"` o `"ctrl+alt+f9"`. Con `""` el atajo queda desactivado.

## Importante

- La versión de Windows es la más probable que funcione sin ajustes. Las de Mac y Linux no pudieron probarse y deben considerarse en prueba.
- Si una de las tres compilaciones falla, las otras igualmente se publican.
- Mac: la aplicación se compila para chips M1 o posteriores. En Mac con procesador Intel no funcionará.
- Linux: solo funciona en X11; en Wayland el sistema suele bloquear la escritura en otras aplicaciones.
