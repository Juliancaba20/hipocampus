"""Pruebas de la versión: que la del programa sea válida, que se tome de la etiqueta y que el
actualizador no ofrezca una «actualización» a quien ya tiene la versión publicada."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import fijar_version as fv
import teclado_griego as t

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ProbarVersion(unittest.TestCase):
    def test_la_version_del_programa_es_valida(self):
        self.assertIsNotNone(t.version_a_tupla(t.VERSION), t.VERSION)
        self.assertEqual(fv.leer(), t.VERSION)

    def test_etiquetas_de_todos_los_tipos(self):
        for etiqueta, esperada in [("teclado-v1.8.2", "1.8.2"), ("Teclado-v2.0", "2.0"),
                                   ("teclado-cientifico-v1.9", "1.9"), ("Teclado-científico-v3", "3"),
                                   ("refs/tags/teclado-v1.8.2", "1.8.2")]:
            self.assertEqual(fv.version_de_etiqueta(etiqueta), esperada, etiqueta)
        for mala in ["", "v1.8", "anotomia-v1.0", "teclado-1.8", "teclado-v", "teclado-v1.", "teclado-vX.Y",
                     "teclado-v1.8-beta"]:
            self.assertIsNone(fv.version_de_etiqueta(mala), mala)

    def test_la_regla_de_etiquetas_es_la_misma_que_la_del_programa(self):
        for etiqueta in ["teclado-v1.8.2", "Teclado-v2.0", "teclado-cientifico-v1.9", "Teclado-científico-v3",
                         "teclado-v1.8-beta", "anotomia-v1.0", "teclado-v", "teclado-1.8"]:
            programa = t.ETIQUETA_TECLADO.match(etiqueta)
            self.assertEqual(fv.version_de_etiqueta(etiqueta), programa.group(1) if programa else None, etiqueta)

    def copia(self, contenido):
        carpeta = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, carpeta, True)
        ruta = os.path.join(carpeta, "teclado_griego.py")
        with open(ruta, "wb") as f:
            f.write(contenido)
        return ruta

    def test_fijar_cambia_solo_la_version_y_conserva_los_finales_de_linea(self):
        original = b'import os\r\nVERSION = "1.8"\r\nOTRA = "1.8"\r\nprint(VERSION)\r\n'
        ruta = self.copia(original)
        self.assertTrue(fv.fijar("1.8.2", ruta))
        with open(ruta, "rb") as f:
            self.assertEqual(f.read(), b'import os\r\nVERSION = "1.8.2"\r\nOTRA = "1.8"\r\nprint(VERSION)\r\n')
        self.assertFalse(fv.fijar("1.8.2", ruta))        # ya era la correcta
        self.assertEqual(fv.leer(ruta), "1.8.2")

    def test_fijar_con_finales_de_linea_unix(self):
        ruta = self.copia(b'VERSION = "1.6"\nx = 1\n')
        fv.fijar("1.7", ruta)
        with open(ruta, "rb") as f:
            self.assertEqual(f.read(), b'VERSION = "1.7"\nx = 1\n')

    def test_fijar_falla_si_no_hay_una_unica_linea_de_version(self):
        for contenido in (b"x = 1\n", b'VERSION = "1"\nVERSION = "2"\n'):
            with self.assertRaises(ValueError):
                fv.fijar("1.9", self.copia(contenido))

    def ejecutar(self, *args):
        return subprocess.run([sys.executable, os.path.join(AQUI, "fijar_version.py"), *args],
                              capture_output=True, text=True)

    def test_como_programa_de_linea_de_comandos(self):
        ok = self.ejecutar("--leer", "teclado-v1.8.2")
        self.assertEqual((ok.returncode, ok.stdout.strip()), (0, "1.8.2"))
        malo = self.ejecutar("--leer", "anotomia-v1.0")
        self.assertEqual(malo.returncode, 1)
        self.assertEqual(self.ejecutar().returncode, 2)

    # -- el problema real: etiqueta más nueva que la versión que lleva escrita el programa ------
    def publicaciones(self, *etiquetas):
        archivo = t.ARCHIVOS_ACTUALIZACION["win32"]
        return [{"tag_name": e, "draft": False, "prerelease": False,
                 "html_url": "https://github.com/x/y/releases/tag/" + e,
                 "assets": [{"name": archivo, "state": "uploaded", "size": 100,
                             "browser_download_url": "https://github.com/x/y/releases/download/%s/%s" % (e, archivo)}]}
                for e in etiquetas]

    def test_si_la_version_del_programa_no_acompana_a_la_etiqueta_el_aviso_no_termina_nunca(self):
        archivo = t.ARCHIVOS_ACTUALIZACION["win32"]
        publicadas = self.publicaciones("teclado-v1.8.1", "teclado-v1.8")
        # Lo que pasó: el release 1.8.1 llevaba un programa que decía «1.8» por dentro.
        self.assertEqual(t.elegir_version(publicadas, archivo, actual="1.8")["version"], "1.8.1")
        # Con la versión correcta por dentro, el aviso desaparece.
        self.assertIsNone(t.elegir_version(publicadas, archivo, actual="1.8.1"))

    def test_con_la_version_de_la_etiqueta_no_hay_aviso_y_con_una_mayor_si(self):
        archivo = t.ARCHIVOS_ACTUALIZACION["win32"]
        version = fv.leer()
        self.assertIsNone(t.elegir_version(self.publicaciones("teclado-v" + version), archivo, actual=version))
        siguiente = t.elegir_version(self.publicaciones("teclado-v" + version, "teclado-v99.0"), archivo, actual=version)
        self.assertEqual(siguiente["version"], "99.0")


if __name__ == "__main__":
    unittest.main()
