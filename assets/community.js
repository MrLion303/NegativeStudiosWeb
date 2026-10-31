(function () {
  'use strict';

  const ownScript = document.currentScript;
  const SITE_ROOT = window.NS_SUPABASE_CONFIG?.siteUrl ||
    (ownScript?.src ? new URL('../', ownScript.src).href : new URL('./', location.href).href);
  const $ = selector => document.querySelector(selector);
  let client = null;
  let publicClient = null;
  const readClient = () => publicClient || client;
  async function getSessionSafely() {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch (error) {
      const detail = [error?.message, error?.code, error?.name].filter(Boolean).join(' ').toLowerCase();
      if (/invalid refresh token|refresh token not found|refresh_token_not_found|session_not_found|invalid_grant/.test(detail)) {
        try { await client.auth.signOut({ scope: 'local' }); } catch (_) {}
      }
      console.warn('No se pudo recuperar la sesión de la comunidad.', error);
      return null;
    }
  }

  let sessionUser = null;
  let sessionProfile = null;
  let activeProfile = null;
  let profileRequests = [];
  let overflowCloseBound = false;

  function addStyles() {
    if (document.querySelector('link[data-ns-community-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('assets/community.css?v=20261022c', SITE_ROOT).href;
    link.dataset.nsCommunityCss = 'true';
    document.head.appendChild(link);
  }

  function ensureForumNavigation() {
    const nav = $('#navLinks');
    if (!nav) return;
    if (!nav.querySelector('a[data-ns-forum-link]')) {
      const link = document.createElement('a');
      link.href = new URL('foro.html', SITE_ROOT).href;
      link.textContent = 'Foro';
      link.dataset.nsForumLink = 'true';
      if (location.pathname.endsWith('/foro.html')) link.classList.add('active');
      const projects = Array.from(nav.querySelectorAll('a')).find(item => /proyectos\.html(?:$|[?#])/.test(item.href));
      if (projects?.nextSibling) nav.insertBefore(link, projects.nextSibling);
      else nav.appendChild(link);
    }
  }

  function ensureNotificationLink() {
    const nav = $('#navLinks');
    const actions = document.querySelector('.nav-inner .nav-actions');
    if (!nav || !actions || actions.querySelector('a[data-ns-notifications-link]')) return;
    const link = document.createElement('a');
    link.href = new URL('notificaciones.html', SITE_ROOT).href;
    link.className = 'ns-notifications-link';
    link.dataset.nsNotificationsLink = 'true';
    link.setAttribute('aria-label', 'Notificaciones');
    link.title = 'Notificaciones';
    link.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="ns-notifications-label">Notificaciones</span><span class="ns-notification-count" hidden>0</span>';
    if (location.pathname.endsWith('/notificaciones.html')) link.classList.add('active');
    const account = actions.querySelector('a.ns-account-link');
    if (account) actions.insertBefore(link, account);
    else actions.appendChild(link);
  }

  async function updateNotificationCount() {
    const navLink = $('a[data-ns-notifications-link]');
    const links = Array.from(document.querySelectorAll('a[data-ns-notifications-link]'));
    const badges = Array.from(document.querySelectorAll('.ns-notification-count'));
    if (!links.length || !badges.length) return;
    links.forEach(link => { link.hidden = !sessionUser; });
    if (!sessionUser || !client) { badges.forEach(badge => { badge.hidden = true; }); return; }
    try {
      const result = await runWithFreshSessionRetry(() =>
        client.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      );
      if (result.error) throw result.error;
      badges.forEach(badge => {
        badge.textContent = result.count > 99 ? '99+' : String(result.count || 0);
        badge.hidden = !result.count;
      });
    } catch (error) {
      console.warn('No se pudo actualizar el contador de notificaciones.', error);
      badges.forEach(badge => { badge.hidden = true; });
    }
  }

  function avatar(profile, className) {
    const wrap = document.createElement('span');
    wrap.className = className || 'community-avatar';
    const name = profile?.display_name || profile?.username || 'N';
    if (profile?.avatar_url && /^https?:\/\//i.test(profile.avatar_url)) {
      const img = document.createElement('img');
      img.src = profile.avatar_url;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      wrap.appendChild(img);
    } else {
      wrap.textContent = String(name).trim().charAt(0).toUpperCase() || 'N';
    }
    return wrap;
  }

  function badges(profile, className) {
    let relation = profile?.profile_badges;
    if (Array.isArray(relation)) relation = relation[0] || {};
    const node = document.createElement('span');
    node.className = 'ns-badges ' + (className || '');
    node.setAttribute('aria-label', 'Emblemas del usuario');
    const addBadge = (kind, file, label) => {
      const wrapper = document.createElement('span');
      wrapper.className = 'ns-badge ns-badge-tooltip ns-badge--' + kind;
      wrapper.dataset.tooltip = label;
      wrapper.title = label;
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'img');
      wrapper.setAttribute('aria-label', label);
      const img = document.createElement('img');
      img.className = 'ns-badge-image';
      img.src = new URL('assets/badges/' + file, SITE_ROOT).href;
      img.alt = '';
      img.loading = 'lazy';
      img.draggable = false;
      wrapper.appendChild(img);
      node.appendChild(wrapper);
    };
    if (relation?.is_verified) addBadge('verified', 'verificado.png', 'Este usuario está verificado');
    if (relation?.is_mod) addBadge('mod', 'mod.png', 'Moderador');
    node.hidden = !node.childElementCount;
    return node;
  }

  function profileUrl(profile) {
    return new URL('perfil.html?username=' + encodeURIComponent(profile?.username || ''), SITE_ROOT).href;
  }

  function forumPostUrl(postId, commentId) {
    const url = new URL('foro.html', SITE_ROOT);
    url.searchParams.set('post', String(postId));
    if (commentId) {
      url.searchParams.set('comment', String(commentId));
    }
    // Evita el salto nativo del navegador al comentario; la vista debe abrir arriba del post.
    return url.href;
  }

  function showStatus(target, text, kind) {
    if (!target) return;
    target.replaceChildren();
    target.hidden = !text;
    if (!text) return;
    target.className = 'community-status' + (kind ? ' community-status--' + kind : '');
    if (kind) target.dataset.kind = kind; else delete target.dataset.kind;
    target.textContent = text;
    target.setAttribute('role', 'status');
  }

  async function loadProfiles(select, buildQuery) {
    let result = await buildQuery(select);
    if (result.error && select.includes('profile_badges(is_mod, is_verified)')) {
      result = await buildQuery(select.replace(', profile_badges(is_mod, is_verified)', ''));
    }
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function getProfileByUsername(username) {
    let result = await readClient().from('profiles')
      .select('id, username, display_name, avatar_url, created_at, profile_badges(is_mod, is_verified)')
      .eq('username', username).maybeSingle();
    if (result.error) {
      result = await readClient().from('profiles')
        .select('id, username, display_name, avatar_url, created_at')
        .eq('username', username).maybeSingle();
    }
    if (result.error) throw result.error;
    return result.data;
  }

  async function getCurrentProfile(user) {
    if (!user) return null;
    let result = await readClient().from('profiles')
      .select('id, username, display_name, avatar_url, created_at, profile_badges(is_mod, is_verified)')
      .eq('id', user.id).maybeSingle();
    if (result.error) {
      result = await readClient().from('profiles')
        .select('id, username, display_name, avatar_url, created_at')
        .eq('id', user.id).maybeSingle();
    }
    if (result.error) throw result.error;
    return result.data;
  }

  async function getFriendRequests(user) {
    if (!user) return [];
    const result = await client.from('friend_requests')
      .select('id, requester_id, recipient_id, status, created_at')
      .or('requester_id.eq.' + user.id + ',recipient_id.eq.' + user.id)
      .order('created_at', { ascending: false }).limit(200);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function getAcceptedFriendships(profileId) {
    const result = await readClient().from('friend_requests')
      .select('id, requester_id, recipient_id, status, created_at')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + profileId + ',recipient_id.eq.' + profileId)
      .order('created_at', { ascending: false }).limit(1000);
    if (result.error) throw result.error;
    return result.data || [];
  }

  function friendIdsForProfile(profileId, friendships) {
    return Array.from(new Set(friendships.map(row =>
      row.requester_id === profileId ? row.recipient_id : row.requester_id
    ).filter(id => id && id !== profileId)));
  }

  function ensureFriendsDialog() {
    let dialog = $('#profileFriendsDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'profileFriendsDialog';
    dialog.className = 'community-dialog';
    dialog.setAttribute('aria-labelledby', 'profileFriendsDialogTitle');
    const panel = document.createElement('div');
    panel.className = 'community-dialog-panel';
    const header = document.createElement('header');
    header.className = 'community-dialog-header';
    const title = document.createElement('h2');
    title.id = 'profileFriendsDialogTitle';
    title.textContent = 'Amigos';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'community-dialog-close';
    close.textContent = '×'; close.setAttribute('aria-label', 'Cerrar lista de amigos');
    close.addEventListener('click', () => dialog.close());
    const list = document.createElement('div');
    list.id = 'profileFriendsDialogList';
    list.className = 'community-friend-list';
    header.append(title, close);
    panel.append(header, list);
    dialog.appendChild(panel);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
    return dialog;
  }

  function renderFriendListItem(profile) {
    const row = document.createElement('article');
    row.className = 'community-friend-list-item';
    const link = document.createElement('a');
    link.className = 'community-friend-avatar-link';
    link.href = profileUrl(profile);
    link.setAttribute('aria-label', 'Ver perfil de ' + (profile.display_name || profile.username || 'usuario'));
    link.appendChild(avatar(profile, 'community-avatar'));
    const copy = document.createElement('div');
    copy.className = 'community-friend-copy';
    const nameLine = document.createElement('div');
    nameLine.className = 'community-name-line';
    const name = document.createElement('a');
    name.className = 'community-name'; name.href = profileUrl(profile);
    name.textContent = profile.display_name || profile.username || 'Usuario';
    nameLine.append(name, badges(profile, 'community-name-badges'));
    const handle = document.createElement('a');
    handle.className = 'community-handle'; handle.href = profileUrl(profile);
    handle.textContent = '@' + (profile.username || 'usuario');
    copy.append(nameLine, handle);
    row.append(link, copy);
    return row;
  }

  async function openProfileFriends(profile) {
    const dialog = ensureFriendsDialog();
    const list = dialog.querySelector('#profileFriendsDialogList');
    const title = dialog.querySelector('#profileFriendsDialogTitle');
    title.textContent = 'Amigos de ' + (profile.display_name || profile.username || 'este usuario');
    list.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'community-muted';
    loading.textContent = 'Cargando amigos…';
    list.appendChild(loading);
    if (!dialog.open) dialog.showModal();
    try {
      const friendships = await getAcceptedFriendships(profile.id);
      const ids = friendIdsForProfile(profile.id, friendships);
      const count = $('#publicProfileFriendsCountNumber');
      if (count && $('#publicProfileFriendsCount')?.dataset.profileId === profile.id) count.textContent = String(ids.length);
      list.replaceChildren();
      if (!ids.length) {
        const empty = document.createElement('p');
        empty.className = 'community-empty';
        empty.textContent = 'Este perfil todavía no tiene amigos.';
        list.appendChild(empty);
        return;
      }
      const people = await loadProfiles(
        'id, username, display_name, avatar_url, created_at, profile_badges(is_mod, is_verified)',
        fields => readClient().from('profiles').select(fields).in('id', ids)
      );
      const byId = new Map(people.map(person => [person.id, person]));
      ids.forEach(id => { const person = byId.get(id); if (person) list.appendChild(renderFriendListItem(person)); });
      if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'community-empty';
        empty.textContent = 'No se pudieron mostrar los perfiles de esta lista.';
        list.appendChild(empty);
      }
    } catch (error) {
      list.replaceChildren();
      const status = document.createElement('p');
      status.className = 'community-status community-status--error';
      status.textContent = 'No se pudo cargar la lista de amigos. Si acabas de activar esta función, ejecuta el SQL actualizado de Supabase.';
      list.appendChild(status);
    }
  }

  async function renderProfileFriendCount(profile) {
    const button = $('#publicProfileFriendsCount');
    const number = $('#publicProfileFriendsCountNumber');
    if (!button || !number || !profile) return;
    button.dataset.profileId = profile.id;
    button.disabled = false;
    button.onclick = () => openProfileFriends(profile);
    button.title = 'Ver la lista de amigos de este perfil';
    number.textContent = '…';
    try {
      const friendships = await getAcceptedFriendships(profile.id);
      number.textContent = String(friendIdsForProfile(profile.id, friendships).length);
      button.setAttribute('aria-label', 'Ver amigos: ' + number.textContent);
    } catch (_) {
      number.textContent = '—';
      button.title = 'La lista de amigos estará disponible cuando se actualice Supabase';
      button.setAttribute('aria-label', 'Lista de amigos no disponible');
    }
  }

  function relationTo(profile, user, requests) {
    if (!profile) return 'self';
    if (!user) return 'none';
    if (profile.id === user.id) return 'self';
    const match = requests.find(row =>
      row.status === 'accepted' &&
      ((row.requester_id === user.id && row.recipient_id === profile.id) ||
       (row.requester_id === profile.id && row.recipient_id === user.id)));
    if (match) return 'friends';
    const incoming = requests.find(row => row.status === 'pending' && row.requester_id === profile.id && row.recipient_id === user.id);
    if (incoming) return 'incoming';
    const outgoing = requests.find(row => row.status === 'pending' && row.requester_id === user.id && row.recipient_id === profile.id);
    if (outgoing) return 'outgoing';
    return 'none';
  }

  async function performFriendAction(profile, action, requests) {
    if (!sessionUser) {
      location.assign(new URL('cuenta.html', SITE_ROOT).href);
      return;
    }
    if (action === 'accept' || action === 'reject') {
      const request = requests.find(row => row.status === 'pending' &&
        row.requester_id === profile.id && row.recipient_id === sessionUser.id);
      if (!request) throw new Error('La solicitud ya no está disponible.');
      const result = await client.rpc('respond_friend_request', { request_id: request.id, accept_request: action === 'accept' });
      if (result.error) throw result.error;
    } else if (action === 'remove') {
      if (!window.confirm('¿Quieres eliminar a esta persona de tus amistades?')) return;
      const result = await client.rpc('remove_friend', { target_user_id: profile.id });
      if (result.error) throw result.error;
    } else {
      const result = await client.rpc('send_friend_request', { target_user_id: profile.id });
      if (result.error) throw result.error;
    }
    await refreshCommunityProfile();
    if ($('#notificationsFeed')) { await renderFriendInbox(); await loadNotifications(); }
  }

  function friendControls(profile, requests, className) {
    const group = document.createElement('div');
    group.className = className || 'community-friend-actions';
    if (!sessionUser) {
      const login = document.createElement('a');
      login.className = 'community-button';
      login.href = new URL('cuenta.html', SITE_ROOT).href;
      login.textContent = 'Inicia sesión para agregar';
      group.appendChild(login);
      return group;
    }
    const state = relationTo(profile, sessionUser, requests);
    const make = (label, action, variant) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'community-button' + (variant ? ' community-button--' + variant : '');
      if (action === 'send') btn.classList.add('community-button--profile-add');
      else if (action === 'remove') btn.classList.add('community-button--profile-remove');
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { await performFriendAction(profile, action, requests); }
        catch (error) { alert(error?.message || 'No se pudo actualizar la amistad.'); btn.disabled = false; }
      });
      return btn;
    };
    if (state === 'self') return group;
    if (state === 'friends') group.appendChild(make('Eliminar amistad', 'remove', 'quiet'));
    else if (state === 'incoming') {
      group.appendChild(make('Aceptar solicitud', 'accept', 'primary'));
      group.appendChild(make('Rechazar', 'reject', 'quiet'));
    } else if (state === 'outgoing') {
      const pending = document.createElement('button');
      pending.type = 'button'; pending.disabled = true; pending.className = 'community-button community-button--quiet';
      pending.textContent = 'Solicitud enviada'; group.appendChild(pending);
    } else group.appendChild(make('Añadir a amigos', 'send', 'primary'));
    return group;
  }

  function suggestionCard(profile, requests) {
    const card = document.createElement('article');
    card.className = 'community-suggestion';
    card.appendChild(avatar(profile, 'community-avatar'));
    const details = document.createElement('div');
    details.className = 'community-suggestion-copy';
    const nameLine = document.createElement('div');
    nameLine.className = 'community-name-line';
    const name = document.createElement('a');
    name.className = 'community-name';
    name.href = profileUrl(profile);
    name.textContent = profile.display_name || profile.username || 'Usuario';
    nameLine.append(name, badges(profile, 'community-name-badges'));
    const handle = document.createElement('a');
    handle.className = 'community-handle';
    handle.href = profileUrl(profile);
    handle.textContent = '@' + (profile.username || 'usuario');
    details.append(nameLine, handle);
    card.appendChild(details);
    card.appendChild(friendControls(profile, requests, 'community-friend-actions community-friend-actions--small'));
    return card;
  }

  async function renderSuggestions(excludeIds) {
    const host = $('#communitySuggestions');
    if (!host || !client) return;
    host.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Personas que quizá conozcas';
    host.appendChild(heading);
    const status = document.createElement('p');
    status.className = 'community-muted';
    status.textContent = 'Buscando perfiles…';
    host.appendChild(status);
    try {
      const profiles = await loadProfiles(
        'id, username, display_name, avatar_url, created_at, profile_badges(is_mod, is_verified)',
        fields => readClient().from('profiles').select(fields).order('created_at', { ascending: false }).limit(40)
      );
      let requests = [];
      if (sessionUser) { try { requests = await getFriendRequests(sessionUser); } catch (_) {} }
      const excluded = new Set([sessionUser?.id, ...(excludeIds || [])].filter(Boolean));
      const candidates = profiles.filter(p => {
        if (excluded.has(p.id)) return false;
        return relationTo(p, sessionUser, requests) === 'none';
      }).slice(0, 3);
      status.remove();
      if (!candidates.length) {
        const empty = document.createElement('p');
        empty.className = 'community-muted';
        empty.textContent = 'Todavía no hay sugerencias disponibles.';
        host.appendChild(empty);
        return;
      }
      candidates.forEach(profile => host.appendChild(suggestionCard(profile, requests)));
    } catch (error) {
      status.textContent = 'No se pudieron cargar sugerencias. Ejecuta el esquema de comunidad en Supabase.';
    }
  }

  async function renderFriendInbox() {
    const host = $('#friendRequestsInbox');
    if (!host || !client || !sessionUser) { if (host) host.hidden = true; return; }
    host.hidden = false;
    host.replaceChildren();
    const heading = document.createElement('a');
    heading.className = 'community-inbox-notification-button';
    heading.href = new URL('notificaciones.html', SITE_ROOT).href;
    heading.title = 'Abrir notificaciones';
    heading.setAttribute('aria-label', 'Abrir notificaciones');
    heading.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
    host.appendChild(heading);
    try {
      const requests = await getFriendRequests(sessionUser);
      const incoming = requests.filter(row => row.status === 'pending' && row.recipient_id === sessionUser.id).slice(0, 4);
      if (!incoming.length) {
        const empty = document.createElement('p');
        empty.className = 'community-muted';
        empty.textContent = 'No tienes solicitudes pendientes.';
        host.appendChild(empty);
        return;
      }
      const ids = incoming.map(row => row.requester_id);
      const people = await loadProfiles('id, username, display_name, avatar_url, profile_badges(is_mod, is_verified)',
        fields => readClient().from('profiles').select(fields).in('id', ids));
      people.forEach(profile => {
        const row = document.createElement('article');
        row.className = 'community-suggestion';
        row.appendChild(avatar(profile, 'community-avatar'));
        const copy = document.createElement('div'); copy.className = 'community-suggestion-copy';
        const nameLine = document.createElement('div'); nameLine.className = 'community-name-line';
        const link = document.createElement('a'); link.className = 'community-name'; link.href = profileUrl(profile);
        link.textContent = profile.display_name || profile.username || 'Usuario';
        nameLine.append(link, badges(profile, 'community-name-badges'));
        const handle = document.createElement('a'); handle.className = 'community-handle'; handle.href = profileUrl(profile); handle.textContent = '@' + profile.username;
        copy.append(nameLine, handle); row.appendChild(copy);
        row.appendChild(friendControls(profile, requests, 'community-friend-actions community-friend-actions--small'));
        host.appendChild(row);
      });
    } catch (_) {
      const error = document.createElement('p'); error.className = 'community-muted';
      error.textContent = 'No se pudieron cargar las solicitudes.';
      host.appendChild(error);
    }
  }

  function notificationDestination(item, actor) {
    if (item.type === 'friend_request' || item.type === 'friend_request_accepted') {
      if (actor?.username) return profileUrl(actor);
      return new URL('notificaciones.html', SITE_ROOT).href;
    }
    if (item.type === 'post_like' && item.actor_id && item.groupedLikes?.length > 1) {
      const url = new URL('foro.html', SITE_ROOT);
      url.searchParams.set('likedBy', item.actor_id);
      return url.href;
    }
    if (item.post_id) return forumPostUrl(item.post_id, item.forum_post_comment_id);
    if (item.project_slug) return new URL('proyectos/' + encodeURIComponent(item.project_slug) + '/index.html' + (item.comment_id ? '#comment-' + item.comment_id : ''), SITE_ROOT).href;
    return new URL('notificaciones.html', SITE_ROOT).href;
  }

  async function markNotificationRead(id) {
    if (!client || !sessionUser) return;
    const result = await runWithFreshSessionRetry(() =>
      client.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', sessionUser.id)
    );
    if (result.error) throw result.error;
  }

  async function loadNotifications() {
    const host = $('#notificationsFeed');
    if (!host || !client || !sessionUser) {
      if (host) {
        host.replaceChildren();
        const empty = document.createElement('p');
        empty.className = 'community-muted';
        empty.textContent = 'Inicia sesión para consultar tu actividad.';
        host.appendChild(empty);
      }
      return;
    }
    host.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'community-muted'; loading.textContent = 'Cargando actividad…'; host.appendChild(loading);
    const queryNotifications = async select => {
      try {
        return await runWithFreshSessionRetry(() =>
          client.from('notifications').select(select)
            .order('created_at', { ascending: false }).limit(100)
        );
      } catch (error) {
        return { data: null, error };
      }
    };
    let result = await queryNotifications(
      'id,type,title,body,post_id,comment_id,forum_post_comment_id,friend_request_id,project_slug,created_at,read_at,actor_id,profiles!notifications_actor_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified))'
    );
    if (result.error && !isAuthSessionError(result.error)) {
      result = await queryNotifications(
        'id,type,title,body,post_id,comment_id,forum_post_comment_id,friend_request_id,project_slug,created_at,read_at,actor_id,profiles!notifications_actor_id_fkey(username,display_name,avatar_url)'
      );
    }
    if (result.error && !isAuthSessionError(result.error)) {
      result = await queryNotifications(
        'id,type,title,body,post_id,comment_id,forum_post_comment_id,friend_request_id,project_slug,created_at,read_at,actor_id'
      );
    }
    host.replaceChildren();
    if (result.error) {
      const error = document.createElement('p'); error.className = 'community-status community-status--error';
      const detail = [result.error?.message, result.error?.code, result.error?.name].filter(Boolean).join(' ').toLowerCase();
      error.textContent = isAuthSessionError(result.error) || /invalid refresh token|refresh_token_not_found|session_not_found|invalid_grant/.test(detail)
        ? 'Tu sesión dejó de ser válida. Inicia sesión nuevamente para consultar tus notificaciones.'
        : 'No se pudo cargar la actividad. Revisa la conexión o el esquema de Supabase.';
      console.warn('No se pudo cargar la actividad de notificaciones.', result.error);
      host.appendChild(error); return;
    }
    const entries = result.data || [];
    const displayEntries = [];
    const likeGroups = new Map();
    entries.forEach(item => {
      if (item.type !== 'post_like' || !item.actor_id || !item.post_id) {
        displayEntries.push(item);
        return;
      }
      let group = likeGroups.get(item.actor_id);
      if (!group) {
        group = { ...item, groupedLikes: [item] };
        likeGroups.set(item.actor_id, group);
        displayEntries.push(group);
      } else {
        group.groupedLikes.push(item);
      }
    });
    displayEntries.forEach(item => {
      if (item.groupedLikes?.length > 1 && !item.groupedLikes.every(row => row.read_at)) item.read_at = null;
    });
    const unread = entries.filter(item => !item.read_at).length;
    const markAll = $('#markAllNotificationsRead');
    if (markAll) {
      markAll.disabled = unread === 0;
      markAll.textContent = unread ? 'Marcar todo como leído (' + unread + ')' : 'Todo leído';
      markAll.onclick = async () => {
        markAll.disabled = true;
        try {
          const response = await runWithFreshSessionRetry(() =>
            client.from('notifications').update({ read_at: new Date().toISOString() })
              .eq('user_id', sessionUser.id).is('read_at', null)
          );
          if (response.error) throw response.error;
          await loadNotifications();
          await updateNotificationCount();
        } catch (error) {
          markAll.disabled = false;
          showStatus($('#notificationsMessage'), error.message || 'No se pudieron marcar las notificaciones.', 'error');
        }
      };
    }
    if (!entries.length) {
      const empty = document.createElement('p'); empty.className = 'community-empty';
      empty.textContent = 'Todavía no tienes actividad. Aquí aparecerán solicitudes, corazones, respuestas y menciones.';
      host.appendChild(empty); return;
    }
    displayEntries.forEach(item => {
      let actor = item.profiles || {};
      if (Array.isArray(actor)) actor = actor[0] || {};
      const card = document.createElement('article');
      card.className = 'community-notification' + (item.read_at ? '' : ' is-unread');
      const actorLink = document.createElement('a');
      actorLink.className = 'community-notification-avatar';
      actorLink.href = actor.username ? profileUrl(actor) : new URL('notificaciones.html', SITE_ROOT).href;
      actorLink.appendChild(avatar(actor, 'community-avatar'));
      const copy = document.createElement('div'); copy.className = 'community-notification-copy';
      const likeCount = item.groupedLikes?.length > 1
        ? new Set(item.groupedLikes.map(row => String(row.post_id))).size
        : 0;
      const friendNotification = item.type === 'friend_request' || item.type === 'friend_request_accepted';
      const commentNotification = ['post_reply', 'post_comment_reply', 'comment_reply'].includes(item.type);
      const replyLikeNotification = item.type === 'post_comment_like';
      const actorName = actor.display_name || actor.username || 'Alguien';
      const headline = document.createElement('strong');
      if (friendNotification) {
        headline.textContent = item.type === 'friend_request'
          ? actorName + ' te envió solicitud de amistad.'
          : actorName + ' aceptó tu solicitud de amistad.';
      } else if (commentNotification) {
        headline.textContent = item.type === 'post_reply'
          ? actorName + ' comentó en tu publicación.'
          : actorName + ' respondió a tu comentario.';
      } else if (replyLikeNotification) {
        headline.textContent = actorName + ' le dio me gusta a tu respuesta.';
      } else {
        headline.textContent = likeCount > 1 ? 'Le gustaron ' + likeCount + ' publicaciones' : (item.title || 'Nueva actividad');
      }
      const body = document.createElement('p');
      if (likeCount > 1) {
        body.textContent = actorName + ' le dio me gusta a ' + likeCount + ' de tus publicaciones. Pulsa para recorrerlas.';
      } else if (commentNotification) {
        body.textContent = String(item.body || '').trim() || 'El comentario ya no está disponible.';
      } else if (replyLikeNotification) {
        body.textContent = 'Abre la conversación para ver la respuesta que recibió el corazón.';
      } else {
        body.textContent = item.body || actorName + ' interactuó con tu contenido.';
      }
      const meta = document.createElement('small');
      meta.textContent = new Date(item.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      if (friendNotification) copy.append(headline, meta);
      else copy.append(headline, body, meta);
      const open = document.createElement('a'); open.className = 'community-notification-open';
      open.href = notificationDestination(item, actor);
      open.textContent = likeCount > 1 ? 'Ver publicaciones' : friendNotification ? 'Ver perfil' : replyLikeNotification ? 'Ver respuesta' : commentNotification ? 'Ver comentario' : 'Ver';
      open.setAttribute('aria-label', likeCount > 1 ? 'Ver publicaciones a las que dio me gusta' : replyLikeNotification ? 'Ver respuesta que recibió un corazón' : commentNotification ? 'Ver comentario' : friendNotification ? 'Ver perfil del usuario' : 'Ver actividad');
      const activate = async () => {
        const notifications = item.groupedLikes?.length ? item.groupedLikes : [item];
        await Promise.all(notifications.filter(row => !row.read_at).map(row => markNotificationRead(row.id)));
      };
      open.addEventListener('click', async event => {
        event.preventDefault();
        try { await activate(); }
        catch (error) { showStatus($('#notificationsMessage'), error?.message || 'No se pudo marcar la notificación como leída.', 'error'); }
        location.assign(open.href);
      });
      copy.addEventListener('click', async event => {
        if (event.target.closest('a')) return;
        try { await activate(); }
        catch (error) { showStatus($('#notificationsMessage'), error?.message || 'No se pudo marcar la notificación como leída.', 'error'); }
        location.assign(open.href);
      });
      card.append(actorLink, copy, open);
      host.appendChild(card);
    });
    await updateNotificationCount();
  }

  function safePostHtml(raw) {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<div>' + String(raw || '') + '</div>', 'text/html');
    const root = doc.body.firstElementChild || doc.body;
    const allowed = new Set(['B','STRONG','I','EM','U','BR','P','DIV','SPAN','FONT']);
    const walk = parent => {
      Array.from(parent.children).forEach(child => {
        if (!allowed.has(child.tagName)) {
          if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','VIDEO','AUDIO'].includes(child.tagName)) child.remove();
          else {
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            child.remove();
          }
          return;
        }
        if (child.tagName === 'FONT') {
          const size = Number(child.getAttribute('size') || 3);
          const span = doc.createElement('span');
          span.style.fontSize = size <= 2 ? '.85em' : size >= 4 ? '1.3em' : '1em';
          while (child.firstChild) span.appendChild(child.firstChild);
          child.replaceWith(span);
          child = span;
        }
        const size = child.style?.fontSize || '';
        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        if (size === '.85em' || size === '1.3em' || size === '1em') child.style.fontSize = size;
        walk(child);
      });
    };
    walk(root);
    return root.innerHTML;
  }

  function linkifyPostMentions(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('a,button,script,style,textarea')) nodes.push(node);
    }
    const pattern = /(^|\s)@([a-zA-Z0-9_]{3,24})\b/g;
    nodes.forEach(node => {
      const text = node.nodeValue || '';
      pattern.lastIndex = 0;
      if (!pattern.test(text)) return;
      pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let last = 0, match;
      while ((match = pattern.exec(text))) {
        const wholeStart = match.index;
        const mentionStart = wholeStart + match[1].length;
        if (wholeStart > last) fragment.appendChild(document.createTextNode(text.slice(last, wholeStart)));
        if (match[1]) fragment.appendChild(document.createTextNode(match[1]));
        const username = match[2];
        const link = document.createElement('a');
        link.className = 'community-mention-link';
        link.href = new URL('perfil.html?username=' + encodeURIComponent(username), SITE_ROOT).href;
        link.textContent = '@' + username;
        link.title = 'Ver perfil de @' + username;
        fragment.appendChild(link);
        last = mentionStart + username.length;
      }
      if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(fragment);
    });
  }

  function postProfile(post) {
    let profile = post.profiles || {};
    if (Array.isArray(profile)) profile = profile[0] || {};
    return profile;
  }

  function isExpiredJwtError(error) {
    const detail = [error?.message, error?.code, error?.name].filter(Boolean).join(' ').toLowerCase();
    return /jwt expired|token has expired|expired jwt|pgrst303/.test(detail);
  }

  function isAuthSessionError(error) {
    const detail = [error?.message, error?.code, error?.name].filter(Boolean).join(' ').toLowerCase();
    return isExpiredJwtError(error) || Number(error?.status) === 401 ||
      /pgrst301|pgrst302|invalid refresh token|refresh_token_not_found|session_not_found|invalid_grant|unauthorized/.test(detail);
  }

  async function runWithFreshSessionRetry(operation) {
    let result = await operation();
    if (!result?.error || !isExpiredJwtError(result.error)) return result;

    // PostgREST puede recibir el access token vencido aunque autoRefreshToken
    // esté activo. Fuerza la renovación y reintenta la operación una sola vez.
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data?.session) {
      throw refreshed.error || result.error;
    }
    sessionUser = refreshed.data.session.user || sessionUser;
    result = await operation();
    return result;
  }

  function renderHeartButton(table, keyName, post, user, likes) {
    const button = document.createElement('button');
    let liked = Boolean(user && likes.some(row => row.user_id === user.id));
    let count = likes.length;
    button.type = 'button';
    button.className = 'community-heart' + (liked ? ' is-liked' : '');
    button.setAttribute('aria-label', liked ? 'Quitar corazón' : 'Dar corazón');
    button.textContent = '♥ ' + count;
    button.addEventListener('click', async () => {
      if (!sessionUser) {
        location.assign(new URL('cuenta.html', SITE_ROOT).href);
        return;
      }
      button.disabled = true;
      const nextLiked = !liked;
      try {
        const filter = keyName === 'post_id' ? 'post_id' : 'comment_id';
        const operation = () => nextLiked
          ? client.from(table).insert({ [filter]: post.id, user_id: sessionUser.id })
          : client.from(table).delete().eq(filter, post.id).eq('user_id', sessionUser.id);
        const result = await runWithFreshSessionRetry(operation);
        if (result.error) throw result.error;
        liked = nextLiked;
        count = Math.max(0, count + (liked ? 1 : -1));
        button.classList.toggle('is-liked', liked);
        button.setAttribute('aria-label', liked ? 'Quitar corazón' : 'Dar corazón');
        button.textContent = '♥ ' + count;
      } catch (error) {
        const detail = [error?.message, error?.code].filter(Boolean).join(' ').toLowerCase();
        const message = isExpiredJwtError(error) || detail.includes('refresh token')
          ? 'Tu sesión caducó. Inicia sesión de nuevo y vuelve a intentarlo.'
          : (error?.message || 'No se pudo guardar el corazón. Comprueba que hayas actualizado Supabase.');
        alert(message);
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  function createOverflowMenu(items) {
    if (!items.length) items = [{ label: 'Sin acciones disponibles', disabled: true, action: async () => {} }];
    const wrap = document.createElement('div');
    wrap.className = 'community-overflow';
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'community-overflow-trigger';
    trigger.textContent = '⋮'; trigger.title = 'Más opciones';
    trigger.setAttribute('aria-label', 'Más opciones'); trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'community-overflow-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
    });
    items.forEach(item => {
      const option = document.createElement('button');
      option.type = 'button'; option.setAttribute('role', 'menuitem');
      option.textContent = item.label;
      if (item.danger) option.classList.add('is-danger');
      if (item.disabled) option.disabled = true;
      option.addEventListener('click', async event => {
        event.stopPropagation();
        menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
        await item.action(option);
      });
      menu.appendChild(option);
    });
    wrap.append(trigger, menu);
    if (!overflowCloseBound) {
      overflowCloseBound = true;
      document.addEventListener('click', event => {
        if (event.target.closest('.community-overflow')) return;
        document.querySelectorAll('.community-overflow-menu').forEach(node => {
          node.hidden = true;
          node.parentElement?.querySelector('.community-overflow-trigger')?.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.community-overflow-menu').forEach(node => {
          node.hidden = true;
          node.parentElement?.querySelector('.community-overflow-trigger')?.setAttribute('aria-expanded', 'false');
        });
      });
    }
    return wrap;
  }

  function viewerIsModerator() {
    let relation = sessionProfile?.profile_badges;
    if (Array.isArray(relation)) relation = relation[0] || {};
    return Boolean(relation?.is_mod);
  }

  function renderPostCard(post, user, options = {}) {
    const detail = Boolean(options.detail);
    const loadReplies = options.loadReplies !== false;
    const openable = options.openable !== false && !detail;
    const profile = postProfile(post);
    const card = document.createElement('article');
    card.className = 'community-post' + (detail ? ' community-post--detail' : '');
    card.dataset.postId = String(post.id);
    if (openable) {
      card.dataset.openable = 'true';
      card.tabIndex = 0;
      card.setAttribute('aria-label', 'Abrir publicación de ' + (profile.display_name || profile.username || 'usuario'));
      const openPost = () => location.assign(forumPostUrl(post.id));
      card.addEventListener('click', event => {
        if (event.target.closest('a,button,textarea,input,select,[contenteditable="true"],.community-post-actions,.community-post-replies,.community-overflow')) return;
        openPost();
      });
      card.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') &&
          !event.target.closest('a,button,textarea,input,select,[contenteditable="true"],.community-post-actions,.community-post-replies,.community-overflow')) {
          event.preventDefault();
          openPost();
        }
      });
    }
    card.id = 'post-' + post.id;
    const header = document.createElement('header');
    header.className = 'community-post-head';
    header.appendChild(avatar(profile, 'community-avatar community-avatar--post'));
    const who = document.createElement('div'); who.className = 'community-post-who';
    const nameLine = document.createElement('div'); nameLine.className = 'community-name-line';
    const name = document.createElement('a'); name.className = 'community-name'; name.href = profileUrl(profile);
    name.textContent = profile.display_name || profile.username || 'Usuario';
    nameLine.append(name, badges(profile, 'community-name-badges'));
    const meta = document.createElement('div'); meta.className = 'community-post-meta';
    const handle = document.createElement('a'); handle.href = profileUrl(profile); handle.textContent = '@' + (profile.username || 'usuario');
    const dot = document.createTextNode(' · ' + new Date(post.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }));
    meta.append(handle, dot); who.append(nameLine, meta); header.appendChild(who);

    const removePost = async (button, moderator) => {
      if (!window.confirm(moderator ? '¿Eliminar esta publicación como moderador? Esta acción no se puede deshacer.' : '¿Eliminar esta publicación?')) return;
      button.disabled = true;
      try {
        let result;
        if (moderator) result = await client.rpc('moderator_delete_forum_post', { target_post_id: post.id });
        else result = await client.from('forum_posts').delete().eq('id', post.id).eq('user_id', user.id);
        if (result.error) throw result.error;
        if ($('#forumFeed')) await loadForumFeed();
        if ($('#publicProfilePosts') && activeProfile?.id) await loadPostsForProfile(activeProfile.id, $('#publicProfilePosts'));
      } catch (error) {
        alert(error?.message || 'No se pudo eliminar la publicación.');
        button.disabled = false;
      }
    };
    const menuItems = [];
    if (user && user.id === post.user_id) menuItems.push({ label: 'Eliminar publicación', danger: true, action: button => removePost(button, false) });
    else if (user && viewerIsModerator()) menuItems.push({ label: 'Eliminar como moderador', danger: true, action: button => removePost(button, true) });
    if (menuItems.length) header.appendChild(createOverflowMenu(menuItems));
    card.appendChild(header);

    if (post.content_html || post.content_text) {
      const body = document.createElement('div'); body.className = 'community-post-body';
      body.innerHTML = safePostHtml(post.content_html || String(post.content_text || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])));
      linkifyPostMentions(body);
      card.appendChild(body);
    }
    if (post.image_url && /^https?:\/\//i.test(post.image_url)) {
      const img = document.createElement('img'); img.className = 'community-post-image';
      img.src = post.image_url; img.alt = 'Imagen adjunta a la publicación'; img.loading = 'lazy'; card.appendChild(img);
    }
    const actions = document.createElement('div'); actions.className = 'community-post-actions';
    const likes = Array.isArray(post.forum_post_likes) ? post.forum_post_likes : [];
    actions.appendChild(renderHeartButton('forum_post_likes', 'post_id', post, user, likes));
    card.appendChild(actions);

    if (loadReplies) {
      const replies = document.createElement('section');
      replies.className = 'community-post-replies';
      replies.dataset.postReplies = String(post.id);
      card.appendChild(replies);
      loadPostComments(post, replies, user).catch(() => {
        const error = document.createElement('p');
        error.className = 'community-muted';
        error.textContent = 'No se pudieron cargar las respuestas.';
        replies.replaceChildren(error);
      });
    }
    return card;
  }

  async function loadPostComments(post, host, user) {
    if (!host || !client) return;
    host.replaceChildren();
    const heading = document.createElement('button');
    heading.type = 'button';
    heading.className = 'community-post-replies-toggle';
    heading.textContent = 'Respuestas';
    heading.setAttribute('aria-expanded', 'true');
    const list = document.createElement('div');
    list.className = 'community-post-reply-list';
    const formHost = document.createElement('div');
    formHost.className = 'community-post-reply-compose';
    host.append(heading, list, formHost);
    heading.addEventListener('click', () => {
      const expanded = heading.getAttribute('aria-expanded') !== 'true';
      heading.setAttribute('aria-expanded', String(expanded));
      list.hidden = !expanded;
      formHost.hidden = !expanded;
    });

    const renderForm = parentCommentId => {
      formHost.replaceChildren();
      if (!user) {
        const login = document.createElement('a');
        login.className = 'community-post-reply-login';
        login.href = new URL('cuenta.html', SITE_ROOT).href;
        login.textContent = 'Inicia sesión para responder';
        formHost.appendChild(login);
        return;
      }
      const form = document.createElement('form');
      form.className = 'community-post-reply-form';
      const input = document.createElement('textarea');
      input.rows = 2;
      input.maxLength = 2000;
      input.placeholder = parentCommentId ? 'Escribe tu respuesta…' : 'Escribe una respuesta a esta publicación…';
      input.required = true;
      const actions = document.createElement('div');
      actions.className = 'community-post-reply-form-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.className = 'community-button community-button--quiet';
      cancel.textContent = 'Cancelar';
      cancel.hidden = !parentCommentId;
      cancel.addEventListener('click', () => renderForm(null));
      const send = document.createElement('button');
      send.type = 'submit'; send.className = 'community-button community-button--primary'; send.textContent = 'Responder';
      actions.append(cancel, send);
      form.append(input, actions);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const content = input.value.trim();
        if (!content) return;
        send.disabled = true; send.textContent = 'Enviando…';
        try {
          const result = await client.from('forum_post_comments').insert({
            post_id: post.id, parent_comment_id: parentCommentId, user_id: user.id, content
          });
          if (result.error) throw result.error;
          renderForm(null);
          await loadPostComments(post, host, user);
        } catch (error) {
          const status = document.createElement('p');
          status.className = 'community-status community-status--error';
          status.textContent = error?.message || 'No se pudo enviar la respuesta. Actualiza el esquema de Supabase.';
          form.appendChild(status);
          send.disabled = false; send.textContent = 'Responder';
        }
      });
      formHost.appendChild(form);
    };
    renderForm(null);

    const result = await readClient().from('forum_post_comments')
      .select('id,post_id,parent_comment_id,user_id,content,created_at,profiles!forum_post_comments_user_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified)),forum_post_comment_likes(user_id)')
      .eq('post_id', post.id).order('created_at', { ascending: true }).limit(300);
    if (result.error) {
      list.replaceChildren();
      const info = document.createElement('p');
      info.className = 'community-muted';
      info.textContent = 'Las respuestas estarán disponibles cuando ejecutes el esquema actualizado de Supabase.';
      list.appendChild(info);
      return;
    }
    const rows = result.data || [];
    heading.textContent = 'Respuestas · ' + rows.length;
    if (!rows.length) {
      const empty = document.createElement('p'); empty.className = 'community-muted';
      empty.textContent = 'Todavía no hay respuestas. Inicia la conversación.';
      list.appendChild(empty);
      return;
    }
    const byId = new Map();
    rows.forEach(row => byId.set(row.id, { row, children: [] }));
    const roots = [];
    rows.forEach(row => {
      const node = byId.get(row.id);
      const parent = row.parent_comment_id ? byId.get(row.parent_comment_id) : null;
      if (parent) parent.children.push(node); else roots.push(node);
    });
    const params = new URLSearchParams(location.search);
    const focusedCommentId = params.get('comment');
    if (focusedCommentId && params.get('post') === String(post.id)) {
      let focusNode = byId.get(Number(focusedCommentId));
      const focusPath = [];
      while (focusNode) {
        focusPath.unshift(focusNode);
        focusNode = focusNode.row.parent_comment_id ? byId.get(focusNode.row.parent_comment_id) : null;
      }
      if (focusPath.length) {
        const focusRoot = focusPath[0];
        roots.sort((a, b) => a === focusRoot ? -1 : b === focusRoot ? 1 : 0);
        focusPath.forEach((node, index) => {
          const next = focusPath[index + 1];
          if (next) node.children.sort((a, b) => a === next ? -1 : b === next ? 1 : 0);
        });
      }
    }
    const renderOne = (node, depth) => {
      const row = node.row;
      const profile = row.profiles || {};
      const item = document.createElement('article');
      item.className = 'community-post-reply' + (depth ? ' community-post-reply--nested' : '');
      item.id = 'post-comment-' + row.id;
      item.appendChild(avatar(profile, 'community-avatar community-avatar--reply'));
      const body = document.createElement('div'); body.className = 'community-post-reply-body';
      const head = document.createElement('div'); head.className = 'community-post-reply-head';
      const nameLine = document.createElement('div'); nameLine.className = 'community-name-line';
      const name = document.createElement('a'); name.className = 'community-name'; name.href = profileUrl(profile);
      name.textContent = profile.display_name || profile.username || 'Usuario';
      nameLine.append(name, badges(profile, 'community-name-badges'));
      const meta = document.createElement('small'); meta.className = 'community-post-reply-meta';
      meta.textContent = '@' + (profile.username || 'usuario') + ' · ' + new Date(row.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      head.append(nameLine, meta);
      const ownsReply = Boolean(user && user.id === row.user_id);
      const canModerateReply = Boolean(user && !ownsReply && viewerIsModerator());
      const replyMenuItems = (ownsReply || canModerateReply) ? [{
        label: canModerateReply ? 'Eliminar respuesta como moderador' : 'Eliminar respuesta',
        danger: true,
        action: async button => {
          if (!window.confirm(canModerateReply
            ? '¿Eliminar esta respuesta como moderador? Esta acción no se puede deshacer.'
            : '¿Eliminar esta respuesta?')) return;
          button.disabled = true;
          try {
            const deleted = canModerateReply
              ? await client.rpc('moderator_delete_forum_comment', { target_comment_id: row.id })
              : await client.from('forum_post_comments').delete().eq('id', row.id).eq('user_id', user.id);
            if (deleted.error) throw deleted.error;
            await loadPostComments(post, host, user);
          } catch (error) {
            alert(error?.message || 'No se pudo eliminar la respuesta.');
            button.disabled = false;
          }
        }
      }] : [{ label: 'No tienes acciones disponibles', disabled: true, action: async () => {} }];
      head.appendChild(createOverflowMenu(replyMenuItems));
      const textNode = document.createElement('p'); textNode.className = 'community-post-reply-text'; textNode.textContent = row.content;
      body.append(head, textNode);
      const replyLikes = Array.isArray(row.forum_post_comment_likes) ? row.forum_post_comment_likes : [];
      body.appendChild(renderHeartButton('forum_post_comment_likes', 'comment_id', row, user, replyLikes));
      if (user) {
        const reply = document.createElement('button'); reply.type = 'button';
        reply.className = 'community-post-reply-button'; reply.textContent = 'Responder';
        reply.addEventListener('click', () => { renderForm(row.id); inputFocus(); });
        body.appendChild(reply);
      }
      const children = document.createElement('div'); children.className = 'community-post-reply-children';
      node.children.forEach(child => children.appendChild(renderOne(child, depth + 1)));
      body.appendChild(children);
      item.appendChild(body);
      return item;
    };
    function inputFocus() { formHost.querySelector('textarea')?.focus(); }
    roots.forEach(node => list.appendChild(renderOne(node, 0)));
    if (focusedCommentId && params.get('post') === String(post.id)) {
      const focusedReply = document.getElementById('post-comment-' + focusedCommentId);
      focusedReply?.classList.add('is-notification-focus');
    }
  }

  async function loadPostsForProfile(profileId, target) {
    if (!target || !client) return;
    target.replaceChildren();
    const loading = document.createElement('p'); loading.className = 'community-muted'; loading.textContent = 'Cargando publicaciones…';
    target.appendChild(loading);
    let result = await readClient().from('forum_posts')
      .select('id,user_id,content_html,content_text,image_url,created_at,profiles!forum_posts_user_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified)),forum_post_likes(user_id)')
      .eq('user_id', profileId).order('created_at', { ascending: false }).limit(30);
    if (result.error) {
      result = await readClient().from('forum_posts')
        .select('id,user_id,content_html,content_text,image_url,created_at,profiles!forum_posts_user_id_fkey(username,display_name,avatar_url),forum_post_likes(user_id)')
        .eq('user_id', profileId).order('created_at', { ascending: false }).limit(30);
    }
    if (result.error) {
      target.replaceChildren();
      const status = document.createElement('p'); status.className = 'community-muted';
      status.textContent = 'Las publicaciones estarán disponibles cuando actives el esquema de comunidad en Supabase.';
      target.appendChild(status);
      return;
    }
    target.replaceChildren();
    if (!result.data?.length) {
      const empty = document.createElement('p'); empty.className = 'community-muted'; empty.textContent = 'Todavía no hay publicaciones.';
      target.appendChild(empty); return;
    }
    result.data.forEach(post => target.appendChild(renderPostCard(post, sessionUser)));
  }

  async function refreshCommunityProfile() {
    if (!client) return;
    const session = await getSessionSafely();
    sessionUser = session?.user || null;
    sessionProfile = sessionUser ? await getCurrentProfile(sessionUser).catch(() => null) : null;
    if ($('#publicProfileCard')) {
      const param = new URLSearchParams(location.search).get('username');
      activeProfile = param ? await getProfileByUsername(param) : await getCurrentProfile(sessionUser);
      if (activeProfile) await renderProfileFriendCount(activeProfile);
      const friendHost = $('#publicProfileFriendAction');
      if (friendHost) {
        friendHost.replaceChildren();
        friendHost.hidden = !activeProfile || !sessionUser || activeProfile.id === sessionUser.id;
        if (activeProfile && activeProfile.id !== sessionUser?.id) {
          if (sessionUser) { try { profileRequests = await getFriendRequests(sessionUser); } catch (_) { profileRequests = []; } }
          friendHost.hidden = false;
          friendHost.appendChild(friendControls(activeProfile, profileRequests, 'community-friend-actions'));
        }
      }
      const postsHost = $('#publicProfilePosts');
      if (activeProfile && postsHost) await loadPostsForProfile(activeProfile.id, postsHost);
      if ($('#publicProfileCommunityRail')) $('#publicProfileCommunityRail').hidden = false;
      await renderSuggestions([activeProfile?.id]);
    }
    if ($('#forumComposer')) {
      mountForumComposer(sessionUser);
      await loadForumFeed();
      await renderSuggestions([]);
    }
  }

  function makeToolbarButton(label, title, action) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'community-tool'; button.textContent = label; button.title = title;
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', action);
    return button;
  }

  function mountForumComposer(user) {
    const host = $('#forumComposer');
    if (!host) return;
    host.replaceChildren();
    if (!user) {
      const panel = document.createElement('div'); panel.className = 'community-compose-login';
      const text = document.createElement('p'); text.textContent = 'Inicia sesión para publicar en el foro.';
      const link = document.createElement('a'); link.className = 'community-button community-button--primary';
      link.href = new URL('cuenta.html', SITE_ROOT).href; link.textContent = 'Iniciar sesión';
      panel.append(text, link); host.appendChild(panel); return;
    }

    const form = document.createElement('form'); form.className = 'community-composer';
    const layout = document.createElement('div'); layout.className = 'community-composer-layout';
    layout.appendChild(avatar(sessionProfile, 'community-avatar community-avatar--composer'));
    const main = document.createElement('div'); main.className = 'community-composer-main';
    const editor = document.createElement('div'); editor.className = 'community-editor'; editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true'); editor.dataset.placeholder = '¿Qué está pasando?';
    editor.setAttribute('aria-label', 'Escribe una publicación');
    editor.addEventListener('paste', event => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    });

    const toolbar = document.createElement('div'); toolbar.className = 'community-toolbar'; toolbar.setAttribute('aria-label', 'Formato del texto');
    const bold = makeToolbarButton('B', 'Negrita', () => { editor.focus(); document.execCommand('bold'); }); bold.dataset.tool = 'bold';
    const italic = makeToolbarButton('I', 'Cursiva', () => { editor.focus(); document.execCommand('italic'); }); italic.dataset.tool = 'italic';
    const larger = makeToolbarButton('A+', 'Texto más grande', () => { editor.focus(); document.execCommand('fontSize', false, '5'); });
    const smaller = makeToolbarButton('A−', 'Texto más pequeño', () => { editor.focus(); document.execCommand('fontSize', false, '2'); });
    toolbar.append(bold, italic, larger, smaller);

    const mentionSuggestions = document.createElement('div');
    mentionSuggestions.className = 'community-mention-suggestions';
    mentionSuggestions.hidden = true;
    mentionSuggestions.setAttribute('role', 'listbox');
    let mentionQueryVersion = 0;
    const hideMentions = () => { mentionSuggestions.replaceChildren(); mentionSuggestions.hidden = true; };
    const updateMentions = async () => {
      const version = ++mentionQueryVersion;
      const match = editor.innerText.trimEnd().match(/(?:^|\s)@([a-zA-Z0-9_]{0,24})$/);
      if (!match) { hideMentions(); return; }
      const query = (match[1] || '').toLowerCase();
      let people = [];
      try {
        people = await loadProfiles(
          'id,username,display_name,avatar_url,profile_badges(is_mod, is_verified)',
          fields => {
            let request = readClient().from('profiles').select(fields).neq('id', user.id).limit(6);
            if (query) request = request.ilike('username', query + '%');
            return request;
          }
        );
      } catch (_) { hideMentions(); return; }
      if (version !== mentionQueryVersion) return;
      mentionSuggestions.replaceChildren();
      if (!people.length) { hideMentions(); return; }
      people.forEach(person => {
        const option = document.createElement('button');
        option.type = 'button'; option.className = 'community-mention-option'; option.setAttribute('role', 'option');
        option.addEventListener('mousedown', event => event.preventDefault());
        option.appendChild(avatar(person, 'community-avatar'));
        const copy = document.createElement('span'); copy.className = 'community-mention-option-copy';
        const name = document.createElement('strong'); name.textContent = person.display_name || person.username;
        const handle = document.createElement('small'); handle.textContent = '@' + person.username;
        copy.append(name, handle); option.appendChild(copy);
        option.addEventListener('click', () => {
          editor.focus();
          document.execCommand('insertText', false, '@' + person.username + ' ');
          hideMentions();
          updateComposerCounter();
        });
        mentionSuggestions.appendChild(option);
      });
      mentionSuggestions.hidden = false;
    };
    const imageInput = document.createElement('input');
    imageInput.type = 'file'; imageInput.accept = 'image/png,image/jpeg,image/webp'; imageInput.hidden = true;
    const imageButton = makeToolbarButton('＋ Imagen', 'Adjuntar una imagen', () => imageInput.click());
    toolbar.appendChild(imageButton);
    const imagePreview = document.createElement('div'); imagePreview.className = 'community-image-preview'; imagePreview.hidden = true;
    let selectedImage = null;
    imageInput.addEventListener('change', () => {
      selectedImage = imageInput.files?.[0] || null;
      imagePreview.replaceChildren(); imagePreview.hidden = !selectedImage;
      if (selectedImage) {
        if (selectedImage.size > 5 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(selectedImage.type)) {
          selectedImage = null; imageInput.value = ''; imagePreview.hidden = true;
          showStatus(status, 'Usa una imagen PNG, JPG o WebP de máximo 5 MB.', 'error'); return;
        }
        const img = document.createElement('img'); img.src = URL.createObjectURL(selectedImage); img.alt = 'Vista previa de la imagen';
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'community-button community-button--quiet'; remove.textContent = 'Quitar imagen';
        remove.addEventListener('click', () => { selectedImage = null; imageInput.value = ''; imagePreview.replaceChildren(); imagePreview.hidden = true; });
        imagePreview.append(img, remove);
      }
    });

    const status = document.createElement('div'); status.className = 'community-status'; status.hidden = true;
    const footer = document.createElement('div'); footer.className = 'community-compose-bottom';
    const counter = document.createElement('span'); counter.className = 'community-muted'; counter.textContent = '0 / 5000';
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'community-button community-button--primary'; submit.textContent = 'Publicar';
    const footerGroup = document.createElement('div'); footerGroup.className = 'community-composer-footer'; footerGroup.appendChild(submit);
    footer.append(toolbar, counter, footerGroup);
    function updateComposerCounter() {
      counter.textContent = Math.min(editor.innerText.length, 5000) + ' / 5000';
      updateMentions();
    }
    editor.addEventListener('input', updateComposerCounter);
    main.append(editor, mentionSuggestions, imageInput, imagePreview, status);
    layout.appendChild(main);
    form.append(layout, footer);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const contentText = editor.innerText.trim();
      const contentHtml = safePostHtml(editor.innerHTML);
      if (!contentText && !selectedImage) { showStatus(status, 'Escribe algo o adjunta una imagen antes de publicar.', 'error'); editor.focus(); return; }
      if (contentText.length > 5000 || contentHtml.length > 15000) { showStatus(status, 'La publicación supera el límite permitido.', 'error'); return; }
      submit.disabled = true; submit.textContent = 'Publicando…'; showStatus(status, '', '');
      let uploadedPath = null;
      let createdPostId = null;
      try {
        let imageUrl = null;
        if (selectedImage) {
          const ext = selectedImage.type === 'image/png' ? 'png' : selectedImage.type === 'image/webp' ? 'webp' : 'jpg';
          uploadedPath = user.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)) + '.' + ext;
          const upload = await client.storage.from('post-images').upload(uploadedPath, selectedImage, { contentType: selectedImage.type, upsert: false });
          if (upload.error) throw upload.error;
          imageUrl = client.storage.from('post-images').getPublicUrl(uploadedPath).data.publicUrl;
        }
        const result = await client.from('forum_posts').insert({
          user_id: user.id, content_html: contentHtml, content_text: contentText, image_url: imageUrl
        }).select('id').single();
        if (result.error) throw result.error;
        createdPostId = result.data?.id;
        const matches = Array.from(contentText.matchAll(/(?:^|\s)@([a-zA-Z0-9_]{3,24})/g)).map(item => item[1].toLowerCase());
        const usernames = Array.from(new Set(matches));
        if (createdPostId && usernames.length) {
          try {
            const mentioned = await readClient().from('profiles').select('id,username').in('username', usernames);
            if (!mentioned.error && mentioned.data?.length) {
              const rows = mentioned.data.filter(person => person.id !== user.id).map(person => ({ post_id: createdPostId, mentioned_user_id: person.id }));
              if (rows.length) {
                const insertMentions = await client.from('forum_post_mentions').upsert(rows, { onConflict: 'post_id,mentioned_user_id', ignoreDuplicates: true });
                if (insertMentions.error) showStatus(status, 'Publicación compartida; las menciones se activarán cuando actualices Supabase.', 'error');
              }
            }
          } catch (_) {}
        }
        editor.replaceChildren(); editor.innerHTML = '';
        selectedImage = null; imageInput.value = ''; imagePreview.replaceChildren(); imagePreview.hidden = true; counter.textContent = '0 / 5000'; hideMentions();
        if (!status.dataset.kind || status.dataset.kind !== 'error') showStatus(status, 'Publicación compartida.', 'success');
        await loadForumFeed();
      } catch (error) {
        if (uploadedPath && !createdPostId) { try { await client.storage.from('post-images').remove([uploadedPath]); } catch (_) {} }
        showStatus(status, error?.message || 'No se pudo publicar. Comprueba la configuración de Supabase.', 'error');
      } finally { submit.disabled = false; submit.textContent = 'Publicar'; }
    });
    host.appendChild(form);
  }

  function setupForumDetailView(mode) {
    // Una notificación debe abrir desde el inicio del post, no restaurar ni anclar el scroll anterior.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    document.documentElement.style.scrollBehavior = 'auto';
    if (location.hash) {
      const cleanUrl = new URL(location.href);
      cleanUrl.hash = '';
      history.replaceState(history.state, '', cleanUrl.href);
    }
    window.scrollTo(0, 0);
    const intro = $('.community-page-intro');
    const title = intro?.querySelector('h1');
    const description = intro?.querySelector('p');
    if (title) title.textContent = mode === 'likes' ? 'Actividad de la comunidad' : 'Publicación';
    if (description) description.textContent = mode === 'likes'
      ? 'Publicaciones a las que una persona le dio me gusta. Desplázate para revisar cada una.'
      : 'La publicación completa y toda la conversación, en un solo lugar.';
    const layout = document.querySelector('.forum-layout');
    layout?.classList.add('forum-layout--detail');
    const composer = $('#forumComposer');
    if (composer) composer.hidden = true;
    const sidebar = document.querySelector('.forum-sidebar');
    if (sidebar) sidebar.hidden = true;
    const main = document.querySelector('.forum-main');
    if (main && !$('#forumBackLink')) {
      const back = document.createElement('a');
      back.id = 'forumBackLink';
      back.className = 'community-forum-back';
      back.href = new URL('foro.html', SITE_ROOT).href;
      back.textContent = '← Volver al foro';
      main.prepend(back);
    }
  }

  function forumPostSelect(withBadges) {
    const profileFields = withBadges
      ? 'profiles!forum_posts_user_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified))'
      : 'profiles!forum_posts_user_id_fkey(username,display_name,avatar_url)';
    return 'id,user_id,content_html,content_text,image_url,created_at,' + profileFields + ',forum_post_likes(user_id)';
  }

  async function loadForumPostDetail(host, postId) {
    if (!/^\d+$/.test(String(postId))) {
      host.replaceChildren();
      const message = document.createElement('p');
      message.className = 'community-empty';
      message.textContent = 'El enlace de la publicación no es válido.';
      host.appendChild(message);
      return;
    }
    host.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'community-muted';
    loading.textContent = 'Cargando publicación…';
    host.appendChild(loading);
    let result = await readClient().from('forum_posts').select(forumPostSelect(true)).eq('id', postId).maybeSingle();
    if (result.error) result = await readClient().from('forum_posts').select(forumPostSelect(false)).eq('id', postId).maybeSingle();
    host.replaceChildren();
    if (result.error) {
      const message = document.createElement('p');
      message.className = 'community-status community-status--error';
      message.textContent = 'No se pudo cargar la publicación. Comprueba la conexión con Supabase.';
      host.appendChild(message);
      return;
    }
    if (!result.data) {
      const message = document.createElement('p');
      message.className = 'community-empty';
      message.textContent = 'Esta publicación ya no existe o no está disponible.';
      host.appendChild(message);
      return;
    }
    host.appendChild(renderPostCard(result.data, sessionUser, { detail: true, loadReplies: true, openable: false }));
    // El contenido se monta de forma asíncrona; asegura que la página permanezca en la cabecera del post.
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  async function loadLikedPosts(host, actorId) {
    host.replaceChildren();
    if (!sessionUser) {
      const message = document.createElement('p');
      message.className = 'community-empty';
      message.textContent = 'Inicia sesión para consultar las publicaciones de esta actividad.';
      host.appendChild(message);
      return;
    }
    if (!actorId) {
      const message = document.createElement('p');
      message.className = 'community-status community-status--error';
      message.textContent = 'No se encontró la persona de esta notificación.';
      host.appendChild(message);
      return;
    }
    const loading = document.createElement('p');
    loading.className = 'community-muted';
    loading.textContent = 'Buscando publicaciones…';
    host.appendChild(loading);
    const notifications = await runWithFreshSessionRetry(() =>
      client.from('notifications')
        .select('post_id,created_at')
        .eq('user_id', sessionUser.id)
        .eq('actor_id', actorId)
        .eq('type', 'post_like')
        .not('post_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)
    );
    host.replaceChildren();
    if (notifications.error) {
      const message = document.createElement('p');
      message.className = 'community-status community-status--error';
      message.textContent = 'No se pudieron consultar las publicaciones de esta actividad.';
      host.appendChild(message);
      return;
    }
    const postIds = Array.from(new Set((notifications.data || []).map(row => String(row.post_id)).filter(Boolean)));
    if (!postIds.length) {
      const message = document.createElement('p');
      message.className = 'community-empty';
      message.textContent = 'No quedan publicaciones disponibles para esta actividad.';
      host.appendChild(message);
      return;
    }
    let actor = null;
    try {
      const person = await readClient().from('profiles').select('id,username,display_name').eq('id', actorId).maybeSingle();
      actor = person.data || null;
    } catch (_) {}
    const introTitle = $('.community-page-intro h1');
    const introDescription = $('.community-page-intro p');
    const label = actor?.display_name || (actor?.username ? '@' + actor.username : 'Esta persona');
    if (introTitle) introTitle.textContent = 'Me gusta de ' + label;
    if (introDescription) introDescription.textContent = 'Estas son las publicaciones a las que ' + label + ' le dio me gusta. Abre cualquiera para ver sus respuestas.';
    let result = await readClient().from('forum_posts').select(forumPostSelect(true)).in('id', postIds);
    if (result.error) result = await readClient().from('forum_posts').select(forumPostSelect(false)).in('id', postIds);
    host.replaceChildren();
    if (result.error) {
      const message = document.createElement('p');
      message.className = 'community-status community-status--error';
      message.textContent = 'No se pudieron cargar las publicaciones de esta actividad.';
      host.appendChild(message);
      return;
    }
    const postsById = new Map((result.data || []).map(post => [String(post.id), post]));
    const orderedPosts = postIds.map(id => postsById.get(id)).filter(Boolean);
    if (!orderedPosts.length) {
      const message = document.createElement('p');
      message.className = 'community-empty';
      message.textContent = 'Las publicaciones de esta actividad ya no están disponibles.';
      host.appendChild(message);
      return;
    }
    orderedPosts.forEach(post => host.appendChild(renderPostCard(post, sessionUser, {
      loadReplies: false,
      openable: true
    })));
  }

  async function loadForumFeed() {
    const host = $('#forumFeed');
    if (!host || !client) return;
    const params = new URLSearchParams(location.search);
    const legacyPost = location.hash.match(/^#post-(\d+)$/)?.[1];
    const postId = params.get('post') || legacyPost;
    const likedBy = params.get('likedBy');
    if (postId || likedBy) {
      setupForumDetailView(likedBy ? 'likes' : 'post');
      if (postId) await loadForumPostDetail(host, postId);
      else await loadLikedPosts(host, likedBy);
      return;
    }
    host.replaceChildren();
    const loading = document.createElement('p'); loading.className = 'community-muted'; loading.textContent = 'Cargando publicaciones…'; host.appendChild(loading);
    let result = await readClient().from('forum_posts')
      .select('id,user_id,content_html,content_text,image_url,created_at,profiles!forum_posts_user_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified)),forum_post_likes(user_id)')
      .order('created_at', { ascending: false }).limit(50);
    if (result.error) {
      result = await readClient().from('forum_posts')
        .select('id,user_id,content_html,content_text,image_url,created_at,profiles!forum_posts_user_id_fkey(username,display_name,avatar_url),forum_post_likes(user_id)')
        .order('created_at', { ascending: false }).limit(50);
    }
    host.replaceChildren();
    if (result.error) {
      const error = document.createElement('p'); error.className = 'community-status community-status--error';
      error.textContent = 'No se pudieron cargar las publicaciones. Ejecuta el esquema actualizado de Supabase.';
      host.appendChild(error); return;
    }
    if (!result.data?.length) {
      const empty = document.createElement('p'); empty.className = 'community-empty';
      empty.textContent = 'Todavía no hay publicaciones. ¡Comparte la primera!';
      host.appendChild(empty); return;
    }
    result.data.forEach(post => host.appendChild(renderPostCard(post, sessionUser)));
  }

  async function boot() {
    addStyles();
    ensureForumNavigation();
    ensureNotificationLink();
    client = window.NS_SUPABASE_CLIENT || null;
    publicClient = window.NS_SUPABASE_PUBLIC_CLIENT || null;
    if (!client) {
      if ($('#forumFeed')) {
        const info = document.createElement('p'); info.className = 'community-status community-status--error';
        info.textContent = 'No se pudo conectar con Supabase. Recarga la página e inténtalo de nuevo.';
        $('#forumFeed').replaceChildren(info);
      }
      if ($('#notificationsFeed')) $('#notificationsFeed').replaceChildren(Object.assign(document.createElement('p'), { className: 'community-status community-status--error', textContent: 'No se pudo conectar con Supabase.' }));
      return;
    }
    const session = await getSessionSafely();
    sessionUser = session?.user || null;
    sessionProfile = sessionUser ? await getCurrentProfile(sessionUser).catch(() => null) : null;
    if ($('#publicProfileCard')) await refreshCommunityProfile();
    await updateNotificationCount();
    if ($('#notificationsFeed')) { await renderFriendInbox(); await loadNotifications(); }
    if ($('#forumComposer')) {
      mountForumComposer(sessionUser);
      await loadForumFeed();
      await renderSuggestions([]);
    }
    client.auth.onAuthStateChange((event, session) => {
      // La renovación del token y la sesión inicial no cambian al usuario visible.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      const nextUserId = session?.user?.id || null;
      if (nextUserId === (sessionUser?.id || null)) return;
      window.setTimeout(async () => {
        // Otra notificación puede haber actualizado ya la sesión mientras esperábamos.
        const latest = await getSessionSafely();
        const latestUserId = latest?.user?.id || null;
        if (latestUserId === (sessionUser?.id || null)) return;
        await refreshCommunityProfile().catch(() => {});
        await updateNotificationCount();
        if ($('#notificationsFeed')) {
          await renderFriendInbox();
          await loadNotifications();
        }
      }, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(error => console.error(error)), { once: true });
  else boot().catch(error => console.error(error));
})();