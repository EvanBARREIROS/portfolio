// Theme sombre/clair : on suit le navigateur au premier chargement, puis on garde le choix de l'utilisateur
const root = document.documentElement;
const toggleBtn = document.getElementById('theme-toggle');
const stored = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
root.setAttribute('data-theme', stored || (prefersDark ? 'dark' : 'light'));

// Le footer est fixe en bas de l'ecran (comme la navbar en haut) : on mesure sa
// vraie hauteur et on la reporte en padding-bottom du body, pour que le contenu
// ne passe jamais dessous SANS ajouter de vide superflu qui provoquerait un
// scroll inutile.
const siteFooter = document.querySelector('footer');
function syncFooterHeight() {
  if (!siteFooter) return;
  root.style.setProperty('--footer-h', `${siteFooter.offsetHeight}px`);
}
syncFooterHeight();
window.addEventListener('resize', syncFooterHeight);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(syncFooterHeight);
}

// Animation de transition : un cercle part du bouton theme et se propage jusqu'a
// couvrir tout l'ecran, revelant la nouvelle couleur de fond. Pendant ce temps,
// la couleur qu'on quitte reste posee en dur sur le body (pour ne jamais laisser
// apparaitre un blanc/noir par defaut derriere le cercle). Le reste du contenu
// (cartes, navbar, texte) fond simplement d'une couleur a l'autre via les
// transitions CSS deja en place, avec la meme duree pour rester coherent.
const pageBg = document.getElementById('page-bg');
let isFlipping = false;
const REVEAL_MS = 700;

function flipTheme(nextTheme, originX, originY) {
  if (isFlipping) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    root.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    return;
  }

  isFlipping = true;

  // Couleur qu'on quitte, capturee avant de changer le theme, pour servir de
  // fond statique pendant que le cercle revele la nouvelle couleur.
  const leavingBg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.body.style.backgroundColor = leavingBg;

  // Rayon necessaire pour que le cercle couvre bien tout l'ecran depuis son
  // point de depart (coin le plus eloigne de l'origine).
  const dx = Math.max(originX, window.innerWidth - originX);
  const dy = Math.max(originY, window.innerHeight - originY);
  const radius = Math.ceil(Math.hypot(dx, dy));

  pageBg.style.transition = 'none';
  pageBg.style.clipPath = `circle(0px at ${originX}px ${originY}px)`;

  // Le theme change des maintenant : la nouvelle couleur est deja la sur
  // pageBg, simplement masquee hors du cercle par le clip-path ci-dessus.
  root.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);

  // Deux frames pour garantir que le navigateur peint bien le cercle a 0
  // avant de lancer la transition vers le rayon final.
  requestAnimationFrame(() => {
    pageBg.style.transition = `clip-path ${REVEAL_MS}ms cubic-bezier(.65,0,.35,1)`;
    requestAnimationFrame(() => {
      pageBg.style.clipPath = `circle(${radius}px at ${originX}px ${originY}px)`;
    });
  });

  setTimeout(() => {
    pageBg.style.transition = '';
    pageBg.style.clipPath = '';
    document.body.style.backgroundColor = '';
    isFlipping = false;
  }, REVEAL_MS + 60);
}

toggleBtn.addEventListener('click', (e) => {
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  const rect = toggleBtn.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  flipTheme(next, originX, originY);
});

// Menu du bouton en haut a droite : ouverture/fermeture, vide pour l'instant
const menuBtn = document.getElementById('menu-toggle');
const menuPanel = document.getElementById('menu-panel');

menuBtn.addEventListener('click', () => {
  const isOpen = menuPanel.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', isOpen);
});

document.addEventListener('click', (e) => {
  if (!menuPanel.contains(e.target) && !menuBtn.contains(e.target)) {
    menuPanel.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
});

// Petit halo qui suit la souris sur les cartes de services et de tarifs,
// meme logique que sur la page Competences.
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!reduceMotionQuery.matches) {
  document.querySelectorAll('.service-card').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    });
  });
}
