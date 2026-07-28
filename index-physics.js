// Easter egg : rester appuye ~2s sur un element du index le "libere" au lieu
// de suivre le lien normalement. L'element se met alors a trembler, se
// detache de la mise en page, et peut etre traine et lache n'importe ou.
// Au lachage, il garde sa vitesse (on peut le "lancer"), rebondit sur les
// bords et sur les autres elements liberes, et laisse une petite onde de
// choc qui se dissipe. Les elements de la navbar et du footer restent
// confines a leur zone d'origine, les autres sont libres sur tout l'ecran.
// Fichier autonome (injecte son propre CSS), charge uniquement sur index.html.

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // effet purement gestuel/anime : desactive proprement

  const HOLD_MS = 2000;
  const MOVE_CANCEL_PX = 10; // si ca bouge trop pendant l'attente, on annule (c'est un scroll/clic normal)
  const FRICTION = 0.965;
  const RESTITUTION = 0.55; // rebond sur les bords et entre elements
  const STOP_EPSILON = 0.04; // vitesse en-dessous de laquelle on considere l'element arrete

  const TARGETS_SELECTOR = [
    '.hero-name h1',
    '.hero-name .role',
    '.hero-name p',
    '.card-about',
    '.card-skills',
    '.strip',
    '.services-card',
    '.nav-left .brand',
    '.nav-left .contact-link',
    'footer'
  ].join(', ');

  // --- CSS injecte pour le tremblement et l'onde de choc ---
  const style = document.createElement('style');
  style.textContent = `
    .ep-placeholder{ visibility:hidden; }
    .ep-free{
      z-index:500; cursor:grabbing; touch-action:none; user-select:none;
      -webkit-user-select:none;
    }
    .ep-wiggle{ animation: ep-wiggle .45s ease; }
    @keyframes ep-wiggle{
      0%{ rotate:0deg; }
      20%{ rotate:-4deg; }
      40%{ rotate:4deg; }
      60%{ rotate:-2.5deg; }
      80%{ rotate:2deg; }
      100%{ rotate:0deg; }
    }
    .ep-land{ animation: ep-land .38s cubic-bezier(.34,1.56,.64,1); }
    @keyframes ep-land{
      0%{ scale:1 1; }
      30%{ scale:1.08 0.86; }
      55%{ scale:0.94 1.08; }
      78%{ scale:1.03 0.97; }
      100%{ scale:1 1; }
    }
    .ep-ripple{
      position:fixed; left:0; top:0; width:14px; height:14px; border-radius:50%;
      border:2px solid var(--accent-2, #2EE6D6); pointer-events:none; z-index:900;
      transform:translate(-50%,-50%); opacity:.75; will-change:width,height,opacity;
      animation: ep-ripple-anim .65s ease-out forwards;
    }
    .ep-ripple--soft{ border-color: var(--text, #efeceA); opacity:.4; }
    @keyframes ep-ripple-anim{
      to{ width:170px; height:170px; opacity:0; }
    }
  `;
  document.head.appendChild(style);

  function spawnRipple(x, y, soft) {
    const r = document.createElement('div');
    r.className = 'ep-ripple' + (soft ? ' ep-ripple--soft' : '');
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    document.body.appendChild(r);
    r.addEventListener('animationend', () => r.remove(), { once: true });
  }

  // Rejoue l'animation d'impact (squash/rebond) directement sur le bloc,
  // plutot que de tout miser sur une onde autour du curseur.
  function bounce(el) {
    el.classList.remove('ep-land');
    void el.offsetWidth; // force le reflow pour pouvoir rejouer l'animation
    el.classList.add('ep-land');
  }

  // --- Registre des elements actuellement liberes, pour la simulation physique ---
  const freeEls = []; // { el, x, y, w, h, vx, vy, bounds() }
  let rafId = null;

  function ensureLoopRunning() {
    if (rafId === null) rafId = requestAnimationFrame(step);
  }

  function step() {
    let anyMoving = false;

    for (const item of freeEls) {
      if (item.dragging) continue; // suit le pointeur, pas la physique

      if (Math.hypot(item.vx, item.vy) > STOP_EPSILON) {
        anyMoving = true;
        item.x += item.vx;
        item.y += item.vy;
        item.vx *= FRICTION;
        item.vy *= FRICTION;

        const b = item.bounds();
        let hitWall = false;
        if (item.x < b.left) { item.x = b.left; item.vx = Math.abs(item.vx) * RESTITUTION; hitWall = true; }
        if (item.x + item.w > b.right) { item.x = b.right - item.w; item.vx = -Math.abs(item.vx) * RESTITUTION; hitWall = true; }
        if (item.y < b.top) { item.y = b.top; item.vy = Math.abs(item.vy) * RESTITUTION; hitWall = true; }
        if (item.y + item.h > b.bottom) { item.y = b.bottom - item.h; item.vy = -Math.abs(item.vy) * RESTITUTION; hitWall = true; }
        if (hitWall) bounce(item.el);
      } else {
        item.vx = 0; item.vy = 0;
      }
    }

    // Collisions simples entre paires d'elements liberes (cercles approximes)
    for (let i = 0; i < freeEls.length; i++) {
      for (let j = i + 1; j < freeEls.length; j++) {
        const a = freeEls[i], b = freeEls[j];
        if (a.dragging || b.dragging) continue;
        const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        const ra = (a.w + a.h) / 4, rb = (b.w + b.h) / 4;
        const dx = bx - ax, dy = by - ay;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = ra + rb;
        if (dist < minDist) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minDist - dist) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;

          const relVx = b.vx - a.vx, relVy = b.vy - a.vy;
          const relSpeed = relVx * nx + relVy * ny;
          if (relSpeed < 0) {
            const impulse = -relSpeed * RESTITUTION;
            a.vx -= impulse * nx * 0.5; a.vy -= impulse * ny * 0.5;
            b.vx += impulse * nx * 0.5; b.vy += impulse * ny * 0.5;
            spawnRipple(ax + dx * (ra / minDist), ay + dy * (ra / minDist), true);
            bounce(a.el); bounce(b.el);
          }
          anyMoving = true;
        }
      }
    }

    for (const item of freeEls) {
      if (!item.dragging) {
        item.el.style.left = `${item.x}px`;
        item.el.style.top = `${item.y}px`;
      }
    }

    if (anyMoving) {
      rafId = requestAnimationFrame(step);
    } else {
      rafId = null;
    }
  }

  // Proprietes visuelles a figer en inline avant de detacher l'element : certains
  // styles du site dependent du parent (ex. ".hero-name h1", ".nav-left .brand"),
  // et disparaitraient si l'element quitte ce contexte sans qu'on les fige.
  const FREEZE_PROPS = [
    'color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'textDecorationLine', 'textAlign',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'borderColor',
    'borderRadius', 'boxShadow', 'padding',
    'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap', 'flexWrap'
  ];
  function freezeVisualStyle(el) {
    const cs = getComputedStyle(el);
    FREEZE_PROPS.forEach((p) => {
      try { el.style[p] = cs[p]; } catch (err) { /* propriete non applicable, on ignore */ }
    });
  }

  // --- Detache un element de la mise en page pour le rendre "libre" ---
  function freeElement(el, pointerX, pointerY) {
    const rect = el.getBoundingClientRect();
    freezeVisualStyle(el);

    const placeholder = document.createElement('div');
    placeholder.className = 'ep-placeholder';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    el.parentNode.insertBefore(placeholder, el);

    // Deplace l'element au niveau du body : certains conteneurs (navbar,
    // footer) utilisent backdrop-filter, ce qui redefinit le bloc conteneur
    // des descendants en position fixed. Sans ca, le calcul de position
    // ne correspondrait plus aux coordonnees ecran.
    document.body.appendChild(el);

    el.style.position = 'fixed';
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.margin = '0';
    el.classList.add('ep-free', 'ep-wiggle');
    el.addEventListener('animationend', () => el.classList.remove('ep-wiggle'), { once: true });

    const navbarEl = document.querySelector('.topbar');
    const footerEl = document.querySelector('footer');
    let boundsFn;
    // Determine la zone d'origine (navbar / footer / libre) une seule fois,
    // via le placeholder reste a la place d'origine dans le DOM.
    const originContainer = navbarEl && navbarEl.contains(placeholder) ? navbarEl
      : (footerEl && footerEl.contains(placeholder) ? footerEl : null);

    if (originContainer) {
      boundsFn = () => {
        const r = originContainer.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
    } else {
      boundsFn = () => ({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
    }

    const item = {
      el, x: rect.left, y: rect.top, w: rect.width, h: rect.height,
      vx: 0, vy: 0, dragging: true, bounds: boundsFn
    };
    freeEls.push(item);
    return item;
  }

  // --- Mise en place de l'ecoute (attente longue, puis glisser-lacher) sur chaque cible ---
  document.querySelectorAll(TARGETS_SELECTOR).forEach((el) => {
    el.setAttribute('draggable', 'false');
    let holdTimer = null;
    let startX = 0, startY = 0;
    let suppressNextClick = false;
    let item = null;
    let grabOffsetX = 0, grabOffsetY = 0;
    let lastX = 0, lastY = 0, lastT = 0, curVx = 0, curVy = 0;

    function clearHold() {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      startX = e.clientX; startY = e.clientY;

      holdTimer = setTimeout(() => {
        holdTimer = null;
        suppressNextClick = true;
        item = freeElement(el, e.clientX, e.clientY);
        grabOffsetX = e.clientX - item.x;
        grabOffsetY = e.clientY - item.y;
        lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
        el.setPointerCapture(e.pointerId);
      }, HOLD_MS);
    });

    el.addEventListener('pointermove', (e) => {
      if (holdTimer && Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_CANCEL_PX) {
        clearHold();
        return;
      }
      if (!item || !item.dragging) return;

      const b = item.bounds();
      item.x = Math.min(Math.max(e.clientX - grabOffsetX, b.left), b.right - item.w);
      item.y = Math.min(Math.max(e.clientY - grabOffsetY, b.top), b.bottom - item.h);
      item.el.style.left = `${item.x}px`;
      item.el.style.top = `${item.y}px`;

      const now = performance.now();
      const dt = Math.max(now - lastT, 1);
      curVx = ((e.clientX - lastX) / dt) * 16; // remis a l'echelle ~par frame 60fps
      curVy = ((e.clientY - lastY) / dt) * 16;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    });

    function release(e) {
      const wasQuickTap = holdTimer !== null && item === null;
      clearHold();
      if (item && item.dragging) {
        item.dragging = false;
        item.vx = curVx;
        item.vy = curVy;
        bounce(item.el);
        ensureLoopRunning();
        item = null;
        return;
      }
      // Tap rapide sur un lien en tactile : la navigation par defaut peut
      // avoir ete court-circuitee par le preventDefault du touchstart
      // (voir plus bas), donc on la relance nous-memes dans ce cas precis.
      if (wasQuickTap && el.tagName === 'A' && el.getAttribute('href') && e.pointerType === 'touch') {
        if (el.getAttribute('target') === '_blank') {
          window.open(el.href, '_blank', 'noopener');
        } else {
          window.location.href = el.href;
        }
      }
    }

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', () => { if (holdTimer) clearHold(); });

    // Empeche la navigation du lien si l'element vient d'etre libere/traine
    el.addEventListener('click', (e) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    el.addEventListener('contextmenu', (e) => {
      if (holdTimer || (item && item.dragging)) e.preventDefault();
    });

    // Certains navigateurs (Firefox notamment) affichent leur propre popup
    // d'apercu de lien pendant un appui tactile prolonge. On la coupe a la
    // racine en empechant le comportement tactile par defaut sur les liens ;
    // le clic rapide est alors relance manuellement dans release() ci-dessus.
    if (el.tagName === 'A') {
      el.style.webkitTouchCallout = 'none';
      el.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
    }
  });
})();