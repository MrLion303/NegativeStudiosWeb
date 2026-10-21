(function () {
  'use strict';

  // Chrome puede descartar una pestaña inactiva para liberar memoria.
  // No podemos impedir ese comportamiento desde la web, pero sí recuperar
  // la posición y los borradores cuando Chrome vuelve a cargar la pestaña.
  const wasDiscarded = document.wasDiscarded === true;
  const storageKey = 'ns-tab-resume:v1:' + location.pathname + location.search + location.hash;

  function isSensitiveField(field) {
    const type = (field.type || '').toLowerCase();
    const autocomplete = (field.autocomplete || '').toLowerCase();
    const name = (field.name || '').toLowerCase();
    const id = (field.id || '').toLowerCase();
    return field.disabled ||
      field.hasAttribute('data-no-tab-restore') ||
      ['password', 'file', 'hidden', 'submit', 'button', 'reset'].includes(type) ||
      ['current-password', 'new-password', 'one-time-code'].includes(autocomplete) ||
      /password|passwd|token|secret|otp|verification.code/.test(name + ' ' + id);
  }

  function saveState() {
    try {
      const fields = Array.from(document.querySelectorAll('input, textarea, select'));
      const state = {
        savedAt: Date.now(),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        fields: fields.map((field, index) => {
          if (isSensitiveField(field)) return null;
          const entry = {
            index,
            tag: field.tagName,
            type: (field.type || '').toLowerCase(),
            id: field.id || '',
            name: field.name || ''
          };
          if (field.type === 'checkbox' || field.type === 'radio') entry.checked = field.checked;
          else entry.value = field.value;
          if (field.tagName === 'TEXTAREA' || (field.tagName === 'INPUT' && /^(text|search|email|url|tel)$/i.test(field.type))) {
            try { entry.selectionStart = field.selectionStart; entry.selectionEnd = field.selectionEnd; } catch (_) {}
          }
          return entry;
        }),
        openDetails: Array.from(document.querySelectorAll('details')).map((node, index) => node.open ? index : -1).filter(index => index >= 0)
      };
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {
      // El almacenamiento puede estar deshabilitado o lleno; la página sigue funcionando.
    }
  }

  function restoreState() {
    if (!wasDiscarded) {
      try { sessionStorage.removeItem(storageKey); } catch (_) {}
      return;
    }

    let state;
    try {
      state = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      sessionStorage.removeItem(storageKey);
    } catch (_) {
      return;
    }
    if (!state || Date.now() - Number(state.savedAt || 0) > 60 * 60 * 1000) return;

    const fields = Array.from(document.querySelectorAll('input, textarea, select'));
    (Array.isArray(state.fields) ? state.fields : []).forEach(entry => {
      if (!entry || !Number.isInteger(entry.index)) return;
      const field = fields[entry.index];
      if (!field || isSensitiveField(field) || field.tagName !== entry.tag ||
          (field.type || '').toLowerCase() !== entry.type ||
          (field.id || '') !== entry.id || (field.name || '') !== entry.name) return;
      if (field.type === 'checkbox' || field.type === 'radio') field.checked = Boolean(entry.checked);
      else if (typeof entry.value === 'string') field.value = entry.value;
      if (Number.isInteger(entry.selectionStart) && Number.isInteger(entry.selectionEnd)) {
        try { field.setSelectionRange(entry.selectionStart, entry.selectionEnd); } catch (_) {}
      }
    });

    const details = Array.from(document.querySelectorAll('details'));
    (Array.isArray(state.openDetails) ? state.openDetails : []).forEach(index => {
      if (Number.isInteger(index) && details[index]) details[index].open = true;
    });

    requestAnimationFrame(() => {
      window.scrollTo(Number(state.scrollX) || 0, Number(state.scrollY) || 0);
      window.setTimeout(() => window.scrollTo(Number(state.scrollX) || 0, Number(state.scrollY) || 0), 250);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveState();
  });
  window.addEventListener('pagehide', saveState);
  restoreState();
})();
