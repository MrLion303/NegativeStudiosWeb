(function(){
  var CONFIG=(document.currentScript?new URL('site-config.json',document.currentScript.src).href:'assets/site-config.json');
  // Dejamos que el navegador gestione el scroll de forma nativa. El desplazamiento inercial personalizado interceptaba la rueda y podía dejar la página aparentemente bloqueada.
  function esc(v){return String(v).replace(/[^a-zA-Z0-9_-]/g,'\\$&')}
  function selector(el){
    if(!el||el.nodeType!==1)return '';
    if(el.dataset&&el.dataset.nsLayoutId)return '[data-ns-layout-id="'+esc(el.dataset.nsLayoutId)+'"]';
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
    var root=new URL('.',CONFIG).pathname.replace(/\/$/,'');
    var path=location.pathname;
    if(root&&path.indexOf(root+'/')===0)path=path.slice(root.length+1);
    else if(root&&path===root)path='';
    if(path.charAt(0)==='/')path=path.slice(1);
    if(!path)return 'index.html';
    return path;
  }
  var ART=window.NS_PROJECT_ARTWORK||{};
  function assetUrl(path){path=String(path||'');return path.indexOf('http://')===0||path.indexOf('https://')===0?path:new URL('../'+path,CONFIG).href;}
  function resolveProjectImages(){
    var nodes=[].slice.call(document.querySelectorAll('[data-ns-project-image]'));if(!nodes.length)return;
    function hasEditorImage(img){
      try{
        var cfg=window.NS_EDITOR_CONFIG||{},pc=(cfg.pages||{})[pageKey()]||{},attrs=pc.attrs||{},s=selector(img);
        return !!(attrs[s]&&Object.prototype.hasOwnProperty.call(attrs[s],'src')&&String(attrs[s].src||'').trim());
      }catch(e){return false}
    }
    nodes.forEach(function(img){
      var id=img.getAttribute('data-ns-project-image'),path=ART[id];
      if(path&&!hasEditorImage(img)&&!img.getAttribute('src'))img.src=assetUrl(path);
    });
    fetch(assetUrl('assets/project-registry.json')+'?v='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():[]}).then(function(list){
      (list||[]).forEach(function(p){nodes.filter(function(n){return n.getAttribute('data-ns-project-image')===p.id}).forEach(function(n){if(!hasEditorImage(n)&&p.artwork)n.src=assetUrl(p.artwork);if(p.name&&!n.alt)n.alt='Portada de '+p.name})});
    }).catch(function(){});
  }
  function apply(cfg){
    var global=cfg.global||{};
    if(global.customCss){var gst=document.getElementById('ns-global-custom-css');if(!gst){gst=document.createElement('style');gst.id='ns-global-custom-css';document.head.appendChild(gst)}gst.textContent=global.customCss}
    var pc=(cfg.pages||{})[pageKey()]||{};
    function applyLayoutIds(){
      (pc.layoutIds||[]).forEach(function(item){
        try{
          if(document.querySelector('[data-ns-layout-id="'+esc(item.id)+'"]'))return;
          var node=document.querySelector(item.selector);
          if(node)node.dataset.nsLayoutId=item.id;
        }catch(e){}
      });
    }
    // Los identificadores estables se aplican antes de modificar estilos y estructura.
    applyLayoutIds();
    (pc.blocks||[]).forEach(function(b){
      var host=b.host?document.querySelector(b.host):(document.querySelector('main')||document.body);
      if(!host||host.querySelector('[data-ns-editor-block="'+b.id+'"],[data-ns-block="'+b.id+'"]'))return;
      var w=document.createElement('div');w.dataset.nsBlock=b.id;w.dataset.nsEditorBlock=b.id;w.innerHTML=b.html;
      var ref=Number.isInteger(b.index)?host.children[b.index]||null:null;
      host.insertBefore(w,ref);
    });
    (pc.clones||[]).forEach(function(b){
      var host=b.host?document.querySelector(b.host):(document.querySelector('main')||document.body);
      if(!host||host.querySelector('[data-ns-editor-clone-id="'+b.id+'"]'))return;
      var t=document.createElement('template');t.innerHTML=(b.html||'').trim();var n=t.content.firstElementChild;if(!n)return;
      n.dataset.nsEditorCloneId=b.id;var ref=host.children[b.index]||null;host.insertBefore(n,ref);
    });
    applyLayoutIds();
    var styles=pc.styles||{},text=pc.text||{},attrs=pc.attrs||{};
    Object.keys(styles).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){Object.keys(styles[s]).forEach(function(k){el.style.setProperty(k,styles[s][k])})})}catch(e){}});
    Object.keys(text).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){var v=text[s];if(v&&typeof v==='object'&&v.html!==undefined)el.innerHTML=v.html;else el.textContent=String(v)})}catch(e){}});
    Object.keys(attrs).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){Object.keys(attrs[s]).forEach(function(k){el.setAttribute(k,attrs[s][k])})})}catch(e){}});
    if(pc.customCss){var st=document.getElementById('ns-site-custom-css');if(!st){st=document.createElement('style');st.id='ns-site-custom-css';document.head.appendChild(st)}st.textContent=pc.customCss}
    (pc.deleted||[]).forEach(function(s){try{document.querySelectorAll(s).forEach(function(el){el.style.setProperty('visibility','hidden','important')})}catch(e){}});
    resolveProjectImages();
    (pc.order||[]).forEach(function(g){
      var par=document.querySelector(g.parent);if(!par)return;
      var nodes=(g.children||[]).map(function(selector){
        try{return par.querySelector(':scope>'+selector)||document.querySelector(selector)}catch(e){return null}
      }).filter(function(node){return node&&node.parentElement===par});
      nodes.forEach(function(node){par.appendChild(node)});
    });
  }
  function load(){
    function loadConfig(){fetch(CONFIG+'?v='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(cfg){window.NS_EDITOR_CONFIG=cfg;apply(cfg)}).catch(function(){});}
    if(window.NS_PROJECT_ARTWORK){Promise.resolve(window.NS_PROJECT_ARTWORK_READY).then(loadConfig);return;}
    var artwork=document.createElement('script');artwork.src=new URL('project-artwork.js',CONFIG).href;artwork.onload=function(){ART=window.NS_PROJECT_ARTWORK||ART;Promise.resolve(window.NS_PROJECT_ARTWORK_READY).then(loadConfig);};artwork.onerror=loadConfig;document.head.appendChild(artwork);
  }
  window.NSApplyEditorConfig=load;
  window.NSGetEditorSelector=selector;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();