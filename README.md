# Sitio web de B&S Logistics

Sitio de **Business & Supplies Logistics**, distribuidor de elementos de
seguridad preventiva: precintos, etiquetas y cintas, tulas y bolsas, cajas de
seguridad, embalaje protector y rastreo satelital.

Construido con [Astro](https://astro.build) y [Tailwind CSS](https://tailwindcss.com)
sobre la plantilla ScrewFast, y adaptado por completo al contenido, la marca y
los colores de la empresa.

- **Producción:** https://byslogistics.com.co
- **Hosting:** Netlify (configuración en `netlify.toml`)

---

## Puesta en marcha

Requiere Node 22 y pnpm (la versión exacta está fijada en `packageManager`).

```bash
pnpm install
pnpm dev          # servidor de desarrollo en localhost:4321
pnpm build        # comprueba tipos y genera dist/
pnpm preview      # sirve dist/ como en producción
```

---

## Estructura

```
src/
├── assets/
│   ├── scripts/
│   │   ├── contactForms.js   Envío de formularios (Netlify Forms)
│   │   ├── quoteCart.js      Cotizador: carrito + mensaje de WhatsApp
│   │   └── lenisSmoothScroll.js
│   └── styles/global.css     Tema de Tailwind. Aquí vive la paleta de marca
├── components/
│   ├── BrandLogo.astro       Logo oficial
│   ├── ChatWidget.astro      Burbuja del asistente (abajo a la derecha)
│   ├── QuoteCart.astro       Panel del cotizador (el botón está en la barra)
│   ├── sections/             Bloques grandes de página
│   └── ui/                   Piezas reutilizables
├── content/
│   ├── soluciones/           Las 6 familias de producto (un .md cada una)
│   ├── precintos/            Las 11 categorías de precintos
│   └── usos/                 Guías por aplicación (una página cada una)
├── data_files/
│   ├── constants.ts          Datos de la empresa: contacto, SEO, formularios
│   ├── empresa.ts            Reseña de /nosotros y sectores de /usos
│   ├── faqs.json             Preguntas frecuentes
│   └── conocimiento.ts       Saber de producto del asistente, sin página propia
├── images/
│   ├── brand/                Logo y colores (ver su README)
│   ├── backgrounds/          Fondos laterales de sección
│   └── productos/            Fotos del catálogo
├── pages/                    Una página por ruta
│   └── kb.json.ts            Base de conocimiento del asistente (se genera
│                             en el build desde los datos de arriba)
└── utils/
    ├── catalog.ts            Aplana las colecciones para el catálogo
    ├── navigation.ts         Menú, pie de página y redes sociales
    └── text.ts               Normalización de texto (búsqueda sin tildes)

netlify/functions/
├── chat.mts                  Endpoint del asistente, publicado en /api/chat
└── _retrieval.mts            Recuperación, prompt y bloqueo de precios
```

### Páginas

| Ruta                      | Contenido                                       |
| ------------------------- | ----------------------------------------------- |
| `/`                       | Portada: propuesta, soluciones, testimonio, CTA |
| `/catalogo`               | Las 115 referencias con filtros y buscador      |
| `/precintos`              | Índice de las 11 categorías de precintos        |
| `/precintos/<categoría>`  | Referencias de una categoría                    |
| `/productos`              | Índice de las 6 familias                        |
| `/productos/<familia>`    | Familia con sus referencias agrupadas           |
| `/usos`                   | Guías por aplicación y sectores atendidos       |
| `/usos/<guía>`            | Guía de una aplicación concreta                 |
| `/nosotros`               | Historia de la empresa                          |
| `/faq`                    | Preguntas frecuentes                            |
| `/contacto`               | Formulario, teléfonos y mapa                    |
| `/terminos-y-condiciones` | Condiciones de uso del sitio                    |
| `/politica-de-privacidad` | Privacidad del sitio web                        |
| `/politica-de-datos`      | Tratamiento de datos personales (POGE01)        |

---

## Tareas frecuentes

### Agregar una referencia al catálogo

Los productos viven en Markdown, no en código. Para agregar una referencia a
una categoría de precintos, edita el archivo correspondiente en
`src/content/precintos/` y añade una entrada bajo `products`:

```yaml
products:
  - name: 'Precinto Botella BS-03'
    code: 'BS-03' # opcional
    description: 'Cuerpo metálico reforzado.' # opcional
```

Para las demás familias, la lista está agrupada por subtipo en
`src/content/soluciones/`:

```yaml
groups:
  - name: 'Etiquetas VOID'
    products:
      - name: 'Etiqueta VOID 5 x 3 cms'
```

La referencia aparece sola en la página de su categoría, en el catálogo con
filtros y en el cotizador. **No se publican precios**: el listado de la empresa
es administrativo y solo se traslada nombre y categoría.

### Agregar una guía de uso

Un archivo nuevo en `src/content/usos/`. El esquema está en
`src/content.config.ts`; los campos que no son evidentes:

- `description` es la **metadescripción** de la página. Hay un test que exige
  entre 60 y 165 caracteres, porque el buscador corta lo que se pase.
- `faq` se publica además como datos estructurados `FAQPage`. Es lo que permite
  que la respuesta salga directamente en el buscador sin que nadie entre a la
  página, así que conviene que cada respuesta se entienda suelta.
- `productos` son las referencias que resuelven lo que explica la guía, con su
  enlace al catálogo. Un test comprueba que esos enlaces existan: una guía que
  no lleva a producto no cumple su función.
- `relacionados` son ids de otras guías.

La guía aparece sola en `/usos`, en el sitemap y en la base de conocimiento del
asistente, que hereda su título y sus preguntas frecuentes.

### Agregar una categoría o una familia

Crea un archivo nuevo en `src/content/precintos/` o `src/content/soluciones/`.
El esquema de campos obligatorios está en `src/content.config.ts`. Recuerda dar
un `order` que no choque con los existentes: hay un test que lo comprueba.

### Cambiar los colores de la marca

Están en un solo sitio: la rampa `--color-brand-*` del bloque `@theme` en
`src/assets/styles/global.css`. Todos los componentes usan clases `brand-*`, así
que cambiar esos once valores cambia el sitio entero. El azul actual (`#0060A8`)
sale del logo.

### Cambiar teléfonos, correo o WhatsApp

En `src/data_files/constants.ts`, objeto `CONTACT`. De ahí lo leen el pie de
página, la página de contacto, el cotizador, la política de datos y los datos
estructurados.

### Agregar fotografías

Las fotos del catálogo van en `src/images/productos/` —**no en `public/`**: lo
que está en `public/` se sirve tal cual, sin comprimir y sin versiones para cada
ancho de pantalla, y una foto de producto de 300 KB por tarjeta se nota. Desde
`src/images/` Astro genera WebP y el juego de tamaños.

Se referencian con su ruta relativa desde el `.md`, en `cardImage` (familias y
categorías), `image` dentro de un grupo (subtipo, como "Bolsas courier") o
`image` en una referencia individual. La foto de grupo existe porque así son las
fotos reales: una por tipo de producto, no una por medida. Mientras el campo esté vacío la ficha muestra el
logotipo atenuado en lugar de la foto, así que la rejilla no se desarma.

```yaml
cardImage: ../../images/productos/precinto-botella.png
cardImageAlt: 'Precinto de botella metálico amarillo'
products:
  - name: 'Precinto Botella One Seal'
    image: ../../images/productos/precinto-botella-oneseal.png
```

#### Sacar las fotos del listado de precios

El `.xlsx` de precios lleva las fotos incrustadas. Para extraerlas ya nombradas
con el producto de su fila:

```bash
node scripts/extract-xlsx-images.mjs LISTADO_PRECIOS_2026.xlsx
```

Deja todo en `tmp/xlsx-images/`. De ahí se copian a `src/images/productos/`
**solo las que se vayan a publicar**: el listado trae también capturas de
tablas y fotos repetidas. El script no toca `src/`, así que se puede volver a
correr con un listado nuevo sin pisar nada.

#### Recortar el margen sobrante

Después de copiar fotos nuevas:

```bash
node scripts/trim-product-images.mjs        # recorta e informa
node scripts/trim-product-images.mjs --dry  # solo informa
```

Cada foto del listado trae el producto centrado en un lienzo distinto, y las
tarjetas usan `object-contain`: lo que se escala para llenar el marco es el
lienzo, no el producto. Una foto con la mitad del archivo en blanco se veía a
la mitad de tamaño que sus vecinas y la rejilla quedaba desigual sin que
hubiera nada mal en la maquetación. Con el margen recortado, el relleno lo pone
la tarjeta y es el mismo para todas.

Es idempotente y solo quita borde uniforme: una foto con fondo real no se toca.

### Poner una imagen de fondo en una sección

`SectionBackdrop.astro` pone la imagen a un lado de la sección y la desvanece
hacia el lado donde está el texto. Tiene dos tratamientos, los dos con la
imagen nítida:

- `mate` (el de por defecto): desaturada y con un velo del color de la sección
  encima. Se sigue viendo con todo su detalle, pero apagada, de modo que se
  asienta como fondo en lugar de competir con el texto. Es el que corresponde
  cuando la foto es literal, un producto recortado.
- `photo`: tal cual. Solo para ilustraciones y planos generales, que ya de por
  sí no distraen.

No lleva desenfoque: emborronar la imagen se veía peor que dejarla como
estaba. Y por debajo de `lg` el fondo se oculta, porque ahí el texto ocupa
todo el ancho y cualquier imagen detrás estorbaría la lectura.

La usan los encabezados de página (`MainSection`, props `backdrop` y
`backdropTreatment`), los testimonios y el cierre de página (`HeroSectionAlt`).
La sección contenedora debe ser `relative overflow-hidden` y su contenido ir en
un `div` `relative`.

El hero de la portada no lo usa: la fotografía ocupa el bloque entero y el
texto va encima, con un velo azul en degradado que garantiza el contraste sin
tapar la foto. Ese velo no es decoración: sobre una imagen, el texto blanco se
lee o no según lo que caiga detrás de cada línea, y eso cambia con el ancho de
la pantalla.

El hero mide `min-h-svh` —la pantalla completa— y empieza en el borde superior,
por debajo de la barra de navegación, que va flotando por encima. `svh` y no
`vh`: en el móvil, `vh` cuenta la barra de direcciones del navegador aunque
esté a la vista, y el bloque se pasaba de largo.

---

## Formularios

El sitio es estático, así que la recepción la hace **Netlify Forms**: al
desplegar, Netlify detecta en el HTML los formularios marcados con
`data-netlify="true"` y les habilita un endpoint. No hace falta ningún servicio
externo ni llave de acceso.

Hay dos formularios, con los nombres definidos en `FORMS` (`constants.ts`):

| Nombre        | Dónde              |
| ------------- | ------------------ |
| `contacto`    | Página de contacto |
| `suscripcion` | Pie de página      |

Tras el primer despliegue, configura las notificaciones en
**Netlify → Forms → contacto → Settings → Form notifications** para que los
mensajes lleguen a `ventas@precintosdeseguridad.co`.

Si el envío falla, el formulario de contacto abre WhatsApp con el mensaje ya
compuesto en lugar de dejar al visitante sin salida.

El formulario exige marcar la autorización de tratamiento de datos, y ese
consentimiento viaja en el envío (`autorizacion=Sí`) para dejar constancia,
como pide la Ley 1581 de 2012.

### El buscador entiende los nombres del cliente

El catálogo dice «precinto». El cliente escribe **sello**, **marchamo** o
**candado plástico** según de dónde venga, y esas búsquedas devolvían cero en
un catálogo que sí tiene el producto.

[`src/data_files/sinonimos.ts`](src/data_files/sinonimos.ts) traduce lo escrito
al vocabulario del catálogo antes de buscar, y la página dice con qué palabra
buscó de verdad: _«En este catálogo, "sello" se llama "precinto"»_. Ese
renglón no es cortesía: quien escribió «sello» no conoce la palabra que va a
necesitar para hablar con el asesor comercial.

Para agregar uno, una línea en la lista. Dos reglas, con un test cada una:

1. **Lo que se traduce no puede ser una palabra que el catálogo ya use.**
   Traducir «candado» a «precinto» haría que buscar «candado» dejara de llevar
   a los dos precintos tipo candado y devolviera los 49 precintos. Por eso
   «candado» solo aparece dentro de la frase «candado plástico».
2. **Aquello a lo que se traduce sí tiene que existir**, palabra por palabra.
   Un sinónimo que apunta a un producto que no se vende cambia un cero por otro.

Qué palabras agregar no hay que adivinarlo: el evento `Search` registra en
Analytics qué se busca y cuántos resultados dio, así que las búsquedas que se
quedan en cero salen solas en el informe.

---

## Medición

El sitio mide con dos herramientas, las mismas que ya usaba la empresa en el
sitio anterior, para no partir el histórico:

| Herramienta              | Identificador      | Dónde se cambia               |
| ------------------------ | ------------------ | ----------------------------- |
| Píxel de Meta            | `1137991652734329` | `ANALYTICS` en `constants.ts` |
| Etiqueta de Google (GA4) | `G-CPJH96HLSN`     | `ANALYTICS` en `constants.ts` |

Dejar un identificador en cadena vacía apaga esa medición: no se carga su
script ni se manda nada.

El código va **inline en el `<head>`** de todas las páginas
(`src/components/Analytics.astro`, que escribe `src/assets/scripts/analytics.js`).
Tiene que salir antes que el resto: si el visitante se va a los dos segundos,
esa visita solo se cuenta si el píxel ya arrancó.

**No se mide en `localhost`.** Sin eso, cada `pnpm test:e2e` —que recorre medio
sitio con un navegador real— mandaría visitas y conversiones falsas a la cuenta
de producción. Tampoco se mide mientras el navegador pre-renderiza una página
que nadie ha llegado a abrir.

### Qué se mide

Además de la visita, los momentos que dicen algo del negocio. Cada script del
sitio llama a `window.bysTrack('nombre', datos)` y `analytics.js` traduce:

| Momento                       | Meta                   | GA4              |
| ----------------------------- | ---------------------- | ---------------- |
| Ficha de una referencia       | `ViewContent`          | `view_item`      |
| Catálogo, familia o categoría | `ViewCategory`         | `view_item_list` |
| Buscar en el catálogo         | `Search`               | `search`         |
| Añadir a la cotización        | `AddToCart`            | `add_to_cart`    |
| Abrir el cotizador con algo   | `InitiateCheckout`     | `begin_checkout` |
| Enviar la cotización          | `Lead`                 | `generate_lead`  |
| Enviar el formulario          | `Lead`                 | `generate_lead`  |
| Suscribirse                   | `CompleteRegistration` | `sign_up`        |
| WhatsApp, teléfono o correo   | `Contact`              | `contact`        |

Dos decisiones que conviene no deshacer sin pensarlo:

- **Ningún evento lleva importe.** El sitio no publica precios —se cotiza según
  referencia, cantidad y personalización—, así que un `value` inventado, o un
  cero, daría informes de campaña con cifras que no existen.
- **No hay evento de compra.** Aquí no se cierra una venta, se pide una
  cotización. La conversión que hay que optimizar en el Administrador de
  anuncios es `Lead`.

Al agregar una medición nueva hay que tocar tres sitios: el identificador en
`constants.ts`, su dominio en la CSP de `netlify.toml` (o el navegador lo
bloquea en silencio) y el numeral 4 de la política de privacidad, que enumera
con nombre propio lo que se instala en el navegador de quien visita.

---

## Cotizador

Reemplaza el carrito de cotización de WooCommerce del sitio anterior, que un
sitio estático no puede replicar tal cual.

Funciona así: cada referencia del catálogo tiene un botón «Añadir a cotización».
Lo acumulado vive en `localStorage`, de modo que sobrevive a la navegación entre
páginas. Al enviar, se abre WhatsApp con el listado, las cantidades y los datos
de contacto ya escritos. **No se envía nada a ningún servidor** hasta que la
persona pulsa enviar.

El botón que lo abre vive en la barra de navegación, arriba a la derecha
(`QuoteButton.astro`), que es donde se busca un carrito. Nace oculto y aparece
en cuanto hay una referencia acumulada: un botón de cotización con la
cotización vacía no lleva a ninguna parte. Se renderiza dos veces —una para el
móvil, junto al logo, y otra para el escritorio, al final de los enlaces—
porque dentro del menú plegable quedaría escondido justo cuando hay algo que
enviar.

El panel es una pieza flotante, con los mismos bordes redondeados, el mismo
desenfoque y la misma sombra que la píldora de la barra. Antes era un cajón
pegado al borde con fondo plano, y parecía de otro sitio.

### Los tres rincones

Tres cosas compiten por la atención en una página de catálogo, y cada una tiene
su sitio:

| Pieza      | Dónde                      | Por qué                                       |
| ---------- | -------------------------- | --------------------------------------------- |
| Cotización | Barra, arriba a la derecha | Es donde se busca un carrito                  |
| Asistente  | Abajo a la derecha         | El rincón de la ayuda                         |
| WhatsApp   | Dentro del asistente       | En el saludo, en el pie y cuando no sabe algo |

El botón flotante de WhatsApp se retiró de esa esquina: tres cosas flotando en
el mismo rincón se tapan entre ellas y ninguna se pulsa bien. La vía directa
con una persona no se perdió —está a la vista al abrir la burbuja, y también en
el pie de página, en la página de contacto y en el cierre de cada página.

---

## Asistente

La burbuja de abajo a la izquierda responde preguntas con la información que ya
está publicada en el sitio. No es un chat genérico enchufado a un modelo: el
modelo hace la parte más pequeña posible del trabajo.

| Tarea        | Quién la hace                                       |
| ------------ | --------------------------------------------------- |
| Recuperación | Código, léxica y determinista, sobre `kb.json`      |
| Datos        | El build, desde los mismos archivos que las páginas |
| Precios      | Nadie: se derivan al equipo comercial               |
| Verificación | Código, después de la respuesta                     |
| Redacción    | El modelo                                           |

Con este reparto, un modelo pequeño y barato responde igual de bien que uno
grande, porque lo único que aporta es el lenguaje.

**Las piezas**

- `src/pages/kb.json.ts` genera `/kb.json` en cada build a partir de las
  colecciones de contenido, `constants.ts`, `empresa.ts`, `faqs.json` y
  `conocimiento.ts`. Si cambia un teléfono o se agrega una categoría, el
  asistente lo sabe en el siguiente despliegue: no hay nada que actualizar a
  mano.
- `src/data_files/conocimiento.ts` es la excepción a esa regla, y solo para lo
  que no cabe en ninguna página: la norma ISO/PAS 17712, las diferencias entre
  tecnologías de etiqueta, cuándo una guaya reemplaza a un plástico. Es
  material dictado por las dueñas y tiene prioridad sobre cualquier redacción
  anterior del sitio.
- `netlify/functions/chat.mts` recibe la pregunta, recupera los seis hechos más
  cercanos, arma el prompt y llama al proveedor.
- `netlify/functions/_retrieval.mts` es la parte determinista, y por eso vive
  aparte: se prueba entera sin levantar Netlify ni llamar a ningún modelo.

**Precios: por qué el asistente nunca da uno**

El sitio no publica precios y el asistente tampoco. La lista blanca de importes
(`prices` en `kb.json`) va vacía a propósito, así que cualquier cifra en pesos
que escriba el modelo se detecta y se sustituye por la invitación a cotizar,
_después_ de la respuesta. Es la única defensa que no depende de que el modelo
obedezca el prompt.

**Variables en Netlify** (Site configuration → Environment variables). Nunca en
el repositorio: la clave solo existe en el servidor y el navegador jamás la ve.

| Variable            | Obligatoria | Para qué                                 |
| ------------------- | ----------- | ---------------------------------------- |
| `GROQ_API_KEY`      | Sí          | La clave del proveedor                   |
| `GROQ_MODEL`        | No          | Fijar el modelo de Groq (ver más abajo)  |
| `ANTHROPIC_API_KEY` | No          | Repuesto si Groq falla                   |
| `CHAT_MAX_PER_DAY`  | No          | Techo diario de mensajes del sitio (300) |

Después de crear la variable hay que **volver a desplegar**: las funciones leen
el entorno del despliegue, no el del panel en vivo.

**El modelo no es un nombre, es una lista.** En agosto de 2026 Groq retiró
`llama-3.3-70b-versatile`, que era el que tenía puesto el asistente, y desde ese
día el chat contestó «se nos cayó la conexión» a todo el mundo con el sitio
entero intacto. Por eso `MODELOS_GROQ`, en `netlify/functions/chat.mts`, es una
lista con relevo: si el primero responde que no existe o que está retirado (400
o 404), se prueba el siguiente sin que el visitante se entere. Al agregar uno
nuevo va primero y los anteriores se quedan detrás.

`GROQ_MODEL` sirve para forzar uno concreto y se prueba antes que la lista; si
el que fija ya no existe, el relevo sigue funcionando igual. El nombre del
modelo que falló queda en el registro de la función, que es el dato que dice si
hay que actualizar la lista o revisar la clave.

**Sin clave configurada el asistente no se rompe:** contesta que todavía no está
conectado y deriva al correo y al P.B.X. Lo mismo si el proveedor se cae, si se
agota la cuota o si se alcanza el techo del día. El motivo real queda en el
registro de la función (Netlify → Functions → chat), nunca en pantalla.

**Límites de gasto.** Doce mensajes por minuto y visitante, y un techo diario
para todo el sitio. Ambos viven en memoria de la función, así que son
aproximados: si Netlify levanta varias instancias, cada una lleva su cuenta.

---

## Tests

```bash
pnpm test            # todo
pnpm test:content    # contenido y catálogo (sin navegador, rápido)
pnpm test:build      # HTML generado: rutas, enlaces, metadatos, formularios
pnpm test:chat       # asistente: recuperación, bloqueo de precios, endpoint
pnpm test:smoke      # que cada ruta responda 200
pnpm test:e2e        # comportamiento en navegador + accesibilidad con axe
```

`test:build`, `test:smoke` y `test:e2e` necesitan un `pnpm build` previo.

Los de navegador usan Playwright. En local, si Chromium está en otra ruta,
pásala por `CHROMIUM_PATH`:

```bash
CHROMIUM_PATH=/ruta/a/chrome pnpm test:e2e
```

Qué cubren, en resumen:

- **Contenido:** que las colecciones estén completas, que los iconos existan,
  que no haya `order` repetidos, que no se publiquen precios y que no queden
  restos de la plantilla original.
- **HTML generado:** que todas las rutas existan, que no haya enlaces internos
  rotos ni `href="#"`, que cada página tenga un solo `h1`, título y descripción
  propios, y que los formularios lleven el marcado que Netlify necesita.
- **Asistente:** que cada pregunta real recupere el hecho correcto, que ningún
  importe pase la barandilla, que el prompt imponga el trato de usted y que el
  endpoint derive a una persona cuando no hay clave o el proveedor falla. El
  modelo se sustituye por un doble: ningún test sale a la red.
- **Navegador:** los filtros del catálogo, el buscador sin tildes, el cotizador
  completo (acumular, no duplicar, quitar, mensaje de WhatsApp, foco atrapado,
  cerrar con Escape), el envío del formulario con su alternativa por WhatsApp,
  el menú móvil, el encogido de la barra al bajar, el hero a pantalla completa,
  el cotizador desde la barra, la burbuja del asistente y que ninguna página
  desborde horizontalmente.
- **Accesibilidad:** axe sobre nueve páginas, exigiendo cero violaciones serias
  o críticas de WCAG 2.1 AA.

---

## Despliegue

El repositorio está conectado a Netlify. `netlify.toml` define el comando de
build, la carpeta publicada (`dist`), la carpeta de funciones
(`netlify/functions`), las cabeceras de seguridad y el cacheado.

La CSP es una lista blanca y enumera uno a uno los dominios de terceros que el
sitio usa: el iframe del mapa de la sede, el píxel de Meta y la etiqueta de
Google. **Si se agrega otro servicio externo hay que añadir su dominio a la
cabecera, o quedará bloqueado en silencio**: la página se ve perfecta y la
herramienta no recibe nada. El asistente no necesitó tocarla: llama a
`/api/chat`, que es el propio dominio, y el proveedor se llama desde el
servidor, no desde el navegador.

---

## Pendientes

- **Fotografías.** Las familias y categorías ya tienen foto, salida del listado
  de precios. Faltan referencias sueltas que el listado no identifica sin
  ambigüedad (tubulares 2 y 3, rotor Ref. 01 y 3, tornillo 9, ancla mini y 1,
  espiral 33 cms, plano BC 42, candado, dentado doble cierre 39 cms) y no hay
  ninguna foto de rastreo satelital: en el Excel esa hoja solo trae una captura
  de la tabla de precios.
- **Logo para fondo oscuro.** El actual tiene letras negras y grises; en modo
  oscuro se dibuja sobre una base blanca como solución provisional.
- **Política de datos.** El texto es un borrador conforme a la ley, pero
  necesita revisión de un abogado, la dirección física, la fecha de entrada en
  vigencia y verificar si hay que inscribir las bases de datos en el RNBD.
- **Razón social.** El logo dice «S.A.S.» y el sitio anterior decía «Ltda.»;
  falta confirmar cuál es la vigente.
- **Verificar la medición en producción.** Con el sitio ya publicado en su
  dominio definitivo, conviene comprobar el píxel con la extensión **Meta Pixel
  Helper** y la etiqueta de Google en **Analytics → Administrar → Flujos de
  datos**. Y añadir el dominio nuevo a los **dominios verificados** del
  portafolio comercial de Meta, o los eventos de ese dominio se descartan.
- **Conversiones en el Administrador de anuncios.** Los eventos ya llegan, pero
  hay que decirle a Meta cuál optimizar (`Lead`) y marcar en GA4
  `generate_lead` como conversión. Sin eso se miden pero no se optimiza nada.
