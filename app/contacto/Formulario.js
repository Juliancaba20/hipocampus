'use client';
import { useState } from 'react';
import Link from 'next/link';

const tipos = [['error', 'Encontré un error'], ['sugerencia', 'Tengo una sugerencia'], ['otro', 'Otro motivo']];
const MAX = 2000;

export default function Formulario() {
  const [tipo, setTipo] = useState('error');
  const [mensaje, setMensaje] = useState('');
  const [email, setEmail] = useState('');
  const [web, setWeb] = useState('');
  const [estado, setEstado] = useState('listo'); // listo | enviando | enviado
  const [error, setError] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEstado('enviando');
    try {
      const r = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, mensaje, email, web }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar el mensaje. Intente nuevamente.');
      setEstado('enviado');
    } catch (err) {
      setError(err.message);
      setEstado('listo');
    }
  }

  if (estado === 'enviado') {
    return (
      <div className="form-ok" role="status">
        <h2>Mensaje enviado</h2>
        <p>Gracias por escribir. Lo leeré y, si dejó un correo, le responderé por esa vía.</p>
        <Link className="btn" href="/">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>¿Qué desea enviar?</legend>
        <div className="opciones">
          {tipos.map(([v, t]) => (
            <label key={v}>
              <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="campo mensaje">
        <label htmlFor="mensaje">Mensaje</label>
        <textarea id="mensaje" name="mensaje" rows={7} maxLength={MAX} required value={mensaje} onChange={(e) => setMensaje(e.target.value)}
          placeholder={tipo === 'error' ? 'Cuéntenos qué ocurrió y en qué página, para poder repetirlo.' : 'Escriba aquí su mensaje.'} />
        <small>{mensaje.length} / {MAX}</small>
      </div>

      <div className="campo">
        <label htmlFor="email">Su correo <span className="opc">(opcional, solo si desea una respuesta)</span></label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" />
      </div>

      {/* Campo trampa para robots: las personas no lo ven */}
      <div className="trampa" aria-hidden="true">
        <label>No completar<input type="text" name="web" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} /></label>
      </div>

      <p className="form-legal">
        Al enviar este mensaje usted acepta el tratamiento de sus datos según la <Link href="/legal/privacidad">Política de privacidad</Link>.
      </p>

      <div className="acciones">
        <p className="form-error" role="alert" hidden={!error}>{error}</p>
        <button className="btn enviar" type="submit" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviar mensaje'}</button>
      </div>
    </form>
  );
}
