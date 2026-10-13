(function(){
  var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
  var targetY=window.scrollY;
  var frame=0;
  var previousBehavior='';
  var root=document.documentElement;
  function restoreBehavior(){root.style.scrollBehavior=previousBehavior;}
  function stop(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    targetY=window.scrollY;
    restoreBehavior();
  }
  function canScrollInside(target,delta){
    if(!target||!target.closest)return false;
    if(target.closest('input,textarea,select,[contenteditable="true"]'))return true;
    for(var node=target;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){
      var style=window.getComputedStyle(node),overflow=style.overflowY;
      if((overflow==='auto'||overflow==='scroll'||overflow==='overlay')&&node.scrollHeight>node.clientHeight+1){
        if(delta<0&&node.scrollTop>0||delta>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1)return true;
      }
    }
    return false;
  }
  function animate(){
    var current=window.scrollY,distance=targetY-current;
    if(Math.abs(distance)<0.7){window.scrollTo(0,targetY);frame=0;restoreBehavior();return;}
    window.scrollTo(0,current+distance*0.16);
    frame=requestAnimationFrame(animate);
  }
  window.addEventListener('wheel',function(event){
    if(event.defaultPrevented||event.ctrlKey||event.deltaY===0||Math.abs(event.deltaX)>Math.abs(event.deltaY)||reducedMotion&&reducedMotion.matches)return;
    if(canScrollInside(event.target,event.deltaY))return;
    var delta=event.deltaY;
    if(event.deltaMode===1)delta*=32;
    else if(event.deltaMode===2)delta*=window.innerHeight;
    if(!frame){targetY=window.scrollY;previousBehavior=root.style.scrollBehavior;root.style.scrollBehavior='auto';}
    var max=Math.max(0,root.scrollHeight-window.innerHeight);
    var next=Math.max(0,Math.min(max,targetY+delta*1.04));
    if(next===targetY)return;
    event.preventDefault();targetY=next;
    if(!frame)frame=requestAnimationFrame(animate);
  },{passive:false});
  window.addEventListener('touchstart',stop,{passive:true});
  window.addEventListener('keydown',function(event){if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))stop();});
  window.addEventListener('resize',function(){targetY=Math.max(0,Math.min(targetY,root.scrollHeight-window.innerHeight));});
})();