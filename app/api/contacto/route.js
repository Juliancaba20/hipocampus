// Recibe el formulario de /contacto y lo reenvía por mail con Resend (https://resend.com).
// Variables de entorno (Vercel > Settings > Environment Variables):
//   RESEND_API_KEY  clave de la API de Resend
//   CONTACT_TO      correo donde se reciben los mensajes
//   CONTACT_FROM    (opcional) remitente; por defecto el de pruebas de Resend

const TIPOS = { error: 'Error', sugerencia: 'Sugerencia', otro: 'Otro' };
const MAX_MENSAJE = 2000;
const intentos = new Map(); // IP -> marcas de tiempo (limitación simple, por instancia)

function limitado(ip) {
  const ahora = Date.now();
  if (intentos.size > 2000) { // evita que el mapa crezca sin límite
    for (const [clave, marcas] of intentos) if (!marcas.some((t) => ahora - t < 10 * 60 * 1000)) intentos.delete(clave);
  }
  const recientes = (intentos.get(ip) || []).filter((t) => ahora - t < 10 * 60 * 1000);
  if (recientes.length >= 5) { intentos.set(ip, recientes); return true; }
  recientes.push(ahora);
  intentos.set(ip, recientes);
  return false;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (cuerpo, status = 200) => Response.json(cuerpo, { status });

export async function POST(request) {
  // Solo se aceptan envíos hechos desde este mismo sitio y de tamaño razonable.
  const origen = request.headers.get('origin');
  if (origen) {
    let mismo = false;
    try { mismo = new URL(origen).host === request.headers.get('host'); } catch { mismo = false; }
    if (!mismo) return json({ error: 'Origen no permitido.' }, 403);
  }
  if (Number(request.headers.get('content-length') || 0) > 10000) return json({ error: 'El mensaje es demasiado largo.' }, 413);

  let d;
  try { d = await request.json(); } catch { return json({ error: 'No se pudo leer el mensaje.' }, 400); }

  if (d.web) return json({ ok: true }); // campo trampa: lo completan solo los robots

  const tipo = TIPOS[d.tipo] ? d.tipo : null;
  const mensaje = typeof d.mensaje === 'string' ? d.mensaje.trim() : '';
  const email = typeof d.email === 'string' ? d.email.trim() : '';

  if (!tipo) return json({ error: 'Elija qué desea enviar.' }, 400);
  if (mensaje.length < 10) return json({ error: 'Escriba un mensaje un poco más detallado (al menos 10 caracteres).' }, 400);
  if (mensaje.length > MAX_MENSAJE) return json({ error: `El mensaje es demasiado largo (máximo ${MAX_MENSAJE} caracteres).` }, 400);
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: 'El correo indicado no parece válido. Puede dejarlo en blanco.' }, 400);

  const ip = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'desconocida').split(',')[0].trim();
  if (limitado(ip)) return json({ error: 'Envió varios mensajes seguidos. Intente nuevamente en unos minutos.' }, 429);

  const { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO) return json({ error: 'El envío de mensajes no está disponible por el momento.' }, 503);

  const etiqueta = TIPOS[tipo];
  const texto = `${etiqueta}\n\n${mensaje}\n\nCorreo de contacto: ${email || '(no indicó)'}`;
  const html = `<p><b>${esc(etiqueta)}</b></p><p style="white-space:pre-wrap">${esc(mensaje)}</p><p>Correo de contacto: ${email ? esc(email) : '<i>(no indicó)</i>'}</p>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM || 'Hipocampus <onboarding@resend.dev>',
        to: [CONTACT_TO],
        subject: `[Hipocampus] ${etiqueta}`,
        html,
        text: texto,
        ...(email ? { reply_to: email } : {}),
      }),
    });
    if (!r.ok) {
      console.error('Resend respondió', r.status, await r.text());
      return json({ error: 'No se pudo enviar el mensaje. Intente nuevamente más tarde.' }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error('Error al enviar el mensaje', e);
    return json({ error: 'No se pudo enviar el mensaje. Intente nuevamente más tarde.' }, 502);
  }
}
