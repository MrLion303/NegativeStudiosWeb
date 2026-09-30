document.addEventListener('DOMContentLoaded',async()=>{
  const grid=document.querySelector('#projectGrid');
  if(!grid)return;
  try{
    if(!window.NS_DATA||!Array.isArray(window.NS_DATA.projects))return;
    try{
      const r=await fetch('assets/project-registry.json?v='+Date.now(),{cache:'no-store'});
      if(r.ok){
        const extra=await r.json();
        if(Array.isArray(extra)){
          const ids=new Set(window.NS_DATA.projects.map(x=>x.id));
          extra.forEach(x=>{if(x&&!ids.has(x.id))window.NS_DATA.projects.push({...x,legacy:x.route||'',featured:false})});
        }
      }
    }catch(e){}
    const pageRoutes={
      overland:'proyectos/overland/index.html',proyecto-y:'proyectos/proyecto-y/index.html',parasites:'proyectos/parasites/index.html',
      'jujutsu-kaisen':'proyectos/culling-games/index.html','pc-rebirth':'proyectos/pdc-rebirth/index.html','negative-awards':'proyectos/negative-awards/index.html',
      'negativemc-ep3':'proyectos/negativemc-episodio-3/index.html','proyecto-x':'proyectos/proyecto-x/index.html',permamuerte:'proyectos/permamuerte/index.html',
      'pdc-final-chapter':'proyectos/pdc-final-chapter/index.html'
    };
    const artwork={
      overland:'assets/media/overland.webp',proyecto-y:'assets/media/proyecto-y.webp',parasites:'assets/media/parasites.webp',
      negative-awards:'assets/media/negative-awards.webp',negativemc-ep3:'assets/media/negativemc-ep3.webp','negativemc-2':'assets/media/negativemc-2.webp',
      negativemc:'assets/media/negativemc.webp',proyecto-x:'assets/media/proyecto-x.webp',pc-rebirth:'assets/media/pdc-rebirth.webp',
      permamuerte:'assets/media/pdc-final-chapter.webp','pdc-final-chapter':'assets/media/pdc-final-chapter.webp'
    };
    const hiddenProjects=new Set(['caos-games','guerra-nexus','the-200-rooms','the-100-rooms']);
    grid.innerHTML='';
    let index=0;
    window.NS_DATA.projects.forEach(p=>{
      if(!p||hiddenProjects.has(p.id))return;
      const original=window.NS_ORIGINAL_CONTENT?.[p.id],art=artwork[p.id]||p.artwork||'';
      const link=document.createElement('a');link.className='card project-card reveal';link.href=pageRoutes[p.id]||p.route||`proyecto.html?id=${encodeURIComponent(p.id)}`;link.dataset.phase=p.phase||'';link.dataset.status=p.status||'';link.dataset.projectId=p.id;link.dataset.editorSelectable='project-card';
      const media=document.createElement('div');media.className='card-media'+(art?' has-image':'');
      if(art){const image=document.createElement('img');image.className='card-media-img';image.src=art;image.alt='Portada de '+p.name;image.loading='lazy';image.onerror=()=>{image.style.display='none'};media.appendChild(image)}
      const number=document.createElement('span');number.className='card-index';number.textContent=String(++index).padStart(2,'0');media.appendChild(number);
      const body=document.createElement('div');body.className='card-body';
      const pill=document.createElement('span');pill.className=`pill ${/próx|activo|desarrollo|anunciado/i.test(p.status||'')?'upcoming':''}`;pill.textContent=p.status||'';
      const title=document.createElement('h3');title.style.marginTop='14px';title.textContent=p.name||'Proyecto';
      const text=document.createElement('p');text.textContent=original?.summary||p.summary||'';
      const meta=document.createElement('div');meta.className='card-meta';const type=document.createElement('span');type.textContent=`${p.phase||''} · ${p.type||'Proyecto'}`;const year=document.createElement('span');year.textContent=`${p.year||''} ↗`;meta.append(type,year);
      body.append(pill,title,text,meta);link.append(media,body);grid.appendChild(link);
    });
    document.dispatchEvent(new Event('projects-rendered'));
  }catch(e){console.error('NegativeStudios projects:',e)}
});