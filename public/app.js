// Tiny router: / (create), /s/:id (split), /growth (live stats).
// On a static host without rewrites the same views work as /?s=:id and /?view=growth.
import { navigate, paths } from './js/core.js';
import { mountCreate } from './js/create.js';
import { mountSplit } from './js/split.js';
import { mountGrowth } from './js/growth.js';

const root = document.getElementById('app');
let cleanup = () => {};

function route() {
  cleanup();
  const url = new URL(location.href);
  const match = url.pathname.match(/^\/s\/([A-Za-z0-9]{6,32})\/?$/);
  const splitId = match?.[1] || url.searchParams.get('s');
  let nav = 'home';
  if (splitId && /^[A-Za-z0-9]{6,32}$/.test(splitId)) {
    nav = 'split';
    cleanup = mountSplit(root, splitId, { isNew: url.searchParams.has('new') });
  } else if (url.pathname === '/growth' || url.searchParams.get('view') === 'growth') {
    nav = 'growth';
    document.title = 'Live stats · Tapsplit';
    cleanup = mountGrowth(root);
  } else {
    document.title = 'Tapsplit · Snap the bill, everyone taps what they had';
    cleanup = mountCreate(root, { ref: url.searchParams.get('ref') });
  }
  root.dataset.view = nav;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// In-app links navigate without a full reload.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !(a.hasAttribute('data-link') || a.hasAttribute('data-nav') || a.classList.contains('brand'))) return;
  e.preventDefault();
  navigate(url.pathname + url.search);
});

document.querySelector('[data-nav="home"]').setAttribute('href', paths.home());
document.querySelector('[data-nav="growth"]').setAttribute('href', paths.growth());
document.querySelectorAll('.footer a').forEach((a) => a.setAttribute('href', paths.growth()));

window.addEventListener('popstate', route);
window.addEventListener('tapsplit:navigate', route);
route();
