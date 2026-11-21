"""Pone en teclado_griego.py el número de versión que indica la etiqueta de GitHub.

Por qué existe: la versión que el programa cree tener (la constante VERSION) se compara con la de
los releases publicados para avisar «hay una versión nueva». Si al publicar se olvida actualizar
VERSION, el programa se actualiza pero sigue creyéndose de la versión anterior y vuelve a avisar
para siempre (pasó con las etiquetas teclado-v1.7 y teclado-v1.8.1). Para que no dependa de que
alguien se acuerde, la compilación toma el número de la etiqueta.

Uso (desde esta carpeta):
    python fijar_version.py teclado-v1.8.2          reemplaza VERSION por "1.8.2" y la muestra
    python fijar_version.py --leer teclado-v1.8.2   solo muestra la versión que indica la etiqueta
"""
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PROGRAMA = os.path.join(AQUI, "teclado_griego.py")
# La misma regla que usa el programa para reconocer sus etiquetas (se comprueba en las pruebas).
ETIQUETA = re.compile(r"^teclado(?:-cient[ií]fico)?-v(\d+(?:\.\d+)*)$", re.IGNORECASE)
LINEA_VERSION = re.compile(rb'^VERSION = "[^"\r\n]*"', re.MULTILINE)


def version_de_etiqueta(etiqueta):
    """«teclado-v1.8.2» (o «refs/tags/teclado-v1.8.2») -> «1.8.2». None si no es una etiqueta del teclado."""
    nombre = str(etiqueta).strip().split("/")[-1]
    coincide = ETIQUETA.match(nombre)
    return coincide.group(1) if coincide else None


def fijar(version, ruta=PROGRAMA):
    """Reemplaza la constante VERSION del programa (conserva los finales de línea). True si cambió algo."""
    with open(ruta, "rb") as f:
        datos = f.read()
    if len(LINEA_VERSION.findall(datos)) != 1:
        raise ValueError("no se encontró una única línea «VERSION = \"…\"» en " + ruta)
    nuevo = LINEA_VERSION.sub(('VERSION = "%s"' % version).encode("utf-8"), datos, count=1)
    if nuevo == datos:
        return False
    with open(ruta, "wb") as f:
        f.write(nuevo)
    return True


def leer(ruta=PROGRAMA):
    """Versión que tiene escrita el programa."""
    with open(ruta, "rb") as f:
        coincide = re.search(rb'^VERSION = "([^"\r\n]*)"', f.read(), re.MULTILINE)
    return coincide.group(1).decode("utf-8") if coincide else None


def main(argumentos):
    solo_leer = "--leer" in argumentos
    etiquetas = [a for a in argumentos if not a.startswith("--")]
    if len(etiquetas) != 1:
        print(__doc__)
        return 2
    version = version_de_etiqueta(etiquetas[0])
    if version is None:
        print("La etiqueta «%s» no es de una versión del teclado (debe ser como teclado-v1.8.2)." % etiquetas[0],
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
    print("VERSION %s." % ("actualizada" if cambio else "ya era la correcta"), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
