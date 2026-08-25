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
