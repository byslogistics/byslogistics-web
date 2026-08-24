/* global BYS */
/**
 * Medición del sitio: píxel de Meta y etiqueta de Google (GA4).
 *
 * ESTE ARCHIVO NO SE EMPAQUETA COMO LOS DEMÁS DE ESTA CARPETA. Lo lee
 * [Analytics.astro](../../components/Analytics.astro) con `?raw` y lo escribe
 * tal cual dentro de un `<script>` del `<head>`. Está aparte, y no metido en
 * la plantilla, solo para que siga siendo un archivo `.js` de verdad: con
 * resaltado, con Prettier y con un historial propio.
 *
 * De ahí dos consecuencias al editarlo:
 *
 *   - `BYS` no se importa: Analytics.astro lo escribe como un `const` justo
 *     encima de este código. Trae los identificadores, los hosts donde no se
 *     mide y el evento de la página.
 *   - Se escribe en JavaScript de toda la vida y sin `import`. Va inline en el
 *     `<head>`, antes que cualquier módulo, y ahí no hay empaquetador que
 *     traduzca nada.
 *
 * El resto de scripts del sitio no hablan con Meta ni con Google: llaman a
 * `window.bysTrack('nombre_del_evento', datos)` y este archivo traduce.
 */

(function () {
  // Existe siempre, incluso si la medición no arranca —en local, mientras la
  // página se pre-renderiza o si un bloqueador la corta—, para que quien la
  // llama no tenga que comprobar nada.
  window.bysTrack = function () {};

  // No se mide en el servidor de desarrollo ni en el que levantan las pruebas
  // de navegador: sin esto, cada `pnpm test:e2e` mandaría visitas y
  // conversiones falsas al píxel de producción.
  if (BYS.hostsSinMedicion.indexOf(location.hostname) !== -1) return;

  /*
   * Cada evento sale por dos caminos —el píxel del navegador y la API de
   * Conversiones, desde el servidor— con el MISMO identificador. Eso es lo que
   * permite a Meta quedarse con una sola copia; sin él, cada conversión se
   * contaría dos veces.
   *
   * Los dos caminos existen porque el del navegador se pierde eventos que no
   * dependen del sitio: bloqueadores, la prevención de rastreo de Safari, una
   * pestaña que se cierra antes de que salga la petición. Ver
   * netlify/functions/capi.mts.
   */
  function idDeEvento() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Navegadores viejos, o un contexto sin https. Con que sea único basta:
    // esto solo tiene que emparejar dos envíos de la misma visita.
    return 'bys-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function meta(nombre, datos, contacto) {
    var id = idDeEvento();
    if (window.fbq) window.fbq('track', nombre, datos || {}, { eventID: id });
    aServidor(nombre, datos, id, contacto);
  }

  function google(nombre, datos) {
    if (window.gtag) window.gtag('event', nombre, datos || {});
  }

  /* ---------------------------------------------------------------- *
   * El camino del servidor (API de Conversiones)
   * ---------------------------------------------------------------- */

  function cookie(nombre) {
    var trozos = ('; ' + document.cookie).split('; ' + nombre + '=');
    return trozos.length === 2 ? trozos.pop().split(';').shift() : '';
  }

  /**
   * El identificador del clic en el anuncio.
   *
   * Normalmente lo guarda el propio píxel en la cookie `_fbc`. Pero si es la
   * primera página de la visita, fbevents.js todavía puede no haber cargado, y
   * entonces la cookie no existe aunque el clic sí: el dato está en el
   * parámetro `fbclid` de la dirección. Reconstruirlo evita perder la
   * atribución justo en la visita que viene de una campaña, que es la única
   * que hay que atribuir.
   */
  function clicDeAnuncio() {
    var guardada = cookie('_fbc');
    if (guardada) return guardada;
    var fbclid = new URLSearchParams(location.search).get('fbclid');
    return fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '';
  }

  /**
   * Manda el evento al endpoint del sitio, que es quien habla con Meta.
   *
   * SE ESPERA A QUE EXISTA `_fbp`. Esa cookie la crea el píxel del navegador al
   * cargar, y es el identificador con el que Meta empareja los dos caminos.
   * Mandar el evento antes de que exista —cosa que pasa en la primera página
   * de cada visita, porque fbevents.js carga en diferido— es mandarlo sin la
   * mitad de su capacidad de coincidencia. Se espera lo justo: en cuanto
   * aparece, o dos segundos, lo que ocurra primero.
   *
   * `keepalive` es lo que permite que la petición sobreviva a un clic que se
   * lleva la página por delante, que es exactamente cuando se disparan los
   * eventos que más importan: enviar la cotización, pulsar WhatsApp.
   */
  function aServidor(nombre, datos, id, contacto) {
    // Si la medición de Meta está apagada, lo está entera: ni el píxel del
    // navegador ni el camino del servidor. Ver `ANALYTICS` en constants.ts.
    if (!BYS.pixel) return;

    var intentos = 0;
    (function esperar() {
      if (!cookie('_fbp') && intentos++ < 20) {
        setTimeout(esperar, 100);
        return;
      }
      var cuerpo = {
        event_name: nombre,
        event_id: id,
        event_source_url: location.href,
        custom_data: datos || {},
        user_data: {
          fbp: cookie('_fbp'),
          fbc: clicDeAnuncio(),
        },
      };
      // Los datos de contacto solo viajan cuando la persona acaba de
      // escribirlos en un formulario del sitio. Ver `enviar_formulario`.
      if (contacto) {
        cuerpo.user_data.email = contacto.email;
        cuerpo.user_data.telefono = contacto.telefono;
        cuerpo.user_data.nombre = contacto.nombre;
      }
      try {
        fetch('/api/capi', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cuerpo),
          keepalive: true,
        }).catch(function () {
          /* que falle la medición nunca debe romper la página */
        });
      } catch (e) {
        /* sin fetch, o bloqueado: el píxel del navegador sigue por su cuenta */
      }
    })();
  }

  /*
   * El diccionario de eventos: a la izquierda el nombre con el que los llama
   * el sitio, a la derecha cómo se llama lo mismo en cada plataforma.
   *
   * Los de Meta son los eventos estándar del píxel —los que el Administrador
   * de anuncios ofrece como objetivo de campaña sin tener que crear una
   * conversión personalizada—. Los de Google, los eventos recomendados de GA4,
   * que son los que alimentan los informes de comercio ya hechos.
   *
   * NINGUNO LLEVA IMPORTE. Este sitio no publica precios: se cotiza según
   * referencia, cantidad y personalización. Mandar un `value` inventado —o un
   * cero— daría informes de campaña con cifras que no existen.
   */
  var EVENTOS = {
    ver_producto: function (d) {
      meta('ViewContent', {
        content_type: 'product',
        content_ids: [d.id],
        content_name: d.nombre,
        content_category: d.categoria,
      });
      google('view_item', {
        items: [
          { item_id: d.id, item_name: d.nombre, item_category: d.categoria },
        ],
      });
    },

    ver_listado: function (d) {
      meta('ViewCategory', {
        content_type: 'product_group',
        content_name: d.nombre,
        content_category: d.categoria || d.nombre,
      });
      google('view_item_list', { item_list_name: d.nombre });
    },

    /*
     * `resultados` es el dato que más va a servir: una búsqueda que devuelve
     * cero es una palabra que el catálogo no entiende, y son las que hay que
     * ir agregando a la lista de sinónimos (src/data_files/sinonimos.ts). Va
     * en el evento de Google, que es donde se pueden cruzar las dos cosas.
     */
    buscar: function (d) {
      meta('Search', {
        search_string: d.termino,
        content_category: 'catalogo',
      });
      google('search', { search_term: d.termino, resultados: d.resultados });
    },

    anadir_a_cotizacion: function (d) {
      meta('AddToCart', {
        content_type: 'product',
        content_ids: [d.id],
        content_name: d.nombre,
        content_category: d.categoria,
      });
      google('add_to_cart', {
        items: [
          { item_id: d.id, item_name: d.nombre, item_category: d.categoria },
        ],
      });
    },

    abrir_cotizacion: function (d) {
      meta('InitiateCheckout', {
        content_type: 'product',
        content_ids: d.ids || [],
        num_items: d.referencias,
      });
      google('begin_checkout', { items: d.items || [] });
    },

    /*
     * Las dos conversiones del sitio. El evento de compra de Meta no aparece
     * en ninguna parte a propósito: aquí no se cierra una venta, se pide una
     * cotización, y declararla sin transacción ni importe le daría al
     * Administrador de anuncios un retorno inventado. «Lead» es el evento que
     * sabe optimizar para esto.
     */
    enviar_cotizacion: function (d) {
      meta('Lead', {
        content_name: 'Cotización por WhatsApp',
        content_ids: d.ids || [],
        num_items: d.referencias,
      });
      google('generate_lead', { method: 'cotizador_whatsapp' });
    },

    /*
     * Los dos únicos eventos que llevan datos de contacto, y solo por el
     * camino del servidor: la persona acaba de escribirlos en un formulario
     * del sitio. Van en claro hasta la función y salen de ahí hasheados con
     * SHA-256; el navegador nunca habla con Meta de esto. Es lo que sube la
     * calidad de coincidencia, que es la razón de ser de la API de
     * Conversiones. Ver netlify/functions/capi.mts y el numeral 4 de la
     * política de privacidad, que lo dice con estas mismas palabras.
     */
    enviar_formulario: function (d) {
      meta('Lead', { content_name: d.formulario }, d.contacto);
      google('generate_lead', { method: d.formulario });
    },

    suscripcion: function (d) {
      meta('CompleteRegistration', { content_name: 'Suscripción' }, d.contacto);
      google('sign_up', { method: 'newsletter' });
    },

    contacto_directo: function (d) {
      meta('Contact', { content_name: d.canal });
      google('contact', { method: d.canal });
    },
  };

  function arrancar() {
    if (BYS.pixel) {
      /* Snippet oficial del píxel de Meta, tal cual lo entrega Meta. */
      /* prettier-ignore */
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');

      window.fbq('init', BYS.pixel);
      // Por los dos caminos y con un solo identificador, como el resto.
      meta('PageView', {});
    }

    if (BYS.google) {
      var etiqueta = document.createElement('script');
      etiqueta.async = true;
      etiqueta.src =
        'https://www.googletagmanager.com/gtag/js?id=' + BYS.google;
      document.head.appendChild(etiqueta);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', BYS.google);
    }

    window.bysTrack = function (nombre, datos) {
      var evento = EVENTOS[nombre];
      if (evento) evento(datos || {});
    };

    // El evento que dispara la página por el hecho de abrirse, si lo declara.
    if (BYS.evento) {
      window.bysTrack(
        BYS.evento.tipo === 'producto' ? 'ver_producto' : 'ver_listado',
        BYS.evento
      );
    }

    /*
     * Llamar, escribir un correo o abrir WhatsApp son conversiones tan reales
     * como el formulario, y en este negocio pesan más. Se reconocen por el
     * destino del enlace, en un único oyente delegado, para que ningún botón
     * que se agregue mañana tenga que acordarse de medirse.
     *
     * El envío del cotizador no cae aquí: abre WhatsApp con `window.open`, no
     * con un enlace, y tiene su propio evento.
     */
    document.addEventListener('click', function (event) {
      var enlace = event.target.closest && event.target.closest('a[href]');
      if (!enlace) return;
      var destino = enlace.getAttribute('href') || '';
      var canal = '';
      if (/^https:\/\/(wa\.me|api\.whatsapp\.com)/.test(destino))
        canal = 'whatsapp';
      else if (destino.indexOf('tel:') === 0) canal = 'telefono';
      else if (destino.indexOf('mailto:') === 0) canal = 'correo';
      if (canal) window.bysTrack('contacto_directo', { canal: canal });
    });
  }

  /*
   * El sitio lleva `prefetch` y `clientPrerender` (astro.config.mjs): el
   * navegador construye en segundo plano la página del enlace que el visitante
   * está a punto de pulsar, y ejecuta sus scripts. Sin esperar a que la página
   * se active de verdad, pasar el ratón por encima de un enlace contaría como
   * una visita a una página que nadie llegó a ver.
   */
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', arrancar, { once: true });
  } else {
    arrancar();
  }
})();
