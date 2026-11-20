//! Escritura de símbolos en el programa que tenga el foco, como si se tecleara.
use enigo::{Enigo, Keyboard, Settings};

const MAXIMO_CARACTERES: usize = 16;

/// Solo se aceptan textos cortos y sin caracteres de control: la ventana únicamente necesita
/// escribir símbolos, nunca órdenes.
pub fn validar(texto: &str) -> Result<(), String> {
    if texto.is_empty() {
        return Err("No hay nada para escribir".into());
    }
    if texto.chars().count() > MAXIMO_CARACTERES {
        return Err("El texto es demasiado largo".into());
    }
    if texto.chars().any(|c| c.is_control()) {
        return Err("El texto tiene caracteres de control".into());
    }
    Ok(())
}

pub fn escribir(texto: &str) -> Result<(), String> {
    validar(texto)?;
    // Se crea en cada uso: es rápido y evita conservar una conexión que el sistema puede cerrar.
    let mut teclado = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    teclado.text(texto).map_err(|e| e.to_string())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn acepta_simbolos_y_letras_con_punto() {
        for bueno in ["α", "Ω", "≥", "V\u{307}", "₂", "✓"] {
            assert!(validar(bueno).is_ok(), "{bueno:?}");
        }
    }

    #[test]
    fn rechaza_vacio_largo_y_control() {
        assert!(validar("").is_err());
        assert!(validar(&"a".repeat(17)).is_err());
        assert!(validar("a\nb").is_err());
        assert!(validar("\u{0}").is_err());
        assert!(validar("\u{1b}").is_err());
    }
}
