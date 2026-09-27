document.addEventListener('DOMContentLoaded',()=>{
  const root=window.NS_SITE_ROOT||'../../';
  const icon=document.querySelector('link[rel="icon"]');
  if(icon) icon.href=`${root}assets/media/brand-icon.webp`;

  document.querySelectorAll('.brand img').forEach(img=>{
    img.src=`${root}assets/media/brand-logo.webp`;
    img.alt='NegativeStudios';
  });

  const actions=document.querySelector('.nav-actions');
  if(actions){
    actions.innerHTML=`
      <div class="nav-socials" aria-label="Redes de NegativeStudios">
        <a class="nav-social" href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer" aria-label="NegativeStudios en X" title="X / @StudiosNegative">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
        </a>
        <a class="nav-social" href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer" aria-label="Discord de NegativeStudios" title="Discord">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8.5 11h.01M15.5 11h.01" stroke-width="2.3" stroke-linecap="round"/></svg>
        </a>
      </div>
      <a class="client-download" href="https://github.com/MrLion303/negativelauncher" target="_blank" rel="noreferrer" title="Abrir Negative Client">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>
        <span class="client-download-label">Descargar Negative Client</span>
      </a>`;
  }

  const footer=document.querySelector('.footer .container');
  if(footer && !footer.querySelector('.footer-grid')){
    footer.insertAdjacentHTML('afterbegin',`
      <div class="footer-grid">
        <div>
          <a class="brand" href="${root}index.html"><img src="${root}assets/media/brand-logo.webp" alt="NegativeStudios" width="46" height="46"><span>NegativeStudios</span></a>
          <p class="muted" style="max-width:330px;margin-top:18px">Forjamos mundos, creamos experiencias.</p>
        </div>
        <div><h4>Explorar</h4><a href="${root}proyectos.html">Proyectos</a><a href="${root}anuncios.html">Anuncios</a><a href="${root}archivo.html">Archivo legado</a></div>
        <div><h4>Estudio</h4><a href="${root}acerca.html">Acerca de</a><a href="${root}colaboradores.html">Colaboradores</a><a href="${root}contacto.html">Contacto</a></div>
        <div><h4>Comunidad</h4><a href="https://x.com/StudiosNegative" target="_blank" rel="noreferrer">X ↗</a><a href="https://discord.gg/nKxBA7qzAU" target="_blank" rel="noreferrer">Discord ↗</a><a href="mailto:contacto.negativestudios@gmail.com">Email</a><a href="${root}legal.html">Legal</a></div>
      </div>`);
  }
});
