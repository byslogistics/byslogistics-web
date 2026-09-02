# 📤 SUBIR-CONTENIDO

Esta carpeta es el buzón de entrada para el contenido nuevo (fotos, logos,
banners, lo que sea) que subas para actualizar la página web.

## Cómo funciona

1. Sube aquí las imágenes, en cualquier cantidad y sin organizarlas — eso lo
   hace la IA.
2. Pídele a la IA (Claude u otro asistente conectado a este repositorio)
   algo como: «sube esto que dejé en 📤SUBIR-CONTENIDO» o «actualiza el logo
   con la imagen que subí».
3. La IA encuentra los archivos aquí, identifica qué son (logo, banner,
   foto de producto, foto de fondo, etc.), los mueve a la carpeta correcta
   del proyecto y los conecta donde deban aparecer.
4. Al terminar, esta carpeta vuelve a quedar vacía (solo con este README),
   lista para la próxima tanda.

## Caso aparte: las reseñas de Google

Esta carpeta también es por donde entran las **opiniones de clientes** que se
ven en la portada. No son fotos, así que no las mueve nadie a mano: se dejan
aquí y un comando las publica.

### 1. Sacar las reseñas de Google

Google no ofrece ninguna forma pública de descargar TODAS las reseñas de un
negocio —su API devuelve cinco como mucho—, así que hay que copiarlas de la
ficha. Dos maneras, de más rápida a más segura:

**a) Con el fragmento (todas de una vez).** En un computador, con Chrome:

1. Abra la ficha del negocio en Google Maps y pulse en el número de reseñas
   para abrir el panel.
2. Baje dentro de ese panel hasta el final, hasta que deje de cargar más.
   Es importante: solo se copia lo que esté cargado.
3. Abra la consola del navegador (tecla `F12`, pestaña «Consola») y pegue esto,
   y luego Enter:

```js
copy(
  JSON.stringify(
    [...document.querySelectorAll('div[data-review-id][aria-label]')]
      .map(n => ({
        autor: n.getAttribute('aria-label'),
        estrellas: Number(
          (
            n
              .querySelector('[role="img"][aria-label*="estrella"]')
              ?.getAttribute('aria-label') || ''
          ).match(/\d/)?.[0] || 5
        ),
        cuando: n.querySelector('.rsqaWe, .DU9Pgb span')?.textContent?.trim(),
        texto: (n.querySelector('.wiI7pd, .MyEned')?.textContent || '').trim(),
      }))
      .filter(r => r.texto),
    null,
    2
  )
);
```

4. Eso deja las reseñas copiadas en el portapapeles. Péguelas en un archivo
   llamado **`resenas.json`** y súbalo a esta carpeta.

Si el fragmento devuelve una lista vacía es porque Google volvió a cambiar el
nombre de sus clases —lo hace cada tanto—; use la forma b).

**b) A mano.** Cree un archivo **`resenas.txt`** en esta carpeta con una reseña
por bloque, separados por una línea en blanco:

```
Daniel Molina | 5 | hace 2 meses
Su asesoría al momento de elegir el producto que mejor se adaptara a las
necesidades de mi empresa fue clave. Los recomiendo.

Otro Cliente | 4 |
El texto de la otra reseña.
```

La primera línea es `autor | estrellas | cuándo`, y lo de «cuándo» puede ir
vacío. Lo que sigue, hasta la línea en blanco, es el texto.

### 2. Publicarlas

```
node scripts/importar-resenas.mjs
pnpm format:fix
```

El primer comando reescribe `src/data_files/opiniones.ts` y retira el archivo
del buzón; el segundo deja el formato como lo pide el proyecto.

### La regla que no puede saltarse

**Lo que se publique tiene que ser lo que está en Google, tal cual.** Sin
arreglar la redacción, sin corregir faltas y sin dejar fuera la reseña menos
favorable. Cada tarjeta de la portada enlaza a la ficha de Google, así que
cualquiera puede comprobarla en dos clics: una reseña que no coincida con la
de allá hace más daño que no tener la sección.

## Reglas fijas (no cambian)

- Esta carpeta se llama siempre `📤SUBIR-CONTENIDO`. No se renombra ni se
  borra, aunque quede vacía.
- Nunca es el destino final de una imagen: es solo la sala de espera.
  Ninguna página del sitio debe apuntar a un archivo de aquí.
- Un test (`tests/upload-content.test.js`) verifica que la carpeta y este
  README sigan existiendo.

## Para la IA que procese este contenido

Las instrucciones de a dónde va cada tipo de archivo están en la sección
**«Carpeta de subida de contenido (📤SUBIR-CONTENIDO)»** de
[AI_GUIDE.md](../AI_GUIDE.md).
