import { getCollection, type CollectionEntry } from 'astro:content';

import { FAMILIA_POR_ID, type Familia } from '@data/preguntas';

/**
 * Acceso a las preguntas frecuentes con página propia, y el enlace inverso
 * hacia las líneas de producto.
 *
 * LA PIEZA QUE IMPORTA ES `preguntasPorCategoria`. Cada pregunta declara de qué
 * líneas habla; de esa única lista salen los DOS sentidos del enlace: el bloque
 * «productos relacionados» al pie del artículo y el bloque «preguntas
 * frecuentes» de la página de la línea. Mantener las dos listas a mano termina
 * siempre igual —una se queda vieja y nadie se entera—, y aquí no puede pasar
 * porque la segunda se deriva de la primera en cada build.
 *
 * Ese enlace no es decoración: es lo que lleva a quien buscó «qué es un bolt
 * seal» hasta la ficha del precinto botella, y lo que reparte hacia el catálogo
 * la autoridad que ganen los artículos.
 */

export interface Pregunta {
  /** `<familia>/<archivo>`, tal como lo entrega la colección. */
  id: string;
  /** Última parte de la URL. */
  slug: string;
  familia: Familia;
  title: string;
  description: string;
  url: string;
  order: number;
  actualizado?: Date;
  /** URLs de las líneas de producto de las que habla. */
  categorias: string[];
  /** Ids de guías de /usos que amplían el tema. */
  guias: string[];
  /** Nombres de archivo de otras preguntas de su familia. */
  relacionadas: string[];
  entrada: CollectionEntry<'preguntas'>;
}

/** Una línea de producto a la que una pregunta puede enlazar. */
export interface Categoria {
  url: string;
  nombre: string;
  descripcion: string;
  imagen?: ImageMetadata;
  imagenAlt?: string;
}

function aPregunta(entrada: CollectionEntry<'preguntas'>): Pregunta | null {
  const familia = FAMILIA_POR_ID.get(entrada.data.familia);
  // Una pregunta cuya familia no existe no se publica a medias: se omite. El
  // test de contenido comprueba que no haya ninguna en ese estado, así que
  // esto no puede pasar sin que alguien se entere.
  if (!familia) return null;

  const slug = entrada.id.split('/').pop()!;
  return {
    id: entrada.id,
    slug,
    familia,
    title: entrada.data.title,
    description: entrada.data.description,
    url: `/preguntas/${familia.id}/${slug}`,
    order: entrada.data.order,
    actualizado: entrada.data.actualizado,
    categorias: entrada.data.categorias,
    guias: entrada.data.guias,
    relacionadas: entrada.data.relacionadas,
    entrada,
  };
}

/** Todas las preguntas, ordenadas por familia y luego por su propio orden. */
export async function getPreguntas(): Promise<Pregunta[]> {
  const entradas = await getCollection('preguntas');
  return entradas
    .map(aPregunta)
    .filter((p): p is Pregunta => p !== null)
    .sort((a, b) => a.familia.order - b.familia.order || a.order - b.order);
}

/** Las preguntas de cada familia, en el orden en que se publican. */
export async function getPreguntasPorFamilia(): Promise<
  Map<string, Pregunta[]>
> {
  const salida = new Map<string, Pregunta[]>();
  for (const pregunta of await getPreguntas()) {
    const lista = salida.get(pregunta.familia.id);
    if (lista) lista.push(pregunta);
    else salida.set(pregunta.familia.id, [pregunta]);
  }
  return salida;
}

/**
 * Las líneas de producto del sitio, indexadas por su URL.
 *
 * Se leen de las mismas colecciones que las renderizan, así que el nombre y la
 * foto que enseña una pregunta son los que enseña la propia línea. Una lista
 * escrita aparte se desincronizaría el día que alguien renombre una categoría.
 */
export async function getCategorias(): Promise<Map<string, Categoria>> {
  const salida = new Map<string, Categoria>();

  for (const entrada of await getCollection('precintos')) {
    salida.set(`/precintos/${entrada.id}`, {
      url: `/precintos/${entrada.id}`,
      nombre: entrada.data.title,
      descripcion: entrada.data.description,
      imagen: entrada.data.cardImage,
      imagenAlt: entrada.data.cardImageAlt,
    });
  }

  for (const entrada of await getCollection('soluciones')) {
    salida.set(`/productos/${entrada.id}`, {
      url: `/productos/${entrada.id}`,
      nombre: entrada.data.title,
      descripcion: entrada.data.description,
      imagen: entrada.data.cardImage,
      imagenAlt: entrada.data.cardImageAlt,
    });
  }

  return salida;
}

/**
 * EL ENLACE INVERSO: qué preguntas hablan de cada línea de producto.
 *
 * Lo consume la página de cada categoría para pintar su bloque de preguntas
 * frecuentes, sin que nadie tenga que mantener esa lista.
 */
export async function preguntasPorCategoria(): Promise<
  Map<string, Pregunta[]>
> {
  const salida = new Map<string, Pregunta[]>();
  for (const pregunta of await getPreguntas()) {
    for (const url of pregunta.categorias) {
      const lista = salida.get(url);
      if (lista) lista.push(pregunta);
      else salida.set(url, [pregunta]);
    }
  }
  return salida;
}
