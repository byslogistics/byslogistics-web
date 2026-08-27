/**
 * Tests de comportamiento en un navegador real.
 *
 * Levanta un servidor estático sobre dist/ y maneja Chromium con Playwright.
 * Cubre lo que solo se ve en ejecución: los filtros del catálogo, el
 * cotizador, el envío del formulario, la maquetación a distintos anchos y la
 * accesibilidad con axe.
 *
 * Requiere `pnpm build` previo. Si Playwright no está instalado, los tests se
 * omiten en lugar de fallar, para que `pnpm test` siga siendo útil sin él.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');

let chromium, axeSource;
try {
  ({ chromium } = require('playwright'));
  axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  chromium = null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

let server, browser, base;

before(async () => {
  if (!chromium) return;
  assert.ok(existsSync(DIST), 'ejecuta `pnpm build` antes de estos tests');

  server = createServer(async (req, res) => {
    // El POST de los formularios y del asistente lo interceptan los tests que
    // lo necesitan (page.route); aquí se responde 200 en general, para
    // simular las funciones de Netlify (/api/contacto, /api/suscripcion,
    // /api/chat) sin tener que levantarlas.
    if (req.method === 'POST') {
      res.writeHead(200).end('ok');
      return;
    }
    /*
     * Las rutas se resuelven como las resuelve Netlify: /x, /x/ y /x/index.html
     * son la misma página. El sitio enlaza sin barra final —así están escritos
     * todos sus enlaces internos—, y sin esto un clic sobre un enlace del
     * propio sitio caía en un 404 que en producción no ocurre.
     */
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    else if (!extname(path)) path += '/index.html';
    const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      const notFound = await readFile(join(DIST, '404.html')).catch(() => '');
      res.writeHead(404, { 'Content-Type': MIME['.html'] }).end(notFound);
    }
  });
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
});

after(async () => {
  await browser?.close();
  server?.close();
});

const skip = () => (chromium ? false : 'playwright no está instalado');

/**
 * Abre el panel del cotizador.
 *
 * El botón está dos veces en la barra —uno para el móvil y otro para el
 * escritorio, ver QuoteButton.astro—, así que hay que quedarse con el que se
 * ve a este ancho: un selector a secas encuentra los dos y Playwright, en modo
 * estricto, se planta.
 */
const abrirCotizacion = page =>
  page.locator('[data-quote-toggle]:visible').first().click();

describe('ficha de producto', { skip: skip() }, () => {
  /*
   * El recorrido que antes no existía: hasta ahora las tarjetas de una
   * categoría no llevaban a ninguna parte y no había dónde enseñar la
   * información del producto.
   */
  test('desde la categoría se entra a la referencia y se cotiza', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/precintos/precintos-de-correa-dentada/', {
      waitUntil: 'networkidle',
    });

    await page
      .locator('a', { hasText: 'Precinto Doble Dentado 38 cms' })
      .first()
      .click();
    await page.waitForLoadState('networkidle');

    assert.match(page.url(), /\/precinto-doble-dentado-38-cms\/?$/);
    assert.equal(
      await page.locator('h1').textContent(),
      'Precinto Doble Dentado 38 cms'
    );

    // El cotizador es el mismo del sitio, con la referencia ya adentro.
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(300);
    const panel = page.locator('[data-quote-panel]');
    assert.equal(await panel.getAttribute('data-open'), 'true');
    assert.match(
      await panel.textContent(),
      /Precinto Doble Dentado 38 cms/,
      'la referencia no llegó al cotizador'
    );
    await page.close();
  });

  test('el acordeón de preguntas abre una a la vez', async () => {
    const page = await browser.newPage();
    await page.goto(
      base +
        '/precintos/precintos-de-correa-dentada/precinto-doble-dentado-38-cms/',
      { waitUntil: 'networkidle' }
    );

    const botones = page.locator('.hs-accordion-toggle');
    assert.ok((await botones.count()) > 1, 'la ficha no heredó las preguntas');
    await botones.nth(1).click();
    await page.waitForTimeout(400);
    assert.equal(await botones.nth(1).getAttribute('aria-expanded'), 'true');
    await page.close();
  });
});

describe('medición', { skip: skip() }, () => {
  test('en local no sale ni un solo golpe a Meta ni a Google', async () => {
    /*
     * Estas pruebas navegan por medio sitio con un navegador de verdad. Si el
     * píxel arrancara aquí, cada `pnpm test` metería visitas y conversiones
     * falsas en la cuenta de producción y ensuciaría los públicos de
     * remarketing —y nadie se enteraría hasta ver el informe—.
     *
     * Se comprueba pidiendo la página y pulsando los botones que sí miden.
     */
    const page = await browser.newPage();
    const terceros = [];
    page.on('request', peticion => {
      const url = peticion.url();
      if (/facebook|googletagmanager|google-analytics/.test(url)) {
        terceros.push(url);
      }
    });

    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(300);

    assert.deepEqual(terceros, [], 'la medición arrancó contra localhost');

    // Y aun así el sitio funciona: los scripts llaman a `bysTrack` sin
    // comprobar nada, así que si no existiera, el cotizador se caería.
    assert.equal(
      await page.getAttribute('[data-quote-panel]', 'data-open'),
      'true'
    );
    assert.equal(await page.evaluate(() => typeof window.bysTrack), 'function');
    await page.close();
  });
});

describe('catálogo con filtros', { skip: skip() }, () => {
  test('filtra por línea de producto y acota las categorías', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    assert.equal(await page.locator('#catalog-count').textContent(), '115');

    // Las categorías viven dentro del desplegable de su línea: en reposo no se
    // ve ninguna, y abrir una línea solo enseña las suyas.
    assert.equal(await page.locator('.filtro-opcion:visible').count(), 0);

    const linea = page.locator(
      '[data-familia="etiquetas-y-cintas-de-seguridad"]'
    );
    await linea.locator('summary').click();
    await page
      .locator('input[value="familia:etiquetas-y-cintas-de-seguridad"]')
      .check();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#catalog-count').textContent(), '33');
    assert.equal(
      await linea.locator('.filtro-opcion:visible').count(),
      6,
      'toda la línea más sus cinco categorías'
    );
    assert.equal(
      await page.locator('.filtro-opcion:visible').count(),
      6,
      'las categorías de las demás líneas siguen plegadas'
    );
    await page.close();
  });

  test('filtra por categoría dentro de una línea', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    await page
      .locator('[data-familia="precintos-de-seguridad"] summary')
      .click();
    await page.locator('input[value="grupo:precintos-de-guaya"]').check();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#catalog-count').textContent(), '8');
    await page.close();
  });

  test('abrir una línea pliega la anterior', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    await page
      .locator('[data-familia="precintos-de-seguridad"] summary')
      .click();
    await page
      .locator('[data-familia="tulas-y-bolsas-de-seguridad"] summary')
      .click();
    await page.waitForTimeout(150);
    assert.equal(
      await page
        .locator('[data-familia="precintos-de-seguridad"]')
        .evaluate(el => el.open),
      false
    );
    await page.close();
  });

  test('el buscador ignora tildes y mayúsculas', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.fill('#catalog-search', 'GUAYA');
    await page.waitForTimeout(150);
    const conMayusculas = await page.locator('#catalog-count').textContent();
    await page.fill('#catalog-search', 'guaya');
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator('#catalog-count').textContent(),
      conMayusculas
    );
    assert.ok(Number(conMayusculas) > 0);
    await page.close();
  });

  test('avisa cuando la búsqueda no encuentra nada', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.fill('#catalog-search', 'xyz-no-existe');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#catalog-count').textContent(), '0');
    assert.ok(await page.locator('#catalog-empty').isVisible());
    await page.close();
  });

  test('el buscador encuentra por categoría, no solo por nombre', async () => {
    /*
     * Casi nadie escribe el nombre exacto de una referencia: se escribe el
     * tipo de producto. Antes, «guaya» solo encontraba las referencias que
     * llevaban la palabra en su nombre, así que buscar devolvía menos que
     * pulsar el filtro de esa misma categoría.
     */
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.fill('#catalog-search', 'guaya');
    await page.waitForTimeout(150);
    const porTexto = Number(await page.locator('#catalog-count').textContent());

    await page.fill('#catalog-search', '');
    await page
      .locator('[data-familia="precintos-de-seguridad"] summary')
      .click();
    await page.locator('input[value="grupo:precintos-de-guaya"]').check();
    await page.waitForTimeout(150);
    const porFiltro = Number(
      await page.locator('#catalog-count').textContent()
    );

    assert.ok(
      porTexto >= porFiltro,
      `buscar «guaya» dio ${porTexto} y filtrar por su categoría, ${porFiltro}`
    );
    await page.close();
  });

  test('las palabras de la búsqueda cuentan sueltas y en cualquier orden', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.fill('#catalog-search', 'guaya precinto');
    await page.waitForTimeout(150);
    const revuelto = Number(await page.locator('#catalog-count').textContent());
    assert.ok(revuelto > 0, 'dos palabras en otro orden no encontraron nada');

    await page.fill('#catalog-search', 'precinto guaya');
    await page.waitForTimeout(150);
    assert.equal(
      Number(await page.locator('#catalog-count').textContent()),
      revuelto
    );
    await page.close();
  });

  test('quien no dice «precinto» también encuentra los precintos', async () => {
    /*
     * El catálogo dice «precinto»; el cliente escribe «sello» o «marchamo»
     * según de dónde venga. Antes esas búsquedas devolvían cero en un catálogo
     * que sí tiene el producto, y cero es la peor respuesta posible: quien la
     * recibe se va, no prueba otra palabra.
     */
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    await page.fill('#catalog-search', 'precinto');
    await page.waitForTimeout(150);
    const precintos = await page.locator('#catalog-count').textContent();
    assert.ok(Number(precintos) > 40, `solo ${precintos} precintos`);

    for (const palabra of ['sello', 'marchamo']) {
      await page.fill('#catalog-search', palabra);
      await page.waitForTimeout(150);
      assert.equal(
        await page.locator('#catalog-count').textContent(),
        precintos,
        `«${palabra}» no llevó a los precintos`
      );
    }
    await page.close();
  });

  test('el catálogo enseña con qué palabra buscó de verdad', async () => {
    // Quien escribe «sello» no conoce la palabra «precinto», y es la que va a
    // necesitar para hablar con el asesor comercial.
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    const aviso = page.locator('#catalog-sinonimo');

    await page.fill('#catalog-search', 'precinto');
    await page.waitForTimeout(150);
    assert.ok(
      !(await aviso.isVisible()),
      'no hay nada que enseñar cuando ya se usó la palabra del catálogo'
    );

    await page.fill('#catalog-search', 'Sílica Gel');
    await page.waitForTimeout(150);
    assert.ok(await aviso.isVisible());
    assert.match(
      await aviso.textContent(),
      /«Sílica Gel».+«absorbente de humedad»/,
      'el aviso debe repetir la palabra tal como se escribió, con sus tildes'
    );
    await page.close();
  });

  test('un sinónimo no se lleva por delante una búsqueda que ya funciona', async () => {
    /*
     * «Candado» solo tiene que seguir llevando a los dos precintos tipo
     * candado; es la frase «candado plástico» la que hay que rescatar. Si
     * alguien tradujera «candado» → «precinto», esto devolvería los cuarenta y
     * nueve precintos del catálogo.
     */
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    await page.fill('#catalog-search', 'candado');
    await page.waitForTimeout(150);
    const solos = await page.locator('#catalog-count').textContent();
    assert.equal(solos, '2');
    assert.ok(!(await page.locator('#catalog-sinonimo').isVisible()));

    await page.fill('#catalog-search', 'candado plástico');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#catalog-count').textContent(), '2');
    await page.close();
  });

  test('lo que se está viendo se puede copiar y volver a abrir', async () => {
    // Es lo que permite que el equipo comercial mande «esta es nuestra línea
    // de guaya» con un enlace, en vez de con instrucciones.
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page
      .locator('[data-familia="precintos-de-seguridad"] summary')
      .click();
    await page.locator('input[value="grupo:precintos-de-guaya"]').check();
    await page.fill('#catalog-search', 'ref');
    await page.waitForTimeout(200);

    const url = page.url();
    assert.match(url, /f=grupo(%3A|:)precintos-de-guaya/);
    assert.match(url, /q=ref/);
    const esperado = await page.locator('#catalog-count').textContent();

    const otra = await browser.newPage();
    await otra.goto(url, { waitUntil: 'networkidle' });
    await otra.waitForTimeout(200);
    assert.equal(
      await otra.locator('#catalog-count').textContent(),
      esperado,
      'el enlace no reprodujo lo que se estaba viendo'
    );
    assert.equal(
      await otra.inputValue('#catalog-search'),
      'ref',
      'el término de búsqueda no volvió al campo'
    );
    await otra.close();
    await page.close();
  });

  test('las fichas de filtro activo quitan uno solo cada una', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page
      .locator('[data-familia="precintos-de-seguridad"] summary')
      .click();
    await page.locator('input[value="grupo:precintos-de-guaya"]').check();
    await page.fill('#catalog-search', 'ref');
    await page.waitForTimeout(200);

    const fichas = page.locator('#catalog-active [data-quitar]:visible');
    assert.equal(await fichas.count(), 2, 'deberían verse las dos fichas');

    await page.locator('[data-quitar="busqueda"]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.inputValue('#catalog-search'), '');
    assert.equal(
      await page.locator('#catalog-count').textContent(),
      '8',
      'quitar la búsqueda se llevó también el filtro de categoría'
    );
    await page.close();
  });

  test('el nombre de la referencia es el enlace de la tarjeta', async () => {
    /*
     * Antes el enlace era el epígrafe de la categoría: un lector de pantalla
     * leía ciento quince enlaces llamados «precintos de correa dentada» que
     * llevaban cada uno a un sitio distinto.
     */
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    const tarjeta = page.locator('[data-catalog-item]').first();
    const enlaces = tarjeta.locator('a');
    assert.equal(await enlaces.count(), 1, 'la tarjeta repite el enlace');
    assert.equal(
      (await enlaces.first().textContent()).trim(),
      (await tarjeta.locator('h2').textContent()).trim()
    );

    // Y aun así la tarjeta entera se puede pulsar, sin que el enlace se trague
    // el botón de cotizar.
    await tarjeta.locator('[data-quote-add]').click();
    await page.waitForTimeout(200);
    assert.match(
      page.url(),
      /\/catalogo\/?(\?.*)?$/,
      'cotizar navegó a la ficha'
    );
    assert.equal(
      await page.locator('[data-quote-count]').first().textContent(),
      '1'
    );
    await page.close();
  });

  test('en el móvil los filtros arrancan plegados', async () => {
    // La columna de filtros va delante de los resultados: desplegada, ocupaba
    // la primera pantalla entera antes de la primera referencia.
    const page = await browser.newPage({
      viewport: { width: 390, height: 840 },
    });
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);

    const boton = page.locator('#catalog-filters-toggle');
    assert.ok(await boton.isVisible(), 'no hay con qué desplegar los filtros');
    assert.equal(await boton.getAttribute('aria-expanded'), 'false');
    assert.ok(!(await page.locator('#catalog-filters').isVisible()));

    await boton.click();
    await page.waitForTimeout(200);
    assert.ok(await page.locator('#catalog-filters').isVisible());
    assert.equal(await boton.getAttribute('aria-expanded'), 'true');
    await page.close();
  });

  test('«limpiar filtros» restaura el listado completo', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.fill('#catalog-search', 'bolsa');
    await page
      .locator('[data-familia="tulas-y-bolsas-de-seguridad"] summary')
      .click();
    await page
      .locator('input[value="familia:tulas-y-bolsas-de-seguridad"]')
      .check();
    await page.waitForTimeout(150);
    await page.click('#catalog-reset');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#catalog-count').textContent(), '115');
    await page.close();
  });
});

describe('cotizador', { skip: skip() }, () => {
  test('acumula referencias y las conserva al cambiar de página', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await page.locator('[data-quote-add]').nth(3).click();
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator('[data-quote-count]').first().textContent(),
      '2'
    );
    await page.goto(base + '/nosotros/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('[data-quote-count]').first().textContent(),
      '2',
      'el carrito debe sobrevivir a la navegación'
    );
    await page.close();
  });

  test('no duplica una referencia añadida dos veces', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await page.locator('[data-quote-add]').first().click();
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator('[data-quote-count]').first().textContent(),
      '1'
    );
    await page.close();
  });

  test('arma el mensaje de WhatsApp con cantidades y datos', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(400);
    await page.locator('[data-quote-qty]').first().fill('2500');
    await page.fill('[data-quote-field="company"]', 'Transportes SAS');
    await page.fill('[data-quote-field="nit"]', '900.000.000-0');
    await page.fill('[data-quote-field="name"]', 'Richard');
    await page.fill('[data-quote-field="phone"]', '300 000 0000');
    await page.fill('[data-quote-field="city"]', 'Bogotá');
    await page.fill('[data-quote-field="email"]', 'richard@transportes.co');
    await page.waitForTimeout(150);

    const url = await page.evaluate(() => {
      let captured = null;
      const orig = window.open;
      window.open = u => {
        captured = u;
        return null;
      };
      document.querySelector('[data-quote-send]').click();
      window.open = orig;
      return captured;
    });
    assert.match(url, /^https:\/\/wa\.me\/573209514930\?text=/);
    const mensaje = decodeURIComponent(url.split('?text=')[1]);
    assert.match(mensaje, /2\.500 und\./, 'la cantidad debe ir formateada');
    // Los seis datos del cotizador del hub, en su mismo orden.
    assert.match(
      mensaje,
      /Empresa: Transportes SAS\nNIT o C\.C\.: 900\.000\.000-0\nNombre: Richard\nTeléfono: 300 000 0000\nCiudad: Bogotá\nCorreo: richard@transportes\.co/
    );
    await page.close();
  });

  test('omite del mensaje los datos que se dejan en blanco', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(400);
    await page.fill('[data-quote-field="city"]', 'Medellín');
    await page.waitForTimeout(150);

    const url = await page.evaluate(() => {
      let captured = null;
      const orig = window.open;
      window.open = u => {
        captured = u;
        return null;
      };
      document.querySelector('[data-quote-send]').click();
      window.open = orig;
      return captured;
    });
    const mensaje = decodeURIComponent(url.split('?text=')[1]);
    assert.match(mensaje, /Ciudad: Medellín/);
    assert.doesNotMatch(mensaje, /Empresa:/);
    assert.doesNotMatch(mensaje, /Correo:/);
    await page.close();
  });

  test('permite quitar una referencia', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(400);
    await page.locator('[data-quote-remove]').first().click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('[data-quote-empty]').isVisible());
    await page.close();
  });

  test('el foco se queda dentro del panel mientras está abierto', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(400);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const dentro = await page.evaluate(
        () => !!document.activeElement.closest('[data-quote-panel]')
      );
      assert.ok(dentro, `el foco se escapó del panel en el tabulador ${i + 1}`);
    }
    await page.close();
  });

  test('se cierra con Escape', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });
    await page.locator('[data-quote-add]').first().click();
    await abrirCotizacion(page);
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    assert.equal(
      await page.getAttribute('[data-quote-panel]', 'data-open'),
      'false'
    );
    await page.close();
  });
});

describe('formulario de contacto', { skip: skip() }, () => {
  test('no envía sin la autorización de datos', async () => {
    const page = await browser.newPage();
    await page.goto(base + '/contacto/', { waitUntil: 'networkidle' });
    await page.fill('#hs-name-contacts', 'Richard');
    await page.fill('#hs-email-contacts', 'r@e.com');
    await page.fill('#hs-about-contacts', 'Consulta');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('[data-form-status]').first().isVisible(),
      false
    );
    await page.close();
  });

  test('envía los campos y la constancia de autorización', async () => {
    const page = await browser.newPage();
    let cuerpo = null;
    await page.route('**/api/contacto', route => {
      if (route.request().method() === 'POST') {
        cuerpo = route.request().postData();
        return route.fulfill({ status: 200, body: '{"enviado":true}' });
      }
      return route.continue();
    });
    await page.goto(base + '/contacto/', { waitUntil: 'networkidle' });
    await page.fill('#hs-name-contacts', 'Richard');
    await page.fill('#hs-email-contacts', 'r@e.com');
    await page.fill('#hs-phone-number', '3001234567');
    await page.selectOption('#hs-subject-contacts', 'cotizacion');
    await page.fill('#hs-about-contacts', 'Necesito precintos');
    await page.check('input[name="autorizacion"]');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await page.waitForTimeout(600);

    const datos = JSON.parse(cuerpo ?? '{}');
    assert.equal(datos.name, 'Richard');
    assert.equal(datos.email, 'r@e.com');
    assert.equal(datos.subject, 'cotizacion');
    assert.equal(datos.message, 'Necesito precintos');
    assert.equal(datos.autorizacion, 'Sí');
    await page.close();
  });

  test('si el envío falla, ofrece WhatsApp en lugar de fallar en silencio', async () => {
    const page = await browser.newPage();
    await page.route('**/api/contacto', route =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, body: 'err' })
        : route.continue()
    );
    await page.goto(base + '/contacto/', { waitUntil: 'networkidle' });
    await page.fill('#hs-name-contacts', 'Richard');
    await page.fill('#hs-email-contacts', 'r@e.com');
    await page.selectOption('#hs-subject-contacts', 'cotizacion');
    await page.fill('#hs-about-contacts', 'Consulta');
    await page.check('input[name="autorizacion"]');

    const url = await page.evaluate(
      () =>
        new Promise(res => {
          const orig = window.open;
          window.open = u => {
            window.open = orig;
            res(u);
            return null;
          };
          document
            .querySelector('form[data-contact-form] button[type="submit"]')
            .click();
          setTimeout(() => res(null), 3000);
        })
    );
    assert.ok(url, 'debía abrirse WhatsApp como alternativa');
    assert.match(url, /wa\.me\/573209514930/);
    await page.close();
  });
});

describe('navegación móvil', { skip: skip() }, () => {
  test('el menú se despliega al pulsar el botón', async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const menu = page.locator('#navbar-collapse-with-animation');
    assert.equal(await menu.isVisible(), false);
    await page.click('[data-hs-collapse]');
    await page.waitForTimeout(500);
    assert.equal(await menu.isVisible(), true);
    await page.close();
  });

  test('ninguna página desborda horizontalmente', async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    for (const r of ['/', '/catalogo/', '/contacto/', '/faq/', '/nosotros/']) {
      await page.goto(base + r, { waitUntil: 'networkidle' });
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      assert.ok(scroll <= client + 1, `${r} desborda: ${scroll} > ${client}`);
    }
    await page.close();
  });
});

// El bug que motivó este bloque: el contenido vivía dentro de una caja de
// 1536 px, así que en pantallas más anchas la foto del hero se cortaba en seco
// contra ese límite y quedaban franjas de fondo muerto a los lados. A 390 px no
// se notaba, de ahí que el test de desbordamiento de arriba no lo viera.
describe(
  'el contenido va a sangre en pantallas anchas',
  { skip: skip() },
  () => {
    const ANCHO = 1820;
    const RUTAS = ['/', '/nosotros/', '/faq/', '/precintos/'];

    // Ojo: no todas las secciones ocupan el ancho completo, ni deben. Las que
    // no llevan fondo son ellas mismas el contenedor centrado (`mx-auto
    // max-w-[85rem]`), y está bien que se queden en el centro. Lo que sí tiene
    // que ir a sangre es el <main> y cualquier sección con imagen de fondo.
    test('el contenido no está encajonado', async () => {
      const page = await browser.newPage({
        viewport: { width: ANCHO, height: 960 },
      });
      for (const r of RUTAS) {
        await page.goto(base + r, { waitUntil: 'networkidle' });
        const { win, main, conFondo } = await page.evaluate(() => {
          const caja = el => {
            const { left, right } = el.getBoundingClientRect();
            return { left, right };
          };
          return {
            win: window.innerWidth,
            main: caja(document.querySelector('main')),
            conFondo: [...document.querySelectorAll('.backdrop')].map(el =>
              caja(el.closest('section'))
            ),
          };
        });
        assert.ok(
          main.left <= 1 && main.right >= win - 1,
          `${r}: el contenido está encajonado (${main.left}–${main.right} de ${win})`
        );
        for (const [i, s] of conFondo.entries()) {
          assert.ok(
            s.left <= 1 && s.right >= win - 1,
            `${r}: la sección con fondo ${i} no llega a los bordes (${s.left}–${s.right} de ${win})`
          );
        }
      }
      await page.close();
    });

    test('los fondos de sección llegan hasta el borde derecho', async () => {
      const page = await browser.newPage({
        viewport: { width: ANCHO, height: 960 },
      });
      let medidos = 0;
      for (const r of RUTAS) {
        await page.goto(base + r, { waitUntil: 'networkidle' });
        const fondos = await page.evaluate(() =>
          [...document.querySelectorAll('.backdrop')]
            .filter(el => getComputedStyle(el).display !== 'none')
            .map(el => ({
              right: el.getBoundingClientRect().right,
              win: window.innerWidth,
            }))
        );
        for (const f of fondos) {
          assert.ok(
            f.right >= f.win - 1,
            `${r}: un fondo termina en ${f.right} y la ventana mide ${f.win}`
          );
        }
        medidos += fondos.length;
      }
      // Si el marcado del fondo cambia, el bucle pasaría en vacío sin avisar.
      assert.ok(
        medidos > 0,
        'no se encontró ningún fondo de sección que medir'
      );
      await page.close();
    });

    test('ninguna página desborda horizontalmente', async () => {
      const page = await browser.newPage({
        viewport: { width: ANCHO, height: 960 },
      });
      for (const r of RUTAS) {
        await page.goto(base + r, { waitUntil: 'networkidle' });
        const { scroll, client } = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        assert.ok(scroll <= client + 1, `${r} desborda: ${scroll} > ${client}`);
      }
      await page.close();
    });

    test('la barra de navegación sí queda separada de los bordes', async () => {
      const page = await browser.newPage({
        viewport: { width: ANCHO, height: 960 },
      });
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      const { left, right, win } = await page.evaluate(() => {
        const { left, right } = document
          .querySelector('header')
          .getBoundingClientRect();
        return { left, right, win: window.innerWidth };
      });
      assert.ok(
        left > 0 && right < win,
        `la píldora del menú toca los bordes (${left}–${right} de ${win})`
      );
      await page.close();
    });

    // La barra se acerca al borde al bajar (ver Navbar.astro), así que su
    // distancia al tope no es la misma antes y después: lo que se comprueba
    // aquí es que sigue pegada a la ventana —que no se va con el scroll— y que
    // el acercamiento es un ajuste corto, no un salto.
    test('el menú sigue fijo al hacer scroll', async () => {
      const page = await browser.newPage({
        viewport: { width: ANCHO, height: 960 },
      });
      await page.goto(base + '/nosotros/', { waitUntil: 'networkidle' });
      const arriba = await page.evaluate(
        () => document.querySelector('header').getBoundingClientRect().top
      );
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(600);
      const despues = await page.evaluate(
        () => document.querySelector('header').getBoundingClientRect().top
      );
      assert.ok(
        despues >= 0 && despues <= arriba,
        `el menú dejó de quedarse fijo al sacarlo de su contenedor (${arriba} → ${despues})`
      );
      assert.ok(
        arriba - despues <= 12,
        `el menú se movió demasiado al encoger (${arriba} → ${despues})`
      );
      await page.close();
    });
  }
);

describe('accesibilidad (axe)', { skip: skip() }, () => {
  const RUTAS = [
    '/',
    '/catalogo/',
    '/precintos/',
    '/productos/etiquetas-y-cintas-de-seguridad/',
    '/usos/',
    '/faq/',
    '/nosotros/',
    '/contacto/',
    '/terminos-y-condiciones/',
    '/politica-de-privacidad/',
    '/politica-de-datos/',
    '/404.html',
  ];

  for (const ruta of RUTAS) {
    test(`sin violaciones serias ni críticas en ${ruta}`, async () => {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      await page.goto(base + ruta, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: axeSource });
      const { violations } = await page.evaluate(
        async () =>
          await axe.run(document, {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
            },
          })
      );
      const graves = violations.filter(v =>
        ['critical', 'serious'].includes(v.impact)
      );
      const detalle = graves
        .map(v => `${v.id}: ${v.nodes[0]?.html?.slice(0, 120)}`)
        .join('\n');
      assert.deepEqual(
        graves.map(v => v.id),
        [],
        `\n${detalle}`
      );
      await page.close();
    });
  }
});

describe('la barra de navegación se encoge al bajar', { skip: skip() }, () => {
  test('encoge, se pega al borde y vuelve al subir', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });

    const caja = () => page.locator('[data-navbar] nav').boundingBox();
    const reposo = await caja();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(600);
    const encogida = await caja();

    assert.ok(
      encogida.height < reposo.height - 5,
      `la barra no encogió (${reposo.height} → ${encogida.height})`
    );
    assert.ok(
      encogida.y < reposo.y,
      'la barra debe acercarse al borde superior'
    );

    // Y sigue siendo utilizable: los enlaces no se recortan ni se salen.
    assert.ok(
      await page.locator('[data-navbar] a[href="/contacto"]').isVisible()
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const vuelta = await caja();
    assert.ok(
      Math.abs(vuelta.height - reposo.height) < 2,
      'al volver al tope la barra debe recuperar su tamaño'
    );
    await page.close();
  });

  test('no encoge en una página sin recorrido para hacerlo', async () => {
    // Con la ventana muy alta, /contacto no da scroll suficiente: encoger ahí
    // sería un cambio de tamaño gratuito.
    const page = await browser.newPage({
      viewport: { width: 1280, height: 2400 },
    });
    await page.goto(base + '/contacto/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(400);
    const clase = await page.locator('[data-navbar]').getAttribute('class');
    assert.ok(!clase.includes('is-scrolled'));
    await page.close();
  });
});

describe('asistente del sitio', { skip: skip() }, () => {
  test('se abre, sugiere preguntas y deriva a una persona sin backend', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });

    const panel = page.locator('[data-chat-panel]');
    assert.equal(await panel.isVisible(), false);

    await page.click('[data-chat-toggle]');
    assert.equal(await panel.isVisible(), true);
    assert.ok(
      (await page.locator('[data-chat-suggestion]').count()) >= 4,
      'las sugerencias iniciales encauzan la conversación'
    );

    // El servidor de estos tests responde 200 a cualquier POST, así que
    // /api/chat devuelve algo que no es JSON: el widget tiene que caer en el
    // modo atajo en vez de quedarse colgado.
    await page.locator('[data-chat-suggestion]').first().click();
    await page.waitForSelector('.chat-action', { timeout: 5000 });
    const atajos = await page.locator('.chat-action').allTextContents();
    assert.ok(
      atajos.some(t => /WhatsApp/i.test(t)),
      `esperaba un atajo a WhatsApp, salió: ${atajos.join(' | ')}`
    );

    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
    await page.close();
  });

  test('la burbuja ocupa el rincón, ahora sin competencia', async () => {
    // El botón de WhatsApp se retiró de esa esquina y el del cotizador subió a
    // la barra, así que la burbuja tiene que quedarse sola abajo a la derecha.
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    const chat = await page.locator('[data-chat-toggle]').boundingBox();
    const { ancho, alto } = await page.evaluate(() => ({
      ancho: window.innerWidth,
      alto: window.innerHeight,
    }));
    assert.ok(
      chat.x + chat.width > ancho * 0.6 && chat.y > alto * 0.6,
      `la burbuja no está abajo a la derecha (${chat.x}, ${chat.y})`
    );

    assert.equal(
      await page.locator('a[aria-label="Escribir por WhatsApp"]').count(),
      0,
      'volvió el botón flotante de WhatsApp a la esquina de la burbuja'
    );

    // Y WhatsApp sigue a un clic: el atajo está en el saludo del asistente.
    await page.click('[data-chat-toggle]');
    const atajo = page.locator('[data-chat-panel] a[href*="wa.me"]').first();
    assert.ok(await atajo.isVisible(), 'no hay atajo a WhatsApp en el saludo');
    await page.close();
  });
});

describe('hero de la portada', { skip: skip() }, () => {
  test('ocupa la pantalla completa, sin franjas arriba ni abajo', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });

    const medidas = await page.evaluate(() => {
      const hero = document.querySelector('main section');
      const r = hero.getBoundingClientRect();
      return { top: r.top, alto: r.height, ventana: window.innerHeight };
    });

    assert.equal(
      Math.round(medidas.top),
      0,
      'quedó una franja del fondo de la página por encima del hero'
    );
    assert.ok(
      medidas.alto >= medidas.ventana - 1,
      `el hero no llena la pantalla (${medidas.alto} de ${medidas.ventana})`
    );
    await page.close();
  });

  test('la barra flota por encima de la foto, no sobre un hueco', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const solapa = await page.evaluate(() => {
      const nav = document
        .querySelector('[data-navbar] nav')
        .getBoundingClientRect();
      const hero = document
        .querySelector('main section')
        .getBoundingClientRect();
      return nav.top >= hero.top && nav.bottom <= hero.bottom;
    });
    assert.ok(solapa, 'la barra dejó de ir por encima del hero');
    await page.close();
  });

  test('la señal de continuar deja el destino a la vista, no bajo la barra', async () => {
    // Es el único salto a un ancla del sitio, y el que justifica el colchón
    // `scroll-pt` del layout.
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.click('a[href="#soluciones"]');
    await page.waitForTimeout(700);

    const { navBottom, destinoTop } = await page.evaluate(() => {
      const nav = document
        .querySelector('[data-navbar] nav')
        .getBoundingClientRect();
      const destino = document
        .querySelector('#soluciones')
        .getBoundingClientRect();
      return { navBottom: nav.bottom, destinoTop: destino.top };
    });
    assert.ok(
      destinoTop >= navBottom,
      `la sección aterrizó debajo de la barra (${destinoTop} < ${navBottom})`
    );
    await page.close();
  });
});

describe('cotizador en la barra', { skip: skip() }, () => {
  test('aparece al acumular y abre el panel flotante', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/catalogo/', { waitUntil: 'networkidle' });

    const boton = page.locator('[data-quote-toggle]:visible');
    assert.equal(
      await boton.count(),
      0,
      'con la cotización vacía el botón no lleva a ninguna parte'
    );

    await page.locator('[data-quote-add]').first().click();
    await page.waitForTimeout(200);
    assert.equal(await boton.count(), 1);

    // Está en la barra, arriba a la derecha.
    const caja = await boton.boundingBox();
    const nav = await page.locator('[data-navbar] nav').boundingBox();
    assert.ok(
      caja.y >= nav.y && caja.y + caja.height <= nav.y + nav.height + 1,
      'el botón del cotizador no está dentro de la barra'
    );
    assert.ok(
      caja.x > 1280 * 0.6,
      'el botón del cotizador no está a la derecha'
    );

    await abrirCotizacion(page);
    await page.waitForTimeout(500);

    // El panel flota: separado de los bordes por los cuatro costados.
    const panel = await page.locator('[data-quote-drawer]').boundingBox();
    assert.ok(panel.x > 0, 'el panel toca el borde izquierdo');
    assert.ok(panel.y > 0, 'el panel toca el borde superior');
    assert.ok(panel.x + panel.width < 1280, 'el panel toca el borde derecho');
    assert.ok(panel.y + panel.height < 800, 'el panel toca el borde inferior');
    await page.close();
  });
});

/**
 * EL VIDRIO DE LA BARRA ES INAMOVIBLE.
 *
 * Este bloque existe porque el glassmorphism de la barra se ha roto dos veces,
 * de dos maneras distintas, y ninguna se veía en el código:
 *
 * 1. Subiendo el velo al desplazarse «para ganar contraste», hasta dejarla
 *    opaca del todo. La barra pasaba a ser una banda maciza en cuanto se
 *    bajaba un dedo de rueda.
 * 2. Escribiendo `backdrop-filter` a mano junto con su pareja `-webkit-`.
 *    lightningcss prefija él según los navegadores de destino, y ante las dos
 *    declaraciones se quedó con la prefijada y tiró la estándar: en el
 *    navegador el desenfoque calculaba `none` y la barra salía transparente y
 *    PLANA. El marcado y el CSS fuente se veían perfectos.
 *
 * De ahí que esto mida el estilo CALCULADO sobre la página YA CONSTRUIDA, y no
 * las clases del componente: es el único sitio donde los dos fallos se ven.
 *
 * Los valores son los de siempre —`bg-brand-50/60` y `backdrop-blur-md`, con
 * `dark:bg-neutral-800/80`— y no son negociables al vuelo: si alguna vez hay
 * que cambiarlos, se cambian aquí a la vez, con la decisión tomada a
 * propósito y no como efecto colateral de otra cosa.
 */
describe('el vidrio de la barra de navegación', { skip: skip() }, () => {
  const VELO_CLARO = 0.6;
  const VELO_OSCURO = 0.8;
  const DESENFOQUE_PX = 12;

  /**
   * Lee el velo y el desenfoque tal y como los resuelve el navegador.
   *
   * La opacidad se saca de la cadena calculada porque Chrome devuelve el color
   * en el espacio en el que se declaró —`oklab(... / 0.6)`, no `rgba()`—, así
   * que no vale con partir por comas.
   */
  const leerVidrio = (page, selector) =>
    page.evaluate(sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const estilo = getComputedStyle(el);
      const fondo = estilo.backgroundColor;
      const alfa = fondo.match(/\/\s*([\d.]+)\s*\)/);
      return {
        fondo,
        // Sin barra de alfa en la cadena, el color es opaco.
        opacidad: alfa ? Number(alfa[1]) : 1,
        desenfoque: estilo.backdropFilter,
      };
    }, selector);

  test('la píldora es translúcida y lleva desenfoque', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const vidrio = await leerVidrio(page, '.navbar-pill');
    assert.equal(
      vidrio.opacidad,
      VELO_CLARO,
      `el velo de la barra debe ser ${VELO_CLARO} (leído: ${vidrio.fondo})`
    );
    assert.ok(
      vidrio.desenfoque.includes(`blur(${DESENFOQUE_PX}px)`),
      `falta el desenfoque del vidrio (leído: "${vidrio.desenfoque}")`
    );
    await page.close();
  });

  test('sigue igual de translúcida al desplazarse', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });

    const reposo = await leerVidrio(page, '.navbar-pill');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(700);
    const bajando = await leerVidrio(page, '.navbar-pill');

    assert.equal(
      bajando.opacidad,
      reposo.opacidad,
      'el velo NO puede cambiar al desplazarse: es lo que la convierte en una banda maciza'
    );
    assert.ok(
      bajando.desenfoque.includes(`blur(${DESENFOQUE_PX}px)`),
      `el desenfoque se pierde al desplazarse (leído: "${bajando.desenfoque}")`
    );
    await page.close();
  });

  test('el interruptor de tema lleva el mismo vidrio', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const vidrio = await leerVidrio(page, '.navbar-theme');
    assert.equal(vidrio.opacidad, VELO_CLARO);
    assert.ok(vidrio.desenfoque.includes(`blur(${DESENFOQUE_PX}px)`));
    await page.close();
  });

  test('en modo oscuro también', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('hs_theme', 'dark'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const vidrio = await leerVidrio(page, '.navbar-pill');
    assert.equal(
      vidrio.opacidad,
      VELO_OSCURO,
      `el velo en oscuro debe ser ${VELO_OSCURO} (leído: ${vidrio.fondo})`
    );
    assert.ok(vidrio.desenfoque.includes(`blur(${DESENFOQUE_PX}px)`));
    await page.close();
  });

  test('el vidrio se ve igual en todas las páginas', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    for (const ruta of ['/', '/catalogo/', '/faq/', '/contacto/']) {
      await page.goto(base + ruta, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const vidrio = await leerVidrio(page, '.navbar-pill');
      assert.equal(vidrio.opacidad, VELO_CLARO, `velo distinto en ${ruta}`);
      assert.ok(
        vidrio.desenfoque.includes(`blur(${DESENFOQUE_PX}px)`),
        `falta el desenfoque en ${ruta}`
      );
    }
    await page.close();
  });
});

/**
 * El asistente tiene que MOVERSE cada pocos segundos. Se pide expresamente que
 * llame la atención, y una animación tan sutil que no se nota es lo mismo que
 * no tenerla: la primera versión giraba solo el icono de 20 px cada 18
 * segundos y en la práctica era invisible.
 *
 * Se mide el recorrido real del botón en pantalla, no la propiedad CSS: una
 * animación declarada cuyos fotogramas no mueven nada pasaría igual.
 */
describe('la burbuja del asistente llama la atención', { skip: skip() }, () => {
  test('se sacude sola a los pocos segundos', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });

    const alturas = [];
    const inicio = Date.now();
    // El gesto entra a los 5 s y dura poco más de uno; se muestrea hasta los 7.
    while (Date.now() - inicio < 7000) {
      alturas.push(
        await page.evaluate(
          () =>
            document.querySelector('.chat-launcher').getBoundingClientRect().y
        )
      );
      await page.waitForTimeout(100);
    }

    const recorrido = Math.max(...alturas) - Math.min(...alturas);
    assert.ok(
      recorrido > 3,
      `la burbuja apenas se movió (${recorrido.toFixed(1)} px de recorrido)`
    );
    await page.close();
  });

  test('se queda quieta con el asistente abierto', async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.click('[data-chat-toggle]');
    await page.waitForTimeout(300);

    const animacion = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.chat-llamada')).animationName
    );
    assert.equal(
      animacion,
      'none',
      'con el panel abierto ya no hay que insistir'
    );
    await page.close();
  });
});
