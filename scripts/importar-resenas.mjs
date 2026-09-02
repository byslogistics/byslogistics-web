/**
 * Importa las reseñas de Google al sitio.
 *
 *   node scripts/importar-resenas.mjs
 *
 * QUÉ HACE. Lee un volcado de las reseñas desde `📤SUBIR-CONTENIDO/` y
 * reescribe la lista `OPINIONES` de `src/data_files/opiniones.ts`. La cabecera
 * del archivo —los comentarios, la interfaz y la ficha `GOOGLE`— no se toca:
 * solo se sustituye la lista.
 *
 * POR QUÉ NO LAS TRAE ÉL SOLO. Porque no existe una forma pública de pedirle a
 * Google TODAS las reseñas de un negocio:
 *
 *   · La **API de Places** devuelve como mucho CINCO, y es un tope de Google,
 *     no una opción que se pueda subir. Aun así el script la admite (ver
 *     `--places`), porque cinco automáticas y siempre al día valen para
 *     mantener la sección viva sin trabajo.
 *   · La **API de Perfil de Empresa** sí las devuelve todas, pero exige que la
 *     empresa la habilite en un proyecto de Google Cloud, pida acceso —lo
 *     aprueban a mano, tarda días— y autorice con la cuenta que administra la
 *     ficha. Es un trámite de la empresa, no algo que se resuelva desde aquí.
 *
 * Así que el camino que funciona hoy es un volcado, y de ahí este script.
 *
 * DE DÓNDE SALE EL VOLCADO. Está explicado paso a paso en el README de
 * `📤SUBIR-CONTENIDO/`. Resumido: se abre la ficha de Google, se despliegan
 * todas las reseñas y se copian, en cualquiera de estos dos formatos:
 *
 *   · `resenas.json` — una lista de objetos
 *     `{ autor, estrellas, cuando, texto }`. Es lo que devuelve el fragmento
 *     que trae el README, y el formato preferido: no hay nada que interpretar.
 *   · `resenas.txt` — a mano, una reseña por bloque:
 *
 *         Daniel Molina | 5 | hace 2 meses
 *         Su asesoría al momento de elegir el producto fue clave. Los
 *         recomiendo.
 *
 *         Otro Cliente | 4 |
 *         El texto de la otra reseña.
 *
 *     La primera línea es «autor | estrellas | cuándo» —lo de «cuándo» puede
 *     ir vacío—, y lo que sigue hasta la línea en blanco es el texto.
 *
 * REGLA QUE EL SCRIPT NO PUEDE COMPROBAR Y HAY QUE RESPETAR: lo que entre aquí
 * tiene que ser lo que está publicado en Google, sin retocar la redacción ni
 * recortar la parte menos favorable. Cada tarjeta del sitio enlaza a la ficha,
 * así que cualquiera puede cotejarla; una reseña que no coincida con la de
 * Google es peor que no tener sección.
 */
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUZON = path.join(RAIZ, '📤SUBIR-CONTENIDO');
const DESTINO = path.join(RAIZ, 'src/data_files/opiniones.ts');

/* ------------------------------------------------------------------ *
 * Lectura del volcado
 * ------------------------------------------------------------------ */

const limpiar = texto =>
  String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** Una reseña con lo mínimo para pintarla, o `null` si no sirve. */
function normalizar(cruda) {
  const autor = limpiar(cruda.autor ?? cruda.author ?? cruda.nombre);
  const texto = limpiar(cruda.texto ?? cruda.text ?? cruda.comentario);
  if (!autor || !texto) return null;

  const estrellas = Number(cruda.estrellas ?? cruda.rating ?? 5);
  return {
    autor,
    texto,
    estrellas: Number.isFinite(estrellas)
      ? Math.min(5, Math.max(1, Math.round(estrellas)))
      : 5,
    cuando: limpiar(cruda.cuando ?? cruda.when ?? cruda.fecha) || undefined,
  };
}

function desdeJson(contenido) {
  const datos = JSON.parse(contenido);
  const lista = Array.isArray(datos) ? datos : (datos.reviews ?? datos.resenas);
  if (!Array.isArray(lista)) {
    throw new Error('el JSON debe ser una lista de reseñas');
  }
  return lista.map(normalizar).filter(Boolean);
}

function desdeTexto(contenido) {
  return contenido
    .split(/\n\s*\n/)
    .map(bloque => bloque.trim())
    .filter(Boolean)
    .map(bloque => {
      const [cabecera, ...resto] = bloque.split('\n');
      const [autor, estrellas, cuando] = cabecera.split('|');
      return normalizar({
        autor,
        estrellas: estrellas?.trim() || 5,
        cuando,
        texto: resto.join(' '),
      });
    })
    .filter(Boolean);
}

/**
 * La API de Places, para quien prefiera automatizarlo. Devuelve como mucho
 * cinco reseñas: es el tope de Google, no una opción del script.
 *
 *   GOOGLE_PLACES_API_KEY=... GOOGLE_PLACE_ID=... \
 *     node scripts/importar-resenas.mjs --places
 */
async function desdePlaces() {
  const clave = process.env.GOOGLE_PLACES_API_KEY;
  const ficha = process.env.GOOGLE_PLACE_ID;
  if (!clave || !ficha) {
    throw new Error(
      'para --places hacen falta GOOGLE_PLACES_API_KEY y GOOGLE_PLACE_ID'
    );
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${ficha}`, {
    headers: {
      'X-Goog-Api-Key': clave,
      'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
    },
  });
  if (!res.ok) {
    throw new Error(`Google respondió ${res.status}: ${await res.text()}`);
  }

  const datos = await res.json();
  const opiniones = (datos.reviews ?? [])
    .map(review =>
      normalizar({
        autor: review.authorAttribution?.displayName,
        estrellas: review.rating,
        cuando: review.relativePublishTimeDescription,
        texto: review.originalText?.text ?? review.text?.text,
      })
    )
    .filter(Boolean);

  return { opiniones, total: datos.userRatingCount, nota: datos.rating };
}

/* ------------------------------------------------------------------ *
 * Escritura
 * ------------------------------------------------------------------ */

/** Comillas simples, que es lo que usa el resto del repositorio. */
const cita = texto => `'${texto.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function comoCodigo(opiniones) {
  const entradas = opiniones
    .map(opinion => {
      const lineas = [
        `    autor: ${cita(opinion.autor)},`,
        `    texto:`,
        `      ${cita(opinion.texto)},`,
        `    estrellas: ${opinion.estrellas},`,
      ];
      if (opinion.cuando) lineas.push(`    cuando: ${cita(opinion.cuando)},`);
      return `  {\n${lineas.join('\n')}\n  },`;
    })
    .join('\n');

  return `export const OPINIONES: Opinion[] = [\n${entradas}\n];\n`;
}

/**
 * Sustituye la lista y deja intacto todo lo demás.
 *
 * Se recorta desde `export const OPINIONES` hasta el final del archivo, porque
 * la lista es lo último que hay: así no hace falta contar corchetes ni
 * arriesgarse a cortar por un `];` que aparezca dentro del texto de una
 * reseña.
 */
async function escribir(opiniones, total) {
  const actual = await readFile(DESTINO, 'utf8');
  const corte = actual.indexOf('export const OPINIONES');
  if (corte === -1) {
    throw new Error(`no encontré OPINIONES en ${DESTINO}`);
  }

  let cabecera = actual.slice(0, corte);

  // La nota de «lista incompleta» deja de ser cierta en cuanto se importa.
  cabecera = cabecera.replace(
    /\n \* ESTA LISTA ESTÁ INCOMPLETA[\s\S]*?\n \*\/\n/,
    '\n * Las importa `scripts/importar-resenas.mjs` desde un volcado de la\n * ficha; no se escriben a mano salvo para corregir una que ya esté aquí.\n */\n'
  );

  if (Number.isFinite(total)) {
    cabecera = cabecera.replace(
      /total: undefined as number \| undefined,/,
      `total: ${total} as number | undefined,`
    );
  }

  await writeFile(DESTINO, cabecera + comoCodigo(opiniones), 'utf8');
}

/* ------------------------------------------------------------------ *
 * Programa
 * ------------------------------------------------------------------ */

async function volcadoDelBuzon() {
  const archivos = await readdir(BUZON);
  const candidato = archivos.find(nombre =>
    /^rese(n|ñ)as?\.(json|txt)$/i.test(nombre)
  );
  if (!candidato) {
    throw new Error(
      `deje resenas.json o resenas.txt en 📤SUBIR-CONTENIDO/ (hay: ${
        archivos.filter(a => a !== 'README.md').join(', ') || 'nada'
      })`
    );
  }

  const ruta = path.join(BUZON, candidato);
  const contenido = await readFile(ruta, 'utf8');
  const opiniones = candidato.toLowerCase().endsWith('.json')
    ? desdeJson(contenido)
    : desdeTexto(contenido);

  return { opiniones, ruta };
}

async function main() {
  const porPlaces = process.argv.includes('--places');

  let opiniones;
  let total;
  let ruta;

  if (porPlaces) {
    ({ opiniones, total } = await desdePlaces());
    console.log(
      'Aviso: la API de Places devuelve cinco reseñas como mucho. Es un tope\n' +
        'de Google. Para publicarlas todas hace falta el volcado; ver el README\n' +
        'de 📤SUBIR-CONTENIDO/.'
    );
  } else {
    ({ opiniones, ruta } = await volcadoDelBuzon());
  }

  if (opiniones.length === 0) {
    throw new Error('el volcado no traía ninguna reseña con autor y texto');
  }

  await escribir(opiniones, total);
  console.log(`Importadas ${opiniones.length} reseñas → ${DESTINO}`);

  // El buzón es una sala de espera, no un archivo: se vacía al terminar.
  if (ruta) {
    await rm(ruta);
    console.log(`Retirado del buzón: ${path.basename(ruta)}`);
  }

  console.log(
    'Corra `pnpm format:fix` y revise el resultado antes de subirlo.'
  );
}

main().catch(error => {
  console.error(`\n${error.message}\n`);
  process.exitCode = 1;
});
