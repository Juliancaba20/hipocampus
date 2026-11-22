#!/bin/bash
# Arranca el teclado en una pantalla virtual (Linux) y comprueba que la ventana cargó de verdad.
# Uso: tools/probar_arranque.sh RUTA_DEL_EJECUTABLE [argumentos...]
#   (para un AppImage:  tools/probar_arranque.sh ./TecladoCientifico --appimage-extract-and-run)
# La pantalla anota «animaciones: …» en diagnostico.log al terminar de armarse: si esa línea no
# está, el programa abrió pero la interfaz no llegó a cargar. Cualquier otra línea de la interfaz
# en ese archivo es un error de la pantalla.
set -u
[ $# -ge 1 ] || { echo "Falta la ruta del ejecutable."; exit 2; }
ESPERA="${ESPERA:-12}"
export XDG_CONFIG_HOME="$(mktemp -d)"
export GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1
LOG="$XDG_CONFIG_HOME/TecladoCientifico/diagnostico.log"

interno="$(mktemp)"
cat > "$interno" <<'EOS'
#!/bin/bash
"$@" > /dev/null 2>&1 &
pid=$!
sleep "$ESPERA"
if ! kill -0 "$pid" 2>/dev/null; then
  echo "El programa terminó antes de tiempo: falló el arranque."
  exit 1
fi
kill "$pid"
wait "$pid" 2>/dev/null
exit 0
EOS
chmod +x "$interno"

export ESPERA
xvfb-run -a -s "-screen 0 1280x800x24" dbus-run-session -- "$interno" "$@"
resultado=$?
echo "--- diagnostico.log:"
cat "$LOG" 2>/dev/null || echo "(no se creó)"
[ "$resultado" -eq 0 ] || exit 1
if ! grep -q "animaciones:" "$LOG" 2>/dev/null; then
  echo "La ventana abrió pero la interfaz no llegó a cargar."
  exit 1
fi
otros="$(grep "^\[interfaz\]" "$LOG" | grep -v "animaciones:" || true)"
if [ -n "$otros" ]; then
  echo "La interfaz informó errores:"
  echo "$otros"
  exit 1
fi
echo "Arranque correcto: la interfaz cargó sin errores."
