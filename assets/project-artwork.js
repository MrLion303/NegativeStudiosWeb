(function(){
  var SCRIPT_URL=document.currentScript&&document.currentScript.src;
  var SITE_ROOT=SCRIPT_URL?new URL('../',SCRIPT_URL):new URL('./',location.href);
  var ARTWORK={
    overland:'assets/media/overland.webp',
    'proyecto-y':'assets/media/proyecto-y.webp',
    parasites:'assets/media/parasites.webp',
    'pdc-rebirth':'assets/uploads/1790734033685-grande.png',
    'pc-rebirth':'assets/uploads/1790734033685-grande.png',
    'negative-awards':'assets/media/negative-awards.webp',
    'negativemc':'assets/media/negativemc.webp',
    'negativemc-ep3':'assets/media/negativemc-ep3.webp',
    'negativemc-2':'assets/media/negativemc-ep3.webp',
    'proyecto-x':'assets/media/proyecto-x.webp',
    permamuerte:'assets/media/pdc-final-chapter.webp',
    'pdc-final-chapter':'assets/media/pdc-final-chapter.webp'
  };
  var ROUTE_IDS={
    'overland':['overland'],
    'proyecto-y':['proyecto-y'],
    'parasites':['parasites'],
    'pdc-rebirth':['pdc-rebirth','pc-rebirth'],
    'negative-awards':['negative-awards'],
    'negativemc-episodio-3':['negativemc-ep3','negativemc-2'],
    'proyecto-x':['proyecto-x'],
    'permamuerte':['permamuerte'],
    'pdc-final-chapter':['pdc-final-chapter']
  };
  function imageUrl(path){return /^https?:\\/\\//i.test(String(path||''))?String(path):new URL(path,SITE_ROOT).href;}
  function apply(root){
    (root||document).querySelectorAll('[data-ns-project-image]').forEach(function(image){
      var path=ARTWORK[image.getAttribute('data-ns-project-image')];
      if(path){image.src=imageUrl(path);if(!image.alt)image.alt='Portada del proyecto';}
    });
  }
  window.NS_PROJECT_ARTWORK=ARTWORK;
  window.NSApplyProjectArtwork=apply;
  window.NS_PROJECT_ARTWORK_READY=fetch(new URL('assets/site-config.json',SITE_ROOT).href+'?v='+Date.now(),{cache:'no-store'})
    .then(function(response){return response.ok?response.json():null;})
    .then(function(config){
      var pages=config&&config.pages||{};
      Object.keys(pages).forEach(function(page){
        var match=page.match(/^proyectos\\/([^/]+)\\/index\\.html$/);
        if(!match)return;
        var ids=ROUTE_IDS[match[1]];
        if(!ids)return;
        var attrs=pages[page]&&pages[page].attrs||{};
        var imageSource='';
        Object.keys(attrs).some(function(selector){
          var source=attrs[selector]&&attrs[selector].src;
          if(source&&/project-media-frame|#projectMedia/i.test(selector)){imageSource=String(source).trim();return !!imageSource;}
          return false;
        });
        if(imageSource)ids.forEach(function(id){ARTWORK[id]=imageSource;});
      });
      apply(document);
      return ARTWORK;
    })
    .catch(function(){apply(document);return ARTWORK;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){apply(document)});
  else apply(document);
})();