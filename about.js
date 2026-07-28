// Revelation douce des cartes "Comment je travaille" quand elles entrent dans l'ecran

(function () {
  const cards = document.querySelectorAll('.method-card.reveal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (cards.length && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    cards.forEach((card) => observer.observe(card));
  }

  // Petit halo qui suit la souris sur les cartes "Comment je travaille",
  // meme effet discret que sur la page Competences.
  if (!reduceMotion) {
    document.querySelectorAll('.method-card, .about-bio').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty('--mx', `${x}%`);
        el.style.setProperty('--my', `${y}%`);
      });
    });
  }
})();