(() => {
  const navbarScript = document.currentScript;
  const NAVBAR_VERSION = '20261028-nav-6';

  async function ensureNavbarStyles() {
    if (!navbarScript?.src || location.protocol === 'file:') return;
    const url = new URL('../styles/navbar.css', navbarScript.src);
    url.searchParams.set('v', NAVBAR_VERSION);
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => {
      const target = new URL(link.href, location.href);
      return target.origin === url.origin && target.pathname === url.pathname;
    });
    if (existing?.href === url.href && existing.sheet) return;
    await new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url.href;
      link.addEventListener('load', () => { existing?.remove(); resolve(); }, { once: true });
      link.addEventListener('error', () => { link.remove(); console.warn('Navbar stylesheet could not load.'); resolve(); }, { once: true });
      document.head.appendChild(link);
    });
  }

  function initSiteSearch(nav, closeMenus) {
    const trigger = nav.querySelector('.maul-nav-search');
    if (!trigger) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'maul-site-search';
    dialog.id = 'maul-site-search';
    dialog.setAttribute('aria-labelledby', 'maul-site-search-title');
    dialog.innerHTML = `<div class="maul-search-top">
      <div><p class="maul-search-kicker">SEARCH MAUL</p><h2 id="maul-site-search-title">Find something across the site.</h2></div>
      <button class="maul-search-close" type="button" aria-label="Close site search">×</button>
      </div>
      <form class="maul-search-form" role="search">
        <label for="maul-site-query">Search all MAUL pages</label>
        <input id="maul-site-query" type="search" autocomplete="off" placeholder="Try lobby templates, regions, or events…" aria-describedby="maul-search-status" />
      </form>
      <p id="maul-search-status" class="maul-search-status" role="status" aria-live="polite">Loading site search…</p>
      <div class="maul-search-results"></div>`;
    document.body.appendChild(dialog);
    const input = dialog.querySelector('input');
    const results = dialog.querySelector('.maul-search-results');
    const status = dialog.querySelector('.maul-search-status');
    let pages = [], loading = true, refreshing = false, indexPromise;
    const fold = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const words = () => [...new Set(fold(input.value).match(/[\p{L}\p{N}]+/gu) || [])];
    const siteOrigin = location.protocol === 'file:' ? 'https://moddedamong.us' : location.origin;
    const safePath = (value) => {
      try {
        const url = new URL(value, siteOrigin);
        if (![siteOrigin, 'https://moddedamong.us', 'https://www.moddedamong.us'].includes(url.origin)) return null;
        if (!/^https?:$/.test(url.protocol) || url.search) return null;
        const path = url.pathname.replace(/\/index\.html$/, '/');
        if (!(/\.html$/.test(path) || path.endsWith('/') || /^\/servers\/MAUL_(NA|EU)$/.test(path))) return null;
        if (/(?:preview|404|\/components\/|\/includes\/)/i.test(path)) return null;
        return path;
      } catch { return null; }
    };
    const prepare = (page) => ({ ...page, url: safePath(page.url), title: String(page.title || 'MAUL'), text: String(page.text || ''), titleKey: fold(page.title), headingKey: fold(page.headings), key: fold(`${page.title} ${page.headings || ''} ${page.description || ''} ${page.text || ''}`) });
    const merge = (entries) => {
      const byPath = new Map(pages.map(page => [page.url, page]));
      entries.forEach(entry => { const page = prepare(entry); if (page.url) byPath.set(page.url, page); });
      pages = [...byPath.values()];
    };
    const snippet = (page, terms) => {
      const paragraphs = `${page.description || ''}\n${page.text}`.split('\n').filter(Boolean);
      const best = paragraphs.map(text => ({ text, score: terms.reduce((score, term) => score + (fold(text).includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score)[0]?.text || page.title;
      const firstHit = terms.length ? fold(best).indexOf(terms.find(term => fold(best).includes(term)) || '') : 0;
      const start = firstHit > 100 ? Math.max(0, best.lastIndexOf(' ', firstHit - 60)) : 0;
      return (start ? '…' : '') + best.slice(start, start + 190).trim() + (best.length > start + 190 ? '…' : '');
    };
    const highlight = (element, value, terms) => {
      const normalized = fold(value);
      const hits = [];
      terms.forEach(term => { let at = normalized.indexOf(term); while (at !== -1) { hits.push([at, at + term.length]); at = normalized.indexOf(term, at + term.length); } });
      hits.sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      hits.forEach(([start, end]) => {
        if (start < cursor) return;
        element.append(document.createTextNode(value.slice(cursor, start)));
        const mark = document.createElement('mark'); mark.textContent = value.slice(start, end); element.append(mark); cursor = end;
      });
      element.append(document.createTextNode(value.slice(cursor)));
    };
    function render() {
      const terms = words();
      const focusedHref = results.contains(document.activeElement) ? document.activeElement.closest('a')?.href : null;
      results.replaceChildren();
      if (loading) { status.textContent = 'Loading site search…'; return; }
      const query = fold(input.value.trim());
      const ranked = terms.length ? pages.filter(page => terms.every(term => page.key.includes(term))).map(page => ({ page, score: (page.titleKey.includes(query) ? 100 : 0) + terms.reduce((score, term) => score + (page.titleKey.includes(term) ? 24 : 0) + (page.headingKey.includes(term) ? 8 : 0), 0) })).sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title)).map(result => result.page) : pages.filter(page => ['/templates.html', '/regions.html', '/faq.html', '/calendar.html', '/mods.html', '/ourstaff.html'].includes(page.url));
      status.textContent = terms.length ? `${ranked.length} ${ranked.length === 1 ? 'page' : 'pages'} found${refreshing ? ' · Updating page content…' : ''}` : `Search page titles and content across MAUL. ${refreshing ? 'Updating pages…' : 'Popular pages below.'}`;
      if (!ranked.length) {
        const empty = document.createElement('p'); empty.className = 'maul-search-empty'; empty.textContent = 'No pages found. Try a different word or a shorter phrase.'; results.append(empty); return;
      }
      ranked.slice(0, 30).forEach(page => {
        const link = document.createElement('a'); link.className = 'maul-search-result'; link.href = new URL(page.url, siteOrigin).href;
        const title = document.createElement('strong'); highlight(title, page.title, terms);
        const text = document.createElement('span'); highlight(text, snippet(page, terms), terms);
        const path = document.createElement('small'); path.textContent = 'moddedamong.us' + page.url;
        link.append(title, text, path); results.append(link);
      });
      if (focusedHref) ([...results.querySelectorAll('a')].find(link => link.href === focusedHref) || input).focus();
    }
    async function refreshPages() {
      if (location.protocol === 'file:' || nav.dataset.preview === 'true') return;
      refreshing = true; render();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const queue = pages.map(page => page.url);
      const updated = [];
      try {
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (queue.length && !controller.signal.aborted) {
            const url = queue.shift();
            try {
              const response = await fetch(new URL(url, siteOrigin), { signal: controller.signal, cache: 'no-cache' });
              if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) continue;
              const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
              if (/^(404|page not found)/i.test(doc.title.trim())) continue;
              const title = doc.title.trim() || doc.querySelector('h1')?.textContent.trim();
              const description = doc.querySelector('meta[name="description"], meta[property="og:description"]')?.content || '';
              doc.querySelectorAll('script, style, nav, footer, dialog, template, #navbar, [aria-hidden="true"], [hidden], .featured-spotlight, .link-warning').forEach(node => node.remove());
              const body = doc.querySelector('main') || doc.body;
              if (!body) continue;
              const headings = [...body.querySelectorAll('h1,h2,h3')].map(node => node.textContent.trim()).join(' ');
              body.querySelectorAll('p,div,section,article,li,h1,h2,h3,h4,br').forEach(node => node.append(doc.createTextNode('\n')));
              const text = body.textContent.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, 100000);
              updated.push({ url, title, description, headings, text });
            } catch { /* Idk if youll look but this keeps the text bundled together*/ }
          }
        }));
        merge(updated);
      } finally { clearTimeout(timeout); refreshing = false; if (dialog.open) render(); }
    }
    async function loadIndex() {
      try {
        const embedded = document.getElementById('maul-search-index');
        const data = embedded ? JSON.parse(embedded.textContent) : await (async () => {
          const url = navbarScript?.src ? new URL('../data/search-index.json', navbarScript.src) : new URL('/data/search-index.json', siteOrigin);
          const response = await fetch(url, { cache: 'no-cache' });
          if (!response.ok) throw Error('Search index unavailable');
          return response.json();
        })();
        if (!Array.isArray(data.pages)) throw Error('Invalid search index');
        merge(data.pages);
      } catch (error) { console.warn('Loading live pages for site search:', error); }
      const known = new Set(pages.map(page => page.url));
      nav.querySelectorAll('a[href]').forEach(link => {
        const url = safePath(link.href);
        if (url && !known.has(url)) { merge([{ url, title: link.textContent.trim(), text: '' }]); known.add(url); }
      });
      loading = false; render();
      await refreshPages();
    }
    trigger.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation(); closeMenus();
      dialog.showModal(); input.focus({ preventScroll: true }); render();
      indexPromise ||= loadIndex();
    });
    dialog.querySelector('.maul-search-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); }
    });
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }
      if (event.target.closest('.maul-search-result')) dialog.close();
    });
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector('a')?.focus(); } });
    results.addEventListener('keydown', event => {
      const links = [...results.querySelectorAll('a')], at = links.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') { event.preventDefault(); links[Math.min(at + 1, links.length - 1)]?.focus(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); (links[at - 1] || input).focus(); }
    });
    dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); results.querySelector('a')?.click(); });
  }

  function createNavHighlight(nav) {
    const indicator = document.createElement('span');
    indicator.className = 'maul-nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    nav.appendChild(indicator);
    let activeControl = null;
    let frame = 0;
    let positioned = false;

    const controlFor = (node) => {
      if (!(node instanceof Element)) return null;
      const group = node.closest('.maul-nav-group');
      if (group && nav.contains(group)) return group.querySelector('summary');
      const control = node.closest('.maul-nav-brand, .maul-nav-link');
      return control && nav.contains(control) ? control : null;
    };
    const position = () => {
      frame = 0;
      if (!activeControl?.isConnected) return;
      const navRect = nav.getBoundingClientRect();
      let rect = activeControl.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        indicator.style.opacity = '0';
        return;
      }
      if (activeControl.classList.contains('maul-nav-brand')) {
        const range = document.createRange();
        range.selectNodeContents(activeControl);
        rect = range.getBoundingClientRect();
      }
      indicator.style.width = `${Math.max(0, rect.width - 8)}px`;
      indicator.style.transform = `translate3d(${rect.left - navRect.left + 4}px, ${rect.bottom - navRect.top - 4}px, 0)`;
      indicator.style.opacity = '1';
      if (!positioned) {
        positioned = true;
        requestAnimationFrame(() => indicator.classList.add('is-positioned'));
      }
      if (nav.classList.contains('nav-entering')) schedulePosition();
    };
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(position);
    };
    const select = (node) => {
      const control = controlFor(node);
      if (!control) return;
      if (activeControl !== control) {
        activeControl?.classList.remove('is-highlighted');
        activeControl = control;
        control.classList.add('is-highlighted');
      }
      schedulePosition();
    };
    nav.addEventListener('click', event => select(event.target), true);
    const resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(nav);
    nav.querySelectorAll('summary, .maul-nav-link, .maul-nav-brand').forEach(control => resizeObserver.observe(control));
    window.addEventListener('resize', schedulePosition, { passive: true });
    nav.addEventListener('animationend', schedulePosition);
    document.fonts?.ready.then(schedulePosition);
    return { select };
  }

  function initMobileMenu(nav, closeMenus) {
    const toggle = nav.querySelector('.maul-nav-toggle');
    const links = nav.querySelector('.maul-nav-items');
    if (!toggle || !links) return { close: () => false };
    const mobile = matchMedia('(max-width: 980px)');
    const regions = nav.querySelector('.maul-nav-region-feature, .maul-nav-regions-link');
    const more = nav.querySelector('[data-nav-group="more"], .maul-nav-more-link');
    let expanded = false;
    const render = () => {
      const collapsed = mobile.matches && !expanded;
      nav.classList.toggle('is-mobile-collapsed', collapsed);
      links.inert = collapsed;
      if (regions) regions.inert = collapsed;
      if (more) more.inert = mobile.matches;
      toggle.hidden = !mobile.matches;
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Open navigation' : 'Close navigation');
    };
    toggle.addEventListener('click', event => {
      if (!mobile.matches) return;
      expanded = !expanded;
      closeMenus();
      render();
      if (expanded && event.detail === 0) links.querySelector('summary, a')?.focus({ preventScroll: true });
    });
    mobile.addEventListener('change', () => {
      expanded = false;
      closeMenus();
      render();
    });
    render();
    return {
      toggle,
      close() {
        if (!mobile.matches || !expanded) return false;
        expanded = false;
        closeMenus();
        render();
        return true;
      }
    };
  }

  function initNavbar(root) {
    const nav = root.querySelector(".maul-nav");
    if (!nav || nav.dataset.navbarReady === "true") return;
    nav.dataset.navbarReady = "true";
    const host = nav.closest('#navbar');
    if (host) {
      host.classList.add('maul-nav-host');
      document.documentElement.classList.add('maul-nav-enabled');
      const updateNavHeight = () => {
        document.documentElement.style.setProperty('--maul-nav-height', `${Math.ceil(host.getBoundingClientRect().height)}px`);
      };
      new ResizeObserver(updateNavHeight).observe(host);
      updateNavHeight();
    }
    const groups = [...nav.querySelectorAll(".maul-nav-group")];
    const highlight = createNavHighlight(nav);
    const closeMenus = (except) => groups.forEach((group) => {
      if (group !== except) group.open = false;
    });
    const mobileMenu = initMobileMenu(nav, closeMenus);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const spotlight = document.querySelector('.featured-spotlight');
      let entranceFinished = false;
      let observer;
      const finishEntrance = () => {
        entranceFinished = true;
        nav.classList.remove('nav-entering');
        observer?.disconnect();
      };
      const reveal = () => {
        if (entranceFinished) return;
        if (spotlight?.classList.contains('open')) nav.classList.remove('nav-entering');
        else nav.classList.add('nav-entering');
      };
      if (spotlight) {
        observer = new MutationObserver(reveal);
        observer.observe(spotlight, { attributes: true, attributeFilter: ['class'] });
      }
      reveal();
      nav.addEventListener('animationend', event => { if (event.animationName === 'maulNavUnroll') finishEntrance(); });
      nav.addEventListener('pointerdown', finishEntrance, { once: true });
      nav.addEventListener('focusin', finishEntrance, { once: true });
    }

    groups.forEach((group) => {
      const summary = group.querySelector("summary");
      summary.addEventListener("click", () => closeMenus(group));
      group.addEventListener("toggle", () => {
        if (group.open) {
          closeMenus(group);
          highlight.select(summary);
        }
      });
      summary.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        highlight.select(summary);
        closeMenus(group);
        group.open = true;
        group.querySelector(".maul-nav-panel a")?.focus({ preventScroll: true });
      });
    });

    const currentPath = (nav.dataset.currentPage || location.pathname).replace(/\/$/, "/index.html");
    nav.querySelectorAll("a[href]").forEach((link) => {
      const target = new URL(link.href, location.href);
      if (!target.hash && target.pathname.replace(/\/$/, "/index.html") === currentPath) {
        link.setAttribute("aria-current", "page");
        const group = link.closest(".maul-nav-group");
        if (group) group.querySelector("summary").classList.add("is-current");
        else link.classList.add("is-current");
      }
      link.addEventListener("click", () => closeMenus());
    });
    highlight.select(nav.querySelector('.maul-nav-items .is-current, .maul-nav-region-feature .is-current, .maul-nav-regions-link.is-current'));

    document.addEventListener("click", (event) => {
      if (!nav.contains(event.target)) closeMenus();
    });
    document.addEventListener("focusin", (event) => {
      if (!nav.contains(event.target)) closeMenus();
    });
    nav.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const openGroup = groups.find((group) => group.open);
      if (!openGroup) {
        if (mobileMenu.close()) {
          event.preventDefault();
          mobileMenu.toggle.focus({ preventScroll: true });
        }
        return;
      }
      event.preventDefault();
      closeMenus();
      openGroup.querySelector("summary").focus({ preventScroll: true });
    });
    initSiteSearch(nav, closeMenus);
  }

  async function loadNavbar() {
    const container = document.getElementById("navbar");
    if (!container) return;
    await ensureNavbarStyles();
    if (container.querySelector(".maul-nav")) {
      initNavbar(container);
      return;
    }
    const paths = [...new Set([
      ...(navbarScript?.src ? [new URL("../components/navbar.html", navbarScript.src).href] : []),
      "/components/navbar.html", "./components/navbar.html", "../components/navbar.html"
    ])];
    for (const path of paths) {
      try {
        const versionedPath = new URL(path, location.href);
        versionedPath.searchParams.set('v', NAVBAR_VERSION);
        const response = await fetch(versionedPath.href, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        if (!html.includes('class="maul-nav"')) throw new Error("Missing navigation component");
        container.innerHTML = html;
        initNavbar(container);
        return;
      } catch (error) {
        console.warn("Navbar could not load from", path, error);
      }
    }
    container.innerHTML = `<nav class="maul-nav" aria-label="Primary navigation">
      <a class="maul-nav-brand" href="https://moddedamong.us/" aria-label="MAUL home">MAUL</a>
      <div class="maul-nav-items" id="maul-primary-links">
        <a class="maul-nav-link" href="https://moddedamong.us/mods.html">Mods</a>
        <a class="maul-nav-link" href="https://moddedamong.us/customize.html">Customize</a>
        <a class="maul-nav-link" href="https://moddedamong.us/featuredusers.html">Community</a>
        <a class="maul-nav-link maul-nav-more-link" href="https://moddedamong.us/faq.html">More</a>
      </div>
        <a class="maul-nav-link maul-nav-regions-link" id="maul-regions-menu" href="https://moddedamong.us/regions.html">MAUL Regions</a>
        <button class="maul-nav-link maul-nav-search" type="button" aria-label="Search site" aria-haspopup="dialog" aria-controls="maul-site-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.75"/><path d="m16 16 4.5 4.5"/></svg></button>
      <button class="maul-nav-toggle" type="button" aria-label="Open navigation" aria-controls="maul-primary-links maul-regions-menu" aria-expanded="false" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></nav>`;
    initNavbar(container);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadNavbar, { once: true });
  else loadNavbar();

  if (location.protocol !== "file:" && !document.querySelector("script[data-maul-pwa]") && !window.Capacitor?.isNativePlatform?.()) {
    const pwaScript = document.createElement("script");
    pwaScript.src = "/scripts/pwa.js";
    pwaScript.dataset.maulPwa = "";
    document.head.appendChild(pwaScript);
  }
})();
