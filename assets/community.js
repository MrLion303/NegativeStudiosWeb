(function () {
  'use strict';

  const ownScript = document.currentScript;
  const SITE_ROOT = window.NS_SUPABASE_CONFIG?.siteUrl ||
    (ownScript?.src ? new URL('../', ownScript.src).href : new URL('./', location.href).href);
  const $ = selector => document.querySelector(selector);
  let client = null;
  let sessionUser = null;
  let sessionProfile = null;
  let activeProfile = null;
  let profileRequests = [];
  let overflowCloseBound = false;

  function addStyles() {
    if (document.querySelector('link[data-ns-community-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('assets/community.css?v=20261020c', SITE_ROOT).href;
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
    if (!nav || nav.querySelector('a[data-ns-notifications-link]')) return;
    const link = document.createElement('a');
    link.href = new URL('notificaciones.html', SITE_ROOT).href;
    link.className = 'ns-notifications-link';
    link.dataset.nsNotificationsLink = 'true';
    link.setAttribute('aria-label', 'Notificaciones');
    link.title = 'Notificaciones';
    link.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="ns-notifications-label">Notificaciones</span><span class="ns-notification-count" hidden>0</span>';
    if (location.pathname.endsWith('/notificaciones.html')) link.classList.add('active');
    const forum = nav.querySelector('a[data-ns-forum-link]');
    if (forum?.nextSibling) nav.insertBefore(link, forum.nextSibling);
    else nav.appendChild(link);
  }

  async function updateNotificationCount() {
    const link = $('a[data-ns-notifications-link]');
    const badge = link?.querySelector('.ns-notification-count');
    if (!link || !badge) return;
    link.hidden = !sessionUser;
    if (!sessionUser || !client) { badge.hidden = true; return; }
    try {
      const { count, error } = await client.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      if (error) throw error;
      badge.textContent = count > 99 ? '99+' : String(count || 0);
      badge.hidden = !count;
    } catch (_) { badge.hidden = true; }
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
    let result = await client.from('profiles')
      .select('id, username, display_name, avatar_url, created_at, profile_badges(is_mod, is_verified)')
      .eq('username', username).maybeSingle();
    if (result.error) {
      result = await client.from('profiles')
        .select('id, username, display_name, avatar_url, created_at')
        .eq('username', username).maybeSingle();
    }
    if (result.error) throw result.error;
    return result.data;
  }

  async function getCurrentProfile(user) {
    if (!user) return null;
    let result = await client.from('profiles')
      .select('id, username, display_name, avatar_url, created_at, profile_badges(is_mod, is_verified)')
      .eq('id', user.id).maybeSingle();
    if (result.error) {
      result = await client.from('profiles')
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
    const result = await client.from('friend_requests')
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
        fields => client.from('profiles').select(fields).in('id', ids)
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
        fields => client.from('profiles').select(fields).order('created_at', { ascending: false }).limit(40)
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
    const heading = document.createElement('h2');
    heading.textContent = 'Solicitudes recibidas';
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
        fields => client.from('profiles').select(fields).in('id', ids));
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

  function notificationDestination(item) {
    if (item.type === 'friend_request') return new URL('notificaciones.html#friendRequestsInbox', SITE_ROOT).href;
    if (item.post_id) return new URL('foro.html#post-' + item.post_id, SITE_ROOT).href;
    if (item.project_slug) return new URL('proyectos/' + encodeURIComponent(item.project_slug) + '/index.html' + (item.comment_id ? '#comment-' + item.comment_id : ''), SITE_ROOT).href;
    return new URL('notificaciones.html', SITE_ROOT).href;
  }

  async function markNotificationRead(id) {
    if (!client || !sessionUser) return;
    await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', sessionUser.id);
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
    let result = await client.from('notifications')
      .select('id,type,title,body,post_id,comment_id,friend_request_id,project_slug,created_at,read_at,actor_id,profiles!notifications_actor_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified))')
      .order('created_at', { ascending: false }).limit(100);
    if (result.error) {
      result = await client.from('notifications')
        .select('id,type,title,body,post_id,comment_id,friend_request_id,project_slug,created_at,read_at,actor_id')
        .order('created_at', { ascending: false }).limit(100);
    }
    host.replaceChildren();
    if (result.error) {
      const error = document.createElement('p'); error.className = 'community-status community-status--error';
      error.textContent = 'No se pudo cargar la actividad. Ejecuta el esquema actualizado de Supabase.';
      host.appendChild(error); return;
    }
    const entries = result.data || [];
    const unread = entries.filter(item => !item.read_at).length;
    const markAll = $('#markAllNotificationsRead');
    if (markAll) {
      markAll.disabled = unread === 0;
      markAll.textContent = unread ? 'Marcar todo como leído (' + unread + ')' : 'Todo leído';
      markAll.onclick = async () => {
        markAll.disabled = true;
        try {
          const response = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', sessionUser.id).is('read_at', null);
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
    entries.forEach(item => {
      let actor = item.profiles || {};
      if (Array.isArray(actor)) actor = actor[0] || {};
      const card = document.createElement('article');
      card.className = 'community-notification' + (item.read_at ? '' : ' is-unread');
      const actorLink = document.createElement('a');
      actorLink.className = 'community-notification-avatar'; actorLink.href = actor.username ? profileUrl(actor) : '#';
      actorLink.appendChild(avatar(actor, 'community-avatar'));
      const copy = document.createElement('div'); copy.className = 'community-notification-copy';
      const headline = document.createElement('strong'); headline.textContent = item.title || 'Nueva actividad';
      const body = document.createElement('p');
      body.textContent = item.body || (actor.display_name || actor.username ? (actor.display_name || '@' + actor.username) : 'La comunidad') + ' interactuó con tu contenido.';
      const meta = document.createElement('small');
      meta.textContent = new Date(item.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      copy.append(headline, body, meta);
      const open = document.createElement('a'); open.className = 'community-notification-open';
      open.href = notificationDestination(item); open.textContent = 'Ver'; open.setAttribute('aria-label', 'Ver actividad');
      const activate = async () => {
        if (!item.read_at) await markNotificationRead(item.id);
      };
      open.addEventListener('click', async event => { event.preventDefault(); await activate(); location.assign(open.href); });
      copy.addEventListener('click', async event => {
        if (event.target.closest('a')) return;
        await activate();
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

  function postProfile(post) {
    let profile = post.profiles || {};
    if (Array.isArray(profile)) profile = profile[0] || {};
    return profile;
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
        const query = client.from(table);
        const filter = keyName === 'post_id' ? 'post_id' : 'comment_id';
        if (nextLiked) {
          const result = await query.insert({ [filter]: post.id, user_id: sessionUser.id });
          if (result.error) throw result.error;
        } else {
          const result = await query.delete().eq(filter, post.id).eq('user_id', sessionUser.id);
          if (result.error) throw result.error;
        }
        liked = nextLiked;
        count = Math.max(0, count + (liked ? 1 : -1));
        button.classList.toggle('is-liked', liked);
        button.setAttribute('aria-label', liked ? 'Quitar corazón' : 'Dar corazón');
        button.textContent = '♥ ' + count;
      } catch (error) {
        alert(error?.message || 'No se pudo guardar el corazón. Comprueba que hayas actualizado Supabase.');
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

  function renderPostCard(post, user) {
    const profile = postProfile(post);
    const card = document.createElement('article');
    card.className = 'community-post';
    card.dataset.postId = String(post.id);
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
    const menu = createOverflowMenu(menuItems);
    if (menu) header.appendChild(menu);
    card.appendChild(header);

    if (post.content_html || post.content_text) {
      const body = document.createElement('div'); body.className = 'community-post-body';
      body.innerHTML = safePostHtml(post.content_html || String(post.content_text || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])));
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
    return card;
  }

  async function loadPostsForProfile(profileId, target) {
    if (!target || !client) return;
    target.replaceChildren();
    const loading = document.createElement('p'); loading.className = 'community-muted'; loading.textContent = 'Cargando publicaciones…';
    target.appendChild(loading);
    let result = await client.from('forum_posts')
      .select('id,user_id,content_html,content_text,image_url,created_at,profiles!forum_posts_user_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified)),forum_post_likes(user_id)')
      .eq('user_id', profileId).order('created_at', { ascending: false }).limit(30);
    if (result.error) {
      result = await client.from('forum_posts')
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
    const session = await client.auth.getSession();
    sessionUser = session.data?.session?.user || null;
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
      const match = editor.innerText.match(/(?:^|\s)@([a-zA-Z0-9_]{0,24})$/);
      if (!match) { hideMentions(); return; }
      const query = (match[1] || '').toLowerCase();
      let people = [];
      try {
        people = await loadProfiles(
          'id,username,display_name,avatar_url,profile_badges(is_mod, is_verified)',
          fields => {
            let request = client.from('profiles').select(fields).neq('id', user.id).limit(6);
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
    footer.append(counter, footerGroup);
    function updateComposerCounter() {
      counter.textContent = Math.min(editor.innerText.length, 5000) + ' / 5000';
      updateMentions();
    }
    editor.addEventListener('input', updateComposerCounter);
    main.append(editor, mentionSuggestions, toolbar, imageInput, imagePreview, status);
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
            const mentioned = await client.from('profiles').select('id,username').in('username', usernames);
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

  async function loadForumFeed() {
    const host = $('#forumFeed');
    if (!host || !client) return;
    host.replaceChildren();
    const loading = document.createElement('p'); loading.className = 'community-muted'; loading.textContent = 'Cargando publicaciones…'; host.appendChild(loading);
    let result = await client.from('forum_posts')
      .select('id,user_id,content_html,content_text,image_url,created_at,profiles!forum_posts_user_id_fkey(username,display_name,avatar_url,profile_badges(is_mod,is_verified)),forum_post_likes(user_id)')
      .order('created_at', { ascending: false }).limit(50);
    if (result.error) {
      result = await client.from('forum_posts')
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
    if (!client) {
      if ($('#forumFeed')) {
        const info = document.createElement('p'); info.className = 'community-status community-status--error';
        info.textContent = 'No se pudo conectar con Supabase. Recarga la página e inténtalo de nuevo.';
        $('#forumFeed').replaceChildren(info);
      }
      if ($('#notificationsFeed')) $('#notificationsFeed').replaceChildren(Object.assign(document.createElement('p'), { className: 'community-status community-status--error', textContent: 'No se pudo conectar con Supabase.' }));
      return;
    }
    const session = await client.auth.getSession();
    sessionUser = session.data?.session?.user || null;
    sessionProfile = sessionUser ? await getCurrentProfile(sessionUser).catch(() => null) : null;
    if ($('#publicProfileCard')) await refreshCommunityProfile();
    await updateNotificationCount();
    if ($('#notificationsFeed')) { await renderFriendInbox(); await loadNotifications(); }
    if ($('#forumComposer')) {
      mountForumComposer(sessionUser);
      await loadForumFeed();
      await renderSuggestions([]);
    }
    client.auth.onAuthStateChange(() => {
      window.setTimeout(async () => { await refreshCommunityProfile().catch(() => {}); await updateNotificationCount(); if ($('#notificationsFeed')) { await renderFriendInbox(); await loadNotifications(); } }, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(error => console.error(error)), { once: true });
  else boot().catch(error => console.error(error));
})();