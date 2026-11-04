"""
Teclado Científico: teclado flotante de letras griegas y símbolos (Windows, macOS y Linux).

- Queda siempre por encima de las demás ventanas.
- Intenta no quitarle el foco a la aplicación en la que se escribe.
- Al hacer clic en una letra, la escribe donde esté el cursor.
- Se mueve arrastrando la barra superior (sin salirse de la pantalla).
- Recuerda la última posición y la última pestaña usadas.
- Al pasar el mouse sobre un símbolo, muestra su nombre en la barra superior.
- Una fila de "usados recientemente" repite los últimos 9 símbolos escritos.
- Modo compacto (botón ▴/▾): deja solo la barra y la fila de recientes.
- Botón ⚙: configuración (color, tamaño de teclas, transparencia, nombres y más).
- Atajo global (Ctrl+Alt+G por defecto, solo Windows y Linux con X11) para
  ocultar o mostrar el teclado. Se puede cambiar en el archivo de configuración.
- El botón "–" lo minimiza a la barra de tareas, como una ventana común;
  se restaura haciendo clic en su ícono de la barra de tareas. La "x" lo cierra.
- Si no puede escribir, avisa en pantalla y copia el símbolo al portapapeles.

Windows: no requiere nada adicional.
macOS / Linux: requiere "pynput" (pip install pynput).
"""

import base64
import hashlib
import json
import os
import queue
import re
import subprocess
import sys
import tarfile
import struct
import tempfile
import threading
import time
import math
import tkinter as tk
import tkinter.font as tkfont
import urllib.request
import webbrowser
import zlib

VERSION = "1.6"
NOMBRE_APP = "TecladoCientifico"
NOMBRE_APP_ANTERIOR = "TecladoGriego"  # nombre de la carpeta de configuración hasta la v1.3
SISTEMA = sys.platform  # "win32", "darwin" o "linux"


class ErrorEscritura(Exception):
    """No se pudo escribir el carácter en la aplicación activa."""


# ---------------------------------------------------------------------------
# Escritura de caracteres en la aplicación activa
# ---------------------------------------------------------------------------
if SISTEMA == "win32":
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    INPUT_KEYBOARD = 1
    KEYEVENTF_KEYUP = 0x0002
    KEYEVENTF_UNICODE = 0x0004
    GWL_EXSTYLE = -20
    WS_EX_NOACTIVATE = 0x08000000
    WS_EX_TOPMOST = 0x00000008
    GA_ROOT = 2
    ERROR_ALREADY_EXISTS = 183
    WM_HOTKEY = 0x0312
    ULONG_PTR = ctypes.c_size_t

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                    ("dwExtraInfo", ULONG_PTR)]

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                    ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

    class HARDWAREINPUT(ctypes.Structure):
        _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD),
                    ("wParamH", wintypes.WORD)]

    class _INPUT_UNION(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _INPUT_UNION)]

    user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
    user32.GetAncestor.restype = wintypes.HWND
    user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetWindowLongW.restype = ctypes.c_long
    user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
    user32.SetWindowLongW.restype = ctypes.c_long
    user32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
    user32.SendInput.restype = wintypes.UINT
    user32.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
    user32.RegisterHotKey.restype = wintypes.BOOL
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND,
                                   wintypes.UINT, wintypes.UINT]
    user32.GetMessageW.restype = ctypes.c_int

    def escribir(texto):
        for caracter in texto:
            codigo = ord(caracter)
            entradas = (INPUT * 2)()
            entradas[0].type = INPUT_KEYBOARD
            entradas[0].u.ki = KEYBDINPUT(0, codigo, KEYEVENTF_UNICODE, 0, 0)
            entradas[1].type = INPUT_KEYBOARD
            entradas[1].u.ki = KEYBDINPUT(0, codigo, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0, 0)
            enviados = user32.SendInput(2, entradas, ctypes.sizeof(INPUT))
            if enviados != 2:
                raise ErrorEscritura("Windows rechazó la entrada de teclado.")

    def evitar_foco(raiz, arriba=True):
        hwnd = user32.GetAncestor(raiz.winfo_id(), GA_ROOT) or raiz.winfo_id()
        estilo = user32.GetWindowLongW(hwnd, GWL_EXSTYLE) | WS_EX_NOACTIVATE
        estilo = (estilo | WS_EX_TOPMOST) if arriba else (estilo & ~WS_EX_TOPMOST)
        user32.SetWindowLongW(hwnd, GWL_EXSTYLE, estilo)

    def activar_dpi():
        """Evita que Windows estire (y desenfoque) la ventana en pantallas con zoom."""
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            try:
                user32.SetProcessDPIAware()
            except Exception:
                pass

    _mutex = None  # se conserva para que Windows no libere el bloqueo

    def instancia_unica():
        """True si es la única copia abierta; False si ya hay otra ejecutándose."""
        global _mutex
        try:
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
            kernel32.CreateMutexW.restype = wintypes.HANDLE
            _mutex = kernel32.CreateMutexW(None, False, "Local\\" + NOMBRE_APP)
            return ctypes.get_last_error() != ERROR_ALREADY_EXISTS
        except Exception:
            return True  # si no se puede comprobar, se deja abrir

    def liberar_instancia():
        """Suelta el bloqueo de instancia única (se usa justo antes de relanzar el programa)."""
        global _mutex
        try:
            if _mutex:
                ctypes.WinDLL("kernel32").CloseHandle(wintypes.HANDLE(_mutex))
        except Exception:
            pass
        _mutex = None

    def avisar_ya_abierto():
        user32.MessageBoxW(None, "El Teclado Científico ya está abierto.\n\n"
                           "Si no lo ve, puede estar oculto: use su atajo "
                           "(por defecto Ctrl+Alt+G) o búsquelo en la barra de tareas.",
                           "Teclado Científico", 0x40)

    def iniciar_atajo(mods, tecla, cola):
        """Registra el atajo global. Los avisos llegan por la cola (hilo aparte)."""
        banderas, codigo = codigo_atajo_windows(mods, tecla)

        def trabajo():
            # El atajo y su bucle de mensajes deben vivir en el mismo hilo.
            if not user32.RegisterHotKey(None, 1, banderas, codigo):
                cola.put(("error", None))
                return
            mensaje = wintypes.MSG()
            while user32.GetMessageW(ctypes.byref(mensaje), None, 0, 0) > 0:
                if mensaje.message == WM_HOTKEY:
                    cola.put(("atajo", None))

        hilo = threading.Thread(target=trabajo, daemon=True)
        hilo.start()
        return hilo

    def limites_virtuales(raiz):
        """Rectángulo que abarca todos los monitores: (x0, y0, x1, y1)."""
        x, y = user32.GetSystemMetrics(76), user32.GetSystemMetrics(77)
        ancho, alto = user32.GetSystemMetrics(78), user32.GetSystemMetrics(79)
        if ancho <= 0 or alto <= 0:
            return None
        return x, y, x + ancho, y + alto

    FUENTE = "Segoe UI"
    ATAJO_PEGAR = "Ctrl+V"

else:
    _teclado = None

    def liberar_instancia():
        pass  # solo Windows usa bloqueo de instancia única

    def escribir(texto):
        global _teclado
        try:
            if _teclado is None:
                from pynput.keyboard import Controller
                _teclado = Controller()
            _teclado.type(texto)
        except Exception as error:  # permisos, Wayland, etc.
            raise ErrorEscritura(str(error) or error.__class__.__name__) from error

    def evitar_foco(raiz, arriba=True):
        # En Linux (X11), las ventanas sin borde no reciben el foco al hacer clic.
        # En macOS se intenta marcar la ventana como "no activable".
        if SISTEMA == "darwin":
            try:
                raiz.tk.call("::tk::unsupported::MacWindowStyle", "style",
                             raiz._w, "plain", "noActivates")
            except tk.TclError:
                pass

    def limites_virtuales(raiz):
        """Rectángulo de pantalla: (x0, y0, x1, y1). En Mac no se limita."""
        if SISTEMA == "darwin":
            return None  # no se detectan de forma fiable varias pantallas
        return 0, 0, raiz.winfo_screenwidth(), raiz.winfo_screenheight()

    def iniciar_atajo(mods, tecla, cola):
        """Atajo global solo en Linux con X11 (devuelve None si no es posible)."""
        if SISTEMA != "linux" or en_wayland():
            return None
        try:
            from pynput import keyboard
            nombres = {"ctrl": "<ctrl>", "alt": "<alt>", "shift": "<shift>", "win": "<cmd>"}
            final = f"<{tecla}>" if len(tecla) > 1 else tecla
            combinacion = "+".join([nombres[m] for m in mods] + [final])
            escucha = keyboard.GlobalHotKeys({combinacion: lambda: cola.put(("atajo", None))})
            escucha.daemon = True
            escucha.start()
            return escucha
        except Exception:
            cola.put(("error", None))
            return None

    FUENTE = "Helvetica Neue" if SISTEMA == "darwin" else "DejaVu Sans"
    ATAJO_PEGAR = "Cmd+V" if SISTEMA == "darwin" else "Ctrl+V"


# ---------------------------------------------------------------------------
# Atajo global (formato de texto: "ctrl+alt+g")
# ---------------------------------------------------------------------------
ATAJO_PREDETERMINADO = "ctrl+alt+g"
_MODIFICADORES = ("ctrl", "alt", "shift", "win")


def analizar_atajo(texto):
    """'ctrl+alt+g' -> (['ctrl', 'alt'], 'g'). Devuelve None si no es válido."""
    if not isinstance(texto, str):
        return None
    partes = [p.strip().lower() for p in texto.split("+")]
    if len(partes) < 2 or "" in partes:
        return None
    *mods, tecla = partes
    if len(set(mods)) != len(mods) or not set(mods) <= set(_MODIFICADORES):
        return None
    es_letra_o_numero = len(tecla) == 1 and tecla.isascii() and tecla.isalnum()
    if not (es_letra_o_numero or re.fullmatch(r"f([1-9]|1[0-2])", tecla)):
        return None
    return mods, tecla


def texto_atajo(mods, tecla):
    """Para mostrar al usuario: 'Ctrl+Alt+G'."""
    return "+".join([m.capitalize() for m in mods] + [tecla.upper()])


def codigo_atajo_windows(mods, tecla):
    """(banderas, código de tecla virtual) para RegisterHotKey de Windows."""
    banderas = 0x4000  # MOD_NOREPEAT: no repite al mantener pulsado
    for m in mods:
        banderas |= {"alt": 0x1, "ctrl": 0x2, "shift": 0x4, "win": 0x8}[m]
    if len(tecla) > 1:  # F1 a F12
        return banderas, 0x70 + int(tecla[1:]) - 1
    return banderas, ord(tecla.upper())


def en_wayland():
    return (os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland"
            or bool(os.environ.get("WAYLAND_DISPLAY")))


# ---------------------------------------------------------------------------
# Comprobaciones al iniciar (macOS y Linux)
# ---------------------------------------------------------------------------
def accesibilidad_concedida():
    """macOS: ¿tiene el programa el permiso de Accesibilidad?"""
    try:
        import ctypes
        biblioteca = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
        biblioteca.AXIsProcessTrusted.restype = ctypes.c_bool
        return bool(biblioteca.AXIsProcessTrusted())
    except Exception:
        return True  # si no se puede comprobar, no se molesta al usuario


def avisos_de_entorno():
    """Lista de avisos para mostrar al iniciar (vacía si todo está en orden)."""
    avisos = []
    if SISTEMA == "linux":
        if en_wayland():
            avisos.append("Está usando Wayland: el teclado puede no escribir en algunas "
                          "aplicaciones. Inicie sesión con Xorg/X11 o pegue el símbolo "
                          "con " + ATAJO_PEGAR + ".")
        try:
            import pynput.keyboard  # noqa: F401
        except Exception:
            avisos.append("Falta el componente «pynput», necesario para escribir. "
                          "Instálelo con: pip install pynput")
    elif SISTEMA == "darwin":
        if not accesibilidad_concedida():
            avisos.append("Falta el permiso de Accesibilidad. Actívelo en Ajustes del "
                          "Sistema > Privacidad y seguridad > Accesibilidad y vuelva "
                          "a abrir el programa.")
    return avisos


# ---------------------------------------------------------------------------
# Configuración guardada (posición y pestaña)
# ---------------------------------------------------------------------------
def ruta_config(nombre=None):
    if SISTEMA == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif SISTEMA == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    return os.path.join(base, nombre or NOMBRE_APP, "config.json")


def _leer_config(ruta):
    try:
        with open(ruta, encoding="utf-8") as archivo:
            datos = json.load(archivo)
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def cargar_config():
    if os.path.exists(ruta_config()):
        return _leer_config(ruta_config())
    # Primera vez tras el cambio de nombre: se aprovecha la configuración anterior
    # (posición, pestaña y atajo) para que el usuario no la pierda.
    return _leer_config(ruta_config(NOMBRE_APP_ANTERIOR))


def guardar_config(datos):
    try:
        ruta = ruta_config()
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        temporal = ruta + ".tmp"
        with open(temporal, "w", encoding="utf-8") as archivo:
            json.dump(datos, archivo)
        os.replace(temporal, ruta)
    except OSError:
        pass  # si no se puede guardar, el programa sigue funcionando


# ---------------------------------------------------------------------------
# Contenido del teclado
# ---------------------------------------------------------------------------
PUNTO = "\u0307"  # punto sobre la letra anterior (V̇ = flujo, p. ej. flujo urinario)
PAGINAS = {
    "α": list("αβγδεζηθικλμνξοπρσςτυφχψω"),
    "Α": list("ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ"),
    # Operadores y símbolos generales (la μ, micro, está en la primera pestaña)
    "±": list("↑↓→←↔±≥≤≈°×·²³⁺⁻‰") + list("−÷≡≅∼≪≫"),
    # Química y medicina: subíndices y superíndices (² y ³ también están en "±": es el
    # mismo símbolo, por eso en «recientes» aparece una sola vez) y símbolos
    "H₂": list("₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⇌≠∞√∑∝"),
    # Fisiología y matemática: letras con punto encima (flujos) y lógica
    "∫": ["V" + PUNTO, "v" + PUNTO, "Q" + PUNTO] + list("∫∂∇∴∵∅⇒⇔∈∉⊕⊖♂♀✓✗"),
}
COLUMNAS = 9
MAX_RECIENTES = 9

# Nombres que se muestran al pasar el mouse (deben ser cortos: caben en la barra)
_GRIEGAS = [  # (minúscula, mayúscula, nombre)
    ("α", "Α", "alfa"), ("β", "Β", "beta"), ("γ", "Γ", "gamma"), ("δ", "Δ", "delta"),
    ("ε", "Ε", "épsilon"), ("ζ", "Ζ", "zeta"), ("η", "Η", "eta"), ("θ", "Θ", "theta"),
    ("ι", "Ι", "iota"), ("κ", "Κ", "kappa"), ("λ", "Λ", "lambda"), ("μ", "Μ", "mu"),
    ("ν", "Ν", "nu"), ("ξ", "Ξ", "xi"), ("ο", "Ο", "ómicron"), ("π", "Π", "pi"),
    ("ρ", "Ρ", "rho"), ("σ", "Σ", "sigma"), ("τ", "Τ", "tau"), ("υ", "Υ", "ípsilon"),
    ("φ", "Φ", "fi (phi)"), ("χ", "Χ", "ji (chi)"), ("ψ", "Ψ", "psi"), ("ω", "Ω", "omega"),
]
NOMBRES = {"ς": "sigma final"}
for _min, _may, _nombre in _GRIEGAS:
    NOMBRES[_min] = _nombre
    NOMBRES[_may] = _nombre + " mayús."
NOMBRES.update({
    "↑": "flecha arriba", "↓": "flecha abajo", "→": "flecha derecha",
    "←": "flecha izquierda", "↔": "flecha doble", "±": "más o menos",
    "≥": "mayor o igual", "≤": "menor o igual", "≈": "aprox. igual",
    "°": "grados", "×": "por (multiplicar)", "·": "punto medio",
    "²": "al cuadrado", "³": "al cubo", "⁺": "superíndice +",
    "⁻": "superíndice −", "‰": "por mil",
    "⇌": "equilibrio", "≠": "distinto de", "∞": "infinito",
    "√": "raíz cuadrada", "∑": "sumatoria", "∝": "proporcional a",
    "V" + PUNTO: "V punto, flujo", "v" + PUNTO: "v punto, flujo",
    "Q" + PUNTO: "Q punto, flujo",
    "−": "menos", "÷": "dividido", "≡": "idéntico a", "≅": "congruente", "∼": "similar a",
    "≪": "mucho menor", "≫": "mucho mayor",
    "∫": "integral", "∂": "deriv. parcial", "∇": "nabla", "∴": "por lo tanto",
    "∵": "porque", "∅": "conjunto vacío", "⇒": "implica", "⇔": "si y solo si",
    "∈": "pertenece a", "∉": "no pertenece a", "⊕": "carga positiva",
    "⊖": "carga negativa", "♂": "masculino", "♀": "femenino",
    "✓": "tilde", "✗": "cruz",
})
for _i, _c in enumerate("₀₁₂₃₄₅₆₇₈₉"):
    NOMBRES[_c] = f"subíndice {_i}"
for _c, _i in zip("⁰¹⁴⁵⁶⁷⁸⁹", (0, 1, 4, 5, 6, 7, 8, 9)):
    NOMBRES[_c] = f"superíndice {_i}"
SIMBOLOS_VALIDOS = {c for pagina in PAGINAS.values() for c in pagina}

# Temas de color. Cada tema define los mismos colores; elegir uno solo recolorea los
# widgets que ya existen (no se crea nada nuevo ni se usan imágenes ni animaciones).
CLAVES_TEMA = ("fondo", "barra", "boton", "hover", "texto", "acento", "cerrar",
               "aviso_fondo", "aviso_texto", "reciente", "nombre", "asa")
TEMAS = {
    "Medianoche": dict(fondo="#1e1e2e", barra="#11111b", boton="#313244", hover="#45475a",
                       texto="#cdd6f4", acento="#89b4fa", cerrar="#f38ba8",
                       aviso_fondo="#45475a", aviso_texto="#f9e2af", reciente="#383852",
                       nombre="#a6adc8", asa="#6c7086"),
    "Océano": dict(fondo="#0f2433", barra="#0a1823", boton="#1b3a52", hover="#27506f",
                   texto="#d6ecfa", acento="#5cc8ff", cerrar="#ff8fa3",
                   aviso_fondo="#27506f", aviso_texto="#ffe29a", reciente="#21465f",
                   nombre="#9fbdd1", asa="#6f8fa6"),
    "Bosque": dict(fondo="#17261d", barra="#0e1a13", boton="#254031", hover="#31553f",
                   texto="#d9f0e0", acento="#7fdc9a", cerrar="#ff9aa8",
                   aviso_fondo="#31553f", aviso_texto="#f9e2af", reciente="#2b4a39",
                   nombre="#a3c4af", asa="#6f8f7a"),
    "Violeta": dict(fondo="#251c36", barra="#170f25", boton="#3a2c55", hover="#4d3b70",
                    texto="#e7ddfa", acento="#b79cff", cerrar="#ff9ab8",
                    aviso_fondo="#4d3b70", aviso_texto="#f9e2af", reciente="#443466",
                    nombre="#bfb0dc", asa="#8a7aa8"),
    "Grafito": dict(fondo="#26262a", barra="#18181b", boton="#3a3a40", hover="#505058",
                    texto="#e8e8ea", acento="#f0b35a", cerrar="#ff8f8f",
                    aviso_fondo="#505058", aviso_texto="#ffe29a", reciente="#45454c",
                    nombre="#b4b4bb", asa="#85858d"),
    "Claro": dict(fondo="#f4f4f8", barra="#e2e2ea", boton="#ffffff", hover="#dfe3f3",
                  texto="#26283a", acento="#2f6fe0", cerrar="#d6336c",
                  aviso_fondo="#dfe3f3", aviso_texto="#7a4a00", reciente="#e9ecf8",
                  nombre="#54586e", asa="#7b7f93"),
}
TEMA_PREDETERMINADO = "Medianoche"
C = dict(TEMAS[TEMA_PREDETERMINADO])  # colores en uso (los cambia Teclado.aplicar_tema)

# Tamaño de las teclas
# nombre -> (tamaño de letra, ancho y alto de cada tecla en píxeles a 96 ppp)
TAMANOS = {"Pequeño": (10, 33, 24), "Normal": (12, 35, 28), "Grande": (14, 41, 33)}
TAMANO_PREDETERMINADO = "Normal"
ALPHA_PREDETERMINADA, ALPHA_MINIMA = 0.96, 0.60


def ruta_recurso(nombre):
    """Ubica un archivo junto al programa, también dentro del ejecutable."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, nombre)


def crear_boton(padre, texto, comando, ancho=3, tamano=12, negrita=False,
                bg="boton", fg="texto", hover="hover", al_pasar=None, pady=1, padx=1):
    """Botón de texto plano (los de la barra). bg, fg y hover son claves de color del
    tema: se leen en cada evento, así que un cambio de tema se ve al instante.
    al_pasar(True/False) se llama cuando el mouse entra o sale."""
    fuente = (FUENTE, tamano, "bold") if negrita else (FUENTE, tamano)
    etiqueta = tk.Label(padre, text=texto, width=ancho, font=fuente, pady=pady, padx=padx,
                        bg=C[bg], fg=C[fg], cursor="hand2")
    etiqueta._roles = {"bg": bg, "fg": fg}

    def entrar(evento):
        etiqueta.configure(bg=C[hover])
        if al_pasar:
            al_pasar(True)

    def salir(evento):
        etiqueta.configure(bg=C[etiqueta._roles["bg"]])
        if al_pasar:
            al_pasar(False)

    etiqueta.bind("<Button-1>", lambda e: comando())
    etiqueta.bind("<Enter>", entrar)
    etiqueta.bind("<Leave>", salir)
    return etiqueta


def fuente_de(widget, puntos, negrita=False):
    """Fuente compartida (una por tamaño) para medir y dibujar texto en los Canvas."""
    raiz = widget.winfo_toplevel()
    cache = raiz.__dict__.setdefault("_fuentes", {})
    clave = (puntos, negrita)
    if clave not in cache:
        cache[clave] = tkfont.Font(root=raiz, family=FUENTE, size=puntos,
                                   weight="bold" if negrita else "normal")
    return cache[clave]


def escala_de(widget):
    """Factor de zoom de la pantalla respecto de 96 ppp (para las medidas en píxeles)."""
    try:
        return max(0.75, float(widget.tk.call("tk", "scaling")) / (96 / 72))
    except (tk.TclError, ValueError):
        return 1.0


def rectangulo_redondeado(canvas, x1, y1, x2, y2, radio, **opciones):
    """Rectángulo con esquinas en arco de círculo (respaldo si no hay imágenes PNG)."""
    r = max(1.0, min(radio, (x2 - x1) / 2, (y2 - y1) / 2))
    pasos = max(3, int(r))
    puntos = []
    for cx, cy, desde in ((x2 - r, y1 + r, -90), (x2 - r, y2 - r, 0),
                          (x1 + r, y2 - r, 90), (x1 + r, y1 + r, 180)):
        for i in range(pasos + 1):
            angulo = math.radians(desde + 90 * i / pasos)
            puntos += [cx + r * math.cos(angulo), cy + r * math.sin(angulo)]
    return canvas.create_polygon(puntos, **opciones)


# --- Formas con bordes suavizados --------------------------------------------------
# El Canvas de Tk dibuja sin suavizar los bordes en Windows (se ven «dientes» en las
# esquinas). Para evitarlo cada forma se genera como una imagen PNG con transparencia
# (cobertura de cada píxel calculada con la distancia al borde) y se reutiliza: una
# imagen por tamaño y color, no una por tecla. Solo usa la biblioteca estándar.

def hex_a_rgb(color):
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def cobertura(px, py, mx, my, radio):
    """Fracción (0 a 1) del píxel en (px, py) que cae dentro de un rectángulo redondeado
    centrado en el origen, de semialtos mx y my."""
    qx = abs(px) - (mx - radio)
    qy = abs(py) - (my - radio)
    d = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radio
    return min(1.0, max(0.0, 0.5 - d))


def pixeles_forma(ancho, alto, radio, relleno, contorno=None, grosor=0, semi=None):
    """Filas RGBA (bytearray) de un rectángulo redondeado con borde suavizado.
    relleno y contorno son '#rrggbb' o None (transparente). Con semi=(mx, my) la forma
    es más chica que la imagen (queda centrada, con margen para suavizar el borde)."""
    mx, my = semi if semi else (ancho / 2, alto / 2)
    radio = max(0.0, min(radio, mx, my))
    rf = hex_a_rgb(relleno) if relleno else None
    rc = hex_a_rgb(contorno) if contorno and grosor else None
    filas = []
    for y in range(alto):
        fila = bytearray()
        py = y + 0.5 - alto / 2
        for x in range(ancho):
            px = x + 0.5 - ancho / 2
            ext = cobertura(px, py, mx, my, radio)
            if ext <= 0:
                fila += b"\0\0\0\0"
                continue
            if rc:
                inte = cobertura(px, py, mx - grosor, my - grosor, max(0.0, radio - grosor))
            else:
                inte = ext
            if rc and rf:
                borde = ext - inte
                color = [(rc[i] * borde + rf[i] * inte) / ext for i in range(3)]
                alfa = ext
            elif rc:
                color, alfa = rc, ext - inte
            else:
                color, alfa = rf, ext
            if alfa <= 0.003:
                fila += b"\0\0\0\0"
            else:
                fila += bytes((round(color[0]), round(color[1]), round(color[2]),
                               round(alfa * 255)))
        filas.append(fila)
    return filas


def codificar_png(ancho, alto, filas):
    def bloque(tipo, datos):
        return (struct.pack(">I", len(datos)) + tipo + datos
                + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF))
    crudo = b"".join(b"\0" + bytes(f) for f in filas)
    return (b"\x89PNG\r\n\x1a\n"
            + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 6, 0, 0, 0))
            + bloque(b"IDAT", zlib.compress(crudo, 6)) + bloque(b"IEND", b""))


def forma_png(widget, ancho, alto, radio, relleno, contorno=None, grosor=0, semi=None):
    """Imagen de la forma (con caché por tamaño y color), o None si este Tk no admite PNG."""
    raiz = widget.winfo_toplevel()
    datos = raiz.__dict__
    if datos.get("_sin_png"):
        return None
    cache = datos.setdefault("_formas", {})
    clave = (ancho, alto, round(radio, 2), relleno, contorno, grosor, semi)
    if clave not in cache:
        if len(cache) > 150:
            cache.clear()  # las imágenes en uso las conserva cada widget
        try:
            filas = pixeles_forma(ancho, alto, radio, relleno, contorno, grosor, semi)
            png = codificar_png(ancho, alto, filas)
            cache[clave] = tk.PhotoImage(master=raiz, format="png",
                                         data=base64.b64encode(png).decode("ascii"))
        except tk.TclError:
            datos["_sin_png"] = True  # Tk antiguo sin PNG: se dibuja con polígonos
            return None
    return cache[clave]


class Tecla(tk.Canvas):
    """Tecla de bordes redondeados dibujada en un Canvas (liviana: 2 o 3 elementos).

    Las letras con punto encima (V̇, v̇, Q̇) no se dejan a la tipografía: el punto se
    dibuja a mano, centrado exactamente sobre la letra, para que se vea igual en
    todos los sistemas (algunas fuentes lo corren hacia un lado)."""

    def __init__(self, padre, simbolo, ancho, alto, puntos, comando=None, al_pasar=None,
                 fondo="fondo", relleno="boton", color="texto", contorno="hover",
                 hover_relleno="hover", hover_color="acento", radio=4, negrita=False):
        super().__init__(padre, width=ancho, height=alto, bd=0, highlightthickness=0,
                         bg=C[fondo])
        self.simbolo, self.ancho, self.alto, self.puntos = simbolo, ancho, alto, puntos
        self.comando, self.al_pasar, self.negrita, self.radio = comando, al_pasar, negrita, radio
        self.fondo, self.relleno, self.color, self.contorno = fondo, relleno, color, contorno
        self.hover_relleno, self.hover_color = hover_relleno, hover_color
        self.grosor = max(1, round(escala_de(self)))
        self.imagenes = []  # referencias: Tk descarta las imágenes que nadie conserva
        self.forma = self.create_image(0, 0, anchor="nw")
        self.punto = None
        self.bind("<Button-1>", self._pulsar)
        self.bind("<Enter>", self._entrar)
        self.bind("<Leave>", self._salir)
        self.poner(simbolo)

    def poner(self, simbolo):
        self.simbolo = simbolo
        self.delete("t")
        self.punto = None
        self.configure(cursor="hand2" if simbolo else "arrow")
        if simbolo:
            self._dibujar(simbolo)
        self.pintar()

    def _dibujar(self, simbolo):
        fuente = fuente_de(self, self.puntos, self.negrita)
        cx, cy = self.ancho / 2, self.alto / 2
        if len(simbolo) == 2 and simbolo[1] == PUNTO:
            letra = simbolo[0]
            em = self.puntos * float(self.tk.call("tk", "scaling"))  # alto de la «m» en px
            altura = (0.53 if letra.islower() else 0.72) * em        # altura de la letra
            radio = max(1.5, 0.10 * em)
            hueco = max(1.5, 0.10 * em)
            cy += (hueco + 2 * radio) / 2           # centra el conjunto letra + punto
            base = cy - fuente.metrics("linespace") / 2 + fuente.metrics("ascent")
            py = base - altura - hueco - radio
            self.create_text(cx, cy, text=letra, font=fuente, tags=("t", "x"))
            self.punto = (cx, py, radio)
            if forma_png(self, 4, 4, 1, "#000000") is not None:
                self.create_image(cx, py, tags=("t", "p"))
            else:
                self.create_oval(cx - radio, py - radio, cx + radio, py + radio, tags=("t", "p"))
        else:
            self.create_text(cx, cy, text=simbolo, font=fuente, tags=("t", "x"))

    def _imagen_forma(self, relleno, contorno):
        return forma_png(self, self.ancho, self.alto, self.radio, relleno, contorno, self.grosor)

    def pintar(self, pasando=False):
        pasando = pasando and bool(self.simbolo)
        relleno = self.hover_relleno if pasando else self.relleno
        color = C[self.hover_color if pasando else self.color]
        rel = C[relleno] if relleno else None
        self.configure(bg=C[self.fondo])
        imagen = self._imagen_forma(rel, C[self.contorno])
        if imagen is not None:
            self.imagenes = [imagen]
            self.itemconfigure(self.forma, image=imagen)
        else:  # respaldo: polígono redondeado sin suavizar
            self.delete(self.forma)
            self.forma = rectangulo_redondeado(self, 0, 0, self.ancho - 1, self.alto - 1,
                                               self.radio, fill=rel or "", outline=C[self.contorno],
                                               width=self.grosor)
            self.tag_lower(self.forma)
        self.itemconfigure("x", fill=color)
        if self.punto:
            cx, py, radio = self.punto
            lado = math.ceil(2 * radio) + 2  # margen para suavizar el borde
            if self.ancho % 2 != lado % 2:
                lado += 1
            es_imagen = bool(self.find_withtag("p")) and self.type("p") == "image"
            punto = (forma_png(self, lado, lado, radio, color, semi=(radio, radio))
                     if es_imagen else None)
            if punto is not None:
                self.imagenes.append(punto)
                self.itemconfigure("p", image=punto)
            else:
                self.itemconfigure("p", outline=color, fill=color)

    def repintar(self):
        self.pintar()

    def _entrar(self, evento):
        if self.simbolo:
            self.pintar(True)
            if self.al_pasar:
                self.al_pasar(True)

    def _salir(self, evento):
        self.pintar()
        if self.al_pasar and self.simbolo:
            self.al_pasar(False)

    def _pulsar(self, evento):
        if self.simbolo and self.comando:
            self.comando()


class Interruptor(tk.Canvas):
    """Interruptor (sí/no) de la configuración: píldora con perilla redonda."""

    def __init__(self, padre, valor, comando, ancho=26, alto=14, margen=2):
        super().__init__(padre, width=ancho, height=alto, bd=0, highlightthickness=0,
                         bg=C["fondo"], cursor="hand2")
        self.valor, self.comando = valor, comando
        self.ancho, self.alto, self.margen = ancho, alto, margen
        self.imagenes = []
        self.usa_png = forma_png(self, 4, 4, 1, "#000000") is not None
        if self.usa_png:
            self.pieza = [self.create_image(0, 0, anchor="nw")]
            self.perilla = self.create_image(0, 0, anchor="nw")
        else:
            r = alto / 2
            self.pieza = [self.create_oval(0, 0, alto - 1, alto - 1, width=0),
                          self.create_oval(ancho - alto, 0, ancho - 1, alto - 1, width=0),
                          self.create_rectangle(r, 0, ancho - r, alto - 1, width=0)]
            self.perilla = self.create_oval(0, 0, 0, 0, width=0)
        self.bind("<Button-1>", lambda e: self.comando())
        self.repintar()

    def repintar(self):
        self.configure(bg=C["fondo"])
        d = self.alto - 2 * self.margen
        x = self.ancho - self.margen - d if self.valor else self.margen
        fondo = C["acento"] if self.valor else C["hover"]
        perilla = C["fondo"] if self.valor else C["asa"]
        if self.usa_png:
            pastilla = forma_png(self, self.ancho, self.alto, self.alto / 2, fondo)
            bola = forma_png(self, d, d, d / 2, perilla)
            self.imagenes = [pastilla, bola]
            self.itemconfigure(self.pieza[0], image=pastilla)
            self.itemconfigure(self.perilla, image=bola)
            self.coords(self.perilla, x, self.margen)
        else:
            self.coords(self.perilla, x, self.margen, x + d - 1, self.margen + d - 1)
            for pieza in self.pieza:
                self.itemconfigure(pieza, fill=fondo)
            self.itemconfigure(self.perilla, fill=perilla)


def recolorear(widget):
    """Aplica el tema actual a un widget y a todo lo que contiene."""
    if hasattr(widget, "repintar"):
        widget.repintar()
    roles = getattr(widget, "_roles", None)
    if roles:
        widget.configure(bg=C[roles["bg"]])
        if roles.get("fg"):
            widget.configure(fg=C[roles["fg"]])
    for hijo in widget.winfo_children():
        recolorear(hijo)


# ---------------------------------------------------------------------------
# Actualización automática (Windows y Linux; en Mac solo se avisa)
# ---------------------------------------------------------------------------
REPO = "Juliancaba20/hipocampus"
URL_VERSIONES = f"https://api.github.com/repos/{REPO}/releases?per_page=30"
PREFIJO_DESCARGA = f"https://github.com/{REPO}/releases/download/"
# Si algún día se renombra el repositorio, GitHub redirige las consultas y las descargas pasan a
# llevar el nombre nuevo: por eso se acepta cualquier dirección de descarga de github.com.
DESCARGA_VALIDA = re.compile(r"^https://github\.com/[\w.-]+/[\w.-]+/releases/download/")
ARCHIVOS_ACTUALIZACION = {"win32": "TecladoCientifico-Windows.exe",
                          "darwin": "TecladoCientifico-Mac.zip",
                          "linux": "TecladoCientifico-Linux.tar.gz"}
# Etiquetas de las versiones del teclado (el repositorio también publica otras cosas, como Anotomía).
ETIQUETA_TECLADO = re.compile(r"^teclado(?:-cient[ií]fico)?-v(\d+(?:\.\d+)*)$", re.IGNORECASE)
ESPERA_RED = 15                      # segundos máximos para cada pedido a internet
LIMITE_DESCARGA = 150 * 1024 * 1024  # el programa pesa unos 15 MB: más que esto no es el programa


def version_a_tupla(texto):
    try:
        return tuple(int(parte) for parte in str(texto).split("."))
    except ValueError:
        return None


def elegir_version(publicaciones, archivo, actual=None):
    """Devuelve los datos de la versión del teclado más nueva que la actual, o None."""
    actual = version_a_tupla(actual or VERSION)
    mejor = None
    if not isinstance(publicaciones, list):
        return None
    for pub in publicaciones:
        if not isinstance(pub, dict) or pub.get("draft") or pub.get("prerelease"):
            continue
        coincide = ETIQUETA_TECLADO.match(str(pub.get("tag_name", "")))
        tupla = version_a_tupla(coincide.group(1)) if coincide else None
        if tupla is None or actual is None or tupla <= actual:
            continue
        if mejor is not None and tupla <= mejor["tupla"]:
            continue
        for activo in pub.get("assets") or []:
            url = str(activo.get("browser_download_url", ""))
            if (activo.get("name") == archivo and activo.get("state", "uploaded") == "uploaded"
                    and DESCARGA_VALIDA.match(url)):
                digest = str(activo.get("digest") or "")
                mejor = {"tupla": tupla, "version": coincide.group(1), "url": url,
                         "tamano": activo.get("size") if isinstance(activo.get("size"), int) else None,
                         "sha256": digest[7:].lower() if digest.startswith("sha256:") else None,
                         "pagina": str(pub.get("html_url") or f"https://github.com/{REPO}/releases")}
                break
    return mejor


def consultar_actualizacion(abrir=None):
    """Pregunta a GitHub si hay una versión nueva. Devuelve sus datos o None."""
    archivo = ARCHIVOS_ACTUALIZACION.get(SISTEMA)
    if not archivo:
        return None
    pedido = urllib.request.Request(URL_VERSIONES, headers={
        "User-Agent": f"TecladoCientifico/{VERSION}", "Accept": "application/vnd.github+json"})
    with (abrir or urllib.request.urlopen)(pedido, timeout=ESPERA_RED) as respuesta:
        publicaciones = json.loads(respuesta.read(4 * 1024 * 1024).decode("utf-8"))
    return elegir_version(publicaciones, archivo)


def ruta_ejecutable():
    """Ruta del programa instalado, o None si se ejecuta como script (no compilado)."""
    if getattr(sys, "frozen", False):
        return os.path.abspath(sys.executable)
    return None


def puede_autoactualizar():
    """Windows y Linux, programa compilado y carpeta con permiso de escritura."""
    ruta = ruta_ejecutable()
    return bool(ruta and SISTEMA in ("win32", "linux") and os.path.isfile(ruta)
                and os.access(os.path.dirname(ruta), os.W_OK))


def descargar_actualizacion(info, carpeta, abrir=None):
    """Descarga y comprueba la versión nueva; devuelve la ruta del ejecutable listo para usar."""
    pedido = urllib.request.Request(info["url"], headers={"User-Agent": f"TecladoCientifico/{VERSION}"})
    descarga = None
    listo = None
    try:
        gestor, descarga = tempfile.mkstemp(prefix="TecladoCientifico-", suffix=".descarga", dir=carpeta)
        huella, total = hashlib.sha256(), 0
        with os.fdopen(gestor, "wb") as salida, \
                (abrir or urllib.request.urlopen)(pedido, timeout=ESPERA_RED) as entrada:
            while True:
                trozo = entrada.read(256 * 1024)
                if not trozo:
                    break
                total += len(trozo)
                if total > LIMITE_DESCARGA:
                    raise ValueError("el archivo descargado es demasiado grande")
                huella.update(trozo)
                salida.write(trozo)
        if info.get("tamano") is not None and total != info["tamano"]:
            raise ValueError("la descarga quedó incompleta")
        if info.get("sha256") and huella.hexdigest() != info["sha256"]:
            raise ValueError("la descarga no coincide con la publicada")
        if SISTEMA == "linux":  # el archivo es un .tar.gz con el programa adentro
            gestor, listo = tempfile.mkstemp(prefix="TecladoCientifico-", suffix=".nuevo", dir=carpeta)
            with tarfile.open(descarga, "r:gz") as paquete, os.fdopen(gestor, "wb") as salida:
                miembro = next((m for m in paquete.getmembers()
                                if m.isfile() and os.path.basename(m.name) == NOMBRE_APP), None)
                if miembro is None:
                    raise ValueError("el paquete no contiene el programa")
                contenido = paquete.extractfile(miembro)
                while True:
                    trozo = contenido.read(256 * 1024)
                    if not trozo:
                        break
                    salida.write(trozo)
            os.chmod(listo, 0o755)
            os.remove(descarga)
            descarga = None
            return listo
        with open(descarga, "rb") as comprobar:
            if comprobar.read(2) != b"MZ":
                raise ValueError("el archivo descargado no es un programa de Windows")
        listo, descarga = descarga, None
        return listo
    except BaseException:
        for resto in (descarga, listo):
            if resto:
                try:
                    os.remove(resto)
                except OSError:
                    pass
        raise


def reemplazar_ejecutable(actual, nuevo):
    """Pone el programa nuevo en el lugar del actual. El actual queda como «.old» hasta que se borre."""
    viejo = actual + ".old"
    try:
        os.remove(viejo)
    except FileNotFoundError:
        pass
    os.replace(actual, viejo)  # un programa en uso se puede renombrar, aunque no borrar
    try:
        os.replace(nuevo, actual)
    except OSError:
        os.replace(viejo, actual)  # si falla, vuelve todo a como estaba
        raise


def borrar_restos():
    """Elimina el programa anterior que quedó como «.old» tras actualizar. True si ya no hay restos."""
    ruta = ruta_ejecutable()
    if not ruta:
        return True
    try:
        os.remove(ruta + ".old")
    except FileNotFoundError:
        pass
    except OSError:
        return False  # todavía en uso: se reintenta más tarde
    return True


def relanzar(ruta):
    """Abre el programa actualizado como proceso independiente."""
    entorno = dict(os.environ)
    entorno["PYINSTALLER_RESET_ENVIRONMENT"] = "1"  # que no reutilice la carpeta temporal de este proceso
    opciones = {"env": entorno, "close_fds": True, "stdin": subprocess.DEVNULL,
                "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if SISTEMA == "win32":
        opciones["creationflags"] = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    else:
        opciones["start_new_session"] = True
    subprocess.Popen([ruta, "--actualizado"], **opciones)


# ---------------------------------------------------------------------------
# Interfaz
# ---------------------------------------------------------------------------
class Teclado:
    def __init__(self):
        self.raiz = raiz = tk.Tk()
        raiz.title("Teclado Científico")
        self.poner_icono()
        raiz.overrideredirect(True)
        raiz.attributes("-topmost", True)

        config = cargar_config()
        self.tema = config.get("tema") if config.get("tema") in TEMAS else TEMA_PREDETERMINADO
        C.update(TEMAS[self.tema])
        self.tamano = (config.get("tamano") if config.get("tamano") in TAMANOS
                       else TAMANO_PREDETERMINADO)
        alpha = config.get("alpha")
        self.alpha = (float(alpha) if isinstance(alpha, (int, float))
                      and not isinstance(alpha, bool) and ALPHA_MINIMA <= alpha <= 1
                      else ALPHA_PREDETERMINADA)
        self.nombres = config.get("nombres") is not False
        self.siempre_arriba = config.get("arriba") is not False
        raiz.attributes("-topmost", self.siempre_arriba)
        self.escala = escala_de(raiz)
        self.ancho_config = 0
        self.en_config = False
        self.panel = None
        self.trabajo_busqueda = None
        self.fijar_alpha(self.alpha)
        raiz.configure(bg=C["fondo"])
        pagina_inicial = config.get("pagina") if config.get("pagina") in PAGINAS else "α"
        self.pagina = pagina_inicial
        recientes = config.get("recientes")
        self.recientes = []
        if isinstance(recientes, list):
            for c in recientes:
                if c in SIMBOLOS_VALIDOS and c not in self.recientes:
                    self.recientes.append(c)
        del self.recientes[MAX_RECIENTES:]
        self.minimizado = False
        self.x, self.y = 120, 120
        self.desplazamiento = (0, 0)
        self.trabajo_aviso = None
        self.compacto = False
        self.oculto = False
        self.cola_atajo = queue.SimpleQueue()
        self.escucha_atajo = None
        self.cola_actualizacion = queue.SimpleQueue()
        self.buscar_actualizaciones = config.get("buscar_actualizaciones") is not False
        self.info_actualizacion = None
        self.actualizando = False
        self.forzar_navegador = False
        aviso_atajo = None
        atajo_texto = config.get("atajo", ATAJO_PREDETERMINADO)
        if atajo_texto == "":
            self.atajo = None  # desactivado por el usuario
        else:
            self.atajo = analizar_atajo(atajo_texto)
            if self.atajo is None:
                predeterminado = analizar_atajo(ATAJO_PREDETERMINADO)
                aviso_atajo = (f"El atajo «{atajo_texto}» del archivo de configuración "
                               f"no es válido; se usa {texto_atajo(*predeterminado)}.")
                self.atajo = predeterminado

        self.barra = tk.Frame(raiz, bg=C["barra"])
        self.barra._roles = {"bg": "barra"}
        self.barra.pack(fill="x")
        self.aviso = tk.Label(raiz, text="", bg=C["aviso_fondo"], fg=C["aviso_texto"],
                              font=(FUENTE, 9), justify="left", anchor="w",
                              padx=6, pady=3, cursor="hand2")
        self.aviso._roles = {"bg": "aviso_fondo", "fg": "aviso_texto"}
        self.aviso.bind("<Button-1>", lambda e: self.ocultar_aviso())
        # contenido: fila de recientes, línea divisoria y cuadrícula de símbolos
        self.contenido = tk.Frame(raiz, bg=C["fondo"])
        self.contenido._roles = {"bg": "fondo"}
        self.contenido.pack(fill="x")
        self.recientes_marco = tk.Frame(self.contenido, bg=C["fondo"])
        self.recientes_marco._roles = {"bg": "fondo"}
        self.recientes_marco.pack(padx=self.px(6), pady=self.px(6), anchor="w")
        self.slots = []
        self.crear_recientes()
        self.divisor = tk.Frame(self.contenido, height=self.px(1), bg=C["hover"])
        self.divisor._roles = {"bg": "hover"}
        self.divisor.pack(fill="x")
        self.cuadricula = tk.Frame(self.contenido, bg=C["fondo"])
        self.cuadricula._roles = {"bg": "fondo"}
        self.cuadricula.pack(padx=self.px(6), pady=(self.px(6), self.px(3)))

        self.pestanas = {}
        self.indicadores = {}
        for nombre in PAGINAS:
            marco = tk.Frame(self.barra, bg=C["barra"])
            marco._roles = {"bg": "barra"}
            marco.pack(side="left", padx=(self.px(4), 0) if not self.pestanas else 0)
            pestana = crear_boton(marco, nombre,
                                  lambda n=nombre: self.cambiar_pagina(n),
                                  ancho=0, tamano=10, bg="barra",
                                  padx=self.px(9), pady=self.px(5))
            pestana.pack()
            indicador = tk.Frame(marco, height=self.px(2), bg=C["barra"])
            indicador._roles = {"bg": "barra"}
            indicador.pack(fill="x")
            self.pestanas[nombre] = pestana
            self.indicadores[nombre] = indicador

        # El botón de cerrar se coloca primero para quedar en el extremo derecho
        crear_boton(self.barra, "✕", self.cerrar, ancho=0, tamano=10, padx=self.px(9),
                    bg="barra", hover="cerrar", pady=self.px(5)).pack(side="right",
                                                                     padx=(0, self.px(4)))
        crear_boton(self.barra, "–", self.minimizar_ventana, ancho=0, tamano=10,
                    padx=self.px(9), bg="barra", pady=self.px(5)).pack(side="right")
        self.boton_compacto = crear_boton(
            self.barra, "▴", self.alternar_compacto, ancho=0, tamano=10, padx=self.px(9),
            bg="barra", pady=self.px(5),
            al_pasar=lambda dentro: self.mostrar_nombre(
                ("Expandir" if self.compacto else "Modo compacto") if dentro else None,
                siempre=True))
        self.boton_compacto.pack(side="right")
        self.boton_config = crear_boton(
            self.barra, "⚙", self.alternar_config, ancho=0, tamano=10, padx=self.px(9),
            bg="barra", pady=self.px(5),
            al_pasar=lambda dentro: self.mostrar_nombre(
                "Configuración" if dentro else None, siempre=True))
        self.boton_config.pack(side="right")
        self.boton_actualizar = crear_boton(
            self.barra, "↑", self.pulsar_actualizar, ancho=0, tamano=10, padx=self.px(9),
            bg="barra", fg="acento", pady=self.px(5),
            al_pasar=lambda dentro: self.mostrar_nombre(
                f"Actualizar a la versión {self.info_actualizacion['version']}"
                if dentro and self.info_actualizacion else None, siempre=True))
        # width=1: el texto se recorta en vez de agrandar la ventana
        self.asa = tk.Label(self.barra, text="", bg=C["barra"], fg=C["asa"], width=1,
                            cursor="fleur", font=(FUENTE, 10))
        self.asa._roles = {"bg": "barra", "fg": "asa"}
        self.asa.pack(side="left", fill="x", expand=True)

        # Barra del panel de configuración (reemplaza a la barra principal mientras está abierto)
        self.barra_cfg = tk.Frame(raiz, bg=C["barra"])
        self.barra_cfg._roles = {"bg": "barra"}
        self.titulo_cfg = tk.Label(self.barra_cfg, text="Configuración", bg=C["barra"],
                                   fg=C["acento"], font=(FUENTE, 10), padx=self.px(9), pady=self.px(5),
                                   cursor="fleur")
        self.titulo_cfg._roles = {"bg": "barra", "fg": "acento"}
        self.titulo_cfg.pack(side="left", padx=(self.px(4), 0))
        crear_boton(self.barra_cfg, "✕", self.cerrar_config, ancho=0, tamano=10,
                    padx=self.px(9), bg="barra", hover="cerrar",
                    pady=self.px(5)).pack(side="right", padx=(0, self.px(4)))
        self.asa_cfg = tk.Label(self.barra_cfg, text="", bg=C["barra"], fg=C["asa"],
                                width=1, cursor="fleur", font=(FUENTE, 10))
        self.asa_cfg._roles = {"bg": "barra", "fg": "asa"}
        self.asa_cfg.pack(side="left", fill="x", expand=True)

        for zona in (self.barra, self.asa, self.barra_cfg, self.titulo_cfg, self.asa_cfg):
            zona.bind("<ButtonPress-1>", self.iniciar_arrastre)
            zona.bind("<B1-Motion>", self.arrastrar)
            zona.bind("<ButtonRelease-1>", lambda e: self.guardar())

        self.refrescar_recientes()
        self.fijar_tamano()  # recorre todas las pestañas para medirlas
        self.mostrar(pagina_inicial)
        if config.get("compacto") is True:
            self.aplicar_compacto(True)

        raiz.update_idletasks()
        self.x, self.y = self.limitar(config.get("x"), config.get("y"))
        raiz.geometry(f"+{self.x}+{self.y}")

        raiz.protocol("WM_DELETE_WINDOW", self.cerrar)
        raiz.bind("<Map>", self.al_restaurar)
        raiz.after(100, self.aplicar_foco)
        raiz.after(1500, self.mantener_arriba)
        avisos = avisos_de_entorno()
        if aviso_atajo:
            avisos.append(aviso_atajo)
        if avisos:
            raiz.after(400, lambda: self.avisar("\n\n".join(avisos), segundos=20))
        if self.atajo and SISTEMA in ("win32", "linux"):
            self.escucha_atajo = iniciar_atajo(*self.atajo, self.cola_atajo)
        raiz.after(100, self.revisar_atajo)
        raiz.after(500, self.revisar_actualizacion)
        if "--actualizado" in sys.argv[1:]:
            raiz.after(900, lambda: self.avisar(f"Teclado actualizado a la versión {VERSION}.", segundos=8))
            raiz.after(6000, self.limpiar_restos)
        else:
            self.limpiar_restos()
        if self.buscar_actualizaciones and ruta_ejecutable():
            raiz.after(4000, self.buscar_actualizacion)

    # -- ícono ---------------------------------------------------------------
    def poner_icono(self):
        try:
            if SISTEMA == "win32":
                self.raiz.iconbitmap(ruta_recurso("icono.ico"))
            else:
                imagen = tk.PhotoImage(file=ruta_recurso("icono.png"))
                self.raiz.iconphoto(True, imagen)
                self.raiz._imagen_icono = imagen  # evita que se libere de memoria
        except Exception:
            pass  # si falta el ícono, el programa funciona igual

    # -- páginas -------------------------------------------------------------
    def px(self, valor):
        """Medida en píxeles ajustada al zoom de la pantalla."""
        return max(1, round(valor * self.escala))

    def medidas(self):
        """(tamaño de letra, ancho, alto, radio) de las teclas según el tamaño elegido."""
        puntos, ancho, alto = TAMANOS[self.tamano]
        return (puntos, round(ancho * self.escala), round(alto * self.escala),
                max(3, round(4 * self.escala)))

    def mostrar(self, pagina):
        self.mostrar_nombre(None)
        for hijo in self.cuadricula.winfo_children():
            hijo.destroy()
        puntos, ancho, alto, radio = self.medidas()
        for i, caracter in enumerate(PAGINAS[pagina]):
            tecla = Tecla(self.cuadricula, caracter, ancho, alto, puntos, radio=radio,
                          comando=lambda c=caracter: self.escribir_caracter(c),
                          al_pasar=lambda dentro, c=caracter:
                          self.mostrar_nombre(NOMBRES.get(c) if dentro else None))
            tecla.grid(row=i // COLUMNAS, column=i % COLUMNAS,
                       padx=(0, 0 if i % COLUMNAS == COLUMNAS - 1 else self.px(3)),
                       pady=(0, self.px(3)))
        self.pagina = pagina
        self.pintar_pestanas()

    def pintar_pestanas(self):
        """Marca la pestaña activa (texto en color de acento y subrayado)."""
        for nombre, etiqueta in self.pestanas.items():
            activa = nombre == self.pagina
            etiqueta._roles["fg"] = "acento" if activa else "texto"
            etiqueta.configure(fg=C["acento"] if activa else C["texto"])
            indicador = self.indicadores[nombre]
            indicador._roles["bg"] = "acento" if activa else "barra"
            indicador.configure(bg=C[indicador._roles["bg"]])

    def cambiar_pagina(self, pagina):
        if self.en_config:
            self.cerrar_config()
        self.mostrar(pagina)
        if self.compacto:
            self.alternar_compacto(False)  # elegir una pestaña expande el teclado
        else:
            self.guardar()

    # -- modo compacto -------------------------------------------------------
    def aplicar_compacto(self, compacto):
        """Muestra u oculta la cuadrícula (queda solo la barra y los recientes)."""
        self.compacto = compacto
        if compacto:
            self.cuadricula.pack_forget()
            self.divisor.pack_forget()
        else:
            self.divisor.pack(fill="x")
            self.cuadricula.pack(padx=self.px(6), pady=(self.px(6), self.px(3)))
        self.boton_compacto.configure(text="▾" if compacto else "▴")

    def alternar_compacto(self, compacto=None):
        if self.en_config:
            self.cerrar_config()
        self.aplicar_compacto(not self.compacto if compacto is None else compacto)
        self.mostrar_nombre("Expandir" if self.compacto else "Modo compacto", siempre=True)
        self.raiz.after_idle(self.reajustar)
        self.guardar()

    # -- atajo global: ocultar / mostrar -------------------------------------
    def revisar_atajo(self):
        """Atiende los avisos del hilo del atajo (se consulta cada 100 ms)."""
        try:
            while True:
                tipo, _ = self.cola_atajo.get_nowait()
                if tipo == "atajo":
                    self.alternar_visibilidad()
                elif tipo == "error":
                    self.avisar(f"No se pudo activar el atajo {texto_atajo(*self.atajo)}: "
                                "quizá otra aplicación ya lo usa. Puede cambiarlo en el "
                                f"archivo {ruta_config()}", segundos=15)
        except queue.Empty:
            pass
        self.raiz.after(100, self.revisar_atajo)

    def alternar_visibilidad(self):
        if self.oculto or self.minimizado:
            self.mostrar_ventana()
        else:
            self.guardar()
            self.oculto = True
            self.raiz.withdraw()

    def mostrar_ventana(self):
        estaba_minimizado = self.minimizado
        self.oculto = False
        self.raiz.deiconify()  # si estaba minimizado, al_restaurar completa el trabajo
        if not estaba_minimizado:
            self.raiz.geometry(f"+{self.x}+{self.y}")
            self.raiz.attributes("-topmost", self.siempre_arriba)
            self.raiz.lift()
            self.raiz.after(80, self.aplicar_foco)

    def fijar_tamano(self):
        """Todas las pestañas ocupan lo mismo que la más grande (sin saltos de alto)."""
        ancho = alto = 0
        self.cuadricula.grid_propagate(True)  # vuelve a medir (cambio de tamaño de teclas)
        for nombre in PAGINAS:
            self.mostrar(nombre)
            self.raiz.update_idletasks()
            ancho = max(ancho, self.cuadricula.winfo_reqwidth())
            alto = max(alto, self.cuadricula.winfo_reqheight())
        self.cuadricula.configure(width=ancho, height=alto)
        self.cuadricula.grid_propagate(False)
        self.aviso.configure(wraplength=max(ancho - 12, 100))

    def mostrar_nombre(self, nombre, siempre=False):
        """Muestra el nombre del símbolo en la barra (vacía si no hay ninguno).
        Con «Mostrar nombres» desactivado solo se muestran los avisos de los botones."""
        etiqueta = self.asa_cfg if self.en_config else self.asa
        if nombre and (self.nombres or siempre):
            etiqueta.configure(text=nombre, fg=C["nombre"], font=(FUENTE, 8))
        else:
            etiqueta.configure(text="")

    # -- fila de recientes ---------------------------------------------------
    def crear_recientes(self):
        """Fila de símbolos usados recientemente: casillas con contorno, sin relleno."""
        for casilla in self.slots:
            casilla.destroy()
        puntos, ancho, alto, radio = self.medidas()
        self.slots = []
        for i in range(MAX_RECIENTES):
            casilla = Tecla(
                self.recientes_marco, "", ancho, alto - 2, puntos, radio=radio,
                relleno=None, color="acento",
                # Desde esta fila no se reordena: el símbolo no se mueve bajo el mouse.
                comando=lambda i=i: self.escribir_caracter(self.recientes[i], reordenar=False),
                al_pasar=lambda dentro, i=i: self.mostrar_nombre(
                    NOMBRES.get(self.recientes[i]) if dentro and i < len(self.recientes)
                    else None))
            casilla.grid(row=0, column=i,
                           padx=(0, 0 if i == MAX_RECIENTES - 1 else self.px(3)))
            self.slots.append(casilla)
        self.refrescar_recientes()

    def refrescar_recientes(self):
        for i, casilla in enumerate(self.slots):
            casilla.poner(self.recientes[i] if i < len(self.recientes) else "")

    def registrar_reciente(self, caracter, reordenar=True):
        if caracter in self.recientes:
            if not reordenar:
                return
            self.recientes.remove(caracter)
        self.recientes.insert(0, caracter)
        del self.recientes[MAX_RECIENTES:]
        self.refrescar_recientes()
        self.guardar()

    # -- escritura y avisos --------------------------------------------------
    def escribir_caracter(self, caracter, reordenar=True):
        self.registrar_reciente(caracter, reordenar)
        try:
            escribir(caracter)
        except Exception:
            self.copiar(caracter)
            self.avisar("No se pudo escribir el símbolo. Quedó copiado: péguelo con "
                        + ATAJO_PEGAR + ".")

    def copiar(self, texto):
        try:
            self.raiz.clipboard_clear()
            self.raiz.clipboard_append(texto)
            self.raiz.update()
        except tk.TclError:
            pass

    def avisar(self, texto, segundos=6):
        if self.trabajo_aviso is not None:
            self.raiz.after_cancel(self.trabajo_aviso)
        if self.en_config:
            return
        self.aviso.configure(text=texto)
        self.aviso.pack(fill="x", padx=3, before=self.contenido)
        self.trabajo_aviso = self.raiz.after(int(segundos * 1000), self.ocultar_aviso)
        self.raiz.after_idle(self.reajustar)

    def ocultar_aviso(self):
        if self.trabajo_aviso is not None:
            self.raiz.after_cancel(self.trabajo_aviso)
            self.trabajo_aviso = None
        self.aviso.pack_forget()
        self.raiz.after_idle(self.reajustar)

    def reajustar(self):
        """Tras cambiar de tamaño, evita que la ventana quede fuera de la pantalla."""
        if self.minimizado or self.oculto:
            return
        self.raiz.update_idletasks()
        self.x, self.y = self.limitar(self.raiz.winfo_x(), self.raiz.winfo_y())
        self.raiz.geometry(f"+{self.x}+{self.y}")

    # -- posición ------------------------------------------------------------
    def limitar(self, x, y):
        """Devuelve (x, y) corregidos para que la ventana quede dentro de la pantalla."""
        x = x if isinstance(x, int) and not isinstance(x, bool) else 120
        y = y if isinstance(y, int) and not isinstance(y, bool) else 120
        limites = limites_virtuales(self.raiz)
        if limites is None:
            return x, y
        x0, y0, x1, y1 = limites
        ancho, alto = self.raiz.winfo_reqwidth(), self.raiz.winfo_reqheight()
        x = max(x0, min(x, x1 - ancho))
        y = max(y0, min(y, y1 - alto))
        return x, y

    def iniciar_arrastre(self, evento):
        self.desplazamiento = (evento.x_root - self.raiz.winfo_x(),
                               evento.y_root - self.raiz.winfo_y())

    def arrastrar(self, evento):
        self.x, self.y = self.limitar(evento.x_root - self.desplazamiento[0],
                                      evento.y_root - self.desplazamiento[1])
        self.raiz.geometry(f"+{self.x}+{self.y}")

    def guardar(self):
        if not self.minimizado and not self.oculto:
            self.x, self.y = self.raiz.winfo_x(), self.raiz.winfo_y()
        guardar_config({"version": VERSION, "x": self.x, "y": self.y,
                        "pagina": self.pagina, "recientes": self.recientes,
                        "compacto": self.compacto,
                        "buscar_actualizaciones": self.buscar_actualizaciones,
                        "tema": self.tema, "tamano": self.tamano, "alpha": self.alpha,
                        "nombres": self.nombres, "arriba": self.siempre_arriba,
                        "atajo": texto_atajo(*self.atajo).lower() if self.atajo else ""})

    # -- actualización automática --------------------------------------------
    def limpiar_restos(self, intento=0):
        if not borrar_restos() and intento < 3:
            self.raiz.after(20000, lambda: self.limpiar_restos(intento + 1))

    def buscar_actualizacion(self):
        """Consulta GitHub en segundo plano (no demora el teclado). Se repite cada 6 horas."""
        if self.trabajo_busqueda is not None:
            self.raiz.after_cancel(self.trabajo_busqueda)
            self.trabajo_busqueda = None
        if not self.buscar_actualizaciones:
            return

        def trabajo():
            try:
                info = consultar_actualizacion()
            except Exception:
                info = None  # sin internet o GitHub no responde: se intenta más tarde, sin avisar
            self.cola_actualizacion.put(("consulta", info))
        threading.Thread(target=trabajo, daemon=True).start()
        if self.info_actualizacion is None:
            self.trabajo_busqueda = self.raiz.after(6 * 3600 * 1000, self.buscar_actualizacion)

    def revisar_actualizacion(self):
        """Atiende los resultados del hilo de actualización (se consulta cada 500 ms)."""
        try:
            while True:
                tipo, dato = self.cola_actualizacion.get_nowait()
                if tipo == "consulta" and dato and self.info_actualizacion is None:
                    self.info_actualizacion = dato
                    self.boton_actualizar.pack(side="right", after=self.boton_config)
                    self.avisar(f"Hay una versión nueva del teclado ({dato['version']}). "
                                "Haga clic en ↑ para actualizar.", segundos=15)
                elif tipo == "lista":
                    self.terminar_actualizacion(dato)
                elif tipo == "error":
                    self.actualizando = False
                    self.forzar_navegador = True
                    self.avisar("No se pudo actualizar automáticamente. Haga clic en ↑ para abrir "
                                "la página de descarga.", segundos=15)
        except queue.Empty:
            pass
        self.raiz.after(500, self.revisar_actualizacion)

    def pulsar_actualizar(self):
        info = self.info_actualizacion
        if not info or self.actualizando:
            return
        if self.forzar_navegador or not puede_autoactualizar():
            webbrowser.open(info["pagina"])
            self.avisar("Se abrió la página de descarga de la versión nueva en su navegador.", segundos=10)
            return
        self.actualizando = True
        self.avisar(f"Descargando la versión {info['version']}… no cierre el teclado.", segundos=300)

        def trabajo():
            try:
                actual = ruta_ejecutable()
                nuevo = descargar_actualizacion(info, os.path.dirname(actual))
                try:
                    reemplazar_ejecutable(actual, nuevo)
                except BaseException:
                    try:
                        os.remove(nuevo)
                    except OSError:
                        pass
                    raise
                self.cola_actualizacion.put(("lista", actual))
            except Exception:
                self.cola_actualizacion.put(("error", None))
        threading.Thread(target=trabajo, daemon=True).start()

    def terminar_actualizacion(self, ruta):
        """El programa nuevo ya está en su lugar: se abre y este se cierra."""
        self.guardar()
        liberar_instancia()
        try:
            relanzar(ruta)
        except Exception:
            if SISTEMA == "win32":
                instancia_unica()  # no se pudo abrir el nuevo: este sigue funcionando
            self.actualizando = False
            self.avisar("El teclado se actualizó. Ciérrelo y vuelva a abrirlo para usar la versión nueva.",
                        segundos=20)
            return
        self.raiz.destroy()

    # -- configuración -------------------------------------------------------
    def fijar_alpha(self, valor):
        self.alpha = round(min(1.0, max(ALPHA_MINIMA, valor)), 2)
        try:
            self.raiz.attributes("-alpha", self.alpha)
        except tk.TclError:
            pass  # algunos sistemas no admiten transparencia

    def alternar_config(self):
        if self.en_config:
            self.cerrar_config()
        else:
            self.abrir_config()

    def aplicar_foco(self):
        evitar_foco(self.raiz, self.siempre_arriba)

    def abrir_config(self):
        if self.compacto:
            self.aplicar_compacto(False)
        self.ocultar_aviso()
        self.raiz.update_idletasks()
        self.ancho_config = self.raiz.winfo_reqwidth()  # el panel no achica la ventana
        self.en_config = True
        self.barra.pack_forget()
        self.contenido.pack_forget()
        self.barra_cfg.pack(fill="x")
        self.construir_config()
        self.mostrar_nombre(None)
        self.raiz.after_idle(self.reajustar)

    def cerrar_config(self):
        self.en_config = False
        self.mostrar_nombre(None)
        if self.panel is not None:
            self.panel.pack_forget()
        self.barra_cfg.pack_forget()
        self.barra.pack(fill="x")
        self.contenido.pack(fill="x")
        self.raiz.after_idle(self.reajustar)

    def construir_config(self):
        """Arma el panel de configuración (se rehace al cambiar algo, para reflejarlo)."""
        if self.panel is not None:
            self.panel.destroy()
        panel = self.panel = tk.Frame(self.raiz, bg=C["fondo"])
        panel._roles = {"bg": "fondo"}
        fijo = tk.Frame(panel, width=self.ancho_config, height=1, bg=C["fondo"])
        fijo._roles = {"bg": "fondo"}
        fijo.pack()  # fija el ancho mínimo del panel

        def texto(padre, contenido, color="asa", comando=None, padx=0):
            etiqueta = tk.Label(padre, text=contenido, font=(FUENTE, 9), bg=C["fondo"],
                                fg=C[color], cursor="hand2" if comando else "")
            etiqueta._roles = {"bg": "fondo", "fg": color}
            if comando:
                etiqueta.bind("<Button-1>", lambda e: comando())
            etiqueta.pack(side="left", padx=padx)
            return etiqueta

        def fila(titulo, ultima=False):
            marco = tk.Frame(panel, bg=C["fondo"])
            marco._roles = {"bg": "fondo"}
            marco.pack(fill="x")
            interior = tk.Frame(marco, bg=C["fondo"])
            interior._roles = {"bg": "fondo"}
            interior.pack(fill="x", padx=self.px(10), pady=self.px(7))
            rotulo = texto(interior, titulo, color="texto")
            zona = tk.Frame(interior, bg=C["fondo"])
            zona._roles = {"bg": "fondo"}
            zona.pack(side="right")
            if not ultima:
                linea = tk.Frame(marco, height=1, bg=C["hover"])
                linea._roles = {"bg": "hover"}
                linea.pack(fill="x")
            return zona, (marco, interior, rotulo)

        # Color: un círculo por tema (con el color de acento de ese tema)
        zona, _ = fila("Color")
        for nombre, tema in TEMAS.items():
            lado, hueco = self.px(18), self.px(4)
            muestra = tk.Canvas(zona, width=lado + hueco, height=lado, bd=0,
                                highlightthickness=0, bg=C["fondo"], cursor="hand2")
            elegido = nombre == self.tema
            grosor = self.px(2) if elegido else self.px(1)
            borde = C["texto"] if elegido else C["hover"]
            imagen = forma_png(muestra, lado, lado, lado / 2, tema["acento"], borde, grosor)
            if imagen is not None:
                muestra.imagen = imagen  # referencia para que Tk no la descarte
                muestra.create_image(hueco, 0, anchor="nw", image=imagen)
            else:
                muestra.create_oval(hueco, 1, lado + hueco - 1, lado - 1, fill=tema["acento"],
                                    width=grosor, outline=borde)
            muestra.bind("<Button-1>", lambda e, n=nombre: self.aplicar_tema(n))
            muestra.bind("<Enter>", lambda e, n=nombre: self.mostrar_nombre(n, siempre=True))
            muestra.bind("<Leave>", lambda e: self.mostrar_nombre(None))
            muestra.pack(side="left")

        zona, _ = fila("Tamaño de teclas")
        for i, nombre in enumerate(TAMANOS):
            if i:
                texto(zona, " · ")
            texto(zona, nombre, color="acento" if nombre == self.tamano else "asa",
                  comando=lambda n=nombre: self.cambiar_tamano(n))

        zona, _ = fila("Transparencia")
        texto(zona, "−", color="texto", comando=lambda: self.cambiar_alpha(-0.05), padx=6)
        texto(zona, f"{round(self.alpha * 100)} %")
        texto(zona, "+", color="texto", comando=lambda: self.cambiar_alpha(0.05), padx=6)

        for titulo, valor, comando in (
                ("Mostrar nombres", self.nombres, self.alternar_nombres),
                ("Siempre encima", self.siempre_arriba, self.alternar_arriba),
                ("Buscar actualizaciones", self.buscar_actualizaciones, self.alternar_busqueda)):
            zona, _ = fila(titulo)
            Interruptor(zona, valor, comando, self.px(26), self.px(14), self.px(2)).pack()

        zona, _ = fila("Atajo")
        texto(zona, texto_atajo(*self.atajo) if self.atajo else "Desactivado")

        zona, (marco, interior, rotulo) = fila("Restablecer", ultima=True)
        valores = texto(zona, "Valores originales")
        for pieza in (marco, interior, rotulo, zona, valores):
            pieza.configure(cursor="hand2")
            pieza.bind("<Button-1>", lambda e: self.restablecer())
        panel.pack(fill="x")

    def aplicar_tema(self, nombre):
        if nombre not in TEMAS:
            return
        self.tema = nombre
        C.update(TEMAS[nombre])
        self.raiz.configure(bg=C["fondo"])
        recolorear(self.raiz)
        self.mostrar(self.pagina)
        self.refrescar_recientes()
        if self.en_config:
            self.construir_config()
        self.guardar()

    def cambiar_tamano(self, nombre):
        if nombre not in TAMANOS:
            return
        self.tamano = nombre
        self.crear_recientes()
        pagina = self.pagina
        self.fijar_tamano()
        self.mostrar(pagina)
        if self.en_config:
            self.construir_config()
        self.raiz.after_idle(self.reajustar)
        self.guardar()

    def cambiar_alpha(self, paso):
        self.fijar_alpha(self.alpha + paso)
        if self.en_config:
            self.construir_config()
        self.guardar()

    def alternar_nombres(self):
        self.nombres = not self.nombres
        self.construir_config()
        self.guardar()

    def alternar_arriba(self):
        self.siempre_arriba = not self.siempre_arriba
        self.raiz.attributes("-topmost", self.siempre_arriba)
        self.aplicar_foco()
        self.construir_config()
        self.guardar()

    def alternar_busqueda(self):
        self.buscar_actualizaciones = not self.buscar_actualizaciones
        if self.buscar_actualizaciones:
            if ruta_ejecutable():
                self.buscar_actualizacion()
        elif self.trabajo_busqueda is not None:
            self.raiz.after_cancel(self.trabajo_busqueda)
            self.trabajo_busqueda = None
        self.construir_config()
        self.guardar()

    def restablecer(self):
        self.nombres = True
        if not self.siempre_arriba:
            self.alternar_arriba()
        if not self.buscar_actualizaciones:
            self.alternar_busqueda()
        self.fijar_alpha(ALPHA_PREDETERMINADA)
        self.cambiar_tamano(TAMANO_PREDETERMINADO)
        self.aplicar_tema(TEMA_PREDETERMINADO)

    # -- minimizar / restaurar / cerrar --------------------------------------
    def minimizar_ventana(self):
        """Minimiza el teclado a la barra de tareas, como una ventana común."""
        self.x, self.y = self.raiz.winfo_x(), self.raiz.winfo_y()
        self.minimizado = True
        # Una ventana sin borde no puede minimizarse ni aparecer en la barra de
        # tareas, así que se le devuelve el borde mientras está minimizada.
        self.raiz.update_idletasks()
        self.raiz.overrideredirect(False)
        self.raiz.iconify()

    def al_restaurar(self, evento):
        """Al volver desde la barra de tareas, se restablece la ventana sin borde."""
        if evento.widget is not self.raiz or not self.minimizado:
            return
        if self.raiz.state() != "normal":
            return
        self.minimizado = False
        self.raiz.overrideredirect(True)
        self.x, self.y = self.limitar(self.x, self.y)
        self.raiz.geometry(f"+{self.x}+{self.y}")
        self.raiz.attributes("-topmost", self.siempre_arriba)
        self.raiz.after(80, self.aplicar_foco)

    def mantener_arriba(self):
        if self.siempre_arriba and not self.minimizado and not self.oculto:
            self.raiz.attributes("-topmost", True)
            self.raiz.lift()
        self.raiz.after(1500, self.mantener_arriba)

    def cerrar(self):
        self.guardar()
        self.raiz.destroy()

    def ejecutar(self):
        self.raiz.mainloop()


def autodiagnostico():
    """Comprueba que el módulo de escritura esté disponible (lo usa la compilación)."""
    if SISTEMA != "win32":
        try:
            from pynput.keyboard import Controller
            Controller()
        except Exception as error:
            print("ERROR: no se puede escribir:", error)
            return 1
    print("OK")
    return 0


def main():
    if "--version" in sys.argv[1:]:
        print(VERSION)
        return
    if "--autodiagnostico" in sys.argv[1:]:
        sys.exit(autodiagnostico())
    if SISTEMA == "win32":
        activar_dpi()  # debe hacerse antes de crear la ventana
        # Tras una actualización, la copia anterior tarda un instante en cerrarse: se la espera.
        for _ in range(20 if "--actualizado" in sys.argv[1:] else 1):
            if instancia_unica():
                break
            liberar_instancia()
            time.sleep(0.5)
        else:
            avisar_ya_abierto()
            return
    Teclado().ejecutar()


if __name__ == "__main__":
    main()
