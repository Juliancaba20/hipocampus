"""Genera ui/datos.js a partir del teclado de Python, para que los símbolos, los nombres y los
temas de ambas versiones sean exactamente los mismos (sin copiarlos a mano).

Uso (desde la carpeta apps/teclado-tauri):   python tools/generar_datos.py
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "..", "teclado"))
import teclado_griego as t  # noqa: E402

datos = {
    "paginas": t.PAGINAS,
    "nombres": t.NOMBRES,
    "temas": t.TEMAS,
    "temaPredeterminado": t.TEMA_PREDETERMINADO,
    "tamanos": {n: {"letra": v[0], "ancho": v[1], "alto": v[2]} for n, v in t.TAMANOS.items()},
    "tamanoPredeterminado": t.TAMANO_PREDETERMINADO,
    "columnas": t.COLUMNAS,
    "maxRecientes": t.MAX_RECIENTES,
    "alphaPredeterminada": t.ALPHA_PREDETERMINADA,
    "alphaMinima": t.ALPHA_MINIMA,
    "atajoPredeterminado": t.ATAJO_PREDETERMINADO,
    "punto": t.PUNTO,
}
salida = os.path.join(AQUI, "..", "ui", "datos.js")
with open(salida, "w", encoding="utf-8", newline="\n") as f:
    f.write("// Archivo generado por tools/generar_datos.py: no se edita a mano.\n")
    f.write("const DATOS = {\n")
    for clave, valor in datos.items():
        # una línea por dato (las listas de símbolos quedan compactas y fáciles de revisar)
        f.write(f"  {json.dumps(clave)}: {json.dumps(valor, ensure_ascii=False)},\n")
    f.write("};\n")
    f.write("if (typeof module !== 'undefined') module.exports = DATOS;\n")
print("Escrito", os.path.normpath(salida))
