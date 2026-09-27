document.addEventListener('DOMContentLoaded',()=>{
  const icon=document.querySelector('link[rel="icon"]');
  if(icon) icon.href='assets/media/brand-icon.webp';

  if(!document.querySelector('link[href="assets/extras.css"]')){
    const extraStyles=document.createElement('link');
    extraStyles.rel='stylesheet';
    extraStyles.href='assets/extras.css';
    document.head.appendChild(extraStyles);
  }

  document.querySelectorAll('.brand img').forEach(img=>{
    img.src='assets/media/brand-logo.webp';
    img.alt='NegativeStudios';
  });

  const canonicalProjectRoutes={
    'overland':'proyectos/overland/',
    'proyecto-y':'proyectos/proyecto-y/',
    'parasites':'proyectos/parasites/',
    'jujutsu-kaisen':'proyectos/culling-games/',
    'pc-rebirth':'proyectos/pdc-rebirth/',
    'negative-awards':'proyectos/negative-awards/',
    'negativemc-ep3':'proyectos/negativemc-episodio-3/',
    'proyecto-x':'proyectos/proyecto-x/',
    'pc-final':'proyectos/pdc-final-chapter/'
  };
  document.querySelectorAll('a[href^="proyecto.html?id="]').forEach(link=>{
    try{
      const target=new URL(link.getAttribute('href'),location.href);
      const projectId=target.searchParams.get('id');
      if(canonicalProjectRoutes[projectId]) link.href=canonicalProjectRoutes[projectId];
    }catch(_){ }
  });

  const projectArtwork={
    'OVERLAND':'assets/media/overland.webp',
    'Proyecto Y':'assets/media/proyecto-y.webp',
    'PARASITES':'assets/media/parasites.webp',
    'Negative Awards':'assets/media/negative-awards.webp',
    'NEGATIVE AWARDS':'assets/media/negative-awards.webp',
    'NegativeMC Episodio 3':'assets/media/negativemc-ep3.webp',
    'NegativeMC 2':'assets/media/negativemc-2.webp',
    'NegativeMC':'assets/media/negativemc.webp',
    'Proyecto X':'assets/media/proyecto-x.webp',
    'Permadeath Casual: REBIRTH':'assets/media/pdc-rebirth.webp',
    'PDC: REBIRTH':'assets/media/pdc-rebirth.webp',
    'Permadeath Casual: Final Chapter':'assets/media/pdc-final-chapter.webp'
  };

  const enhanceProjectCards=()=>{
    document.querySelectorAll('.card').forEach(card=>{
      const title=card.querySelector('h3')?.textContent?.trim();
      const src=projectArtwork[title];
      if(!src)return;
      const media=card.querySelector('.card-media');
      if(media&&!media.querySelector('.card-media-img')){
        const image=document.createElement('img');
        image.className='card-media-img';
        image.src=src;
        image.alt=title?`Arte oficial de ${title}`:'';
        image.loading='lazy';image.decoding='async';
        media.prepend(image);media.classList.add('has-image');
      }else if(!media){
        card.classList.add('archive-art-card');
        card.style.setProperty('--archive-art',`url("${src}")`);
      }
    });
  };
  enhanceProjectCards();
  document.addEventListener('projects-rendered',enhanceProjectCards);

  const oldCta=document.querySelector('.nav-cta');
  if(oldCta){
    const actions=document.createElement('div');
    actions.className='nav-actions';
    actions.innerHTML=`<div class="nav-socials" aria-label="Redes de NegativeStudios">
      <a class="nav-social" href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer" aria-label="NegativeStudios en X" title="X / @StudiosNegative">X</a>
      <a class="nav-social" href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer" aria-label="Discord de NegativeStudios" title="Discord">Discord</a>
    </div>
    <a class="client-download" href="descargar.html" title="Descargar Negative Client"><span class="client-download-label">Descargar Negative Client</span><span aria-hidden="true">↓</span></a>`;
    oldCta.replaceWith(actions);
  }

  const footerHTML=()=>`<footer class="footer mega-footer"><div class="container">
    <div class="mega-footer-grid">
      <div class="footer-brand-block"><a class="brand" href="index.html"><img src="assets/media/brand-logo.webp" alt="NegativeStudios" width="52" height="52"><span>NegativeStudios</span></a><p>Forjamos mundos, creamos experiencias.</p><a class="footer-download-link" href="descargar.html">Negative Client <span>→</span></a></div>
      <div><h4>Proyectos</h4><a href="proyectos.html">Todos los proyectos</a><a href="anuncios.html">Anuncios</a><a href="archivo.html">Archivo legado</a></div>
      <div><h4>Estudio</h4><a href="acerca.html">Sobre nosotros</a><a href="equipo.html">Equipo</a><a href="colaboradores.html">Colaboradores</a><a href="contacto.html">Contacto</a></div>
      <div><h4>Comunidad</h4><a href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer">Discord ↗</a><a href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer">X / Twitter ↗</a><a href="https://github.com/MrLion303" target="_blank" rel="noreferrer">GitHub ↗</a></div>
      <div><h4>Legal</h4><a href="legal.html#terminos">Términos y condiciones</a><a href="legal.html#privacidad">Política de privacidad</a><a href="mailto:contacto.negativestudios@gmail.com">Contacto legal</a></div>
    </div>
    <div class="footer-social-row" aria-label="Redes y plataformas"><a href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer">X</a><a href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer">Discord</a><a href="https://github.com/MrLion303" target="_blank" rel="noreferrer">GitHub</a><a href="https://www.youtube.com/watch?v=f4QOdfNcB0k" target="_blank" rel="noreferrer">YouTube</a><a href="https://music.apple.com/mx/artist/negativestudios/1824271796" target="_blank" rel="noreferrer">Apple Music</a><a href="https://music.amazon.com/artists/B0FGKS2XMR/negativestudios" target="_blank" rel="noreferrer">Amazon Music</a><a href="mailto:contacto.negativestudios@gmail.com">Email</a></div>
    <div class="footer-bottom"><span>© 2026 NegativeStudios. Todos los derechos reservados. Vigente desde 2022.</span><span>Forjamos mundos, creamos experiencias.</span></div>
  </div></footer>`;
  const footer=document.querySelector('.footer');
  if(footer)footer.outerHTML=footerHTML();

  const hero=document.querySelector('.hero');
  if(hero&&!document.querySelector('#featuredVideos')){
    const projectSection=document.querySelector('.marquee')?.nextElementSibling;
    const featured=document.createElement('section');
    featured.id='featuredVideos';featured.className='section featured-videos-section';
    featured.innerHTML=`<div class="container"><div class="section-head"><div><span class="eyebrow">Featured videos</span><h2 class="title" style="margin-top:14px">Historias que también<br>se viven en video.</h2></div><p class="muted">Tráilers, eventos y proyectos destacados del archivo audiovisual de NegativeStudios.</p></div><div class="featured-video-grid">
      ${[['f4QOdfNcB0k','OVERLAND','Tráiler cinematográfico'],['CIWs5OBc-h4','Universo Cinematográfico del Caos','UCC'],['Ck2ET8Ujvqk','NegativeMC Episodio 3','El Gran Final'],['WGDLCsLLxkw','Proyecto Y','Video del proyecto']].map(([id,title,meta])=>`<a class="featured-video-card reveal" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noreferrer"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${title}" loading="lazy"><span class="featured-video-play">▶</span><div><small>${meta}</small><h3>${title}</h3></div></a>`).join('')}
    </div></div>`;
    projectSection?.insertAdjacentElement('afterend',featured);

    const archive=document.createElement('section');
    archive.className='section visual-archive-section';
    archive.innerHTML=`<div class="container"><div class="section-head"><div><span class="eyebrow">Archivo visual</span><h2 class="title" style="margin-top:14px">Mundos que hemos<br>construido.</h2></div><p class="muted">Una selección de escenarios, servidores y momentos de distintas etapas de NegativeStudios.</p></div><figure class="visual-archive reveal"><img src="assets/media/visual-archive.webp" alt="Archivo visual de escenarios y proyectos de NegativeStudios" loading="lazy"><figcaption><span>2022 — 2026</span><span>Servidores · Eventos · Escenarios · Comunidad</span></figcaption></figure></div>`;
    featured.insertAdjacentElement('afterend',archive);
  }

  if(document.title.startsWith('Legal')){
    const legalHeadings=document.querySelectorAll('.prose h2');
    if(legalHeadings[0])legalHeadings[0].id='terminos';
    if(legalHeadings[1])legalHeadings[1].id='privacidad';
  }

  const menu=document.querySelector('.menu-btn');
  const nav=document.querySelector('#navLinks');
  menu?.addEventListener('click',()=>{nav?.classList.toggle('open');menu.setAttribute('aria-expanded',nav?.classList.contains('open')?'true':'false')});

  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}})},{threshold:.08});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

  const filters=document.querySelector('#filters');
  filters?.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.remove('active'));button.classList.add('active');const value=button.dataset.filter;document.querySelectorAll('.project-card').forEach(card=>{const match=value==='all'||card.dataset.phase===value||card.dataset.status===value;card.style.display=match?'':'none'})});
});
