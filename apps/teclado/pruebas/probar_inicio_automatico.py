"""Pruebas del inicio automático con el sistema (versión 1.8). Windows se prueba con un
registro simulado; Linux y macOS escriben archivos reales en una carpeta temporal."""
import os
import plistlib
import shutil
import tempfile
import unittest

import teclado_griego as t


class RegistroFalso:
    """Imita lo mínimo de winreg para probar la lógica sin Windows."""
    HKEY_CURRENT_USER = "HKCU"
    KEY_READ, KEY_SET_VALUE, REG_SZ = 1, 2, 1

    def __init__(self):
        self.claves = {}

    class _Clave:
        def __init__(self, valores):
            self.valores = valores

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def OpenKey(self, raiz, ruta, reservado=0, acceso=1):
        if ruta not in self.claves:
            raise FileNotFoundError(ruta)
        return self._Clave(self.claves[ruta])

    def CreateKey(self, raiz, ruta):
        return self._Clave(self.claves.setdefault(ruta, {}))

    def QueryValueEx(self, clave, nombre):
        if nombre not in clave.valores:
            raise FileNotFoundError(nombre)
        return clave.valores[nombre], 1

    def SetValueEx(self, clave, nombre, r, tipo, valor):
        clave.valores[nombre] = valor

    def DeleteValue(self, clave, nombre):
        if nombre not in clave.valores:
            raise FileNotFoundError(nombre)
        del clave.valores[nombre]


class ProbarInicioAutomatico(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        self.guardado = (t.SISTEMA, t.ruta_ejecutable, t._winreg, os.environ.get("XDG_CONFIG_HOME"),
                         os.path.expanduser)
        os.environ["XDG_CONFIG_HOME"] = self.carpeta
        self.ruta = os.path.join(self.carpeta, "Mis programas", "TecladoCientifico")
        t.ruta_ejecutable = lambda: self.ruta

    def tearDown(self):
        t.SISTEMA, t.ruta_ejecutable, t._winreg, xdg, os.path.expanduser = self.guardado
        if xdg is None:
            os.environ.pop("XDG_CONFIG_HOME", None)
        else:
            os.environ["XDG_CONFIG_HOME"] = xdg
        shutil.rmtree(self.carpeta, ignore_errors=True)

    # -- Linux -------------------------------------------------------------
    def test_linux_activar_y_desactivar(self):
        t.SISTEMA = "linux"
        self.assertFalse(t.inicio_automatico_activo())
        self.assertTrue(t.activar_inicio_automatico())
        archivo = os.path.join(self.carpeta, "autostart", "TecladoCientifico.desktop")
        self.assertTrue(os.path.isfile(archivo))
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        self.assertIn(f'Exec="{self.ruta}" --inicio', texto)
        self.assertTrue(t.inicio_automatico_activo())
        self.assertTrue(t.desactivar_inicio_automatico())
        self.assertFalse(os.path.exists(archivo))
        self.assertFalse(t.inicio_automatico_activo())
        self.assertTrue(t.desactivar_inicio_automatico())  # repetir no falla

    def test_linux_desactivado_desde_el_sistema_no_cuenta_como_activo(self):
        t.SISTEMA = "linux"
        t.activar_inicio_automatico()
        archivo = os.path.join(self.carpeta, "autostart", "TecladoCientifico.desktop")
        with open(archivo, "a", encoding="utf-8") as f:
            f.write("Hidden=true\n")
        self.assertFalse(t.inicio_automatico_activo())
        t.reparar_inicio_automatico()  # respeta la decisión de la persona
        self.assertFalse(t.inicio_automatico_activo())

    def test_linux_ruta_con_caracteres_conflictivos_se_rechaza(self):
        t.SISTEMA = "linux"
        t.ruta_ejecutable = lambda: "/tmp/mal$nombre/Teclado"
        self.assertFalse(t.activar_inicio_automatico())
        self.assertFalse(os.path.exists(os.path.join(self.carpeta, "autostart")))

    def test_linux_repara_la_ruta_si_el_programa_se_movio(self):
        t.SISTEMA = "linux"
        t.activar_inicio_automatico()
        nueva = os.path.join(self.carpeta, "otra carpeta", "TecladoCientifico")
        t.ruta_ejecutable = lambda: nueva
        self.assertFalse(t.inicio_automatico_activo())
        t.reparar_inicio_automatico()
        self.assertTrue(t.inicio_automatico_activo())

    def test_sin_registro_reparar_no_crea_nada(self):
        t.SISTEMA = "linux"
        t.reparar_inicio_automatico()
        self.assertFalse(os.path.exists(os.path.join(self.carpeta, "autostart")))

    def test_programa_sin_compilar_no_se_registra(self):
        t.SISTEMA = "linux"
        t.ruta_ejecutable = lambda: None
        self.assertFalse(t.activar_inicio_automatico())
        self.assertFalse(t.inicio_automatico_activo())

    # -- macOS -------------------------------------------------------------
    def test_mac_agente_abre_el_paquete_con_open(self):
        t.SISTEMA = "darwin"
        os.path.expanduser = lambda ruta: ruta.replace("~", self.carpeta)
        t.ruta_ejecutable = lambda: "/Applications/TecladoCientifico.app/Contents/MacOS/TecladoCientifico"
        datos = plistlib.loads(t.contenido_inicio_mac(t.ruta_ejecutable()))
        self.assertEqual(datos["ProgramArguments"], ["/usr/bin/open", "-a",
                         "/Applications/TecladoCientifico.app", "--args", "--inicio"])
        self.assertTrue(datos["RunAtLoad"])
        self.assertTrue(t.activar_inicio_automatico())
        self.assertTrue(t.inicio_automatico_activo())
        self.assertTrue(t.desactivar_inicio_automatico())
        self.assertFalse(t.inicio_automatico_activo())

    # -- Windows (registro simulado) ---------------------------------------
    def windows(self):
        t.SISTEMA = "win32"
        t.ruta_ejecutable = lambda: r"C:\Users\Ana\Descargas\TecladoCientifico.exe"
        registro = RegistroFalso()
        t._winreg = lambda: registro
        return registro

    def test_windows_activar_y_desactivar(self):
        registro = self.windows()
        self.assertFalse(t.inicio_automatico_activo())
        self.assertTrue(t.activar_inicio_automatico())
        self.assertEqual(registro.claves[t.CLAVE_INICIO_WINDOWS][t.NOMBRE_APP],
                         r'"C:\Users\Ana\Descargas\TecladoCientifico.exe" --inicio')
        self.assertTrue(t.inicio_automatico_activo())
        self.assertTrue(t.desactivar_inicio_automatico())
        self.assertFalse(t.inicio_automatico_activo())

    def test_windows_desactivado_desde_el_administrador_de_tareas(self):
        registro = self.windows()
        t.activar_inicio_automatico()
        registro.claves[t.CLAVE_APROBADOS_WINDOWS] = {t.NOMBRE_APP: bytes([3]) + bytes(11)}
        self.assertFalse(t.inicio_automatico_activo())
        t.reparar_inicio_automatico()  # no lo vuelve a activar por su cuenta
        self.assertFalse(t.inicio_automatico_activo())
        # al activarlo desde la configuración, vuelve a quedar habilitado
        self.assertTrue(t.activar_inicio_automatico())
        self.assertTrue(t.inicio_automatico_activo())

    def test_windows_repara_la_ruta(self):
        registro = self.windows()
        t.activar_inicio_automatico()
        t.ruta_ejecutable = lambda: r"D:\Programas\TecladoCientifico.exe"
        t.reparar_inicio_automatico()
        self.assertIn(r"D:\Programas", registro.claves[t.CLAVE_INICIO_WINDOWS][t.NOMBRE_APP])
        self.assertTrue(t.inicio_automatico_activo())

    def test_windows_ruta_con_espacios(self):
        registro = self.windows()
        t.ruta_ejecutable = lambda: r"C:\Program Files\Teclado\TecladoCientifico.exe"
        t.activar_inicio_automatico()
        self.assertTrue(t.inicio_automatico_activo())


if __name__ == "__main__":
    unittest.main()
