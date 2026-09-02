/**
 * Las opiniones de clientes publicadas en Google.
 *
 * QUÉ ES ESTO Y QUÉ NO ES. Es una COPIA de lo que hay en la ficha de Google
 * Maps de la empresa, no una lista de testimonios de redacción propia. La
 * diferencia importa: cada tarjeta de la portada enlaza a la ficha real, y
 * cualquiera puede comprobar en dos clics que la reseña existe y quién la
 * escribió. Un testimonio que no se puede comprobar no convence a nadie que
 * esté decidiendo a quién comprarle.
 *
 * POR ESO AQUÍ NO SE ESCRIBE NADA QUE NO ESTÉ EN GOOGLE. Ni se retoca la
 * redacción, ni se corrigen las faltas, ni se recorta la parte menos
 * favorable: se copia y se pega, tal cual. Si una reseña se borra en Google,
 * se borra de aquí.
 *
 * CÓMO SE AÑADE UNA. Se abre la ficha (`GOOGLE.ficha`, más abajo), se copia la
 * reseña y se pega como un objeto más de `OPINIONES`. El orden del array es el
 * orden en que salen; no hace falta tocar nada más.
 *
 * POR QUÉ NO SE TRAEN SOLAS. Se podrían pedir en el momento a la API de Google
 * Places, y tendría dos costes que hoy no compensan: una clave de API que
 * habría que pagar y custodiar, y que la sección dependa de que un servicio
 * ajeno responda para poder pintarse —en un sitio estático que hoy no depende
 * de nada—. Con una decena de reseñas al año, copiarlas cuesta menos.
 */

export interface Opinion {
  /** Tal como lo publica Google. */
  autor: string;
  /** El texto de la reseña, sin retocar. */
  texto: string;
  /** De 1 a 5. */
  estrellas: number;
  /** Cómo lo muestra Google: «hace 2 meses», «hace un año». Opcional. */
  cuando?: string;
}

/**
 * La ficha de la empresa en Google y su puntuación.
 *
 * `total` es el número de reseñas que Google muestra en la ficha, y es
 * OPCIONAL a propósito: si no se sabe, se deja sin poner y la sección dice
 * «Opiniones en Google» en lugar de inventarse una cifra. Un número que no
 * cuadra con lo que se ve al abrir la ficha destruye justo la confianza que
 * esta sección viene a construir.
 */
export const GOOGLE = {
  /** El enlace corto de la ficha, tal como lo comparte Google Maps. */
  ficha: 'https://maps.app.goo.gl/fySH3qBxQq4eoj8h6',
  /** La puntuación media, de 1 a 5. */
  puntuacion: 5,
  /** Número de reseñas publicadas. Sin confirmar todavía: ver la nota. */
  total: undefined as number | undefined,
};

/**
 * Las reseñas, copiadas de la ficha.
 *
 * Las importa `scripts/importar-resenas.mjs` desde un volcado de la
 * ficha; no se escriben a mano salvo para corregir una que ya esté aquí.
 */
export const OPINIONES: Opinion[] = [
  {
    autor: 'Rafael Márquez',
    texto:
      'Excelente calidad de los precintos, la atención por parte del asesor de ventas es muy buena y la entrega del producto está dentro del tiempo establecido.',
    estrellas: 5,
  },
  {
    autor: 'CIGAS GNV Operaciones',
    texto:
      'Rápida atención y brindan información clara sobre los productos. Muy amables y educados. Recomendados 100%',
    estrellas: 5,
  },
  {
    autor: 'Daniel Molina',
    texto:
      'Su asesoría al momento de elegir el producto que mejor se adaptara a las necesidades de mi empresa, fue clave para el éxito de los procesos logísticos de mi negocio. Los recomiendo.',
    estrellas: 5,
  },
  {
    autor: 'Milton Contreras',
    texto:
      'Excelente el servicio y la mejor disposición para buscar la solución mas acertada que se acople a la necesidad del cliente.…',
    estrellas: 5,
  },
  {
    autor: 'Edward leon',
    texto:
      'Buenas tardes a quien le interese la empresa byslogisticsltda es una empresa sería y muy comprometida con los productos ke ofrece(presintos de seguridad)...son de muy buena calidad y el personal es muy amable muchas gracias byslogistics',
    estrellas: 5,
  },
  {
    autor: 'Laprea ́s Technologies',
    texto: 'Excelentes productos funcionales. Recomendados 100%.',
    estrellas: 5,
  },
  {
    autor: 'CRISTIAN ARIAS',
    texto: 'Muy buen servicio solo deben mejorar en los tiempos de envíos',
    estrellas: 5,
  },
  {
    autor: 'Fernanda Robayo',
    texto: 'Son muy ágiles en sus procesos y cumplimento en las entregas',
    estrellas: 5,
  },
  {
    autor: 'Transportes Alvarez',
    texto:
      'Recibimos los precintos de seguridad en Funza, Cundinamarca, en óptimas condiciones y dentro de lo esperado. Muy buena atención, calidad y cumplimiento. ¡Gracias por el excelente servicio!',
    estrellas: 5,
  },
  {
    autor: 'JULIANA VANESSA MADRID GÜIZA',
    texto: 'Compré precintos de seguridad en Bogotá, excelente atencion',
    estrellas: 5,
  },
];
