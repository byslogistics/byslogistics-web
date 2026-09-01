/**
 * Las seis familias en las que se agrupan las preguntas frecuentes.
 *
 * Salen del documento de preguntas que escribió la dueña, que ya venía
 * organizado así. Cada familia tiene su índice en /preguntas/<id> y agrupa las
 * preguntas de su archivo de contenido.
 *
 * POR QUÉ VIVE AQUÍ Y NO EN EL FRONTMATTER DE CADA PREGUNTA. El título y la
 * descripción de una familia son de la familia, no de sus preguntas: escribirlos
 * en cada archivo serían sesenta copias del mismo párrafo y sesenta sitios donde
 * corregirlo. Cada pregunta solo declara a qué familia pertenece.
 */
export interface Familia {
  id: string;
  /** Título de la página índice de la familia. */
  title: string;
  /** Metadescripción del índice, y bajada de la tarjeta en /preguntas. */
  description: string;
  /** Orden en el índice general. */
  order: number;
  /**
   * Las líneas de producto de la familia, por su URL.
   *
   * Es el destino natural de quien termina de leer: se enseñan en el índice de
   * la familia, y son las mismas que cada pregunta puede afinar por su cuenta.
   */
  categorias: string[];
}

export const FAMILIAS: Familia[] = [
  {
    id: 'precintos-de-seguridad',
    title: 'Precintos de seguridad',
    description:
      'Qué son, para qué sirven, qué tipos existen y cómo elegir el adecuado para cada operación.',
    order: 1,
    categorias: ['/productos/precintos-de-seguridad'],
  },
  {
    id: 'precintos-botella',
    title: 'Precintos botella y contenedores',
    description:
      'Bolt seals, norma ISO/PAS 17712 y qué exigen las navieras y las autoridades aduaneras.',
    order: 2,
    categorias: ['/precintos/precintos-de-botella'],
  },
  {
    id: 'precintos-plasticos',
    title: 'Precintos plásticos',
    description:
      'Cómo funcionan los sellos plásticos, qué industrias los usan y cómo elegir la referencia correcta.',
    order: 3,
    categorias: [
      '/precintos/precintos-de-correa-dentada',
      '/precintos/precintos-de-ancla',
    ],
  },
  {
    id: 'precintos-de-guaya',
    title: 'Precintos de cable o guaya',
    description:
      'Cuándo conviene una guaya en lugar de un plástico, qué resistencia ofrece y dónde se utiliza.',
    order: 4,
    categorias: [
      '/precintos/precintos-de-guaya',
      '/precintos/precintos-rotor-y-tornillo',
    ],
  },
  {
    id: 'precintos-electronicos',
    title: 'Precintos electrónicos y rastreo',
    description:
      'Monitoreo satelital de la carga: qué eventos detectan, cuándo se justifican y cómo elegirlos.',
    order: 5,
    categorias: ['/productos/rastreo-satelital'],
  },
  {
    id: 'etiquetas-y-cintas',
    title: 'Etiquetas y cintas de seguridad',
    description:
      'VOID, OPENED, No Transfer, cáscara de huevo y holográficas: qué evidencia cada una y cuándo usarla.',
    order: 6,
    categorias: ['/productos/etiquetas-y-cintas-de-seguridad'],
  },
];

export const FAMILIA_POR_ID = new Map(FAMILIAS.map(f => [f.id, f]));
