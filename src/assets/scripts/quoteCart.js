/**
 * Cotizador. Acumula referencias con su cantidad y arma un mensaje de
 * WhatsApp con el listado.
 *
 * El sitio es estático, así que el carrito vive en localStorage del visitante:
 * no se envía a ningún servidor hasta que la persona pulsa "Enviar por
 * WhatsApp", y ahí sale como texto en el chat.
 *
 * La interacción con el DOM va por atributos data-*, para que el marcado lo
 * defina QuoteCart.astro y este archivo solo se ocupe de la lógica.
 *
 * Los tres momentos del cotizador se miden —añadir, abrir el panel y enviar—
 * llamando a `window.bysTrack`, que define analytics.js. Se llama con `?.`
 * porque puede no existir: en local no arranca y un bloqueador de anuncios lo
 * deja fuera. El cotizador tiene que seguir funcionando igual.
 */

const STORAGE_KEY = 'bys-cotizacion';
const DEFAULT_QTY = 1000;

/**
 * Los datos del solicitante, con la etiqueta con la que salen en el mensaje y
 * en el orden en que se escriben.
 *
 * Los seis primeros son los que pide el cotizador del hub, en su mismo orden,
 * para que el asesor pase la solicitud a la cotización formal sin volver a
 * preguntar nada. El marcado de los campos está en QuoteCart.astro, en la
 * constante `CAMPOS`: al tocar uno hay que tocar el otro.
 *
 * Ojo: los botones «Añadir» de las tarjetas llevan data-quote-name con el
 * nombre del producto, así que los campos del panel usan data-quote-field.
 */
const CAMPOS_CLIENTE = [
  ['company', 'Empresa'],
  ['nit', 'NIT o C.C.'],
  ['name', 'Nombre'],
  ['phone', 'Teléfono'],
  ['city', 'Ciudad'],
  ['email', 'Correo'],
  ['notes', 'Observaciones'],
];

/** @typedef {{id: string, name: string, group: string, qty: number}} QuoteLine */

/** @returns {QuoteLine[]} */
function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      line =>
        line && typeof line.id === 'string' && typeof line.name === 'string'
    );
  } catch {
    // localStorage puede estar bloqueado (modo privado, cookies de terceros).
    return [];
  }
}

/** @param {QuoteLine[]} lines */
function write(lines) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* sin persistencia; el carrito sigue funcionando en esta pestaña */
  }
}

let lines = read();

function totalUnits() {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-CO').format(value);
}

function render() {
  const count = lines.length;

  for (const el of document.querySelectorAll('[data-quote-count]')) {
    el.textContent = String(count);
  }
  for (const el of document.querySelectorAll('[data-quote-toggle]')) {
    el.hidden = count === 0;
  }
  for (const el of document.querySelectorAll('[data-quote-empty]')) {
    el.hidden = count > 0;
  }
  for (const el of document.querySelectorAll('[data-quote-filled]')) {
    el.hidden = count === 0;
  }
  for (const el of document.querySelectorAll('[data-quote-total]')) {
    el.textContent = formatNumber(totalUnits());
  }

  // Los botones "Añadir" de las tarjetas reflejan si ya está en la cotización
  const inCart = new Set(lines.map(line => line.id));
  for (const btn of document.querySelectorAll('[data-quote-add]')) {
    const added = inCart.has(btn.dataset.quoteAdd);
    btn.dataset.added = added ? 'true' : 'false';
    const label = btn.querySelector('[data-quote-add-label]');
    if (label) label.textContent = added ? 'En la cotización' : 'Añadir';
  }

  const list = document.querySelector('[data-quote-list]');
  if (!list) return;
  list.replaceChildren();

  for (const line of lines) {
    const item = document.createElement('li');
    // Cada referencia es una tarjeta, no un renglón separado por una línea:
    // el panel flota sobre la página y una lista de renglones sueltos se leía
    // como una tabla pegada ahí dentro.
    item.className =
      'rounded-2xl border border-neutral-900/10 bg-white/70 p-3.5 dark:border-white/10 dark:bg-neutral-800/60';
    item.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="min-w-0 grow">
          <p class="text-sm font-bold leading-snug text-neutral-800 dark:text-neutral-100" data-linea-nombre></p>
          <p class="mt-0.5 truncate text-xs text-neutral-600 dark:text-neutral-400" data-linea-grupo></p>
        </div>
        <button
          type="button"
          data-quote-remove="${line.id}"
          aria-label="Quitar de la cotización"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 outline-hidden transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-3 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mt-3 flex items-center justify-between gap-3">
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-400" for="qty-${line.id}">Cantidad</label>
        <div class="flex items-center gap-x-2">
          <input
            id="qty-${line.id}"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            value="${line.qty}"
            data-quote-qty="${line.id}"
            class="w-24 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-right text-sm tabular-nums text-neutral-800 outline-hidden focus:border-brand-500 focus:ring-3 focus:ring-brand-200 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <span class="text-xs text-neutral-600 dark:text-neutral-400">und.</span>
        </div>
      </div>
    `;
    // El nombre y el grupo se asignan como texto, nunca como HTML.
    item.querySelector('[data-linea-nombre]').textContent = line.name;
    item.querySelector('[data-linea-grupo]').textContent = line.group;
    list.append(item);
  }
}

function save() {
  write(lines);
  render();
}

function add(id, name, group) {
  if (lines.some(line => line.id === id)) return;
  lines.push({ id, name, group, qty: DEFAULT_QTY });
  save();
  // Solo cuando entra de verdad: pulsar dos veces el mismo botón no es una
  // segunda intención de compra, y contarla inflaría el evento.
  window.bysTrack?.('anadir_a_cotizacion', {
    id,
    nombre: name,
    categoria: group,
  });
}

function remove(id) {
  lines = lines.filter(line => line.id !== id);
  save();
}

function setQty(id, qty) {
  const line = lines.find(item => item.id === id);
  if (!line) return;
  line.qty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
  write(lines);
  for (const el of document.querySelectorAll('[data-quote-total]')) {
    el.textContent = formatNumber(totalUnits());
  }
}

/** Elementos enfocables dentro del panel, en orden de tabulación. */
function focusables(panel) {
  return [
    ...panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])'
    ),
  ].filter(el => el.offsetParent !== null);
}

let lastFocused = null;

function openPanel(open) {
  const panel = document.querySelector('[data-quote-panel]');
  if (!panel) return;

  // Abrir el panel con algo dentro es el equivalente aquí a entrar a la caja:
  // se pasa de mirar el catálogo a revisar cantidades y dejar los datos.
  if (open && lines.length > 0) {
    window.bysTrack?.('abrir_cotizacion', {
      ids: lines.map(line => line.id),
      referencias: lines.length,
      items: lines.map(line => ({
        item_id: line.id,
        item_name: line.name,
        item_category: line.group,
        quantity: line.qty,
      })),
    });
  }

  panel.dataset.open = open ? 'true' : 'false';
  // El cajón lleva su propio data-open porque la variante `data-[open=true]:`
  // de Tailwind mira el atributo del elemento donde está la clase.
  const drawer = panel.querySelector('[data-quote-drawer]');
  if (drawer) drawer.dataset.open = open ? 'true' : 'false';

  // `inert` saca del árbol de accesibilidad y del orden de tabulación todo el
  // contenido del panel mientras está cerrado. Con aria-hidden solo, el lector
  // de pantalla lo ocultaba pero sus botones seguían siendo tabulables, que es
  // justo lo que axe marca como aria-hidden-focus.
  panel.inert = !open;
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  panel.setAttribute('aria-modal', open ? 'true' : 'false');
  document.body.style.overflow = open ? 'hidden' : '';

  // Lenis desplaza la página por su cuenta y `overflow: hidden` no lo detiene:
  // sin esto, la rueda dentro del panel movía la página de detrás.
  if (open) window.lenis?.stop();
  else window.lenis?.start();

  if (open) {
    lastFocused = document.activeElement;
    panel.querySelector('[data-quote-close]')?.focus();
  } else if (lastFocused instanceof HTMLElement) {
    // Al cerrar, el foco vuelve al botón que abrió el panel.
    lastFocused.focus();
    lastFocused = null;
  }
}

/** Mantiene el foco dentro del panel mientras está abierto. */
function trapFocus(event) {
  const panel = document.querySelector('[data-quote-panel]');
  if (!panel || panel.dataset.open !== 'true' || event.key !== 'Tab') return;
  const items = focusables(panel);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Arma el texto del pedido para WhatsApp. */
function buildMessage() {
  const field = key =>
    document.querySelector(`[data-quote-field="${key}"]`)?.value.trim() ?? '';

  const parts = ['Hola, quisiera cotizar las siguientes referencias:', ''];
  lines.forEach((line, index) => {
    parts.push(`${index + 1}. ${line.name} — ${formatNumber(line.qty)} und.`);
  });
  parts.push('');
  // Lo que quedó en blanco no ocupa un renglón: nadie manda «Ciudad:» a secas.
  for (const [key, etiqueta] of CAMPOS_CLIENTE) {
    const valor = field(key);
    if (valor) parts.push(`${etiqueta}: ${valor}`);
  }
  return parts.join('\n');
}

function init() {
  const root = document.querySelector('[data-quote-panel]');
  const whatsappBase = root?.dataset.whatsapp ?? '';

  document.addEventListener('click', event => {
    const addBtn = event.target.closest('[data-quote-add]');
    if (addBtn) {
      add(
        addBtn.dataset.quoteAdd,
        addBtn.dataset.quoteName,
        addBtn.dataset.quoteGroup
      );
      return;
    }

    const removeBtn = event.target.closest('[data-quote-remove]');
    if (removeBtn) {
      remove(removeBtn.dataset.quoteRemove);
      return;
    }

    if (event.target.closest('[data-quote-toggle]')) {
      openPanel(true);
      return;
    }
    if (
      event.target.closest('[data-quote-close]') ||
      event.target.hasAttribute?.('data-quote-backdrop')
    ) {
      openPanel(false);
      return;
    }

    if (event.target.closest('[data-quote-send]')) {
      if (lines.length === 0) return;
      // La conversión del sitio: aquí es donde una visita se convierte en una
      // solicitud que el equipo comercial recibe.
      window.bysTrack?.('enviar_cotizacion', {
        ids: lines.map(line => line.id),
        referencias: lines.length,
      });
      const url = `${whatsappBase}?text=${encodeURIComponent(buildMessage())}`;
      window.open(url, '_blank', 'noopener');
    }
  });

  document.addEventListener('input', event => {
    const qtyInput = event.target.closest('[data-quote-qty]');
    if (qtyInput) setQty(qtyInput.dataset.quoteQty, Number(qtyInput.value));
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') openPanel(false);
    trapFocus(event);
  });

  // Arranca cerrado e inerte, para que su contenido no sea tabulable.
  const panel = document.querySelector('[data-quote-panel]');
  if (panel) panel.inert = true;

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Astro reutiliza el documento entre navegaciones cuando hay view transitions.
document.addEventListener('astro:page-load', () => {
  lines = read();
  render();
});
