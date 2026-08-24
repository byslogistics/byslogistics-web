/**
 * Tests de la API de Conversiones de Meta (/api/capi).
 *
 * Ninguno sale a la red: `fetch` se sustituye por un doble que captura lo que
 * la función habría mandado a Meta. Lo que se comprueba es justo lo que no se
 * puede ver desde fuera —qué se hashea, qué no, qué se descarta y qué llega al
 * cuerpo de la petición—, porque un error ahí no rompe nada: los eventos salen
 * igual y Meta los ignora, o peor, los acepta mal emparejados.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import capiHandler from '../netlify/functions/capi.mts';

const ROOT = new URL('..', import.meta.url).pathname;
const ORIGEN = 'https://byslogistics.com.co';
const sha256 = valor => createHash('sha256').update(valor).digest('hex');

const fetchReal = globalThis.fetch;

/** Lo último que la función intentó mandarle a Meta. */
let llamada;

/** Una petición como la que manda el navegador. */
const pedir = (cuerpo, { origin = ORIGEN, metodo = 'POST' } = {}) =>
  capiHandler(
    new Request(`${ORIGEN}/api/capi`, {
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
    { ip: `10.0.0.${Math.floor(Math.random() * 250)}` }
  );

/** El evento mínimo válido. */
const evento = (extra = {}) => ({
  event_name: 'Lead',
  event_id: 'abc-123',
  event_source_url: `${ORIGEN}/contacto/`,
  ...extra,
});

beforeEach(() => {
  process.env.META_CAPI_ACCESS_TOKEN = 'token-de-prueba';
  delete process.env.META_TEST_EVENT_CODE;
  delete process.env.META_PIXEL_ID;
  llamada = null;

  globalThis.fetch = async (url, init) => {
    llamada = { url: String(url), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
});

afterEach(() => {
  globalThis.fetch = fetchReal;
  delete process.env.META_CAPI_ACCESS_TOKEN;
  delete process.env.META_TEST_EVENT_CODE;
  delete process.env.META_PIXEL_ID;
});

describe('quién puede escribir en el conjunto de datos', () => {
  test('solo se atiende POST', async () => {
    const res = await pedir(null, { metodo: 'GET' });
    assert.equal(res.status, 405);
    assert.equal(llamada, null);
  });

  test('solo se atiende lo que venga del propio sitio', async () => {
    const res = await pedir(evento(), { origin: 'https://otro-sitio.com' });
    assert.equal(res.status, 403);
    assert.equal(llamada, null, 'llegó a Meta un evento de otro origen');
  });

  test('un evento que el sitio no manda se descarta', async () => {
    /*
     * Este es el guardia que más importa. El endpoint está abierto a internet
     * y escribe en la cuenta de la empresa: sin la lista de eventos
     * permitidos, cualquiera que descubra la ruta puede meter compras
     * inventadas y envenenar la optimización de las campañas.
     */
    const res = await pedir(evento({ event_name: 'Purchase' }));
    assert.equal(res.status, 400);
    assert.equal(llamada, null, 'una compra inventada llegó a Meta');
  });

  test('sin event_id no se manda: se contaría dos veces', async () => {
    // El navegador ya mandó el suyo. Sin el identificador compartido, Meta no
    // puede saber que son el mismo y registra la conversión por duplicado.
    const res = await pedir(evento({ event_id: undefined }));
    assert.equal(res.status, 400);
    assert.equal(llamada, null);
  });
});

describe('sin token configurado', () => {
  test('no manda nada y responde que todo va bien', async () => {
    /*
     * Es el caso de una preview de Netlify sin la variable puesta. El
     * visitante no tiene por qué ver errores en la consola, y el píxel del
     * navegador sigue midiendo por su cuenta.
     */
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const res = await pedir(evento());
    assert.equal(res.status, 200);
    assert.equal((await res.json()).enviado, false);
    assert.equal(llamada, null);
  });
});

describe('lo que se le manda a Meta', () => {
  test('el token va en el cuerpo, nunca en la dirección', async () => {
    // Una URL con el token dentro termina en los registros de acceso de
    // cualquier intermediario, y de ahí ya no se borra.
    await pedir(evento());
    assert.doesNotMatch(llamada.url, /token-de-prueba/);
    assert.doesNotMatch(llamada.url, /access_token/);
    assert.equal(llamada.body.access_token, 'token-de-prueba');
  });

  test('apunta al píxel del sitio y a una versión de la API', async () => {
    await pedir(evento());
    assert.match(llamada.url, /graph\.facebook\.com\/v\d+\.\d+\//);
    assert.match(llamada.url, /\/1059859873468241\/events$/);
  });

  test('conserva el identificador que emparejará los dos caminos', async () => {
    await pedir(evento());
    const [dato] = llamada.body.data;
    assert.equal(dato.event_id, 'abc-123');
    assert.equal(dato.event_name, 'Lead');
    assert.equal(dato.action_source, 'website');
    assert.equal(dato.event_source_url, `${ORIGEN}/contacto/`);
    assert.ok(
      Number.isInteger(dato.event_time) && dato.event_time > 1e9,
      'event_time debe ir en segundos, no en milisegundos'
    );
  });

  test('el código de eventos de prueba solo viaja si está configurado', async () => {
    await pedir(evento());
    assert.equal(llamada.body.test_event_code, undefined);

    process.env.META_TEST_EVENT_CODE = 'TEST123';
    await pedir(evento());
    assert.equal(llamada.body.test_event_code, 'TEST123');
  });
});

describe('datos personales', () => {
  const contacto = {
    email: '  Juan.Perez@Correo.COM ',
    telefono: '(320) 951 4930',
    nombre: 'Juan Pérez',
    fbp: 'fb.1.1700000000.1234567890',
    fbc: 'fb.1.1700000000.AbC_dEf',
  };

  test('salen hasheados, nunca en claro', async () => {
    await pedir(evento({ user_data: contacto }));
    const enviado = JSON.stringify(llamada.body);

    assert.doesNotMatch(enviado, /Juan\.Perez@Correo\.COM/i);
    assert.doesNotMatch(enviado, /juan\.perez@correo\.com/i);
    assert.doesNotMatch(enviado, /9514930/, 'el teléfono salió en claro');
    assert.doesNotMatch(enviado, /Pérez/i);
  });

  test('se normalizan antes de hashear, o no coinciden con nada', async () => {
    await pedir(evento({ user_data: contacto }));
    const { user_data } = llamada.body.data[0];

    // Minúsculas y sin espacios sobrantes: «Juan@Correo.COM » y
    // «juan@correo.com» tienen que dar el mismo hash.
    assert.deepEqual(user_data.em, [sha256('juan.perez@correo.com')]);

    // Con indicativo de país y solo dígitos. Sin el 57, un celular
    // colombiano no coincide con nada en Meta.
    assert.deepEqual(user_data.ph, [sha256('573209514930')]);

    // Nombre y apellido por separado, sin tildes.
    assert.deepEqual(user_data.fn, [sha256('juan')]);
    assert.deepEqual(user_data.ln, [sha256('perez')]);
  });

  test('las cookies, la IP y el navegador van SIN hashear', async () => {
    // No es una elección: mandar `fbp` hasheado es mandarlo roto, y Meta lo
    // descarta sin avisar.
    await pedir(evento({ user_data: contacto }));
    const { user_data } = llamada.body.data[0];

    assert.equal(user_data.fbp, contacto.fbp);
    assert.equal(user_data.fbc, contacto.fbc);
    assert.match(user_data.client_ip_address, /^10\.0\.0\./);
    assert.equal(user_data.client_user_agent, 'Mozilla/5.0 (prueba)');
  });

  test('los campos vacíos no se mandan', async () => {
    // Meta rechaza el evento entero si una clave llega vacía.
    await pedir(evento({ user_data: { fbp: '', email: '' } }));
    const { user_data } = llamada.body.data[0];

    assert.ok(!('em' in user_data), 'se mandó un correo vacío');
    assert.ok(!('fbp' in user_data), 'se mandó una cookie vacía');
    for (const valor of Object.values(user_data)) {
      assert.ok(valor !== undefined && valor !== '' && valor !== null);
    }
  });

  test('una visita anónima manda lo que tiene y nada más', async () => {
    // La mayoría de los eventos —ver una ficha, buscar, añadir a la
    // cotización— no llevan datos de contacto, y eso es lo normal.
    await pedir(evento({ event_name: 'ViewContent' }));
    const { user_data } = llamada.body.data[0];

    assert.ok(!('em' in user_data));
    assert.ok(!('ph' in user_data));
    assert.ok(user_data.client_user_agent, 'el navegador siempre se puede dar');
  });
});

describe('cuando Meta falla', () => {
  test('no se le cuenta al navegador por qué', async () => {
    // La respuesta de Meta puede describir la configuración de la cuenta, y
    // esto lo lee cualquiera. El motivo queda en los registros de Netlify.
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: { message: 'Invalid OAuth access token', code: 190 },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );

    const res = await pedir(evento());
    const cuerpo = await res.text();
    assert.equal(res.status, 502);
    assert.doesNotMatch(cuerpo, /OAuth/);
    assert.doesNotMatch(cuerpo, /token/i);
  });

  test('una caída de red no rompe nada', async () => {
    globalThis.fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const res = await pedir(evento());
    assert.equal(res.status, 502);
    assert.equal((await res.json()).enviado, false);
  });
});

describe('las dos mitades no se separan', () => {
  const capi = readFileSync(join(ROOT, 'netlify/functions/capi.mts'), 'utf8');
  const cliente = readFileSync(
    join(ROOT, 'src/assets/scripts/analytics.js'),
    'utf8'
  );

  test('el píxel del endpoint es el del sitio', () => {
    // Están escritos dos veces porque son dos mundos que no se importan entre
    // sí: uno lo compila Astro y el otro lo empaqueta Netlify.
    const constants = readFileSync(
      join(ROOT, 'src/data_files/constants.ts'),
      'utf8'
    );
    const delSitio = constants.match(/metaPixelId:\s*'(\d+)'/)[1];
    const delEndpoint = capi.match(/PIXEL_POR_DEFECTO = '(\d+)'/)[1];
    assert.equal(delEndpoint, delSitio);
  });

  test('todo evento que el navegador manda, el endpoint lo acepta', () => {
    /*
     * Si el cliente empieza a mandar un evento nuevo y nadie lo agrega a la
     * lista del endpoint, ese evento se pierde por el camino del servidor sin
     * un solo error a la vista: el píxel sigue contándolo, así que en los
     * informes aparece —solo que sin la mitad de su cobertura—.
     */
    const permitidos = new Set(
      [
        ...capi
          .match(/EVENTOS_PERMITIDOS = new Set\(\[([\s\S]*?)\]\)/)[1]
          .matchAll(/'([^']+)'/g),
      ].map(m => m[1])
    );

    const delCliente = new Set(
      [...cliente.matchAll(/\bmeta\('([A-Z][A-Za-z]+)'/g)].map(m => m[1])
    );
    assert.ok(delCliente.size > 5, 'no se leyeron los eventos del cliente');

    for (const nombre of delCliente) {
      assert.ok(
        permitidos.has(nombre),
        `el navegador manda «${nombre}» y el endpoint lo descartaría`
      );
    }
  });

  test('el navegador y el servidor comparten el identificador', () => {
    // Sin `eventID` en la llamada del píxel no hay nada que emparejar, y cada
    // conversión se cuenta dos veces.
    assert.match(
      cliente,
      /window\.fbq\('track', nombre, datos \|\| \{\}, \{\s*eventID: id/
    );
  });
});
