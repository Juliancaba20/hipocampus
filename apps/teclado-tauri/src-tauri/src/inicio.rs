//! Inicio automático con el sistema. Usa el mismo nombre de entrada que el teclado de Python
//! (`TecladoCientifico`): así, si la versión 1.x ya lo tenía activado, esta versión lo reconoce
//! como activado y no queda una entrada duplicada.
use auto_launch::{AutoLaunch, AutoLaunchBuilder};

pub const NOMBRE: &str = "TecladoCientifico";
pub const ARGUMENTO: &str = "--inicio";

/// Windows y Linux guardan el comando como texto: si la ruta tiene espacios hay que encerrarla
/// entre comillas, porque si no el sistema no encuentra el programa al iniciar sesión.
pub fn entrecomillar(ruta: &str) -> String {
    if ruta.starts_with('"') || !(cfg!(windows) || ruta.contains(' ')) {
        ruta.to_string()
    } else {
        format!("\"{ruta}\"")
    }
}

fn construir() -> Result<AutoLaunch, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let ruta = entrecomillar(&exe.display().to_string());
    let mut b = AutoLaunchBuilder::new();
    b.set_app_name(NOMBRE).set_app_path(&ruta).set_args(&[ARGUMENTO]);
    #[cfg(windows)]
    b.set_windows_enable_mode(auto_launch::WindowsEnableMode::CurrentUser);
    #[cfg(target_os = "macos")]
    b.set_macos_launch_mode(auto_launch::MacOSLaunchMode::LaunchAgent);
    b.build().map_err(|e| e.to_string())
}

pub fn activo() -> bool {
    construir().and_then(|a| a.is_enabled().map_err(|e| e.to_string())).unwrap_or(false)
}

/// Activa o desactiva y devuelve cómo quedó realmente.
pub fn cambiar(activar: bool) -> Result<bool, String> {
    let gestor = construir()?;
    let resultado = if activar { gestor.enable() } else { gestor.disable() };
    resultado.map_err(|e| e.to_string())?;
    gestor.is_enabled().map_err(|e| e.to_string())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn las_rutas_con_espacios_llevan_comillas() {
        assert_eq!(entrecomillar("/home/ana maría/Teclado"), "\"/home/ana maría/Teclado\"");
        assert_eq!(entrecomillar("\"/ya/entre comillas\""), "\"/ya/entre comillas\"");
        if cfg!(windows) {
            assert_eq!(entrecomillar(r"C:\Programas\Teclado.exe"), "\"C:\\Programas\\Teclado.exe\"");
        } else {
            assert_eq!(entrecomillar("/opt/teclado"), "/opt/teclado");
        }
    }

    #[test]
    fn el_nombre_es_el_de_la_version_de_python() {
        assert_eq!(NOMBRE, "TecladoCientifico");
    }
}
