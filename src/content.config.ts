// https://docs.astro.build/en/guides/content-collections/#defining-collections

import { defineCollection } from 'astro:content';
import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/** El `image()` que Astro inyecta en el schema de cada colección. */
type ImageFn = SchemaContext['image'];

/**
 * Campos de la FICHA de una referencia, compartidos por las dos colecciones
 * que tienen productos.
 *
 * POR QUÉ ESTÁ TODO OPCIONAL. Son 129 referencias y la información técnica se
 * levanta a mano, referencia por referencia. Si la plantilla exigiera specs,
 * medidas o ficha técnica, agregar el primer producto completo obligaría a
 * completar los 128 restantes el mismo día o el sitio no compilaría. Cada
 * bloque de la ficha se pinta solo cuando su dato existe, así que el catálogo
 * se puede ir llenando de a poco sin dejar una página a medias por el camino.
 *
 * POR QUÉ `specs` ES UNA LISTA Y NO UNAS COLUMNAS FIJAS. Material, longitud y
 * tipo de cierre describen un precinto; una tula pide capacidad, tela y tipo
 * de cremallera. Con columnas fijas, la ficha de la tula saldría con media
 * tabla vacía y sin dónde poner lo suyo. Cada referencia declara los atributos
 * que le aplican, en el orden en que quiere enseñarlos.
 */
const fichaDeProducto = (image: ImageFn) => ({
  /** Última parte de la URL. Sin él se deriva del nombre. */
  slug: z.string().optional(),
  /** "Más vendido", "Personalizable"… */
  badges: z.array(z.string()).default([]),
  /** Fotos adicionales. La principal sigue siendo `image`. */
  galeria: z
    .array(z.object({ src: image(), alt: z.string().optional() }))
    .default([]),
  specs: z
    .array(z.object({ etiqueta: z.string(), valor: z.string() }))
    .default([]),
  medidas: z
    .object({
      imagen: image().optional(),
      imagenAlt: z.string().optional(),
      valores: z
        .array(z.object({ etiqueta: z.string(), valor: z.string() }))
        .default([]),
    })
    .optional(),
  /**
   * `hex` es opcional: sin él se pinta el nombre del color como etiqueta en
   * vez de un círculo. Un círculo gris para "rojo" confunde más que un texto.
   */
  colores: z
    .array(z.object({ nombre: z.string(), hex: z.string().optional() }))
    .default([]),
  notaColores: z.string().optional(),
  personalizacion: z.array(z.string()).default([]),
  notaPersonalizacion: z.string().optional(),
  /** Cantidad mínima de pedido. */
  moq: z
    .object({ unidades: z.number(), nota: z.string().optional() })
    .optional(),
  usos: z.array(z.string()).default([]),
  sectores: z.array(z.string()).default([]),
  /** Si va vacío, la ficha hereda los pasos de su categoría. */
  comoSeUsa: z
    .array(z.object({ titulo: z.string(), texto: z.string() }))
    .default([]),
  presentacion: z.array(z.string()).default([]),
  notaPresentacion: z.string().optional(),
  /**
   * Ruta del PDF dentro de /public. Sin archivo, el bloque de descarga no se
   * pinta: vale más que no esté a que esté y no abra.
   */
  fichaTecnica: z.string().optional(),
  /** Se suman a las de la categoría, no las reemplazan. */
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
});

/**
 * Lo que una categoría presta a TODAS sus referencias.
 *
 * Casi todo lo que enseña una ficha es igual en las seis referencias de correa
 * dentada: los colores, la personalización, la cantidad mínima, los usos, los
 * sectores, la presentación y cómo se instala. Lo propio de cada referencia
 * son dos o tres números. Escribir lo común una vez por categoría es lo que
 * permite que las 115 fichas se vean completas sin escribir 115 veces lo
 * mismo —ni tener que corregirlo 115 veces cuando cambie.
 *
 * Cada campo se puede sobreescribir en la referencia. Ver `resolverFicha` en
 * `src/utils/catalog.ts` para cómo se mezclan.
 */
const defectosDeCategoria = (image: ImageFn) => ({
  beneficios: z
    .array(
      z.object({
        titulo: z.string(),
        texto: z.string().optional(),
        /** Nombre de un icono de src/components/ui/icons/icons.ts */
        icon: z.string().optional(),
      })
    )
    .default([]),
  comoSeUsa: z
    .array(z.object({ titulo: z.string(), texto: z.string() }))
    .default([]),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
  /**
   * La PLANTILLA de especificaciones de la categoría: qué atributos enseña y
   * en qué orden.
   *
   * `valor` es opcional aquí y solo aquí. Un atributo que vale lo mismo en
   * toda la categoría —el material, el tipo de cierre, la temperatura de
   * trabajo— se escribe una vez con su valor. Uno que cambia en cada
   * referencia —la longitud, la resistencia— se declara sin valor: la fila
   * aparece igual, y cada referencia pone el suyo. Mientras no lo ponga, la
   * ficha invita a consultarlo en vez de inventarlo.
   */
  specs: z
    .array(z.object({ etiqueta: z.string(), valor: z.string().optional() }))
    .default([]),
  medidas: z
    .object({
      imagen: image().optional(),
      imagenAlt: z.string().optional(),
      valores: z
        .array(z.object({ etiqueta: z.string(), valor: z.string().optional() }))
        .default([]),
    })
    .optional(),
  colores: z
    .array(z.object({ nombre: z.string(), hex: z.string().optional() }))
    .default([]),
  notaColores: z.string().optional(),
  personalizacion: z.array(z.string()).default([]),
  notaPersonalizacion: z.string().optional(),
  moq: z
    .object({ unidades: z.number(), nota: z.string().optional() })
    .optional(),
  usos: z.array(z.string()).default([]),
  sectores: z.array(z.string()).default([]),
  presentacion: z.array(z.string()).default([]),
  notaPresentacion: z.string().optional(),
});

/**
 * Familias de producto ("Nuestras Soluciones"): precintos de seguridad,
 * etiquetas y cintas, tulas y bolsas, cajas de seguridad.
 * Cada archivo en src/content/soluciones/ genera su propia página en
 * /productos/<id>.
 */
const solucionesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/soluciones',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Resumen corto: se usa en la tarjeta del listado y en la metadescripción
      description: z.string(),
      // Orden de aparición en /productos
      order: z.number(),
      // Nombre de un icono de src/components/ui/icons/icons.ts
      icon: z.string(),
      // Imagen de portada. Opcional mientras falte el material fotográfico.
      cardImage: image().optional(),
      cardImageAlt: z.string().optional(),
      // Puntos destacados que se listan en la página de la familia
      highlights: z.array(z.string()).default([]),
      // Si la familia tiene su propio índice de categorías (los precintos),
      // se enlaza ahí en lugar de listar las referencias en esta página.
      catalogUrl: z.string().optional(),
      catalogLabel: z.string().optional(),
      // Referencias agrupadas por subtipo. Los precios no se publican: el
      // listado del Excel es administrativo.
      //
      // La foto va en el GRUPO y no en cada referencia porque así son las
      // fotos que existen: una por tipo de producto, no una por medida. Las
      // nueve bolsas courier se diferencian en centímetros, y fotografiar cada
      // una daría nueve veces la misma imagen.
      groups: z
        .array(
          z.object({
            name: z.string(),
            image: image().optional(),
            imageAlt: z.string().optional(),
            ...defectosDeCategoria(image),
            products: z.array(
              z.object({
                name: z.string(),
                description: z.string().optional(),
                // La foto propia de la referencia; sin ella hereda la del
                // grupo, que es como están hechas las fotos del catálogo.
                image: image().optional(),
                imageAlt: z.string().optional(),
                ...fichaDeProducto(image),
              })
            ),
          })
        )
        .default([]),
    }),
});

/**
 * Categorías de precintos (de botella, de guaya, plásticos…).
 * Cada archivo en src/content/precintos/ genera su propia página en
 * /precintos/<id>.
 */
const precintosCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/precintos',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      order: z.number(),
      cardImage: image().optional(),
      cardImageAlt: z.string().optional(),
      ...defectosDeCategoria(image),
      // Referencias del catálogo. `code` es la referencia comercial.
      products: z
        .array(
          z.object({
            name: z.string(),
            code: z.string().optional(),
            description: z.string().optional(),
            image: image().optional(),
            // Descripción de la foto. Sin ella, la ficha repite el nombre de
            // la referencia, que en un listado de medidas dice bastante menos
            // que "precinto de guaya con cuerpo metálico azul".
            imageAlt: z.string().optional(),
            ...fichaDeProducto(image),
          })
        )
        .default([]),
    }),
});

/**
 * Guías de uso: un artículo por aplicación real de los productos (asegurar un
 * contenedor, precintar un carrotanque, transportar valores…).
 *
 * Cada archivo en src/content/usos/ genera su propia página en /usos/<id>.
 *
 * POR QUÉ EXISTEN. Las páginas de producto responden a quien ya sabe qué
 * quiere: busca "precinto de guaya" y llega. Estas responden a quien tiene el
 * problema pero no el nombre del producto —"cómo asegurar la puerta de un
 * contenedor", "qué precinto va en un carrotanque"—, que es la mayor parte de
 * quien busca. Cada guía termina llevando a la referencia que corresponde.
 */
const usosCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/usos',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Se usa como metadescripción, así que conviene que quepa en 160. */
      description: z.string(),
      order: z.number(),
      /** Sector al que pertenece la aplicación, para agrupar en el índice. */
      sector: z.string(),
      /**
       * Cuándo se revisó por última vez.
       *
       * NO es la fecha de publicación, y la diferencia importa. Una guía no
       * caduca: se revisa. Publicarla como `dateModified` le dice al buscador
       * que el contenido sigue vigente sin tener que escribir una página nueva
       * —que empezaría de cero— y sin ponerle a la actual una fecha que la haga
       * parecer vieja el año que viene.
       */
      actualizado: z.coerce.date().optional(),
      /** Resumen de una línea para la tarjeta del índice. */
      summary: z.string(),
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      /** Productos recomendados, con su enlace al catálogo. */
      productos: z
        .array(
          z.object({
            name: z.string(),
            url: z.string(),
            note: z.string().optional(),
            image: image().optional(),
            imageAlt: z.string().optional(),
          })
        )
        .default([]),
      /**
       * Preguntas frecuentes de la guía. Se publican también como datos
       * estructurados FAQPage: es lo que permite que la respuesta salga en el
       * buscador sin que nadie entre a la página, que para una consulta corta
       * es exactamente lo que queremos.
       */
      faq: z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .default([]),
      /** Guías relacionadas, por id. */
      relacionados: z.array(z.string()).default([]),
    }),
});

/**
 * Preguntas frecuentes con página propia, agrupadas por familia.
 *
 * Cada archivo en src/content/preguntas/<familia>/ genera su propia página en
 * /preguntas/<familia>/<pregunta>.
 *
 * POR QUÉ TIENEN PÁGINA PROPIA Y NO SON UN RENGLÓN MÁS DE /faq. Son las
 * respuestas largas que escribió la dueña, y responden a una búsqueda concreta
 * cada una: quien escribe «qué es un bolt seal» quiere una página sobre eso, no
 * un acordeón con otras cuarenta preguntas. /faq se queda con la respuesta
 * corta y enlaza aquí; las dos se necesitan y no compiten.
 *
 * POR QUÉ NO LLEVAN FECHA DE PUBLICACIÓN. Este material no envejece: qué es la
 * norma ISO/PAS 17712 valdrá lo mismo dentro de tres años. Una fecha visible
 * solo conseguiría que pareciera viejo. Lo que sí llevan es `actualizado`, que
 * es otra cosa —ver la nota en la colección de usos.
 */
const preguntasCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/preguntas',
  }),
  schema: () =>
    z.object({
      title: z.string(),
      /**
       * El `<title>` de la pestaña y del resultado de búsqueda, cuando la
       * pregunta entera no cabe.
       *
       * `title` es la pregunta tal como la escribió la dueña: encabeza la
       * página y es lo que se publica como FAQPage, así que ahí va completa.
       * Pero un buscador solo enseña unos sesenta caracteres del título, y
       * varias de estas preguntas pasan de cien: publicadas enteras se cortan
       * justo donde estaba la palabra que importaba. Aquí va el núcleo.
       */
      tituloSeo: z.string().optional(),
      /** Metadescripción. Conviene que quepa en 160 caracteres. */
      description: z.string(),
      /** Familia a la que pertenece; ver FAMILIAS en src/data_files/preguntas.ts. */
      familia: z.string(),
      /** Orden dentro de su familia. */
      order: z.number(),
      actualizado: z.coerce.date().optional(),
      /**
       * Las líneas de producto de las que habla, por su URL.
       *
       * De aquí salen LOS DOS SENTIDOS del enlace: el bloque «productos
       * relacionados» de esta página y el bloque «preguntas frecuentes» de la
       * página de esa línea (ver `preguntasPorCategoria` en utils/preguntas.ts).
       * Declararlo una vez y derivar el resto es lo que evita que las dos
       * listas se desincronicen, que es lo que siempre termina pasando cuando
       * se mantienen a mano.
       */
      categorias: z.array(z.string()).default([]),
      /** Guías de /usos que amplían el tema, por su id. */
      guias: z.array(z.string()).default([]),
      /** Otras preguntas de la misma familia, por su nombre de archivo. */
      relacionadas: z.array(z.string()).default([]),
    }),
});

/**
 * Novedades: lo único del sitio que sí lleva fecha.
 *
 * Aquí va lo que caduca —un cambio en lo que exigen las navieras, una
 * certificación nueva, una referencia que entra al catálogo— y por eso la fecha
 * se publica: saber que algo es de hace dos años cambia cómo se lee.
 *
 * DEBE SER LA SECCIÓN MÁS PEQUEÑA DEL SITIO. Si crece más que las guías o las
 * preguntas, es señal de que se está publicando como noticia algo que debería
 * ser una guía —y una guía se actualiza y conserva su posición, mientras que
 * una noticia se hunde sola en cuanto se publica la siguiente.
 */
const novedadesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/novedades',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      /** Fecha de publicación. Aquí sí se enseña. */
      fecha: z.coerce.date(),
      /** Una línea para la tarjeta del listado. */
      resumen: z.string(),
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      /** Líneas de producto que toca, por su URL. */
      categorias: z.array(z.string()).default([]),
    }),
});

export const collections = {
  soluciones: solucionesCollection,
  precintos: precintosCollection,
  usos: usosCollection,
  preguntas: preguntasCollection,
  novedades: novedadesCollection,
};
