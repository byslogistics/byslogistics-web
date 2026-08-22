import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { SITE, CONTACT, LEGAL } from '@data/constants';
import { FUNDACION, RESENA, SECTORES } from '@data/empresa';
import { CONOCIMIENTO } from '@data/conocimiento';
import faqsData from '@data/faqs.json';

/**
 * Base de conocimiento del asistente, generada en el build desde los MISMOS
 * archivos que renderizan el sitio: las colecciones de contenido, los datos de
 * contacto y los textos institucionales.
 *
 * Por qué generada y no escrita a mano: una base copiada a mano se
 * desincroniza el primer día que alguien cambia un teléfono o agrega una
 * referencia. Aquí no puede pasar — si cambia el celular en `constants.ts`,
 * cambia en el footer, en la página de contacto y en lo que responde el
 * asistente, en el mismo build.
 *
 * Tres decisiones de diseño, pensadas para que funcione con un modelo pequeño
 * (que es el que se puede pagar en un sitio como este):
 *
 *  1. Hechos ATÓMICOS y autocontenidos. Cada entrada se entiende sola, sin
 *     necesitar otra. El modelo no tiene que reconstruir nada.
 *  2. Cada hecho trae sus propias `q`: las formas en que la gente pregunta por
 *     eso. La recuperación es léxica, así que las variantes las escribimos
 *     nosotros en vez de esperar que el modelo las adivine.
 *  3. `prices` es la lista blanca de importes que el asistente puede repetir.
 *     Va VACÍA a propósito: este sitio no publica precios, se cotizan según
 *     cantidad y referencia. Con la lista vacía, cualquier cifra en pesos que
 *     el modelo escriba se bloquea antes de llegar a pantalla. Es la única
 *     defensa que no depende de que el modelo obedezca el prompt.
 *
 * Se sirve como `/kb.json`, un archivo estático más del build. La función del
 * chat lo descarga y lo cachea; no hay base de datos en medio.
 */

export interface KbFact {
  id: string;
  topic: string;
  /** Formas naturales de preguntar por esto. Alimentan la recuperación. */
  q: string[];
  /** La respuesta, ya redactada. El modelo la parafrasea, no la deduce. */
  text: string;
  /**
   * Realce en la puntuación de la recuperación (1 por defecto). Lo llevan los
   * hechos que resumen una línea entera, para que una pregunta general no se
   * conteste con un detalle tomado al azar. Ver `retrieve` en
   * netlify/functions/_retrieval.mts.
   */
  boost?: number;
}

/** Une una lista en prosa: "a, b y c". */
const enumerar = (xs: string[]) =>
  xs.length < 2
    ? (xs[0] ?? '')
    : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;

/** Identificador estable a partir de un nombre con tildes y espacios. */
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const GET: APIRoute = async () => {
  const facts: KbFact[] = [];
  const add = (f: KbFact) => facts.push(f);

  const soluciones = (await getCollection('soluciones')).sort(
    (a, b) => a.data.order - b.data.order
  );
  const precintos = (await getCollection('precintos')).sort(
    (a, b) => a.data.order - b.data.order
  );
  const guias = (await getCollection('usos')).sort(
    (a, b) => a.data.order - b.data.order
  );

  const telefonos = enumerar([
    ...CONTACT.pbx.map(p => `P.B.X. ${p.label}`),
    ...CONTACT.mobiles.map(m => `celular ${m.label}`),
  ]);

  /* ---------------- La empresa ---------------- */

  add({
    id: 'quienes-somos',
    topic: 'empresa',
    q: [
      'quienes son',
      'que hace la empresa',
      'a que se dedican',
      'desde cuando existen',
      'cuantos años llevan',
      'son colombianos',
      'razon social',
    ],
    text:
      `${SITE.legalName} es una empresa colombiana fundada en ${FUNDACION}, con sede en ${CONTACT.city}. ` +
      'Nos especializamos en la distribución y comercialización de elementos de seguridad preventiva que ' +
      'intervienen en la cadena de custodia y logística de las compañías.',
  });

  add({
    id: 'trayectoria',
    topic: 'empresa',
    q: [
      'son confiables',
      'por que elegirlos',
      'que experiencia tienen',
      'a quien le venden',
      'son fabricantes o distribuidores',
    ],
    text: RESENA[1] ?? '',
  });

  add({
    id: 'gama-y-sectores',
    topic: 'empresa',
    q: [
      'que sectores atienden',
      'a que industrias le venden',
      'trabajan con mi sector',
      'que tipo de clientes tienen',
    ],
    text:
      'Contamos con una completa gama de productos a precios competitivos enfocados a soluciones logísticas ' +
      `en transporte y control de activos. Suministramos a líderes de industria en ${enumerar(
        SECTORES.map(s => s.name.toLowerCase())
      )}, entre otros.`,
  });

  /**
   * Vocabulario de intención por sector.
   *
   * La recuperación es léxica: solo encuentra lo que está escrito. Nadie
   * pregunta "productos para el sector combustibles"; pregunta "¿sirve para
   * carrotanques?". Estas frases son el puente entre cómo habla el cliente y
   * cómo se llaman las cosas en el sitio, y es aquí —en los datos— donde se
   * arregla un fallo de recuperación, no tocando el prompt ni cambiando de
   * modelo.
   */
  const vocabularioPorSector: Record<string, string[]> = {
    Financiero: [
      'transporte de valores',
      'traslado de dinero',
      'valija',
      'documentos',
      'recaudo',
      'banco',
    ],
    Transporte: [
      'contenedor',
      'furgon',
      'camion',
      'tractomula',
      'carga en ruta',
      'puerta de contenedor',
      'flota',
    ],
    'Combustibles e hidrocarburos': [
      'carrotanque',
      'carrotanques',
      'valvula',
      'tapa de tanque',
      'combustible',
      'gasolina',
      'planta de abastecimiento',
    ],
    'Minería y carbón': [
      'granel',
      'despacho a granel',
      'volqueta',
      'carbon',
      'mina',
    ],
    Alimentos: [
      'cadena de frio',
      'inventarios',
      'producto terminado',
      'canastilla',
      'planta de alimentos',
    ],
    Cárnicos: ['refrigerado', 'frigorifico', 'canal', 'planta de sacrificio'],
    Apuestas: ['punto de venta', 'recaudo', 'maquinas', 'chance', 'casino'],
    Farmacéuticos: [
      'sello de garantia',
      'medicamentos',
      'laboratorio',
      'empaques',
    ],
  };

  for (const sector of SECTORES) {
    add({
      id: `sector-${slug(sector.name)}`,
      topic: 'sectores',
      q: [
        `sector ${sector.name}`,
        `productos para ${sector.name}`,
        `trabajan con ${sector.name}`,
        ...(vocabularioPorSector[sector.name] ?? []),
      ],
      text: `Sector ${sector.name.toLowerCase()}: ${sector.description} Los casos de uso por sector están en la página de usos del sitio.`,
    });
  }

  /* ---------------- Familias de producto ---------------- */

  add({
    id: 'que-productos',
    topic: 'productos',
    boost: 1.35,
    q: [
      'que productos manejan',
      'que venden',
      'que tipo de productos tienen',
      'catalogo de productos',
      'lineas de producto',
    ],
    text:
      `Manejamos ${soluciones.length} líneas de producto: ${enumerar(
        soluciones.map(s => s.data.title.toLowerCase())
      )}. ` +
      'El catálogo completo, con filtros por familia y buscador, está en la página de catálogo del sitio.',
  });

  for (const solucion of soluciones) {
    const { title, description, highlights } = solucion.data;
    add({
      id: `familia-${solucion.id}`,
      topic: 'productos',
      q: [
        title.toLowerCase(),
        `para que sirven los ${title.toLowerCase()}`,
        `venden ${title.toLowerCase()}`,
        `precio ${title.toLowerCase()}`,
      ],
      text:
        `${title}: ${description}` +
        (highlights.length
          ? ` Características: ${highlights.join('; ')}.`
          : ''),
    });
  }

  /* ---------------- Categorías de precintos ---------------- */

  const totalReferencias = precintos.reduce(
    (n, p) => n + p.data.products.length,
    0
  );

  add({
    id: 'categorias-precintos',
    topic: 'precintos',
    boost: 1.35,
    q: [
      'que precintos tienen',
      'tipos de precintos',
      'categorias de precintos',
      'que clase de sellos manejan',
      'cual precinto necesito',
    ],
    text:
      `Manejamos ${precintos.length} categorías de precintos —${enumerar(
        precintos.map(p => p.data.title.toLowerCase())
      )}— con ${totalReferencias} referencias en total. ` +
      'Si no sabe cuál corresponde a su operación, descríbanos qué punto necesita asegurar y le indicamos la referencia adecuada.',
  });

  for (const categoria of precintos) {
    const { title, description, products } = categoria.data;
    const ejemplos = products.slice(0, 4).map(p => p.name);
    add({
      id: `precinto-${categoria.id}`,
      topic: 'precintos',
      q: [
        title.toLowerCase(),
        `precinto ${title.toLowerCase().replace('precintos ', '')}`,
        `para que sirve el ${title.toLowerCase()}`,
        `tienen ${title.toLowerCase()}`,
      ],
      text:
        `${title}: ${description}` +
        (ejemplos.length
          ? ` Algunas referencias: ${enumerar(ejemplos)}${
              products.length > ejemplos.length
                ? `, entre las ${products.length} de esta categoría`
                : ''
            }.`
          : ''),
    });
  }

  /* ---------------- Precios y cotización ---------------- */

  /*
   * El hecho más importante de toda la base.
   *
   * "¿Cuánto vale?" es la primera pregunta de casi cualquier conversación, y
   * es justo la que este sitio no responde: el precio depende de la referencia,
   * la cantidad y la personalización. Sin este hecho el modelo rellenaría el
   * hueco con una cifra plausible, que es la peor respuesta posible para un
   * proveedor. Con él, contesta lo que contestaría el equipo comercial.
   */
  add({
    id: 'precios',
    topic: 'cotizacion',
    q: [
      'cuanto cuesta',
      'cuanto vale',
      'que precio tiene',
      'lista de precios',
      'tarifas',
      'es caro',
      'precio por unidad',
      'cuanto sale el millar',
    ],
    text:
      'No publicamos precios en el sitio: cada referencia se cotiza según la cantidad, el tipo de precinto y la ' +
      'personalización que necesite (numeración, logotipo, código de barras). Descríbanos su necesidad por el ' +
      `formulario de contacto, al correo ${CONTACT.email} o por WhatsApp, y le enviamos la cotización.`,
  });

  add({
    id: 'como-cotizar',
    topic: 'cotizacion',
    q: [
      'como pido una cotizacion',
      'quiero cotizar',
      'como hago un pedido',
      'como compro',
      'quiero comprar',
      'necesito una propuesta',
    ],
    text:
      'Para cotizar puede armar su lista en el catálogo del sitio —cada referencia tiene un botón para agregarla ' +
      'a la cotización, y desde el botón flotante se envía la lista completa por WhatsApp— o escribirnos por el ' +
      `formulario de contacto, al correo ${CONTACT.email} o a nuestras líneas. Le respondemos con la asesoría ` +
      'sobre el producto ideal para su empresa.',
  });

  add({
    id: 'cantidad-minima',
    topic: 'cotizacion',
    q: [
      'cantidad minima',
      'venden al por menor',
      'pedido minimo',
      'puedo comprar pocas unidades',
      'venden por unidad',
    ],
    text:
      'La cantidad depende de la referencia y de si lleva personalización, así que se define al cotizar. ' +
      `Cuéntenos qué referencia necesita y cuántas unidades, y le confirmamos disponibilidad y condiciones: ${CONTACT.email}.`,
  });

  add({
    id: 'personalizacion',
    topic: 'productos',
    q: [
      'se pueden personalizar',
      'llevan logo',
      'numeracion',
      'codigo de barras',
      'marcar con el nombre de mi empresa',
      'imprimen el logotipo',
    ],
    text:
      'Los precintos se personalizan con numeración consecutiva única, logotipo y código de barras, que es lo que ' +
      'permite trazar la cadena de custodia: el número registrado al despachar debe coincidir con el que se ' +
      'verifica al recibir. La personalización se define al cotizar.',
  });

  /* ---------------- Contacto y cobertura ---------------- */

  add({
    id: 'contacto',
    topic: 'contacto',
    q: [
      'como los contacto',
      'telefono',
      'numero de contacto',
      'correo',
      'email',
      'whatsapp',
      'hablar con un asesor',
      'atencion al cliente',
    ],
    text:
      `Puede escribirnos al correo ${CONTACT.email}, por WhatsApp, o llamarnos: ${telefonos}. ` +
      `Estamos en ${CONTACT.city}. También puede dejarnos sus datos en el formulario de la página de contacto.`,
  });

  add({
    id: 'cobertura',
    topic: 'contacto',
    q: [
      'atienden fuera de colombia',
      'envian a otras ciudades',
      'tienen sede en panama',
      'hacen envios',
      'cobertura',
      'donde estan ubicados',
      'exportan',
      // "¿Dónde comprar precintos en Colombia?" es de las preguntas más
      // frecuentes que llegan por buscador, y sin estas formas caía en una
      // categoría de producto cualquiera en vez de en la cobertura.
      'donde comprar precintos',
      'donde consigo precintos en colombia',
      'venden precintos en colombia',
      'despachan a mi ciudad',
    ],
    text:
      `Operamos desde ${CONTACT.city} y atendemos todo el país. Además contamos con atención en Panamá ` +
      `a través del celular ${CONTACT.panama.label}. Cuéntenos a dónde necesita el despacho y lo coordinamos al cotizar.`,
  });

  /* ---------------- Preguntas frecuentes ---------------- */

  const faqs = faqsData.categories.flatMap(
    categoria => categoria.faqs
  ) as Array<{ question: string; answer: string }>;
  faqs.forEach((faq, i) => {
    add({
      id: `faq-${i + 1}`,
      topic: 'faq',
      q: [faq.question.toLowerCase().replace(/[¿?]/g, '').trim()],
      text: faq.answer,
    });
  });

  /* ---------------- Guías de uso ---------------- */

  /*
   * Las guías entran a la base con sus propias preguntas frecuentes, no solo
   * con su título.
   *
   * El motivo: quien escribe al asistente pregunta igual que quien busca en
   * Google —"¿qué precinto va en un carrotanque?"—, y esas respuestas ya están
   * redactadas y revisadas en el frontmatter de cada guía. Reaprovecharlas es
   * gratis y evita que el asistente conteste una cosa y la página otra.
   */
  for (const guia of guias) {
    add({
      id: `guia-${guia.id}`,
      topic: 'usos',
      q: [
        guia.data.title.toLowerCase(),
        guia.data.summary.toLowerCase(),
        `como asegurar ${guia.data.sector.toLowerCase()}`,
      ],
      text: `${guia.data.title}: ${guia.data.description} Está explicado paso a paso en la guía de usos del sitio.`,
    });

    guia.data.faq.forEach((faq, i) => {
      add({
        id: `guia-${guia.id}-faq-${i + 1}`,
        topic: 'usos',
        q: [faq.question.toLowerCase().replace(/[¿?]/g, '').trim()],
        text: faq.answer,
      });
    });
  }

  /* ---------------- Conocimiento de producto ---------------- */

  /*
   * El saber del oficio que dictaron las dueñas y que no tiene página propia:
   * la norma que exige la naviera, en qué se diferencia una etiqueta No
   * Transfer de una VOID, cuándo una guaya reemplaza a un plástico. Vive en
   * `conocimiento.ts` con sus `q` ya escritas, así que aquí solo se vuelca.
   *
   * Entra al final a propósito. Ante un empate de puntuación gana el hecho más
   * corto, no el primero de la lista, así que el orden no decide nada; lo que
   * sí importa es que estos hechos NO llevan realce: una pregunta general como
   * "¿qué precintos manejan?" debe seguir cayendo en el resumen de categorías,
   * no en el detalle de la ISO/PAS 17712.
   */
  for (const hecho of CONOCIMIENTO) add(hecho);

  /* ---------------- Cómo usar el sitio ---------------- */

  add({
    id: 'catalogo-sitio',
    topic: 'sitio',
    q: [
      'donde veo el catalogo',
      'tienen catalogo en linea',
      'como busco un producto',
      'ficha tecnica',
      'fotos de los productos',
    ],
    text:
      `En la página de catálogo están las ${totalReferencias} referencias de precintos con buscador y filtros por ` +
      'familia y por categoría, y cada referencia tiene además su propia ficha con las fotos, las ' +
      'especificaciones que apliquen y el botón para cotizarla. Si busca algo que no aparece, escríbanos: ' +
      'manejamos referencias que no están publicadas.',
  });

  add({
    id: 'datos-personales',
    topic: 'sitio',
    q: [
      'que hacen con mis datos',
      'politica de datos',
      'tratamiento de datos personales',
      'habeas data',
      'proteccion de datos',
      'quiero que borren mis datos',
      'ley 1581',
    ],
    text:
      'Los datos que nos deja en el formulario se usan únicamente para responder su solicitud y preparar su ' +
      'cotización. La política de tratamiento de datos personales está publicada en el sitio, en ' +
      '/politica-de-datos. Para conocer, actualizar, corregir o pedir que se supriman sus datos, o para ' +
      `cualquier reclamo sobre el tema, el canal es ${LEGAL.entidad.email}.`,
  });

  add({
    id: 'paginas-legales',
    topic: 'sitio',
    q: [
      'terminos y condiciones',
      'politica de privacidad',
      'condiciones de uso',
      'usan cookies',
      'guardan mi conversacion',
      'aviso legal',
    ],
    text:
      'En el pie de página están los tres documentos legales del sitio: términos y condiciones de uso ' +
      '(/terminos-y-condiciones), política de privacidad (/politica-de-privacidad) y política de ' +
      'tratamiento de datos personales (/politica-de-datos). El sitio no instala cookies de analítica ni ' +
      'de publicidad, y las conversaciones con este asistente no se guardan.',
  });

  return new Response(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        site: {
          name: SITE.title,
          legalName: SITE.legalName,
          location: CONTACT.city,
          email: CONTACT.email,
          whatsapp: CONTACT.whatsapp,
          phone: CONTACT.pbx[0]?.label ?? '',
        },
        // Vacía a propósito: ver la nota de arriba. Cualquier importe que
        // escriba el modelo se considera inventado y no se publica.
        prices: [] as string[],
        facts,
      },
      null,
      0
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
};
