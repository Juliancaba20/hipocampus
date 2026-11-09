"""Pruebas de temas y configuración (los de interfaz se omiten si no hay pantalla)."""
import json
import os
import shutil
import tempfile
import unittest

import teclado_griego as t


def luminancia(hexa):
    canales = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in canales]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contraste(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


class ProbarFormasSuavizadas(unittest.TestCase):
    def test_las_esquinas_tienen_transparencia_parcial(self):
        filas = t.pixeles_forma(35, 28, 4, "#313244", "#45475a", 1)
        alfas = {px for fila in filas for px in fila[3::4]}
        self.assertTrue(any(0 < a < 255 for a in alfas))   # bordes suavizados
        self.assertEqual(filas[0][3], 0)                    # el vértice queda transparente
        centro = filas[14][17 * 4:17 * 4 + 4]
        self.assertEqual(tuple(centro), (0x31, 0x32, 0x44, 255))  # el interior es el relleno

    def test_casilla_sin_relleno_es_hueca(self):
        filas = t.pixeles_forma(35, 26, 4, None, "#45475a", 1)
        self.assertEqual(filas[13][17 * 4 + 3], 0)          # interior transparente
        self.assertGreater(filas[0][17 * 4 + 3], 200)       # borde del contorno opaco

    def test_png_valido(self):
        png = t.codificar_png(2, 2, t.pixeles_forma(2, 2, 0, "#ffffff"))
        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(png.endswith(b"IEND\xaeB`\x82"))


class ProbarTemas(unittest.TestCase):
    def test_todos_los_temas_definen_los_mismos_colores(self):
        for nombre, tema in t.TEMAS.items():
            self.assertEqual(set(tema), set(t.CLAVES_TEMA), nombre)
            for valor in tema.values():
                self.assertRegex(valor, r"^#[0-9a-fA-F]{6}$", nombre)

    def test_texto_legible_sobre_cada_fondo(self):
        for nombre, tema in t.TEMAS.items():
            for fondo in ("fondo", "boton", "barra", "reciente"):
                self.assertGreaterEqual(contraste(tema["texto"], tema[fondo]), 4.5, (nombre, fondo))
                self.assertGreaterEqual(contraste(tema["acento"], tema[fondo]), 3.0, (nombre, fondo))

    def test_tema_y_tamano_predeterminados_existen(self):
        self.assertIn(t.TEMA_PREDETERMINADO, t.TEMAS)
        self.assertIn(t.TAMANO_PREDETERMINADO, t.TAMANOS)
        self.assertTrue(t.ALPHA_MINIMA <= t.ALPHA_PREDETERMINADA <= 1)


@unittest.skipUnless(os.environ.get("DISPLAY") or os.name == "nt", "requiere pantalla")
class ProbarInterfaz(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        self.anterior = os.environ.get("XDG_CONFIG_HOME")
        os.environ["XDG_CONFIG_HOME"] = self.carpeta
        os.environ["APPDATA"] = self.carpeta
        t.escribir = lambda texto: None
        self.k = None

    def tearDown(self):
        if self.k is not None:
            try:
                self.k.raiz.destroy()
            except Exception:
                pass
        shutil.rmtree(self.carpeta, ignore_errors=True)
        if self.anterior is None:
            os.environ.pop("XDG_CONFIG_HOME", None)
        else:
            os.environ["XDG_CONFIG_HOME"] = self.anterior

    def crear(self, config=None):
        if config is not None:
            ruta = t.ruta_config()
            os.makedirs(os.path.dirname(ruta), exist_ok=True)
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump(config, f)
        self.k = t.Teclado()
        return self.k

    def test_configuracion_invalida_usa_valores_predeterminados(self):
        k = self.crear({"tema": "Inexistente", "tamano": 5, "alpha": "x", "nombres": 3})
        self.assertEqual((k.tema, k.tamano, k.alpha), (t.TEMA_PREDETERMINADO,
                                                       t.TAMANO_PREDETERMINADO,
                                                       t.ALPHA_PREDETERMINADA))
        k2 = self.crear({"alpha": 0.1})
        self.assertEqual(k2.alpha, t.ALPHA_PREDETERMINADA)

    def test_cambios_se_guardan_y_se_recuperan(self):
        k = self.crear()
        k.aplicar_tema("Océano")
        k.cambiar_tamano("Grande")
        k.fijar_alpha(0.8)
        k.alternar_nombres()
        k.guardar()
        k.raiz.destroy()
        k2 = self.crear()
        self.assertEqual((k2.tema, k2.tamano, k2.alpha, k2.nombres), ("Océano", "Grande", 0.8, False))

    def test_todos_los_temas_y_tamanos_se_aplican_sin_errores(self):
        k = self.crear()
        k.abrir_config()
        for nombre in t.TEMAS:
            k.aplicar_tema(nombre)
            self.assertEqual(k.raiz.cget("bg"), t.TEMAS[nombre]["fondo"])
        for nombre in t.TAMANOS:
            k.cambiar_tamano(nombre)

    def test_restablecer_vuelve_a_los_valores_originales(self):
        k = self.crear()
        k.aplicar_tema("Claro")
        k.cambiar_tamano("Pequeño")
        k.fijar_alpha(0.7)
        k.nombres = False
        k.restablecer()
        self.assertEqual((k.tema, k.tamano, k.alpha, k.nombres),
                         (t.TEMA_PREDETERMINADO, t.TAMANO_PREDETERMINADO,
                          t.ALPHA_PREDETERMINADA, True))

    def test_configuracion_y_pestanas_se_alternan(self):
        k = self.crear()
        k.abrir_config()
        self.assertTrue(k.en_config)
        k.cambiar_pagina("∫")
        self.assertFalse(k.en_config)
        self.assertEqual(k.pagina, "∫")
        k.alternar_compacto()
        k.abrir_config()  # abrir la configuración expande el teclado compacto
        self.assertFalse(k.compacto)

    def test_el_ancho_no_depende_de_la_pestana_ni_de_la_configuracion(self):
        k = self.crear()
        k.raiz.update_idletasks()
        ancho = k.raiz.winfo_reqwidth()
        for pagina in t.PAGINAS:
            k.cambiar_pagina(pagina)
            k.raiz.update_idletasks()
            self.assertEqual(k.raiz.winfo_reqwidth(), ancho, pagina)
        k.abrir_config()
        k.raiz.update_idletasks()
        self.assertEqual(k.raiz.winfo_reqwidth(), ancho)

    def test_fijar_tamano_no_reconstruye_las_pestanas(self):
        k = self.crear()
        paginas = []
        k.mostrar = paginas.append

        k.fijar_tamano()

        self.assertEqual(paginas, [])

    def test_punto_de_v_centrado_sobre_la_letra(self):
        k = self.crear()
        k.cambiar_pagina("∫")
        k.raiz.update_idletasks()
        for tecla in k.cuadricula.winfo_children()[:3]:  # V̇, v̇, Q̇
            self.assertTrue(len(tecla.simbolo) == 2)
            punto = tecla.find_withtag("p")
            self.assertEqual(len(punto), 1)
            c = tecla.coords(punto[0])
            if len(c) == 2:  # imagen centrada en (x, y)
                x1 = x2 = c[0]
                y1 = y2 = c[1]
            else:
                x1, y1, x2, y2 = c
            self.assertAlmostEqual((x1 + x2) / 2, tecla.ancho / 2, delta=0.01)
            letra = tecla.find_withtag("t")[0]
            self.assertAlmostEqual(tecla.coords(letra)[0], tecla.ancho / 2, delta=0.01)
            self.assertGreater(y1, 0)           # el punto queda dentro de la tecla
            self.assertLess(y2, tecla.alto / 2)  # y por encima del centro

    def test_siempre_encima_se_guarda(self):
        k = self.crear()
        self.assertTrue(k.siempre_arriba)
        k.alternar_config(); k.alternar_arriba()
        self.assertFalse(k.siempre_arriba)
        k.guardar()
        k.raiz.destroy()
        self.assertFalse(self.crear().siempre_arriba)

    def test_recientes_no_repite_simbolos_entre_pestanas(self):
        k = self.crear()
        for pagina in ("±", "H₂"):
            k.cambiar_pagina(pagina)
            k.escribir_caracter("²")
            k.escribir_caracter("³")
        self.assertEqual(sorted(k.recientes), ["²", "³"])


if __name__ == "__main__":
    unittest.main()
