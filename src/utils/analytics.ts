/**
 * El vocabulario de medición del sitio, en un solo sitio.
 *
 * Aquí no se carga nada ni se envía nada —de eso se ocupa
 * [Analytics.astro](../components/Analytics.astro)—; esto solo describe QUÉ se
 * mide, para que una página no tenga que saber cómo se llama el evento en Meta
 * ni en Google.
 *
 * LA REGLA DE ORO DE ESTE SITIO: no hay precios. Ni en la página, ni en los
 * datos estructurados, ni en lo que se manda a la medición. Meta y Google
 * aceptan sus eventos de comercio sin `value` ni `currency`, y mandarlos con
 * un importe inventado —o con cero— convertiría los informes de campaña en
 * cifras falsas. Por eso ningún evento de aquí lleva importe: lo que este
 * sitio persigue es la solicitud de cotización, no una venta.
 */

/**
 * Un evento que se dispara solo por haber abierto una página: la ficha de una
 * referencia, la página de una categoría o el catálogo.
 *
 * Las interacciones (añadir a la cotización, buscar, enviar el formulario) no
 * pasan por aquí: las dispara el script que las gobierna llamando a
 * `window.bysTrack`.
 */
export interface EventoDePagina {
  /**
   * `producto` es una referencia concreta; `listado` es cualquier página que
   * enseñe un conjunto —el catálogo, una familia, una categoría de precintos—.
   */
  tipo: 'producto' | 'listado';
  /** El identificador del catálogo. Solo en `producto`. */
  id?: string;
  nombre: string;
  /** La categoría a la que pertenece, cuando la tiene. */
  categoria?: string;
}

/** El evento de la ficha de una referencia. */
export function eventoDeProducto(referencia: {
  id: string;
  name: string;
  group: string;
}): EventoDePagina {
  return {
    tipo: 'producto',
    id: referencia.id,
    nombre: referencia.name,
    categoria: referencia.group,
  };
}

/** El evento de una página que enseña un conjunto de referencias. */
export function eventoDeListado(
  nombre: string,
  categoria?: string
): EventoDePagina {
  return { tipo: 'listado', nombre, categoria };
}
