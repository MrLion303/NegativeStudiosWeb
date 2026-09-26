document.addEventListener('DOMContentLoaded',()=>{
  const id=new URLSearchParams(location.search).get('id');
  const project=window.NS_DATA?.projects?.find(item=>item.id===id);
  const original=window.NS_ORIGINAL_CONTENT?.[id];
  const set=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value||'—'};

  if(!project){
    set('#projectName','Proyecto no encontrado');
    set('#projectSummary','La ficha que buscas no existe o cambió de dirección.');
    const legacy=document.querySelector('#legacyLink');
    if(legacy){legacy.href='proyectos.html';legacy.textContent='Volver a proyectos';}
    return;
  }

  document.title=`${project.name} — NegativeStudios`;
  const summary=original?.summary||project.summary;
  set('#projectName',project.name);
  set('#projectSummary',summary);
  set('#projectStatus',project.status);
  set('#projectPhase',project.phase);
  set('#projectType',project.type);
  set('#sideStatus',project.status);
  set('#sideType',project.type);
  set('#sidePhase',project.phase);
  set('#sidePeriod',project.dates||project.year);

  const legacy=document.querySelector('#legacyLink');
  if(legacy) legacy.href=project.legacy||'proyectos.html';

  if(project.collab){
    document.querySelector('#sideCollabWrap').hidden=false;
    set('#sideCollab',project.collab);
  }

  const contentHost=document.querySelector('#projectOriginalContent');
  const renderSection=(section,{subsection=false}={})=>{
    const block=document.createElement('section');
    block.className=subsection?'original-section original-section--nested':'original-section';
    if(section.title){
      const heading=document.createElement(subsection?'h3':'h2');
      heading.textContent=section.title;
      block.appendChild(heading);
    }
    (section.paragraphs||[]).forEach(copy=>{
      const p=document.createElement('p');
      p.textContent=copy;
      block.appendChild(p);
    });
    return block;
  };

  if(contentHost){
    if(original?.sections?.length){
      original.sections.forEach(section=>contentHost.appendChild(renderSection(section)));
    }else{
      const p=document.createElement('p');
      p.textContent=project.summary;
      contentHost.appendChild(p);
    }

    if(original?.subpages?.length){
      const divider=document.createElement('div');
      divider.className='original-interiors-heading';
      const eyebrow=document.createElement('span');
      eyebrow.className='eyebrow';
      eyebrow.textContent='Interiores del proyecto';
      const title=document.createElement('h2');
      title.textContent='Páginas y eventos originales';
      divider.append(eyebrow,title);
      contentHost.appendChild(divider);

      original.subpages.forEach((subpage,index)=>{
        const article=document.createElement('section');
        article.className='original-subpage';
        article.id=`interior-${index+1}`;
        const kicker=document.createElement('span');
        kicker.className='original-subpage-kicker';
        kicker.textContent=String(index+1).padStart(2,'0');
        const heading=document.createElement('h2');
        heading.className='original-subpage-title';
        heading.textContent=subpage.title;
        article.append(kicker,heading);
        (subpage.sections||[]).forEach(section=>article.appendChild(renderSection(section,{subsection:true})));
        contentHost.appendChild(article);
      });
    }
  }

  if(project.videos?.length){
    const videosBlock=document.querySelector('#videosBlock');
    videosBlock.hidden=false;
    const host=document.querySelector('#projectVideos');
    project.videos.forEach(video=>{
      const card=document.createElement('article');
      card.className='video-card';
      const frame=document.createElement('div');
      frame.className='video-frame';
      const iframe=document.createElement('iframe');
      iframe.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`;
      iframe.title=video.title||`${project.name} — video`;
      iframe.loading='lazy';
      iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen=true;
      const label=document.createElement('div');
      label.className='video-label';
      label.textContent=video.title||'Video oficial';
      frame.appendChild(iframe);
      card.append(frame,label);
      host.appendChild(card);
    });
  }
});
