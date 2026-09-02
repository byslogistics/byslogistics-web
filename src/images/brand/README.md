# Logo e imágenes de marca

Archivos de marca de B&S Logistics. Todo lo que se ponga en esta carpeta lo
procesa y optimiza Astro automáticamente.

## Logo

Cuatro archivos, todos de 1600 x 839 px y con fondo transparente. Los usa
`src/components/BrandLogo.astro`, que muestra el logo en el encabezado y en
el pie de página de todas las páginas.

| Archivo                  | Dónde se ve                    |
| ------------------------ | ------------------------------ |
| `logo.png`               | Pie de página, en modo claro.  |
| `logo-oscuro.png`        | Pie de página, en modo oscuro. |
| `logo-navbar.png`        | Barra de navegación, claro.    |
| `logo-navbar-oscuro.png` | Barra de navegación, oscuro.   |

**Los originales son los dos primeros de cada pareja**: `logo.png` y
`logo-navbar.png`, que son los que entrega la empresa. Para cambiar el logo se
reemplaza ese archivo conservando su nombre y después se corre:

```
node scripts/make-dark-logo.mjs
```

Ese script vuelve a generar las dos versiones `-oscuro`, que no se editan a
mano: aclara las letras negras y grises y sube de tono el azul de marca, que
sobre fondo oscuro queda ilegible en su `#0060A8` original. Si se cambia el
logo y no se corre el script, el modo oscuro se queda enseñando el logo viejo.

Si algún día hay una versión en SVG, es preferible: escala sin perder nitidez
(y entonces las variantes oscuras se pueden resolver con CSS, sin script).

## Colores

Los colores salen del logo y viven en un solo sitio: la rampa
`--color-brand-*` dentro del bloque `@theme` de
`src/assets/styles/global.css`.

| Color | Hex       | Dónde está                           |
| ----- | --------- | ------------------------------------ |
| Azul  | `#0060A8` | `brand-600`. Botones y enlaces.      |
| Gris  | `#848484` | Cubierto por las rampas `neutral-*`. |
| Negro | `#181818` | Cubierto por las rampas `neutral-*`. |

Cambiar el color de la marca es cambiar esos once valores y nada más: todos
los componentes usan las clases `brand-*`.

## Fotografías

Las fotos de producto y de operación **no** van en esta carpeta, sino en
`src/images/`. Hacen falta:

- Imagen principal para el encabezado de la página de inicio
- Una foto por familia de producto (campo `cardImage` en los archivos de
  `src/content/soluciones/`)
- Una foto por categoría de precinto (campo `cardImage` en
  `src/content/precintos/`)
- Fotos por referencia del catálogo (campo `image` dentro de `products`)
- Fotos para la página `Nosotros`

Las páginas ya están preparadas para recibirlas: mientras el campo esté
vacío, simplemente no se muestra ninguna imagen.
