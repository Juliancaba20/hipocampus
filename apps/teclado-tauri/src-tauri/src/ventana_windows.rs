//! Solo Windows. Pone a la ventana el estilo de «ventana de herramientas»: no aparece en
//! Alt+Tab ni en la barra de tareas. Sin esto, como el teclado siempre está encima, Alt+Tab
//! alternaba entre el programa de atrás y el teclado.
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

pub fn quitar_de_alt_tab(hwnd: HWND) {
    // SAFETY: `hwnd` es el identificador de nuestra propia ventana, que sigue existiendo
    // durante esta llamada; solo se lee y se modifica su estilo extendido.
    unsafe {
        let estilo = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let nuevo = (estilo | WS_EX_TOOLWINDOW as isize) & !(WS_EX_APPWINDOW as isize);
        if nuevo != estilo {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, nuevo);
        }
    }
}
