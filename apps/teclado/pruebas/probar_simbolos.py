"""Pruebas de los símbolos del teclado (sin pantalla: solo datos)."""
import unittest

import teclado_griego as t


class ProbarSimbolos(unittest.TestCase):
    def test_sin_repetidos_dentro_de_una_pestana(self):
        for nombre, pagina in t.PAGINAS.items():
            self.assertEqual(len(pagina), len(set(pagina)), nombre)

    def test_cuadrado_y_cubo_en_dos_pestanas_son_el_mismo_simbolo(self):
        for c in "²³":
            self.assertIn(c, t.PAGINAS["±"])
            self.assertIn(c, t.PAGINAS["H₂"])
        # Un solo símbolo válido: «recientes» lo identifica por el carácter.
        self.assertEqual(sum(1 for c in t.SIMBOLOS_VALIDOS if c == "²"), 1)

    def test_v_punto_existe_y_tiene_nombre(self):
        v = "V" + t.PUNTO
        self.assertIn(v, t.PAGINAS["∫"])
        self.assertIn(v, t.NOMBRES)

    def test_todo_simbolo_tiene_nombre(self):
        self.assertEqual([c for c in t.SIMBOLOS_VALIDOS if c not in t.NOMBRES], [])

    def test_ninguna_pestana_pasa_de_tres_filas(self):
        for nombre, pagina in t.PAGINAS.items():
            self.assertLessEqual(len(pagina), 3 * t.COLUMNAS, nombre)

    def test_solo_caracteres_del_plano_basico(self):
        # La escritura en Windows envía un código de 16 bits por carácter.
        for pagina in t.PAGINAS.values():
            for simbolo in pagina:
                self.assertTrue(all(ord(c) <= 0xFFFF for c in simbolo))


if __name__ == "__main__":
    unittest.main()
