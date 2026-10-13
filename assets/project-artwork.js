(function(){
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
  window.NS_PROJECT_ARTWORK=ARTWORK;
  window.NSApplyProjectArtwork=function(root){
    (root||document).querySelectorAll('[data-ns-project-image]').forEach(function(image){
      var path=ARTWORK[image.getAttribute('data-ns-project-image')];
      if(path){image.src=path;if(!image.alt)image.alt='Portada del proyecto';}
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){window.NSApplyProjectArtwork(document)});
  else window.NSApplyProjectArtwork(document);
})();