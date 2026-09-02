/**
 * El logotipo de la empresa, en una URL que no cambia: /logo.png
 *
 * ES EL QUE GOOGLE ENSEÑA. Los datos estructurados de `Organization`
 * (ver `SEO.organizacion` en constants.ts) apuntan aquí con su campo `logo`, y
 * es la imagen que el buscador usa para representar a la empresa —en el panel
 * de conocimiento y donde muestre la marca—. Google pide tres cosas de ella, y
 * las tres se resuelven aquí:
 *
 *   1. **Una URL estable.** El `logo.png` de `src/images/brand/` lo publica
 *      Astro con un hash en el nombre, y ese hash cambia en cada compilación.
 *      Este endpoint no.
 *   2. **Al menos 112 x 112 px**, y que se lea. Va a 1200 px de ancho.
 *   3. **Sin transparencia**, porque Google lo compone sobre fondos que no
 *      controla. Se aplana sobre blanco, que es el fondo para el que está
 *      dibujado el logo original.
 *
 * Se usa la versión de siempre (`logo.png`), no la de la barra ni la de fondo
 * oscuro: es el logotipo completo de la marca, con su azul.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import path from 'node:path';

const origen = path.resolve('src/images/brand/logo.png');

export const GET: APIRoute = async () => {
  const png = await sharp(origen)
    .resize({ width: 1200, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
