/**
 * Helpers de texto sin dependencias del servidor, para que puedan usarse tanto
 * al construir las páginas como en los scripts del navegador.
 */
import { SINONIMOS } from '@data/sinonimos';

/** Quita tildes y pasa a minúscula, para que "botella" encuentre "Botellá". */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Una sola expresión con todo lo que hay que reemplazar, y el diccionario
 * plano para consultarlo.
 *
 * Las claves más largas van primero para que «sello plastico» se reconozca
 * entero antes de que «sello» se lo lleve por delante. Y van entre `\b`
 * porque sin eso «saco» reemplazaría dentro de «buscador».
 */
const REEMPLAZOS = new Map(
  SINONIMOS.flatMap(({ busca, escribe }) =>
    escribe.map(palabra => [palabra, busca] as const)
  )
);

const EXPRESION = new RegExp(
  `\\b(?:${[...REEMPLAZOS.keys()]
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'g'
);

export interface Sustitucion {
  /** Lo que se escribió. */
  escrito: string;
  /** Cómo lo llama el catálogo. */
  catalogo: string;
}

/**
 * Traduce lo escrito al vocabulario del catálogo.
 *
 * Recibe lo tecleado tal cual y devuelve el texto normalizado con el que hay
 * que buscar de verdad, más la lista de lo que se cambió, para que el catálogo
 * pueda decir en pantalla qué término usó.
 *
 * Quien busca «sello» recibe los precintos, y de paso se entera de que aquí se
 * llaman precintos. Ver [sinonimos.ts](../data_files/sinonimos.ts).
 */
export function traducirBusqueda(escrito: string): {
  termino: string;
  cambios: Sustitucion[];
} {
  const normalizado = normalize(escrito);
  const cambios: Sustitucion[] = [];

  const termino = normalizado.replace(
    EXPRESION,
    (fragmento: string, indice: number) => {
      const catalogo = REEMPLAZOS.get(fragmento) ?? fragmento;

      /*
       * El aviso enseña la palabra CON sus tildes, no la normalizada: quien
       * escribió «candado plástico» no tiene por qué verla devuelta mal
       * escrita. Quitar una tilde no cambia el número de letras, así que las
       * posiciones de lo normalizado sirven para recortar lo tecleado. La
       * comprobación de longitud es por si algún día entra un carácter que sí
       * las cambie —una ligadura pegada de un copiar y pegar—: entonces se
       * enseña la versión normalizada, que es fea pero nunca es falsa.
       */
      const comoSeEscribio =
        normalizado.length === escrito.length
          ? escrito.slice(indice, indice + fragmento.length)
          : fragmento;

      if (!cambios.some(cambio => cambio.escrito === comoSeEscribio)) {
        cambios.push({ escrito: comoSeEscribio, catalogo });
      }
      return catalogo;
    }
  );

  return { termino, cambios };
}

/**
 * Palabras con las que una metadescripción no puede terminar: cortar en «de»
 * o en «para» deja la frase colgando y se lee como si la página estuviera rota.
 */
const COLGANTES = new Set([
  'a',
  'al',
  'ante',
  'bajo',
  'con',
  'contra',
  'de',
  'del',
  'desde',
  'donde',
  'durante',
  'en',
  'entre',
  'hacia',
  'hasta',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'que',
  'se',
  'segun',
  'sin',
  'sobre',
  'su',
  'sus',
  'tras',
  'un',
  'una',
  'y',
  'e',
  'como',
  'cuando',
  'mediante',
]);

/**
 * Recorta un texto a lo que un buscador llega a mostrar.
 *
 * Google corta la metadescripción alrededor de los 160 caracteres, y las
 * descripciones del catálogo comercial son párrafos de trescientos o
 * cuatrocientos: publicadas enteras salen cortadas a media palabra en los
 * resultados, que es peor que una frase más corta y completa.
 *
 * Se corta en una palabra con contenido y se cierra con puntos suspensivos
 * solo si de verdad quedó algo fuera.
 */
export function recortar(texto: string, limite = 160): string {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (limpio.length <= limite) return limpio;

  /*
   * Cortar en un punto se lee mejor que cortar a media frase, así que se cogen
   * frases enteras mientras quepan. Pero solo sirve si con eso se llena la
   * metadescripción: parar en el PRIMER punto devolvía «Precinto o sello de
   * seguridad de guaya Ref.» —el punto de la abreviatura, no el de la frase—
   * en las cinco fichas de guaya, y «Cinta de Seguridad VOID 50 m x 5 cm.» en
   * las que llevan el nombre delante. Por debajo del mínimo se prefiere
   * recortar por palabras, que al menos dice algo.
   */
  const minimo = Math.round(limite * 0.55);
  let frases = '';
  for (const frase of limpio.split(/(?<=\.)\s/)) {
    const candidato = frases ? `${frases} ${frase}` : frase;
    if (candidato.length > limite) break;
    frases = candidato;
  }
  if (frases.length >= minimo) return frases;

  const palabras = limpio
    .slice(0, limite - 1)
    .split(' ')
    .slice(0, -1);
  while (
    palabras.length > 1 &&
    COLGANTES.has(
      normalize(palabras[palabras.length - 1]).replace(/[.,;:]/g, '')
    )
  ) {
    palabras.pop();
  }
  return palabras.join(' ').replace(/[.,;:]$/, '') + '…';
}
