import { LEGAL } from '@data/constants';

// Menú principal, replicando la estructura del sitio actual.
// En el sitio original "Precintos", "Productos" y "Usos" son desplegables;
// aquí cada uno tiene su página de listado, desde la que se accede a las
// subpáginas. Convertirlos en desplegables requiere el contenido de cada
// submenú, que aún está pendiente.
const navBarLinks = [
  { name: 'Inicio', url: '/' },
  { name: 'Catálogo', url: '/catalogo' },
  { name: 'Precintos', url: '/precintos' },
  { name: 'Productos', url: '/productos' },
  // «Recursos» reemplaza a «Usos» y «FAQ's», que estaban por separado.
  // Ahora hay tres cosas que ofrecer —preguntas, guías y novedades— y sumarlas
  // al menú lo dejaba ilegible en el teléfono; /recursos reparte a las tres.
  // Las dos páginas viejas siguen publicadas y enlazadas: están indexadas.
  { name: 'Recursos', url: '/recursos' },
  { name: 'Nosotros', url: '/nosotros' },
  { name: 'Contacto', url: '/contacto' },
];
// An array of links for footer
const footerLinks = [
  {
    section: 'Productos',
    links: [
      { name: 'Catálogo completo', url: '/catalogo' },
      {
        name: 'Precintos de seguridad',
        url: '/productos/precintos-de-seguridad',
      },
      {
        name: 'Etiquetas y cintas',
        url: '/productos/etiquetas-y-cintas-de-seguridad',
      },
      { name: 'Tulas y bolsas', url: '/productos/tulas-y-bolsas-de-seguridad' },
      { name: 'Cajas de seguridad', url: '/productos/cajas-de-seguridad' },
    ],
  },
  {
    section: 'Recursos',
    links: [
      { name: 'Preguntas frecuentes', url: '/preguntas' },
      { name: 'Guías de uso', url: '/usos' },
      { name: 'Novedades', url: '/novedades' },
      { name: 'Dudas sobre pedidos', url: '/faq' },
    ],
  },
  {
    section: 'Empresa',
    links: [
      { name: 'Nosotros', url: '/nosotros' },
      { name: 'Contacto', url: '/contacto' },
    ],
  },
];

/**
 * Columna «Legal» del footer.
 *
 * Se deriva de `LEGAL.documentos` en lugar de escribirse aquí: los tres
 * documentos ya están declarados en constants.ts con su nombre, su ruta y su
 * fecha, y de ahí los toman también las propias páginas y sus enlaces
 * cruzados. Publicar una página legal y olvidar enlazarla desde el footer es
 * el fallo clásico de estos sitios; naciendo de la misma lista, no puede
 * pasar: agregar un documento a `LEGAL.documentos` lo pone en el footer.
 */
const legalLinks = LEGAL.documentos.map(doc => ({
  name: doc.nombre,
  url: doc.url,
}));
// Redes sociales. Deja vacío lo que no aplique: el footer solo renderiza los
// iconos que tienen URL configurada.
const socialLinks: Record<string, string> = {
  facebook: 'https://www.facebook.com/people/Byslogistics/100070925777333/',
  instagram: 'https://www.instagram.com/byslogistics/',
  linkedin: '',
  x: '',
};

export default {
  navBarLinks,
  footerLinks,
  legalLinks,
  socialLinks,
};
