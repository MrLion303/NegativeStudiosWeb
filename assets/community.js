(function () {
  'use strict';

  const ownScript = document.currentScript;
  const SITE_ROOT = window.NS_SUPABASE_CONFIG?.siteUrl ||
    (ownScript?.src ? new URL('../', ownScript.src).href : new URL('./', location.href).href);
  const $ = selector => document.querySelector(selector);
  let client = null;
  let sessionUser = null;
  let activeProfile = null;
  let profileRequests = [];

  function addStyles() {
    if (document.querySelector('link[data-ns-community-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('assets/community.css?v=20261020a', SITE_ROOT).href;
    link.dataset.nsCommunityCss = 'true';
    document.head.appendChild(link);
  }

  function ensureForumNavigation() {
    const nav = $('#navLinks');
    if (!nav || nav.querySelector('a[data-ns-forum-link]')) return;
    const link = document.createElement('a');
    link.href = new URL('foro.html', SITE_ROOT).href;
    link.textContent = 'Foro';
    link.dataset.nsForumLink = 'true';
    if (location.pathname.endsWith('/foro.html')) link.classList.add('active');
    const projects = Array.from(nav.querySelectorAll('a')).find(item => /proyectos\.html(?:$|[?#])/.test(item.href));
    if (projects?.nextSibling) nav.insertBefore(link, projects.nextSibling);
    else nav.appendChild(link);
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
    if (relation?.is_verified) {
      const img = document.createElement('img');
      img.className = 'ns-badge ns-badge--verified';
      img.src = new URL('assets/badges/verificado.png', SITE_ROOT).href;
      img.alt = 'Verificado';
      img.title = 'Este usuario está verificado';
      img.setAttribute('aria-label', img.title);
      img.loading = 'lazy';
      node.appendChild(img);
    }
    if (relation?.is_mod) {
      const img = document.createElement('img');
      img.className = 'ns-badge ns-badge--mod';
      img.src = new URL('assets/badges/mod.png', SITE_ROOT).href;
      img.alt = 'Moderador';
      img.title = 'Moderador';
      img.setAttribute('aria-label', img.title);
      img.loading = 'lazy';
      node.appendChild(img);
    }
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

  function renderPostCard(post, user) {
    const profile = postProfile(post);
    const card = document.createElement('article');
    card.className = 'community-post';
    card.dataset.postId = String(post.id);
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
    if (user && user.id === post.user_id) {
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'community-button community-button--quiet';
      remove.textContent = 'Eliminar publicación';
      remove.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar esta publicación?')) return;
        remove.disabled = true;
        const result = await client.from('forum_posts').delete().eq('id', post.id).eq('user_id', user.id);
        if (result.error) { alert(result.error.message); remove.disabled = false; }
        else await loadForumFeed();
      });
      actions.appendChild(remove);
    }
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
    if ($('#publicProfileCard')) {
      const param = new URLSearchParams(location.search).get('username');
      activeProfile = param ? await getProfileByUsername(param) : await getCurrentProfile(sessionUser);
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
      await renderFriendInbox();
      await renderSuggestions([activeProfile?.id]);
    }
    if ($('#forumComposer')) {
      mountForumComposer(sessionUser);
      await loadForumFeed();
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
    const toolbar = document.createElement('div'); toolbar.className = 'community-toolbar'; toolbar.setAttribute('aria-label', 'Formato del texto');
    const editor = document.createElement('div'); editor.className = 'community-editor'; editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true'); editor.dataset.placeholder = '¿Qué quieres compartir con la comunidad?';
    editor.addEventListener('paste', event => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    });
    toolbar.append(
      makeToolbarButton('B', 'Negrita', () => { editor.focus(); document.execCommand('bold'); }),
      makeToolbarButton('I', 'Cursiva', () => { editor.focus(); document.execCommand('italic'); }),
      makeToolbarButton('A+', 'Texto más grande', () => { editor.focus(); document.execCommand('fontSize', false, '5'); }),
      makeToolbarButton('A−', 'Texto más pequeño', () => { editor.focus(); document.execCommand('fontSize', false, '2'); })
    );
    const imageInput = document.createElement('input'); imageInput.type = 'file'; imageInput.accept = 'image/png,image/jpeg,image/webp'; imageInput.hidden = true;
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
    const footer = document.createElement('div'); footer.className = 'community-composer-footer';
    const counter = document.createElement('span'); counter.className = 'community-muted'; counter.textContent = '0 / 5000';
    editor.addEventListener('input', () => { counter.textContent = Math.min(editor.innerText.length, 5000) + ' / 5000'; });
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'community-button community-button--primary'; submit.textContent = 'Publicar';
    footer.append(counter, submit);
    form.append(toolbar, editor, imageInput, imagePreview, status, footer);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const contentText = editor.innerText.trim();
      const contentHtml = safePostHtml(editor.innerHTML);
      if (!contentText && !selectedImage) { showStatus(status, 'Escribe algo o adjunta una imagen antes de publicar.', 'error'); editor.focus(); return; }
      if (contentText.length > 5000 || contentHtml.length > 15000) { showStatus(status, 'La publicación supera el límite permitido.', 'error'); return; }
      submit.disabled = true; submit.textContent = 'Publicando…'; showStatus(status, '', '');
      let uploadedPath = null;
      try {
        let imageUrl = null;
        if (selectedImage) {
          const ext = selectedImage.type === 'image/png' ? 'png' : selectedImage.type === 'image/webp' ? 'webp' : 'jpg';
          uploadedPath = user.id + '/' + crypto.randomUUID() + '.' + ext;
          const upload = await client.storage.from('post-images').upload(uploadedPath, selectedImage, { contentType: selectedImage.type, upsert: false });
          if (upload.error) throw upload.error;
          imageUrl = client.storage.from('post-images').getPublicUrl(uploadedPath).data.publicUrl;
        }
        const result = await client.from('forum_posts').insert({
          user_id: user.id, content_html: contentHtml, content_text: contentText, image_url: imageUrl
        });
        if (result.error) throw result.error;
        editor.replaceChildren(); editor.innerHTML = '';
        selectedImage = null; imageInput.value = ''; imagePreview.replaceChildren(); imagePreview.hidden = true; counter.textContent = '0 / 5000';
        showStatus(status, 'Publicación compartida.', 'success');
        await loadForumFeed();
      } catch (error) {
        if (uploadedPath) { try { await client.storage.from('post-images').remove([uploadedPath]); } catch (_) {} }
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
    client = window.NS_SUPABASE_CLIENT || null;
    if (!client) {
      if ($('#forumFeed')) {
        const info = document.createElement('p'); info.className = 'community-status community-status--error';
        info.textContent = 'No se pudo conectar con Supabase. Recarga la página e inténtalo de nuevo.';
        $('#forumFeed').replaceChildren(info);
      }
      return;
    }
    const session = await client.auth.getSession();
    sessionUser = session.data?.session?.user || null;
    if ($('#publicProfileCard')) await refreshCommunityProfile();
    if ($('#forumComposer')) {
      mountForumComposer(sessionUser);
      await loadForumFeed();
    }
    client.auth.onAuthStateChange(() => {
      window.setTimeout(() => refreshCommunityProfile().catch(() => {}), 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(error => console.error(error)), { once: true });
  else boot().catch(error => console.error(error));
})();