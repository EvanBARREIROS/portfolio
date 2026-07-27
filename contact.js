// Envoi du formulaire de contact via EmailJS (aucun backend necessaire)

(function () {
  // Cle publique EmailJS : c'est normal et sans risque qu'elle soit visible
  // cote client, elle est prevue pour ca (equivalent d'une cle "site" publique).
  emailjs.init({ publicKey: '0PbP-28fhj6A3LEY-' });

  const SERVICE_ID = 'service_8jo8z0y';
  const TEMPLATE_ID = 'template_8gbjvvm';
  const COOLDOWN_MS = 30000; // 30s entre deux envois
  const COOLDOWN_KEY = 'contact_last_submit';

  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');
  const cooldownEl = document.getElementById('cooldown-text');
  const messageEl = document.getElementById('message');
  const charCountEl = document.getElementById('char-count');
  const honeypot = document.getElementById('website');
  const subjectSelect = document.getElementById('subject');
  const subjectOtherRow = document.getElementById('subject-other-row');
  const subjectOtherInput = document.getElementById('subject_other');
  const subjectDisplay = document.getElementById('subject_display');

  if (!form) return;

  // --- Sujet combiné envoyé à EmailJS (ex: "Autre — précision du client") ---
  function syncSubjectDisplay() {
    if (!subjectDisplay || !subjectSelect) return;
    const isOther = subjectSelect.value === 'Autre';
    const detail = isOther && subjectOtherInput ? subjectOtherInput.value.trim() : '';
    subjectDisplay.value = isOther && detail
      ? `Autre — ${detail}`
      : (subjectSelect.value || '');
  }

  // --- Champ "Précise le sujet" visible seulement si "Autre" est choisi ---
  if (subjectSelect && subjectOtherRow && subjectOtherInput) {
    const syncSubjectOther = () => {
      const isOther = subjectSelect.value === 'Autre';
      subjectOtherRow.hidden = !isOther;
      if (!isOther) {
        subjectOtherInput.value = '';
        subjectOtherInput.classList.remove('valid', 'invalid');
      }
      syncSubjectDisplay();
    };
    subjectSelect.addEventListener('change', syncSubjectOther);
    subjectOtherInput.addEventListener('input', syncSubjectDisplay);
    syncSubjectOther();
  }

  // --- Compteur de caracteres sur le message ---
  if (messageEl && charCountEl) {
    const maxLen = messageEl.getAttribute('maxlength') || 1000;
    const updateCount = () => {
      const len = messageEl.value.length;
      charCountEl.textContent = `${len} / ${maxLen}`;
      charCountEl.classList.toggle('limit-near', len > maxLen * 0.9);
    };
    messageEl.addEventListener('input', updateCount);
    updateCount();
  }

  // --- Validation visuelle au blur ---
  const validatedFields = form.querySelectorAll('input[required], select[required], textarea[required]');
  validatedFields.forEach((field) => {
    field.addEventListener('blur', () => refreshFieldState(field));
    field.addEventListener('input', () => {
      if (field.classList.contains('invalid') || field.classList.contains('valid')) {
        refreshFieldState(field);
      }
    });
  });

  function refreshFieldState(field) {
    const isValid = field.checkValidity();
    field.classList.toggle('valid', isValid);
    field.classList.toggle('invalid', !isValid);
  }

  // --- Boutons copier ---
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(value);
      } catch (err) {
        // Repli si l'API clipboard n'est pas disponible
        const tmp = document.createElement('textarea');
        tmp.value = value;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
      }
      btn.classList.add('copied');
      btn.setAttribute('aria-label', 'Copié !');
      clearTimeout(btn._resetTimer);
      btn._resetTimer = setTimeout(() => {
        btn.classList.remove('copied');
        btn.setAttribute('aria-label', 'Copier');
      }, 1500);
    });
  });

  // --- Rate limiting cote client ---
  function remainingCooldown() {
    const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
    const elapsed = Date.now() - last;
    return Math.max(0, COOLDOWN_MS - elapsed);
  }

  function startCooldownDisplay() {
    let remaining = remainingCooldown();
    if (remaining <= 0) {
      cooldownEl.textContent = '';
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = true;
    const tick = () => {
      remaining = remainingCooldown();
      if (remaining <= 0) {
        cooldownEl.textContent = '';
        submitBtn.disabled = false;
        return;
      }
      cooldownEl.textContent = `Nouvel envoi possible dans ${Math.ceil(remaining / 1000)}s`;
      setTimeout(tick, 1000);
    };
    tick();
  }

  startCooldownDisplay();

  // --- Soumission ---
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Verification native de tous les champs requis
    let allValid = true;
    let firstInvalid = null;
    validatedFields.forEach((field) => {
      refreshFieldState(field);
      if (!field.checkValidity()) {
        allValid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });
    if (!allValid) {
      statusEl.textContent = 'Merci de vérifier les champs en rouge.';
      statusEl.className = 'form-status error';
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (remainingCooldown() > 0) {
      startCooldownDisplay();
      return;
    }

    syncSubjectDisplay();

    // Piege anti-bot : si rempli, on simule un envoi reussi sans rien faire
    if (honeypot && honeypot.value.trim() !== '') {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      statusEl.textContent = 'Message envoyé, merci ! Je vous réponds au plus vite.';
      statusEl.className = 'form-status success';
      form.reset();
      startCooldownDisplay();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    statusEl.textContent = 'Envoi en cours…';
    statusEl.className = 'form-status';

    emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form)
      .then(() => {
        statusEl.textContent = 'Message envoyé, merci ! Je vous réponds au plus vite.';
        statusEl.className = 'form-status success';
        form.reset();
        validatedFields.forEach((field) => field.classList.remove('valid', 'invalid'));
        if (charCountEl) charCountEl.textContent = `0 / ${messageEl.getAttribute('maxlength') || 1000}`;
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        startCooldownDisplay();
      })
      .catch((err) => {
        statusEl.textContent = "Une erreur est survenue, réessayez dans un instant.";
        statusEl.className = 'form-status error';
        console.error('EmailJS error:', err);
        submitBtn.disabled = false;
      })
      .finally(() => {
        submitBtn.classList.remove('loading');
      });
  });
})();