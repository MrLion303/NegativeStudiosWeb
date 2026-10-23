(() => {
  'use strict';

  const OWNER = 'MrLion303';
  const REPOSITORY = 'negativeclient-countdowns';
  const BRANCH = 'main';
  const DATA_PATH = 'data/countdowns.json';
  const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${BRANCH}/${DATA_PATH}`;
  const REFRESH_INTERVAL_MS = 1500;
  const CACHE_KEY = 'ns-global-countdowns:v1';
  const sourceScript = document.currentScript;
  const cssUrl = new URL('countdown-widget.css?v=20261021b', sourceScript?.src || location.href).href;

  if (!document.querySelector('[data-ns-countdown-styles]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = cssUrl;
    stylesheet.dataset.nsCountdownStyles = 'true';
    document.head.appendChild(stylesheet);
  }

  if (document.querySelector('.ns-global-countdowns')) return;

  const host = document.createElement('aside');
  host.className = 'ns-global-countdowns';
  host.hidden = true;
  host.setAttribute('aria-label', 'Cuentas regresivas activas de Negative Client');
  host.setAttribute('role', 'region');
  document.body.appendChild(host);

  let feed = [];
  let lastFeedSignature = '';
  let lastSourceUpdatedAt = 0;
  let refreshInProgress = false;
  let lastWarningAt = 0;
  let renderedItems = [];

  function normalizeFeed(data) {
    const list = Array.isArray(data?.countdowns) ? data.countdowns : [];
    return list
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        id: String(item.id ?? item.Id ?? ''),
        name: String(item.name ?? item.Name ?? '').trim(),
        endAtUtc: String(item.endAtUtc ?? item.EndAtUtc ?? ''),
        active: Boolean(item.active ?? item.Active)
      }))
      .filter(item => item.id && item.name && Number.isFinite(Date.parse(item.endAtUtc)));
  }

  function getActiveCountdowns() {
    const now = Date.now();
    const unique = new Map();

    feed.forEach(item => {
      const end = Date.parse(item.endAtUtc);
      if (!item.active || !item.name || !Number.isFinite(end) || end <= now) return;

      const key = item.id.toLowerCase() || `${item.name.toLowerCase()}|${item.endAtUtc}`;
      unique.set(key, item);
    });

    return [...unique.values()].sort((a, b) => Date.parse(a.endAtUtc) - Date.parse(b.endAtUtc));
  }

  function formatRemaining(endAtUtc) {
    const end = Date.parse(endAtUtc);
    if (!Number.isFinite(end)) return '00:00:00:00';

    let seconds = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds - minutes * 60;
    const pad = value => String(value).padStart(2, '0');

    return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }

  function createTextElement(className, text) {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function render() {
    const items = getActiveCountdowns();
    const signature = JSON.stringify(items.map(item => [item.id, item.name, item.endAtUtc]));

    if (signature !== lastFeedSignature) {
      lastFeedSignature = signature;
      host.replaceChildren();
      renderedItems = [];

      items.forEach(item => {
        const banner = document.createElement('div');
        banner.className = 'ns-countdown-banner';

        const dot = document.createElement('span');
        dot.className = 'ns-countdown-dot';
        dot.setAttribute('aria-hidden', 'true');

        const copy = document.createElement('div');
        copy.className = 'ns-countdown-copy';
        copy.appendChild(createTextElement('ns-countdown-name', item.name));

        const detail = document.createElement('div');
        detail.className = 'ns-countdown-detail';
        detail.appendChild(createTextElement('ns-countdown-prefix', 'en'));
        const remaining = createTextElement('ns-countdown-remaining', '');
        detail.appendChild(remaining);
        copy.appendChild(detail);

        banner.append(dot, copy);
        host.appendChild(banner);
        renderedItems.push({ item, remaining });
      });
    }

    host.hidden = items.length === 0;

    renderedItems.forEach(entry => {
      entry.remaining.textContent = formatRemaining(entry.item.endAtUtc);
    });
  }

  async function fetchFeed() {
    // Usar siempre la rama pública con una URL nueva evita el límite de la API REST
    // de GitHub y reduce la posibilidad de recibir una respuesta guardada en caché.
    const separator = RAW_URL.includes('?') ? '&' : '?';
    const url = `${RAW_URL}${separator}ns_countdown_live=${Date.now()}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`GitHub devolvió ${response.status}`);
    return response.json();
  }

  async function refresh() {
    if (refreshInProgress || document.hidden) return;
    refreshInProgress = true;

    try {
      const data = await fetchFeed();
      const nextFeed = normalizeFeed(data);
      const sourceUpdatedAt = Date.parse(data?.updatedAt ?? data?.UpdatedAt ?? '');
      const nextSignature = JSON.stringify(nextFeed.map(item => [
        item.id, item.name, item.endAtUtc, item.active
      ]));

      // No permitir que una respuesta antigua de la CDN revierta un cambio reciente.
      if (
        Number.isFinite(sourceUpdatedAt) &&
        sourceUpdatedAt > 0 &&
        lastSourceUpdatedAt > 0 &&
        sourceUpdatedAt < lastSourceUpdatedAt
      ) {
        return;
      }

      if (
        Number.isFinite(sourceUpdatedAt) &&
        sourceUpdatedAt > 0
      ) {
        lastSourceUpdatedAt = Math.max(lastSourceUpdatedAt, sourceUpdatedAt);
      }

      // Guardar cada lectura válida, incluso si el contenido no cambió, para
      // poder recuperar la cuenta rápidamente en la siguiente visita.
      cacheFeed(data, nextFeed);

      if (nextSignature !== JSON.stringify(feed.map(item => [
        item.id, item.name, item.endAtUtc, item.active
      ]))) {
        feed = nextFeed;
        lastFeedSignature = '';
        render();
      }
    } catch (error) {
      // Mantener el último estado visible si hay un fallo de red transitorio.
      if (Date.now() - lastWarningAt > 30000) {
        console.warn('[NegativeStudios] No se pudo actualizar la cuenta regresiva.', error);
        lastWarningAt = Date.now();
      }
    } finally {
      refreshInProgress = false;
    }
  }

  // Reutilizar el último estado válido para mostrar la cuenta regresiva sin esperar la red.
  // La consulta remota sigue siendo la fuente de verdad y sustituye la caché al actualizarse.
  function restoreCachedFeed() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.countdowns)) return;
      const cachedStamp = Date.parse(cached.updatedAt || '');
      if (Number.isFinite(cachedStamp) && cachedStamp > 0) lastSourceUpdatedAt = cachedStamp;
      feed = normalizeFeed(cached);
    } catch (_) {}
  }

  function cacheFeed(data, nextFeed) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        schema: Number(data?.schema) || 1,
        updatedAt: data?.updatedAt || null,
        countdowns: nextFeed
      }));
    } catch (_) {}
  }

  restoreCachedFeed();
  render();
  refresh();

  // La cuenta visible se actualiza cada segundo; los cambios publicados se consultan
  // más rápido y también al regresar a la pestaña o recuperar conexión.
  window.setInterval(render, 1000);
  window.setInterval(refresh, REFRESH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', refresh);

  // Sincroniza el estado visible entre pestañas de este mismo sitio.
  window.addEventListener('storage', event => {
    if (event.key !== CACHE_KEY || !event.newValue) return;
    try {
      const cached = JSON.parse(event.newValue);
      const stamp = Date.parse(cached.updatedAt || '');
      if (Number.isFinite(stamp) && lastSourceUpdatedAt && stamp < lastSourceUpdatedAt) return;
      if (Number.isFinite(stamp) && stamp > 0) lastSourceUpdatedAt = stamp;
      feed = normalizeFeed(cached);
      lastFeedSignature = '';
      render();
    } catch (_) {}
  });
})();
