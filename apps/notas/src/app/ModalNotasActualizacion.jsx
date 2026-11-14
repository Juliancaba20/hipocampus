import { Modal } from './Modal.jsx';
import NotasActualizacion from './NotasActualizacion.jsx';
import { versionVisible } from './notasActualizacion.js';

export default function ModalNotasActualizacion({ alCerrar }) {
  return (
    <Modal titulo={`Notas de actualización · Anotomía ${versionVisible()}`} alCerrar={alCerrar} ancho={620}>
      <NotasActualizacion />
      <div className="nt-acciones" style={{ marginTop: '12px' }}>
        <button type="button" className="nt-btn nt-btn--primario" onClick={alCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}
