// En Windows no se abre una consola junto a la ventana.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `--version` muestra el número y sale (la compilación lo usa para comprobar que coincide con la etiqueta).
    if std::env::args().skip(1).any(|a| a == "--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return;
    }
    teclado_lib::run();
}
