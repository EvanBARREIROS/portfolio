// Easter egg "circuit imprimé" :
// Un clic maintenu de 2s sur une carte de la grille de compétences fait
// partir des pistes lumineuses (façon circuit imprimé, tracé en escalier
// à angles droits) de cette carte vers les 3 autres, l'une après l'autre.
// Une fois la piste tracée, une pulse lumineuse voyage dessus jusqu'à la
// carte cible, qui reçoit une étincelle et s'illumine. Une fois toutes
// les cartes connectées, un court temps d'arrêt (le halo reste allumé),
// puis tout s'éteint et repart comme avant. Reste un secret déclenché
// au clic maintenu, rien d'automatique au chargement de la page.

(function () {
  const HOLD_DURATION = 2000;  // ms, durée du clic maintenu pour déclencher
  const DRAW_STAGGER = 260;    // décalage entre chaque piste tracée
  const DRAW_DURATION = 500;   // durée de tracé d'une piste
  const PULSE_DURATION = 480;  // durée du voyage de la pulse sur une piste tracée
  const HOLD_GLOW = 1100;      // pause, tout allumé, avant l'extinction
  const FADE_DURATION = 450;   // durée de l'extinction

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Réseau de blocs qui participent à l'effet : les 4 cartes de compétences,
  // les 4 étapes du plan d'action, et le bandeau "façon de travailler".
  const NODE_SELECTOR = '.skill-grid .skill-card, .workflow-card, .availability-strip';
  let active = false;

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
  }

  // Tracé en escalier (deux paliers) plutôt qu'un simple coude, pour un
  // rendu plus "circuit imprimé chargé". Renvoie le d SVG + les points de
  // jonction (vias) à chaque coude.
  function buildPath(a, b) {
    const m1x = a.x + (b.x - a.x) * 0.32;
    const midY = (a.y + b.y) / 2;
    const m2x = a.x + (b.x - a.x) * 0.68;
    const d = `M ${a.x} ${a.y} L ${m1x} ${a.y} L ${m1x} ${midY} L ${m2x} ${midY} L ${m2x} ${b.y} L ${b.x} ${b.y}`;
    const vias = [
      { x: m1x, y: a.y },
      { x: m1x, y: midY },
      { x: m2x, y: midY },
      { x: m2x, y: b.y },
    ];
    return { d, vias };
  }

  function makeSpark(svg, x, y) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'circuit-spark');
    const rays = 6;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const x2 = x + Math.cos(angle) * 14;
      const y2 = y + Math.sin(angle) * 14;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', y);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      g.appendChild(line);
    }
    svg.appendChild(g);
    requestAnimationFrame(() => g.classList.add('circuit-spark-on'));
    setTimeout(() => g.remove(), 550);
  }

  function animatePulse(pulse, path, duration, onDone) {
    const len = path.getTotalLength();
    pulse.classList.add('circuit-pulse-on');
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const pt = path.getPointAtLength(t * len);
      pulse.setAttribute('cx', pt.x);
      pulse.setAttribute('cy', pt.y);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        pulse.classList.remove('circuit-pulse-on');
        onDone && onDone();
      }
    }
    requestAnimationFrame(step);
  }

  function triggerCircuit(originCard) {
    if (active) return;
    active = true;

    const cards = Array.from(document.querySelectorAll(NODE_SELECTOR));
    const others = cards.filter((c) => c !== originCard);
    if (others.length === 0) { active = false; return; }

    const origin = centerOf(originCard);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'circuit-overlay');
    const docW = document.documentElement.scrollWidth;
    const docH = document.documentElement.scrollHeight;
    svg.setAttribute('width', docW);
    svg.setAttribute('height', docH);
    svg.setAttribute('viewBox', `0 0 ${docW} ${docH}`);

    const items = others.map((card) => {
      const target = centerOf(card);
      const { d, vias } = buildPath(origin, target);

      const glow = document.createElementNS(SVG_NS, 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('class', 'circuit-trace circuit-trace-glow');

      const line = document.createElementNS(SVG_NS, 'path');
      line.setAttribute('d', d);
      line.setAttribute('class', 'circuit-trace');

      const viaEls = vias.map(({ x, y }) => {
        const via = document.createElementNS(SVG_NS, 'circle');
        via.setAttribute('cx', x);
        via.setAttribute('cy', y);
        via.setAttribute('r', 3.5);
        via.setAttribute('class', 'circuit-via');
        svg.appendChild(via);
        return via;
      });

      const pulse = document.createElementNS(SVG_NS, 'circle');
      pulse.setAttribute('r', 4.5);
      pulse.setAttribute('class', 'circuit-pulse');

      svg.appendChild(glow);
      svg.appendChild(line);
      svg.appendChild(pulse);

      return { card, line, glow, viaEls, pulse, target };
    });

    document.body.appendChild(svg);
    originCard.classList.add('circuit-source');

    items.forEach(({ line, glow, viaEls, pulse, card, target }, i) => {
      const len = line.getTotalLength();
      [line, glow].forEach((p) => {
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      });

      setTimeout(() => {
        // Les vias s'allument un par un pendant le tracé de la piste
        viaEls.forEach((via, vi) => {
          setTimeout(() => via.classList.add('circuit-via-on'), (vi / viaEls.length) * DRAW_DURATION);
        });

        [line, glow].forEach((p) => {
          p.style.transition = `stroke-dashoffset ${DRAW_DURATION}ms ease-out`;
          p.style.strokeDashoffset = '0';
        });

        // Une fois la piste tracée, une pulse voyage dessus jusqu'à la carte
        setTimeout(() => {
          animatePulse(pulse, line, PULSE_DURATION, () => {
            card.classList.add('circuit-active');
            makeSpark(svg, target.x, target.y);
          });
        }, DRAW_DURATION);
      }, i * DRAW_STAGGER);
    });

    const lastDrawStart = (items.length - 1) * DRAW_STAGGER;
    const allDoneAt = lastDrawStart + DRAW_DURATION + PULSE_DURATION;

    // Une fois tout connecté, on garde le halo un instant, puis on éteint.
    setTimeout(() => {
      svg.style.transition = `opacity ${FADE_DURATION}ms ease-in`;
      svg.style.opacity = '0';
      originCard.classList.remove('circuit-source');
      items.forEach(({ card }) => card.classList.remove('circuit-active'));

      setTimeout(() => {
        svg.remove();
        active = false;
      }, FADE_DURATION);
    }, allDoneAt + HOLD_GLOW);
  }

  document.querySelectorAll(NODE_SELECTOR).forEach((card) => {
    let holdTimer = null;
    let holding = false;

    const start = () => {
      if (active) return;
      holding = true;
      holdTimer = setTimeout(() => {
        if (holding) triggerCircuit(card);
      }, HOLD_DURATION);
    };

    const cancel = () => {
      holding = false;
      clearTimeout(holdTimer);
    };

    card.addEventListener('mousedown', start);
    card.addEventListener('touchstart', start, { passive: true });
    card.addEventListener('mouseup', cancel);
    card.addEventListener('mouseleave', cancel);
    card.addEventListener('touchend', cancel);
    card.addEventListener('touchcancel', cancel);
  });
})();