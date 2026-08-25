/**
 * Suscripción a novedades. Se publica en /api/suscripcion.
 *
 * QUÉ HACE. Agrega el correo a los contactos de Resend (Resend → Audience),
 * que es la lista real desde la que más adelante se mandan las novedades
 * (con Resend → Broadcasts, o con la propia API). No manda ningún correo
 * desde aquí: solo deja a la persona en la lista. La cuenta de Resend de la
 * empresa tiene una sola audiencia, y crear un contacto no pide su
 * identificador —ni el SDK de Resend lo pide—, así que tampoco se pide aquí.
 *
 * Mismo reparto que capi.mts y contacto.mts: la clave de Resend vive solo en
 * las variables de entorno de Netlify, nunca en el navegador ni en el
 * repositorio.
 *
 * SI FALLA. Igual que contacto.mts: este endpoint es el único camino de la
 * suscripción, así que sin la API configurada se responde con un error real
 * y no con un 200 fingido. El formulario del pie de página ya tiene un
 * mensaje de repuesto para ese caso (`data-form-fallback` en
 * FooterSection.astro).
 *
 * Variables de entorno (panel de Netlify, NUNCA en el repositorio):
 *   RESEND_API_KEY   la misma clave que usa contacto.mts.
 */

interface NetlifyContext {
  ip?: string;
}

function origenPermitido(req: Request): boolean {
  const propio = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === propio;

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === propio;
    } catch {
      return false;
    }
  }
  return false;
}

const golpes = new Map<string, number[]>();
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 20;

function demasiadoRapido(ip: string): boolean {
  const ahora = Date.now();
  const previos = (golpes.get(ip) ?? []).filter(t => ahora - t < VENTANA_MS);
  previos.push(ahora);
  golpes.set(ip, previos);
  if (golpes.size > 500) golpes.clear();
  return previos.length > MAX_POR_VENTANA;
}

const pareceCorreo = (valor: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

interface Entrante {
  email?: string;
  botcheck?: string;
}

export default async (req: Request, context: NetlifyContext) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!origenPermitido(req)) return json({ error: 'Origen no permitido' }, 403);

  const ip =
    context?.ip || req.headers.get('x-nf-client-connection-ip') || 'anon';
  if (demasiadoRapido(ip)) return json({ error: 'Muy rápido' }, 429);

  let entrante: Entrante;
  try {
    entrante = (await req.json()) as Entrante;
  } catch {
    return json({ error: 'Cuerpo no válido' }, 400);
  }

  if ((entrante.botcheck ?? '').trim() !== '') return json({ enviado: true });

  const email = (entrante.email ?? '').trim();
  if (!pareceCorreo(email)) return json({ error: 'Correo no válido' }, 400);

  const token = process.env.RESEND_API_KEY;
  if (!token) {
    console.error(
      `[suscripcion] RESEND_API_KEY ausente: no se pudo suscribir a ${email}`
    );
    return json({ enviado: false, motivo: 'sin configurar' }, 502);
  }

  try {
    const res = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, unsubscribed: false }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detalle = (await res.text().catch(() => '')).slice(0, 500);
      console.error(`[suscripcion] Resend devolvió ${res.status}: ${detalle}`);
      return json({ enviado: false, motivo: 'rechazado' }, 502);
    }

    return json({ enviado: true });
  } catch (error) {
    console.error('[suscripcion] fallo llamando a Resend:', error);
    return json({ enviado: false, motivo: 'sin conexión' }, 502);
  }
};

export const config = { path: '/api/suscripcion' };
