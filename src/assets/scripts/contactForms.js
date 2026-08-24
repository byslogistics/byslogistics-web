/**
 * Envío de los formularios del sitio (contacto y suscripción).
 *
 * El sitio es estático y se despliega en Netlify, así que la entrega la hace
 * Netlify Forms: el robot de Netlify detecta en el HTML publicado los
 * formularios marcados con `data-netlify="true"` y les habilita un endpoint.
 *
 * Se envía por fetch en lugar de dejar que el navegador haga el POST nativo,
 * para no recargar la página y poder mostrar el estado en la misma pantalla.
 * Netlify acepta ese POST contra la ruta de la propia página, codificado como
 * formulario y con el campo `form-name`.
 *
 * En desarrollo local no hay endpoint de Netlify, así que el envío falla; para
 * que el formulario nunca quede en un callejón sin salida, el mensaje de error
 * dirige al WhatsApp y al correo de la empresa.
 */

const SENDING = 'Enviando…';

function setStatus(form, message, kind) {
  const status =
    form.querySelector('[data-form-status]') ??
    form.parentElement?.querySelector('[data-form-status]');
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.remove('hidden');
  status.dataset.kind = kind;
}

function submitButton(form) {
  return form.querySelector('button[type="submit"], [type="submit"]');
}

/** Texto de la consulta para WhatsApp, a partir de los campos del formulario. */
function buildWhatsappMessage(form, data) {
  const intro = form.dataset.waIntro ?? 'Hola, quisiera hacer una consulta:';
  const lines = [intro, ''];

  const labels = {
    name: 'Nombre',
    email: 'Correo',
    phone: 'Teléfono',
    message: 'Mensaje',
  };
  for (const [key, label] of Object.entries(labels)) {
    const value = (data.get(key) ?? '').toString().trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  return lines.join('\n');
}

async function sendToNetlify(form, data) {
  // Netlify espera el POST codificado como formulario, con form-name incluido.
  const body = new URLSearchParams();
  for (const [key, value] of data.entries()) {
    if (typeof value === 'string') body.append(key, value);
  }
  body.set('form-name', form.getAttribute('name') ?? '');

  const response = await fetch(form.getAttribute('action') || '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

function initForms() {
  for (const form of document.querySelectorAll('[data-contact-form]')) {
    if (form.dataset.formBound === 'true') continue;
    form.dataset.formBound = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = new FormData(form);
      const formulario = form.getAttribute('name') ?? 'formulario';

      // Trampa antispam: los robots rellenan el campo oculto, las personas no.
      if ((data.get('botcheck') ?? '').toString().trim() !== '') return;

      const button = submitButton(form);
      const originalLabel = button?.textContent;
      if (button) {
        button.disabled = true;
        button.textContent = SENDING;
      }
      setStatus(form, SENDING, 'pending');

      try {
        await sendToNetlify(form, data);
        // El envío que Netlify aceptó es la conversión; el intento, no. Por eso
        // se mide aquí dentro y no al pulsar el botón. `?.` porque en local no
        // hay medición y un bloqueador puede quitarla.
        window.bysTrack?.(
          formulario === 'suscripcion' ? 'suscripcion' : 'enviar_formulario',
          {
            formulario,
            /*
             * Lo que la persona acaba de escribir viaja al endpoint del propio
             * sitio, que lo hashea con SHA-256 antes de que salga hacia Meta:
             * es lo que permite atribuir la conversión al anuncio que la
             * originó. En claro no sale del dominio, y el navegador no se lo
             * manda a nadie más. Está declarado en el numeral 4 de la política
             * de privacidad.
             */
            contacto: {
              email: (data.get('email') ?? '').toString().trim(),
              telefono: (data.get('phone') ?? '').toString().trim(),
              nombre: (data.get('name') ?? '').toString().trim(),
            },
          }
        );
        setStatus(
          form,
          form.dataset.formSuccess ??
            '¡Gracias! Recibimos su mensaje y le respondemos pronto.',
          'ok'
        );
        form.reset();
      } catch (error) {
        console.error('Error al enviar el formulario:', error);

        // Si el envío falla, se ofrece WhatsApp con el mensaje ya compuesto
        // en lugar de dejar al visitante sin salida.
        const whatsapp = form.dataset.formWhatsapp ?? '';
        if (whatsapp) {
          // El formulario no llegó, pero la consulta sí: sale por WhatsApp con
          // el texto ya compuesto, y eso cuenta como contacto.
          window.bysTrack?.('contacto_directo', { canal: 'whatsapp' });
          const url = `${whatsapp}?text=${encodeURIComponent(
            buildWhatsappMessage(form, data)
          )}`;
          window.open(url, '_blank', 'noopener');
          setStatus(
            form,
            'No pudimos enviar el formulario, así que abrimos WhatsApp con su mensaje listo.',
            'error'
          );
        } else {
          setStatus(
            form,
            form.dataset.formFallback ??
              'No pudimos enviar el mensaje. Escríbanos por WhatsApp o al correo de la empresa.',
            'error'
          );
        }
      } finally {
        if (button) {
          button.disabled = false;
          if (originalLabel) button.textContent = originalLabel;
        }
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initForms);
} else {
  initForms();
}

document.addEventListener('astro:page-load', initForms);
