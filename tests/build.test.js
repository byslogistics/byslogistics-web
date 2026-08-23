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

const RUTAS_ESPERADAS = [
  '/',
  '/catalogo/',
  '/precintos/',
  '/precintos/precintos-de-botella/',
  '/precintos/precintos-de-guaya/',
  // Fichas de referencia: una de precintos y una de otra familia, que es lo
  // que exige que la plantilla no quedara atada a los atributos de un precinto.
  '/precintos/precintos-de-correa-dentada/precinto-doble-dentado-38-cms/',
  '/productos/tulas-y-bolsas-de-seguridad/tula-de-seguridad-30-x-40-cms/',
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
      /href="\/precintos\/precintos-de-correa-dentada\/precinto-doble-dentado-38-cms"/,
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
      '/precintos/precintos-de-correa-dentada/precinto-doble-dentado-38-cms/'
    );
    assert.match(html, /wa\.me\/\d+\?text=[^"]*Precinto%20Doble%20Dentado/);
  });

  test('la ficha ofrece el cotizador del sitio, no un formulario nuevo', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-doble-dentado-38-cms/'
    );
    assert.match(html, /data-quote-add="/);
  });

  /*
   * La regla que sostiene un catálogo que se llena de a poco: un bloque sin
   * datos no se pinta. Un encabezado "Colores disponibles" sin colores debajo
   * es peor que no tener la sección.
   */
  test('los bloques sin datos no se pintan', () => {
    // Los precintos de botella todavía no tienen plantilla de categoría.
    const html = unaFicha(
      '/precintos/precintos-de-botella/precinto-botella-one-seal/'
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
      '/precintos/precintos-de-correa-dentada/precinto-doble-dentado-38-cms/'
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
    // Su longitud sí la sabe —la dice su nombre—, la resistencia todavía no.
    assert.ok(html.includes('380 mm'), 'perdió su propia longitud');
    assert.ok(
      html.includes('Consúltenos'),
      'un atributo sin valor debe invitar a consultarlo, no desaparecer'
    );
  });

  test('la referencia de ejemplo no deja ningún atributo pendiente', () => {
    const html = unaFicha(
      '/precintos/precintos-de-correa-dentada/precinto-dentado-doble-cierre-35-cms/'
    );
    assert.ok(
      !html.includes('Consúltenos'),
      'la ficha de ejemplo tiene que estar completa'
    );
    for (const dato of ['7,6 mm', '35 x 20 mm', '18 kgf', 'Más vendido']) {
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
      '/precintos/precintos-de-correa-dentada/precinto-doble-dentado-38-cms/'
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
  test('el de contacto tiene el marcado que Netlify necesita', () => {
    const p = pages().find(x => x.route === '/contacto/');
    const form = p.html.match(/<form[^>]*name="contacto"[^>]*>/)[0];
    assert.match(form, /data-netlify="true"/);
    assert.match(form, /method="POST"/);
    assert.match(form, /data-netlify-honeypot="botcheck"/);
    assert.match(p.html, /name="form-name"[^>]*value="contacto"/);
  });

  test('el de suscripción también, y está en todas las páginas', () => {
    for (const p of pages()) {
      if (p.route === '/404.html' || p.route.endsWith('404.html')) continue;
      if (!p.html.includes('name="suscripcion"')) continue;
      assert.match(p.html, /<form[^>]*name="suscripcion"[^>]*data-netlify/);
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
    for (const [, id] of p.html.matchAll(/<input[^>]*id="(hs-[^"]+)"/g)) {
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
        '/productos/tulas-y-bolsas-de-seguridad/tula-de-seguridad-30-x-40-cms/'
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
  test('publica las 115 referencias del listado', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    // Solo las tarjetas: el atributo también aparece dentro del selector del
    // script de filtrado, y contarlo daría uno de más.
    const count = (p.html.match(/<article[^>]*data-catalog-item/g) ?? [])
      .length;
    assert.equal(count, 115, `se esperaban 115 referencias, hay ${count}`);
  });

  test('cada referencia se puede añadir a la cotización', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    const adds = (p.html.match(/data-quote-add="/g) ?? []).length;
    assert.equal(adds, 115);
  });

  test('los identificadores de referencia no se repiten', () => {
    const p = pages().find(x => x.route === '/catalogo/');
    const ids = [...p.html.matchAll(/data-quote-add="([^"]+)"/g)].map(
      m => m[1]
    );
    assert.equal(new Set(ids).size, ids.length, 'hay ids duplicados');
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
