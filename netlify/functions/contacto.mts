/**
 * Formulario de contacto. Se publica en /api/contacto.
 *
 * QUÉ HACE. Recibe lo que la persona escribió en /contacto y manda dos
 * correos por Resend en una sola llamada (`/emails/batch`):
 *
 *   1. Un aviso al equipo comercial, con `reply_to` puesto en el correo de
 *      quien escribió — responder ese correo responde directo a la persona,
 *      sin copiar y pegar la dirección. El asunto y el cuerpo dicen que la
 *      consulta llegó por el FORMULARIO DEL SITIO y desde qué página: al
 *      correo comercial también le entran mensajes escritos a mano, remitidos
 *      por un asesor o llegados de otros portales, y sin esa marca no hay
 *      forma de saber cuál de todos es el que hay que atender con el guion de
 *      la web (ver `PROCEDENCIA` y `origenDeLaConsulta`).
 *   2. Una confirmación a quien escribió, para que sepa que el mensaje llegó
 *      y en cuánto le responden.
 *
 * POR QUÉ UN INTERMEDIARIO Y NO RESEND DESDE EL NAVEGADOR. Igual que en
 * capi.mts: la clave de Resend da permiso para mandar correo en nombre de la
 * empresa, y en un sitio estático no hay dónde guardarla salvo aquí. Vive
 * solo en las variables de entorno de Netlify y no sale de esta función.
 *
 * SI FALLA. A diferencia de capi.mts —donde el píxel del navegador sigue
 * midiendo aunque el servidor no diga nada—, este endpoint ES el único
 * camino del formulario: si Resend no está configurado o rechaza el envío,
 * se responde con un error de verdad (no 200 con `enviado:false`), porque el
 * script del formulario (contactForms.js) usa justo esa señal para ofrecer
 * WhatsApp como alternativa. Silenciar el error aquí dejaría a la persona
 * creyendo que su mensaje llegó cuando no llegó a ningún lado.
 *
 * Variables de entorno (panel de Netlify, NUNCA en el repositorio):
 *   RESEND_API_KEY     la clave de Resend, con permiso de envío únicamente.
 *   RESEND_FROM         opcional. Remitente de los dos correos, con el
 *                        formato «Nombre <correo@dominio>». Por defecto
 *                        `FROM_POR_DEFECTO`, más abajo. El dominio tiene que
 *                        estar verificado en la cuenta de Resend de la
 *                        empresa o el envío falla.
 *   RESEND_CONTACT_TO   opcional. A quién llega el aviso interno, separado
 *                        por comas si es más de uno. Por defecto,
 *                        `CONTACT_EMAIL` más `AVISO_ADICIONAL`, más abajo.
 *
 * Los tipos de Netlify se declaran aquí en lugar de importar
 * `@netlify/functions`, por el mismo motivo que en capi.mts: no sumar una
 * dependencia entera por una interfaz de dos líneas.
 */

interface NetlifyContext {
  ip?: string;
}

/**
 * A dónde llega el aviso interno por defecto. Repetido aquí y en
 * `CONTACT.email` (constants.ts) porque son dos mundos que no se importan
 * entre sí: uno lo compila Astro y el otro lo empaqueta Netlify. Hay un test
 * que comprueba que digan lo mismo.
 */
const CONTACT_EMAIL = 'ventas@precintosdeseguridad.co';

/**
 * Copia del aviso interno, además de `CONTACT_EMAIL`. Son los otros dos
 * correos administrativos del dominio (byslogistics.com.co), a pedido de la
 * empresa: quien revise cualquiera de los tres ve la consulta.
 */
const AVISO_ADICIONAL = [
  'byslogisticssas@gmail.com',
  'byslogisticsltda@hotmail.com',
];

const FROM_POR_DEFECTO = 'B&S Logistics <contacto@byslogistics.com.co>';

/**
 * Cómo se presenta el origen del mensaje en el correo interno.
 *
 * `etiqueta` abre el asunto, para que la consulta se distinga de un golpe en
 * la bandeja aunque el correo se lea desde el móvil y solo se vean las
 * primeras palabras. `nombre` es la fila del cuerpo, y se completa con la
 * página concreta desde la que se envió.
 */
const PROCEDENCIA = {
  etiqueta: '[Formulario web]',
  nombre: 'Formulario de contacto del sitio web',
  sitio: 'byslogistics.com.co',
};

/**
 * La página desde la que se envió, para poder decirlo en el correo.
 *
 * Se toma del `Referer`, no de un campo del formulario: un campo lo puede
 * escribir cualquiera que llame al endpoint, y aquí el dato solo sirve si es
 * de fiar. Se descarta todo lo que no sea del propio sitio, y de la URL solo
 * se conserva la ruta —ni parámetros ni fragmento—, porque una búsqueda del
 * catálogo puede arrastrar lo que la persona escribió y eso no pinta nada en
 * el aviso interno.
 */
function origenDeLaConsulta(req: Request): string {
  const propio = new URL(req.url).origin;
  const referer = req.headers.get('referer');
  if (!referer) return PROCEDENCIA.sitio;
  try {
    const url = new URL(referer);
    if (url.origin !== propio) return PROCEDENCIA.sitio;
    return `${PROCEDENCIA.sitio}${url.pathname}`;
  } catch {
    return PROCEDENCIA.sitio;
  }
}

/**
 * El motivo de consulta del formulario. Repetido aquí y en el `<select>` de
 * ContactSection.astro por el mismo motivo que `EVENTOS_PERMITIDOS` en
 * capi.mts: un valor que llegue aquí y no esté en esta lista se descarta en
 * vez de imprimirse tal cual en el correo.
 */
const MOTIVOS: Record<string, string> = {
  cotizacion: 'Cotización de producto',
  distribucion: 'Distribución o alianza comercial',
  soporte: 'Soporte con un pedido',
  otro: 'Otro',
};

/* ------------------------------------------------------------------ *
 * Quién puede llamar
 * ------------------------------------------------------------------ */

/** Mismo criterio que en capi.mts: no es autenticación, es quitar de en
 * medio el abuso barato. Lo que acota el gasto de verdad es el límite de
 * más abajo. */
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
/** Diez por minuto: nadie llena el formulario dos veces seguidas de verdad;
 * esto corta un bucle o un script, no a una persona. */
const MAX_POR_VENTANA = 10;

function demasiadoRapido(ip: string): boolean {
  const ahora = Date.now();
  const previos = (golpes.get(ip) ?? []).filter(t => ahora - t < VENTANA_MS);
  previos.push(ahora);
  golpes.set(ip, previos);
  if (golpes.size > 500) golpes.clear();
  return previos.length > MAX_POR_VENTANA;
}

/* ------------------------------------------------------------------ *
 * Saneado
 * ------------------------------------------------------------------ */

/** Escapa lo que va dentro del HTML del correo. Sin esto, un mensaje con
 * `<img src=x onerror=...>` se ejecutaría al abrir el correo en el cliente
 * del equipo comercial. */
const esc = (valor: string): string =>
  valor.replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!
  );

/** Quita saltos de línea. Va en todo lo que termina en una cabecera de
 * correo (`reply_to`, `subject`): sin esto, un nombre con un salto de línea
 * podría inyectar cabeceras adicionales en el envío. */
const unaLinea = (valor: string): string =>
  valor.replace(/[\r\n]+/g, ' ').trim();

const pareceCorreo = (valor: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

/* ------------------------------------------------------------------ *
 * Plantillas de correo
 * ------------------------------------------------------------------ */

interface Consulta {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  /** Sitio y ruta desde donde se envió. Ver `origenDeLaConsulta`. */
  origen: string;
}

/** El armazón que comparten los dos correos: cabecera con la marca, tarjeta
 * blanca y pie con la identidad legal. Tablas y estilos en línea a
 * propósito: es lo único que los clientes de correo interpretan igual. */
function envoltorio(cuerpoHtml: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0060a8;padding:20px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">B&amp;S Logistics</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
                ${cuerpoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0;font-size:12px;color:#64748b;">
                  BYS LOGISTICS S.A.S. · NIT 900.437.215-8<br>
                  Carrera 86B No. 53-22 Sur, Bloque 13, Oficina 152, Bogotá, Colombia
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function fila(etiqueta: string, valor: string): string {
  if (!valor) return '';
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(etiqueta)}</td>
    <td style="padding:4px 0;color:#1f2937;font-size:13px;">${esc(valor)}</td>
  </tr>`;
}

/** El aviso al equipo comercial. */
function correoInterno(c: Consulta): { html: string; text: string } {
  const html = envoltorio(`
    <h1 style="margin:0 0 4px;font-size:18px;color:#00203a;">Nueva consulta del sitio web</h1>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Enviada desde el ${esc(PROCEDENCIA.nombre.toLowerCase())} (${esc(c.origen)}).</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
      ${fila('Origen', `${PROCEDENCIA.nombre} — ${c.origen}`)}
      ${fila('Nombre', c.name)}
      ${fila('Correo', c.email)}
      ${fila('Teléfono', c.phone)}
      ${fila('Empresa', c.company)}
      ${fila('Motivo', c.subject)}
    </table>
    <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Mensaje</p>
    <p style="margin:0;padding:12px 16px;background:#f8fafc;border-radius:8px;white-space:pre-wrap;">${esc(c.message)}</p>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Responda este correo directamente: va a la dirección que dejó la persona.</p>
  `);
  const text = [
    'Nueva consulta del sitio web',
    `Origen: ${PROCEDENCIA.nombre} — ${c.origen}`,
    '',
    `Nombre: ${c.name}`,
    `Correo: ${c.email}`,
    c.phone && `Teléfono: ${c.phone}`,
    c.company && `Empresa: ${c.company}`,
    c.subject && `Motivo: ${c.subject}`,
    '',
    'Mensaje:',
    c.message,
  ]
    .filter(Boolean)
    .join('\n');
  return { html, text };
}

/** La confirmación a quien escribió. */
function correoConfirmacion(c: Consulta): { html: string; text: string } {
  const html = envoltorio(`
    <h1 style="margin:0 0 16px;font-size:18px;color:#00203a;">Recibimos su mensaje</h1>
    <p style="margin:0 0 16px;">Hola${c.name ? ` ${esc(c.name)}` : ''}, gracias por escribirnos. Un asesor revisa su consulta y le responde en un plazo de 1 a 2 días hábiles.</p>
    <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Lo que nos escribió</p>
    <p style="margin:0 0 20px;padding:12px 16px;background:#f8fafc;border-radius:8px;white-space:pre-wrap;">${esc(c.message)}</p>
    <p style="margin:0;">Si es urgente, escríbanos por WhatsApp al <a href="https://wa.me/573209514930" style="color:#0060a8;">320 951 4930</a> o llame a nuestro P.B.X. (601) 469 9575.</p>
  `);
  const text = [
    `Hola${c.name ? ` ${c.name}` : ''}, gracias por escribirnos.`,
    'Un asesor revisa su consulta y le responde en un plazo de 1 a 2 días hábiles.',
    '',
    'Lo que nos escribió:',
    c.message,
    '',
    'Si es urgente, escríbanos por WhatsApp al 320 951 4930 o al P.B.X. (601) 469 9575.',
  ].join('\n');
  return { html, text };
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

interface Entrante {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
  autorizacion?: string;
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

  // Trampa antispam: el campo lo rellenan los robots, nunca una persona. Se
  // responde éxito para no delatar el filtro, pero no se manda nada.
  if ((entrante.botcheck ?? '').trim() !== '') return json({ enviado: true });

  const name = unaLinea((entrante.name ?? '').trim());
  const email = unaLinea((entrante.email ?? '').trim());
  const message = (entrante.message ?? '').trim();

  if (!name || !email || !message || entrante.autorizacion !== 'Sí') {
    return json({ error: 'Faltan campos obligatorios' }, 400);
  }
  if (!pareceCorreo(email)) {
    return json({ error: 'Correo no válido' }, 400);
  }

  const datos: Consulta = {
    name,
    email,
    phone: unaLinea((entrante.phone ?? '').trim()),
    company: unaLinea((entrante.company ?? '').trim()),
    subject: MOTIVOS[entrante.subject ?? ''] ?? '',
    message,
    origen: origenDeLaConsulta(req),
  };

  const token = process.env.RESEND_API_KEY;
  if (!token) {
    // Sin clave configurada, el formulario NO puede fingir que se envió: es
    // su único camino. Se registra en los logs de Netlify y se responde con
    // un error real, para que el script ofrezca WhatsApp en su lugar.
    console.error(
      `[contacto] RESEND_API_KEY ausente: no se pudo enviar el mensaje de ${email}`
    );
    return json({ enviado: false, motivo: 'sin token' }, 502);
  }

  const from = process.env.RESEND_FROM || FROM_POR_DEFECTO;
  const interno = correoInterno(datos);
  const confirmacion = correoConfirmacion(datos);

  const destinatarios = process.env.RESEND_CONTACT_TO
    ? process.env.RESEND_CONTACT_TO.split(',')
        .map(d => d.trim())
        .filter(Boolean)
    : [CONTACT_EMAIL, ...AVISO_ADICIONAL];

  const lote = [
    {
      from,
      to: destinatarios,
      reply_to: `${name} <${email}>`,
      subject: `${PROCEDENCIA.etiqueta} Nueva consulta${datos.subject ? ` — ${datos.subject}` : ''} — ${name}`,
      html: interno.html,
      text: interno.text,
    },
    {
      from,
      to: [email],
      subject: 'Recibimos su mensaje — B&S Logistics',
      html: confirmacion.html,
      text: confirmacion.text,
    },
  ];

  try {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(lote),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detalle = (await res.text().catch(() => '')).slice(0, 500);
      console.error(`[contacto] Resend devolvió ${res.status}: ${detalle}`);
      return json({ enviado: false, motivo: 'rechazado' }, 502);
    }

    return json({ enviado: true });
  } catch (error) {
    console.error('[contacto] fallo llamando a Resend:', error);
    return json({ enviado: false, motivo: 'sin conexión' }, 502);
  }
};

export const config = { path: '/api/contacto' };
