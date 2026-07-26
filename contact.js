// Envoi du formulaire de contact via EmailJS (aucun backend necessaire)

(function () {
  // Cle publique EmailJS : c'est normal et sans risque qu'elle soit visible
  // cote client, elle est prevue pour ca (equivalent d'une cle "site" publique).
  emailjs.init({ publicKey: 'OPbP-28fhj6A3LEY-' });

  const SERVICE_ID = 'service_8jo8z0y';
  const TEMPLATE_ID = 'template_8gbjvvm';

  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    submitBtn.disabled = true;
    statusEl.textContent = 'Envoi en cours…';
    statusEl.className = 'form-status';

    emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form)
      .then(() => {
        statusEl.textContent = 'Message envoyé, merci ! Je te réponds au plus vite.';
        statusEl.className = 'form-status success';
        form.reset();
      })
      .catch((err) => {
        statusEl.textContent = "Une erreur est survenue, réessaie dans un instant.";
        statusEl.className = 'form-status error';
        console.error('EmailJS error:', err);
      })
      .finally(() => {
        submitBtn.disabled = false;
      });
  });
})();