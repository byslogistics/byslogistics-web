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
 * ESTA LISTA ESTÁ INCOMPLETA, y conviene que quede escrito: hoy solo contiene
 * la reseña que ya estaba publicada en el sitio. El resto hay que copiarlas de
 * la ficha de Google, una por una, con el formato de la que ya está. La
 * sección se adapta al número que haya —con tres o más pasa a moverse sola,
 * con menos las deja quietas—, así que se puede ir completando sin tocar
 * código.
 */
export const OPINIONES: Opinion[] = [
  {
    autor: 'Daniel Molina',
    texto:
      'Su asesoría al momento de elegir el producto que mejor se adaptara a las necesidades de mi empresa, fue clave para el éxito de los procesos logísticos de mi negocio. Los recomiendo.',
    estrellas: 5,
  },
];
