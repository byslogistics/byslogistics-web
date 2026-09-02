/**
 * Revela lo que va entrando en pantalla.
 *
 * Es la mitad en JavaScript de la aparición al hacer scroll; la otra mitad
 * —el estado inicial, las variantes y los retrasos— vive en el bloque
 * «APARICIÓN AL HACER SCROLL» de `src/assets/styles/global.css`, que es donde
 * está explicado cómo se usa. Aquí solo se decide CUÁNDO.
 *
 * Con `IntersectionObserver`, no escuchando el scroll: el navegador ya sabe
 * qué está a la vista y lo resuelve fuera del hilo principal. Escuchando el
 * scroll habría que medir cada elemento en cada fotograma, que es justo el
 * tipo de código que hace que una página con animaciones vaya peor que una
 * sin ellas.
 *
 * CADA ELEMENTO SE REVELA UNA VEZ Y SE DEJA DE MIRAR. Volver a esconderlo al
 * salir por arriba suena elegante y en la práctica marea: al subir por la
 * página todo vuelve a desaparecer y reaparecer.
 */

/*
 * Lo que se anima. Dos familias, las mismas que declara el CSS:
 *   · lo marcado a mano con `data-anim` (menos el `no`, que es la salida);
 *   · toda sección hija de `<main>` salvo la primera, que está sobre el
 *     pliegue y no debe esconderse.
 */
const SELECTOR = [
  '[data-anim]:not([data-anim="no"])',
  'main[data-anim-scope] > section:not(:first-child):not([data-anim])',
].join(', ');

/** Un pellizco de margen abajo: la aparición arranca cuando el elemento ya
 *  entró de verdad, no cuando asoma un píxel por el borde. */
const MARGEN = '0px 0px -10% 0px';

let observador;

function revelar(elemento) {
  elemento.classList.add('anim-dentro');
}

export function initAparecer() {
  const elementos = document.querySelectorAll(SELECTOR);
  if (elementos.length === 0) return;

  // Sin IntersectionObserver no hay animación, pero tampoco contenido
  // escondido: se revela todo de golpe y se acabó.
  if (!('IntersectionObserver' in window)) {
    for (const elemento of elementos) revelar(elemento);
    return;
  }

  observador ??= new IntersectionObserver(
    entradas => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        revelar(entrada.target);
        observador.unobserve(entrada.target);
      }
    },
    { rootMargin: MARGEN, threshold: 0 }
  );

  for (const elemento of elementos) {
    if (elemento.classList.contains('anim-dentro')) continue;
    observador.observe(elemento);
  }

  /*
   * El seguro que apaga el respaldo de MainLayout: en cuanto esto corre, hay
   * quien revele lo escondido, así que ya no hace falta que nadie quite la
   * clase `anim-js` por si el módulo no llegó.
   */
  document.documentElement.dataset.animListo = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAparecer);
} else {
  initAparecer();
}

document.addEventListener('astro:page-load', initAparecer);
