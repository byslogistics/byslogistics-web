/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * La medición del sitio (src/assets/scripts/analytics.js) publica una sola
 * función global, y los scripts de las páginas la llaman por ahí. Es opcional
 * a propósito: no existe en local, ni mientras la página se pre-renderiza, ni
 * cuando un bloqueador la corta, así que siempre se llama con `?.`.
 *
 * Los datos son libres porque cada evento lleva los suyos: el catálogo manda
 * un término de búsqueda, el cotizador una lista de referencias y el
 * formulario un objeto `contacto`. El diccionario de analytics.js es el que
 * sabe qué espera cada uno.
 */
interface Window {
  bysTrack?: (evento: string, datos?: Record<string, unknown>) => void;
}
