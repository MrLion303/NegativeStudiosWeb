document.addEventListener('DOMContentLoaded',()=>{
  const grid=document.querySelector('#projectGrid');
  if(!grid||!window.NS_DATA)return;
  const pageRoutes={
    'overland':'proyectos/overland/index.html',
    'proyecto-y':'proyectos/proyecto-y/index.html',
    'parasites':'proyectos/parasites/index.html',
    'jujutsu-kaisen':'proyectos/culling-games/index.html',
    'pc-rebirth':'proyectos/pdc-rebirth/index.html',
    'negative-awards':'proyectos/negative-awards/index.html',
    'negativemc-ep3':'proyectos/negativemc-episodio-3/index.html',
    'proyecto-x':'proyectos/proyecto-x/index.html'
  };
  const artwork={
    'overland':'https://lh3.googleusercontent.com/d/1c3Olfch4Z7sxE2tTDgSHmCzhmhDM_amM=w3000',
    'proyecto-y':'https://drive.google.com/thumbnail?id=1_JC_6D1aLbyn9QzBG3ZPCZEhKrKUikLl&sz=w4000',
    'parasites':'https://drive.google.com/thumbnail?id=1aWDnR3Zq1jYY8JZyXGQnftHPXkl2zW6a&sz=w4000',
    'negative-awards':'https://drive.google.com/thumbnail?id=1L5rhrQESm1KuHehaRb_DLA1iGiuKfFCJ&sz=w4000',
    'negativemc-ep3':'assets/media/negativemc-ep3.webp',
    'negativemc-2':'assets/media/negativemc-2.webp',
    'negativemc':'assets/media/negativemc.webp',
    'proyecto-x':'https://drive.google.com/thumbnail?id=1o17IKUnh84JE1b5Fh52_wJxhNVWXAFzl&sz=w4000',
    'caos-games':'https://lh3.googleusercontent.com/d/18LamdjHDQ1AH2S5B78c50ndQpluWftOM=w3000',
    'pc-rebirth':'https://lh3.googleusercontent.com/d/1qDIaslDrscW1VV2Z6ayqiAlBlK-hdFb=w3000',
    'permamuerte':'https://lh3.googleusercontent.com/d/1e8bXb9B_pTYv13sGfOhAEpBD8E0K955F=w3000'
  };
  const hiddenProjects=new Set(['caos-games','guerra-nexus','the-200-rooms','the-100-rooms']);
  let visibleIndex=0;
  window.NS_DATA.projects.forEach((p)=>{
    if(hiddenProjects.has(p.id))return;
    const index=visibleIndex++;
    const original=window.NS_ORIGINAL_CONTENT?.[p.id];
    const link=document.createElement('a');
    link.className='card project-card reveal';
    link.href=pageRoutes[p.id]||`proyecto.html?id=${encodeURIComponent(p.id)}`;
    link.dataset.phase=p.phase;
    link.dataset.status=p.status;
    const media=document.createElement('div');
    media.className=`card-media${artwork[p.id]?' has-image':''}`;
    if(artwork[p.id]){
      const image=document.createElement('img');
      image.className='card-media-img';
      image.src=artwork[p.id];
      image.alt=`Portada de ${p.name}`;
      image.loading='lazy';
      media.appendChild(image);
    }
    const number=document.createElement('span');
    number.className='card-index';
    number.textContent=String(index+1).padStart(2,'0');
    media.appendChild(number);
    const body=document.createElement('div');
    body.className='card-body';
    const pill=document.createElement('span');
    pill.className=`pill ${/próx|activo|desarrollo|anunciado/i.test(p.status)?'upcoming':''}`;
    pill.textContent=p.status;
    const title=document.createElement('h3');
    title.style.marginTop='14px';
    title.textContent=p.name;
    const text=document.createElement('p');
    text.textContent=original?.summary||p.summary;
    const meta=document.createElement('div');
    meta.className='card-meta';
    const type=document.createElement('span');
    type.textContent=`${p.phase} · ${p.type}`;
    const year=document.createElement('span');
    year.textContent=`${p.year} ↗`;
    meta.append(type,year);
    body.append(pill,title,text,meta);
    link.append(media,body);
    grid.appendChild(link);
  });
  document.dispatchEvent(new Event('projects-rendered'));
});
