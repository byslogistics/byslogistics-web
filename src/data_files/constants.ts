import ogImageSrc from '@images/social.png';

export const SITE = {
  title: 'B&S Logistics',
  legalName: 'Business & Supplies Logistics S.A.S.',
  tagline: 'Líderes en Seguridad Preventiva',
  description:
    'En B&S LOGISTICS nos especializamos en la distribución y comercialización de elementos de seguridad preventiva. Ofrecemos productos de óptima calidad que permiten garantizar la trazabilidad y custodia de bienes y activos.',
  description_short:
    'Distribución y comercialización de elementos de seguridad preventiva para la cadena de custodia y logística.',
  url: 'https://byslogistics.com.co',
  author: 'Business & Supplies Logistics S.A.S.',
};

/**
 * Datos de contacto de la empresa: única fuente de verdad para el footer,
 * la página de contacto, el cotizador y los datos estructurados.
 */
export const CONTACT = {
  pbx: [
    { label: '(601) 469 9575', href: 'tel:+6014699575' },
    { label: '(601) 469 9809', href: 'tel:+6014699809' },
  ],
  mobiles: [
    { label: '320 951 4930', href: 'tel:+573209514930' },
    { label: '311 253 3085', href: 'tel:+573112533085' },
    { label: '321 418 9261', href: 'tel:+573214189261' },
  ],
  panama: { label: '(507) 6302 0175', href: 'tel:+50763020175' },
  email: 'ventas@precintosdeseguridad.co',
  whatsapp: 'https://wa.me/573209514930',
  city: 'Bogotá, Colombia',
  // Dirección de la oficina, tomada de la Política de Tratamiento de Datos
  // Personales POGE01 v02 (ver LEGAL, más abajo).
  address: 'Carrera 86B No. 53-22 Sur, Bloque 13, Oficina 152',
  // Mapa incrustado de Google. La ficha corresponde a
  // "Precintos de Seguridad Business & Supplies Logistics".
  mapEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.8309916399876!2d-74.18022189999999!3d4.624224!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3f9f7a3b5253f3%3A0xa8a995e52c756cb1!2sPrecintos%20de%20Seguridad%20Business%20%26%20Supplies%20Logistics!5e0!3m2!1ses-419!2spa!4v1786555459273!5m2!1ses-419!2spa',
  mapLink:
    'https://www.google.com/maps/search/?api=1&query=Precintos+de+Seguridad+Business+%26+Supplies+Logistics',
};

/**
 * Identidad legal de la empresa y metadatos de los documentos publicados en
 * las páginas legales (`/politica-de-datos`, `/politica-de-privacidad`,
 * `/terminos-y-condiciones`).
 *
 * Los datos de `entidad` NO son de redacción propia: están copiados del
 * numeral 4 de la Política de Tratamiento de Datos Personales POGE01 v02,
 * aprobada por la Gerencia el 09/06/2026. Es el documento que la empresa
 * firma, así que manda sobre cualquier otra fuente. Si algún día cambia,
 * se actualiza aquí y las tres páginas lo heredan.
 *
 * OJO CON LA RAZÓN SOCIAL: el documento registra el cambio a
 * «BYS LOGISTICS S.A.S.», mientras que `SITE.legalName` sigue diciendo
 * «Business & Supplies Logistics S.A.S.». Las páginas legales usan la del
 * documento, porque son las que tienen valor jurídico. El resto del sitio
 * (datos estructurados, fichas de producto, asistente) sigue con la anterior
 * a la espera de que la empresa confirme el cambio de marca; cuando lo haga,
 * el cambio es en `SITE.legalName` y se propaga solo.
 *
 * El correo de datos personales tampoco es el comercial: la política designa
 * `gerencia@byslogistics.com.co` para consultas y reclamos de habeas data,
 * y ese es el que debe aparecer en los documentos legales.
 */
export const LEGAL = {
  entidad: {
    razonSocial: 'BYS LOGISTICS S.A.S.',
    nit: '900.437.215-8',
    domicilio: 'Bogotá D.C., Colombia',
    direccion: CONTACT.address,
    email: 'gerencia@byslogistics.com.co',
    telefonos: ['601 469 9575', '320 951 4930'],
    web: 'https://www.byslogistics.com.co',
  },
  /**
   * Los tres documentos, en el orden en que se listan en el footer.
   *
   * `actualizado` es la fecha que se muestra al pie del título. La de la
   * política de datos es la de aprobación por Gerencia que trae el documento;
   * las otras dos son la de su publicación en el sitio. `actualizadoISO`
   * alimenta el atributo `datetime` y los datos estructurados.
   */
  documentos: [
    {
      url: '/terminos-y-condiciones',
      nombre: 'Términos y condiciones',
      nombreLargo: 'Términos y condiciones de uso',
      actualizado: '22 de agosto de 2026',
      actualizadoISO: '2026-08-22',
    },
    {
      url: '/politica-de-privacidad',
      nombre: 'Política de privacidad',
      nombreLargo: 'Política de privacidad del sitio web',
      // Subió al incorporar la medición del sitio (píxel de Meta y etiqueta
      // de Google): la página cambió lo que dice sobre cookies y terceros.
      actualizado: '23 de agosto de 2026',
      actualizadoISO: '2026-08-23',
    },
    {
      url: '/politica-de-datos',
      nombre: 'Tratamiento de datos',
      nombreLargo: 'Política de Tratamiento de Datos Personales',
      actualizado: '9 de junio de 2026',
      actualizadoISO: '2026-06-09',
      // Identificación del documento interno dentro del sistema de gestión de
      // la empresa. Se muestra en la página porque es lo que permite cotejar
      // lo publicado con el original firmado.
      codigo: 'POGE01',
      version: '02',
    },
  ],
} as const;

/**
 * Nombres de los formularios en Netlify Forms.
 *
 * El robot de Netlify detecta al desplegar los formularios marcados con
 * `data-netlify="true"` y los agrupa por este nombre. Los envíos se ven en
 * el panel de Netlify → Forms, y desde ahí se configuran las notificaciones
 * por correo a ventas@precintosdeseguridad.co.
 *
 * Si se cambia un nombre, Netlify lo trata como un formulario nuevo y los
 * envíos anteriores quedan en el anterior.
 */
export const FORMS = {
  contact: 'contacto',
  newsletter: 'suscripcion',
};

/**
 * Medición del sitio: píxel de Meta y etiqueta de Google (GA4).
 *
 * LOS DOS SON NUEVOS, CREADOS PARA ESTE SITIO, y eso es una decisión, no una
 * casualidad. El sitio anterior es un WordPress con su propio píxel —que
 * sigue vivo en byslogistics.com.co y en byslogisticsltda.com— y con eventos
 * de una tienda que este sitio no tiene: ahí se registraban compras que aquí
 * no existen, porque aquí no se vende, se cotiza. Heredar ese píxel habría
 * mezclado dos formas distintas de contar en la misma cuenta, y un histórico
 * contaminado no se puede limpiar después: queda para siempre en los públicos
 * y en el aprendizaje de las campañas. Hay un test que impide que vuelva a
 * entrar (tests/content.test.js), porque la forma probable de que pase es
 * pegando otra vez el fragmento que entrega Meta.
 *
 * El precio de arrancar limpio hay que saberlo: el píxel nuevo empieza sin
 * histórico, así que los públicos de remarketing se vuelven a construir desde
 * cero y las campañas necesitan su fase de aprendizaje otra vez.
 *
 *   - `metaPixelId` es el píxel de este sitio. Un píxel admite varios
 *     dominios, así que si mañana el sitio cambia de dirección no hay que
 *     crear otro: basta con verificar el dominio nuevo en el portafolio
 *     comercial de Meta.
 *   - `googleTagId` es la etiqueta de Google de la propiedad de Analytics.
 *     «Etiqueta de Google» y «GA4» no son dos cosas: la etiqueta es el código
 *     que se pega en la página y la propiedad es donde se ven los informes.
 *
 * Dejar un identificador en cadena vacía apaga esa medición por completo: no
 * se carga el script ni se envía nada. Es la forma de desactivarla sin
 * arrancar código de las plantillas.
 *
 * DÓNDE NO SE MIDE. `hostsSinMedicion` son los dominios donde el código no
 * arranca. Están el servidor de desarrollo y el que levantan las pruebas de
 * navegador: sin esto, cada `pnpm test` mandaría visitas falsas al píxel de
 * producción y ensuciaría los públicos de remarketing.
 */
export const ANALYTICS = {
  metaPixelId: '1059859873468241',
  googleTagId: 'G-CPJH96HLSN',
  hostsSinMedicion: ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'],
};

export const SEO = {
  title: SITE.title,
  description: SITE.description,
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    inLanguage: 'es-CO',
    '@id': SITE.url,
    url: SITE.url,
    name: SITE.title,
    description: SITE.description,
    isPartOf: {
      '@type': 'WebSite',
      url: SITE.url,
      name: SITE.title,
      description: SITE.description,
    },
  },
};

export const OG = {
  locale: 'es_CO',
  type: 'website',
  url: SITE.url,
  title: `${SITE.title}: ${SITE.tagline}`,
  description: SITE.description,
  image: ogImageSrc,
};

// Logos de clientes o aliados. Vacío por ahora: la sección de la home no se
// renderiza hasta que se agreguen logos reales.
export const partnersData: Array<{
  icon: string;
  name: string;
  href: string;
}> = [];
