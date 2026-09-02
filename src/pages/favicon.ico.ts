import type { APIRoute } from 'astro';
import sharp from 'sharp';
import ico from 'sharp-ico';
import path from 'node:path';

const faviconSrc = path.resolve('src/images/icon.png');

export const GET: APIRoute = async () => {
  /*
   * 16, 32 y 48. El 48 no es un extra: Google recomienda que el favicon sea un
   * cuadrado múltiplo de 48 px, y con solo 16 y 32 el resultado de búsqueda se
   * queda sin icono. Los tres van dentro del mismo .ico, que es un contenedor
   * de varias medidas, y cada consumidor elige la suya.
   */
  const sizes = [16, 32, 48];

  const buffers = await Promise.all(
    sizes.map(async size => {
      return await sharp(faviconSrc).resize(size).toFormat('png').toBuffer();
    })
  );

  // Convert the image to an ICO file
  const icoBuffer = ico.encode(buffers);

  return new Response(new Uint8Array(icoBuffer), {
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
