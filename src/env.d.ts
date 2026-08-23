/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * La medición del sitio (src/assets/scripts/analytics.js) publica una sola
 * función global, y los scripts de las páginas la llaman por ahí. Es opcional
 * a propósito: no existe en local, ni mientras la página se pre-renderiza, ni
 * cuando un bloqueador la corta, así que siempre se llama con `?.`.
 */
interface Window {
  bysTrack?: (
    evento: string,
    datos?: Record<string, string | number | string[] | undefined>
  ) => void;
}
