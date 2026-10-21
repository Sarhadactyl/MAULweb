(() => {
  if (window.MAUL_PWA || window.Capacitor?.isNativePlatform?.()) return;
  window.MAUL_PWA = true;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  document.documentElement.classList.toggle('maul-standalone', standalone);

  function ensureElement(selector, tag, attributes) {
    if (document.head.querySelector(selector)) return;
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    document.head.appendChild(element);
  }
  ensureElement('link[rel="manifest"]', 'link', { rel: 'manifest', href: '/manifest.webmanifest' });
  ensureElement('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/pwa/icons/apple-touch-icon.png' });
  ensureElement('link[href="/styles/pwa.css"]', 'link', { rel: 'stylesheet', href: '/styles/pwa.css' });
  for (const [name, content] of Object.entries({
    'theme-color': '#050506',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'MAUL',
    'apple-mobile-web-app-status-bar-style': 'black-translucent'
  })) ensureElement(`meta[name="${name}"]`, 'meta', { name, content });
  if (standalone) {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && !viewport.content.includes('viewport-fit')) viewport.content += ', viewport-fit=cover';

    // Keep MAUL pages in this app window. External sites and game links keep their normal behavior.
    document.addEventListener('click', event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.defaultPrevented || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return;
      if (url.origin === location.origin || ['https://moddedamong.us', 'https://www.moddedamong.us'].includes(url.origin)) {
        anchor.href = url.pathname + url.search + url.hash;
        anchor.removeAttribute('target');
      }
    }, true);
  }

  function updateConnectionNotice() {
    let notice = document.getElementById('maul-offline-notice');
    if (navigator.onLine || !standalone) { notice?.remove(); return; }
    if (notice) return;
    notice = document.createElement('div');
    notice.id = 'maul-offline-notice';
    notice.className = 'maul-offline-notice';
    notice.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = 'You’re offline. Saved information may be out of date; live lobbies and rankings need a connection.';
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss offline notice');
    close.textContent = '×';
    close.addEventListener('click', () => notice.remove());
    notice.append(text, close);
    document.body.appendChild(notice);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateConnectionNotice, { once: true });
  else updateConnectionNotice();
  window.addEventListener('online', updateConnectionNotice);
  window.addEventListener('offline', updateConnectionNotice);

  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.warn('MAUL offline support could not start:', error));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
})();
