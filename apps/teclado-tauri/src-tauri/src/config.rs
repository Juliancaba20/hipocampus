//! Lectura y escritura de la configuración. Usa el mismo archivo y las mismas claves que el
//! teclado de Python (versiones 1.x), de modo que al pasar a esta versión se conservan la
//! posición, el color, el tamaño de las teclas, los recientes y el atajo.
use serde_json::{Map, Value};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const NOMBRE_APP: &str = "TecladoCientifico";

fn carpeta_personal() -> Option<PathBuf> {
    let variable = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    std::env::var_os(variable).filter(|v| !v.is_empty()).map(PathBuf::from)
}

/// `%APPDATA%\TecladoCientifico\config.json` (Windows), `~/Library/Application Support/...`
/// (macOS) o `$XDG_CONFIG_HOME/...` (Linux): igual que la versión de Python.
pub fn ruta_config() -> PathBuf {
    let base = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(carpeta_personal)
    } else if cfg!(target_os = "macos") {
        carpeta_personal().map(|c| c.join("Library").join("Application Support"))
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| carpeta_personal().map(|c| c.join(".config")))
    };
    base.unwrap_or_else(|| PathBuf::from("."))
        .join(NOMBRE_APP)
        .join("config.json")
}

/// Contenido del archivo; vacío si no existe o está dañado (nunca falla).
pub fn leer(ruta: &Path) -> Map<String, Value> {
    match fs::read_to_string(ruta).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) {
        Some(Value::Object(datos)) => datos,
        _ => Map::new(),
    }
}

/// Agrega o cambia las claves recibidas y conserva las demás (también las que esta versión no
/// conoce). Escribe en un archivo temporal y lo renombra, para no dejar nunca un archivo a medias.
pub fn fusionar(ruta: &Path, cambios: Map<String, Value>) -> io::Result<()> {
    let mut datos = leer(ruta);
    for (clave, valor) in cambios {
        datos.insert(clave, valor);
    }
    if let Some(carpeta) = ruta.parent() {
        fs::create_dir_all(carpeta)?;
    }
    let temporal = ruta.with_extension("json.tmp");
    let texto = serde_json::to_string_pretty(&Value::Object(datos))
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&temporal, texto)?;
    fs::rename(&temporal, ruta)
}

/// Archivo de diagnóstico (junto a config.json). Ayuda a entender qué pasó si algo falla en la
/// PC de otra persona. Se vacía al pasar de 64 KB para que nunca crezca sin límite.
pub fn ruta_diagnostico() -> PathBuf {
    ruta_config().with_file_name("diagnostico.log")
}

pub fn anotar(ruta: &Path, linea: &str) {
    const LIMITE: u64 = 64 * 1024;
    if let Some(carpeta) = ruta.parent() {
        let _ = fs::create_dir_all(carpeta);
    }
    let demasiado_grande = fs::metadata(ruta).map(|m| m.len() > LIMITE).unwrap_or(false);
    let mut archivo = match fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(!demasiado_grande)
        .truncate(demasiado_grande)
        .open(ruta)
    {
        Ok(a) => a,
        Err(_) => return,
    };
    use std::io::Write;
    let _ = writeln!(archivo, "{}", linea.replace(['\r', '\n'], " "));
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use serde_json::json;

    fn carpeta(nombre: &str) -> PathBuf {
        let c = std::env::temp_dir().join(format!("teclado-prueba-{}-{}", nombre, std::process::id()));
        let _ = fs::remove_dir_all(&c);
        c
    }

    fn mapa(v: Value) -> Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    #[test]
    fn sin_archivo_devuelve_vacio() {
        assert!(leer(&carpeta("a").join("config.json")).is_empty());
    }

    #[test]
    fn archivo_danado_devuelve_vacio() {
        let c = carpeta("b");
        fs::create_dir_all(&c).unwrap();
        let r = c.join("config.json");
        fs::write(&r, "{ esto no es json").unwrap();
        assert!(leer(&r).is_empty());
        fs::write(&r, "[1, 2]").unwrap();
        assert!(leer(&r).is_empty());
    }

    #[test]
    fn fusionar_conserva_las_claves_que_no_conoce() {
        let c = carpeta("c");
        let r = c.join("config.json");
        fusionar(&r, mapa(json!({"x": 10, "futuro": {"a": 1}}))).unwrap();
        fusionar(&r, mapa(json!({"x": 20, "tema": "Claro"}))).unwrap();
        let datos = leer(&r);
        assert_eq!(datos["x"], 20);
        assert_eq!(datos["tema"], "Claro");
        assert_eq!(datos["futuro"], json!({"a": 1}));
        assert!(!r.with_extension("json.tmp").exists());
    }

    #[test]
    fn el_diagnostico_se_acumula_y_se_acota() {
        let c = carpeta("d");
        let r = c.join("diagnostico.log");
        anotar(&r, "uno");
        anotar(&r, "dos\ncon salto");
        assert_eq!(fs::read_to_string(&r).unwrap(), "uno\ndos con salto\n");
        fs::write(&r, "x".repeat(70 * 1024)).unwrap();
        anotar(&r, "nuevo");
        assert_eq!(fs::read_to_string(&r).unwrap(), "nuevo\n");
    }

    #[test]
    fn la_ruta_es_la_misma_que_la_de_python() {
        let r = ruta_config();
        assert!(r.ends_with(Path::new(NOMBRE_APP).join("config.json")));
    }
}
