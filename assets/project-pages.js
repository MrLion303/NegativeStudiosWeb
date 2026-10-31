(function () {
  if (document.querySelector('script[data-ns-tab-resume]')) return;
  var source = document.currentScript;
  if (!source || !source.src) return;
  var script = document.createElement('script');
  script.src = new URL('tab-resume.js?v=20261020a', source.src).href;
  script.dataset.nsTabResume = 'true';
  document.head.appendChild(script);
})();
(function(){
const SCRIPT_URL=document.currentScript&&document.currentScript.src;
const PAGES={
  'personajes':{title:'Personajes',label:'Proyectos · Archivo',source:'https://sites.google.com/view/negativestudios/proyectos/personajes',sections:[]},
  'overland':{title:'OVERLAND',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/overland',gallery:[['assets/media/overland-gallery.webp','Una vista adicional del mundo de OVERLAND.']],sections:[{title:'TRÁILER CINEMATOGRÁFICO',p:[]},{title:'OVERLAND',p:['Es un SMP con cambios de dificultad, hecho para disfrutar la experiencia de Survival con Mods; contando con eventos semanales de Lore que expande el Universo Cinematográfico.','¿Estás listo para el DESAFÍO?']},{title:'DESARROLLO',p:['Este servidor da inicio a la Fase 2 del UCC (Universo Cinematográfico del Caos), el cual expande el Lore de los servidores de NegativeStudios y GG Studios.']},{title:'Teasers',p:['Teasers que fueron publicados meses antes de la salida del proyecto.']}],videos:[['f4QOdfNcB0k','TRÁILER CINEMATOGRÁFICO']]},
  'proyecto-y':{title:'PROYECTO Y',label:'Proyecto · Fase 1',source:'https://sites.google.com/view/negativestudios/proyectos/proyecto-y',sections:[{title:'PROYECTO Y',p:['SMP secuela de Proyecto X, un servidor basado en la época medieval. Creado principalmente por el Bobiverso en colaboración con Negative.']},{title:'MAPA',p:['Proyecto Y cuenta con un mapa interactivo explorable, a demás de mundo abierto survival Vanilla.']},{title:'INVITADOS',p:['Estos son los jugadores invitados de Proyecto Y, siendo revelados en nuestras redes sociales!']},{title:'Evento Final',p:['Proyecto Y tuvo un evento final para terminar con su existencia. Un evento en vivo que solo pudo verse una vez en toda la historia!']}],videos:[['WGDLCsLLxkw','Proyecto Y']]},
  'parasites':{title:'PARASITES',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/parasites',sections:[{title:'PARASITES',p:['El mundo que conocemos ha quedado infectado. Los supervivientes deberán encontrar la forma de poder devolver el mundo a la normalidad. Un evento de 6 días original en el que adaptarse es la escapatoria.']}]},
  'culling-games':{title:'CULLING GAMES',label:'Proyecto · No canon',source:'https://sites.google.com/view/negativestudios/proyectos/culling-games',sections:[{title:'Jujutsu Kaisen: Juego del Sacrificio',p:['Un evento basado en la Temporada 3 del anime de Jujutsu Kaisen. Un Battle Royale con técnicas ritual, donde el ganador será el último que quede en pie.','Estrenado en enero del 2026.']}]},
  'pdc-rebirth':{title:'PDC: REBIRTH',label:'Proyecto · Fase 1',source:'https://sites.google.com/view/negativestudios/proyectos/pdc-rebirth',sections:[{title:'Permadeath Casual: REBIRTH',p:['Servidor basado de Permadeath de ElRichMC, innovando con cambios de dificultad cada 5 días, últimas versiones del juego, eventos masivos, misiones, items nuevos en el juego, entre mucho más. Salió en 24 Julio y concluyó el 21 de Septiembre de 2025.']}]},
  'negative-awards':{title:'NEGATIVE AWARDS',label:'Proyecto · No canon',source:'https://sites.google.com/view/negativestudios/proyectos/negative-awards',sections:[{title:'CATEGORÍAS NOMINADAS EN LOS NEGATIVE AWARDS',p:['Negative Awards es un evento en el que se premia a jugadores y proyectos del estudio en diferentes categorías. Todo esto con la finalidad de agradecer públicamente a todos por su apoyo.','Las categorías mostradas en la imagen son las de esta fase. Se planea hacer premiaciones cada cambio de fase del estudio.']},{title:'VOTA POR TUS FAVORITOS EN LAS CATEGORÍAS DE LOS NEGATIVE AWARDS AQUÍ',p:['Tu voto será anónimo. Si apareces en las categorías, puedes votar por ti, siempre y cuando lo creas merecedor. Se premiará a la persona que protagonice algún clip o circunstancia donde no se especifique un jugador.']}],videos:[['tCvdg--FYpM','Negative Awards'],['-knMbt_weY4','Negative Awards']],links:[['Formulario de votación original','https://docs.google.com/forms/d/e/1FAIpQLSedflLA6CVqzRPeQzUqE2tiJjJT9QKlD6YR30UjJw_BGVvscQ/viewform']]},
  'proyecto-x':{title:'Proyecto X',label:'Proyecto · Fase 1',source:'https://sites.google.com/view/negativestudios/proyectos/proyecto-x',sections:[{title:'Proyecto X',p:['Proyecto X fue un SMP en colaboración con la comunidad del YouTuber Bobicraft, "Bobiverso", creadores de Comandiulandia.','Este servidor comenzó como una idea de un SMP cooperativo casual, donde los jugadores tenían la regla universal de construir mega bases. Uniendo a la comunidad de NegativeStudios y Bobiverso.']},{title:'NegativeStudios x Bobiverso',p:['Después del éxito que fue "Permadeath Casual: Final Chapter", se reveló al público la colaboración que traería meses de diversión a la comunidad. BobiExplica, también conocido como NickSz0 y fundador de Bobiverso, se volvió la mano derecha del fundador de NegativeStudios, y financió y dirigió mayor parte del servidor.','Recuerdos de Proyecto X, fotografías tomadas por todos los miembros!']}],videos:[['eIYpBYJy4b4','Recuerdos de Proyecto X']],links:[['Clip de Proyecto X en Medal','https://medal.tv/games/minecraft/clips/imt9nwqt5JFReF9Xb/d133784dJgES?invite=cr-MSw4M00sMjQzNTQwMjk4LA']]},
    'permamuerte':{title:'Permadeath Casual I, II y III',label:'Proyecto · No canon',source:'https://sites.google.com/view/negativestudios/proyectos/proyectos',gallery:[['assets/media/pdc-final-chapter.webp','Permadeath Casual: Final Chapter']],sections:[{title:'Permadeath Casual I, II y III',p:['Tres ediciones de supervivencia hardcore inspiradas en Permadeath, con cambios de dificultad originales y una experiencia progresivamente más ambiciosa.']},{title:'Final Chapter',p:['La tercera edición introdujo cambios de dificultad únicos cada 5 días y cerró el arco principal de Permadeath Casual.']} ]},
'pdc-final-chapter':{title:'Permadeath Casual: Final Chapter',label:'Proyecto · No canon',source:'https://sites.google.com/view/negativestudios/proyectos/pdc-final-chapter',sections:[{title:'Información',p:['"Permadeath Casual: Final Chapter" fue la tercera edición de una serie de servidores del mismo nombre. Inicio el 24 de marzo de 2024 para terminar el 21 de mayo del mismo año.','No era un Permadeath común y corriente, ya que implementaba cambios de dificultad únicos y completamente originales cada 5 días.']},{title:'Cambios de dificultad',p:['A continuación se adjuntan los Cambios de Dificultad Originales que se pudieron ver a lo largo de la serie.']}]}
};
const key=window.NS_PROJECT_PAGE;const p=PAGES[key];const root=window.NS_SITE_ROOT||'../../';const SITE='https://mrlion303.github.io/NegativeStudiosWeb/';const navHref=x=>SITE+x;const asset=x=>SITE+x.replace(/^\.\.\//,'');
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const href=x=>String(x||'').indexOf('http://')===0||String(x||'').indexOf('https://')===0?String(x):asset(x);
const socials=[['YouTube','https://www.youtube.com/@NegativeStudios_','youtube'],['X','https://x.com/StudiosNegative','x'],['Patreon','https://www.patreon.com/NegativeStudios','patreon'],['Discord','https://discord.gg/nKxBA7qzAU','discord'],['Instagram','https://www.instagram.com/negativestudios_/?hl=es','instagram'],['Spotify','https://open.spotify.com/intl-es/artist/6oYt0nvLVZoTrGCe9XXbcO?si=XOCONaPLQNiIi954FPzqrA','spotify'],['Facebook','https://www.facebook.com/NegativeStudios','facebook'],['Roblox','https://www.roblox.com/search/groups?keyword=NegativeStudios','roblox']];
const socialNav=()=>`<div class="nav-actions"><a class="client-download" href="${navHref('descargar.html')}"><span class="client-download-label">Descargar Negative Client</span><svg class="client-download-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3v11"></path><path d="m7 10 5 5 5-5"></path><path d="M5 20h14"></path></svg></a></div>`
function nav(){return `<header class="nav"><div class="container nav-inner"><a class="brand" href="${navHref('index.html')}"><img src="${href('assets/media/brand-logo.webp')}" alt="NegativeStudios" width="40" height="40"><span>NegativeStudios</span></a><nav class="nav-links" id="navLinks"><a href="${navHref('index.html')}">Inicio</a><a class="active" href="${navHref('proyectos.html')}">Proyectos</a><a href="${navHref('anuncios.html')}">Anuncios</a><a href="${navHref('equipo.html')}">Equipo</a><a href="${navHref('acerca.html')}">Nosotros</a></nav>${socialNav()}<button class="menu-btn" aria-label="Abrir navegación" aria-controls="navLinks" aria-expanded="false">☰</button></div></header>`}
function socialIcons(){return `<div class="footer-social-icons">${socials.map(([name,url,slug])=>`<a href="${url}" target="_blank" rel="noreferrer" title="${name}" aria-label="${name}"><img src="https://cdn.simpleicons.org/${slug}/ffffff" alt="" loading="lazy"></a>`).join('')}</div>`}
function footer(){return `<footer class="footer banned-footer"><div class="container banned-footer-inner"><div class="banned-footer-top"><a class="footer-wordmark" href="${navHref('index.html')}"><img src="${href('assets/media/brand-logo.webp')}" alt="NegativeStudios"><span><b>NEGATIVE</b><br>STUDIOS<sup>®</sup></span></a><div class="footer-column"><h4>NOSOTROS</h4><a href="${navHref('acerca.html')}">Sobre nosotros</a><a href="${navHref('colaboradores.html')}">Colaboradores</a><a href="${navHref('contacto.html')}">Contacto</a></div><div class="footer-column"><h4>LEGAL</h4><a href="${navHref('legal.html#terminos')}">Términos &amp;<br>Condiciones</a><a href="${navHref('legal.html#privacidad')}">Política de<br>Privacidad</a></div><div class="footer-column"><h4>COMMUNITY</h4><a href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer">Discord</a></div></div><div class="banned-footer-divider"></div><div class="banned-footer-bottom"><p>© Todos los derechos reservados. <a href="${navHref('index.html')}">NegativeStudios</a>. Vigente desde 2022.</p>${socialIcons()}</div></div></footer>`}
function media(){const image=window.NS_PROJECT_ARTWORK?.[key]||'';const cls=image?'project-media-frame':'project-media-frame project-media-fallback';return `<section class="project-media-band"><div class="container"><div class="${cls}">${image?`<img data-ns-project-image="${key}" src="${href(image)}" alt="Portada de ${esc(p.title)}">`:''}<div class="project-media-caption"><span class="pill">${esc(p.label)}</span></div></div></div></section>`}
function gallery(){if(!p.gallery?.length)return '';return `<section class="nmc-section"><span class="eyebrow">Galería</span><h2 class="nmc-section-title">Más del proyecto</h2><div class="project-gallery">${p.gallery.map(([src,caption])=>`<figure class="project-gallery-card"><img src="${href(src)}" alt="${esc(caption)}" loading="lazy"><figcaption class="project-gallery-caption">${esc(caption)}</figcaption></figure>`).join('')}</div></section>`}
function videos(){if(!p.videos?.length)return '';return `<section class="nmc-section"><span class="eyebrow">Videos</span><div class="video-grid">${p.videos.map(([id,t])=>`<article class="video-card"><div class="video-frame"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}" title="${esc(t)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="video-label">${esc(t)}</div></article>`).join('')}</div></section>`}
function links(){if(!p.links?.length)return '';return `<section class="nmc-section"><span class="eyebrow">Enlaces originales</span><div class="nmc-child-grid">${p.links.map(([t,u])=>`<a class="nmc-child" href="${u}" target="_blank" rel="noreferrer"><h3>${esc(t)}</h3><span class="nmc-arrow">Abrir enlace →</span></a>`).join('')}</div></section>`}
function comments(){return `<section id="projectComments" class="project-comments nmc-section" data-project-comments data-project-slug="${key}"><div class="project-comments-heading"><div><span class="eyebrow">Comunidad</span><h2>Comentarios del proyecto</h2></div><span class="project-comments-count" data-project-comments-count>0 comentarios</span></div><div class="project-comments-compose" data-project-comments-compose></div><div class="account-message" id="projectCommentsMessage" hidden role="status" aria-live="polite"></div><div class="project-comments-feed" data-project-comments-feed><p class="project-comment-empty">Los comentarios aparecerán aquí.</p></div></section>`}

function overlandMarkup(){
  if(key!=='overland')return '';
  return '<section class="overland-progress-section" aria-labelledby="overlandProgressTitle"><div class="overland-progress-inner"><h2 class="overland-progress-title" id="overlandProgressTitle">Progreso de OVERLAND</h2><div id="overlandProgressContainer" aria-live="polite">Cargando progreso...</div></div></section>'+
  '<section class="overland-coming-soon" aria-label="Próximamente"><div class="overland-coming-soon-inner"><img class="overland-coming-soon-image" src="https://imgur.com/DVtvH2Z.png" alt="DESENLACE" loading="lazy"><div class="overland-coming-soon-text">MUY PRONTO</div></div></section>';
}
function installOverlandStyles(){
  if(key!=='overland'||document.getElementById('overland-page-styles'))return;
  if(!document.querySelector('link[data-overland-font]')){
    const font=document.createElement('link');
    font.rel='stylesheet';
    font.href='https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap';
    font.dataset.overlandFont='true';
    document.head.appendChild(font);
  }
  const style=document.createElement('style');
  style.id='overland-page-styles';
  style.textContent=[
    '.overland-progress-section{width:100%;padding:54px 20px 28px;background:transparent}',
    '.overland-progress-inner{width:min(900px,100%);margin:0 auto}',
    '.overland-progress-title{text-align:center;font-size:clamp(2.6rem,7vw,4rem);line-height:1.08;margin:0 0 30px;background:linear-gradient(90deg,#773407,#f5f17d,#773407);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:overlandGoldShift 4s ease-in-out infinite}',
    '@keyframes overlandGoldShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
    '.overland-progress-box{margin:0 0 18px}',
    '.overland-progress-info{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:6px;font-size:14px;color:#fff}',
    '.overland-progress-info span:first-child{min-width:0;overflow-wrap:anywhere}',
    '.overland-progress-info span:last-child,.overland-progress-info strong:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.overland-progress-track{width:100%;height:26px;position:relative;overflow:hidden;border-radius:999px!important;background:rgba(255,255,255,.05);backdrop-filter:blur(10px);box-shadow:inset 0 0 10px rgba(255,255,255,.05)}',
    '.overland-progress-fill{height:100%;width:0%;position:relative;overflow:hidden;border-radius:999px!important;transition:width 1s cubic-bezier(.25,.8,.25,1);background:linear-gradient(270deg,#00ff88,#00ccff,#7a5cff,#00ff88);background-size:400% 400%;animation:overlandGradientMove 4s ease infinite;box-shadow:0 0 10px rgba(0,255,200,.35),0 0 25px rgba(0,180,255,.25)}',
    '.overland-progress-fill:after{content:"";position:absolute;top:0;left:-60%;width:60%;height:100%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.35),transparent);animation:overlandShine 2.5s infinite}',
    '@keyframes overlandGradientMove{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
    '@keyframes overlandShine{0%{left:-60%}100%{left:120%}}',
    '.overland-progress-box.general .overland-progress-fill{background:linear-gradient(270deg,#ffb300,#ffd700,#fff2a8,#ffb300);background-size:400% 400%;animation:overlandGradientMove 3.5s ease infinite;box-shadow:0 0 12px rgba(255,215,0,.45),0 0 30px rgba(255,180,0,.25)}',
    '.overland-progress-box.general .overland-progress-info strong{font-size:16px}',
    '.overland-trailer-grid{grid-template-columns:minmax(0,1fr);margin-top:0}',
    '.overland-trailer-grid .video-card{width:100%}',
    '.overland-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;align-items:start}',
    '.overland-info-grid .nmc-section{min-width:0;margin:0 0 34px;padding:0 0 30px}',
    '.overland-info-grid .nmc-section-title{margin-bottom:16px}',
    '@media(max-width:700px){.overland-info-grid{grid-template-columns:minmax(0,1fr);gap:0}.overland-info-grid .nmc-section{margin-bottom:28px}}',
    '.overland-teasers-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;align-items:start}',
    '.overland-teasers-layout>.nmc-section{min-width:0;margin:0 0 34px}',
    '.overland-carousel-panel{min-width:0;margin:0 0 34px}',
    '.overland-carousel{width:100%}',
    '.overland-carousel-frame{width:100%;aspect-ratio:4/3;position:relative;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid var(--line)}',
    '.overland-carousel-track{display:flex;width:100%;height:100%;transition:transform .55s cubic-bezier(.22,.61,.36,1);will-change:transform}',
    '.overland-carousel-track>img{display:block;flex:0 0 100%;width:100%;min-width:100%;height:100%;object-fit:cover;user-select:none}',
    '.overland-carousel-controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:14px}',
    '.overland-carousel-controls>button{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);background:rgba(255,255,255,.035);color:#fff;font-size:24px;line-height:1;cursor:pointer;transition:background .2s ease,border-color .2s ease}',
    '.overland-carousel-controls>button:hover{background:rgba(102,194,255,.12);border-color:var(--line-strong)}',
    '.overland-carousel-dots{display:flex;align-items:center;justify-content:center;gap:9px}',
    '.overland-carousel-dots>button{width:7px;height:7px;padding:0;border:0;background:rgba(255,255,255,.35);cursor:pointer;transition:transform .2s ease,background .2s ease}',
    '.overland-carousel-dots>button.is-active{background:var(--accent);transform:scale(1.3)}',
    '.ns-editor-carousel-preview .overland-carousel-frame{aspect-ratio:auto;overflow:visible}',
    '.ns-editor-carousel-preview .overland-carousel-track{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%;height:auto;transform:none!important;transition:none}',
    '.ns-editor-carousel-preview .overland-carousel-track>img{width:100%;min-width:0;height:auto;aspect-ratio:4/3;object-fit:cover;cursor:pointer}',
    '.ns-editor-carousel-preview .overland-carousel-controls{display:none}',
    '@media(max-width:700px){.overland-teasers-layout{grid-template-columns:minmax(0,1fr);gap:6px}.overland-teasers-layout>.nmc-section{margin-bottom:24px}.overland-carousel-panel{margin-bottom:30px}.overland-carousel-frame{aspect-ratio:16/10}}',
    '.overland-progress-error{color:#ffb8b8;text-align:center;padding:12px 0}',
    '.overland-coming-soon{display:flex;justify-content:center;align-items:center;width:100%;padding:12px 20px 76px;background:transparent;text-align:center}',
    '.overland-coming-soon-inner{width:min(666px,100%);margin:0 auto}',
    '.overland-coming-soon-image{display:block;width:100%;max-width:666px;height:auto;margin:0 auto 10px}',
    '.overland-coming-soon-text{position:relative;top:-10px;font-family:"Bebas Neue",sans-serif!important;font-size:clamp(3.3rem,9vw,5rem);line-height:1;letter-spacing:5px;color:#f5f17d;animation:overlandBlinkText 1s infinite alternate}',
    '@keyframes overlandBlinkText{0%{color:#f5f17d}100%{color:#773407}}',
    '@media(max-width:600px){.overland-progress-section{padding:42px 16px 22px}.overland-progress-title{margin-bottom:25px}.overland-progress-info{font-size:13px;gap:10px}.overland-progress-track{height:22px}.overland-coming-soon{padding:8px 16px 56px}.overland-coming-soon-text{letter-spacing:3px}}',
    '@media(prefers-reduced-motion:reduce){.overland-progress-title,.overland-progress-fill,.overland-progress-fill:after,.overland-coming-soon-text{animation:none!important;transition:none!important}}'
  ].join('\n');
  document.head.appendChild(style);
}
function parseOverlandCsv(text){
  const rows=[];
  let row=[],field='',quoted=false;
  const csv=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<csv.length;i++){
    const ch=csv[i];
    if(quoted){
      if(ch==='"'){
        if(csv[i+1]==='"'){field+='"';i++;}
        else quoted=false;
      }else field+=ch;
    }else if(ch==='"'&&field.length===0)quoted=true;
    else if(ch===','){row.push(field);field='';}
    else if(ch==='\n'){
      row.push(field);
      if(row.some(cell=>String(cell).trim()))rows.push(row);
      row=[];field='';
    }else if(ch!=='\r')field+=ch;
  }
  if(field.length||row.length){row.push(field);if(row.some(cell=>String(cell).trim()))rows.push(row);}
  return rows;
}
function escapeOverlandHtml(value){
  return String(value??'').replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function initOverlandProgress(){
  if(key!=='overland')return;
  const container=document.getElementById('overlandProgressContainer');
  if(!container)return;
  const csvUrl='https://docs.google.com/spreadsheets/d/e/2PACX-1vRW4W8W3eafn7UM8B5RlIToQpowNCopdnQtUEHayb4eEUNzYOEcK4AbV5F_2kSQav6ya1jNaXNmuVuk/pub?output=csv';
  const formatPercent=new Intl.NumberFormat('es-MX',{maximumFractionDigits:2});
  async function cargarDatos(){
    try{
      const response=await fetch(csvUrl+'&t='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo consultar la hoja de cálculo.');
      const csv=await response.text();
      const datos=parseOverlandCsv(csv).map(columns=>{
        const nombre=String(columns[0]||'').trim();
        const raw=String(columns[1]??'').trim().replace(/%/g,'').replace(',','.');
        const porcentaje=Number(raw);
        if(!nombre||!Number.isFinite(porcentaje))return null;
        return {nombre:nombre,porcentaje:Math.max(0,Math.min(100,porcentaje))};
      }).filter(Boolean);
      if(!datos.length){
        container.innerHTML='<p class="overland-progress-error">Todavía no hay datos de progreso disponibles.</p>';
        return;
      }
      const promedio=datos.reduce((total,item)=>total+item.porcentaje,0)/datos.length;
      let html='<div class="overland-progress-box general"><div class="overland-progress-info"><strong>Progreso General</strong><strong>'+formatPercent.format(promedio)+'%</strong></div><div class="overland-progress-track"><div class="overland-progress-fill" style="width:'+promedio+'%"></div></div></div>';
      datos.forEach(item=>{
        html+='<div class="overland-progress-box"><div class="overland-progress-info"><span>'+escapeOverlandHtml(item.nombre)+'</span><span>'+formatPercent.format(item.porcentaje)+'%</span></div><div class="overland-progress-track"><div class="overland-progress-fill" style="width:'+item.porcentaje+'%"></div></div></div>';
      });
      container.innerHTML=html;
    }catch(error){
      container.innerHTML='<p class="overland-progress-error">Error cargando datos de progreso.</p>';
      console.error('OVERLAND progress:',error);
    }
  }
  cargarDatos();
  window.setInterval(cargarDatos,60000);
}


function overlandContentMarkup(){
  if(key!=='overland')return '';
  const findSection=title=>p.sections.find(section=>section.title===title);
  const trailer=findSection('TRÁILER CINEMATOGRÁFICO');
  const overland=findSection('OVERLAND');
  const development=findSection('DESARROLLO');
  const teasers=findSection('Teasers');
  const renderTextSection=section=>{
    if(!section)return '';
    return '<section class="nmc-section"><h2 class="nmc-section-title">'+esc(section.title)+'</h2>'+
      section.p.map(paragraph=>'<p>'+esc(paragraph)+'</p>').join('')+'</section>';
  };
  const trailerVideos=(p.videos||[]).map(([id,title])=>
    '<article class="video-card"><div class="video-frame"><iframe src="https://www.youtube.com/embed/'+encodeURIComponent(id)+'" title="'+esc(title)+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></article>'
  ).join('');
  return (trailer?'<section class="nmc-section overland-trailer-section"><h2 class="nmc-section-title">'+esc(trailer.title)+'</h2><div class="video-grid overland-trailer-grid">'+trailerVideos+'</div></section>':'')+
    '<div class="overland-info-grid">'+renderTextSection(overland)+renderTextSection(development)+'</div>'+
    (teasers?'<div class="overland-teasers-layout">'+renderTextSection(teasers)+
      '<section class="overland-carousel-panel" aria-label="Carrusel de imágenes de OVERLAND"><div class="overland-carousel" data-overland-carousel>'+
      '<div class="overland-carousel-frame"><div class="overland-carousel-track" data-overland-carousel-track>'+
      '<img src="'+href('assets/media/overland-gallery.webp')+'" alt="Imagen de OVERLAND" loading="lazy">'+
      '<img src="'+href('assets/media/overland.webp')+'" alt="Otra imagen de OVERLAND" loading="lazy">'+
      '</div></div><div class="overland-carousel-controls">'+
      '<button type="button" data-overland-prev aria-label="Imagen anterior">‹</button>'+
      '<div class="overland-carousel-dots" aria-label="Seleccionar imagen"></div>'+
      '<button type="button" data-overland-next aria-label="Imagen siguiente">›</button>'+
      '</div></div></section></div>':'');
}


function initOverlandCarousel(){
  if(key!=='overland')return;
  const editorPreview=new URLSearchParams(window.location.search).has('editor');
  if(editorPreview)document.documentElement.classList.add('ns-editor-carousel-preview');
  document.querySelectorAll('[data-overland-carousel]').forEach(carousel=>{
    if(carousel.dataset.nsCarouselReady==='true')return;
    const track=carousel.querySelector('[data-overland-carousel-track]');
    const dots=carousel.querySelector('.overland-carousel-dots');
    const previous=carousel.querySelector('[data-overland-prev]');
    const next=carousel.querySelector('[data-overland-next]');
    if(!track||!dots)return;
    carousel.dataset.nsCarouselReady='true';
    let active=0;
    let slideCount=0;
    const slides=()=>Array.from(track.children).filter(node=>node.tagName==='IMG');
    const render=()=>{
      const items=slides();
      if(!items.length)return;
      if(active>=items.length)active=0;
      if(items.length!==slideCount){
        slideCount=items.length;
        dots.innerHTML=items.map((_,index)=>
          '<button type="button" data-overland-dot="'+index+'" aria-label="Ir a la imagen '+(index+1)+'"></button>'
        ).join('');
        dots.querySelectorAll('[data-overland-dot]').forEach(dot=>{
          dot.addEventListener('click',()=>{
            active=Number(dot.dataset.overlandDot)||0;
            render();
            restartAutoplay();
          });
        });
      }
      track.style.transform='translateX(-'+(active*100)+'%)';
      dots.querySelectorAll('[data-overland-dot]').forEach((dot,index)=>{
        dot.classList.toggle('is-active',index===active);
        dot.setAttribute('aria-current',index===active?'true':'false');
      });
      items.forEach((item,index)=>item.setAttribute('aria-hidden',index===active?'false':'true'));
    };
    const move=direction=>{
      const count=slides().length;
      if(count<2)return;
      active=(active+direction+count)%count;
      render();
      restartAutoplay();
    };
    let autoplay=null;
    const stopAutoplay=()=>{
      if(autoplay!==null){window.clearInterval(autoplay);autoplay=null;}
    };
    const restartAutoplay=()=>{
      stopAutoplay();
      if(!editorPreview&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&slides().length>1){
        autoplay=window.setInterval(()=>move(1),5000);
      }
    };
    previous?.addEventListener('click',()=>move(-1));
    next?.addEventListener('click',()=>move(1));
    carousel.addEventListener('mouseenter',stopAutoplay);
    carousel.addEventListener('mouseleave',restartAutoplay);
    render();
    restartAutoplay();
    const observer=new MutationObserver(()=>{
      const count=slides().length;
      if(count!==slideCount)render();
      restartAutoplay();
    });
    observer.observe(track,{childList:true});
  });
}

function render(){if(!p)return;document.title=`${p.title} — NegativeStudios`;if(!document.querySelector('link[href*="refresh.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href=asset('assets/refresh.css?v=20260930a');document.head.appendChild(l)}const icon=document.querySelector('link[rel="icon"]');if(icon)icon.href=href('assets/media/brand-icon.webp');document.body.insertAdjacentHTML('afterbegin',nav());const sections=key==='overland'?'':p.sections.map(s=>`<section class="nmc-section">${s.title?`<h2 class="nmc-section-title">${esc(s.title)}</h2>`:''}${s.p.map(x=>`<p>${esc(x)}</p>`).join('')}</section>`).join('');document.querySelector('#projectPage').innerHTML=`<section class="project-shell-title"><div class="container"><div class="nmc-breadcrumb"><a href="${navHref('proyectos.html')}">Proyectos</a><span>›</span><span>${esc(p.title)}</span></div><span class="eyebrow">${esc(p.label)}</span><h1 class="display nmc-title">${esc(p.title)}</h1></div></section>${media()}${overlandMarkup()}<section class="section nmc-content-wrap project-shell-content"><div class="container nmc-layout"><article class="nmc-copy">${key==='overland'?overlandContentMarkup():key==='proyecto-y'?videos()+sections:sections}${gallery()}${key==='overland'||key==='proyecto-y'?'':videos()}${links()}<section class="nmc-section nmc-source"><span class="eyebrow">Archivo original</span><p>Esta ruta conserva la página independiente que existe en el sitio original.</p><a class="btn ghost" href="${p.source}" target="_blank" rel="noreferrer">Abrir página original ↗</a></section>${comments()}</article></div></section>`;if(key==='overland'){installOverlandStyles();initOverlandProgress();initOverlandCarousel()}document.body.insertAdjacentHTML('beforeend',footer());if(!document.querySelector('script[src*="dev-runtime.js"]')){const ds=document.createElement('script');ds.src=asset('assets/dev-runtime.js?v=10');document.body.appendChild(ds)}const menu=document.querySelector('.menu-btn'),n=document.querySelector('#navLinks');menu?.addEventListener('click',()=>{n?.classList.toggle('open');menu.setAttribute('aria-expanded',n?.classList.contains('open')?'true':'false')});if(!document.querySelector('script[data-ns-account-script]')){const accountScript=document.createElement('script');accountScript.src=new URL('accounts.js?v=20261030h',SCRIPT_URL).href;accountScript.dataset.nsAccountScript='true';document.body.appendChild(accountScript);}}
function start(){const script=document.createElement('script');const artworkUrl=new URL('project-artwork.js',SCRIPT_URL);artworkUrl.searchParams.set('v','20261012b');script.src=artworkUrl.href;script.onload=function(){Promise.resolve(window.NS_PROJECT_ARTWORK_READY).then(render)};script.onerror=render;document.head.appendChild(script)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()
})();