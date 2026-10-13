(function(){
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion=motionPreference.matches;
  const revealSelector='.section-head,.card,.service,.client-platform-v2,.project-media-frame,.project-sidebar,.nmc-section,.video-card,.project-gallery-card,.nmc-child,.about-social-card';
  let revealObserver=null;
  function collect(root){
    if(!root||reducedMotion)return;
    const nodes=[];
    if(root.matches&&root.matches(revealSelector))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll(revealSelector));
    nodes.forEach(function(node,index){
      if(node.dataset.nsMotionReady)return;
      node.dataset.nsMotionReady='true';
      node.classList.add('reveal');
      const siblings=node.parentElement?Array.from(node.parentElement.children).filter(function(sibling){return sibling.matches(revealSelector)}):[];
      node.style.setProperty('--ns-reveal-delay',Math.min(siblings.indexOf(node),5)*65+'ms');
      if(revealObserver)revealObserver.observe(node);else node.classList.add('in');
    });
  }
  if(!reducedMotion&&'IntersectionObserver'in window){
    revealObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){entry.target.classList.add('in');revealObserver.unobserve(entry.target);}
      });
    },{threshold:.08,rootMargin:'0px 0px -24px 0px'});
  }
  collect(document);
  if(!reducedMotion&&document.body&&'MutationObserver'in window){
    new MutationObserver(function(records){
      records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1)collect(node);});});
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(reducedMotion)return;

  let targetY=window.scrollY||document.documentElement.scrollTop||0;
  let rafId=0;
  function windowScrollTo(y){
    const root=document.documentElement;
    const previous=root.style.scrollBehavior;
    root.style.scrollBehavior='auto';
    window.scrollTo(0,y);
    root.style.scrollBehavior=previous;
  }
  function maxScroll(){return Math.max(0,document.documentElement.scrollHeight-window.innerHeight);}
  function nativeScrollCanContinue(start,delta){
    let node=start&&start.nodeType===1?start:start&&start.parentElement;
    while(node&&node!==document.body&&node!==document.documentElement){
      const style=window.getComputedStyle(node);
      if((style.overflowY==='auto'||style.overflowY==='scroll'||style.overflowY==='overlay')&&node.scrollHeight>node.clientHeight){
        if(delta<0&&node.scrollTop>0)return true;
        if(delta>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1)return true;
      }
      node=node.parentElement;
    }
    return false;
  }
  function animateScroll(){
    const current=window.scrollY||document.documentElement.scrollTop||0;
    const difference=targetY-current;
    if(Math.abs(difference)<.65){windowScrollTo(targetY);rafId=0;return;}
    windowScrollTo(current+difference*.16);
    rafId=window.requestAnimationFrame(animateScroll);
  }
  window.addEventListener('wheel',function(event){
    if(event.ctrlKey||event.shiftKey||!event.deltaY||nativeScrollCanContinue(event.target,event.deltaY))return;
    if(document.documentElement.scrollHeight<=window.innerHeight)return;
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1;
    if(!rafId)targetY=window.scrollY||document.documentElement.scrollTop||0;
    targetY=Math.max(0,Math.min(maxScroll(),targetY+event.deltaY*unit));
    if(!rafId)rafId=window.requestAnimationFrame(animateScroll);
  },{passive:false});
  window.addEventListener('keydown',function(event){
    if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){
      targetY=window.scrollY||document.documentElement.scrollTop||0;
      if(rafId){window.cancelAnimationFrame(rafId);rafId=0;}
    }
  });
  window.addEventListener('touchstart',function(){
    targetY=window.scrollY||document.documentElement.scrollTop||0;
    if(rafId){window.cancelAnimationFrame(rafId);rafId=0;}
  },{passive:true});
})();