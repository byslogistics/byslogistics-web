/**
 * Icono para la pantalla de inicio de iOS, en una URL que no cambia.
 *
 * Mismo motivo que `/icono.png` (ver su cabecera): la ruta tiene que ser fija.
 * Y en este caso hay una razón más — Safari busca `/apple-touch-icon.png` en
 * la raíz del dominio por su cuenta, aunque la página no lo declare.
 *
 * 180 px es la medida que pide iOS. Va aplanado sobre blanco, sin
 * transparencia: iOS no la respeta, la rellena de negro, y el isotipo azul y
 * gris sobre negro se pierde.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import path from 'node:path';

const origen = path.resolve('src/images/icon.png');

export const GET: APIRoute = async () => {
  const png = await sharp(origen)
    .resize(180, 180, { fit: 'contain', background: '#ffffff' })
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
