(function(){
const PAGES={
  'personajes':{
    title:'Personajes',label:'Proyectos · Archivo',source:'https://sites.google.com/view/negativestudios/proyectos/personajes',sections:[]
  },
  'overland':{
    title:'OVERLAND',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/overland',
    sections:[
      {title:'TRÁILER CINEMATOGRÁFICO',p:[]},
      {title:'OVERLAND',p:['Es un SMP con cambios de dificultad, hecho para disfrutar la experiencia de Survival con Mods; contando con eventos semanales de Lore que expande el Universo Cinematográfico.','¿Estás listo para el DESAFÍO?']},
      {title:'DESARROLLO',p:['Este servidor da inicio a la Fase 2 del UCC (Universo Cinematográfico del Caos), el cual expande el Lore de los servidores de NegativeStudios y GG Studios.']},
      {title:'Teasers',p:['Teasers que fueron publicados meses antes de la salida del proyecto.']}
    ],videos:[['f4QOdfNcB0k','TRÁILER CINEMATOGRÁFICO']]
  },
  'proyecto-y':{
    title:'PROYECTO Y',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/proyecto-y',
    sections:[
      {title:'PROYECTO Y',p:['SMP secuela de Proyecto X, un servidor basado en la época medieval. Creado principalmente por el Bobiverso en colaboración con Negative.']},
      {title:'MAPA',p:['Proyecto Y cuenta con un mapa interactivo explorable, a demás de mundo abierto survival Vanilla.']},
      {title:'INVITADOS',p:['Estos son los jugadores invitados de Proyecto Y, siendo revelados en nuestras redes sociales!']},
      {title:'Evento Final',p:['Proyecto Y tuvo un evento final para terminar con su existencia. Un evento en vivo que solo pudo verse una vez en toda la historia!']}
    ],videos:[['WGDLCsLLxkw','Proyecto Y']]
  },
  'parasites':{
    title:'PARASITES',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/parasites',
    sections:[{title:'PARASITES',p:['El mundo que conocemos ha quedado infectado. Los supervivientes deberán encontrar la forma de poder devolver el mundo a la normalidad. Un evento de 6 días original en el que adaptarse es la escapatoria.']}]
  },
  'culling-games':{
    title:'CULLING GAMES',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/culling-games',
    sections:[{title:'Jujutsu Kaisen: Juego del Sacrificio',p:['Un evento basado en la Temporada 3 del anime de Jujutsu Kaisen. Un Battle Royale con técnicas ritual, donde el ganador será el último que quede en pie.','Estrenado en enero del 2026.']}]
  },
  'pdc-rebirth':{
    title:'PDC: REBIRTH',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/pdc-rebirth',
    sections:[{title:'Permadeath Casual: REBIRTH',p:['Servidor basado de Permadeath de ElRichMC, innovando con cambios de dificultad cada 5 días, últimas versiones del juego, eventos masivos, misiones, items nuevos en el juego, entre mucho más. Salió en 24 Julio y concluyó el 21 de Septiembre de 2025.']}]
  },
  'negative-awards':{
    title:'NEGATIVE AWARDS',label:'Proyecto · Fase 2',source:'https://sites.google.com/view/negativestudios/proyectos/negative-awards',
    sections:[
      {title:'CATEGORÍAS NOMINADAS EN LOS NEGATIVE AWARDS',p:['Negative Awards es un evento en el que se premia a jugadores y proyectos del estudio en diferentes categorías. Todo esto con la finalidad de agradecer públicamente a todos por su apoyo.','Las categorías mostradas en la imagen son las de esta fase. Se planea hacer premiaciones cada cambio de fase del estudio.']},
      {title:'VOTA POR TUS FAVORITOS EN LAS CATEGORÍAS DE LOS NEGATIVE AWARDS AQUÍ',p:['Tu voto será anónimo. Si apareces en las categorías, puedes votar por ti, siempre y cuando lo creas merecedor. Se premiará a la persona que protagonice algún clip o circunstancia donde no se especifique un jugador.']}
    ],videos:[['tCvdg--FYpM','Negative Awards'],['-knMbt_weY4','Negative Awards']],links:[['Formulario de votación original','https://docs.google.com/forms/d/e/1FAIpQLSedflLA6CVqzRPeQzUqE2tiJjJT9QKlD6YR30UjJw_BGVvscQ/viewform']]
  },
  'proyecto-x':{
    title:'Proyecto X',label:'Proyecto · Fase 1',source:'https://sites.google.com/view/negativestudios/proyectos/proyecto-x',
    sections:[
      {title:'Proyecto X',p:['Proyecto X fue un SMP en colaboración con la comunidad del YouTuber Bobicraft, "Bobiverso", creadores de Comandiulandia.','Este servidor comenzó como una idea de un SMP cooperativo casual, donde los jugadores tenían la regla universal de construir mega bases. Uniendo a la comunidad de NegativeStudios y Bobiverso.']},
      {title:'NegativeStudios x Bobiverso',p:['Después del éxito que fue "Permadeath Casual: Final Chapter", se reveló al público la colaboración que traería meses de diversión a la comunidad. BobiExplica, también conocido como NickSz0 y fundador de Bobiverso, se volvió la mano derecha del fundador de NegativeStudios, y financió y dirigió mayor parte del servidor.','Recuerdos de Proyecto X, fotografías tomadas por todos los miembros!']}
    ],videos:[['eIYpBYJy4b4','Recuerdos de Proyecto X']],links:[['Clip de Proyecto X en Medal','https://medal.tv/games/minecraft/clips/imt9nwqt5JFReF9Xb/d133784dJgES?invite=cr-MSw4M00sMjQzNTQwMjk4LA']]
  },
  'pdc-final-chapter':{
    title:'Permadeath Casual: Final Chapter',label:'Proyecto · Fase 1',source:'https://sites.google.com/view/negativestudios/proyectos/pdc-final-chapter',
    sections:[
      {title:'Información',p:['"Permadeath Casual: Final Chapter" fue la tercera edición de una serie de servidores del mismo nombre. Inicio el 24 de marzo de 2024 para terminar el 21 de mayo del mismo año.','No era un Permadeath común y corriente, ya que implementaba cambios de dificultad únicos y completamente originales cada 5 días.']},
      {title:'Cambios de dificultad',p:['A continuación se adjuntan los Cambios de Dificultad Originales que se pudieron ver a lo largo de la serie.']}
    ]
  }
};
const key=window.NS_PROJECT_PAGE;const p=PAGES[key];const root=window.NS_SITE_ROOT||'../../';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const href=x=>root+x;
function nav(){return `<header class="nav"><div class="container nav-inner"><a class="brand" href="${href('index.html')}"><img src="${href('assets/logo.svg')}" alt="NegativeStudios" width="36" height="36"><span>NegativeStudios</span></a><nav class="nav-links" id="navLinks"><a href="${href('index.html')}">Inicio</a><a class="active" href="${href('proyectos.html')}">Proyectos</a><a href="${href('anuncios.html')}">Anuncios</a><a href="${href('equipo.html')}">Equipo</a><a href="${href('acerca.html')}">Nosotros</a></nav><div class="nav-actions"><a class="nav-social" href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer">X</a><a class="nav-social" href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer">Discord</a><a class="nav-download" href="https://github.com/MrLion303/negativelauncher" target="_blank" rel="noreferrer">Descargar Negative Client ↗</a></div><button class="menu-btn" aria-label="Abrir navegación" aria-controls="navLinks" aria-expanded="false">☰</button></div></header>`}
function videos(){if(!p.videos?.length)return '';return `<section class="nmc-section"><span class="eyebrow">Videos</span><div class="video-grid">${p.videos.map(([id,t])=>`<article class="video-card"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}" title="${esc(t)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="video-label">${esc(t)}</div></article>`).join('')}</div></section>`}
function links(){if(!p.links?.length)return '';return `<section class="nmc-section"><span class="eyebrow">Enlaces originales</span><div class="nmc-child-grid">${p.links.map(([t,u])=>`<a class="nmc-child" href="${u}" target="_blank" rel="noreferrer"><h3>${esc(t)}</h3><span class="nmc-arrow">Abrir enlace →</span></a>`).join('')}</div></section>`}
function render(){if(!p)return;document.title=`${p.title} — NegativeStudios`;document.body.insertAdjacentHTML('afterbegin',nav());const sections=p.sections.map(s=>`<section class="nmc-section">${s.title?`<h2 class="nmc-section-title">${esc(s.title)}</h2>`:''}${s.p.map(x=>`<p>${esc(x)}</p>`).join('')}</section>`).join('');document.querySelector('#projectPage').innerHTML=`<section class="nmc-hero"><div class="container"><div class="nmc-breadcrumb"><a href="${href('proyectos.html')}">Proyectos</a><span>›</span><span>${esc(p.title)}</span></div><span class="eyebrow">${esc(p.label)}</span><h1 class="display nmc-title">${esc(p.title)}</h1></div></section><section class="section nmc-content-wrap"><div class="container nmc-layout"><article class="nmc-copy">${sections}${videos()}${links()}<section class="nmc-section nmc-source"><span class="eyebrow">Archivo original</span><p>Esta ruta conserva la página independiente que existe en el sitio original.</p><a class="btn ghost" href="${p.source}" target="_blank" rel="noreferrer">Abrir página original ↗</a></section></article><aside class="project-sidebar"><dl><dt>Sección</dt><dd>Proyectos</dd><dt>Página</dt><dd>${esc(p.title)}</dd><dt>Estructura</dt><dd>Página independiente</dd></dl></aside></div></section>`;document.body.insertAdjacentHTML('beforeend',`<footer class="footer"><div class="container"><div class="footer-bottom"><span>© 2026 NegativeStudios. Desde 2022.</span><span>Forjamos mundos, creamos experiencias.</span></div></div></footer>`);const menu=document.querySelector('.menu-btn'),n=document.querySelector('#navLinks');menu?.addEventListener('click',()=>{n?.classList.toggle('open');menu.setAttribute('aria-expanded',n?.classList.contains('open')?'true':'false')});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();