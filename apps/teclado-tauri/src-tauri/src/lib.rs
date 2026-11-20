//! Teclado Científico (versión Tauri): ventana flotante que no roba el foco y escribe
//! letras griegas y símbolos en el programa que se esté usando.
mod atajo;
mod config;
mod inicio;
mod teclear;
#[cfg(windows)]
mod ventana_windows;

use serde::Serialize;
use serde_json::{Map, Value};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State};
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

/// ¿Se pudo crear el ícono de la bandeja? Si no, el botón «–» minimiza en lugar de ocultar.
#[derive(Default)]
struct Bandeja(AtomicBool);

#[derive(Serialize)]
struct EstadoInicial {
    config: Map<String, Value>,
    version: &'static str,
    plataforma: &'static str,
    atajo_error: Option<String>,
    inicio_automatico: bool,
    bandeja: bool,
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

/// Registra el atajo sin dejar constancia del error (lo usa el arranque, que reintenta).
fn intentar(app: &AppHandle, texto: &str) -> Result<(), String> {
    let nuevo = atajo::analizar(texto).ok_or_else(|| format!("«{texto}» no es un atajo válido"))?;
    let estado = app.state::<Mutex<EstadoAtajo>>();
    let mut estado = estado.lock().map_err(|_| "estado dañado".to_string())?;
    if let Some(anterior) = estado.registrado.take() {
        let _ = app.global_shortcut().unregister(anterior);
    }
    app.global_shortcut().register(nuevo).map_err(|e| e.to_string())?;
    estado.registrado = Some(nuevo);
    estado.error = None;
    Ok(())
}

fn guardar_error_de_atajo(app: &AppHandle, mensaje: &str) {
    if let Ok(mut estado) = app.state::<Mutex<EstadoAtajo>>().lock() {
        estado.error = Some(mensaje.to_string());
    }
}

fn registrar(app: &AppHandle, texto: &str) -> Result<(), String> {
    intentar(app, texto).map_err(|mensaje| {
        guardar_error_de_atajo(app, &mensaje);
        mensaje
    })
}

/// Al abrirse justo después de actualizar desde la versión de Python, esa copia puede tardar
/// unos instantes en soltar el atajo: se reintenta una vez antes de avisar.
fn registrar_al_arrancar(app: &AppHandle, texto: String) {
    if intentar(app, &texto).is_ok() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2500));
        if let Err(mensaje) = intentar(&app, &texto) {
            guardar_error_de_atajo(&app, &mensaje);
            let _ = app.emit("atajo-error", mensaje);
        }
    });
}

/// Elimina la copia anterior que deja el actualizador de la versión de Python («.old»).
fn borrar_restos_de_actualizacion() {
    if let Ok(exe) = std::env::current_exe() {
        let mut viejo = exe.into_os_string();
        viejo.push(".old");
        let _ = std::fs::remove_file(viejo);
    }
}

/// Ícono junto al reloj: clic para mostrar u ocultar el teclado, y menú con «Salir».
fn crear_bandeja(app: &AppHandle) -> tauri::Result<()> {
    let alternar = MenuItem::with_id(app, "alternar", "Mostrar u ocultar el teclado", true, None::<&str>)?;
    let salir = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&alternar, &salir])?;
    let mut constructor = TrayIconBuilder::new()
        .tooltip("Teclado Científico")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| match evento.id.as_ref() {
            "alternar" => alternar_visibilidad(app),
            "salir" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|bandeja, evento| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                alternar_visibilidad(bandeja.app_handle());
            }
        });
    if let Some(icono) = app.default_window_icon() {
        constructor = constructor.icon(icono.clone());
    }
    constructor.build(app)?;
    Ok(())
}

#[tauri::command]
fn estado_inicial(estado: State<Mutex<EstadoAtajo>>, bandeja: State<Bandeja>) -> EstadoInicial {
    EstadoInicial {
        config: config::leer(&config::ruta_config()),
        version: env!("CARGO_PKG_VERSION"),
        plataforma: plataforma(),
        atajo_error: estado.lock().ok().and_then(|e| e.error.clone()),
        inicio_automatico: inicio::activo(),
        bandeja: bandeja.0.load(Ordering::Relaxed),
    }
}

#[tauri::command]
fn guardar_config(cambios: Map<String, Value>) -> Result<(), String> {
    config::fusionar(&config::ruta_config(), cambios).map_err(|e| e.to_string())
}

/// Cuántas veces se anotó que el teclado tenía el foco (para no llenar el archivo de diagnóstico).
static AVISOS_DE_FOCO: AtomicU32 = AtomicU32::new(0);

/// Corre en el hilo principal (comando sin `async`), como pide macOS para simular teclado.
#[tauri::command]
fn escribir(app: AppHandle, texto: String) -> Result<(), String> {
    let resultado = teclear::escribir(&texto);
    // Si la ventana del teclado tuviera el foco, el símbolo no llegaría al otro programa: se anota.
    let con_foco = app
        .get_webview_window(VENTANA)
        .and_then(|v| v.is_focused().ok())
        .unwrap_or(false);
    if con_foco && AVISOS_DE_FOCO.fetch_add(1, Ordering::Relaxed) < 5 {
        config::anotar(
            &config::ruta_diagnostico(),
            "[foco] el teclado tenía el foco al escribir: el símbolo pudo no llegar al otro programa",
        );
    }
    resultado
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
fn inicio_cambiar(activo: bool) -> Result<bool, String> {
    inicio::cambiar(activo)
}

/// Oculta la ventana (queda el ícono de la bandeja y el atajo para volver a mostrarla).
#[tauri::command]
fn ocultar(app: AppHandle) {
    if let Some(ventana) = app.get_webview_window(VENTANA) {
        let _ = ventana.hide();
    }
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
        .manage(Bandeja::default())
        .setup(|app| {
            let guardado = config::leer(&config::ruta_config());
            let texto = guardado
                .get("atajo")
                .and_then(Value::as_str)
                .filter(|t| atajo::analizar(t).is_some())
                .unwrap_or(atajo::PREDETERMINADO)
                .to_string();
            registrar_al_arrancar(app.handle(), texto);

            // Sin Alt+Tab ni botón en la barra de tareas (solo Windows); se minimiza a la bandeja.
            #[cfg(windows)]
            if let Some(ventana) = app.get_webview_window(VENTANA) {
                if let Ok(hwnd) = ventana.hwnd() {
                    ventana_windows::quitar_de_alt_tab(hwnd.0 as _);
                }
            }
            if crear_bandeja(app.handle()).is_ok() {
                app.state::<Bandeja>().0.store(true, Ordering::Relaxed);
            }

            // Tras actualizar desde la versión de Python queda su copia vieja («.old»).
            std::thread::spawn(|| {
                std::thread::sleep(Duration::from_secs(10));
                borrar_restos_de_actualizacion();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            estado_inicial,
            guardar_config,
            escribir,
            copiar,
            cambiar_atajo,
            registrar_error,
            ocultar,
            inicio_cambiar
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar el Teclado Científico");
}
