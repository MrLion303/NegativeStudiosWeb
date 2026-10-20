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
    const href = new URL('assets/account.css?v=20261020h', SITE_ROOT).href;
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
    const { data, error } = await client.from('profiles')
      .select('id, username, display_name, avatar_url, banner_url, username_changed_at, created_at, profile_badges(is_mod, is_verified)')
      .eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
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
    const raw = String(error?.message || error || 'Ocurrió un error inesperado.');
    const lower = raw.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
    if (lower.includes('email not confirmed')) return 'Primero debes verificar tu correo electrónico.';
    if (lower.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Prueba iniciar sesión.';
    if (lower.includes('password should be at least')) return 'La contraseña debe tener al menos ocho caracteres.';
    if (lower.includes('rate limit') || lower.includes('too many requests')) return 'Se alcanzó el límite temporal de solicitudes. Espera un momento antes de intentarlo de nuevo.';
    if (lower.includes('provider is not enabled')) return 'Este proveedor todavía no está habilitado en Supabase. Revisa Authentication → Providers y activa Google, Discord o Twitch según corresponda.';
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
        const { data, error } = await client.auth.signInWithPassword({
          email: $('#loginEmail').value.trim(),
          password: $('#loginPassword').value
        });
        if (error) throw error;
        if (data.user) location.assign(profileHref(null));
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
    const { data, error } = await client.from('profiles')
      .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at, profile_badges(is_mod, is_verified)')
      .eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se encontró tu perfil. Ejecuta el archivo supabase/schema.sql en el SQL Editor de Supabase.');
    return data;
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
    try { drawSettings(user, await loadCurrentProfile(user)); }
    catch (error) { message('settingsProfileMessage', friendlyError(error), 'error'); }
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
    const { data: profile, error } = await client.from('profiles')
      .update({ [column]: urlData.publicUrl })
      .eq('id', currentUser.id)
      .select('id, username, display_name, bio, avatar_url, banner_url, username_changed_at, created_at, updated_at')
      .single();
    if (error) throw error;
    const metadata = column === 'avatar_url' ? { avatar_url: urlData.publicUrl } : {};
    if (Object.keys(metadata).length) {
      const { error: metadataError } = await client.auth.updateUser({ data: metadata });
      if (metadataError) throw metadataError;
    }
    drawSettings(currentUser, profile);
    message('settingsImageMessage', successText, 'success');
  }

  function initSettingsEvents() {
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
      if (confirmation !== 'ELIMINAR') {
        message('deleteAccountMessage', 'No se eliminó la cuenta.', 'success');
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
    const image = document.createElement('img');
    image.className = 'ns-badge ns-badge--' + kind;
    image.src = new URL('assets/badges/' + config.file, SITE_ROOT).href;
    image.alt = config.label; image.title = config.tooltip; image.setAttribute('aria-label', config.tooltip); image.loading = 'lazy';
    return image;
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
    if (custom) custom.href = new URL('configurar-perfil.html', SITE_ROOT).href;
    renderBadgeAdminControls(profile, Boolean(admin));
    document.title = (profile.display_name || profile.username) + ' (@' + profile.username + ') — NegativeStudios';
  }

  function renderBadgeAdminControls(targetProfile, canManage) {
    const actions = $('#publicProfileAdminActions'), host = $('#publicProfileBadgeAdmin');
    if (!actions || !host) return;
    actions.replaceChildren(); host.replaceChildren(); host.hidden = true; actions.hidden = !canManage;
    if (!canManage) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn ghost'; button.textContent = 'Badges';
    button.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div'); panel.className = 'ns-badge-admin-panel';
    const title = document.createElement('strong'); title.textContent = 'Administrar emblemas';
    const hint = document.createElement('p'); hint.textContent = 'Activa o desactiva los emblemas de este perfil.';
    const modLabel = document.createElement('label'); modLabel.className = 'ns-badge-admin-option';
    const mod = document.createElement('input'); mod.type = 'checkbox'; mod.checked = normalizedBadges(targetProfile).is_mod;
    const modText = document.createElement('span'); modText.textContent = 'Moderador — puede eliminar comentarios de otras personas';
    modLabel.append(mod, modText);
    const verLabel = document.createElement('label'); verLabel.className = 'ns-badge-admin-option';
    const ver = document.createElement('input'); ver.type = 'checkbox'; ver.checked = normalizedBadges(targetProfile).is_verified;
    const verText = document.createElement('span'); verText.textContent = 'Verificado'; verLabel.append(ver, verText);
    const status = document.createElement('p'); status.className = 'ns-badge-admin-status'; status.hidden = true;
    const save = document.createElement('button'); save.type = 'button'; save.className = 'btn primary'; save.textContent = 'Guardar badges';
    save.addEventListener('click', async () => {
      if (!currentUser || !client) return;
      save.disabled = true; save.textContent = 'Guardando…'; status.hidden = true;
      try {
        const result = await client.rpc('set_profile_badges', { target_profile_id: targetProfile.id, mod_enabled: mod.checked, verified_enabled: ver.checked });
        if (result.error) throw result.error;
        const fresh = await client.from('profiles').select('id, username, display_name, bio, avatar_url, banner_url, created_at, profile_badges(is_mod, is_verified)').eq('id', targetProfile.id).maybeSingle();
        if (fresh.error) throw fresh.error;
        if (fresh.data) {
          renderNameBadges($('#publicProfileNameLine'), fresh.data);
          renderBadgeAdminControls(fresh.data, true);
          const panelHost = $('#publicProfileBadgeAdmin');
          if (panelHost) panelHost.hidden = false;
          const adminButton = $('#publicProfileAdminActions button');
          if (adminButton) adminButton.setAttribute('aria-expanded', 'true');
          const msg = $('#publicProfileBadgeAdmin .ns-badge-admin-status');
          if (msg) { msg.textContent = 'Los badges se actualizaron correctamente.'; msg.dataset.kind = 'success'; msg.hidden = false; }
        }
      } catch (error) {
        status.textContent = friendlyError(error); status.dataset.kind = 'error'; status.hidden = false;
      } finally { save.disabled = false; save.textContent = 'Guardar badges'; }
    });
    panel.append(title, hint, modLabel, verLabel, save, status);
    button.addEventListener('click', () => { host.hidden = !host.hidden; button.setAttribute('aria-expanded', String(!host.hidden)); });
    actions.appendChild(button); host.appendChild(panel);
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
      const { data, error } = await client.from('profiles')
        .select('id, username, display_name, bio, avatar_url, banner_url, created_at, profile_badges(is_mod, is_verified)')
        .eq('username', username).maybeSingle();
      if (error) throw error;
      profile = data;
    } else {
      profile = await loadCurrentProfile(user);
    }
    let admin = false;
    if (user && profile) {
      try { const viewer = await loadProfileBrief(user); admin = viewer?.username?.toLowerCase() === 'mrlion303'; } catch (_) {}
    }
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

  function renderCommentNode(comment, children, slug) {
    const profile = commentProfile(comment);
    const article = document.createElement('article');
    article.className = 'project-comment';
    article.dataset.commentId = String(comment.id);
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
    if (currentUser && currentUser.id === comment.user_id) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'project-comment-action project-comment-action--delete';
      remove.textContent = 'Eliminar';
      remove.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar este comentario y sus respuestas?')) return;
        const result = await client.from('project_comments').delete().eq('id', comment.id).eq('user_id', currentUser.id);
        if (result.error) message('projectCommentsMessage', friendlyError(result.error), 'error');
        else await loadProjectComments(slug);
      });
      actions.appendChild(remove);
    }
    if (currentUser && currentUser.id !== comment.user_id && normalizedBadges(lastProfile).is_mod) {
      const moderatorDelete = document.createElement('button');
      moderatorDelete.type = 'button'; moderatorDelete.className = 'project-comment-action project-comment-action--delete';
      moderatorDelete.textContent = 'Eliminar como moderador';
      moderatorDelete.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar este comentario y todas sus respuestas? Esta acción no se puede deshacer.')) return;
        moderatorDelete.disabled = true;
        try {
          const result = await client.rpc('moderator_delete_project_comment', { target_comment_id: comment.id });
          if (result.error) throw result.error;
          await loadProjectComments(slug);
        } catch (error) { message('projectCommentsMessage', friendlyError(error), 'error'); moderatorDelete.disabled = false; }
      });
      actions.appendChild(moderatorDelete);
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
    $('[data-project-comments][data-project-slug]').forEach(root => {
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
    try { await loadScript(new URL('assets/community.js?v=20261020c', SITE_ROOT).href, 'data-ns-community-script'); } catch (error) { console.warn('No se pudo cargar el módulo de comunidad.', error); }

    if (pageType === 'auth') initAuthPage();
    if (pageType === 'settings') initSettingsEvents();

    if (!authListenerRegistered) {
      client.auth.onAuthStateChange((event, session) => {
        window.setTimeout(async () => {
          const user = session?.user || null;
          await refreshNav(user);
          if (user) {
            try { await syncOAuthAvatar(user); } catch (_) {}
            await refreshNav(user);
          }
          if (pageType === 'settings') await initSettingsPage(user);
          if (pageType === 'public-profile') await initPublicProfilePage(user);
          initProjectComments();
          if (pageType === 'auth' && user && !isRecoveryFlow() && !$('#authVerifyPanel')?.hidden) {
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
    if (pageType === 'settings') message('settingsProfileMessage', text, 'error');
    if (pageType === 'public-profile') {
      showPublicProfileState('publicProfileMissing');
    }
  });
})();
