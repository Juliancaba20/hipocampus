//! Teclado Científico (versión Tauri): ventana flotante que no roba el foco y escribe
//! letras griegas y símbolos en el programa que se esté usando.
mod atajo;
mod config;
mod teclear;

use serde::Serialize;
use serde_json::{Map, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const VENTANA: &str = "main";
const ARGUMENTO_INICIO: &str = "--inicio";

/// Atajo registrado en este momento y último error al registrarlo.
#[derive(Default)]
struct EstadoAtajo {
    registrado: Option<Shortcut>,
    error: Option<String>,
}

#[derive(Serialize)]
struct EstadoInicial {
    config: Map<String, Value>,
    version: &'static str,
    plataforma: &'static str,
    atajo_error: Option<String>,
    inicio_automatico: bool,
}

fn plataforma() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn alternar_visibilidad(app: &AppHandle) {
    if let Some(ventana) = app.get_webview_window(VENTANA) {
        let visible = ventana.is_visible().unwrap_or(true) && !ventana.is_minimized().unwrap_or(false);
        if visible {
            let _ = ventana.hide();
        } else {
            let _ = ventana.unminimize();
            let _ = ventana.show();
        }
    }
}

fn registrar(app: &AppHandle, texto: &str) -> Result<(), String> {
    let nuevo = atajo::analizar(texto).ok_or_else(|| format!("«{texto}» no es un atajo válido"))?;
    let estado = app.state::<Mutex<EstadoAtajo>>();
    let mut estado = estado.lock().map_err(|_| "estado dañado".to_string())?;
    if let Some(anterior) = estado.registrado.take() {
        let _ = app.global_shortcut().unregister(anterior);
    }
    match app.global_shortcut().register(nuevo) {
        Ok(()) => {
            estado.registrado = Some(nuevo);
            estado.error = None;
            Ok(())
        }
        Err(e) => {
            let mensaje = e.to_string();
            estado.error = Some(mensaje.clone());
            Err(mensaje)
        }
    }
}

#[tauri::command]
fn estado_inicial(app: AppHandle, estado: State<Mutex<EstadoAtajo>>) -> EstadoInicial {
    EstadoInicial {
        config: config::leer(&config::ruta_config()),
        version: env!("CARGO_PKG_VERSION"),
        plataforma: plataforma(),
        atajo_error: estado.lock().ok().and_then(|e| e.error.clone()),
        inicio_automatico: app.autolaunch().is_enabled().unwrap_or(false),
    }
}

#[tauri::command]
fn guardar_config(cambios: Map<String, Value>) -> Result<(), String> {
    config::fusionar(&config::ruta_config(), cambios).map_err(|e| e.to_string())
}

/// Corre en el hilo principal (comando sin `async`), como pide macOS para simular teclado.
#[tauri::command]
fn escribir(texto: String) -> Result<(), String> {
    teclear::escribir(&texto)
}

#[tauri::command]
fn copiar(app: AppHandle, texto: String) -> Result<(), String> {
    teclear::validar(&texto)?;
    app.clipboard().write_text(texto).map_err(|e| e.to_string())
}

#[tauri::command]
fn cambiar_atajo(app: AppHandle, texto: String) -> Result<(), String> {
    registrar(&app, &texto)
}

/// La ventana avisa aquí de sus errores; quedan en diagnostico.log (y en la consola, si hay).
#[tauri::command]
fn registrar_error(mensaje: String) {
    let linea: String = mensaje.chars().take(500).collect();
    eprintln!("[interfaz] {linea}");
    config::anotar(&config::ruta_diagnostico(), &format!("[interfaz] {linea}"));
}

#[tauri::command]
fn inicio_cambiar(app: AppHandle, activo: bool) -> Result<bool, String> {
    let gestor = app.autolaunch();
    let resultado = if activo { gestor.enable() } else { gestor.disable() };
    resultado.map_err(|e| e.to_string())?;
    gestor.is_enabled().map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        // Primero: si ya hay otra copia abierta, se muestra esa (salvo al iniciar el sistema).
        .plugin(tauri_plugin_single_instance::init(|app, argumentos, _| {
            if !argumentos.iter().any(|a| a == ARGUMENTO_INICIO) {
                if let Some(ventana) = app.get_webview_window(VENTANA) {
                    let _ = ventana.unminimize();
                    let _ = ventana.show();
                }
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![ARGUMENTO_INICIO]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _atajo, evento| {
                    if evento.state() == ShortcutState::Pressed {
                        alternar_visibilidad(app);
                    }
                })
                .build(),
        )
        .manage(Mutex::new(EstadoAtajo::default()))
        .setup(|app| {
            let guardado = config::leer(&config::ruta_config());
            let texto = guardado
                .get("atajo")
                .and_then(Value::as_str)
                .filter(|t| atajo::analizar(t).is_some())
                .unwrap_or(atajo::PREDETERMINADO)
                .to_string();
            if let Err(mensaje) = registrar(app.handle(), &texto) {
                // La ventana lo pide al cargar (estado_inicial); si ya cargó, se le avisa.
                let _ = app.emit("atajo-error", mensaje);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            estado_inicial,
            guardar_config,
            escribir,
            copiar,
            cambiar_atajo,
            registrar_error,
            inicio_cambiar
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar el Teclado Científico");
}
