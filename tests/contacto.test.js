/**
 * Tests del formulario de contacto (/api/contacto).
 *
 * Ninguno sale a la red: `fetch` se sustituye por un doble que captura lo que
 * la función habría mandado a Resend. Lo que se comprueba es justo lo que no
 * se puede ver desde fuera —qué se escapa, qué se descarta y qué llega en el
 * lote de correos—, porque un error ahí no rompe nada visible: los correos
 * simplemente no salen, o salen con el mensaje de otra persona sin escapar.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import contactoHandler from '../netlify/functions/contacto.mts';

const ROOT = new URL('..', import.meta.url).pathname;
const ORIGEN = 'https://byslogistics.com.co';

const fetchReal = globalThis.fetch;

/** Lo último que la función intentó mandarle a Resend. */
let llamada;

const pedir = (cuerpo, { origin = ORIGEN, metodo = 'POST' } = {}) =>
  contactoHandler(
    new Request(`${ORIGEN}/api/contacto`, {
      method: metodo,
      headers: {
        origin,
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (prueba)',
      },
      ...(metodo === 'POST' ? { body: JSON.stringify(cuerpo) } : {}),
    }),
    // Una IP distinta por llamada: el límite por minuto vive en memoria del
    // módulo y se arrastraría de un test al siguiente.
    { ip: `10.0.1.${Math.floor(Math.random() * 250)}` }
  );

/** El envío mínimo válido. */
const envio = (extra = {}) => ({
  name: 'Richard',
  email: 'richard@ejemplo.com',
  message: 'Necesito precintos de guaya',
  autorizacion: 'Sí',
  ...extra,
});

beforeEach(() => {
  process.env.RESEND_API_KEY = 'token-de-prueba';
  delete process.env.RESEND_FROM;
  delete process.env.RESEND_CONTACT_TO;
  llamada = null;

  globalThis.fetch = async (url, init) => {
    llamada = { url: String(url), body: JSON.parse(init.body) };
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
});

afterEach(() => {
  globalThis.fetch = fetchReal;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.RESEND_CONTACT_TO;
});

describe('quién puede escribir', () => {
  test('solo se atiende POST', async () => {
    const res = await pedir(null, { metodo: 'GET' });
    assert.equal(res.status, 405);
    assert.equal(llamada, null);
  });

  test('solo se atiende lo que venga del propio sitio', async () => {
    const res = await pedir(envio(), { origin: 'https://otro-sitio.com' });
    assert.equal(res.status, 403);
    assert.equal(llamada, null, 'llegó a Resend un envío de otro origen');
  });

  test('la trampa antispam responde éxito sin mandar nada', () =>
    pedir(envio({ botcheck: 'soy un robot' })).then(res => {
      assert.equal(res.status, 200);
      assert.equal(llamada, null, 'un robot llegó a Resend');
    }));
});

describe('campos obligatorios', () => {
  for (const campo of ['name', 'email', 'message']) {
    test(`sin ${campo} se rechaza`, async () => {
      const res = await pedir(envio({ [campo]: '' }));
      assert.equal(res.status, 400);
      assert.equal(llamada, null);
    });
  }

  test('sin la autorización marcada se rechaza', async () => {
    const res = await pedir(envio({ autorizacion: undefined }));
    assert.equal(res.status, 400);
    assert.equal(llamada, null);
  });

  test('un correo con forma inválida se rechaza', async () => {
    const res = await pedir(envio({ email: 'no-es-un-correo' }));
    assert.equal(res.status, 400);
    assert.equal(llamada, null);
  });
});

describe('sin token configurado', () => {
  test('NO finge que se envió: es el único camino del formulario', async () => {
    // A diferencia de capi.mts, aquí no hay un píxel de repuesto que siga
    // midiendo por su cuenta: sin Resend, el mensaje no llega a ningún lado,
    // así que el endpoint tiene que decirlo con un error real.
    delete process.env.RESEND_API_KEY;
    const res = await pedir(envio());
    assert.notEqual(res.status, 200);
    assert.equal((await res.json()).enviado, false);
    assert.equal(llamada, null);
  });
});

describe('lo que se le manda a Resend', () => {
  test('un solo lote, con el aviso interno y la confirmación', async () => {
    await pedir(envio());
    assert.match(llamada.url, /\/emails\/batch$/);
    assert.equal(llamada.body.length, 2);

    const [interno, confirmacion] = llamada.body;
    assert.ok(interno.to.includes('ventas@precintosdeseguridad.co'));
    assert.equal(interno.reply_to, 'Richard <richard@ejemplo.com>');
    assert.deepEqual(confirmacion.to, ['richard@ejemplo.com']);
  });

  test('el token va en la cabecera, nunca en el cuerpo ni en la URL', async () => {
    await pedir(envio());
    assert.doesNotMatch(llamada.url, /token-de-prueba/);
    assert.doesNotMatch(JSON.stringify(llamada.body), /token-de-prueba/);
  });

  test('sin RESEND_CONTACT_TO, el aviso llega a ventas y a los dos correos administrativos', async () => {
    await pedir(envio());
    const [interno] = llamada.body;
    assert.deepEqual(interno.to, [
      'ventas@precintosdeseguridad.co',
      'byslogisticssas@gmail.com',
      'byslogisticsltda@hotmail.com',
    ]);
  });

  test('RESEND_FROM y RESEND_CONTACT_TO cambian el remitente y el destino', async () => {
    process.env.RESEND_FROM = 'Ventas <ventas@byslogistics.com.co>';
    process.env.RESEND_CONTACT_TO =
      'otro@precintosdeseguridad.co, otro-mas@precintosdeseguridad.co';
    await pedir(envio());
    const [interno, confirmacion] = llamada.body;
    assert.equal(interno.from, 'Ventas <ventas@byslogistics.com.co>');
    assert.equal(confirmacion.from, 'Ventas <ventas@byslogistics.com.co>');
    assert.deepEqual(interno.to, [
      'otro@precintosdeseguridad.co',
      'otro-mas@precintosdeseguridad.co',
    ]);
  });

  test('el motivo se traduce al texto que verá el equipo comercial', async () => {
    await pedir(envio({ subject: 'distribucion' }));
    const [interno] = llamada.body;
    assert.match(interno.subject, /Distribución o alianza comercial/);
    assert.match(interno.html, /Distribución o alianza comercial/);
  });

  test('un motivo que no está en la lista se descarta en silencio', async () => {
    await pedir(envio({ subject: 'inventado' }));
    const [interno] = llamada.body;
    assert.doesNotMatch(interno.subject, /inventado/);
    assert.doesNotMatch(interno.html, /inventado/);
  });

  /*
   * Al correo comercial le entran también mensajes escritos a mano y
   * reenviados por asesores. Sin una marca, no hay forma de saber cuál llegó
   * por el formulario del sitio y hay que atender con el guion de la web.
   */
  test('el aviso interno dice que la consulta viene del formulario del sitio', async () => {
    await pedir(envio());
    const [interno, confirmacion] = llamada.body;

    assert.match(
      interno.subject,
      /^\[Formulario web\]/,
      `el asunto no marca la procedencia: ${interno.subject}`
    );
    assert.match(interno.html, /Formulario de contacto del sitio web/);
    assert.match(interno.text, /Formulario de contacto del sitio web/);

    // La confirmación la lee el cliente: ahí la marca interna no pinta nada.
    assert.doesNotMatch(confirmacion.subject, /Formulario web/);
  });

  test('el aviso dice desde qué página se envió, sin arrastrar la búsqueda', async () => {
    const res = await contactoHandler(
      new Request(`${ORIGEN}/api/contacto`, {
        method: 'POST',
        headers: {
          origin: ORIGEN,
          referer: `${ORIGEN}/catalogo/?q=lo-que-tecleo#resultados`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(envio()),
      }),
      { ip: '10.0.2.7' }
    );
    assert.equal(res.status, 200);

    const [interno] = llamada.body;
    assert.match(interno.html, /byslogistics\.com\.co\/catalogo\//);
    assert.doesNotMatch(interno.html, /lo-que-tecleo/);
  });

  test('un referer de fuera no se imprime en el correo', async () => {
    await contactoHandler(
      new Request(`${ORIGEN}/api/contacto`, {
        method: 'POST',
        headers: {
          origin: ORIGEN,
          referer: 'https://sitio-ajeno.com/lo-que-sea',
          'content-type': 'application/json',
        },
        body: JSON.stringify(envio()),
      }),
      { ip: '10.0.2.8' }
    );
    const [interno] = llamada.body;
    assert.doesNotMatch(interno.html, /sitio-ajeno/);
  });
});

describe('el mensaje de otra persona nunca se ejecuta', () => {
  test('el HTML del correo escapa el contenido del mensaje', async () => {
    await pedir(
      envio({ message: '<img src=x onerror=alert(1)>', company: '<b>Acme</b>' })
    );
    const [interno, confirmacion] = llamada.body;
    for (const correo of [interno, confirmacion]) {
      assert.doesNotMatch(correo.html, /<img src=x onerror/);
    }
    assert.match(interno.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(interno.html, /<b>Acme<\/b>/);
  });

  test('un nombre con salto de línea no inyecta cabeceras', async () => {
    await pedir(envio({ name: 'Richard\r\nBcc: otro@correo.com' }));
    const [interno] = llamada.body;
    assert.doesNotMatch(interno.reply_to, /[\r\n]/);
    assert.doesNotMatch(interno.subject, /[\r\n]/);
  });
});

describe('cuando Resend falla', () => {
  test('no se le cuenta al navegador por qué', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'Invalid API key' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });

    const res = await pedir(envio());
    const cuerpo = await res.text();
    assert.equal(res.status, 502);
    assert.doesNotMatch(cuerpo, /API key/);
  });

  test('una caída de red no rompe nada', async () => {
    globalThis.fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const res = await pedir(envio());
    assert.equal(res.status, 502);
    assert.equal((await res.json()).enviado, false);
  });
});

describe('las listas no se separan', () => {
  const funcion = readFileSync(
    join(ROOT, 'netlify/functions/contacto.mts'),
    'utf8'
  );

  test('el correo interno del endpoint es el del sitio', () => {
    const constants = readFileSync(
      join(ROOT, 'src/data_files/constants.ts'),
      'utf8'
    );
    const delSitio = constants.match(/email:\s*'([^']+)'/)[1];
    const delEndpoint = funcion.match(/CONTACT_EMAIL = '([^']+)'/)[1];
    assert.equal(delEndpoint, delSitio);
  });

  test('los motivos del formulario y del endpoint coinciden', () => {
    const seccion = readFileSync(
      join(ROOT, 'src/components/sections/misc/ContactSection.astro'),
      'utf8'
    );
    const delFormulario = new Set(
      [...seccion.matchAll(/value: '([a-z]+)'/g)].map(m => m[1])
    );

    const bloqueMotivos = funcion.match(
      /MOTIVOS: Record<string, string> = \{([\s\S]*?)\n\};/
    )[1];
    const delEndpoint = new Set(
      [...bloqueMotivos.matchAll(/^\s*([a-z]+):/gm)].map(m => m[1])
    );

    assert.ok(
      delFormulario.size > 0,
      'no se leyeron los motivos del formulario'
    );
    assert.deepEqual(delFormulario, delEndpoint);
  });
});
