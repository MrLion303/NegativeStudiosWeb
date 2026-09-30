(function(){
  var CONFIG=(document.currentScript?new URL('site-config.json',document.currentScript.src).href:'assets/site-config.json');
  function esc(v){return String(v).replace(/[^a-zA-Z0-9_-]/g,'\\$&')}
  function selector(el){
    if(!el||el.nodeType!==1)return '';
    if(el.id)return '#'+esc(el.id);
    var parts=[],cur=el;
    while(cur&&cur.nodeType===1&&cur!==document.body){
      var part=cur.tagName.toLowerCase(),cl=[];
      for(var i=0;i<cur.classList.length&&cl.length<2;i++)if(!cur.classList[i].startsWith('ns-editor-'))cl.push(esc(cur.classList[i]));
      if(cl.length)part+='.'+cl.join('.');
      var par=cur.parentElement;
      if(par){
        var same=[].filter.call(par.children,function(x){return x.tagName===cur.tagName});
        if(same.length>1)part+=':nth-of-type('+(same.indexOf(cur)+1)+')';
      }
      parts.unshift(part);cur=par;
    }
    return parts.join('>');
  }
  function pageKey(){
    var p=location.pathname.split('/').filter(Boolean);
    if(!p.length)return 'index.html';
    if(p[p.length-1]==='index.html'&&p.length>1)return p.join('/');
    return p.join('/');
  }
  function apply(cfg){
    var pc=(cfg.pages||{})[pageKey()]||{};
    var styles=pc.styles||{},text=pc.text||{},attrs=pc.attrs||{};
    Object.keys(styles).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){Object.keys(styles[s]).forEach(function(k){el.style.setProperty(k,styles[s][k])})})}catch(e){}});
    Object.keys(text).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){var v=text[s];if(v&&typeof v==='object'&&v.html!==undefined)el.innerHTML=v.html;else el.textContent=String(v)})}catch(e){}});
    Object.keys(attrs).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){Object.keys(attrs[s]).forEach(function(k){el.setAttribute(k,attrs[s][k])})})}catch(e){}});
    if(pc.customCss){var st=document.getElementById('ns-site-custom-css');if(!st){st=document.createElement('style');st.id='ns-site-custom-css';document.head.appendChild(st)}st.textContent=pc.customCss}
    (pc.blocks||[]).forEach(function(b){var host=b.host?document.querySelector(b.host):(document.querySelector('main')||document.body);if(!host||host.querySelector('[data-ns-block="'+b.id+'"]'))return;var w=document.createElement('div');w.dataset.nsBlock=b.id;w.innerHTML=b.html;host.appendChild(w)});
    (pc.order||[]).forEach(function(g){var par=document.querySelector(g.parent);if(!par)return;g.children.forEach(function(s){var n=par.querySelector(':scope>'+s);if(n)par.appendChild(n)})});
  }
  function load(){
    fetch(CONFIG+'?v='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(cfg){window.NS_EDITOR_CONFIG=cfg;apply(cfg)}).catch(function(){});
  }
  window.NSApplyEditorConfig=load;
  window.NSGetEditorSelector=selector;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();