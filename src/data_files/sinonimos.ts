/**
 * Cómo llama el cliente a lo que el catálogo llama de otra manera.
 *
 * El catálogo dice «precinto». Quien busca escribe «sello», «marchamo» o
 * «candado plástico» según de dónde venga, y hasta ahora esas tres búsquedas
 * devolvían cero en un catálogo que sí tiene el producto. Cero es la peor
 * respuesta posible: quien la recibe se va, no prueba otra palabra.
 *
 * CÓMO FUNCIONA. Antes de buscar, se reemplaza en lo escrito toda palabra o
 * frase de `escribe` por su `busca`. No se acumula: «sello» se convierte en
 * «precinto» y se busca eso. Por eso el catálogo enseña un renglón que dice
 * qué se buscó realmente —«en este catálogo, "sello" se llama "precinto"»—,
 * que además le enseña el término a quien no lo conocía.
 *
 * DOS REGLAS AL AGREGAR UNO, y hay un test que comprueba las dos:
 *
 *   1. Lo de `escribe` NO puede ser una palabra que el catálogo ya use. Si
 *      alguien pusiera «candado» → «precinto», escribir «candado» dejaría de
 *      llevar a los dos precintos tipo candado y devolvería los cuarenta y
 *      nueve precintos del catálogo. Un sinónimo está para rescatar una
 *      búsqueda vacía, nunca para estropear una que ya funciona. Por eso
 *      «candado» va aquí solo dentro de la frase «candado plástico».
 *   2. Lo de `busca` SÍ tiene que existir en el catálogo, palabra por
 *      palabra. Un sinónimo que apunta a un producto que no se vende cambia
 *      un cero por otro cero.
 *
 * `busca` se lee en pantalla («en este catálogo, "silica gel" se llama
 * "absorbente de humedad"»), así que se escribe como se dice, no como una
 * lista de palabras clave.
 *
 * Lo que NO está aquí a propósito: vinipel, plástico burbuja, película
 * stretch. Son cosas que la gente busca y que la empresa no vende; ahí el
 * «no encontramos» es la respuesta correcta.
 *
 * Esta lista se amplía sola con el uso: el evento `Search` que manda el
 * catálogo a Google Analytics registra qué se busca, así que en unos meses se
 * sabrá qué palabras se están quedando en cero.
 */
export const SINONIMOS: Array<{ busca: string; escribe: string[] }> = [
  {
    // La familia entera de precintos. Son 49 de las 115 referencias, así que
    // es donde más se nota que alguien no conozca la palabra.
    busca: 'precinto',
    escribe: [
      'sello',
      'sellos',
      'marchamo',
      'marchamos',
      'cincho',
      'cinchos',
      'precinta',
      'precintas',
      'sello plastico',
      'amarre plastico',
    ],
  },
  {
    // «Candado» solo ya lleva a los precintos tipo candado, y así debe
    // seguir. La frase completa es la que hay que rescatar.
    //
    // «candado plastico» SALIÓ de esta lista: desde la actualización del
    // catálogo hay una referencia que se llama «Precinto Tipo Candado
    // Plástico», así que esa búsqueda ya da en el clavo sola y traducirla
    // la haría más ancha, no más útil — que es justo lo que prohíbe la
    // regla 1 de arriba.
    busca: 'precinto tipo candado',
    escribe: ['candado de seguridad'],
  },
  {
    busca: 'guaya',
    escribe: ['guasca', 'cable de acero', 'cable acerado'],
  },
  {
    busca: 'zuncho',
    escribe: ['fleje', 'flejes'],
  },
  {
    busca: 'etiqueta',
    escribe: [
      'sticker',
      'stickers',
      'calcomania',
      'calcomanias',
      'adhesivo',
      'adhesivos',
      'rotulo',
      'rotulos',
    ],
  },
  {
    busca: 'tula',
    escribe: ['valija', 'valijas', 'saco', 'sacos'],
  },
  {
    busca: 'bolsa courier',
    escribe: ['sobre', 'sobres', 'sobre courier'],
  },
  {
    busca: 'bolsa inflable',
    escribe: ['airbag', 'airbags', 'air bag', 'air bags'],
  },
  {
    busca: 'absorbente de humedad',
    escribe: ['silica', 'silica gel', 'desecante', 'desecantes', 'antihumedad'],
  },
  {
    busca: 'rastreo satelital',
    escribe: ['gps', 'rastreador', 'rastreadores', 'localizador', 'satelite'],
  },
];
