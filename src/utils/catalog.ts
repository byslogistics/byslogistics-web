import { getCollection } from 'astro:content';
import { normalize, recortar, slugify } from '@utils/text';
import { FICHA_POR_FAMILIA } from '@data/fichas';
import { SITE } from '@data/constants';

/**
 * Aplana las dos colecciones de contenido en una sola lista de referencias.
 *
 * De aquí comen tres cosas: el catálogo con filtros de /catalogo, la ficha
 * individual de cada referencia y el bloque de productos relacionados. Un
 * único recorrido para las tres, porque cada uno por su lado era la forma
 * segura de que la URL de una referencia dijera una cosa en el catálogo y otra
 * en su propia página.
 */

export interface FichaSpec {
  etiqueta: string;
  /**
   * Ausente cuando la categoría declara el atributo pero la referencia
   * todavía no tiene su número. La plantilla lo pinta como "Consúltenos": la
   * fila se ve, y nadie confunde un hueco con un dato.
   */
  valor?: string;
}

export interface FichaPaso {
  titulo: string;
  texto: string;
}

export interface FichaFaq {
  question: string;
  answer: string;
}

export interface FichaBeneficio {
  titulo: string;
  texto?: string;
  icon?: string;
}

/**
 * La información de la página de producto, ya resuelta: lo que trae la
 * referencia, más lo que hereda de su categoría.
 *
 * Se resuelve aquí y no en la plantilla para que la plantilla no tenga que
 * saber de dónde salió cada cosa. Cada campo puede venir vacío —la ficha se
 * llena referencia por referencia— y la plantilla oculta el bloque que no
 * tenga datos.
 */
export interface Ficha {
  badges: string[];
  galeria: Array<{ src: ImageMetadata; alt?: string }>;
  specs: FichaSpec[];
  medidas?: {
    imagen?: ImageMetadata;
    imagenAlt?: string;
    valores: FichaSpec[];
  };
  colores: Array<{ nombre: string; hex?: string }>;
  notaColores?: string;
  personalizacion: string[];
  notaPersonalizacion?: string;
  moq?: { unidades: number; nota?: string };
  usos: string[];
  sectores: string[];
  /** Propios si los tiene; si no, los de la categoría. */
  comoSeUsa: FichaPaso[];
  presentacion: string[];
  notaPresentacion?: string;
  fichaTecnica?: string;
  /** Las de la categoría primero, después las propias. */
  faq: FichaFaq[];
  beneficios: FichaBeneficio[];
}

export interface Referencia {
  /**
   * Identificador global, el que usa el cotizador para no mezclar dos
   * referencias que se llaman igual en categorías distintas.
   */
  id: string;
  /** Última parte de la URL, única dentro de su categoría. */
  slug: string;
  name: string;
  code?: string;
  description?: string;
  family: string;
  familyId: string;
  group: string;
  groupId: string;
  /** Página de la categoría a la que pertenece. */
  groupUrl: string;
  /** Su propia página de producto. */
  url: string;
  /**
   * Fotografía de la referencia.
   *
   * Las fotos que existen son una por tipo de producto, no una por medida: las
   * nueve bolsas courier se diferencian en centímetros, y fotografiar cada una
   * daría nueve veces la misma imagen. Por eso, cuando la referencia no trae
   * foto propia, hereda la de SU grupo o categoría —que sí la retrata— y nunca
   * la de la familia entera, que enseñaría una tula en la ficha de un
   * protector de guía.
   */
  image?: ImageMetadata;
  imageAlt?: string;
  ficha: Ficha;
  /**
   * Todo lo que el buscador del catálogo puede encontrar de esta referencia
   * —nombre, código, descripción, categoría y familia—, sin tildes y en
   * minúscula.
   */
  search: string;
  /**
   * La descripción que se publica en la etiqueta `<meta>`, ya recortada y
   * distinta de la de cualquier otra referencia.
   *
   * No es `description`: esa es el párrafo entero que se lee en la ficha, de
   * trescientos o cuatrocientos caracteres. Se calcula aquí y no en la
   * plantilla porque hacerla ÚNICA exige ver el catálogo completo —hay
   * descripciones que la dueña escribió una vez para las dieciséis medidas de
   * una etiqueta—, y una plantilla solo ve su propia referencia.
   */
  metaDescription: string;
}

/** Lo que el catálogo con filtros necesita de cada referencia. */
export type CatalogItem = Omit<
  Referencia,
  'ficha' | 'groupUrl' | 'metaDescription'
>;

export interface CatalogFacet {
  id: string;
  name: string;
  count: number;
  /** Solo en grupos: la familia a la que pertenecen */
  familyId?: string;
}

/** Lo que una categoría (o una familia) le presta a sus referencias. */
interface Defectos {
  beneficios?: FichaBeneficio[];
  comoSeUsa?: FichaPaso[];
  faq?: FichaFaq[];
  specs?: FichaSpec[];
  medidas?: {
    imagen?: ImageMetadata;
    imagenAlt?: string;
    valores: FichaSpec[];
  };
  colores?: Array<{ nombre: string; hex?: string }>;
  notaColores?: string;
  personalizacion?: string[];
  notaPersonalizacion?: string;
  moq?: { unidades: number; nota?: string };
  usos?: string[];
  sectores?: string[];
  presentacion?: string[];
  notaPresentacion?: string;
}

/**
 * Mezcla la plantilla de atributos de la categoría con los valores de la
 * referencia, EMPAREJANDO POR ETIQUETA.
 *
 * La categoría manda el orden y qué filas se ven; la referencia solo pone los
 * valores que son suyos. Así "Longitud total" ocupa el mismo lugar en las seis
 * fichas de una categoría, tenga o no su número todavía, y una referencia
 * puede añadir un atributo que las demás no tienen sin descolocar nada.
 */
function mezclarSpecs(
  plantilla: FichaSpec[] = [],
  propios: FichaSpec[] = []
): FichaSpec[] {
  const porEtiqueta = new Map(propios.map(spec => [spec.etiqueta, spec]));
  const salida = plantilla.map(fila => porEtiqueta.get(fila.etiqueta) ?? fila);
  const yaPuestas = new Set(plantilla.map(fila => fila.etiqueta));
  return [...salida, ...propios.filter(spec => !yaPuestas.has(spec.etiqueta))];
}

/** El primero que traiga algo. Sirve para listas y para textos sueltos. */
const primero = <T>(...candidatos: Array<T | undefined>): T | undefined =>
  candidatos.find(
    valor => valor !== undefined && (!Array.isArray(valor) || valor.length > 0)
  );

/**
 * Junta lo de la referencia con lo de su categoría y lo de su familia.
 */
function resolverFicha(
  producto: any,
  categoria: Defectos,
  familiaId: string
): Ficha {
  const familia: Defectos = FICHA_POR_FAMILIA[familiaId] ?? {};

  /*
   * Orden de precedencia, de más específico a más general:
   *
   *   la referencia  →  su categoría  →  su familia
   *
   * Se reemplaza, no se acumula: si una referencia declara sus colores, son
   * ESOS y no los suyos más los de la categoría. La única excepción son las
   * preguntas frecuentes, que sí se suman —las de la familia siguen valiendo
   * y la referencia solo agrega las que le son propias.
   */
  const medidasPlantilla = primero(categoria.medidas, familia.medidas);

  return {
    badges: producto.badges ?? [],
    galeria: producto.galeria ?? [],
    specs: mezclarSpecs(
      primero(categoria.specs, familia.specs),
      producto.specs
    ),
    medidas:
      producto.medidas || medidasPlantilla
        ? {
            imagen: producto.medidas?.imagen ?? medidasPlantilla?.imagen,
            imagenAlt:
              producto.medidas?.imagenAlt ?? medidasPlantilla?.imagenAlt,
            valores: mezclarSpecs(
              medidasPlantilla?.valores,
              producto.medidas?.valores
            ),
          }
        : undefined,
    colores:
      primero(producto.colores, categoria.colores, familia.colores) ?? [],
    notaColores: primero(
      producto.notaColores,
      categoria.notaColores,
      familia.notaColores
    ),
    personalizacion:
      primero(
        producto.personalizacion,
        categoria.personalizacion,
        familia.personalizacion
      ) ?? [],
    notaPersonalizacion: primero(
      producto.notaPersonalizacion,
      categoria.notaPersonalizacion,
      familia.notaPersonalizacion
    ),
    moq: primero(producto.moq, categoria.moq, familia.moq),
    usos: primero(producto.usos, categoria.usos, familia.usos) ?? [],
    sectores:
      primero(producto.sectores, categoria.sectores, familia.sectores) ?? [],
    comoSeUsa:
      primero(producto.comoSeUsa, categoria.comoSeUsa, familia.comoSeUsa) ?? [],
    presentacion:
      primero(
        producto.presentacion,
        categoria.presentacion,
        familia.presentacion
      ) ?? [],
    notaPresentacion: primero(
      producto.notaPresentacion,
      categoria.notaPresentacion,
      familia.notaPresentacion
    ),
    fichaTecnica: producto.fichaTecnica,
    faq: [
      ...(familia.faq ?? []),
      ...(categoria.faq ?? []),
      ...(producto.faq ?? []),
    ],
    beneficios: primero(categoria.beneficios, familia.beneficios) ?? [],
  };
}

/**
 * Escribe la metadescripción de cada referencia, ya recortada y sin repetirse.
 *
 * Dos motivos para hacerlo aquí y no en la plantilla de la ficha:
 *
 * 1. LARGO. La descripción comercial es el párrafo entero que se lee en la
 *    página —tres o cuatro líneas—, y un buscador solo enseña unos ciento
 *    sesenta caracteres: publicada tal cual sale cortada a media palabra en
 *    los resultados.
 * 2. REPETIDAS. La dueña escribió una sola descripción para las dieciséis
 *    medidas de la etiqueta holograma, y otra para las diez del precinto
 *    OPENED, que es lo correcto en el catálogo —son el mismo producto en
 *    distintos tamaños— pero deja dieciséis páginas diciéndole lo mismo al
 *    buscador. Cuando un texto le toca a más de una referencia, se le antepone
 *    el nombre, que es justo lo que las distingue.
 *
 * Ninguna de las dos cosas se puede resolver en la plantilla: una plantilla
 * solo ve su propia referencia y no sabe con quién comparte descripción.
 */
function ponerMetaDescripciones(referencias: Referencia[]): void {
  /*
   * La descripción sirve de metadescripción SOLO cuando es una frase. Algunas
   * referencias usan ese campo como nota suelta —«Caja por 5.000 unidades.»,
   * «Colores: amarillo, azul, rojo, verde y blanco.»—, que distingue una
   * medida de otra en un listado pero no le dice nada a quien la encuentra en
   * un buscador. Por debajo del mínimo se arma una frase con el nombre y la
   * categoría, que siempre dice algo.
   *
   * El mínimo son sesenta caracteres porque ahí está el corte real del
   * catálogo: las dos notas miden 24 y 46, y la descripción de verdad más
   * corta pasa de 75. Un buscador tampoco enseña de buena gana una
   * metadescripción de cuarenta caracteres.
   */
  const MINIMO_DESCRIPCION = 60;
  const base = referencias.map(referencia =>
    referencia.description &&
    referencia.description.length >= MINIMO_DESCRIPCION
      ? referencia.description
      : // Sin punto tras la razón social: ya termina en uno («S.A.S.») y se
        // veían dos seguidos.
        `${referencia.name}: referencia de ${referencia.group.toLowerCase()} de ${SITE.legalName} Consulte especificaciones y usos, y cotice en línea o por WhatsApp.`
  );

  const repetidas = new Set(
    base.filter((texto, i) => base.indexOf(texto) !== i)
  );

  referencias.forEach((referencia, i) => {
    const texto = base[i];
    const distinguible =
      repetidas.has(texto) && !texto.startsWith(referencia.name)
        ? `${referencia.name}. ${texto}`
        : texto;
    referencia.metaDescription = recortar(distinguible);
  });
}

/**
 * Todas las referencias del sitio, con su ficha resuelta y su URL propia.
 *
 * El slug se hace único DENTRO de su categoría, no del sitio entero: dos
 * referencias que se llaman igual en categorías distintas conviven sin
 * problema porque sus URLs ya se diferencian por la categoría, y arrastrar un
 * sufijo global haría que la URL de una referencia dependiera de si alguien
 * agregó otra en otra parte del catálogo.
 */
export async function getReferencias(): Promise<Referencia[]> {
  const referencias: Referencia[] = [];
  const idsUsados = new Set<string>();
  const slugsPorCategoria = new Map<string, Set<string>>();

  const unico = (usados: Set<string>, base: string) => {
    let valor = base;
    let n = 2;
    while (usados.has(valor)) valor = `${base}-${n++}`;
    usados.add(valor);
    return valor;
  };

  const push = (
    datos: Omit<
      Referencia,
      'id' | 'slug' | 'url' | 'search' | 'ficha' | 'metaDescription'
    >,
    producto: any,
    defectos: Defectos
  ) => {
    const id = unico(idsUsados, `${datos.groupId}--${slugify(datos.name)}`);

    let slugs = slugsPorCategoria.get(datos.groupUrl);
    if (!slugs) slugsPorCategoria.set(datos.groupUrl, (slugs = new Set()));
    const slug = unico(slugs, producto.slug ?? slugify(datos.name));

    referencias.push({
      ...datos,
      id,
      slug,
      url: `${datos.groupUrl}/${slug}`,
      ficha: resolverFicha(producto, defectos, datos.familyId),
      /*
       * Lo que el buscador del catálogo mira. Van también el código, la
       * categoría y la familia, no solo el nombre: quien escribe "guaya"
       * espera las ocho referencias de esa categoría, y varias de ellas no
       * llevan la palabra en su nombre. Sin esto, buscar por el nombre de la
       * categoría —que es como pregunta casi todo el mundo— devolvía menos
       * referencias que pulsar el filtro de esa misma categoría.
       */
      search: normalize(
        [datos.name, datos.code, datos.description, datos.group, datos.family]
          .filter(Boolean)
          .join(' ')
      ),
      // La pone `ponerMetaDescripciones` al final, cuando ya se puede ver
      // cuáles se repiten. Aquí todavía no hay con qué compararla.
      metaDescription: '',
    });
  };

  const soluciones = (await getCollection('soluciones')).sort(
    (a, b) => a.data.order - b.data.order
  );
  const precintos = (await getCollection('precintos')).sort(
    (a, b) => a.data.order - b.data.order
  );

  // Los precintos se agrupan por categoría, no por familia: la familia
  // "Precintos de Seguridad" delega su catálogo en /precintos.
  const familiaPrecintos = soluciones.find(s => s.data.catalogUrl);
  for (const categoria of precintos) {
    const defectos = categoria.data as Defectos;
    for (const product of categoria.data.products) {
      push(
        {
          name: product.name,
          code: product.code,
          description: product.description,
          family: familiaPrecintos?.data.title ?? 'Precintos de Seguridad',
          familyId: familiaPrecintos?.id ?? 'precintos-de-seguridad',
          group: categoria.data.title,
          groupId: categoria.id,
          groupUrl: `/precintos/${categoria.id}`,
          image: product.image ?? categoria.data.cardImage,
          imageAlt:
            product.imageAlt ??
            categoria.data.cardImageAlt ??
            categoria.data.title,
        },
        product,
        defectos
      );
    }
  }

  for (const familia of soluciones) {
    for (const group of familia.data.groups) {
      const defectos = group as Defectos;
      for (const product of group.products) {
        push(
          {
            name: product.name,
            description: product.description,
            family: familia.data.title,
            familyId: familia.id,
            group: group.name,
            groupId: `${familia.id}--${slugify(group.name)}`,
            groupUrl: `/productos/${familia.id}`,
            image: product.image ?? group.image,
            imageAlt: product.imageAlt ?? group.imageAlt ?? group.name,
          },
          product,
          defectos
        );
      }
    }
  }

  ponerMetaDescripciones(referencias);
  return referencias;
}

/**
 * Las rutas de ficha que le tocan a una base (`/precintos` o `/productos`),
 * con sus relacionados ya resueltos.
 *
 * Los relacionados salen de la MISMA categoría y no de la familia entera: al
 * pie de un precinto de correa dentada de 35 cm, lo útil es el de 39 y el de
 * doble cierre —las otras medidas del mismo producto—, no una tula de recaudo
 * que comparte con él poco más que el proveedor. Van cuatro: los que caben en
 * una fila sin que el pie de página se convierta en un segundo catálogo.
 */
export async function getRutasDeProducto(base: '/precintos' | '/productos') {
  const referencias = await getReferencias();

  return referencias
    .filter(referencia => referencia.groupUrl.startsWith(`${base}/`))
    .map(referencia => ({
      params: {
        id: referencia.groupUrl.slice(base.length + 1),
        producto: referencia.slug,
      },
      props: {
        referencia,
        relacionados: referencias
          .filter(
            otra =>
              otra.groupId === referencia.groupId && otra.id !== referencia.id
          )
          .slice(0, 4),
      },
    }));
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const referencias = await getReferencias();
  return referencias.map(
    ({
      ficha: _ficha,
      groupUrl: _groupUrl,
      metaDescription: _metaDescription,
      ...item
    }) => item
  );
}

/** Familias y grupos con su conteo, para pintar los filtros. */
export function getFacets(items: CatalogItem[]) {
  const families = new Map<string, CatalogFacet>();
  const groups = new Map<string, CatalogFacet>();

  for (const item of items) {
    const family = families.get(item.familyId);
    if (family) family.count++;
    else
      families.set(item.familyId, {
        id: item.familyId,
        name: item.family,
        count: 1,
      });

    const group = groups.get(item.groupId);
    if (group) group.count++;
    else
      groups.set(item.groupId, {
        id: item.groupId,
        name: item.group,
        count: 1,
        familyId: item.familyId,
      });
  }

  return {
    families: [...families.values()],
    groups: [...groups.values()],
  };
}
