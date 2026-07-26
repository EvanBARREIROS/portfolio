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

// Animation de transition : seul le fond (derriere tout le contenu) se retourne en
// plaques. Navbar, cartes, texte, images restent affiches en continu et fondent
// simplement d'une couleur a l'autre (via les transitions CSS deja en place).
const pageBg = document.getElementById('page-bg');
let isFlipping = false;

function flipTheme(nextTheme) {
  if (isFlipping) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    root.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    return;
  }

  isFlipping = true;

  // Couleur qu'on quitte (face avant) capturee avant de changer le theme.
  const leavingBg = getComputedStyle(root).getPropertyValue('--bg').trim();

  // Taille de plaque cible en pixels : plus petit = grain plus fin. Le nombre de
  // colonnes/lignes en decoule pour obtenir de vrais carres.
  const targetTileSize = window.innerWidth < 680 ? 42 : 65;
  const cols = Math.max(6, Math.round(window.innerWidth / targetTileSize));
  const rows = Math.max(4, Math.round(window.innerHeight / targetTileSize));
  const tileDelayStep = 10; // ms, vague diagonale plus resserree
  const flipDuration = 550; // ms, doit correspondre a la transition CSS

  pageBg.style.setProperty('--flip-cols', cols);
  pageBg.style.setProperty('--flip-rows', rows);
  pageBg.innerHTML = '';

  // Le theme change des maintenant : on peut lire la couleur d'arrivee (face arriere)
  // directement depuis la variable CSS mise a jour.
  root.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
  const arrivingBg = getComputedStyle(root).getPropertyValue('--bg').trim();

  const fragment = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const delay = (r + c) * tileDelayStep;

      const cell = document.createElement('span');
      cell.className = 'tile-cell';

      const tile = document.createElement('span');
      tile.className = 'flip-tile';
      tile.style.setProperty('--tile-delay', `${delay}ms`);

      const front = document.createElement('span');
      front.className = 'face face-front';
      front.style.setProperty('--tile-front', leavingBg);

      const back = document.createElement('span');
      back.className = 'face face-back';
      back.style.setProperty('--tile-back', arrivingBg);

      tile.appendChild(front);
      tile.appendChild(back);
      cell.appendChild(tile);
      fragment.appendChild(cell);
    }
  }
  pageBg.appendChild(fragment);
  pageBg.classList.add('is-flipping-setup');

  // Deux frames pour garantir que le navigateur a bien peint l'etat initial avant de lancer la transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pageBg.classList.add('is-flipping');
    });
  });

  const maxDelay = (cols - 1 + rows - 1) * tileDelayStep;
  const totalDuration = flipDuration + maxDelay + 80;
  setTimeout(() => {
    pageBg.classList.remove('is-flipping', 'is-flipping-setup');
    pageBg.innerHTML = '';
    isFlipping = false;
  }, totalDuration);
}

toggleBtn.addEventListener('click', () => {
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  flipTheme(next);
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