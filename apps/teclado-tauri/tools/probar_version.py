"""Pruebas de la versión del teclado 2.x:  python -m unittest tools.probar_version   (desde apps/teclado-tauri)"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from tools import fijar_version as fv

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ProbarVersion(unittest.TestCase):
    def test_etiquetas(self):
        for etiqueta, esperada in [("teclado-v2.0", "2.0.0"), ("Teclado-v2.1", "2.1.0"), ("teclado-v2.1.3", "2.1.3"),
                                   ("teclado-cientifico-v3", "3.0.0"), ("refs/tags/teclado-v2.0", "2.0.0"),
                                   ("Teclado-científico-v10.2", "10.2.0")]:
            self.assertEqual(fv.version_de_etiqueta(etiqueta), esperada, etiqueta)
        for mala in ["", "teclado-v", "teclado-v2.0.1.1", "anotomia-v2.0", "teclado-2.0", "teclado-v2.0-beta"]:
            self.assertIsNone(fv.version_de_etiqueta(mala), mala)

    def test_el_proyecto_tiene_la_misma_version_en_los_dos_archivos(self):
        en_cargo, en_conf = fv.leer()
        self.assertEqual(en_cargo, en_conf)
        self.assertRegex(en_cargo, r"^\d+\.\d+\.\d+$")

    def copia(self):
        carpeta = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, carpeta, True)
        cargo, conf = os.path.join(carpeta, "Cargo.toml"), os.path.join(carpeta, "tauri.conf.json")
        shutil.copy(fv.CARGO, cargo)
        shutil.copy(fv.CONF, conf)
        return cargo, conf

    def test_fijar_cambia_solo_la_version_del_paquete(self):
        cargo, conf = self.copia()
        with open(cargo, encoding="utf-8") as f:
            antes = f.read()
        self.assertTrue(fv.fijar("2.3.4", cargo, conf))
        self.assertEqual(fv.leer(cargo, conf), ("2.3.4", "2.3.4"))
        with open(cargo, encoding="utf-8") as f:
            despues = f.read()
        # las dependencias (con «version = » dentro de llaves) no se tocan
        self.assertEqual(antes.count("version ="), despues.count("version ="))
        self.assertIn('tauri = { version = "2.12"', despues)
        with open(conf, encoding="utf-8") as f:
            json.load(f)                                   # sigue siendo JSON válido
        self.assertFalse(fv.fijar("2.3.4", cargo, conf))   # repetir no cambia nada

    def test_como_programa_de_linea_de_comandos(self):
        ejecutar = lambda *a: subprocess.run([sys.executable, os.path.join(RAIZ, "tools", "fijar_version.py"), *a],
                                             capture_output=True, text=True)
        ok = ejecutar("--leer", "teclado-v2.0")
        self.assertEqual((ok.returncode, ok.stdout.strip()), (0, "2.0.0"))
        self.assertEqual(ejecutar("--leer", "nada").returncode, 1)
        self.assertEqual(ejecutar().returncode, 2)


if __name__ == "__main__":
    unittest.main()
