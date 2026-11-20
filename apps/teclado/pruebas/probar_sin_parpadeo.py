"""Pruebas de la versión 1.8: la configuración se actualiza sin recrear widgets (causa del
parpadeo), la ventana se arma oculta y la medida calculada coincide con la real."""
import json
import os
import shutil
import tempfile
import unittest

import teclado_griego as t


def arbol(widget):
    """Nombres de todos los widgets que hay dentro de uno. Si un widget se destruye y se crea
    de nuevo, Tk le da un nombre nuevo: comparar dos fotos del árbol detecta ese caso."""
    nombres = set()
    for hijo in widget.winfo_children():
        nombres.add(str(hijo))
        nombres |= arbol(hijo)
    return nombres


class ProbarSinParpadeo(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        self.anterior = os.environ.get("XDG_CONFIG_HOME")
        os.environ["XDG_CONFIG_HOME"] = self.carpeta
        os.environ["APPDATA"] = self.carpeta
        self.escribir = t.escribir
        t.escribir = lambda texto: None
        self.k = None

    def tearDown(self):
        t.escribir = self.escribir
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

    def crear(self):
        self.k = t.Teclado()
        return self.k

    def test_cada_cambio_de_configuracion_conserva_los_widgets(self):
        k = self.crear()
        k.abrir_config()
        k.raiz.update_idletasks()
        antes = arbol(k.raiz)
        for tema in t.TEMAS:
            k.aplicar_tema(tema)
        k.cambiar_alpha(-0.05)
        k.cambiar_alpha(0.10)
        k.alternar_nombres()
        k.alternar_arriba()
        k.alternar_busqueda()
        k.raiz.update_idletasks()
        self.assertEqual(antes, arbol(k.raiz))

    def test_cambiar_tamano_no_recrea_el_panel(self):
        k = self.crear()
        k.abrir_config()
        panel = arbol(k.panel)
        k.cambiar_tamano("Grande")
        k.cambiar_tamano("Pequeño")
        self.assertEqual(panel, arbol(k.panel))

    def test_el_panel_se_crea_una_sola_vez(self):
        k = self.crear()
        k.abrir_config()
        panel = k.panel
        k.cerrar_config()
        k.abrir_config()
        self.assertIs(k.panel, panel)

    def test_el_panel_refleja_los_valores_actuales(self):
        k = self.crear()
        k.abrir_config()
        k.aplicar_tema("Océano")
        k.cambiar_tamano("Grande")
        k.cambiar_alpha(-0.16)
        k.alternar_nombres()
        self.assertEqual(k.etiqueta_alpha.cget("text"), f"{round(k.alpha * 100)} %")
        self.assertEqual({n for n, m in k.muestras.items() if m.elegido}, {"Océano"})
        self.assertEqual(k.etiquetas_tamano["Grande"].cget("fg"), t.C["acento"])
        self.assertEqual(k.etiquetas_tamano["Normal"].cget("fg"), t.C["asa"])
        self.assertFalse(k.interruptores["nombres"].valor)
        # al cerrar y volver a abrir sigue igual
        k.cerrar_config()
        k.abrir_config()
        self.assertEqual({n for n, m in k.muestras.items() if m.elegido}, {"Océano"})

    def test_el_color_se_aplica_a_las_teclas_y_al_panel(self):
        k = self.crear()
        k.abrir_config()
        k.aplicar_tema("Claro")
        self.assertEqual(k.raiz.cget("bg"), t.TEMAS["Claro"]["fondo"])
        self.assertEqual(k.panel.cget("bg"), t.TEMAS["Claro"]["fondo"])
        tecla = k.cuadricula.winfo_children()[0]
        self.assertEqual(tecla.cget("bg"), t.TEMAS["Claro"]["fondo"])

    def test_la_ventana_se_arma_oculta_y_termina_visible(self):
        estados = []
        original = t.Teclado.revelar

        def espiar(self):
            estados.append((self.raiz.state(), self.raiz.winfo_ismapped()))
            original(self)
        t.Teclado.revelar = espiar
        try:
            k = self.crear()
        finally:
            t.Teclado.revelar = original
        self.assertEqual(estados, [("withdrawn", 0)])
        self.assertEqual(k.raiz.state(), "normal")
        self.assertTrue(k.raiz.winfo_ismapped())
        self.assertAlmostEqual(float(k.raiz.attributes("-alpha")), t.alpha_para_sistema(k.alpha), 2)

    def test_la_medida_calculada_coincide_con_la_real(self):
        original = t.escala_de
        try:
            for escala in (1.0, 1.25, 1.5, 2.0):
                t.escala_de = lambda widget, e=escala: e
                for tamano in t.TAMANOS:
                    k = self.crear()
                    k.cambiar_tamano(tamano)
                    ancho = alto = 0
                    k.cuadricula.grid_propagate(True)
                    k.cuadricula.configure(width=1, height=1)
                    for pagina in t.PAGINAS:
                        k.mostrar(pagina)
                        k.raiz.update_idletasks()
                        ancho = max(ancho, k.cuadricula.winfo_reqwidth())
                        alto = max(alto, k.cuadricula.winfo_reqheight())
                    self.assertEqual(k.medida_cuadricula(), (ancho, alto), (escala, tamano))
                    k.raiz.destroy()
                    self.k = None
        finally:
            t.escala_de = original

    def test_tope_de_transparencia_solo_en_windows(self):
        self.assertLess(t.alpha_para_sistema(1.0, "win32"), 1.0)
        self.assertEqual(t.alpha_para_sistema(0.8, "win32"), 0.8)
        self.assertEqual(t.alpha_para_sistema(1.0, "linux"), 1.0)
        self.assertEqual(t.alpha_para_sistema(1.0, "darwin"), 1.0)


if __name__ == "__main__":
    unittest.main()
