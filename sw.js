// Offline shell: the app files load from cache; campaign data always comes from Firebase.
const CACHE = 'dndm-v41';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/ui.js', 'js/data.js', 'js/config.js', 'js/ops.js', 'js/cards.js',
  'js/campaign.js', 'js/character.js', 'js/rules5e.js', 'js/dice.js', 'js/dice3d.js', 'js/backup.js', 'js/help.js', 'js/builder.js', 'js/builder-data.js', 'js/session.js', 'js/foes.js', 'js/map.js', 'js/log.js', 'js/table.js', 'js/wiki.js', 'js/loot.js', 'js/prep.js', 'js/world.js', 'js/startkit.js', 'js/classperks.js', 'js/shop.js', 'js/spellinfo.js', 'js/zero.js', 'vendor/preact-htm.js', 'icons/icon.svg', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so updates arrive right away; cache as fallback when offline
  // no-cache = always ask GitHub for the newest file (cheap revalidation), so updates show after one reload
  const net = e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request.url, { cache: 'no-cache' });
  e.respondWith(net.then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
