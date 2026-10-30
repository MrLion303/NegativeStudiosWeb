(function () {
  'use strict';

  const ownScript = document.currentScript;
  const SCRIPT_URL = ownScript && ownScript.src ? ownScript.src : new URL('assets/accounts.js', location.href).href;
  let SITE_ROOT = new URL('../', SCRIPT_URL).href;
  let client = null;
  let currentUser = null;
  let lastProfile = null;
  let verifyEmail = '';
  let authListenerRegistered = false;
  let navLink = null;
  let commentMenuDismissBound = false;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const pageType = document.querySelector('[data-account-page]')?.dataset.accountPage || '';
  const USERNAME_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

  function ensureTrailingSlash(value) {
    return String(value || '').endsWith('/') ? String(value) : String(value || '') + '/';
  }

  function loadScript(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = marker ? document.querySelector('script[' + marker + ']') : null;
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      if (marker) script.setAttribute(marker, '');
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error('No se pudo cargar un recurso necesario.'));
      document.head.appendChild(script);
    });
  }

  function ensureStyles() {
    const href = new URL('assets/account.css?v=20261023j', SITE_ROOT).href;
    if (!$$('link[rel="stylesheet"]').some(link => link.href === href)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function message(id, text, kind) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    if (kind) el.dataset.kind = kind;
    else delete el.dataset.kind;
  }

  function setConfigNotice(text) {
    $$('[data-account-config-notice]').forEach(el => {
      el.replaceChildren();
      const p = document.createElement('p');
      p.textContent = text;
      el.appendChild(p);
      const link = document.createElement('a');
      link.href = 'https://github.com/MrLion303/NegativeStudiosWeb/blob/main/SUPABASE_SETUP.md';
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Ver guía de configuración';
      link.style.display = 'inline-block';
      link.style.marginTop = '6px';
      el.appendChild(link);
      el.hidden = false;
    });
  }

  function ensureNavLink() {
    const nav = document.querySelector('.nav-inner');
    if (!nav) return;
    let actions = nav.querySelector('.nav-actions');
    if (!actions) {
      const download = nav.querySelector('.client-download, .nav-cta');
      actions = document.createElement('div');
      actions.className = 'nav-actions';
      if (download) {
        download.replaceWith(actions);
        actions.appendChild(download);
      } else nav.appendChild(actions);
    }
    navLink = actions.querySelector('.ns-account-link');
    if (!navLink) {
      navLink = document.createElement('a');
      navLink.className = 'client-download ns-account-link';
      navLink.href = new URL('cuenta.html', SITE_ROOT).href;
      navLink.setAttribute('aria-label', 'Registrar / Iniciar sesión');
      navLink.dataset.nsAccountLink = 'true';
      const label = document.createElement('span');
      label.className = 'client-download-label';
      label.textContent = 'Registrar / Iniciar sesión';
      navLink.appendChild(label);
      actions.appendChild(navLink);
    }
  }

  function profileHref(profile) {
    return new URL('perfil.html' + (profile?.username ? '?username=' + encodeURIComponent(profile.username) : ''), SITE_ROOT).href;
  }

  function updateNav(user, profile) {
    currentUser = user || null;
    if (profile) lastProfile = profile;
    ensureNavLink();
    if (!navLink) return;
    navLink.href = user ? profileHref(profile || lastProfile) : new URL('cuenta.html', SITE_ROOT).href;
    navLink.classList.toggle('ns-account-link--profile', Boolean(user));
    navLink.replaceChildren();

    if (!user) {
      const label = document.createElement('span');
      label.className = 'client-download-label';
      label.textContent = 'Registrar / Iniciar sesión';
      navLink.appendChild(label);
      navLink.setAttribute('aria-label', 'Registrar / Iniciar sesión');
      navLink.title = 'Registrar / Iniciar sesión';
      return;
    }

    const fallback = document.createElement('span');
    fallback.className = 'ns-account-avatar-fallback';
    const name = profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'N';
    fallback.textContent = String(name).trim().charAt(0).toUpperCase() || 'N';
    navLink.appendChild(fallback);

    const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
    if (avatarUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = avatarUrl;
      img.onload = () => { if (fallback.isConnected) fallback.remove(); };
      img.onerror = () => img.remove();
      navLink.appendChild(img);
    }
    navLink.setAttribute('aria-label', 'Mi perfil');
    navLink.title = 'Mi perfil';
  }

  async function loadProfileBrief(user) {
    if (!client || !user) return null;
    let result = await client.from('profiles')
      .select('id, username, display_name, avatar_url, banner_url, username_changed_at, created_at, profile_badges(is_mod, is_verified)')
      .eq('id', user.id).maybeSingle();
    if (result.error) {
      result = await client.from('profiles')
        .select('id, username, display_name, avatar_url, banner_url, username_changed_at, created_at')
        .eq('id', user.id).maybeSingle();
    }
    if (result.error) throw result.error;
    return result.data;
  }

  async function refreshNav(user) {
    if (!user) {
      currentUser = null;
      lastProfile = null;
      updateNav(null, null);
      return;
    }
    updateNav(user, lastProfile);
    try {
      const profile = await loadProfileBrief(user);
      if (currentUser?.id === user.id) updateNav(user, profile);
    } catch (_) {}
  }

  async function syncOAuthAvatar(user) {
    if (!client || !user) return null;
    const sources = [user.user_metadata || {}];
    if (Array.isArray(user.identities)) {
      user.identities.forEach(identity => {
        if (identity?.identity_data) sources.push(identity.identity_data);
      });
    }

    const candidates = [];
    sources.forEach(source => {
      candidates.push(
        source.avatar_url,
        source.picture,
        source.profile_image_url,
        source.profile_image,
        source.avatar,
        source.image_url
      );
    });
    const avatarUrl = candidates.find(value =>
      typeof value === 'string' && /^https:\/\//i.test(value)
    );
    if (!avatarUrl) return null;

    const { data: profile, error: readError } = await client.from('profiles')
      .select('id, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (readError || !profile || profile.avatar_url) return null;

    const { data, error } = await client.from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
      .is('avatar_url', null)
      .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at')
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }


  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  }

  function suggestedUsername(email) {
    let candidate = normalizeUsername(String(email || '').split('@')[0]);
    if (candidate.length < 3) candidate = 'usuario_' + Math.random().toString(36).slice(2, 7);
    return candidate.slice(0, 24);
  }

  function friendlyError(error) {
    const raw = String(error?.message || error?.code || error || 'Ocurrió un error inesperado.');
    const lower = [error?.message, error?.code, raw].filter(Boolean).join(' ').toLowerCase();
    if (lower.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
    if (lower.includes('email not confirmed')) return 'Primero debes verificar tu correo electrónico.';
    if (lower.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Prueba iniciar sesión.';
    if (lower.includes('password should be at least')) return 'La contraseña debe tener al menos ocho caracteres.';
    if (lower.includes('rate limit') || lower.includes('too many requests')) return 'Se alcanzó el límite temporal de solicitudes. Espera un momento antes de intentarlo de nuevo.';
    if (lower.includes('manual_linking_disabled') || lower.includes('manual linking is disabled') || lower.includes('manual linking disabled') || lower.includes('identity linking is disabled')) {
      return 'La vinculación de cuentas está desactivada en Supabase. Activa Authentication → Settings → Allow manual linking y vuelve a intentarlo.';
    }
    if (lower.includes('identity_already_exists') || lower.includes('identity_exists') || lower.includes('identity already linked') || lower.includes('identity is already linked')) {
      return 'Esta cuenta externa ya está vinculada a otra cuenta de Negative. Inicia sesión en la cuenta de Negative que la tiene vinculada; los perfiles no se fusionan automáticamente.';
    }
    if (lower.includes('provider is not enabled')) return 'Este proveedor todavía no está habilitado en Supabase. Revisa Authentication → Sign In / Providers y activa Google, Discord o Twitch según corresponda.';
    if (lower.includes('username_cooldown')) return 'Solo puedes cambiar tu nombre de usuario una vez cada 14 días.';
    if (lower.includes('duplicate key') || lower.includes('profiles_username_lower_unique')) return 'Ese nombre de usuario ya está ocupado. Prueba con otro.';
    if (lower.includes('failed to fetch') || lower.includes('function') && lower.includes('not found')) return 'No se pudo contactar con la función de Supabase. Comprueba que esté desplegada.';
    if (lower.includes('row-level security') || lower.includes('permission denied') || (lower.includes('relation') && lower.includes('does not exist'))) {
      return 'Falta actualizar la base de datos o sus políticas. Sigue la guía de Supabase del repositorio.';
    }
    return raw;
  }

  function requireClient() {
    if (client) return true;
    setConfigNotice('El sistema de cuentas necesita estar conectado a Supabase. Revisa la configuración antes de continuar.');
    return false;
  }

  async function withBusy(form, callback, targetOverride) {
    const button = form?.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Procesando…';
    }
    try {
      await callback();
    } catch (error) {
      const target = targetOverride || form?.dataset.messageTarget || (pageType === 'settings' ? 'settingsProfileMessage' : 'authMessage');
      message(target, friendlyError(error), 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Continuar';
        delete button.dataset.originalText;
      }
    }
  }

  function showAuthTab(tab) {
    const isRegister = tab === 'register';
    $('#authTabLogin')?.classList.toggle('is-active', !isRegister);
    $('#authTabRegister')?.classList.toggle('is-active', isRegister);
    $('#authTabLogin')?.setAttribute('aria-selected', String(!isRegister));
    $('#authTabRegister')?.setAttribute('aria-selected', String(isRegister));
    if ($('#authLoginPanel')) $('#authLoginPanel').hidden = isRegister;
    if ($('#authRegisterPanel')) $('#authRegisterPanel').hidden = !isRegister;
    ['authVerifyPanel', 'authRecoveryRequest', 'authRecoveryPassword', 'authAlreadySignedIn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    if ($('#authMainView')) $('#authMainView').hidden = false;
    message('authMessage', '');
  }

  function showAuthOnly(panelId) {
    if ($('#authMainView')) $('#authMainView').hidden = true;
    ['authVerifyPanel', 'authRecoveryRequest', 'authRecoveryPassword', 'authAlreadySignedIn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== panelId;
    });
    message('authMessage', '');
  }

  function isRecoveryFlow() {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    return query.get('flow') === 'recovery' || hash.get('type') === 'recovery';
  }

  function initAuthPage() {
    if (!$('#loginForm')) return;
    try {
      verifyEmail = sessionStorage.getItem('ns_pending_verification_email') || '';
    } catch (_) {}
    if ($('#verifyEmailLabel') && verifyEmail) $('#verifyEmailLabel').textContent = verifyEmail;
    $('#authTabLogin')?.addEventListener('click', () => showAuthTab('login'));
    $('#authTabRegister')?.addEventListener('click', () => showAuthTab('register'));
    $$('[data-open-recovery]').forEach(el => el.addEventListener('click', () => showAuthOnly('authRecoveryRequest')));
    $$('[data-back-to-login]').forEach(el => el.addEventListener('click', () => showAuthTab('login')));
    $('#backToRegisterButton')?.addEventListener('click', () => showAuthTab('register'));

    [
      ['googleLoginButton', 'google'],
      ['discordLoginButton', 'discord'],
      ['twitchLoginButton', 'twitch']
    ].forEach(([buttonId, provider]) => {
      document.getElementById(buttonId)?.addEventListener('click', async () => {
        if (!requireClient()) return;
        const button = document.getElementById(buttonId);
        if (button) {
          button.disabled = true;
          const label = button.querySelector('span');
          button.dataset.originalLabel = label?.textContent || 'Continuar';
          if (label) label.textContent = 'Conectando…';
        }
        try {
          const { error } = await client.auth.signInWithOAuth({
            provider,
            options: { redirectTo: new URL('perfil.html', SITE_ROOT).href }
          });
          if (error) throw error;
        } catch (error) {
          message('authMessage', friendlyError(error), 'error');
          if (button) {
            button.disabled = false;
            const label = button.querySelector('span');
            if (label) label.textContent = button.dataset.originalLabel || 'Continuar';
            delete button.dataset.originalLabel;
          }
        }
      });
    });

    $('#loginForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const identifier = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;
        if (!identifier) throw new Error('Escribe tu correo o nombre de usuario.');
        if (identifier.includes('@')) {
          const { data, error } = await client.auth.signInWithPassword({ email: identifier, password });
          if (error) throw error;
          if (data.user) location.assign(profileHref(null));
          return;
        }
        const { data, error } = await client.functions.invoke('login-by-username', {
          body: { username: normalizeUsername(identifier), password }
        });
        if (error) {
          const detail = error.context?.body?.error || error.message;
          if (/not found|failed to send|fetch/i.test(String(detail))) {
            throw new Error('El inicio con nombre de usuario necesita desplegar login-by-username en Supabase. También puedes entrar con tu correo.');
          }
          throw new Error(detail || 'No se pudo iniciar sesión.');
        }
        if (data?.error) throw new Error(data.error);
        if (!data?.access_token || !data?.refresh_token) throw new Error('El servidor no devolvió una sesión válida.');
        const { data: sessionData, error: sessionError } = await client.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
        if (sessionError) throw sessionError;
        if (sessionData.user) location.assign(profileHref(null));
      });
    });

    $('#registerForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const email = $('#registerEmail').value.trim();
        const displayName = $('#registerDisplayName').value.trim();
        const typedUsername = $('#registerUsername').value.trim();
        const password = $('#registerPassword').value;
        let username = normalizeUsername(typedUsername || suggestedUsername(email));
        if (username.length < 3) username = suggestedUsername(email);
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { username, display_name: displayName },
            emailRedirectTo: new URL('cuenta.html?verified=1', SITE_ROOT).href
          }
        });
        if (error) throw error;
        verifyEmail = email;
        try { sessionStorage.setItem('ns_pending_verification_email', email); } catch (_) {}
        if ($('#verifyEmailLabel')) $('#verifyEmailLabel').textContent = email;
        if (data.session && data.user) {
          location.assign(profileHref(null));
          return;
        }
        showAuthOnly('authVerifyPanel');
        message('authMessage', 'Cuenta creada. Introduce el código de seis dígitos que te enviamos para confirmar el correo.', 'success');
      });
    });

    $('#verifyForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const token = $('#verifyCode').value.trim();
        const email = verifyEmail || $('#registerEmail')?.value.trim() || $('#loginEmail')?.value.trim();
        if (!email) throw new Error('Escribe tu correo electrónico y solicita un código nuevo.');
        const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
        try { sessionStorage.removeItem('ns_pending_verification_email'); } catch (_) {}
        if (data.session) location.assign(profileHref(null));
        else {
          showAuthTab('login');
          message('authMessage', 'El correo quedó verificado. Ya puedes iniciar sesión.', 'success');
        }
      });
    });

    $('#resendCodeButton')?.addEventListener('click', async () => {
      if (!requireClient()) return;
      try {
        const email = verifyEmail || $('#registerEmail')?.value.trim();
        if (!email) throw new Error('Escribe el correo con el que intentaste registrarte.');
        const { error } = await client.auth.resend({
          type: 'signup', email,
          options: { emailRedirectTo: new URL('cuenta.html?verified=1', SITE_ROOT).href }
        });
        if (error) throw error;
        message('authMessage', 'Solicitamos un código nuevo. Revisa tu correo.', 'success');
      } catch (error) { message('authMessage', friendlyError(error), 'error'); }
    });

    $('#recoveryRequestForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const { error } = await client.auth.resetPasswordForEmail($('#recoveryEmail').value.trim(), {
          redirectTo: new URL('cuenta.html?flow=recovery', SITE_ROOT).href
        });
        if (error) throw error;
        message('authMessage', 'Si la dirección corresponde a una cuenta, recibirás un correo con los pasos para recuperar el acceso.', 'success');
      });
    });

    $('#recoveryPasswordForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const password = $('#recoveryNewPassword').value;
        if (password !== $('#recoveryNewPasswordConfirm').value) throw new Error('Las contraseñas no coinciden.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        history.replaceState(null, '', new URL('cuenta.html', SITE_ROOT).href);
        message('authMessage', 'La contraseña se actualizó correctamente. Te llevaremos a tu perfil.', 'success');
        location.assign(profileHref(null));
      });
    });
  }

  async function loadCurrentProfile(user) {
    if (!user || !client) return null;
    let result = await client.from('profiles')
      .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at, profile_badges(is_mod, is_verified)')
      .eq('id', user.id).maybeSingle();
    if (result.error) {
      result = await client.from('profiles')
        .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at')
        .eq('id', user.id).maybeSingle();
    }
    if (result.error) throw result.error;
    if (!result.data) throw new Error('No se encontró tu perfil. El perfil no aparece vinculado a la cuenta autenticada en Supabase.');
    return result.data;
  }

  function setImagePreview(imageId, fallbackId, url, fallbackText) {
    const image = document.getElementById(imageId);
    const fallback = document.getElementById(fallbackId);
    if (fallback) fallback.textContent = (fallbackText || 'N').trim().charAt(0).toUpperCase() || 'N';
    if (image && url) {
      image.src = url;
      image.hidden = false;
      if (fallback) fallback.hidden = true;
    } else {
      if (image) { image.removeAttribute('src'); image.hidden = true; }
      if (fallback) fallback.hidden = false;
    }
  }

  function formatDate(dateValue, options) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX', options || { year: 'numeric', month: 'long' });
  }

  function renderCooldown(profile) {
    const field = $('#profileUsername');
    const note = $('#usernameCooldownNote');
    if (!field || !note) return;
    const changedAt = profile.username_changed_at ? new Date(profile.username_changed_at).getTime() : 0;
    const availableAt = changedAt ? changedAt + USERNAME_COOLDOWN_MS : 0;
    const remaining = availableAt - Date.now();
    field.disabled = remaining > 0;
    if (remaining > 0) {
      note.textContent = 'Podrás volver a cambiarlo el ' + new Date(availableAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) + '. Puedes cambiar el nombre a mostrar mientras tanto.';
    } else {
      note.textContent = 'Disponible para cambiar. Después de guardar un nuevo nombre de usuario, tendrás que esperar 14 días para volver a modificarlo.';
    }
  }

  function drawSettings(user, profile) {
    const workspace = $('#settingsWorkspace');
    const guest = $('#settingsGuest');
    if (workspace) workspace.hidden = !user || !profile;
    if (guest) guest.hidden = Boolean(user && profile);
    if (!user || !profile) return;
    currentUser = user;
    lastProfile = profile;
    updateNav(user, profile);
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
    setValue('profileUsername', profile.username);
    setValue('profileDisplayName', profile.display_name);
    setValue('profileBio', profile.bio);
    setValue('currentEmail', user.email || '');
    if ($('#settingsDisplayNamePreview')) $('#settingsDisplayNamePreview').textContent = profile.display_name || 'Tu nombre';
    if ($('#settingsUsernamePreview')) $('#settingsUsernamePreview').textContent = '@' + (profile.username || 'usuario');
    setImagePreview('settingsAvatarImage', 'settingsAvatarFallback', profile.avatar_url, profile.display_name || profile.username);
    const bannerPreview = $('#settingsBannerPreview');
    if (bannerPreview) {
      bannerPreview.style.backgroundImage = profile.banner_url ? 'url("' + profile.banner_url.replace(/"/g, '%22') + '")' : '';
    }
    const publicLink = $('#viewPublicProfileButton');
    if (publicLink) publicLink.href = profileHref(profile);
    renderCooldown(profile);
  }

  async function initSettingsPage(userFromSession) {
    if (!$('#settingsWorkspace') || !client) return;
    const user = userFromSession || (await client.auth.getSession()).data.session?.user || null;
    if (!user) {
      $('#settingsWorkspace').hidden = true;
      $('#settingsGuest').hidden = false;
      return;
    }
    try {
      drawSettings(user, await loadCurrentProfile(user));
      await refreshIdentityConnections().catch(error => message('connectionsMessage', friendlyError(error), 'error'));
      await refreshMicrosoftConnections();
    } catch (error) {
      if ($('#settingsWorkspace')) $('#settingsWorkspace').hidden = true;
      if ($('#settingsGuest')) $('#settingsGuest').hidden = true;
      message('settingsConfigNotice', 'No se pudo cargar el editor de perfil: ' + friendlyError(error), 'error');
    }
  }

  function uploadExtension(file) {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
  }

  async function uploadProfileImage(file, bucket, maxBytes, column, successText) {
    if (!requireClient()) return;
    if (!currentUser) throw new Error('Inicia sesión para cambiar las imágenes del perfil.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Elige una imagen PNG, JPG o WebP.');
    if (file.size > maxBytes) throw new Error(bucket === 'avatars' ? 'La foto supera el límite de 3 MB.' : 'El banner supera el límite de 6 MB.');
    message('settingsImageMessage', 'Subiendo imagen…');
    const filename = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)) + '.' + uploadExtension(file);
    const path = currentUser.id + '/' + filename;
    const { error: uploadError } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (uploadError) throw uploadError;

    const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
    let profile;
    try {
      const result = await client.from('profiles')
        .update({ [column]: urlData.publicUrl })
        .eq('id', currentUser.id)
        .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at')
        .single();
      if (result.error) throw result.error;
      profile = result.data;
    } catch (error) {
      // Si no se pudo guardar la URL en el perfil, evita dejar el archivo huérfano.
      await client.storage.from(bucket).remove([path]).catch(() => {});
      throw error;
    }

    // El perfil es la fuente de verdad; un fallo al sincronizar metadatos de Auth
    // no debe presentar como fallido un cambio que ya se guardó correctamente.
    if (column === 'avatar_url') {
      await client.auth.updateUser({ data: { avatar_url: urlData.publicUrl } }).catch(() => {});
    }
    drawSettings(currentUser, profile);
    message('settingsImageMessage', successText, 'success');
  }

  function initSettingsTabs() {
    const buttons = $$('[data-settings-tab]');
    const panels = $$('[data-settings-panel]');
    if (!buttons.length || !panels.length) return;
    const activate = name => {
      buttons.forEach(button => {
        const selected = button.dataset.settingsTab === name;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(panel => {
        const selected = panel.dataset.settingsPanel === name;
        panel.hidden = !selected;
        panel.classList.toggle('is-active', selected);
      });
    };
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => activate(button.dataset.settingsTab));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        buttons[next].focus();
        activate(buttons[next].dataset.settingsTab);
      });
    });
    const requested = new URLSearchParams(location.search).get('connections');
    if (requested) activate('connections');
    else activate(buttons.find(button => button.classList.contains('is-active'))?.dataset.settingsTab || 'information');
    if (requested === 'microsoft-linked') message('connectionsMessage', 'Cuenta Microsoft vinculada de forma segura.', 'success');
    else if (requested === 'linked') message('connectionsMessage', 'La cuenta externa se vinculó correctamente.', 'success');
    else if (requested?.startsWith('microsoft-error')) message('connectionsMessage', 'No se pudo vincular Microsoft. Comprueba las credenciales, permisos y URL de retorno en Supabase.', 'error');
  }

  async function loadLinkedIdentities() {
    if (!client) return [];
    if (typeof client.auth.getUserIdentities === 'function') {
      const { data, error } = await client.auth.getUserIdentities();
      if (error) throw error;
      return Array.isArray(data?.identities) ? data.identities : [];
    }

    // Compatibilidad con versiones anteriores del cliente de Supabase.
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return Array.isArray(data.user?.identities) ? data.user.identities : [];
  }

  function identityDisplayLabel(identity) {
    const data = identity?.identity_data || {};
    const label = [
      data.full_name,
      data.name,
      data.global_name,
      data.preferred_username,
      data.user_name,
      data.login,
      identity?.email
    ].find(value => typeof value === 'string' && value.trim());
    return label ? 'Vinculada como ' + label.trim() : 'Vinculada';
  }

  async function refreshIdentityConnections() {
    if (!client || !currentUser) return;
    const identities = await loadLinkedIdentities();
    ['google','discord','twitch'].forEach(provider => {
      const status = document.querySelector('[data-connection-status="' + provider + '"]');
      const button = document.querySelector('[data-link-identity="' + provider + '"]');
      const row = document.querySelector('[data-identity-provider="' + provider + '"]');
      const identity = identities.find(item => item.provider === provider);
      if (status) status.textContent = identity ? identityDisplayLabel(identity) : 'No vinculada';
      if (button) {
        button.textContent = identity ? 'Desvincular' : 'Vincular';
        button.dataset.connectionAction = identity ? 'unlink' : 'link';
        button.disabled = Boolean(identity && identities.length <= 1);
        button.title = identity && identities.length <= 1 ? 'No puedes desvincular tu único método de acceso.' : '';
      }
      if (row) row.classList.toggle('is-connected', Boolean(identity));
    });
  }

  async function refreshMicrosoftConnections() {
    const host = $('#microsoftConnectionSlots');
    if (!host || !client || !currentUser) return;
    const { data, error } = await client.functions.invoke('microsoft-link', { body: { action: 'list', slot: 1 } });
    if (error || data?.error) {
      host.querySelectorAll('.connection-row').forEach(row => {
        const status = row.querySelector('.connection-copy .muted');
        if (status) status.textContent = 'Requiere configurar microsoft-link en Supabase';
      });
      return;
    }
    const accounts = new Map((data.accounts || []).map(account => [Number(account.slot), account]));
    host.querySelectorAll('[data-microsoft-slot]').forEach(button => {
      const slot = Number(button.dataset.microsoftSlot);
      const account = accounts.get(slot);
      const row = button.closest('.connection-row');
      const status = row?.querySelector('.connection-copy .muted');
      if (status) status.textContent = account ? (account.display_name + (account.email ? ' · ' + account.email : '')) : 'No vinculada';
      button.dataset.microsoftAction = account ? 'unlink' : 'start';
      button.textContent = account ? 'Desvincular' : 'Vincular';
      button.title = account ? 'Desvincular esta cuenta Microsoft' : 'Vincular una cuenta Microsoft diferente';
      row?.classList.toggle('is-connected', Boolean(account));
    });
  }

  function initConnectionControls() {
    if (!$('#settingsConnectionsPanel')) return;
    $$('[data-link-identity]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!client || !currentUser) { message('connectionsMessage', 'Inicia sesión para administrar conexiones.', 'error'); return; }
        const provider = button.dataset.linkIdentity;
        const action = button.dataset.connectionAction || 'link';
        button.disabled = true;
        try {
          const linked = await loadLinkedIdentities();
          const identity = linked.find(item => item.provider === provider);
          if (action === 'unlink' && identity) {
            if (linked.length <= 1) throw new Error('No puedes quitar el único método de acceso. Vincula otra cuenta primero.');
            const { error: unlinkError } = await client.auth.unlinkIdentity(identity);
            if (unlinkError) throw unlinkError;
            message('connectionsMessage', 'La cuenta ' + provider + ' se desvinculó.', 'success');
            await refreshIdentityConnections();
          } else {
            const { error: linkError } = await client.auth.linkIdentity({
              provider,
              options: { redirectTo: new URL('configurar-perfil.html?connections=linked', SITE_ROOT).href }
            });
            if (linkError) throw linkError;
          }
        } catch (error) {
          message('connectionsMessage', friendlyError(error), 'error');
          button.disabled = false;
        }
      });
    });

    $$('[data-microsoft-action]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!client || !currentUser) { message('connectionsMessage', 'Inicia sesión para administrar conexiones.', 'error'); return; }
        const slot = Number(button.dataset.microsoftSlot);
        const action = button.dataset.microsoftAction || 'start';
        button.disabled = true;
        try {
          if (action === 'unlink') {
            if (!window.confirm('¿Desvincular la cuenta Microsoft de la posición ' + slot + '?')) return;
          }
          const { data, error } = await client.functions.invoke('microsoft-link', { body: { action, slot } });
          if (error) {
            const detail = error.context?.body?.error || error.message;
            throw new Error(detail || 'No se pudo contactar con microsoft-link.');
          }
          if (data?.error) throw new Error(data.error);
          if (action === 'start') {
            if (!data?.authorization_url) throw new Error('Microsoft no devolvió la dirección de autorización.');
            location.assign(data.authorization_url);
            return;
          }
          await refreshMicrosoftConnections();
          message('connectionsMessage', 'La cuenta Microsoft se desvinculó.', 'success');
        } catch (error) {
          message('connectionsMessage', friendlyError(error), 'error');
        } finally { button.disabled = false; }
      });
    });
    refreshIdentityConnections().catch(error => message('connectionsMessage', friendlyError(error), 'error'));
    refreshMicrosoftConnections();
  }

  function initSettingsEvents() {
    initSettingsTabs();
    initConnectionControls();
    $('#profileForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient() || !currentUser) throw new Error('Inicia sesión para editar tu perfil.');
        const username = normalizeUsername($('#profileUsername').value);
        const displayName = $('#profileDisplayName').value.trim();
        const bio = $('#profileBio').value.trim();
        if (username.length < 3) throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
        if (!displayName || displayName.length > 32) throw new Error('El nombre a mostrar debe tener entre 1 y 32 caracteres.');
        if (bio.length > 180) throw new Error('La biografía no puede superar los 180 caracteres.');
        const existing = await loadCurrentProfile(currentUser);
        if (username !== existing.username && existing.username_changed_at) {
          const availableAt = new Date(existing.username_changed_at).getTime() + USERNAME_COOLDOWN_MS;
          if (Date.now() < availableAt) throw new Error('Solo puedes cambiar tu nombre de usuario cada 14 días. Podrás cambiarlo el ' + new Date(availableAt).toLocaleDateString('es-MX') + '.');
        }
        const { data: profile, error } = await client.from('profiles')
          .update({ username, display_name: displayName, bio })
          .eq('id', currentUser.id)
          .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at')
          .single();
        if (error) throw error;
        const { error: metadataError } = await client.auth.updateUser({ data: { username, display_name: displayName } });
        if (metadataError) throw metadataError;
        drawSettings(currentUser, profile);
        message('settingsProfileMessage', 'Los cambios se guardaron correctamente.', 'success');
      });
    });

    $('#avatarFile')?.addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      try { await uploadProfileImage(file, 'avatars', 3 * 1024 * 1024, 'avatar_url', 'Tu foto de perfil se actualizó.'); }
      catch (error) { message('settingsImageMessage', friendlyError(error), 'error'); }
      finally { event.currentTarget.value = ''; }
    });

    $('#bannerFile')?.addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      try { await uploadProfileImage(file, 'banners', 6 * 1024 * 1024, 'banner_url', 'Tu banner se actualizó.'); }
      catch (error) { message('settingsImageMessage', friendlyError(error), 'error'); }
      finally { event.currentTarget.value = ''; }
    });

    $('#changeEmailForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient() || !currentUser) throw new Error('Inicia sesión para cambiar tu correo.');
        const email = $('#newEmail').value.trim();
        if (!email || email === currentUser.email) throw new Error('Introduce un correo diferente al actual.');
        const { error } = await client.auth.updateUser({ email });
        if (error) throw error;
        message('securityMessage', 'Solicitamos el cambio de correo. Sigue las instrucciones de confirmación que te enviamos.', 'success');
        $('#newEmail').value = '';
      }, 'securityMessage');
    });

    $('#changePasswordForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient() || !currentUser) throw new Error('Inicia sesión para cambiar tu contraseña.');
        const password = $('#changePassword').value;
        if (password !== $('#changePasswordConfirm').value) throw new Error('Las contraseñas no coinciden.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        $('#changePassword').value = '';
        $('#changePasswordConfirm').value = '';
        message('securityMessage', 'Tu contraseña se actualizó correctamente.', 'success');
      }, 'securityMessage');
    });

    $('#signOutButton')?.addEventListener('click', async () => {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) message('securityMessage', friendlyError(error), 'error');
      else location.assign(new URL('cuenta.html', SITE_ROOT).href);
    });

    $('#deleteAccountButton')?.addEventListener('click', async () => {
      if (!requireClient() || !currentUser) return;
      const confirmation = window.prompt('Esta acción es permanente. Escribe ELIMINAR para borrar tu cuenta y tus comentarios.');
      if (confirmation === null) {
        message('deleteAccountMessage', 'Eliminación cancelada. Tu cuenta sigue activa.');
        return;
      }
      if (String(confirmation).trim().toUpperCase() !== 'ELIMINAR') {
        message('deleteAccountMessage', 'Para confirmar, escribe ELIMINAR. No se hicieron cambios.', 'error');
        return;
      }
      const button = $('#deleteAccountButton');
      if (button) { button.disabled = true; button.textContent = 'Eliminando cuenta…'; }
      try {
        const { data, error } = await client.functions.invoke('delete-account', { body: { confirm: true } });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'No se confirmó la eliminación de la cuenta.');
        try { await client.auth.signOut(); } catch (_) {}
        location.assign(new URL('index.html?cuenta-eliminada=1', SITE_ROOT).href);
      } catch (error) {
        message('deleteAccountMessage', friendlyError(error), 'error');
        if (button) { button.disabled = false; button.textContent = 'Eliminar cuenta permanentemente'; }
      }
    });
  }

  function showPublicProfileState(state) {
    ['publicProfileLoading', 'publicProfileGuest', 'publicProfileMissing', 'publicProfileCard'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== state;
    });
  }

  function normalizedBadges(profile) {
    const relation = profile?.profile_badges;
    const badges = Array.isArray(relation) ? (relation[0] || {}) : (relation || {});
    return { is_mod: Boolean(badges.is_mod), is_verified: Boolean(badges.is_verified) };
  }
  function badgeNode(kind) {
    const config = kind === 'mod' ? { file: 'mod.png', label: 'Moderador', tooltip: 'Moderador' } : { file: 'verificado.png', label: 'Verificado', tooltip: 'Este usuario está verificado' };
    const wrapper = document.createElement('span');
    wrapper.className = 'ns-badge ns-badge-tooltip ns-badge--' + kind;
    wrapper.dataset.tooltip = config.tooltip;
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', config.tooltip);
    wrapper.title = config.tooltip;
    const image = document.createElement('img');
    image.className = 'ns-badge-image';
    image.src = new URL('assets/badges/' + config.file, SITE_ROOT).href;
    image.alt = '';
    image.loading = 'lazy';
    image.draggable = false;
    wrapper.appendChild(image);
    return wrapper;
  }
  function badgeListNode(profile, className) {
    const badges = normalizedBadges(profile);
    const list = document.createElement('span');
    list.className = 'ns-badges' + (className ? ' ' + className : '');
    list.setAttribute('aria-label', 'Emblemas del usuario');
    if (badges.is_verified) list.appendChild(badgeNode('verified'));
    if (badges.is_mod) list.appendChild(badgeNode('mod'));
    list.hidden = !list.childElementCount;
    return list;
  }
  function renderNameBadges(container, profile) {
    if (!container) return;
    container.replaceChildren();
    const name = document.createElement('h1');
    name.className = 'public-profile-name'; name.id = 'publicProfileDisplayName';
    name.textContent = profile.display_name || profile.username || 'Usuario';
    container.append(name, badgeListNode(profile));
  }
  function drawPublicProfile(profile, owner, admin) {
    if (!profile) { showPublicProfileState('publicProfileMissing'); return; }
    showPublicProfileState('publicProfileCard');
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || ''; };
    renderNameBadges($('#publicProfileNameLine'), profile);
    setText('publicProfileUsername', '@' + (profile.username || 'usuario'));
    setText('publicProfileBio', profile.bio || '');
    setText('publicProfileJoined', profile.created_at ? 'Se unió en ' + formatDate(profile.created_at, { month: 'long', year: 'numeric' }) : '');
    setImagePreview('publicProfileAvatarImage', 'publicProfileAvatarFallback', profile.avatar_url, profile.display_name || profile.username);
    const banner = $('#publicProfileBanner');
    if (banner) {
      banner.style.backgroundImage = profile.banner_url ? 'url("' + profile.banner_url.replace(/"/g, '%22') + '")' : '';
      banner.classList.toggle('has-banner', Boolean(profile.banner_url));
    }
    const actions = $('#publicProfileOwnerActions');
    if (actions) actions.hidden = !owner;
    const custom = $('#customizeProfileButton');
    if (custom) {
      custom.href = new URL('configurar-perfil.html', SITE_ROOT).href;
      custom.hidden = !owner;
      custom.setAttribute('aria-hidden', String(!owner));
      custom.tabIndex = owner ? 0 : -1;
    }
    renderBadgeAdminControls(profile, Boolean(admin));
    document.title = (profile.display_name || profile.username) + ' (@' + profile.username + ') — NegativeStudios';
  }

  function ensureBadgeDialog() {
    let dialog = $('#profileBadgeDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'profileBadgeDialog';
    dialog.className = 'ns-modal';
    dialog.setAttribute('aria-labelledby', 'profileBadgeDialogTitle');
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function renderBadgeAdminControls(targetProfile, canManage) {
    const actions = $('#publicProfileAdminActions');
    if (!actions) return;
    let profileToManage = targetProfile;
    actions.replaceChildren();
    actions.hidden = !canManage;
    if (!canManage) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn primary public-profile-admin-button';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 2.1 3-.1.8 2.9 2.5 1.7-1.2 2.8.7 2.9-2.8 1.1-1.5 2.6-3-.6-2.6 1.4-2.1-2.2-3 .1-.8-2.9-2.5-1.7 1.2-2.8-.7-2.9 2.8-1.1 1.5-2.6 3 .6z"/><path d="M9 12l2 2 4-4"/></svg>';
    button.setAttribute('aria-label', 'Administrar badges');
    button.title = 'Administrar badges';
    button.addEventListener('click', () => {
      const dialog = ensureBadgeDialog();
      dialog.replaceChildren();
      const panel = document.createElement('section');
      panel.className = 'ns-modal-panel ns-badge-dialog-panel';
      const header = document.createElement('header');
      header.className = 'ns-modal-header';
      const headingWrap = document.createElement('div');
      const eyebrow = document.createElement('span'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Administración';
      const title = document.createElement('h2'); title.id = 'profileBadgeDialogTitle'; title.textContent = 'Gestionar badges';
      const subtitle = document.createElement('p'); subtitle.className = 'muted'; subtitle.textContent = 'Elige qué insignias aparecen junto al nombre de este perfil.';
      headingWrap.append(eyebrow, title, subtitle);
      const close = document.createElement('button'); close.type = 'button'; close.className = 'ns-modal-close';
      close.setAttribute('aria-label', 'Cerrar'); close.textContent = '×'; close.addEventListener('click', () => dialog.close());
      header.append(headingWrap, close);
      const options = document.createElement('div'); options.className = 'ns-badge-admin-options';
      const makeOption = (checked, textValue, badgeType) => {
        const label = document.createElement('label'); label.className = 'ns-badge-admin-option';
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
        const badge = badgeNode(badgeType); badge.classList.add('ns-badge-dialog-preview');
        const text = document.createElement('span'); text.textContent = textValue;
        label.append(input, badge, text); options.appendChild(label); return input;
      };
      const mod = makeOption(normalizedBadges(profileToManage).is_mod, 'Moderador — puede moderar comentarios y publicaciones', 'mod');
      const verified = makeOption(normalizedBadges(profileToManage).is_verified, 'Verificado — muestra la insignia de verificación', 'verified');
      const status = document.createElement('p'); status.className = 'ns-badge-admin-status'; status.hidden = true; status.setAttribute('role', 'status');
      const footer = document.createElement('div'); footer.className = 'ns-modal-footer';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn ghost'; cancel.textContent = 'Cancelar'; cancel.addEventListener('click', () => dialog.close());
      const save = document.createElement('button'); save.type = 'button'; save.className = 'btn primary'; save.textContent = 'Guardar cambios';
      save.addEventListener('click', async () => {
        if (!currentUser || !client) { status.textContent = 'Inicia sesión para gestionar badges.'; status.dataset.kind = 'error'; status.hidden = false; return; }
        save.disabled = true; cancel.disabled = true; save.textContent = 'Guardando…'; status.hidden = true;
        try {
          const result = await client.rpc('set_profile_badges', {
            target_profile_id: profileToManage.id,
            mod_enabled: mod.checked,
            verified_enabled: verified.checked
          });
          if (result.error) throw result.error;
          let fresh = await client.from('profiles')
            .select('id, username, display_name, bio, avatar_url, banner_url, created_at, profile_badges(is_mod, is_verified)')
            .eq('id', profileToManage.id).maybeSingle();
          if (fresh.error) fresh = await client.from('profiles')
            .select('id, username, display_name, bio, avatar_url, banner_url, created_at')
            .eq('id', profileToManage.id).maybeSingle();
          if (fresh.error) throw fresh.error;
          if (fresh.data) { profileToManage = fresh.data; renderNameBadges($('#publicProfileNameLine'), fresh.data); }
          status.textContent = 'Los badges se actualizaron correctamente.';
          status.dataset.kind = 'success'; status.hidden = false;
          save.textContent = 'Guardado';
        } catch (error) {
          status.textContent = friendlyError(error); status.dataset.kind = 'error'; status.hidden = false;
          save.textContent = 'Guardar cambios';
        } finally { save.disabled = false; cancel.disabled = false; }
      });
      footer.append(cancel, save);
      panel.append(header, options, status, footer);
      dialog.appendChild(panel);
      if (!dialog.open) dialog.showModal();
    });
    actions.appendChild(button);
  }

  async function initPublicProfilePage(userFromSession) {
    if (!$('#publicProfileCard') || !client) return;
    showPublicProfileState('publicProfileLoading');
    let user = userFromSession || currentUser;
    if (!user) {
      const { data } = await client.auth.getSession();
      user = data.session?.user || null;
    }
    const requestedUsername = new URLSearchParams(location.search).get('username');
    if (!requestedUsername && !user) {
      showPublicProfileState('publicProfileGuest');
      return;
    }
    let profile = null;
    if (requestedUsername) {
      const username = normalizeUsername(requestedUsername);
      if (!username) { showPublicProfileState('publicProfileMissing'); return; }
      let result = await client.from('profiles')
        .select('id, username, display_name, bio, avatar_url, banner_url, created_at, profile_badges(is_mod, is_verified)')
        .eq('username', username).maybeSingle();
      if (result.error) {
        result = await client.from('profiles')
          .select('id, username, display_name, bio, avatar_url, banner_url, created_at')
          .eq('username', username).maybeSingle();
      }
      if (result.error) throw result.error;
      profile = result.data;
    } else {
      profile = await loadCurrentProfile(user);
    }
    let admin = false;
    if (user && profile) {
      try { const viewer = await loadProfileBrief(user); admin = viewer?.username?.toLowerCase() === 'mrlion303'; } catch (_) {}
    }
    lastProfile = profile || lastProfile;
    drawPublicProfile(profile, Boolean(user && profile && user.id === profile.id), admin);
  }

  function commentProfile(comment) {
    const relation = comment.profiles;
    return Array.isArray(relation) ? (relation[0] || {}) : (relation || {});
  }

  function avatarNode(url, name) {
    const avatar = document.createElement('span');
    avatar.className = 'project-comment-avatar';
    avatar.textContent = (name || 'N').trim().charAt(0).toUpperCase() || 'N';
    if (url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = url;
      img.onerror = () => img.remove();
      avatar.replaceChildren(img);
    }
    return avatar;
  }

  function makeCommentForm(slug, parentId, placeholder, onCancel) {
    const form = document.createElement('form');
    form.className = parentId ? 'project-reply-form' : 'project-comments-form';
    const textarea = document.createElement('textarea');
    textarea.maxLength = 2000;
    textarea.required = true;
    textarea.placeholder = placeholder || 'Comparte tu opinión sobre este proyecto…';
    form.appendChild(textarea);
    const buttons = document.createElement('div');
    buttons.className = parentId ? 'project-reply-buttons' : '';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = parentId ? 'Responder' : 'Publicar comentario';
    buttons.appendChild(submit);
    if (parentId) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancelar';
      cancel.addEventListener('click', onCancel || (() => form.remove()));
      buttons.appendChild(cancel);
    }
    form.appendChild(buttons);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const content = textarea.value.trim();
      if (!content) { textarea.focus(); return; }
      if (!currentUser) { message('projectCommentsMessage', 'Inicia sesión para publicar comentarios y responder.', 'error'); return; }
      if (!client) { message('projectCommentsMessage', 'No se pudo conectar con el sistema de comentarios. Recarga la página e inténtalo de nuevo.', 'error'); return; }
      withBusy(form, async () => {
        const { error } = await client.from('project_comments').insert({
          project_slug: slug,
          user_id: currentUser.id,
          parent_comment_id: parentId,
          content
        });
        if (error) throw error;
        textarea.value = '';
        await loadProjectComments(slug);
      }, 'projectCommentsMessage');
    });
    return form;
  }

  function formatCommentTimestamp(value) {
    if (!value) return 'Fecha desconocida';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha desconocida';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }).format(date);
  }

  function createCommentOverflowMenu(items) {
    if (!items.length) items = [{ label: 'Sin acciones disponibles', disabled: true, action: async () => {} }];
    const wrap = document.createElement('div'); wrap.className = 'community-overflow project-comment-overflow';
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'community-overflow-trigger';
    trigger.textContent = '⋮'; trigger.title = 'Más opciones'; trigger.setAttribute('aria-label', 'Más opciones');
    trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div'); menu.className = 'project-comment-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
    trigger.addEventListener('click', event => {
      event.stopPropagation(); menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden));
    });
    items.forEach(item => {
      const option = document.createElement('button'); option.type = 'button'; option.setAttribute('role', 'menuitem');
      option.textContent = item.label;
      if (item.danger) option.classList.add('is-danger');
      if (item.disabled) option.disabled = true;
      option.addEventListener('click', async event => {
        event.stopPropagation(); menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); await item.action(option);
      });
      menu.appendChild(option);
    });
    wrap.append(trigger, menu);
    if (!commentMenuDismissBound) {
      commentMenuDismissBound = true;
      document.addEventListener('click', event => {
        if (event.target.closest('.project-comment-overflow')) return;
        document.querySelectorAll('.project-comment-menu').forEach(node => {
          node.hidden = true; node.parentElement?.querySelector('.community-overflow-trigger')?.setAttribute('aria-expanded', 'false');
        });
      });
    }
    return wrap;
  }

  function renderCommentNode(comment, children, slug) {
    const profile = commentProfile(comment);
    const article = document.createElement('article');
    article.className = 'project-comment';
    article.dataset.commentId = String(comment.id);
    article.id = 'comment-' + comment.id;
    const header = document.createElement('div');
    header.className = 'project-comment-head';
    header.appendChild(avatarNode(profile.avatar_url, profile.display_name || profile.username));
    const author = document.createElement('div');
    author.className = 'project-comment-author';
    const link = document.createElement('a');
    link.href = profileHref(profile);
    link.textContent = profile.display_name || profile.username || 'Usuario';
    const nameLine = document.createElement('span'); nameLine.className = 'ns-name-badges';
    nameLine.append(link, badgeListNode(profile, 'ns-badges--comment'));
    const handle = document.createElement('small');
    handle.textContent = '@' + (profile.username || 'usuario') + ' · ' + formatCommentTimestamp(comment.created_at);
    author.append(nameLine, handle);
    header.appendChild(author);

    const menuItems = [];
    if (currentUser && currentUser.id === comment.user_id) {
      menuItems.push({
        label: 'Eliminar comentario', danger: true,
        action: async button => {
          if (!window.confirm('¿Eliminar este comentario y sus respuestas?')) return;
          button.disabled = true;
          const result = await client.from('project_comments').delete().eq('id', comment.id).eq('user_id', currentUser.id);
          if (result.error) { message('projectCommentsMessage', friendlyError(result.error), 'error'); button.disabled = false; }
          else await loadProjectComments(slug);
        }
      });
    } else if (currentUser && currentUser.id !== comment.user_id && normalizedBadges(lastProfile).is_mod) {
      menuItems.push({
        label: 'Eliminar como moderador', danger: true,
        action: async button => {
          if (!window.confirm('¿Eliminar este comentario y todas sus respuestas? Esta acción no se puede deshacer.')) return;
          button.disabled = true;
          try {
            const result = await client.rpc('moderator_delete_project_comment', { target_comment_id: comment.id });
            if (result.error) throw result.error;
            await loadProjectComments(slug);
          } catch (error) { message('projectCommentsMessage', friendlyError(error), 'error'); button.disabled = false; }
        }
      });
    }
    if (menuItems.length) header.appendChild(createCommentOverflowMenu(menuItems));
    article.appendChild(header);

    const content = document.createElement('div');
    content.className = 'project-comment-content';
    content.textContent = comment.content;
    article.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'project-comment-actions';
    const likes = Array.isArray(comment.project_comment_likes) ? comment.project_comment_likes : [];
    const liked = Boolean(currentUser && likes.some(item => item.user_id === currentUser.id));
    const like = document.createElement('button');
    like.type = 'button';
    like.className = 'project-comment-action project-comment-like' + (liked ? ' is-liked' : '');
    like.setAttribute('aria-label', liked ? 'Quitar corazón' : 'Dar corazón');
    like.textContent = '♥ ' + likes.length;
    like.addEventListener('click', async () => {
      if (!currentUser) {
        message('projectCommentsMessage', 'Inicia sesión para dar corazones a los comentarios.', 'error');
        return;
      }
      like.disabled = true;
      try {
        if (like.classList.contains('is-liked')) {
          const result = await client.from('project_comment_likes').delete().eq('comment_id', comment.id).eq('user_id', currentUser.id);
          if (result.error) throw result.error;
        } else {
          const result = await client.from('project_comment_likes').insert({ comment_id: comment.id, user_id: currentUser.id });
          if (result.error) throw result.error;
        }
        await loadProjectComments(slug);
      } catch (error) {
        message('projectCommentsMessage', friendlyError(error), 'error');
        like.disabled = false;
      }
    });
    actions.appendChild(like);
    if (currentUser) {
      const reply = document.createElement('button');
      reply.type = 'button';
      reply.className = 'project-comment-action';
      reply.textContent = 'Responder';
      reply.addEventListener('click', () => {
        const existing = article.querySelector(':scope > .project-reply-form');
        if (existing) { existing.remove(); return; }
        const form = makeCommentForm(slug, comment.id, 'Responde a este comentario…');
        actions.insertAdjacentElement('afterend', form);
      });
      actions.appendChild(reply);
    }
    article.appendChild(actions);
    if (children.length) {
      const nested = document.createElement('div');
      nested.className = 'project-comment-children';
      children.forEach(child => nested.appendChild(renderCommentNode(child.row, child.children, slug)));
      article.appendChild(nested);
    }
    return article;
  }

  async function loadProjectComments(slug) {
    if (!client) return;
    const root = document.querySelector('[data-project-comments][data-project-slug="' + slug + '"]');
    if (!root) return;
    const feed = root.querySelector('[data-project-comments-feed]');
    const count = root.querySelector('[data-project-comments-count]');
    if (feed) {
      feed.replaceChildren();
      const loading = document.createElement('p');
      loading.className = 'project-comment-empty';
      loading.textContent = 'Cargando comentarios…';
      feed.appendChild(loading);
    }

    const baseSelect = 'id, project_slug, parent_comment_id, user_id, content, created_at';
    const profileRelation = 'profiles!project_comments_user_id_fkey(username, display_name, avatar_url';
    let response = await client.from('project_comments')
      .select(baseSelect + ', ' + profileRelation + ', profile_badges(is_mod, is_verified)), project_comment_likes(user_id)')
      .eq('project_slug', slug).order('created_at', { ascending: true }).limit(1000);
    if (response.error) {
      response = await client.from('project_comments')
        .select(baseSelect + ', ' + profileRelation + ', profile_badges(is_mod, is_verified))')
        .eq('project_slug', slug).order('created_at', { ascending: true }).limit(1000);
    }
    if (response.error) {
      response = await client.from('project_comments')
        .select(baseSelect + ', profiles!project_comments_user_id_fkey(username, display_name, avatar_url)')
        .eq('project_slug', slug).order('created_at', { ascending: true }).limit(1000);
    }
    const { data, error } = response;
    if (error) {
      if (feed) {
        feed.replaceChildren();
        const errorText = document.createElement('p');
        errorText.className = 'project-comment-empty';
        errorText.textContent = 'No se pudieron cargar los comentarios. Recarga la página o comprueba la configuración de Supabase.';
        feed.appendChild(errorText);
      }
      message('projectCommentsMessage', friendlyError(error), 'error');
      return;
    }
    const rows = data || [];
    if (count) count.textContent = rows.length + (rows.length === 1 ? ' comentario' : ' comentarios');
    const byId = new Map();
    rows.forEach(row => byId.set(row.id, { row, children: [] }));
    const top = [];
    rows.forEach(row => {
      const node = byId.get(row.id);
      const parent = row.parent_comment_id === null ? null : byId.get(row.parent_comment_id);
      if (parent) parent.children.push(node);
      else top.push(node);
    });
    top.reverse();
    const sortChildren = node => {
      node.children.sort((a, b) => new Date(a.row.created_at) - new Date(b.row.created_at));
      node.children.forEach(sortChildren);
    };
    top.forEach(sortChildren);
    if (feed) {
      feed.replaceChildren();
      if (!top.length) {
        const empty = document.createElement('p');
        empty.className = 'project-comment-empty';
        empty.textContent = 'Todavía no hay comentarios. Sé la primera persona en compartir su opinión.';
        feed.appendChild(empty);
      } else {
        top.forEach(node => feed.appendChild(renderCommentNode(node.row, node.children, slug)));
      }
    }
  }

  function initProjectComments() {
    $$('[data-project-comments][data-project-slug]').forEach(root => {
      const slug = root.dataset.projectSlug;
      const compose = root.querySelector('[data-project-comments-compose]');
      if (!compose) return;
      const viewerKey = currentUser?.id || 'guest';
      if (compose.dataset.viewerKey !== viewerKey) {
        compose.dataset.viewerKey = viewerKey;
        compose.replaceChildren();
        if (currentUser) {
          compose.appendChild(makeCommentForm(slug, null, 'Comparte tu opinión sobre este proyecto…'));
        } else {
          const wrap = document.createElement('div');
          wrap.className = 'project-comments-auth';
          const text = document.createElement('p');
          text.textContent = 'Inicia sesión para publicar comentarios y responder a otras personas.';
          const link = document.createElement('a');
          link.className = 'btn primary';
          link.href = new URL('cuenta.html', SITE_ROOT).href;
          link.textContent = 'Registrar / Iniciar sesión';
          wrap.append(text, link);
          compose.appendChild(wrap);
        }
      }
      if (client) loadProjectComments(slug).catch(error => message('projectCommentsMessage', friendlyError(error), 'error'));
    });
  }

  async function initialize() {
    ensureStyles();
    ensureNavLink();
    initProjectComments();
    try { await loadScript(new URL('assets/supabase-config.js', SITE_ROOT).href, 'data-ns-supabase-config'); } catch (_) {}
    const config = window.NS_SUPABASE_CONFIG || {};
    if (config.siteUrl) SITE_ROOT = ensureTrailingSlash(config.siteUrl);
    ensureNavLink();
    if (!config.url || !config.publishableKey) {
      updateNav(null, null);
      const text = 'El sistema de cuentas está preparado, pero falta completar la conexión con Supabase.';
      setConfigNotice(text);
      if (pageType === 'auth') initAuthPage();
      if (pageType === 'settings') $('#settingsGuest') && ($('#settingsGuest').hidden = false);
      if (pageType === 'public-profile') showPublicProfileState('publicProfileGuest');
      return;
    }

    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'data-ns-supabase-sdk');
    if (!window.supabase?.createClient) throw new Error('No se pudo inicializar el cliente de Supabase.');
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.NS_SUPABASE_CLIENT = client;
    initProjectComments();
    try { await loadScript(new URL('assets/community.js?v=20261023c', SITE_ROOT).href, 'data-ns-community-script'); } catch (error) { console.warn('No se pudo cargar el módulo de comunidad.', error); }

    if (pageType === 'auth') initAuthPage();
    if (pageType === 'settings') initSettingsEvents();

    if (!authListenerRegistered) {
      client.auth.onAuthStateChange((event, session) => {
        // INITIAL_SESSION ya se atiende con getSession() debajo. TOKEN_REFRESHED
        // ocurre al renovar la sesión y no debe reiniciar la vista del perfil.
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        window.setTimeout(async () => {
          const user = session?.user || null;
          const previousUserId = currentUser?.id || null;
          const nextUserId = user?.id || null;
          const identityChanged = previousUserId !== nextUserId;

          // Supabase puede notificar el mismo usuario al volver a una pestaña.
          // Actualizamos la navegación, pero no volvemos a mostrar estados de carga.
          if (!identityChanged && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY') return;

          await refreshNav(user);
          if (user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
            try { await syncOAuthAvatar(user); } catch (_) {}
            await refreshNav(user);
          }
          if (identityChanged && pageType === 'settings') await initSettingsPage(user);
          if (identityChanged && pageType === 'public-profile') await initPublicProfilePage(user);
          if (identityChanged) initProjectComments();
          if (pageType === 'auth' && user && event === 'SIGNED_IN' && !isRecoveryFlow() && !$('#authVerifyPanel')?.hidden) {
            location.assign(profileHref(null));
          }
        }, 0);
      });
      authListenerRegistered = true;
    }

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data.session?.user || null;
    await refreshNav(user);
    if (user) {
      try { await syncOAuthAvatar(user); } catch (_) {}
      await refreshNav(user);
    }

    if (pageType === 'auth') {
      if (isRecoveryFlow()) showAuthOnly('authRecoveryPassword');
      else if (user) showAuthOnly('authAlreadySignedIn');
      else if (verifyEmail) {
        if ($('#verifyEmailLabel')) $('#verifyEmailLabel').textContent = verifyEmail;
        showAuthOnly('authVerifyPanel');
      } else if (new URLSearchParams(location.search).get('verified') === '1') {
        showAuthTab('login');
        message('authMessage', 'Tu correo quedó verificado. Ya puedes iniciar sesión.', 'success');
      }
    }
    if (pageType === 'settings') await initSettingsPage(user);
    if (pageType === 'public-profile') await initPublicProfilePage(user);
    initProjectComments();
  }

  ensureStyles();
  ensureNavLink();
  initialize().catch(error => {
    const text = 'No se pudo inicializar el sistema de cuentas: ' + friendlyError(error);
    if (pageType === 'auth') message('authMessage', text, 'error');
    if (pageType === 'settings') {
      if ($('#settingsWorkspace')) $('#settingsWorkspace').hidden = true;
      if ($('#settingsGuest')) $('#settingsGuest').hidden = true;
      message('settingsConfigNotice', text, 'error');
    }
    if (pageType === 'public-profile') {
      showPublicProfileState('publicProfileMissing');
    }
  });
})();
