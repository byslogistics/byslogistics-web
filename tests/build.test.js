/**
 * Comprobaciones sobre el HTML ya construido (carpeta dist).
 *
 * Requiere haber ejecutado `pnpm build` antes. Cubre lo que solo se puede
 * verificar en la salida final: rutas generadas, metadatos, enlaces internos
 * que no llevan a un 404 y el marcado que Netlify necesita ver.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');

before(() => {
  assert.ok(
    existsSync(DIST),
    'no existe dist/: ejecuta `pnpm build` antes de estos tests'
  );
});

/** Todas las páginas HTML generadas, con su ruta pública. */
function pages() {
  const out = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '_astro' && entry.name !== 'pagefind') walk(full);
      } else if (entry.name.endsWith('.html')) {
        const route =
          '/' +
          relative(DIST, full)
            .replace(/index\.html$/, '')
            .replace(/\\/g, '/');
        out.push({ route, file: full, html: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(DIST);
  return out;
}

/**
 * La lista de sinónimos del buscador, leída del fuente.
 *
 * Se lee en vez de importarse porque el archivo usa los alias de Astro
 * (@data/…), que node por su cuenta no resuelve. Mismo criterio que en
 * content.test.js.
 */
function sinonimos() {
  const fuente = readFileSync(
    join(ROOT, 'src/data_files/sinonimos.ts'),
    'utf8'
  );
  return [
    ...fuente.matchAll(/busca:\s*'([^']+)',\s*escribe:\s*\[([\s\S]*?)\]/g),
  ].map(m => ({
    busca: m[1],
    escribe: [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]),
  }));
}

const RUTAS_ESPERADAS = [
  '/',
  '/catalogo/',
  '/precintos/',
  '/precintos/precintos-de-botella/',
  '/precintos/precintos-de-guaya/',
  // Fichas de referencia: una de precintos y una de otra familia, que es lo
  // que exige que la plantilla no quedara atada a los atributos de un precinto.
  '/precintos/precintos-de-correa-dentada/precinto-correa-doble-dentado-38-cm/',
  '/productos/tulas-y-bolsas-de-seguridad/tula-de-seguridad-30-x-40-cm/',
  '/productos/',
  '/productos/precintos-de-seguridad/',
  '/productos/etiquetas-y-cintas-de-seguridad/',
  '/productos/embalaje-protector/',
  '/productos/rastreo-satelital/',
  '/usos/',
  '/usos/precintos-para-contenedores/',
  '/usos/precintos-para-carrotanques/',
  '/usos/tulas-para-transporte-de-valores/',
  '/usos/etiquetas-void-sellos-de-garantia/',
  '/usos/como-elegir-un-precinto-de-seguridad/',
  '/usos/numeracion-y-trazabilidad/',
  '/usos/precintos-para-canastillas-y-estibas/',
  '/usos/precintos-para-medidores-y-activos/',
  '/usos/embalaje-y-proteccion-de-carga/',
  '/faq/',
  '/nosotros/',
  '/contacto/',
  '/terminos-y-condiciones/',
  '/politica-de-privacidad/',
  '/politica-de-datos/',
];

describe('rutas generadas', () => {
  test('todas las páginas esperadas existen', () => {
    const rutas = new Set(pages().map(p => p.route));
    for (const r of RUTAS_ESPERADAS) {
      assert.ok(rutas.has(r), `falta la página ${r}`);
    }
  });

  test('existe la página 404', () => {
    assert.ok(existsSync(join(DIST, '404.html')));
  });

  test('el sitemap incluye todas las páginas esperadas', () => {
    const xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const r of RUTAS_ESPERADAS) {
      assert.ok(
        xml.includes(`https://byslogistics.com.co${r}`),
        `el sitemap no incluye ${r}`
      );
    }
  });

  test('robots.txt apunta al sitemap del dominio propio', () => {
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    assert.match(robots, /byslogistics\.com\.co\/sitemap-index\.xml/);
  });

  test('el manifest lleva el nombre de la empresa', () => {
    const manifest = JSON.parse(
      readFileSync(join(DIST, 'manifest.json'), 'utf8')
    );
    assert.equal(manifest.name, 'B&S Logistics');
    assert.ok(manifest.icons.length > 0);
  });

  test('el favicon no está vacío', () => {
    assert.ok(statSync(join(DIST, 'favicon.ico')).size > 500);
  });
});

/*
 * POR QUÉ ESTE BLOQUE.
 *
 * El logo no salía en los resultados de Google, y eran dos cosas a la vez:
 *
 *   1. El favicon se publicaba en `/_astro/icon.<hash>.png`. Ese hash cambia
 *      con cada compilación del archivo, y Google pide que la dirección del
 *      icono se mantenga constante: con una que se mueve, ningún rastreo llega
 *      a asociarlo al sitio.
 *   2. No había datos estructurados de `Organization`, que es de donde el
 *      buscador saca el logotipo de una empresa. Los de `WebPage` describen la
 *      página, no la marca.
 *
 * Las dos se arreglan solas y se rompen solas: basta con que alguien vuelva a
 * poner un `getImage` en Meta.astro, o borre el bloque de la organización.
 */
describe('el logo y el icono, para los buscadores', () => {
  const RUTAS_FIJAS = ['/icono.png', '/apple-touch-icon.png', '/logo.png'];

  test('los iconos se publican en direcciones que no cambian', () => {
    for (const ruta of RUTAS_FIJAS) {
      assert.ok(
        statSync(join(DIST, ruta.slice(1))).size > 1000,
        `${ruta} no se generó, o salió vacío`
      );
    }
  });

  test('ninguna página declara un icono con hash en la URL', () => {
    for (const p of pages()) {
      const iconos = [
        ...p.html.matchAll(/<link[^>]+rel="[^"]*icon[^"]*"[^>]*>/g),
      ]
        .map(m => m[0])
        .filter(etiqueta => /_astro/.test(etiqueta));
      assert.deepEqual(
        iconos,
        [],
        `${p.route} apunta el icono a /_astro/, cuya URL cambia en cada despliegue`
      );
    }
  });

  test('el icono declarado es el de la ruta fija', () => {
    const html = pages().find(p => p.route === '/').html;
    assert.match(html, /href="\/icono\.png"/);
    assert.match(html, /href="\/apple-touch-icon\.png"/);
    assert.match(html, /href="\/favicon\.ico"/);
  });

  test('todas las páginas publican la organización con su logotipo', () => {
    for (const p of pages()) {
      const bloques = [
        ...p.html.matchAll(
          /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
        ),
      ].map(m => JSON.parse(m[1]));

      const organizacion = bloques.find(b => b['@type'] === 'Organization');
      assert.ok(organizacion, `${p.route} no declara la organización`);
      assert.equal(
        organizacion.logo.url,
        'https://byslogistics.com.co/logo.png',
        `${p.route} apunta el logotipo a otro sitio`
      );
      assert.equal(organizacion.name, 'B&S Logistics');
    }
  });

  test('el color de la barra del navegador es el de la marca', () => {
    // Era `#facc15`, el amarillo de la plantilla original.
    for (const p of pages()) {
      assert.match(
        p.html,
        /<meta name="theme-color" content="#0060a8">/,
        `${p.route} conserva el color de la plantilla`
      );
    }
  });
});

describe('ficha de producto', () => {
  const fichas = () =>
    pages().filter(p =>
      /^\/(precintos|productos)\/[^/]+\/[^/]+\/$/.test(p.route)
    );

  const unaFicha = ruta => {
    const p = pages().find(x => x.route === ruta);
    assert.ok(p, `no se generó ${ruta}`);
    return p.html;
  };

  test('cada referencia del catálogo tiene su propia página', () => {
    // 49 referencias de precintos y 66 del resto de familias.
    assert.ok(
      fichas().length > 100,
      `solo se generaron ${fichas().length} fichas`
    );
  });

  test('la tarjeta de la categoría lleva a la ficha', () => {
    const categoria = unaFicha('/precintos/precintos-de-correa-dentada/');
    assert.match(
      categoria,
      /href="\/precintos\/precintos-de-correa-dentada\/precinto-correa-doble-dentado-38-cm"/,
      'la tarjeta de la categoría sigue sin enlazar a la referencia'
    );
  });

  test('el listado de una familia lleva a la ficha', () => {
    const familia = unaFicha('/productos/tulas-y-bolsas-de-seguridad/');
    assert.match(
      familia,
      /href="\/productos\/tulas-y-bolsas-de-seguridad\/[a-z0-9-]+"/,
      'el listado de la familia sigue sin enlazar a sus referencias'
    );
  });

  test('el botón de WhatsApp lleva el nombre de la referencia', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-correa-doble-dentado-38-cm/'
    );
    assert.match(
      html,
      /wa\.me\/\d+\?text=[^"]*Precinto%20Correa%20Doble%20Dentado/
    );
  });

  test('la ficha ofrece el cotizador del sitio, no un formulario nuevo', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-correa-doble-dentado-38-cm/'
    );
    assert.match(html, /data-quote-add="/);
  });

  /*
   * La regla que sostiene un catálogo que se llena de a poco: un bloque sin
   * datos no se pinta. Un encabezado "Colores disponibles" sin colores debajo
   * es peor que no tener la sección.
   */
  test('los bloques sin datos no se pintan', () => {
    // Los pines de seguridad son de las pocas referencias que el catálogo
    // comercial todavía no describe: ni colores, ni mínimo, ni usos. Sirven
    // justo para eso —comprobar que una ficha a medias no enseña encabezados
    // vacíos—, y hay que cambiarla el día que se llenen.
    const html = unaFicha(
      '/precintos/precintos-metalicos-y-accesorios/pines-de-seguridad/'
    );
    for (const bloque of [
      'Colores disponibles',
      'Cantidad mínima de pedido',
      'Ficha técnica',
      'Principales usos',
    ]) {
      assert.ok(
        !html.includes(bloque),
        `se pintó "${bloque}" sin tener ese dato`
      );
    }
  });

  /*
   * Lo que hace que 115 fichas se vean completas sin escribir 115 veces lo
   * mismo: la categoría declara una vez lo que comparten sus referencias.
   */
  test('la plantilla de la categoría llega a todas sus referencias', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-correa-doble-dentado-38-cm/'
    );
    for (const bloque of [
      'Colores disponibles',
      'Personalización',
      'Cantidad mínima de pedido',
      'Principales usos',
      'Sectores que lo utilizan',
      'Presentación',
      'Medidas',
    ]) {
      assert.ok(html.includes(bloque), `la referencia no heredó "${bloque}"`);
    }
    // Y lo que es suyo lo conserva: la longitud, que la dice su nombre.
    assert.ok(html.includes('38 cm'), 'perdió su propia longitud');
  });

  /*
   * La otra mitad de la herencia: un atributo que la categoría declara y la
   * referencia todavía no sabe. La fila tiene que seguir viéndose, invitando a
   * preguntarlo, y no desaparecer — si desapareciera, dos referencias de la
   * misma categoría tendrían fichas de distinto tamaño y parecería que a una
   * le falta media descripción.
   *
   * La referencia es de otra categoría a propósito: las de correa dentada ya
   * tienen todos sus atributos, así que ahí no queda nada pendiente que mirar.
   */
  test('un atributo sin valor invita a consultarlo, no desaparece', () => {
    const html = unaFicha(
      '/precintos/precintos-planos/precinto-plano-bc-42-cms/'
    );
    assert.ok(
      html.includes('Consúltenos'),
      'un atributo sin valor debe invitar a consultarlo, no desaparecer'
    );
  });

  test('la referencia de ejemplo no deja ningún atributo pendiente', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-correa-dentada-doble-cierre-35-cm/'
    );
    assert.ok(
      !html.includes('Consúltenos'),
      'la ficha de ejemplo tiene que estar completa'
    );
    for (const dato of ['8 mm', '4,3 x 2,8 cm', 'Más vendido']) {
      assert.ok(html.includes(dato), `falta ${dato}`);
    }
  });

  test('ninguna ficha promete una descarga que no existe', () => {
    for (const p of fichas()) {
      const pdf = p.html.match(/href="([^"]+\.pdf)"/)?.[1];
      if (!pdf) continue;
      assert.ok(
        existsSync(join(DIST, pdf.replace(/^\//, ''))),
        `${p.route} enlaza ${pdf}, que no está en dist/`
      );
    }
  });

  test('la ficha se declara como Product, y sin precio', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-correa-doble-dentado-38-cm/'
    );
    assert.match(html, /"@type":"Product"/);
    // El sitio no publica precios: declarar una oferta sin importe sería
    // prometerle al buscador un dato que la página no tiene.
    assert.ok(!html.includes('"offers"'));
  });
});

describe('metadatos de cada página', () => {
  test('el documento está en español', () => {
    for (const p of pages()) {
      assert.match(p.html, /<html lang="es"/, `${p.route} no declara lang=es`);
    }
  });

  test('cada página tiene título y descripción propios', () => {
    for (const p of pages()) {
      const title = p.html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      assert.ok(title.length > 5, `${p.route} sin <title>`);
      const desc = p.html.match(
        /<meta content="([^"]*)" name="description"/
      )?.[1];
      assert.ok(desc && desc.length > 20, `${p.route} sin descripción`);
    }
  });

  test('cada página declara una URL canónica', () => {
    for (const p of pages()) {
      assert.match(p.html, /rel="canonical"/, `${p.route} sin canonical`);
    }
  });

  test('cada página tiene exactamente un h1', () => {
    // El h1 le dice a buscadores y lectores de pantalla de qué trata la página.
    for (const p of pages()) {
      const count = (p.html.match(/<h1[\s>]/g) ?? []).length;
      assert.equal(count, 1, `${p.route} tiene ${count} h1 (debe tener 1)`);
    }
  });

  /*
   * Las metadescripciones de las fichas se calculan en getReferencias (ver
   * `ponerMetaDescripciones` en utils/catalog.ts), no en la plantilla. Estos
   * dos tests son la razón: la plantilla las sacaba tal cual del catálogo
   * comercial y quedaban ciento diez fichas con párrafos de trescientos
   * caracteres, y treinta y una repitiendo la misma —las dieciséis medidas de
   * la etiqueta holograma comparten descripción, y las diez del precinto
   * OPENED también—.
   */
  test('la metadescripción de cada ficha cabe en un resultado de búsqueda', () => {
    const fichas = pages().filter(p =>
      /^\/(precintos|productos)\/[^/]+\/[^/]+\/$/.test(p.route)
    );
    assert.ok(fichas.length > 100, `solo ${fichas.length} fichas`);

    for (const p of fichas) {
      const desc = p.html.match(
        /<meta content="([^"]*)" name="description"/
      )?.[1];
      assert.ok(
        desc.length >= 50 && desc.length <= 160,
        `${p.route}: metadescripción de ${desc.length} caracteres`
      );
      assert.doesNotMatch(
        desc,
        /(^|\s)(de|del|para|con|en|por|la|el|los|las|y|o|que|su|sus|como)\s*…$/i,
        `${p.route}: la metadescripción termina colgando`
      );
    }
  });

  test('no hay dos fichas con la misma metadescripción', () => {
    /*
     * Salvo una: la dueña llamó igual a dos referencias distintas del catálogo
     * —«Cinta de Seguridad VOID 50 m x 5 cm», la de rollo entero y la
     * troquelada— y les puso la misma descripción. Con el mismo nombre y el
     * mismo texto no hay dato con el que distinguirlas, y ponerles uno sería
     * inventarle al catálogo algo que no dice. Se deja constancia aquí para
     * que el día que se renombre una, este test lo note.
     */
    const CONOCIDA = 'Cinta de Seguridad VOID 50 m x 5 cm.';

    const vistas = new Map();
    for (const p of pages().filter(x =>
      /^\/(precintos|productos)\/[^/]+\/[^/]+\/$/.test(x.route)
    )) {
      const desc = p.html.match(
        /<meta content="([^"]*)" name="description"/
      )[1];
      const previa = vistas.get(desc);
      if (previa) {
        assert.ok(
          desc.startsWith(CONOCIDA),
          `${p.route} y ${previa} publican la misma metadescripción`
        );
      } else {
        vistas.set(desc, p.route);
      }
    }
  });

  test('el título de cada pregunta cabe en un resultado de búsqueda', () => {
    // La pregunta entera encabeza la página y se publica como FAQPage; en el
    // <title> va `tituloSeo`, que es su núcleo (ver content.config.ts).
    const preguntas = pages().filter(p =>
      /^\/preguntas\/[^/]+\/[^/]+\/$/.test(p.route)
    );
    assert.ok(preguntas.length > 50, `solo ${preguntas.length} preguntas`);

    for (const p of preguntas) {
      // Se mide el título como lo lee una persona, no como viaja: en el HTML
      // la «&» de la marca va escapada y son cuatro caracteres más.
      const title = p.html
        .match(/<title>([^<]*)<\/title>/)[1]
        .replace(/&amp;/g, '&');
      assert.ok(
        title.length <= 65,
        `${p.route}: título de ${title.length} caracteres — ${title}`
      );
    }
  });

  test('las páginas de producto llevan datos estructurados', () => {
    const p = pages().find(x => x.route === '/productos/cajas-de-seguridad/');
    assert.match(p.html, /application\/ld\+json/);
  });

  test('la página de FAQ publica sus preguntas como datos estructurados', () => {
    const p = pages().find(x => x.route === '/faq/');
    const json = p.html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )[1];
    const data = JSON.parse(json);
    assert.equal(data['@type'], 'FAQPage');
    assert.ok(data.mainEntity.length >= 5);
  });
});

describe('enlaces', () => {
  test('ningún enlace interno lleva a una página inexistente', () => {
    const rutas = new Set(pages().map(p => p.route));
    const rotos = [];
    for (const p of pages()) {
      for (const [, href] of p.html.matchAll(/href="(\/[^"#?]*)"/g)) {
        if (
          /\.(css|js|png|jpg|jpeg|avif|webp|svg|ico|xml|txt|json)$/.test(href)
        )
          continue;
        if (href.startsWith('/_astro')) continue;
        const normalizado = href.endsWith('/') ? href : href + '/';
        if (!rutas.has(normalizado) && !rutas.has(href)) {
          rotos.push(`${p.route} → ${href}`);
        }
      }
    }
    assert.deepEqual(rotos, [], 'hay enlaces internos rotos');
  });

  test('no quedan enlaces de relleno', () => {
    for (const p of pages()) {
      assert.ok(
        !/href="#"/.test(p.html),
        `${p.route} tiene un enlace vacío href="#"`
      );
    }
  });

  test('los enlaces externos que abren pestaña llevan rel de seguridad', () => {
    for (const p of pages()) {
      for (const [tag] of p.html.matchAll(/<a[^>]*target="_blank"[^>]*>/g)) {
        assert.match(tag, /rel="[^"]*noopener/, `${p.route}: ${tag}`);
      }
    }
  });

  // Astro se come el salto de línea que separa una frase del enlace que sigue,
  // y el texto queda pegado: «conforme a laPolítica de Tratamiento…». Se
  // arregla escribiendo {' '} antes del <a>. Este test vigila que no vuelva.
  //
  // Le pasa igual a cualquier etiqueta en línea, no solo al enlace: el
  // primer texto legal que se publicó traía un «realizadas porBYS LOGISTICS
  // S.A.S.» por un <strong> al principio de la línea siguiente. Por eso la
  // lista incluye las demás etiquetas en línea que usa el sitio.
  test('ninguna frase queda pegada a la etiqueta que la sigue', () => {
    const pegados = [];
    for (const p of pages()) {
      for (const [, antes, etiqueta, texto] of p.html.matchAll(
        /([a-záéíóúüñ,;:)])<(a|strong|em|code|abbr)[\s>][^>]*>([^<]{0,40})/gi
      )) {
        pegados.push(`${p.route}: «…${antes}${texto}…» (<${etiqueta}>)`);
      }
    }
    assert.deepEqual(pegados, [], "falta un {' '} antes de la etiqueta");
  });
});

describe('formularios', () => {
  test('el de contacto manda a /api/contacto, no a Netlify Forms', () => {
    const p = pages().find(x => x.route === '/contacto/');
    const form = p.html.match(/<form[^>]*name="contacto"[^>]*>/)[0];
    assert.match(form, /method="POST"/);
    assert.match(form, /data-contact-form/);
    // El nombre del formulario es la ruta a la que lo manda contactForms.js
    // (`/api/${nombre}`): sin marcado de Netlify, no hace falta form-name.
    assert.doesNotMatch(form, /data-netlify/);
    assert.doesNotMatch(p.html, /name="form-name"/);
  });

  test('el de contacto pide empresa y motivo, además de los campos base', () => {
    const p = pages().find(x => x.route === '/contacto/');
    assert.match(p.html, /name="company"/);
    assert.match(p.html, /<select[^>]*name="subject"/);
    // Las opciones del <select> tienen que ser las que acepta contacto.mts
    // (MOTIVOS): un valor que se agregue solo aquí se descartaría en el
    // servidor sin ningún error a la vista.
    for (const valor of ['cotizacion', 'distribucion', 'soporte', 'otro']) {
      assert.match(p.html, new RegExp(`<option value="${valor}"`));
    }
  });

  test('el de suscripción también manda a su endpoint, y está en todas las páginas', () => {
    for (const p of pages()) {
      if (p.route === '/404.html' || p.route.endsWith('404.html')) continue;
      if (!p.html.includes('name="suscripcion"')) continue;
      const form = p.html.match(/<form[^>]*name="suscripcion"[^>]*>/)[0];
      assert.match(form, /data-contact-form/);
      assert.doesNotMatch(form, /data-netlify/);
    }
  });

  test('el formulario exige autorización de tratamiento de datos', () => {
    const p = pages().find(x => x.route === '/contacto/');
    assert.match(
      p.html,
      /name="autorizacion"[^>]*required|required[^>]*name="autorizacion"/,
      'la casilla de autorización debe ser obligatoria'
    );
    assert.match(p.html, /href="\/politica-de-datos"/);
  });

  test('todos los campos visibles tienen etiqueta asociada', () => {
    const p = pages().find(x => x.route === '/contacto/');
    for (const [, id] of p.html.matchAll(
      /<(?:input|select)[^>]*id="(hs-[^"]+)"/g
    )) {
      assert.ok(
        p.html.includes(`for="${id}"`),
        `el campo ${id} no tiene <label for>`
      );
    }
  });
});

/*
 * Las tres páginas legales.
 *
 * Lo que se vigila aquí no es la redacción —eso lo revisa un abogado— sino lo
 * que un despliegue puede romper sin que nadie se dé cuenta: que sigan
 * enlazadas desde el footer, que el índice apunte a secciones que existen y
 * que la política de datos siga diciendo lo que dice el documento firmado.
 */
describe('páginas legales', () => {
  const LEGALES = [
    '/terminos-y-condiciones/',
    '/politica-de-privacidad/',
    '/politica-de-datos/',
  ];

  const legal = ruta => {
    const p = pages().find(x => x.route === ruta);
    assert.ok(p, `no se generó ${ruta}`);
    return p.html;
  };

  test('el footer las enlaza desde todas las páginas', () => {
    // Publicar una política y dejarla sin enlazar es el fallo clásico: la
    // página existe, nadie la encuentra y para efectos prácticos no está
    // publicada.
    for (const p of pages()) {
      // La 404 va sin footer a propósito (`hideFooter`): es una pantalla de
      // rescate, no una página del sitio.
      if (p.route.endsWith('404.html')) continue;
      for (const ruta of LEGALES) {
        const href = ruta.slice(0, -1);
        assert.ok(
          p.html.includes(`href="${href}"`),
          `${p.route} no enlaza ${href}`
        );
      }
    }
  });

  test('cada documento trae índice y fecha de actualización', () => {
    for (const ruta of LEGALES) {
      const html = legal(ruta);
      assert.match(
        html,
        /aria-label="Contenido del documento"/,
        `${ruta} se quedó sin índice`
      );
      assert.match(
        html,
        /<time datetime="\d{4}-\d{2}-\d{2}">/,
        `${ruta} no publica la fecha de actualización`
      );
    }
  });

  test('ningún enlace del índice apunta a una sección que no existe', () => {
    // El índice se genera leyendo los <h2 id> del contenido, así que esto
    // comprueba de paso que la generación no se desvíe.
    const rotos = [];
    for (const ruta of LEGALES) {
      const html = legal(ruta);
      const ids = new Set(
        [...html.matchAll(/<h2[^>]*\sid="([^"]+)"/g)].map(([, id]) => id)
      );
      const indice = html.match(
        /<nav aria-label="Contenido del documento"[\s\S]*?<\/nav>/
      )[0];
      for (const [, destino] of indice.matchAll(/href="#([^"]+)"/g)) {
        if (!ids.has(destino)) rotos.push(`${ruta} → #${destino}`);
      }
      assert.ok(ids.size >= 10, `${ruta} solo tiene ${ids.size} secciones`);
    }
    assert.deepEqual(rotos, [], 'el índice apunta a secciones inexistentes');
  });

  test('los enlaces con ancla entre documentos apuntan a algo real', () => {
    // El test general de enlaces internos descarta los href con «#», así que
    // estos solo los cubre este.
    const rotos = [];
    const htmlPorRuta = new Map(pages().map(p => [p.route, p.html]));
    for (const ruta of LEGALES) {
      for (const [, destino, ancla] of legal(ruta).matchAll(
        /href="(\/[^"#]+)#([^"]+)"/g
      )) {
        const html = htmlPorRuta.get(`${destino}/`) ?? htmlPorRuta.get(destino);
        if (!html) {
          rotos.push(`${ruta} → ${destino} (la página no existe)`);
        } else if (!html.includes(`id="${ancla}"`)) {
          rotos.push(`${ruta} → ${destino}#${ancla} (no existe la sección)`);
        }
      }
    }
    assert.deepEqual(rotos, [], 'hay anclas rotas entre documentos legales');
  });

  test('la política de datos publica los datos del documento firmado', () => {
    // Copiados del numeral 4 de POGE01 v02. Si alguien los cambia en el sitio
    // sin cambiarlos en el documento, el sitio deja de decir la verdad.
    const html = legal('/politica-de-datos/');
    for (const dato of [
      'BYS LOGISTICS S.A.S.',
      '900.437.215-8',
      'gerencia@byslogistics.com.co',
      'Carrera 86B No. 53-22 Sur, Bloque 13, Oficina 152',
      'POGE01',
    ]) {
      assert.ok(html.includes(dato), `la política ya no dice «${dato}»`);
    }
  });

  test('la razón social no deja dos puntos seguidos', () => {
    // «BYS LOGISTICS S.A.S.» ya termina en punto, así que escribir otro
    // detrás produce «S.A.S..». Es el tropiezo típico al interpolar la razón
    // social al final de una frase, y sale en las tres páginas y en el footer.
    const feos = [];
    for (const p of pages()) {
      if (p.html.includes('S.A.S..')) feos.push(p.route);
    }
    assert.deepEqual(feos, [], 'sobra el punto tras «S.A.S.»');
  });

  test('no queda texto de borrador en ninguna de las tres', () => {
    for (const ruta of LEGALES) {
      const html = legal(ruta);
      for (const resto of ['TODO', 'por definir', 'Lorem ipsum', 'XXXX']) {
        assert.ok(
          !html.includes(resto),
          `${ruta} todavía tiene «${resto}» a la vista`
        );
      }
    }
  });
});

describe('medición', () => {
  test('el píxel y la etiqueta de Google salen en todas las páginas', () => {
    /*
     * Van en MainLayout, así que la forma de que una página se quede sin medir
     * es que deje de usar el layout. Ha pasado antes con otras cosas del
     * `<head>`, y en una página sin medir el fallo no se ve: se ve un informe
     * con menos visitas de las que hubo.
     */
    for (const p of pages()) {
      assert.match(
        p.html,
        /connect\.facebook\.net/,
        `${p.route} se quedó sin el píxel de Meta`
      );
      assert.match(
        p.html,
        /googletagmanager\.com\/gtag\/js/,
        `${p.route} se quedó sin la etiqueta de Google`
      );
    }
  });

  test('la medición arranca antes que el resto del documento', () => {
    // Si el visitante se va a los dos segundos, esa visita solo se cuenta si
    // el píxel ya salió. Por eso va inline y arriba, no como módulo diferido.
    const inicio = pages()
      .find(x => x.route === '/')
      .html.slice(0, 4000);
    assert.match(
      inicio,
      /const BYS=/,
      'la medición bajó del principio del head'
    );
  });

  test('el respaldo sin JavaScript no rompe el head', () => {
    /*
     * Dentro de `<head>`, un `<noscript>` solo admite link, style y meta: el
     * `<img>` del píxel cerraría el head antes de tiempo y empujaría al body
     * todo lo que viniera detrás. Por eso va al principio del `<body>`.
     */
    const html = pages().find(x => x.route === '/').html;
    const noscript = html.indexOf('facebook.com/tr?id=');
    assert.ok(noscript > -1, 'falta el píxel de respaldo sin JavaScript');
    assert.ok(
      noscript > html.indexOf('<body'),
      'el píxel de respaldo quedó dentro del <head>'
    );
  });

  test('la ficha de un producto declara su propio evento', () => {
    const p = pages().find(
      x =>
        x.route ===
        '/productos/tulas-y-bolsas-de-seguridad/tula-de-seguridad-30-x-40-cm/'
    );
    assert.match(p.html, /"?tipo"?:"producto"/);
    assert.match(p.html, /Tula de Seguridad 30 x 40/i);
  });

  test('el catálogo declara un evento de listado', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    assert.match(p.html, /"?tipo"?:"listado"/);
  });
});

describe('catálogo', () => {
  test('publica las 118 referencias del listado', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    // Solo las tarjetas: el atributo también aparece dentro del selector del
    // script de filtrado, y contarlo daría uno de más.
    const count = (p.html.match(/<article[^>]*data-catalog-item/g) ?? [])
      .length;
    assert.equal(count, 118, `se esperaban 118 referencias, hay ${count}`);
  });

  test('cada referencia se puede añadir a la cotización', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    const adds = (p.html.match(/data-quote-add="/g) ?? []).length;
    assert.equal(adds, 118);
  });

  test('los identificadores de referencia no se repiten', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    const ids = [...p.html.matchAll(/data-quote-add="([^"]+)"/g)].map(
      m => m[1]
    );
    assert.equal(new Set(ids).size, ids.length, 'hay ids duplicados');
  });

  test('ningún sinónimo estropea una búsqueda que ya funciona', () => {
    /*
     * Este es el test que justifica la lista entera. Un sinónimo está para
     * rescatar una búsqueda que hoy devuelve cero; si la palabra que se
     * traduce YA existe en el catálogo, deja de rescatar y empieza a estorbar.
     *
     * El caso concreto: si alguien pusiera «candado» → «precinto», escribir
     * «candado» dejaría de llevar a los dos precintos tipo candado y
     * devolvería los cuarenta y nueve precintos del catálogo. La búsqueda
     * seguiría "funcionando", que es lo que hace que nadie se entere.
     */
    /*
     * Se mira contra los NOMBRES de las referencias y de sus categorías, no
     * contra el índice de búsqueda entero.
     *
     * El índice incluye también la descripción, y desde que el catálogo trae
     * las descripciones de la dueña esa prosa usa con naturalidad las mismas
     * palabras que aquí se traducen: «sello de seguridad tipo rotor»,
     * «adhesivo tamper evident», «cable de acero». Medir contra el índice
     * entero prohibiría casi cualquier sinónimo útil por aparecer suelto en
     * un párrafo, que no es lo que la regla protege: lo que estropea una
     * búsqueda es traducir una palabra con la que el catálogo NOMBRA algo.
     */
    const p = pages().find(x => x.route === '/catalogo/');
    const sinTildes = s =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const nombres = [
      ...[...p.html.matchAll(/data-quote-name="([^"]*)"/g)].map(m => m[1]),
      ...[...p.html.matchAll(/data-quote-group="([^"]*)"/g)].map(m => m[1]),
    ].map(sinTildes);
    assert.ok(nombres.length > 100, 'no se leyeron los nombres del catálogo');

    const enElCatalogo = palabra =>
      nombres.some(nombre => nombre.includes(palabra));

    for (const entrada of sinonimos()) {
      for (const palabra of entrada.escribe) {
        assert.ok(
          !enElCatalogo(palabra),
          `«${palabra}» ya lo usa el catálogo: traducirlo a «${entrada.busca}» ` +
            'estropearía una búsqueda que hoy da el resultado correcto'
        );
      }
    }
  });

  test('ningún sinónimo lleva a un producto que no se vende', () => {
    // Un sinónimo que apunta a algo que no está en el catálogo cambia un cero
    // por otro cero, y encima enseña en pantalla un nombre que no existe.
    const p = pages().find(x => x.route === '/catalogo/');
    const indices = [...p.html.matchAll(/data-search="([^"]*)"/g)].map(
      m => m[1]
    );

    for (const entrada of sinonimos()) {
      for (const palabra of entrada.busca.split(' ')) {
        assert.ok(
          indices.some(indice => indice.includes(palabra)),
          `«${entrada.busca}» apunta a «${palabra}», que no está en el catálogo`
        );
      }
    }
  });

  test('el buscador indexa sin tildes', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    const search = p.html.match(/data-search="([^"]*holograma[^"]*)"/)?.[1];
    assert.ok(search, 'no se encontró una referencia de holograma');
    assert.doesNotMatch(search, /[áéíóúñ]/, 'data-search debe ir normalizado');
  });

  test('el mapa de contacto está incrustado', () => {
    const p = pages().find(x => x.route === '/contacto/');
    assert.match(p.html, /google\.com\/maps\/embed/);
    assert.match(p.html, /<iframe[^>]*title="/, 'el iframe necesita title');
  });
});

describe('hero de la home', () => {
  test('la fotografía ocupa el bloque entero', () => {
    const p = pages().find(x => x.route === '/');
    const hero = p.html.match(/<section[^>]*min-h-svh[^>]*>/);
    assert.ok(hero, 'el hero dejó de ocupar el alto de la pantalla');
    // `svh` y no `vh`: en el móvil, `vh` cuenta la barra de direcciones del
    // navegador aunque esté a la vista y el bloque se pasa de largo.
    assert.doesNotMatch(hero[0], /min-h-screen/);

    const foto = p.html.match(/<img[^>]*precinto-tecnologia[^>]*>/)?.[0];
    assert.ok(foto, 'el hero perdió su fotografía');
    // Es la imagen más grande de la primera pantalla: si carga en diferido,
    // el visitante ve el hueco.
    assert.match(foto, /loading="eager"/);
    assert.match(foto, /fetchpriority="high"/);
    // Decorativa: lo que dice ya está en el titular de al lado. El
    // minificador deja `alt` a secas, que es lo mismo que `alt=""`.
    assert.match(foto, /\salt(=""|[\s>])/);
  });

  test('el titular va en blanco sobre la foto', () => {
    const p = pages().find(x => x.route === '/');
    const h1 = p.html.match(/<h1[^>]*>/)[0];
    assert.match(h1, /text-white/, 'el titular del hero no va en blanco');
    // El velo es lo que garantiza el contraste pase lo que pase detrás de
    // cada línea, y eso cambia con el ancho de la pantalla.
    assert.match(p.html, /from-brand-950\/90/, 'el hero perdió su velo');
  });

  test('empieza en el borde superior, sin franja por encima', () => {
    const p = pages().find(x => x.route === '/');
    // La barra va fija y no ocupa sitio; el <main> de la portada no lleva el
    // relleno que sí llevan las demás páginas.
    const main = p.html.match(/<main[^>]*id="main-content"[^>]*>/)[0];
    assert.doesNotMatch(main, /pt-\[4\.75rem\]/);

    const otra = pages().find(x => x.route === '/nosotros/');
    assert.match(
      otra.html.match(/<main[^>]*id="main-content"[^>]*>/)[0],
      /pt-\[4\.75rem\]/,
      'las páginas sin hero a sangre deben separar el contenido de la barra'
    );
  });

  test('la señal de "sigue hacia abajo" lleva a una sección que existe', () => {
    const p = pages().find(x => x.route === '/');
    const destino = p.html.match(
      /href="#([a-z-]+)"[^>]*>\s*<span[^>]*>Nuestras/
    )?.[1];
    assert.ok(destino, 'el hero perdió la señal de continuar');
    assert.match(
      p.html,
      new RegExp(`id="${destino}"`),
      `no existe #${destino}`
    );
  });
});

describe('asistente del sitio', () => {
  test('la base de conocimiento se publica con el build', () => {
    const kb = JSON.parse(readFileSync(join(DIST, 'kb.json'), 'utf8'));
    assert.ok(kb.facts.length > 20, 'la base de conocimiento quedó corta');
    assert.equal(kb.site.name, 'B&S Logistics');
    // Sin precios publicados: la lista blanca vacía es lo que hace que
    // cualquier importe del modelo se bloquee.
    assert.deepEqual(kb.prices, []);
  });

  test('la burbuja está en todas las páginas', () => {
    for (const p of pages()) {
      assert.match(
        p.html,
        /data-chat-toggle/,
        `${p.route} no lleva la burbuja`
      );
    }
  });

  test('la burbuja vive abajo a la derecha, donde estaba WhatsApp', () => {
    const css = readdirSync(join(DIST, '_astro'))
      .filter(f => f.endsWith('.css'))
      .map(f => readFileSync(join(DIST, '_astro', f), 'utf8'))
      .join('');
    // Astro le añade su atributo de alcance a cada selector, de ahí el
    // `\[[^\]]*\]` en medio.
    const reglas = css.match(/\.chat(?:\[[^\]]*\])?\{[^}]*\}/g) ?? [];
    assert.ok(
      reglas.length > 0,
      'no se encontró la regla de posición del chat'
    );
    for (const regla of reglas) {
      assert.match(regla, /right:/, 'la burbuja debe anclarse a la derecha');
      assert.doesNotMatch(regla, /left:/);
    }
  });

  test('el rincón de la burbuja quedó libre: no hay otro botón flotante', () => {
    // El de WhatsApp se retiró y el del cotizador subió a la barra. Si vuelve
    // a aparecer un `fixed` en esa esquina, se tapan entre ellos.
    for (const p of pages()) {
      assert.doesNotMatch(
        p.html,
        /<aside[^>]*aria-label="Acciones rápidas de contacto"/,
        `${p.route} conserva los botones flotantes de la derecha`
      );
    }
  });

  test('se puede llegar a WhatsApp desde el primer mensaje', () => {
    // Al quitar el botón flotante, la vía directa con una persona pasa a
    // depender de la burbuja: tiene que estar a la vista al abrirla, no
    // después de preguntar algo.
    const p = pages().find(x => x.route === '/');
    const saludo = p.html.slice(p.html.indexOf('chat-msg is-bot'));
    assert.match(saludo.slice(0, 900), /wa\.me\/573209514930/);
  });

  test('ninguna página filtra una clave del proveedor', () => {
    for (const p of pages()) {
      assert.doesNotMatch(
        p.html,
        /gsk_[A-Za-z0-9]/,
        `${p.route} filtra una clave`
      );
      assert.doesNotMatch(p.html, /sk-ant-/, `${p.route} filtra una clave`);
    }
  });
});

describe('guías de uso', () => {
  const guias = () => pages().filter(p => /^\/usos\/.+/.test(p.route));

  test('cada guía publica sus datos estructurados', () => {
    for (const p of guias()) {
      const bloques = [
        ...p.html.matchAll(/type="application\/ld\+json">(.*?)<\/script>/gs),
      ];
      const grafos = bloques
        .map(m => JSON.parse(m[1]))
        .filter(d => Array.isArray(d['@graph']));
      assert.equal(grafos.length, 1, `${p.route} no publica su grafo`);

      const tipos = grafos[0]['@graph'].map(x => x['@type']);
      assert.ok(tipos.includes('Article'), `${p.route} sin Article`);
      assert.ok(tipos.includes('BreadcrumbList'), `${p.route} sin migas`);
      // El FAQPage es lo que permite que la respuesta salga en el buscador
      // sin que nadie entre a la página.
      assert.ok(tipos.includes('FAQPage'), `${p.route} sin FAQPage`);
    }
  });

  test('cada guía lleva a productos del catálogo', () => {
    const rutas = new Set(pages().map(p => p.route));
    for (const p of guias()) {
      const enlaces = [
        ...p.html.matchAll(
          /href="(\/(?:precintos|productos|catalogo)[^"#?]*)"/g
        ),
      ].map(m => (m[1].endsWith('/') ? m[1] : m[1] + '/'));
      assert.ok(
        enlaces.length > 0,
        `${p.route} no enlaza ninguna referencia: la guía no sirve de puerta de entrada`
      );
      for (const enlace of enlaces) {
        assert.ok(
          rutas.has(enlace),
          `${p.route} enlaza a ${enlace}, que no existe`
        );
      }
    }
  });

  test('ninguna guía publica precios', () => {
    for (const p of guias()) {
      assert.doesNotMatch(
        p.html,
        /\$\s?\d{3}|\d[\d.,]*\s*pesos/i,
        `${p.route} publica un importe`
      );
    }
  });

  test('el índice de usos enlaza todas las guías', () => {
    const indice = pages().find(p => p.route === '/usos/');
    for (const guia of guias()) {
      assert.match(
        indice.html,
        new RegExp(`href="${guia.route.replace(/\/$/, '')}"`),
        `el índice no enlaza ${guia.route}`
      );
    }
  });

  test('cada guía entra en el sitemap', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const guia of guias()) {
      assert.ok(
        sitemap.includes(`byslogistics.com.co${guia.route}`),
        `${guia.route} no está en el sitemap`
      );
    }
  });
});

/*
 * Las redirecciones que sostienen lo que ya estaba indexado.
 *
 * La dirección de una ficha sale de su nombre, así que renombrar el catálogo
 * mueve páginas de sitio. public/_redirects es lo que impide que eso se
 * convierta en un 404 para quien llega desde Google o desde un favorito, y es
 * un archivo que se edita a mano: estos tests son los que avisan cuando se
 * queda desfasado.
 */
describe('redirecciones', () => {
  /** Las reglas de public/_redirects, ya copiadas a dist/ al construir. */
  function reglas() {
    const archivo = join(DIST, '_redirects');
    assert.ok(existsSync(archivo), 'no se copió _redirects a dist/');
    return readFileSync(archivo, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => {
        const [desde, hacia, estado] = l.split(/\s+/);
        return { desde, hacia, estado };
      });
  }

  /** Una ruta de ficha, con y sin barra final, tal como se sirve. */
  const existe = ruta =>
    pages().some(p => p.route.replace(/\/$/, '') === ruta.replace(/\/$/, ''));

  test('todas son permanentes', () => {
    // Sin esta cota, los demás tests pasarían con el archivo vacío.
    assert.ok(
      reglas().length > 50,
      'se esperaban las redirecciones del catálogo 2026'
    );
    for (const r of reglas()) {
      assert.equal(r.estado, '301', `${r.desde} no está declarada como 301`);
    }
  });

  test('ninguna lleva a una página que no existe', () => {
    for (const r of reglas()) {
      assert.ok(
        existe(r.hacia),
        `${r.desde} redirige a ${r.hacia}, que no está en dist/`
      );
    }
  });

  /*
   * Una regla cuyo origen SIGUE siendo una página del sitio no se aplica
   * nunca: el archivo estático gana. Con los dos precintos que intercambiaron
   * nombre en el catálogo de 2026, eso mandaría al visitante al producto
   * equivocado sin que nadie se entere.
   */
  test('ninguna queda tapada por una página viva', () => {
    for (const r of reglas()) {
      assert.ok(
        !existe(r.desde),
        `${r.desde} sigue existiendo como página: su redirección nunca se aplicaría`
      );
    }
  });

  test('ningún origen se declara dos veces', () => {
    const origenes = reglas().map(r => r.desde);
    const repetidos = origenes.filter((o, i) => origenes.indexOf(o) !== i);
    assert.deepEqual([...new Set(repetidos)], [], 'hay orígenes duplicados');
  });

  test('ninguna encadena con otra', () => {
    /*
     * Redirigir a una dirección que a su vez redirige cuesta un salto de más y
     * diluye lo que se hereda. Como cada renombrado se apunta contra la
     * dirección VIVA, encadenar solo puede venir de una regla escrita a mano.
     */
    const porOrigen = new Map(
      reglas().map(r => [r.desde.replace(/\/$/, ''), r.hacia])
    );
    for (const r of reglas()) {
      assert.ok(
        !porOrigen.has(r.hacia.replace(/\/$/, '')),
        `${r.desde} lleva a ${r.hacia}, que a su vez redirige`
      );
    }
  });
});

/**
 * La sección de recursos: preguntas, guías y novedades.
 *
 * Lo que se comprueba aquí no es que las páginas existan —eso ya lo garantiza
 * la colección— sino que el CRUCE funcione en el HTML final: que una pregunta
 * enlace al catálogo y que el catálogo enlace de vuelta. Ese cruce se declara
 * en un solo sitio y se deriva en las dos direcciones, así que si se rompe se
 * rompe entero y en silencio.
 */
describe('recursos', () => {
  const fichasDePregunta = () =>
    pages().filter(p => /^\/preguntas\/[^/]+\/[^/]+\/$/.test(p.route));

  test('se publican las preguntas del documento', () => {
    assert.ok(
      fichasDePregunta().length >= 50,
      `se esperaban las del documento, hay ${fichasDePregunta().length}`
    );
  });

  test('cada familia tiene su índice, y el hub las reparte', () => {
    const hub = pages().find(p => p.route === '/preguntas/');
    assert.ok(hub, 'falta /preguntas/');

    const indices = pages().filter(p => /^\/preguntas\/[^/]+\/$/.test(p.route));
    assert.equal(indices.length, 6, 'se esperaban las seis familias');
    for (const indice of indices) {
      const id = indice.route.replace(/\/preguntas\/|\/$/g, '');
      assert.match(
        hub.html,
        new RegExp(`href="/preguntas/${id}"`),
        `el hub no enlaza la familia ${id}`
      );
    }
  });

  test('cada pregunta lleva al catálogo', () => {
    for (const p of fichasDePregunta()) {
      assert.match(
        p.html,
        /href="\/(precintos|productos)\/[a-z0-9-]+"/,
        `${p.route} no enlaza a ninguna línea de producto`
      );
    }
  });

  /*
   * El sentido inverso. Es la mitad del valor de la sección: sin él, una visita
   * que llegó por búsqueda lee y se va, y la categoría no recibe nada de la
   * autoridad que gane el artículo.
   */
  test('las líneas de producto enlazan de vuelta a sus preguntas', () => {
    const categorias = pages().filter(p =>
      /^\/(precintos|productos)\/[^/]+\/$/.test(p.route)
    );
    const conBloque = categorias.filter(p =>
      p.html.includes('Preguntas frecuentes sobre esta línea')
    );
    assert.ok(
      conBloque.length >= 5,
      `solo ${conBloque.length} categorías enlazan de vuelta a sus preguntas`
    );
    for (const p of conBloque) {
      assert.match(
        p.html,
        /href="\/preguntas\/[^/]+\/[^"]+"/,
        `${p.route} pinta el bloque pero no enlaza ninguna pregunta`
      );
    }
  });

  test('cada pregunta publica su FAQPage y sus migas', () => {
    for (const p of fichasDePregunta()) {
      assert.ok(p.html.includes('"FAQPage"'), `${p.route} sin FAQPage`);
      assert.ok(
        p.html.includes('"BreadcrumbList"'),
        `${p.route} sin BreadcrumbList`
      );
    }
  });

  /*
   * «Actualizado» en vez de «publicado»: es lo que permite refrescar una página
   * sin escribir una nueva, conservando su dirección y su posición.
   */
  test('las guías publican cuándo se revisaron', () => {
    const guias = pages().filter(p => /^\/usos\/[^/]+\/$/.test(p.route));
    assert.ok(guias.length >= 6);
    for (const guia of guias) {
      assert.ok(
        guia.html.includes('Actualizado el'),
        `${guia.route} no dice cuándo se revisó`
      );
      assert.ok(
        guia.html.includes('dateModified'),
        `${guia.route} sin dateModified`
      );
    }
  });

  test('las novedades sí llevan fecha de publicación', () => {
    const entradas = pages().filter(p =>
      /^\/novedades\/[^/]+\/$/.test(p.route)
    );
    assert.ok(entradas.length >= 1, 'no hay ninguna novedad publicada');
    for (const entrada of entradas) {
      assert.ok(
        entrada.html.includes('"BlogPosting"'),
        `${entrada.route} sin BlogPosting`
      );
      assert.ok(
        entrada.html.includes('datePublished'),
        `${entrada.route} sin datePublished`
      );
    }
  });

  test('/faq lleva a la respuesta larga donde la hay', () => {
    const faq = pages().find(p => p.route === '/faq/');
    const enlaces = [...faq.html.matchAll(/href="(\/preguntas\/[^"]+)"/g)].map(
      m => m[1]
    );
    assert.ok(
      enlaces.length >= 5,
      'casi ninguna respuesta corta enlaza la larga'
    );
    const rutas = new Set(pages().map(p => p.route.replace(/\/$/, '')));
    for (const url of enlaces) {
      assert.ok(rutas.has(url), `/faq enlaza a ${url}, que no se generó`);
    }
  });

  test('el menú lleva a recursos y ya no duplica usos y faq', () => {
    const home = pages().find(p => p.route === '/');
    assert.match(
      home.html,
      /href="\/recursos"/,
      'el menú no lleva a /recursos'
    );
    // Las dos páginas viejas siguen publicadas —están indexadas— y se enlazan
    // desde el pie y desde /recursos, pero ya no ocupan sitio en el menú.
    assert.ok(
      pages().some(p => p.route === '/usos/'),
      '/usos dejó de existir'
    );
    assert.ok(
      pages().some(p => p.route === '/faq/'),
      '/faq dejó de existir'
    );
  });

  test('las páginas nuevas entran al sitemap', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const ruta of ['/recursos/', '/preguntas/', '/novedades/']) {
      assert.ok(
        sitemap.includes(`byslogistics.com.co${ruta}`),
        `${ruta} no está en el sitemap`
      );
    }
    for (const p of fichasDePregunta().slice(0, 5)) {
      assert.ok(
        sitemap.includes(`byslogistics.com.co${p.route}`),
        `${p.route} no está en el sitemap`
      );
    }
  });
});
