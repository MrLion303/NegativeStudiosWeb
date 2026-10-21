(() => {
  'use strict';

  const OWNER = 'MrLion303';
  const REPOSITORY = 'negativeclient-countdowns';
  const BRANCH = 'main';
  const DATA_PATH = 'data/countdowns.json';
  const API_URL = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/commits/${BRANCH}`;
  const RAW_MAIN_URL = `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${BRANCH}/${DATA_PATH}`;
  const sourceScript = document.currentScript;
  const cssUrl = new URL('countdown-widget.css?v=20261021a', sourceScript?.src || location.href).href;

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
  let lastCommitSha = '';
  let lastRenderSignature = '';
  let refreshInProgress = false;
  let lastRefreshAt = 0;
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

    if (signature !== lastRenderSignature) {
      lastRenderSignature = signature;
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
        renderedItems.push({ item, remaining, banner });
      });
    }

    host.hidden = items.length === 0;

    renderedItems.forEach(entry => {
      const end = Date.parse(entry.item.endAtUtc);
      if (end <= Date.now()) {
        entry.remaining.textContent = '00:00:00:00';
      } else {
        entry.remaining.textContent = formatRemaining(entry.item.endAtUtc);
      }
    });
  }

  async function fetchJson(url, accept) {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}ns_countdown_live=${Date.now()}`, {
      cache: 'no-store',
      headers: accept ? { Accept: accept } : {}
    });
    if (!response.ok) throw new Error(`GitHub devolvió ${response.status}`);
    return response.json();
  }

  async function refresh() {
    if (refreshInProgress) return;
    refreshInProgress = true;
    lastRefreshAt = Date.now();

    try {
      let commitSha = '';

      try {
        const commit = await fetchJson(API_URL, 'application/vnd.github+json');
        if (typeof commit?.sha === 'string' && /^[a-f0-9]{40}$/i.test(commit.sha)) {
          commitSha = commit.sha;
        }
      } catch (_) {
        // Si la API de GitHub está temporalmente limitada, se prueba la URL pública del JSON.
      }

      if (commitSha && commitSha === lastCommitSha) {
        render();
        return;
      }

      let data = null;

      if (commitSha) {
        try {
          data = await fetchJson(
            `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${commitSha}/${DATA_PATH}`,
            'application/json'
          );
          lastCommitSha = commitSha;
        } catch (_) {
          data = null;
        }
      }

      if (!data) {
        data = await fetchJson(RAW_MAIN_URL, 'application/json');
        lastCommitSha = '';
      }

      feed = normalizeFeed(data);
      render();
    } catch (error) {
      // Si la red falla, se conserva el último estado conocido y no se interrumpe la página.
      console.warn('[NegativeStudios] No se pudo actualizar la cuenta regresiva.', error);
    } finally {
      refreshInProgress = false;
    }
  }

  render();
  refresh();
  window.setInterval(render, 1000);
  window.setInterval(refresh, 90000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastRefreshAt > 30000) refresh();
  });
})();
