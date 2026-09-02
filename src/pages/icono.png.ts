/**
 * El icono del sitio, en una URL QUE NO CAMBIA: /icono.png
 *
 * POR QUÉ EXISTE, si `src/images/icon.png` ya estaba conectado. Porque Astro
 * lo publicaba en `/_astro/icon.<hash>.png`, y ese hash cambia con cada
 * compilación del archivo. Google pide expresamente que la dirección del
 * icono **se mantenga constante** para poder asociarlo al sitio: con una URL
 * que se mueve, cada rastreo encuentra un icono «nuevo», ninguno llega a
 * consolidarse y el resultado de búsqueda se queda con el globo gris que sale
 * cuando no hay favicon. Es exactamente lo que estaba pasando.
 *
 * Lo mismo vale para `/apple-touch-icon.png` y para `/logo.png`, que son
 * endpoints hermanos de este por el mismo motivo.
 *
 * 512 px porque Google recomienda un cuadrado múltiplo de 48 y prefiere que
 * sobre resolución a que falte; el navegador lo reduce sin problema.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import path from 'node:path';

const origen = path.resolve('src/images/icon.png');

export const GET: APIRoute = async () => {
  const png = await sharp(origen)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
