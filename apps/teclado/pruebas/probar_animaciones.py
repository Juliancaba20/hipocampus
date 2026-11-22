"""Pruebas de las animaciones de la versión 1.8: nunca bloquean, se pueden usar durante su
curso, no se interrumpen y siempre terminan en el estado definitivo correcto."""
import os
import shutil
import tempfile
import time
import unittest

import teclado_griego as t
from pruebas.probar_sin_parpadeo import arbol


def esperar(k, condicion, tope=4.0):
    """Deja correr la interfaz (como hace mainloop) hasta que se cumpla la condición."""
    fin = time.monotonic() + tope
    while not condicion():
        if time.monotonic() > fin:
            return False
        k.raiz.update()
        time.sleep(0.004)
    return True


class ProbarAnimaciones(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        self.anterior = os.environ.get("XDG_CONFIG_HOME")
        os.environ["XDG_CONFIG_HOME"] = self.carpeta
        os.environ["APPDATA"] = self.carpeta
        self.escribir = t.escribir
        t.escribir = lambda texto: None
        self.animaciones = t.ANIMACIONES
        t.ANIMACIONES = True
        t.ANIM["activo"] = False
        self.k = t.Teclado()
        self.k.raiz.update()

    def tearDown(self):
        t.escribir = self.escribir
        t.ANIMACIONES = self.animaciones
        t.ANIM["activo"] = False
        try:
            self.k.raiz.destroy()
        except Exception:
            pass
        t.C.update(t.TEMAS[t.TEMA_PREDETERMINADO])
        shutil.rmtree(self.carpeta, ignore_errors=True)
        if self.anterior is None:
            os.environ.pop("XDG_CONFIG_HOME", None)
        else:
            os.environ["XDG_CONFIG_HOME"] = self.anterior

    def imagen(self, tecla):
        return str(tecla.itemcget(tecla.forma, "image"))

    def esperado(self, tecla, relleno="boton"):
        return str(t.forma_png(tecla, tecla.ancho, tecla.alto, tecla.radio,
                               t.C[relleno], t.C["hover"], tecla.grosor))

    # -- tocar una tecla -----------------------------------------------------
    def test_destello_al_tocar_termina_en_el_aspecto_normal(self):
        k = self.k
        tecla = k.teclas[0]
        normal = self.imagen(tecla)
        tecla._pulsar(None)
        self.assertEqual(tecla.f_pulso, t.PULSO[0])
        self.assertNotEqual(self.imagen(tecla), normal)       # se ve el destello
        self.assertEqual(k.recientes[0], tecla.simbolo)        # y la tecla se escribió igual
        self.assertTrue(esperar(k, lambda: tecla.f_pulso == 0.0))
        self.assertEqual(self.imagen(tecla), normal)

    def test_tocar_de_nuevo_reinicia_el_destello(self):
        k = self.k
        tecla = k.teclas[3]
        normal = self.imagen(tecla)
        tecla._pulsar(None)
        esperar(k, lambda: False, tope=0.05)
        tecla._pulsar(None)
        self.assertEqual(tecla.f_pulso, t.PULSO[0])
        self.assertTrue(esperar(k, lambda: tecla.f_pulso == 0.0))
        self.assertEqual(self.imagen(tecla), normal)
        self.assertEqual(tecla._trabajos, {})

    def test_el_destello_no_se_pierde_con_el_mouse_encima(self):
        k = self.k
        tecla = k.teclas[1]
        tecla._entrar(None)
        con_mouse = self.imagen(tecla)
        tecla._pulsar(None)
        self.assertTrue(esperar(k, lambda: tecla.f_pulso == 0.0))
        self.assertEqual(self.imagen(tecla), con_mouse)        # sigue resaltada: el mouse sigue ahí
        tecla._salir(None)
        self.assertNotEqual(self.imagen(tecla), con_mouse)

    # -- cambiar de pestaña --------------------------------------------------
    def test_cambiar_de_pestana_anima_sin_crear_ni_destruir_teclas(self):
        k = self.k
        antes = arbol(k.raiz)
        k.cambiar_pagina("∫")
        self.assertTrue(any(tc.f_aparicion < 1 for tc in k.teclas[:19]))   # están entrando
        self.assertEqual(antes, arbol(k.raiz))                              # ningún widget nuevo
        self.assertTrue(esperar(k, lambda: all(tc.f_aparicion == 1.0 for tc in k.teclas)))
        self.assertEqual([tc.simbolo for tc in k.teclas[:19]], t.PAGINAS["∫"])
        visibles = {tc.simbolo for tc in k.cuadricula.grid_slaves()}
        self.assertEqual(visibles, set(t.PAGINAS["∫"]))
        self.assertEqual(antes, arbol(k.raiz))

    def test_las_teclas_se_pueden_tocar_mientras_entran(self):
        k = self.k
        k.cambiar_pagina("Α")
        tecla = k.teclas[8]             # la última columna es la que entra más tarde
        self.assertLess(tecla.f_aparicion, 1.0)
        tecla._pulsar(None)
        self.assertEqual(k.recientes[0], t.PAGINAS["Α"][8])
        self.assertTrue(esperar(k, lambda: all(tc.f_aparicion == 1.0 and tc.f_pulso == 0.0 for tc in k.teclas)))

    def test_cambiar_de_pestana_varias_veces_seguidas_termina_bien(self):
        k = self.k
        for pagina in ("Α", "±", "H₂", "∫", "α"):
            k.cambiar_pagina(pagina)
        self.assertTrue(esperar(k, lambda: all(tc.f_aparicion == 1.0 for tc in k.teclas)))
        self.assertEqual([tc.simbolo for tc in k.teclas[:len(t.PAGINAS["α"])]], t.PAGINAS["α"])

    def test_al_registrar_un_reciente_nuevo_su_casilla_entra(self):
        k = self.k
        k.registrar_reciente("ω")
        self.assertLess(k.slots[0].f_aparicion, 1.0)
        self.assertTrue(esperar(k, lambda: k.slots[0].f_aparicion == 1.0))
        self.assertEqual(k.slots[0].simbolo, "ω")

    # -- cambiar de color ----------------------------------------------------
    def comprobar_tema_final(self, nombre):
        k = self.k
        self.assertEqual(k.tema, nombre)
        self.assertEqual(k.tema_visible, nombre)
        for rol, valor in t.TEMAS[nombre].items():
            self.assertEqual(t.C[rol], valor, rol)
        self.assertFalse(t.ANIM["activo"])
        self.assertFalse(k.barrido_activo)
        self.assertEqual(k.raiz.cget("bg"), t.TEMAS[nombre]["fondo"])
        for tecla in k.teclas[:len(t.PAGINAS[k.pagina])]:
            self.assertEqual(self.imagen(tecla), self.esperado(tecla), tecla.simbolo)
        self.assertEqual(k.cuadricula.cget("bg"), t.TEMAS[nombre]["fondo"])

    def test_el_barrido_termina_con_el_color_nuevo(self):
        k = self.k
        k.aplicar_tema("Claro", animar=True)
        self.assertEqual(k.tema, "Claro")                  # el estado ya es el definitivo
        self.assertTrue(t.ANIM["activo"])                  # pero el barrido recién empieza
        self.assertTrue(esperar(k, lambda: not k.barrido_activo))
        self.comprobar_tema_final("Claro")

    def test_durante_el_barrido_hay_colores_de_los_dos_temas_a_la_vez(self):
        k = self.k
        k.aplicar_tema("Claro", animar=True)
        vistos = set()
        fin = time.monotonic() + 1
        while k.barrido_activo and time.monotonic() < fin:
            k.raiz.update()
            izquierda = k.teclas[0].cget("bg")
            derecha = k.teclas[8].cget("bg")
            vistos.add((izquierda, derecha))
            time.sleep(0.004)
        # en algún momento la izquierda ya cambió y la derecha todavía no (barrido de izq. a der.)
        viejo, nuevo = t.TEMAS["Medianoche"]["fondo"], t.TEMAS["Claro"]["fondo"]
        self.assertTrue(any(i != viejo and d == viejo for i, d in vistos), vistos)
        self.assertTrue(any(d == nuevo for _, d in vistos))

    def test_se_puede_usar_el_teclado_durante_el_barrido(self):
        k = self.k
        k.aplicar_tema("Violeta", animar=True)
        self.assertTrue(k.barrido_activo)
        tecla = k.teclas[4]
        tecla._entrar(None)               # pasar el mouse
        tecla._pulsar(None)               # tocar (escribe y destella)
        k.cambiar_pagina("±")             # cambiar de pestaña
        k.registrar_reciente("π")
        self.assertTrue(k.barrido_activo)  # nada de eso interrumpió el barrido
        tecla._salir(None)
        self.assertTrue(esperar(k, lambda: not k.barrido_activo and all(
            tc.f_aparicion == 1.0 and tc.f_pulso == 0.0 for tc in k.teclas)))
        self.comprobar_tema_final("Violeta")

    def test_si_se_pide_otro_color_el_barrido_en_curso_termina_y_luego_se_hace_el_ultimo(self):
        k = self.k
        empezados = []
        original = k.iniciar_barrido

        def espiar(nombre):
            empezados.append(nombre)
            original(nombre)
        k.iniciar_barrido = espiar
        k.aplicar_tema("Claro", animar=True)
        k.aplicar_tema("Bosque", animar=True)
        k.aplicar_tema("Océano", animar=True)
        self.assertEqual(k.tema, "Océano")                  # la elección ya quedó guardada
        self.assertTrue(esperar(k, lambda: not k.barrido_activo and not k.barrido_pendiente))
        self.assertEqual(empezados, ["Claro", "Océano"])    # «Bosque» se saltea; «Claro» termina
        self.comprobar_tema_final("Océano")

    def test_pedir_el_color_actual_no_hace_nada(self):
        k = self.k
        k.aplicar_tema(k.tema, animar=True)
        self.assertFalse(k.barrido_activo)

    def test_sin_animar_el_cambio_es_inmediato_y_completa_un_barrido_en_curso(self):
        k = self.k
        k.aplicar_tema("Claro", animar=True)
        k.aplicar_tema("Grafito")                           # inmediato
        self.comprobar_tema_final("Grafito")
        self.assertIsNone(k.barrido_pendiente)

    def test_con_animaciones_desactivadas_todo_es_inmediato(self):
        k = self.k
        t.ANIMACIONES = False
        k.aplicar_tema("Claro", animar=True)
        self.comprobar_tema_final("Claro")
        tecla = k.teclas[0]
        tecla._pulsar(None)
        self.assertEqual(tecla.f_pulso, 0.0)
        k.cambiar_pagina("Α")
        self.assertTrue(all(tc.f_aparicion == 1.0 for tc in k.teclas))

    def test_el_barrido_no_bloquea_y_genera_pocas_imagenes(self):
        k = self.k
        cache = k.raiz.__dict__.setdefault("_formas", {})
        antes = len(cache)
        pasos = []
        original = k.paso_barrido

        def medir():
            t0 = time.perf_counter()
            original()
            pasos.append(time.perf_counter() - t0)
        k.paso_barrido = medir
        k.aplicar_tema("Claro", animar=True)
        self.assertTrue(esperar(k, lambda: not k.barrido_activo))
        self.assertLess(len(cache) - antes, 90, "demasiadas imágenes nuevas en un barrido")
        self.assertLess(max(pasos), 0.25, "un paso del barrido tarda demasiado")

    def test_cerrar_la_ventana_durante_una_animacion_no_da_errores(self):
        k = self.k
        k.aplicar_tema("Claro", animar=True)
        k.cambiar_pagina("Α")
        k.teclas[0]._pulsar(None)
        k.raiz.destroy()
        time.sleep(0.1)
        self.k = t.Teclado()   # tearDown destruye este


if __name__ == "__main__":
    unittest.main()
