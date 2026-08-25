/**
 * Tests de la suscripción a novedades (/api/suscripcion).
 *
 * Ninguno sale a la red: `fetch` se sustituye por un doble que captura lo que
 * la función habría mandado a los contactos de Resend.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import suscripcionHandler from '../netlify/functions/suscripcion.mts';

const ORIGEN = 'https://byslogistics.com.co';
const fetchReal = globalThis.fetch;

let llamada;

const pedir = (cuerpo, { origin = ORIGEN, metodo = 'POST' } = {}) =>
  suscripcionHandler(
    new Request(`${ORIGEN}/api/suscripcion`, {
      method: metodo,
      headers: { origin, 'content-type': 'application/json' },
      ...(metodo === 'POST' ? { body: JSON.stringify(cuerpo) } : {}),
    }),
    { ip: `10.0.2.${Math.floor(Math.random() * 250)}` }
  );

beforeEach(() => {
  process.env.RESEND_API_KEY = 'token-de-prueba';
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
});

describe('quién puede suscribirse', () => {
  test('solo se atiende POST', async () => {
    const res = await pedir(null, { metodo: 'GET' });
    assert.equal(res.status, 405);
    assert.equal(llamada, null);
  });

  test('solo se atiende lo que venga del propio sitio', async () => {
    const res = await pedir(
      { email: 'r@e.com' },
      { origin: 'https://otro-sitio.com' }
    );
    assert.equal(res.status, 403);
    assert.equal(llamada, null);
  });

  test('la trampa antispam responde éxito sin mandar nada', async () => {
    const res = await pedir({ email: 'r@e.com', botcheck: 'soy un robot' });
    assert.equal(res.status, 200);
    assert.equal(llamada, null);
  });

  test('un correo con forma inválida se rechaza', async () => {
    const res = await pedir({ email: 'no-es-un-correo' });
    assert.equal(res.status, 400);
    assert.equal(llamada, null);
  });
});

describe('sin configurar', () => {
  test('sin RESEND_API_KEY no finge que se suscribió', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await pedir({ email: 'r@e.com' });
    assert.notEqual(res.status, 200);
    assert.equal((await res.json()).enviado, false);
    assert.equal(llamada, null);
  });
});

describe('lo que se le manda a Resend', () => {
  test('al endpoint de contactos, con el correo', async () => {
    await pedir({ email: 'nueva@ejemplo.com' });
    assert.match(llamada.url, /\/contacts$/);
    assert.equal(llamada.body.email, 'nueva@ejemplo.com');
    assert.equal(llamada.body.unsubscribed, false);
  });

  test('el token va en la cabecera, no en el cuerpo', async () => {
    await pedir({ email: 'r@e.com' });
    assert.doesNotMatch(JSON.stringify(llamada.body), /token-de-prueba/);
  });
});

describe('cuando Resend falla', () => {
  test('una caída de red no rompe nada', async () => {
    globalThis.fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const res = await pedir({ email: 'r@e.com' });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).enviado, false);
  });
});
