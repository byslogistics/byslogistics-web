/**
 * Genera las versiones del logo para fondo oscuro.
 *
 * POR QUÉ EXISTE ESTE SCRIPT. La empresa entrega el logo en una sola versión,
 * pensada para papel: letras negras y grises con el azul de marca. Sobre el
 * fondo oscuro del sitio esa versión no se lee, y la solución anterior era
 * dibujarla sobre una base blanca dentro del navbar — un recuadro blanco con
 * un logo negro dentro, que es justo lo que la clienta pidió quitar.
 *
 * En vez de retocar dos PNG a mano y que nadie sepa cómo se hicieron, la
 * conversión vive aquí: se corre cuando cambie el logo original y vuelve a
 * salir la variante oscura exactamente igual.
 *
 *   node scripts/make-dark-logo.mjs
 *
 * QUÉ HACE CON CADA COLOR. El alfa no se toca nunca —es lo que mantiene el
 * fondo transparente—, y solo se reasigna el color:
 *
 *   · Negro y grises  →  blanco y gris claro. Es la inversión de luminosidad
 *     que hace legible el logotipo; conserva el contraste relativo entre
 *     «B&S» (negro) y «LOGISTICS» (gris), que es lo que jerarquiza la marca.
 *   · Azul de marca   →  el mismo azul, aclarado hasta `brand-300`. Sobre
 *     `neutral-900` el `#0060A8` original queda casi invisible; subirlo de
 *     tono es lo que salva el color corporativo en lugar de blanquearlo.
 *
 * `logo-navbar.png` es monocromo (negro puro), así que sale blanco puro.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/images/brand'
);

/** Los archivos que hay que convertir, y cómo se llama su versión oscura. */
const VARIANTES = [
  { origen: 'logo.png', destino: 'logo-oscuro.png' },
  { origen: 'logo-navbar.png', destino: 'logo-navbar-oscuro.png' },
];

/** `brand-300` (#79bce4): el azul de marca subido de tono para fondo oscuro. */
const AZUL_CLARO = [0x79, 0xbc, 0xe4];

/**
 * ¿Es este píxel el azul de marca y no una letra gris?
 *
 * El criterio es la distancia entre canales, no un valor exacto: el PNG viene
 * con antialias, así que el borde de cada letra azul pasa por decenas de
 * tonos intermedios y ninguno coincide con `#0060A8`.
 */
const esAzul = (r, g, b) => b > r + 24 && b > 60 && g >= r;

/** Invierte la luminosidad conservando el gris: negro → blanco, gris → gris claro. */
const aclarar = valor => 255 - Math.round(valor * 0.72);

async function convertir({ origen, destino }) {
  const entrada = path.join(BRAND, origen);
  const salida = path.join(BRAND, destino);

  const { data, info } = await sharp(entrada)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    // Un píxel transparente no tiene color que convertir, y tocarlo solo
    // ensucia el archivo.
    if (data[i + 3] === 0) continue;

    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (esAzul(r, g, b)) {
      [data[i], data[i + 1], data[i + 2]] = AZUL_CLARO;
    } else {
      const luz = aclarar(Math.round((r + g + b) / 3));
      data[i] = luz;
      data[i + 1] = luz;
      data[i + 2] = luz;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(salida);

  console.log(`${origen} → ${destino} (${info.width}x${info.height})`);
}

for (const variante of VARIANTES) await convertir(variante);
