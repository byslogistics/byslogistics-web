# Guía del repositorio

Para asistentes de IA (Claude, Cursor, Copilot…) y para quien llegue nuevo. Describe la estructura real del proyecto y sus convenciones. El [README.md](README.md) cubre la instalación y el uso.

## Qué es esto

Sitio institucional de **Business & Supplies Logistics Ltda. (B&S Logistics)**, distribuidor colombiano de precintos y elementos de seguridad preventiva. Es un sitio estático: catálogo, fichas de producto y captación de contactos. No hay comercio electrónico ni área privada.

El sitio publica tres documentos legales (`/terminos-y-condiciones`, `/politica-de-privacidad`, `/politica-de-datos`). El tercero no es de redacción propia: es la transcripción del documento POGE01 que aprueba la Gerencia. Ver «Al agregar cosas», al final.

Un dato que condiciona todo el contenido: **el sitio no publica precios**. El listado del que salen las referencias es administrativo, y hay un test que lo verifica.

Stack: **Astro 7** + **Tailwind CSS v4** (vía `@tailwindcss/vite`) + **Preline** (acordeones y colapsables) + **Lenis** (scroll suave). Se despliega en **Netlify** desde `main`.

El sitio nació de la plantilla [ScrewFast](https://github.com/mearashadowfax/ScrewFast), pero ya casi no queda nada de ella: un solo idioma (español de Colombia), sin blog, sin documentación con Starlight y sin sección de precios. Si un componente o un dato no está enlazado desde `src/pages/`, probablemente sea un resto de la plantilla y haya que borrarlo, no reutilizarlo.

## Alias de importación

Definidos en [tsconfig.json](tsconfig.json). Úsalos siempre en lugar de rutas relativas largas:

| Alias           | Apunta a               |
| --------------- | ---------------------- |
| `@/*`           | `src/*`                |
| `@components/*` | `src/components/*`     |
| `@content/*`    | `src/content/*`        |
| `@data/*`       | `src/data_files/*`     |
| `@images/*`     | `src/images/*`         |
| `@scripts/*`    | `src/assets/scripts/*` |
| `@styles/*`     | `src/assets/styles/*`  |
| `@utils/*`      | `src/utils/*`          |

Ejemplo: `import { CONTACT } from '@data/constants';`

## Estructura

| Carpeta                                              | Qué hay                                                                                                                                                                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/pages/](src/pages/)                             | Rutas (Astro enruta por archivos). Páginas sueltas y dos rutas dinámicas: `productos/[id]` y `precintos/[id]`.                                                                                                                         |
| [src/layouts/](src/layouts/)                         | [MainLayout.astro](src/layouts/MainLayout.astro): navbar, slot del contenido, footer, panel de cotización y los scripts globales.                                                                                                      |
| [src/components/sections/](src/components/sections/) | Bloques de página: héroes, testimonios, FAQ, contacto, navbar y footer.                                                                                                                                                                |
| [src/components/ui/](src/components/ui/)             | Piezas reutilizables: botones, tarjetas, campos de formulario, iconos y bloques sueltos.                                                                                                                                               |
| [src/content/](src/content/)                         | Colecciones en Markdown: `soluciones/` (familias de producto), `precintos/` (categorías) y `usos/` (guías por aplicación, que son la puerta de entrada por búsqueda orgánica). Esquemas en [content.config.ts](src/content.config.ts). |
| [src/data_files/](src/data_files/)                   | [constants.ts](src/data_files/constants.ts) (`SITE`, `CONTACT`, `LEGAL`, `FORMS`, `ANALYTICS`, `SEO`, `OG`, `partnersData`), [empresa.ts](src/data_files/empresa.ts) (`RESENA`, `SECTORES`) y `faqs.json`.                             |
| [src/utils/](src/utils/)                             | `catalog.ts` (arma el catálogo y sus filtros), `analytics.ts` (qué eventos existen), `navigation.ts` (menú, footer, redes), `text.ts` (`normalize`, `slugify`), `ui.ts`, `utils.ts`.                                                   |
| [src/assets/](src/assets/)                           | `styles/` (global.css, lenis.css) y `scripts/` (carrito de cotización, formularios, scroll suave, medición).                                                                                                                           |
| [src/images/](src/images/)                           | Imágenes que procesa Astro: `productos/`, `backgrounds/`, `brand/`.                                                                                                                                                                    |
| [public/](public/)                                   | Se sirve tal cual, sin procesar.                                                                                                                                                                                                       |
| [tests/](tests/)                                     | Pruebas con el runner de Node. Ver más abajo.                                                                                                                                                                                          |
| [scripts/](scripts/)                                 | `extract-xlsx-images.mjs` (saca las fotos del listado de precios) y `smoke.mjs` (comprueba que las rutas responden).                                                                                                                   |
| [netlify/functions/](netlify/functions/)             | El asistente: `chat.mts` (endpoint `/api/chat`) y `_retrieval.mts` (recuperación, prompt y bloqueo de precios). Su base de conocimiento la genera [src/pages/kb.json.ts](src/pages/kb.json.ts) en el build.                            |

## Cómo está armada la maquetación

Vale la pena entenderlo antes de tocar anchos o márgenes:

- **El contenido va a sangre.** `<main>` no tiene ancho máximo, así que cada sección se estira de borde a borde de la ventana. Es lo que permite que las fotos y los fondos lleguen al filo de la pantalla.
- **Cada sección centra su propio texto** con `mx-auto max-w-[85rem] px-10 sm:px-14 lg:px-20`. Esa combinación es la convención del proyecto: si agregas una sección, cópiala tal cual para que quede alineada con las demás.
- **La barra de navegación es la excepción**: lleva su propio `max-w-(--breakpoint-2xl)` y su padding dentro de [Navbar.astro](src/components/sections/navbar&footer/Navbar.astro), porque es una píldora flotante que debe quedar separada de los bordes. Va `fixed`, así que no ocupa sitio en el flujo y el contenido puede pasarle por debajo: es lo que permite el hero a pantalla completa de la portada. Las demás páginas recuperan ese espacio con el relleno que MainLayout pone al `<main>`; una página que quiera su primer bloque a sangre pasa `heroASangre` al layout. Al bajar se encoge —logo, alto de los enlaces y separación con el borde— y se vuelve opaca; vuelve a su tamaño al llegar al tope. El umbral tiene histéresis (40 px para encoger, 12 para volver) y no se activa en páginas sin recorrido suficiente.
- **Los fondos de sección** usan [SectionBackdrop.astro](src/components/ui/blocks/SectionBackdrop.astro): una franja lateral con la imagen desvanecida por una máscara hacia el lado del texto. La sección que lo use debe ser `relative overflow-hidden` y su contenido ir en un contenedor `relative`. Por debajo de `lg` el fondo se oculta, porque estorbaría la lectura.

Hay tests que verifican todo esto; si los rompes, el mensaje de error dice qué medida se salió.

## Convenciones

- **Todo en español (Colombia)**, incluidos comentarios, mensajes de commit y textos de test.
- **Tailwind v4 únicamente.** No uses sintaxis de la v3.
- **Sin precios en el sitio.** Ni en contenido, ni en componentes, ni en datos estructurados, ni en lo que responde el asistente: su lista blanca de importes va vacía y cualquier cifra que escriba el modelo se bloquea antes de llegar a pantalla.
- **Los datos de la empresa viven en `constants.ts`**, no repartidos por las plantillas. Hay tests que comprueban que el WhatsApp, el correo y el dominio sean los correctos.
- **Las props se pasan en línea** desde las páginas; no hay estado global.
- **Interacción**: Preline para acordeones y colapsables; el resto son scripts propios en `src/assets/scripts/`.
- **La medición no se llama a mano.** Ningún archivo habla con Meta ni con Google: se llama a `window.bysTrack('nombre_del_evento', datos)` —siempre con `?.`, porque no existe en local ni con un bloqueador— y [analytics.js](src/assets/scripts/analytics.js) traduce. Los nombres de evento se declaran ahí, en un solo diccionario.
- **Sin importes tampoco en la medición.** La regla de «sin precios» vale para lo que sale hacia Meta y Google: ningún evento lleva `value` ni `currency`, y no hay evento de compra. Hay un test que lo comprueba.
- **Formato**: Prettier con el plugin de Tailwind. Corre `pnpm format:fix` antes de commitear — CI falla si el formato no está limpio.

## Comandos

| Comando             | Qué hace                                                      |
| ------------------- | ------------------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo.                                       |
| `pnpm build`        | `astro check` + build + [process-html.mjs](process-html.mjs). |
| `pnpm preview`      | Sirve lo construido.                                          |
| `pnpm format:fix`   | Aplica Prettier.                                              |
| `pnpm test`         | Toda la suite.                                                |
| `pnpm test:content` | Colecciones, datos de la empresa y configuración.             |
| `pnpm test:build`   | El HTML generado (requiere `pnpm build` antes).               |
| `pnpm test:chat`    | El asistente (requiere `pnpm build` antes).                   |
| `pnpm test:smoke`   | Que las rutas respondan.                                      |
| `pnpm test:e2e`     | Navegador real con Playwright (requiere `pnpm build` antes).  |

Gestor de paquetes: **pnpm**, con la versión fijada en `packageManager` para que CI use exactamente la misma.

## Los tests

Usan el runner de `node:test`, sin framework. Tres archivos:

- **[tests/content.test.js](tests/content.test.js)** — sin navegador ni build. Colecciones de contenido, iconos declarados, datos de la empresa y configuración de despliegue.
- **[tests/build.test.js](tests/build.test.js)** — lee el HTML de `dist/`. Rutas, metadatos, enlaces rotos, formularios y las referencias del catálogo.
- **[tests/chat.test.js](tests/chat.test.js)** — el asistente, con el modelo sustituido por un doble. Qué hecho recupera cada pregunta real, qué importes se bloquean y cómo degrada el endpoint cuando falta la clave o el proveedor falla. Ningún test sale a la red.
- **[tests/e2e.test.js](tests/e2e.test.js)** — levanta `dist/` y maneja Chromium. Filtros del catálogo, cotizador, formulario de contacto, menú móvil, encogido de la barra al bajar, burbuja del asistente, maquetación a sangre y accesibilidad con axe.

Si Playwright no está instalado, los tests de navegador se omiten en lugar de fallar. Para apuntar a un Chromium propio: `CHROMIUM_PATH=/ruta/al/chromium pnpm test`.

## Al agregar cosas

- **Una familia de producto o una categoría de precintos** → un archivo Markdown en `src/content/`, respetando el esquema de [content.config.ts](src/content.config.ts). El campo `icon` debe existir en [icons.ts](src/components/ui/icons/icons.ts); hay un test que lo comprueba.
- **Un icono** → agrégalo a `icons.ts` solo cuando lo vayas a usar. El archivo se mantiene podado a propósito.
- **Una sección nueva** → componente en `src/components/sections/`, con el contenedor estándar descrito arriba.
- **Una foto de producto** → a `src/images/productos/`, nunca a `public/`: desde `src/` Astro la comprime y genera los tamaños; desde `public/` se sirve el original entero. Después, `node scripts/trim-product-images.mjs` para quitarle el margen muerto.
- **Una guía de uso** → un `.md` en `src/content/usos/`. Debe llevar `faq` (se publica como `FAQPage`) y `productos` con enlaces reales al catálogo; hay tests que comprueban las dos cosas.
- **Una herramienta de terceros** (medición, chat, mapa de calor) → tres sitios, siempre los tres: su identificador en `ANALYTICS` (constants.ts), su dominio en la CSP de [netlify.toml](netlify.toml) —lo que no esté ahí el navegador lo bloquea en silencio— y el numeral 4 de [politica-de-privacidad.astro](src/pages/politica-de-privacidad.astro), que enumera con nombre propio lo que se instala en el navegador de quien visita. Publicar una política que no describe lo que el sitio hace es una declaración falsa, no un descuido.
- **Un dato que el asistente deba saber** → no lo escribas en `kb.json.ts` a mano si ya vive en otro sitio. La base se genera desde las colecciones, `constants.ts`, `empresa.ts`, `faqs.json` y [conocimiento.ts](src/data_files/conocimiento.ts); agrégalo ahí y el asistente lo hereda. Si el dato se ve en una página, va en la página. Si es saber de producto que ninguna página aloja —una norma, la diferencia entre dos tecnologías—, va en `conocimiento.ts`. En los dos casos escribe sus `q` — las formas en que la gente pregunta por eso —, porque la recuperación es léxica y solo encuentra lo que está escrito.
- **Texto del menú o del footer** → [src/utils/navigation.ts](src/utils/navigation.ts). La columna «Legal» es la excepción: se deriva de `LEGAL.documentos`, no se escribe ahí.
- **Un documento legal** → una página en `src/pages/` que use [LegalPage.astro](src/components/sections/legal/LegalPage.astro), más su entrada en `LEGAL.documentos` (constants.ts). Esa entrada es la que lo pone en el footer, en los enlaces cruzados de los otros documentos y en su propia fecha de actualización; sin ella la página no compila. Dentro del contenido, **cada `<h2>` debe llevar `id`**: el índice lateral se genera leyéndolos. Hay tests que comprueban que las tres estén enlazadas desde todas las páginas y que ningún ancla apunte al vacío.
- **Un cambio en la política de tratamiento de datos** → NO se redacta en el sitio. El documento lo aprueba la Gerencia (hoy: POGE01 versión 02, del 09/06/2026); [politica-de-datos.astro](src/pages/politica-de-datos.astro) es su transcripción, y al actualizarlo hay que subir `version` y `actualizado` en `LEGAL.documentos`.
