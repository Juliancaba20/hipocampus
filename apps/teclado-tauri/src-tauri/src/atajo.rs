//! Atajo global en formato de texto («ctrl+alt+g»), con las mismas reglas que la versión de Python.
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

pub const PREDETERMINADO: &str = "ctrl+alt+g";

const LETRAS: [Code; 26] = [
    Code::KeyA, Code::KeyB, Code::KeyC, Code::KeyD, Code::KeyE, Code::KeyF, Code::KeyG,
    Code::KeyH, Code::KeyI, Code::KeyJ, Code::KeyK, Code::KeyL, Code::KeyM, Code::KeyN,
    Code::KeyO, Code::KeyP, Code::KeyQ, Code::KeyR, Code::KeyS, Code::KeyT, Code::KeyU,
    Code::KeyV, Code::KeyW, Code::KeyX, Code::KeyY, Code::KeyZ,
];
const DIGITOS: [Code; 10] = [
    Code::Digit0, Code::Digit1, Code::Digit2, Code::Digit3, Code::Digit4,
    Code::Digit5, Code::Digit6, Code::Digit7, Code::Digit8, Code::Digit9,
];
const FUNCIONES: [Code; 12] = [
    Code::F1, Code::F2, Code::F3, Code::F4, Code::F5, Code::F6,
    Code::F7, Code::F8, Code::F9, Code::F10, Code::F11, Code::F12,
];

/// «ctrl+alt+g» -> atajo. None si no es válido (hace falta al menos un modificador).
pub fn analizar(texto: &str) -> Option<Shortcut> {
    let partes: Vec<String> = texto.split('+').map(|p| p.trim().to_lowercase()).collect();
    if partes.len() < 2 || partes.iter().any(|p| p.is_empty()) {
        return None;
    }
    let (tecla, modificadores) = partes.split_last()?;
    let mut mods = Modifiers::empty();
    for m in modificadores {
        let uno = match m.as_str() {
            "ctrl" => Modifiers::CONTROL,
            "alt" => Modifiers::ALT,
            "shift" => Modifiers::SHIFT,
            "win" => Modifiers::SUPER,
            _ => return None,
        };
        if mods.contains(uno) {
            return None; // modificador repetido
        }
        mods |= uno;
    }
    let codigo = codigo_de(tecla)?;
    Some(Shortcut::new(Some(mods), codigo))
}

fn codigo_de(tecla: &str) -> Option<Code> {
    let mut letras = tecla.chars();
    if let (Some(c), None) = (letras.next(), letras.next()) {
        return match c {
            'a'..='z' => Some(LETRAS[(c as u8 - b'a') as usize]),
            '0'..='9' => Some(DIGITOS[(c as u8 - b'0') as usize]),
            _ => None,
        };
    }
    let numero: usize = tecla.strip_prefix('f')?.parse().ok()?;
    if tecla.starts_with("f0") {
        return None;
    }
    FUNCIONES.get(numero.checked_sub(1)?).copied()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn acepta_los_formatos_validos() {
        assert!(analizar("ctrl+alt+g").is_some());
        assert!(analizar("Ctrl + Shift + F12").is_some());
        assert!(analizar("win+1").is_some());
        assert_eq!(analizar("ctrl+alt+g"), Some(Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyG)));
        assert_eq!(analizar("alt+f1"), Some(Shortcut::new(Some(Modifiers::ALT), Code::F1)));
    }

    #[test]
    fn rechaza_los_invalidos() {
        for malo in ["", "g", "ctrl", "ctrl+", "ctrl+alt", "ctrl+ctrl+g", "ctrl+x+g", "ctrl+f13",
                     "ctrl+f0", "ctrl+ñ", "ctrl+gg", "ctrl++g", "ctrl+fx"] {
            assert!(analizar(malo).is_none(), "{malo:?} no debería ser válido");
        }
    }
}
