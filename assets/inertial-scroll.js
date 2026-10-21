(function(){
  'use strict';
  // Intencionalmente no se interceptan wheel, touchmove ni eventos de teclado.
  // El navegador conserva su desplazamiento nativo para evitar bloqueos o bucles
  // de animación cuando cambia la altura del contenido durante el scroll.
  document.documentElement.dataset.nsNativeScroll = 'true';
})();
