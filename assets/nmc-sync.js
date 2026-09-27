(function(){
  const root=window.NS_SITE_ROOT||'../../';
  const key=window.NMC_PAGE||'main';
  const href=path=>root+path;
  const socialNav=`<div class="nav-socials" aria-label="Redes de NegativeStudios"><a class="nav-social" href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer" aria-label="NegativeStudios en X" title="X / @StudiosNegative"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg></a><a class="nav-social" href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer" aria-label="Discord de NegativeStudios" title="Discord"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8.5 11h.01M15.5 11h.01" stroke-width="2.3" stroke-linecap="round"/></svg></a></div><a class="client-download" href="https://github.com/MrLion303/negativelauncher" target="_blank" rel="noreferrer" title="Abrir Negative Client"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg><span class="client-download-label">Descargar Negative Client</span></a>`;
  function footer(){return `<footer class="footer"><div class="container"><div class="footer-grid"><div><a class="brand" href="${href('index.html')}"><img src="${href('assets/media/brand-logo.webp')}" alt="NegativeStudios" width="46" height="46"><span>NegativeStudios</span></a><p class="muted" style="max-width:330px;margin-top:18px">Forjamos mundos, creamos experiencias.</p></div><div><h4>Explorar</h4><a href="${href('proyectos.html')}">Proyectos</a><a href="${href('anuncios.html')}">Anuncios</a><a href="${href('archivo.html')}">Archivo legado</a></div><div><h4>Estudio</h4><a href="${href('acerca.html')}">Acerca de</a><a href="${href('colaboradores.html')}">Colaboradores</a><a href="${href('contacto.html')}">Contacto</a></div><div><h4>Comunidad</h4><a href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer">X ↗</a><a href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer">Discord ↗</a><a href="mailto:contacto.negativestudios@gmail.com">Email</a><a href="${href('legal.html')}">Legal</a></div></div><div class="footer-bottom"><span>© 2026 NegativeStudios. Desde 2022.</span><span>Forjamos mundos, creamos experiencias.</span></div></div></footer>`}
  function sync(){
    const icon=document.querySelector('link[rel="icon"]');
    if(icon)icon.href=href('assets/media/brand-icon.webp');
    document.querySelectorAll('.brand img').forEach(img=>{img.src=href('assets/media/brand-logo.webp');img.alt='NegativeStudios'});
    const actions=document.querySelector('.nav-actions');
    if(actions)actions.innerHTML=socialNav;
    const hero=document.querySelector('.nmc-hero');
    if(hero){
      hero.classList.add('project-shell-title');
      if(!document.querySelector('.project-media-band')){
        const title=document.querySelector('.nmc-title')?.textContent?.trim()||'NegativeMC Episodio 3';
        const media=document.createElement('section');
        media.className='project-media-band';
        media.innerHTML=`<div class="container"><div class="project-media-frame${key==='main'?'':' project-media-subpage'}"><img src="${href('assets/media/negativemc-ep3.webp')}" alt="NegativeMC Episodio 3"><div class="project-media-caption"><span class="pill">${key==='main'?'NegativeMC Episodio 3':title}</span></div></div></div>`;
        hero.insertAdjacentElement('afterend',media);
      }
    }
    document.querySelector('.nmc-content-wrap')?.classList.add('project-shell-content');
    const oldFooter=document.querySelector('.footer');
    if(oldFooter&&!oldFooter.querySelector('.footer-grid'))oldFooter.outerHTML=footer();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(sync));else requestAnimationFrame(sync);
})();