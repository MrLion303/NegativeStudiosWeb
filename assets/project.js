document.addEventListener('DOMContentLoaded',()=>{
  const id=new URLSearchParams(location.search).get('id');
  const project=window.NS_DATA?.projects?.find(item=>item.id===id);
  const set=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value||'—'};

  if(!project){
    set('#projectName','Proyecto no encontrado');
    set('#projectSummary','La ficha que buscas no existe o cambió de dirección.');
    const legacy=document.querySelector('#legacyLink');
    if(legacy){legacy.href='proyectos.html';legacy.textContent='Volver a proyectos';}
    return;
  }

  document.title=`${project.name} — NegativeStudios`;
  set('#projectName',project.name);
  set('#projectSummary',project.summary);
  set('#projectDescription',project.summary);
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
    document.querySelector('#collabBlock').hidden=false;
    document.querySelector('#sideCollabWrap').hidden=false;
    set('#projectCollab',`${project.collab} forma parte del contexto creativo de este proyecto.`);
    set('#sideCollab',project.collab);
  }

  if(project.details?.length){
    document.querySelector('#detailsBlock').hidden=false;
    const host=document.querySelector('#projectDetails');
    project.details.forEach(item=>{
      const section=document.createElement('section');
      section.className='project-detail';
      const title=document.createElement('h2');
      title.textContent=item.title;
      const text=document.createElement('p');
      text.textContent=item.text;
      section.append(title,text);
      host.appendChild(section);
    });
  }

  if(project.timeline?.length){
    document.querySelector('#timelineBlock').hidden=false;
    const host=document.querySelector('#projectTimeline');
    project.timeline.forEach(([title,text])=>{
      const row=document.createElement('div');
      row.className='timeline-item';
      const strong=document.createElement('strong');
      strong.textContent=title;
      const span=document.createElement('span');
      span.className='muted';
      span.textContent=text;
      row.append(strong,span);
      host.appendChild(row);
    });
  }

  if(project.videos?.length){
    document.querySelector('#videosBlock').hidden=false;
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