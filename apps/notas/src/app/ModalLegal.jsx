import { Modal } from './Modal.jsx';
import { versionVisible } from './notasActualizacion.js';

// Aviso legal dentro de la app (sirve sin conexión, también en el programa de escritorio).
// El texto completo está en el sitio: /legal/terminos, /legal/privacidad y /legal/derechos-de-autor.
export default function ModalLegal({ alCerrar }) {
  return (
    <Modal titulo={`Legal y licencia · Anotomía ${versionVisible()}`} alCerrar={alCerrar} ancho={620}>
      <div style={{ display: 'grid', gap: '12px', fontSize: '14px', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          <strong>© 2026 Hipocampus. Todos los derechos reservados.</strong> Anotomía es software propietario, protegido por la
          Ley 11.723 de Propiedad Intelectual. Se ofrece gratis para uso personal y de estudio.
        </p>
        <p style={{ margin: 0 }}>
          Sin autorización escrita no se permite copiar, redistribuir, vender, modificar ni publicar Anotomía, su código o su
          diseño, ni usarla con fines comerciales.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Sus notas son suyas.</strong> Se guardan solo en su dispositivo o en los archivos que usted elija; no se envían a
          ningún servidor. Haga copias de seguridad: Anotomía no puede recuperar notas borradas. La app solo se conecta a
          GitHub para buscar o descargar versiones nuevas.
        </p>
        <p style={{ margin: 0 }}>
          El contenido de estudio es informativo y no reemplaza al asesoramiento médico ni a los textos oficiales.
        </p>
        <p style={{ margin: 0 }}>
          Anotomía incluye componentes de terceros (React, PDF.js, jsPDF, Tauri, Tabler Icons y las tipografías Bricolage Grotesque y
          Source Serif 4, entre otros) con sus propias licencias de código abierto.
        </p>
        <p className="nt-texto-suave" style={{ margin: 0 }}>
          Texto completo: hipocampus.vercel.app/legal/terminos · /legal/privacidad · /legal/derechos-de-autor
        </p>
      </div>
      <div className="nt-acciones" style={{ marginTop: '12px' }}>
        <button type="button" className="nt-btn nt-btn--primario" onClick={alCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}
