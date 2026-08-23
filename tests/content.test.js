/**
 * Integridad del contenido y del catálogo.
 *
 * No necesita navegador ni build: lee directamente los archivos de
 * src/content y src/data_files. Es la red de seguridad más barata, así que
 * corre primero.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const P = (...p) => join(ROOT, ...p);

/** Lee el frontmatter YAML de un .md sin depender de un parser externo. */
function frontmatter(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${file} debe empezar con frontmatter`);
  return m[1];
}

function listMd(dir) {
  return readdirSync(P('src/content', dir))
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, path: P('src/content', dir, f) }));
}

const ICONS = readFileSync(P('src/components/ui/icons/icons.ts'), 'utf8');

describe('colecciones de contenido', () => {
  test('las guías de uso declaran lo que necesita cada página', () => {
    const dir = join(ROOT, 'src/content/usos');
    const archivos = readdirSync(dir).filter(f => f.endsWith('.md'));
    assert.ok(archivos.length >= 6, 'la sección de usos quedó corta');

    const ordenes = new Set();
    for (const nombre of archivos) {
      const raw = readFileSync(join(dir, nombre), 'utf8');
      for (const campo of [
        'title',
        'description',
        'order',
        'sector',
        'summary',
      ]) {
        assert.match(
          raw,
          new RegExp(`^${campo}:`, 'm'),
          `${nombre} sin ${campo}`
        );
      }
      // La descripción es la metadescripción de la página: si se pasa de 160
      // el buscador la corta a media frase.
      const descripcion = raw.match(/^description: '([^']+)'/m)?.[1] ?? '';
      assert.ok(
        descripcion.length > 60 && descripcion.length <= 165,
        `${nombre}: la metadescripción mide ${descripcion.length} caracteres`
      );
      // Sin preguntas frecuentes no hay FAQPage, que es la mitad del motivo
      // por el que estas páginas existen.
      assert.match(raw, /^faq:/m, `${nombre} no trae preguntas frecuentes`);

      const orden = raw.match(/^order: (\d+)/m)?.[1];
      assert.ok(!ordenes.has(orden), `${nombre} repite el order ${orden}`);
      ordenes.add(orden);
    }
  });

  test('cada guía apunta a guías relacionadas que existen', () => {
    const dir = join(ROOT, 'src/content/usos');
    const ids = new Set(
      readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace(/\.md$/, ''))
    );
    for (const nombre of readdirSync(dir).filter(f => f.endsWith('.md'))) {
      const raw = readFileSync(join(dir, nombre), 'utf8');
      const bloque =
        raw.match(/^relacionados:\n((?:  - [^\n]+\n)+)/m)?.[1] ?? '';
      for (const linea of bloque.split('\n').filter(Boolean)) {
        const id = linea.replace('  - ', '').trim();
        assert.ok(ids.has(id), `${nombre} apunta a ${id}, que no existe`);
      }
    }
  });

  test('existen las dos colecciones con archivos', () => {
    assert.ok(listMd('soluciones').length >= 6, 'al menos 6 familias');
    assert.ok(listMd('precintos').length >= 11, 'al menos 11 categorías');
  });

  test('cada familia declara title, description, order e icon', () => {
    for (const { name, path } of listMd('soluciones')) {
      const fm = frontmatter(path);
      for (const key of ['title:', 'description:', 'order:', 'icon:']) {
        assert.ok(fm.includes(key), `${name} debe declarar ${key}`);
      }
    }
  });

  test('el icono de cada familia existe en icons.ts', () => {
    for (const { name, path } of listMd('soluciones')) {
      const icon = frontmatter(path).match(/^icon:\s*(\S+)/m)?.[1];
      assert.ok(icon, `${name} debe declarar un icono`);
      assert.ok(
        new RegExp(`^\\s{2}${icon}:`, 'm').test(ICONS),
        `el icono "${icon}" de ${name} no existe en icons.ts`
      );
    }
  });

  test('los order no se repiten dentro de una colección', () => {
    for (const dir of ['soluciones', 'precintos']) {
      const orders = listMd(dir).map(
        ({ path }) => frontmatter(path).match(/^order:\s*(\d+)/m)?.[1]
      );
      assert.equal(
        new Set(orders).size,
        orders.length,
        `hay orders repetidos en ${dir}`
      );
    }
  });

  test('ninguna referencia trae precio: el listado es administrativo', () => {
    for (const dir of ['soluciones', 'precintos']) {
      for (const { name, path } of listMd(dir)) {
        const raw = readFileSync(path, 'utf8');
        assert.ok(
          !/\bprecio:\s*\d|\bvalor:\s*\d|\$\s?\d{3}/.test(raw),
          `${name} no debe publicar precios`
        );
      }
    }
  });

  test('no quedan restos de la plantilla original', () => {
    const offenders = [];
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', 'dist', '.git'].includes(entry.name))
            walk(full);
        } else if (/\.(astro|ts|js|md|json|mjs)$/.test(entry.name)) {
          const raw = readFileSync(full, 'utf8');
          if (/screwfast/i.test(raw)) offenders.push(full.replace(ROOT, ''));
        }
      }
    };
    walk(P('src'));
    assert.deepEqual(offenders, [], 'quedan referencias a ScrewFast');
  });
});

describe('datos de la empresa', () => {
  const constants = readFileSync(P('src/data_files/constants.ts'), 'utf8');

  test('el WhatsApp del cotizador es el número confirmado', () => {
    assert.match(constants, /wa\.me\/573209514930/);
  });

  test('el correo de contacto es el de la empresa', () => {
    assert.match(constants, /ventas@precintosdeseguridad\.co/);
  });

  test('el sitio apunta al dominio propio', () => {
    assert.match(constants, /url:\s*'https:\/\/byslogistics\.com\.co'/);
  });

  test('no hay datos de la otra empresa encontrada por búsqueda web', () => {
    // Se cargaron por error en una fase temprana: eran de B&S Logistics
    // Global S.A.S., una compañía distinta.
    assert.doesNotMatch(constants, /cco@byslogistics\.com/);
    assert.doesNotMatch(constants, /Carrera 38 # 9-45/);
  });
});

describe('sinónimos del buscador', () => {
  /*
   * Se lee el fuente en vez de importarlo, como con fichas.ts: el archivo usa
   * los alias de Astro (@data/…) y node por su cuenta no los resuelve.
   */
  const fuente = readFileSync(P('src/data_files/sinonimos.ts'), 'utf8');
  const entradas = [
    ...fuente.matchAll(/busca:\s*'([^']+)',\s*escribe:\s*\[([\s\S]*?)\]/g),
  ].map(m => ({
    busca: m[1],
    escribe: [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]),
  }));

  test('la lista se pudo leer', () => {
    assert.ok(entradas.length >= 5, `solo se leyeron ${entradas.length}`);
    for (const entrada of entradas) {
      assert.ok(
        entrada.escribe.length > 0,
        `«${entrada.busca}» no tiene sinónimos`
      );
    }
  });

  test('todo va sin tildes y en minúscula, o no se activa nunca', () => {
    /*
     * La comparación ocurre sobre el texto ya normalizado. Un sinónimo escrito
     * «sílica» no se activaría jamás, y el fallo no se ve: la búsqueda
     * simplemente sigue devolviendo cero, igual que antes de agregarlo.
     */
    for (const entrada of entradas) {
      for (const palabra of [entrada.busca, ...entrada.escribe]) {
        assert.match(
          palabra,
          /^[a-z0-9]+( [a-z0-9]+)*$/,
          `«${palabra}» tiene tildes, mayúsculas o signos y nunca coincidiría`
        );
      }
    }
  });

  test('ninguna palabra se traduce dos veces', () => {
    const vistas = new Map();
    for (const entrada of entradas) {
      for (const palabra of entrada.escribe) {
        const anterior = vistas.get(palabra);
        assert.ok(
          !anterior,
          `«${palabra}» apunta a «${anterior}» y a «${entrada.busca}»`
        );
        vistas.set(palabra, entrada.busca);
      }
    }
  });

  test('un sinónimo no se traduce a sí mismo', () => {
    for (const entrada of entradas) {
      assert.ok(
        !entrada.escribe.includes(entrada.busca),
        `«${entrada.busca}» se traduce a sí mismo`
      );
    }
  });
});

describe('navegación', () => {
  const nav = readFileSync(P('src/utils/navigation.ts'), 'utf8');

  test('las redes sociales configuradas son URLs absolutas', () => {
    const block = nav.match(/socialLinks[^=]*=\s*{([\s\S]*?)}/)[1];
    for (const [, value] of block.matchAll(/\w+:\s*'([^']*)'/g)) {
      if (value === '') continue;
      assert.match(value, /^https:\/\//, `"${value}" debe ser una URL https`);
    }
  });

  test('ningún enlace del menú apunta a "#"', () => {
    assert.doesNotMatch(nav, /url:\s*'#'/);
  });
});

describe('configuración de despliegue', () => {
  test('pnpm-workspace declara packages, o CI falla al cachear', () => {
    const ws = readFileSync(P('pnpm-workspace.yaml'), 'utf8');
    assert.match(ws, /^packages:/m);
  });

  test('la versión de pnpm está fijada para que CI use la misma', () => {
    const pkg = JSON.parse(readFileSync(P('package.json'), 'utf8'));
    assert.match(pkg.packageManager ?? '', /^pnpm@\d+\.\d+\.\d+$/);
  });

  test('netlify.toml existe y publica dist', () => {
    const toml = readFileSync(P('netlify.toml'), 'utf8');
    assert.match(toml, /publish\s*=\s*"dist"/);
  });

  test('la CSP permite el iframe de Google Maps', () => {
    const toml = readFileSync(P('netlify.toml'), 'utf8');
    const csp = toml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)[1];
    const frameSrc = csp.match(/frame-src ([^;]+)/)[1];
    assert.match(
      frameSrc,
      /google\.com/,
      'sin esto el mapa de contacto queda en blanco'
    );
  });

  test('la CSP deja pasar el píxel de Meta y la etiqueta de Google', () => {
    /*
     * La CSP es una lista blanca. Sin estos dominios el navegador bloquea la
     * medición en silencio: el sitio se ve perfecto y los informes salen
     * vacíos, que es la forma más cara de enterarse.
     */
    const toml = readFileSync(P('netlify.toml'), 'utf8');
    const csp = toml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)[1];
    const directiva = nombre => csp.match(new RegExp(`${nombre} ([^;]+)`))[1];

    assert.match(directiva('script-src'), /connect\.facebook\.net/);
    assert.match(directiva('script-src'), /www\.googletagmanager\.com/);
    assert.match(directiva('connect-src'), /www\.facebook\.com/);
    assert.match(directiva('connect-src'), /google-analytics\.com/);
    assert.match(
      directiva('img-src'),
      /www\.facebook\.com/,
      'el píxel sin JavaScript se pide como imagen'
    );
  });

  test('ya no queda configuración de Vercel', () => {
    assert.ok(!existsSync(P('vercel.json')));
  });
});

describe('medición', () => {
  const constants = readFileSync(P('src/data_files/constants.ts'), 'utf8');
  const analytics = readFileSync(P('src/assets/scripts/analytics.js'), 'utf8');

  test('los identificadores son los que ya usaba la empresa', () => {
    // El píxel viene del sitio anterior: cambiarlo partiría el histórico y
    // dejaría sin datos a los públicos de remarketing ya creados.
    assert.match(constants, /metaPixelId:\s*'1137991652734329'/);
    assert.match(constants, /googleTagId:\s*'G-CPJH96HLSN'/);
  });

  test('en local no se mide', () => {
    // Sin esto, cada `pnpm test:e2e` —que navega por medio sitio con un
    // navegador de verdad— mandaría visitas y conversiones falsas al píxel.
    const hosts = constants.match(/hostsSinMedicion:\s*\[([^\]]+)\]/)[1];
    assert.match(hosts, /'localhost'/);
    assert.match(hosts, /'127\.0\.0\.1'/);
    assert.match(analytics, /hostsSinMedicion\.indexOf\(location\.hostname\)/);
  });

  test('ningún evento manda importes', () => {
    /*
     * La regla del sitio —no hay precios— vale también para lo que sale hacia
     * Meta y Google. Un `value` inventado, o un cero, convierte los informes
     * de campaña en cifras falsas.
     */
    assert.doesNotMatch(analytics, /\bvalue:/);
    assert.doesNotMatch(analytics, /\bcurrency:/);
    assert.doesNotMatch(
      analytics,
      /'Purchase'/,
      'aquí no se cierra una venta, se pide una cotización'
    );
  });

  test('la visita no se cuenta mientras la página se pre-renderiza', () => {
    // El sitio lleva prefetch y clientPrerender: sin esta comprobación, pasar
    // el ratón por encima de un enlace contaría como una visita.
    assert.match(analytics, /document\.prerendering/);
    assert.match(analytics, /prerenderingchange/);
  });
});

describe('preguntas heredadas por las fichas de producto', () => {
  /*
   * Las fichas no copian las respuestas de la página de preguntas frecuentes:
   * las referencian por su pregunta, para que se editen en un solo sitio. El
   * precio de eso es que renombrar una pregunta en faqs.json las deja fuera de
   * la ficha sin que nadie se entere. Este test es ese aviso.
   */
  test('cada pregunta base sigue existiendo en faqs.json', () => {
    // Se lee el fuente en vez de importarlo: fichas.ts usa los alias de Astro
    // (@data/…), que node por su cuenta no resuelve.
    const fichas = readFileSync(join(ROOT, 'src/data_files/fichas.ts'), 'utf8');
    const declaradas = [...fichas.matchAll(/^\s*'(¿[^']+\?)',$/gm)].map(
      m => m[1]
    );
    assert.ok(
      declaradas.length > 0,
      'no se encontró ninguna pregunta base declarada en fichas.ts'
    );

    const faqs = JSON.parse(
      readFileSync(join(ROOT, 'src/data_files/faqs.json'), 'utf8')
    );
    const existentes = new Set(
      faqs.categories.flatMap(c => c.faqs).map(f => f.question)
    );

    for (const pregunta of declaradas) {
      assert.ok(
        existentes.has(pregunta),
        `la ficha espera "${pregunta}", que ya no está en faqs.json`
      );
    }
  });
});
