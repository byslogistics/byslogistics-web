/**
 * La carpeta de subida de contenido (📤SUBIR-CONTENIDO) es el buzón donde
 * la clienta deja fotos para que la IA las reubique. Su nombre y su README
 * no se tocan, aunque el resto del contenido vaya y venga.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CARPETA = '📤SUBIR-CONTENIDO';
const P = (...p) => join(ROOT, ...p);

describe('carpeta de subida de contenido', () => {
  test('existe con su nombre exacto', () => {
    assert.ok(
      existsSync(P(CARPETA)),
      `falta la carpeta "${CARPETA}" en la raíz del repositorio`
    );
  });

  test('conserva su README con las instrucciones', () => {
    const readme = P(CARPETA, 'README.md');
    assert.ok(existsSync(readme), `falta ${CARPETA}/README.md`);
    const contenido = readFileSync(readme, 'utf8');
    assert.match(
      contenido,
      /AI_GUIDE\.md/,
      'el README debe remitir a AI_GUIDE.md'
    );
  });
});
