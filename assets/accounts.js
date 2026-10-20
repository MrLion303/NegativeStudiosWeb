(function () {
  'use strict';

  const ownScript = document.currentScript;
  const SCRIPT_URL = ownScript && ownScript.src ? ownScript.src : new URL('assets/accounts.js', location.href).href;
  let SITE_ROOT = new URL('../', SCRIPT_URL).href;
  let client = null;
  let currentUser = null;
  let verifyEmail = '';
  let lastProfile = null;
  let authListenerRegistered = false;
  let navLink = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const pageType = document.querySelector('[data-account-page]')?.dataset.accountPage || '';

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
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo cargar un recurso necesario.'));
      document.head.appendChild(script);
    });
  }

  function ensureStyles() {
    const href = new URL('assets/account.css?v=20261019a', SITE_ROOT).href;
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
      el.innerHTML = '';
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
      } else {
        nav.appendChild(actions);
      }
    }

    navLink = actions.querySelector('.ns-account-link');
    if (!navLink) {
      navLink = document.createElement('a');
      navLink.className = 'ns-account-link';
      navLink.href = new URL('cuenta.html', SITE_ROOT).href;
      navLink.textContent = 'Registrar / Iniciar sesión';
      navLink.setAttribute('aria-label', 'Registrar / Iniciar sesión');
      navLink.dataset.nsAccountLink = 'true';
      actions.appendChild(navLink);
    }
  }

  function updateNav(user, profile) {
    currentUser = user || null;
    if (profile) lastProfile = profile;
    ensureNavLink();
    if (!navLink) return;

    navLink.href = user ? new URL('perfil.html', SITE_ROOT).href : new URL('cuenta.html', SITE_ROOT).href;
    navLink.classList.toggle('ns-account-link--profile', Boolean(user));
    navLink.replaceChildren();

    if (!user) {
      navLink.textContent = 'Registrar / Iniciar sesión';
      navLink.setAttribute('aria-label', 'Registrar / Iniciar sesión');
      navLink.title = 'Registrar / Iniciar sesión';
      return;
    }

    const fallback = document.createElement('span');
    fallback.className = 'ns-account-avatar-fallback';
    const name = profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'N';
    fallback.textContent = String(name).trim().charAt(0).toUpperCase() || 'N';
    navLink.appendChild(fallback);

    const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
    if (avatar) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = avatar;
      img.onload = () => { if (fallback.isConnected) fallback.remove(); };
      img.onerror = () => img.remove();
      navLink.appendChild(img);
    }
    navLink.setAttribute('aria-label', 'Mi perfil');
    navLink.title = 'Mi perfil';
  }

  async function loadProfileBrief(user) {
    if (!client || !user) return null;
    try {
      const { data, error } = await client
        .from('profiles')
        .select('username, display_name, avatar_url, is_private')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function refreshNav(user) {
    if (!user) {
      updateNav(null, null);
      return;
    }
    updateNav(user, lastProfile);
    const profile = await loadProfileBrief(user);
    if (currentUser?.id === user.id) updateNav(user, profile);
  }

  function showAuthTab(tab) {
    const isRegister = tab === 'register';
    const loginTab = $('#authTabLogin');
    const registerTab = $('#authTabRegister');
    if (loginTab) {
      loginTab.classList.toggle('is-active', !isRegister);
      loginTab.setAttribute('aria-selected', String(!isRegister));
    }
    if (registerTab) {
      registerTab.classList.toggle('is-active', isRegister);
      registerTab.setAttribute('aria-selected', String(isRegister));
    }
    const loginPanel = $('#authLoginPanel');
    const registerPanel = $('#authRegisterPanel');
    if (loginPanel) loginPanel.hidden = isRegister;
    if (registerPanel) registerPanel.hidden = !isRegister;
    ['authVerifyPanel', 'authRecoveryRequest', 'authRecoveryPassword', 'authAlreadySignedIn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    const mainView = $('#authMainView');
    if (mainView) mainView.hidden = false;
    message('authMessage', '');
  }

  function showAuthOnly(panelId) {
    const mainView = $('#authMainView');
    if (mainView) mainView.hidden = true;
    ['authVerifyPanel', 'authRecoveryRequest', 'authRecoveryPassword', 'authAlreadySignedIn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== panelId;
    });
    message('authMessage', '');
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || 'Ocurrió un error inesperado.');
    const lower = raw.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
    if (lower.includes('email not confirmed')) return 'Primero debes verificar tu correo electrónico.';
    if (lower.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Prueba iniciar sesión.';
    if (lower.includes('password should be at least')) return 'La contraseña debe tener al menos ocho caracteres.';
    if (lower.includes('rate limit') || lower.includes('too many requests')) return 'Se alcanzó el límite temporal de solicitudes. Espera un momento antes de intentarlo de nuevo.';
    if (lower.includes('provider is not enabled')) return 'El inicio de sesión con Google aún no está habilitado en Supabase.';
    if (lower.includes('duplicate key') || lower.includes('profiles_username_lower_unique')) return 'Ese nombre de usuario ya está ocupado. Prueba con otro.';
    if (lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('relation') && lower.includes('does not exist')) {
      return 'Falta configurar la base de datos o sus políticas. Revisa la guía de Supabase del repositorio.';
    }
    return raw;
  }

  function requireClient() {
    if (client) return true;
    setConfigNotice('El sistema de cuentas aún no está conectado a un proyecto de Supabase. La interfaz ya está preparada, pero el registro y el inicio de sesión necesitan completar la configuración.');
    return false;
  }

  async function withBusy(form, callback) {
    const button = form?.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Procesando…';
    }
    try {
      await callback();
    } catch (error) {
      const target = pageType === 'profile' ? 'profileMessage' : 'authMessage';
      message(target, friendlyError(error), 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Continuar';
        delete button.dataset.originalText;
      }
    }
  }

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  }

  function suggestedUsername(email) {
    let candidate = normalizeUsername(String(email || '').split('@')[0]);
    if (candidate.length < 3) candidate = 'usuario_' + Math.random().toString(36).slice(2, 7);
    return candidate.slice(0, 24);
  }

  function isRecoveryFlow() {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    return query.get('flow') === 'recovery' || hash.get('type') === 'recovery';
  }

  function initAuthPage() {
    if (!$('#loginForm')) return;
    const loginTab = $('#authTabLogin');
    const registerTab = $('#authTabRegister');
    loginTab?.addEventListener('click', () => showAuthTab('login'));
    registerTab?.addEventListener('click', () => showAuthTab('register'));
    $$('[data-open-recovery]').forEach(el => el.addEventListener('click', () => showAuthOnly('authRecoveryRequest')));
    $$('[data-back-to-login]').forEach(el => el.addEventListener('click', () => showAuthTab('login')));
    $('#backToRegisterButton')?.addEventListener('click', () => showAuthTab('register'));

    $('#googleLoginButton')?.addEventListener('click', async () => {
      if (!requireClient()) return;
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: new URL('perfil.html', SITE_ROOT).href }
        });
        if (error) throw error;
      } catch (error) {
        message('authMessage', friendlyError(error), 'error');
      }
    });

    $('#loginForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const email = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) location.assign(new URL('perfil.html', SITE_ROOT).href);
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
        const label = $('#verifyEmailLabel');
        if (label) label.textContent = email;
        if (data.session && data.user) {
          location.assign(new URL('perfil.html', SITE_ROOT).href);
          return;
        }
        showAuthOnly('authVerifyPanel');
        message('authMessage', 'Cuenta creada. Introduce el código que te enviamos para confirmar tu correo.', 'success');
      });
    });

    $('#verifyForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const token = $('#verifyCode').value.trim();
        const email = verifyEmail || $('#registerEmail').value.trim() || $('#loginEmail').value.trim();
        if (!email) throw new Error('Escribe tu correo electrónico e intenta solicitar un código nuevo.');
        const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
        if (data.session) location.assign(new URL('perfil.html', SITE_ROOT).href);
        else {
          showAuthTab('login');
          message('authMessage', 'El correo quedó verificado. Ya puedes iniciar sesión.', 'success');
        }
      });
    });

    $('#resendCodeButton')?.addEventListener('click', async () => {
      if (!requireClient()) return;
      try {
        const email = verifyEmail || $('#registerEmail').value.trim();
        if (!email) throw new Error('Escribe el correo con el que intentaste registrarte.');
        const { error } = await client.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: new URL('cuenta.html?verified=1', SITE_ROOT).href }
        });
        if (error) throw error;
        message('authMessage', 'Solicitamos un código nuevo. Revisa tu correo.', 'success');
      } catch (error) {
        message('authMessage', friendlyError(error), 'error');
      }
    });

    $('#recoveryRequestForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const email = $('#recoveryEmail').value.trim();
        const { error } = await client.auth.resetPasswordForEmail(email, {
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
        location.assign(new URL('perfil.html', SITE_ROOT).href);
      });
    });
  }

  async function loadCurrentProfile(user) {
    if (!user || !client) return null;
    const { data, error } = await client.from('profiles')
      .select('id, username, display_name, bio, avatar_url, is_private, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se encontró tu perfil. Ejecuta el archivo supabase/schema.sql del repositorio en el SQL Editor de Supabase.');
    return data;
  }

  function drawProfile(user, profile) {
    const workspace = $('#profileWorkspace');
    const guest = $('#profileGuest');
    if (workspace) workspace.hidden = !user;
    if (guest) guest.hidden = Boolean(user);
    if (!user || !profile) return;

    lastProfile = profile;
    updateNav(user, profile);
    const value = (id, next) => { const el = document.getElementById(id); if (el) el.value = next ?? ''; };
    value('profileUsername', profile.username);
    value('profileDisplayName', profile.display_name);
    value('profileBio', profile.bio);
    value('currentEmail', user.email || '');
    const privateToggle = $('#profilePrivate');
    if (privateToggle) privateToggle.checked = Boolean(profile.is_private);
    const title = $('#profileDisplayNamePreview');
    if (title) title.textContent = profile.display_name || 'Tu nombre';
    const handle = $('#profileUsernamePreview');
    if (handle) handle.textContent = '@' + (profile.username || 'usuario');
    const bio = $('#profileBioPreview');
    if (bio) bio.textContent = profile.bio || 'Tu biografía aparecerá aquí.';
    const fallback = $('#profileAvatarFallback');
    if (fallback) fallback.textContent = (profile.display_name || profile.username || user.email || 'N').trim().charAt(0).toUpperCase() || 'N';
    const avatar = $('#profileAvatarImage');
    if (avatar) {
      if (profile.avatar_url) {
        avatar.src = profile.avatar_url;
        avatar.hidden = false;
        if (fallback) fallback.hidden = true;
      } else {
        avatar.removeAttribute('src');
        avatar.hidden = true;
        if (fallback) fallback.hidden = false;
      }
    }
    const joined = $('#profileMemberSince');
    if (joined) {
      const date = profile.created_at ? new Date(profile.created_at) : null;
      joined.textContent = date && !Number.isNaN(date.getTime()) ? 'Miembro desde ' + date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' }) : '';
    }
  }

  async function initProfilePage() {
    if (!$('#profileWorkspace')) return;
    if (!client) return;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data.session?.user || null;
    if (!user) {
      drawProfile(null, null);
      return;
    }
    try {
      const profile = await loadCurrentProfile(user);
      drawProfile(user, profile);
    } catch (error) {
      message('profileMessage', friendlyError(error), 'error');
    }
  }

  function initProfileEvents() {
    $('#profileForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        if (!currentUser) throw new Error('Tu sesión ya no está activa. Inicia sesión otra vez.');
        const username = normalizeUsername($('#profileUsername').value);
        const displayName = $('#profileDisplayName').value.trim();
        const bio = $('#profileBio').value.trim();
        if (username.length < 3) throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
        if (!displayName || displayName.length > 32) throw new Error('El nombre a mostrar debe tener entre 1 y 32 caracteres.');
        if (bio.length > 180) throw new Error('La biografía no puede superar los 180 caracteres.');

        const changes = {
          id: currentUser.id,
          username,
          display_name: displayName,
          bio,
          is_private: Boolean($('#profilePrivate').checked),
          updated_at: new Date().toISOString()
        };
        const { data, error } = await client.from('profiles').upsert(changes, { onConflict: 'id' })
          .select('id, username, display_name, bio, avatar_url, is_private, created_at, updated_at').single();
        if (error) throw error;

        const { error: metadataError } = await client.auth.updateUser({ data: { username, display_name: displayName } });
        if (metadataError) throw metadataError;
        drawProfile(currentUser, data);
        message('profileMessage', 'Los cambios de tu perfil se guardaron.', 'success');
      });
    });

    $('#avatarFile')?.addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      try {
        if (!requireClient()) return;
        if (!currentUser) throw new Error('Inicia sesión para cambiar tu foto.');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Elige una imagen PNG, JPG o WebP.');
        if (file.size > 3 * 1024 * 1024) throw new Error('La imagen supera el límite de 3 MB.');
        message('avatarMessage', 'Subiendo imagen…');
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const filename = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)) + '.' + extension;
        const path = currentUser.id + '/' + filename;
        const { error: uploadError } = await client.storage.from('avatars').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });
        if (uploadError) throw uploadError;
        const { data } = client.storage.from('avatars').getPublicUrl(path);
        const avatarUrl = data.publicUrl;
        const { data: profile, error } = await client.from('profiles')
          .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
          .eq('id', currentUser.id)
          .select('id, username, display_name, bio, avatar_url, is_private, created_at, updated_at').single();
        if (error) throw error;
        const { error: metadataError } = await client.auth.updateUser({ data: { avatar_url: avatarUrl } });
        if (metadataError) throw metadataError;
        drawProfile(currentUser, profile);
        message('avatarMessage', 'Tu foto de perfil se actualizó.', 'success');
      } catch (error) {
        message('avatarMessage', friendlyError(error), 'error');
      } finally {
        event.currentTarget.value = '';
      }
    });

    $('#changeEmailForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const email = $('#newEmail').value.trim();
        if (!email || email === currentUser?.email) throw new Error('Introduce un correo diferente al actual.');
        const { error } = await client.auth.updateUser({ email });
        if (error) throw error;
        message('securityMessage', 'Solicitamos el cambio de correo. Sigue las instrucciones de confirmación que te enviemos.', 'success');
        $('#newEmail').value = '';
      });
    });

    $('#changePasswordForm')?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(event.currentTarget, async () => {
        if (!requireClient()) return;
        const password = $('#changePassword').value;
        if (password !== $('#changePasswordConfirm').value) throw new Error('Las contraseñas no coinciden.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        $('#changePassword').value = '';
        $('#changePasswordConfirm').value = '';
        message('securityMessage', 'Tu contraseña se actualizó correctamente.', 'success');
      });
    });

    $('#signOutButton')?.addEventListener('click', async () => {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) message('securityMessage', friendlyError(error), 'error');
      else location.assign(new URL('cuenta.html', SITE_ROOT).href);
    });
  }

  async function initialize() {
    ensureStyles();
    ensureNavLink();

    try {
      await loadScript(new URL('assets/supabase-config.js', SITE_ROOT).href, 'data-ns-supabase-config');
    } catch (_) {
      // Se mostrará una advertencia clara si falta la configuración.
    }

    const config = window.NS_SUPABASE_CONFIG || {};
    if (config.siteUrl) SITE_ROOT = ensureTrailingSlash(config.siteUrl);
    ensureNavLink();
    if (!config.url || !config.publishableKey) {
      updateNav(null, null);
      const text = 'El sistema de cuentas está preparado, pero falta conectar Supabase. Completa assets/supabase-config.js y sigue la guía de configuración.';
      if (pageType === 'profile') {
        const guest = $('#profileGuest');
        if (guest) guest.hidden = false;
      }
      setConfigNotice(text);
      if (pageType === 'auth') initAuthPage();
      if (pageType === 'profile') initProfileEvents();
      return;
    }

    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'data-ns-supabase-sdk');
    if (!window.supabase?.createClient) throw new Error('No se pudo inicializar el cliente de Supabase.');
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    if (pageType === 'auth') initAuthPage();
    if (pageType === 'profile') initProfileEvents();

    if (!authListenerRegistered) {
      client.auth.onAuthStateChange((event, session) => {
        window.setTimeout(() => {
          refreshNav(session?.user || null);
          if (pageType === 'profile') initProfilePage().catch(error => message('profileMessage', friendlyError(error), 'error'));
          if (pageType === 'auth' && session?.user && !isRecoveryFlow() && !$('#authVerifyPanel')?.hidden) {
            location.assign(new URL('perfil.html', SITE_ROOT).href);
          }
        }, 0);
      });
      authListenerRegistered = true;
    }

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data.session?.user || null;
    await refreshNav(user);

    if (pageType === 'auth') {
      if (isRecoveryFlow()) {
        showAuthOnly('authRecoveryPassword');
      } else if (user) {
        showAuthOnly('authAlreadySignedIn');
      } else if (new URLSearchParams(location.search).get('verified') === '1') {
        showAuthTab('login');
        message('authMessage', 'Tu correo quedó verificado. Ya puedes iniciar sesión.', 'success');
      }
    }
    if (pageType === 'profile') await initProfilePage();
  }

  ensureStyles();
  ensureNavLink();
  initialize().catch(error => {
    const text = 'No se pudo inicializar el sistema de cuentas: ' + friendlyError(error);
    if (pageType === 'auth') message('authMessage', text, 'error');
    if (pageType === 'profile') message('profileMessage', text, 'error');
  });
})();
