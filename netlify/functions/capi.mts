import { createHash } from 'node:crypto';

/**
 * API de Conversiones de Meta (CAPI). Se publica en /api/capi.
 *
 * QUÉ RESUELVE. El píxel del navegador se pierde eventos por razones que no
 * dependen del sitio: bloqueadores de anuncios, la prevención de rastreo de
 * Safari, una pestaña que se cierra antes de que salga la petición. Lo que
 * cuenta este endpoint sale del servidor, donde nada de eso aplica. Los dos
 * caminos mandan lo mismo, y Meta se queda con una sola copia porque ambos
 * llevan el MISMO `event_id`: eso es la deduplicación, y sin ella cada
 * conversión se contaría dos veces.
 *
 *     navegador (fbq)  ──┐
 *                        ├── mismo event_id ──► Meta se queda con uno
 *     este endpoint   ───┘
 *
 * POR QUÉ EXISTE ESTE INTERMEDIARIO. El token de CAPI da permiso para escribir
 * en el conjunto de datos de la empresa. En un sitio estático no hay dónde
 * guardarlo salvo aquí: si viajara al navegador, cualquiera podría leerlo del
 * código y mandar eventos falsos a la cuenta. El token vive solo en las
 * variables de entorno de Netlify y no sale de esta función.
 *
 * Variables de entorno (panel de Netlify, NUNCA en el repositorio):
 *   META_CAPI_ACCESS_TOKEN  el token generado en Events Manager. Sin él, el
 *                           endpoint responde 200 y no manda nada: el sitio
 *                           sigue funcionando y el píxel del navegador sigue
 *                           midiendo por su cuenta.
 *   META_PIXEL_ID           opcional. Por defecto, el mismo píxel del sitio.
 *   META_API_VERSION        opcional. Ver `API_VERSION`, más abajo.
 *   META_TEST_EVENT_CODE    opcional y SOLO para probar. Ver la nota al pie.
 *
 * Los tipos de Netlify se declaran aquí en lugar de importar
 * `@netlify/functions`, por el mismo motivo que en chat.mts: no sumar una
 * dependencia entera por una interfaz de dos líneas.
 */

interface NetlifyContext {
  ip?: string;
}

/**
 * El píxel del sitio. Está repetido aquí y en `ANALYTICS` (constants.ts)
 * porque son dos mundos que no se importan entre sí: uno se compila con Astro
 * y el otro lo empaqueta Netlify. Hay un test que comprueba que digan lo
 * mismo, que es la forma barata de que no se separen.
 */
const PIXEL_POR_DEFECTO = '1059859873468241';

/**
 * Versión de la Graph API.
 *
 * Meta mantiene cada versión unos dos años y luego la retira; cuando eso pasa,
 * las llamadas empiezan a fallar y los eventos dejan de llegar en silencio. Por
 * eso es una variable de entorno: subirla no exige tocar código ni desplegar,
 * basta cambiarla en el panel de Netlify.
 *
 * Al elegir una nueva, la lista está en
 * developers.facebook.com/docs/graph-api/changelog.
 */
const API_VERSION = process.env.META_API_VERSION || 'v21.0';

/* ------------------------------------------------------------------ *
 * Qué se acepta
 * ------------------------------------------------------------------ */

/**
 * Los eventos que este sitio manda, y ninguno más.
 *
 * NO ES UNA FORMALIDAD. Este endpoint escribe en el conjunto de datos de la
 * empresa, y está abierto a internet. Sin esta lista, cualquiera que descubra
 * la ruta puede meter compras de un millón de pesos en la cuenta y envenenar
 * la optimización de las campañas —que es justo el problema por el que se
 * cambió de píxel—. Un evento que no esté aquí se descarta sin llegar a Meta.
 *
 * Si mañana el sitio empieza a medir algo nuevo, va en dos sitios: en el
 * diccionario de `src/assets/scripts/analytics.js` y aquí. Hay un test que
 * comprueba que las dos listas coincidan.
 */
const EVENTOS_PERMITIDOS = new Set([
  'PageView',
  'ViewContent',
  'ViewCategory',
  'Search',
  'AddToCart',
  'InitiateCheckout',
  'Lead',
  'CompleteRegistration',
  'Contact',
]);

/* ------------------------------------------------------------------ *
 * Normalización y hasheo
 * ------------------------------------------------------------------ */

/** Quita tildes y pasa a minúscula. Igual que `normalize` en @utils/text. */
const sinTildes = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * SHA-256 en hexadecimal, que es como Meta espera los datos personales.
 *
 * El hasheo ocurre AQUÍ y no en el navegador a propósito: así el dato en claro
 * no pasa por el código que cualquiera puede leer, y la normalización —que es
 * la mitad del trabajo, porque «Juan@Correo.COM » y «juan@correo.com» tienen
 * que dar el mismo hash o la coincidencia falla— se hace en un solo sitio.
 */
const hash = (valor: string | undefined) =>
  valor ? createHash('sha256').update(valor).digest('hex') : undefined;

/**
 * Teléfono en el formato que Meta espera: solo dígitos, con indicativo de país
 * y sin el «+».
 *
 * En el formulario del sitio la gente escribe «320 951 4930» o
 * «(601) 469 9575», sin indicativo, porque está escribiendo desde Colombia.
 * Mandarlo así no coincide con nada: Meta guarda los teléfonos con indicativo.
 * Por eso los números colombianos de diez dígitos —celulares, que empiezan por
 * 3— y los fijos de siete se completan con el 57. Cualquier otra longitud se
 * manda tal cual: ya trae indicativo, o no es un teléfono y no va a coincidir
 * de todos modos.
 */
function telefono(valor: string): string | undefined {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 7) return undefined;
  if (digitos.length === 10 && digitos.startsWith('3')) return `57${digitos}`;
  if (digitos.length === 7) return `57${digitos}`;
  return digitos;
}

interface ContactoEntrante {
  email?: string;
  telefono?: string;
  nombre?: string;
  fbp?: string;
  fbc?: string;
}

/**
 * Arma el `user_data` del evento.
 *
 * QUÉ SE HASHEA Y QUÉ NO. Los datos personales van hasheados; los
 * identificadores que Meta necesita leer tal cual —la IP, el navegador y sus
 * dos cookies— van en claro. No es una elección: mandar `fbp` hasheado es
 * mandarlo roto, y Meta lo descarta sin avisar.
 *
 * El nombre se parte por el primer espacio. Es una heurística, y en «María
 * José Gómez Ruiz» se equivoca; da igual, porque el apellido solo suma cuando
 * acierta y nunca resta cuando falla: Meta cruza cada campo por separado.
 */
function datosDeUsuario(
  contacto: ContactoEntrante,
  ip: string | undefined,
  userAgent: string | undefined
) {
  const nombre = contacto.nombre ? sinTildes(contacto.nombre) : '';
  const [pila, ...resto] = nombre.split(/\s+/).filter(Boolean);
  const apellido = resto.join(' ');
  const tel = contacto.telefono ? telefono(contacto.telefono) : undefined;

  const datos: Record<string, unknown> = {
    em: contacto.email ? [hash(sinTildes(contacto.email))] : undefined,
    ph: tel ? [hash(tel)] : undefined,
    fn: pila ? [hash(pila)] : undefined,
    ln: apellido ? [hash(apellido)] : undefined,
    // Sin hashear, por diseño de Meta.
    client_ip_address: ip,
    client_user_agent: userAgent,
    fbp: contacto.fbp,
    fbc: contacto.fbc,
  };

  // Meta rechaza el evento entero si un campo llega vacío o nulo, así que las
  // claves sin valor no se mandan.
  for (const clave of Object.keys(datos)) {
    if (datos[clave] === undefined || datos[clave] === '') delete datos[clave];
  }
  return datos;
}

/* ------------------------------------------------------------------ *
 * Guardias
 * ------------------------------------------------------------------ */

/**
 * Solo se atiende lo que venga del propio sitio. Mismo criterio y mismos
 * límites que en chat.mts: no es autenticación —un `Origin` se falsifica con
 * curl—, es quitar de en medio el abuso barato. Lo que acota de verdad es el
 * tope por minuto y por día de más abajo.
 */
function origenPermitido(req: Request): boolean {
  const propio = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === propio;

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === propio;
    } catch {
      return false;
    }
  }
  return false;
}

const golpes = new Map<string, number[]>();
const VENTANA_MS = 60_000;
/**
 * Más alto que el del asistente porque aquí un visitante normal dispara varios
 * eventos seguidos: abre el catálogo, busca, añade dos referencias y abre el
 * cotizador. Sesenta por minuto deja pasar eso de sobra y corta un bucle.
 */
const MAX_POR_VENTANA = 60;

function demasiadoRapido(ip: string): boolean {
  const ahora = Date.now();
  const previos = (golpes.get(ip) ?? []).filter(t => ahora - t < VENTANA_MS);
  previos.push(ahora);
  golpes.set(ip, previos);
  if (golpes.size > 500) golpes.clear();
  return previos.length > MAX_POR_VENTANA;
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

interface EventoEntrante {
  event_name?: string;
  event_id?: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
  user_data?: ContactoEntrante;
}

export default async (req: Request, context: NetlifyContext) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!origenPermitido(req)) return json({ error: 'Origen no permitido' }, 403);

  const ip =
    context?.ip || req.headers.get('x-nf-client-connection-ip') || undefined;
  if (demasiadoRapido(ip ?? 'anon')) return json({ error: 'Muy rápido' }, 429);

  const token = process.env.META_CAPI_ACCESS_TOKEN;
  /*
   * Sin token no se manda nada, y se responde que todo va bien.
   *
   * Es lo correcto y no una dejadez: en una preview de Netlify sin la variable
   * configurada, el visitante no tiene por qué ver errores en la consola, y el
   * píxel del navegador sigue midiendo por su cuenta. `enviado: false` deja
   * dicho en la respuesta que esto no llegó a Meta, para quien lo esté
   * depurando.
   */
  if (!token) return json({ enviado: false, motivo: 'sin token' });

  let entrante: EventoEntrante;
  try {
    entrante = (await req.json()) as EventoEntrante;
  } catch {
    return json({ error: 'Cuerpo no válido' }, 400);
  }

  const nombre = entrante.event_name;
  if (!nombre || !EVENTOS_PERMITIDOS.has(nombre)) {
    return json({ error: 'Evento no permitido' }, 400);
  }
  if (!entrante.event_id) {
    // Sin `event_id` no hay deduplicación posible, y el evento se contaría dos
    // veces: una por el navegador y otra por aquí. Mejor no mandarlo.
    return json({ error: 'Falta event_id' }, 400);
  }

  const evento = {
    event_name: nombre,
    event_time: Math.floor(Date.now() / 1000),
    event_id: entrante.event_id,
    event_source_url: entrante.event_source_url,
    action_source: 'website',
    user_data: datosDeUsuario(
      entrante.user_data ?? {},
      ip,
      req.headers.get('user-agent') ?? undefined
    ),
    custom_data: entrante.custom_data,
  };

  const cuerpo: Record<string, unknown> = { data: [evento] };
  /*
   * El código de eventos de prueba manda lo que llegue a la pestaña «Eventos
   * de prueba» de Events Manager EN LUGAR de a los informes. Es lo que se usa
   * para verificar la integración, y hay que quitarlo antes de producción o la
   * medición real no registra nada.
   */
  if (process.env.META_TEST_EVENT_CODE) {
    cuerpo.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  const pixel = process.env.META_PIXEL_ID || PIXEL_POR_DEFECTO;
  const url = `https://graph.facebook.com/${API_VERSION}/${pixel}/events`;

  try {
    /*
     * El token va en el cuerpo y no en la query, que es donde lo pone el
     * ejemplo de la documentación: una URL con el token dentro termina en los
     * registros de acceso de cualquier intermediario, y ahí ya no se puede
     * borrar.
     */
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...cuerpo, access_token: token }),
    });
    const resultado = (await res.json()) as {
      events_received?: number;
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      // Se registra el motivo en los logs de Netlify, pero al navegador solo
      // se le dice que falló: la respuesta de Meta puede describir la
      // configuración de la cuenta, y esto lo lee cualquiera.
      console.error('CAPI rechazado por Meta:', res.status, resultado?.error);
      return json({ enviado: false, motivo: 'rechazado' }, 502);
    }

    return json({ enviado: true, recibidos: resultado?.events_received ?? 0 });
  } catch (error) {
    console.error('CAPI no pudo llamar a Meta:', error);
    return json({ enviado: false, motivo: 'sin conexión' }, 502);
  }
};

export const config = { path: '/api/capi' };
