"""Pone en el teclado 2.x la versión que indica la etiqueta de GitHub.

Igual que en la versión de Python (apps/teclado/fijar_version.py): el número que lleva el programa
por dentro tiene que ser el de su etiqueta. Si no, los programas que comparan versiones (el
actualizador de la 1.x y, más adelante, el de la 2.x) avisarían de una «versión nueva» para siempre.

Cambia Cargo.toml y tauri.conf.json; la interfaz muestra la versión que informa el programa.

Uso (desde apps/teclado-tauri):
    python tools/fijar_version.py teclado-v2.0     escribe 2.0.0 en los dos archivos
    python tools/fijar_version.py --leer teclado-v2.0
"""
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARGO = os.path.join(RAIZ, "src-tauri", "Cargo.toml")
CONF = os.path.join(RAIZ, "src-tauri", "tauri.conf.json")
ETIQUETA = re.compile(r"^teclado(?:-cient[ií]fico)?-v(\d+(?:\.\d+)*)$", re.IGNORECASE)


def version_de_etiqueta(etiqueta):
    """«teclado-v2.0» -> «2.0.0» (Cargo y Tauri exigen tres números). None si no es una etiqueta válida."""
    nombre = str(etiqueta).strip().split("/")[-1]
    coincide = ETIQUETA.match(nombre)
    if not coincide:
        return None
    partes = coincide.group(1).split(".")
    if len(partes) > 3:
        return None
    return ".".join(partes + ["0"] * (3 - len(partes)))


def _reemplazar(ruta, patron, nuevo):
    with open(ruta, "rb") as f:
        datos = f.read()
    coincidencias = patron.findall(datos)
    if len(coincidencias) != 1:
        raise ValueError("no se encontró una única línea de versión en " + ruta)
    resultado = patron.sub(nuevo, datos, count=1)
    if resultado != datos:
        with open(ruta, "wb") as f:
            f.write(resultado)
        return True
    return False


def fijar(version, cargo=CARGO, conf=CONF):
    # Solo la versión del paquete (la primera línea «version = ...» de [package]).
    cambio = _reemplazar(cargo, re.compile(rb'^version = "[^"\r\n]*"', re.MULTILINE),
                         ('version = "%s"' % version).encode())
    cambio |= _reemplazar(conf, re.compile(rb'^(\s*)"version": "[^"\r\n]*"', re.MULTILINE),
                          ('\\1"version": "%s"' % version).encode())
    return cambio


def leer(cargo=CARGO, conf=CONF):
    """(versión de Cargo.toml, versión de tauri.conf.json)."""
    with open(cargo, encoding="utf-8") as f:
        en_cargo = re.search(r'^version = "([^"\r\n]*)"', f.read(), re.MULTILINE).group(1)
    with open(conf, encoding="utf-8") as f:
        en_conf = json.load(f)["version"]
    return en_cargo, en_conf


def main(argumentos):
    solo_leer = "--leer" in argumentos
    etiquetas = [a for a in argumentos if not a.startswith("--")]
    if len(etiquetas) != 1:
        print(__doc__)
        return 2
    version = version_de_etiqueta(etiquetas[0])
    if version is None:
        print("La etiqueta «%s» no es de una versión del teclado (debe ser como teclado-v2.0)." % etiquetas[0],
              file=sys.stderr)
        return 1
    if solo_leer:
        print(version)
        return 0
    try:
        cambio = fijar(version)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 3
    print(version)
    print("Versión %s." % ("actualizada" if cambio else "ya era la correcta"), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
