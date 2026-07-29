// Easter egg "trou noir" :
// Un clic maintenu de 2s sur n'importe quel élément marqué .walk-target
// (logo, titre, carte projet, footer...) déclenche un effet qui touche
// TOUTE la page : un trou noir s'ouvre au centre de l'écran et aspire
// chaque grand bloc de la page (.bh-section) l'un après l'autre, dans
// l'ordre. Une fois tout englouti, une courte pause, puis un second
// trou noir s'ouvre et recrache tout, dans le même ordre, remettant la
// page exactement comme avant.
//
// Contrairement à une première version, on ne clone plus les éléments
// (cloner + recopier des centaines de propriétés CSS à la main est
// fragile : dégradés de texte, pseudo-éléments, icônes SVG peuvent se
// perdre). À la place, on déplace l'élément RÉEL en position:fixed
// (tout son CSS/contexte reste intact, aucune recopie), et on laisse
// un espace réservé (placeholder) à sa place pour ne pas casser la
// mise en page pendant l'effet. Fond et texte bougent alors forcément
// ensemble, puisque c'est littéralement le même élément qui vole.

(function () {
  const HOLD_DURATION = 2000; // ms, durée du clic maintenu pour déclencher

  const HOLE_OPEN_DURATION = 600;   // doit matcher hole-open en CSS
  const HOLE_CLOSE_DURATION = 450;  // doit matcher hole-close en CSS
  const SUCK_DURATION = 750;        // doit matcher bh-suck en CSS
  const SPIT_DURATION = 700;        // doit matcher bh-spit en CSS
  const SUCK_STAGGER = 170;         // décalage entre chaque section aspirée
  const SPIT_STAGGER = 140;         // décalage entre chaque section recrachée
  const SWALLOWED_PAUSE = 1000;     // pause pendant que tout a disparu

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  function makeHole(centerX, centerY, size) {
    const hole = document.createElement('div');
    hole.className = 'black-hole';
    hole.style.setProperty('--hole-x', centerX + 'px');
    hole.style.setProperty('--hole-y', centerY + 'px');
    hole.style.setProperty('--hole-size', size + 'px');

    const sparkCount = 12;
    let bits = '';
    for (let i = 0; i < sparkCount; i++) {
      const angle = (360 / sparkCount) * i + (Math.random() * 22 - 11);
      const radius = size * (0.34 + Math.random() * 0.18);
      const dotSize = 2 + Math.random() * 2.5;
      bits += `<span class="hole-spark" style="--a:${angle.toFixed(1)}deg;--r:${radius.toFixed(1)}px;--s:${dotSize.toFixed(1)}px;"></span>`;
    }
    const streakCount = 10;
    for (let i = 0; i < streakCount; i++) {
      const angle = (360 / streakCount) * i + (Math.random() * 16 - 8);
      const radius = size * (0.46 + Math.random() * 0.14);
      const len = size * (0.14 + Math.random() * 0.16);
      bits += `<span class="hole-streak" style="--a:${angle.toFixed(1)}deg;--r:${radius.toFixed(1)}px;--len:${len.toFixed(1)}px;"></span>`;
    }

    hole.innerHTML =
      '<div class="hole-glow"></div>' +
      '<div class="hole-disk"></div>' +
      `<div class="hole-orbit">${bits}</div>` +
      '<div class="hole-ring"></div>' +
      '<div class="black-hole-core"></div>';
    document.body.appendChild(hole);
    return hole;
  }

  function triggerBlackHole() {
    if (document.body.classList.contains('bh-active')) return;
    document.body.classList.add('bh-active');

    const holeX = window.innerWidth / 2;
    const holeY = window.innerHeight / 2;
    const holeSize = Math.max(180, Math.min(340, window.innerWidth * 0.22));

    const sections = Array.from(document.querySelectorAll('.bh-section'));

    // Pour chaque section : on relève sa position actuelle, on pose un
    // espace réservé (placeholder) à sa place dans le flux normal, puis
    // on bascule l'élément RÉEL en position:fixed calée exactement sur
    // ses anciennes coordonnées. Rien n'est cloné : le texte, les
    // dégradés, les icônes restent celles d'origine.
    const items = sections.map((el) => {
      const rect = el.getBoundingClientRect();
      const elCenterX = rect.left + rect.width / 2;
      const elCenterY = rect.top + rect.height / 2;

      const placeholder = document.createElement('div');
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.height = rect.height + 'px';
      placeholder.style.width = '100%';
      el.parentNode.insertBefore(placeholder, el);

      el.classList.add('bh-flying');
      el.style.position = 'fixed';
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
      el.style.margin = '0';
      el.style.zIndex = '9999';
      el.style.setProperty('--dx', (holeX - elCenterX).toFixed(1) + 'px');
      el.style.setProperty('--dy', (holeY - elCenterY).toFixed(1) + 'px');

      return { el, placeholder };
    });

    // Étape 1 : le trou noir s'ouvre au centre de l'écran
    const holeIn = makeHole(holeX, holeY, holeSize);
    requestAnimationFrame(() => holeIn.classList.add('hole-opening'));

    // Étape 2 : chaque section est aspirée l'une après l'autre
    items.forEach(({ el }, i) => {
      setTimeout(() => {
        el.classList.add('bh-sucking');
      }, HOLE_OPEN_DURATION * 0.45 + i * SUCK_STAGGER);
    });

    const lastSuckStart = HOLE_OPEN_DURATION * 0.45 + (items.length - 1) * SUCK_STAGGER;
    const allSwallowedAt = lastSuckStart + SUCK_DURATION;

    // Étape 3 : une fois tout englouti, le trou noir se referme
    setTimeout(() => {
      holeIn.classList.remove('hole-opening');
      holeIn.classList.add('hole-closing');
      setTimeout(() => holeIn.remove(), HOLE_CLOSE_DURATION);
    }, allSwallowedAt);

    // Étape 4 : après une pause, un nouveau trou noir s'ouvre et
    // recrache chaque section, dans le même ordre, à sa place d'origine
    const reopenAt = allSwallowedAt + HOLE_CLOSE_DURATION + SWALLOWED_PAUSE;
    setTimeout(() => {
      const holeOut = makeHole(holeX, holeY, holeSize);
      requestAnimationFrame(() => holeOut.classList.add('hole-opening'));

      items.forEach(({ el }, i) => {
        setTimeout(() => {
          el.classList.remove('bh-sucking');
          el.classList.add('bh-spit');
        }, HOLE_OPEN_DURATION * 0.45 + i * SPIT_STAGGER);
      });

      const lastSpitStart = HOLE_OPEN_DURATION * 0.45 + (items.length - 1) * SPIT_STAGGER;
      const allDoneAt = lastSpitStart + SPIT_DURATION;

      setTimeout(() => {
        holeOut.classList.remove('hole-opening');
        holeOut.classList.add('hole-closing');
        setTimeout(() => holeOut.remove(), HOLE_CLOSE_DURATION);

        // Chaque section reprend sa place normale dans le flux : on
        // retire le placeholder et on efface tout le style temporaire.
        items.forEach(({ el, placeholder }) => {
          el.classList.remove('bh-flying', 'bh-sucking', 'bh-spit');
          el.style.position = '';
          el.style.left = '';
          el.style.top = '';
          el.style.width = '';
          el.style.height = '';
          el.style.margin = '';
          el.style.zIndex = '';
          el.style.removeProperty('--dx');
          el.style.removeProperty('--dy');
          placeholder.remove();
        });
        document.body.classList.remove('bh-active');
      }, allDoneAt);
    }, reopenAt);
  }

  document.querySelectorAll('.walk-target').forEach((el) => {
    let holdTimer = null;
    let holding = false;

    const start = () => {
      if (document.body.classList.contains('bh-active')) return;
      holding = true;
      holdTimer = setTimeout(() => {
        if (holding) {
          // Avale le "click" qui suivra le relâchement, pour ne pas
          // déclencher un lien (ex: la navbar) juste au mauvais moment.
          el.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
          triggerBlackHole();
        }
      }, HOLD_DURATION);
    };

    const cancel = () => {
      holding = false;
      clearTimeout(holdTimer);
    };

    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
  });
})();