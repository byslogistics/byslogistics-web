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
