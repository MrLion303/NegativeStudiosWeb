document.addEventListener('DOMContentLoaded',()=>{
  const icon=document.querySelector('link[rel="icon"]');
  if(icon) icon.href='assets/brand-mark.png';

  if(!document.querySelector('link[href="assets/extras.css"]')){
    const extraStyles=document.createElement('link');
    extraStyles.rel='stylesheet';
    extraStyles.href='assets/extras.css';
    document.head.appendChild(extraStyles);
  }

  const oldCta=document.querySelector('.nav-cta');
  if(oldCta){
    const actions=document.createElement('div');
    actions.className='nav-actions';
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
    oldCta.replaceWith(actions);
  }

  const menu=document.querySelector('.menu-btn');
  const nav=document.querySelector('#navLinks');
  menu?.addEventListener('click',()=>{
    nav?.classList.toggle('open');
    menu.setAttribute('aria-expanded',nav?.classList.contains('open')?'true':'false');
  });

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.08});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

  const filters=document.querySelector('#filters');
  filters?.addEventListener('click',event=>{
    const button=event.target.closest('[data-filter]');
    if(!button)return;
    document.querySelectorAll('[data-filter]').forEach(el=>el.classList.remove('active'));
    button.classList.add('active');
    const value=button.dataset.filter;
    document.querySelectorAll('.project-card').forEach(card=>{
      const match=value==='all'||card.dataset.phase===value||card.dataset.status===value;
      card.style.display=match?'':'none';
    });
  });
});
