/**
 * Mobile Touch-Handler für Chart-Interaktionen
 * Ersetzt Hover-Effekte durch explizite Touch-Events
 */
import { isMobile } from './utils.js';
import { showMobileAlbumCard } from './mobileAlbumCard.js';

/**
 * Richtet Mobile Touch-Handler für einen Chart ein
 */
export function setupMobileTouchHandlers(chartView, chartEl) {
  if (!isMobile()) return; // Nur auf Mobile
  
  console.log('Setting up mobile touch handlers', chartView, chartEl);
  
  // Verhindere Standard-Tooltips auf Mobile
  const style = document.createElement('style');
  style.id = 'mobile-tooltip-disable';
  style.textContent = `
    @media (max-width: 767px) {
      .vg-tooltip, .vega-tooltip {
        display: none !important;
      }
    }
  `;
  
  // Prüfe ob Style bereits existiert
  if (!document.getElementById('mobile-tooltip-disable')) {
    document.head.appendChild(style);
  }
  
  // Warte bis Chart vollständig gerendert ist
  setTimeout(() => {
    // Nutze Vega-Lite's Signal-API für Click-Events
    // Vega-Lite feuert 'click' Events auf der View
    if (chartView && typeof chartView.addEventListener === 'function') {
      chartView.addEventListener('click', (event, item) => {
        console.log('Vega click event:', event, item);
        if (item && item.datum) {
          event.preventDefault();
          event.stopPropagation();
          showMobileAlbumCard(item.datum);
        }
      });
    }
    
    // Zusätzlich: Direkte Click/Touch-Events auf SVG abfangen
    const svg = chartEl.querySelector('svg');
    if (svg) {
      // Nutze sowohl click als auch touchend für maximale Kompatibilität
      const handleInteraction = (e) => {
        console.log('SVG interaction:', e.type);
        
        // Finde den nächstgelegenen Datenpunkt
        const point = svg.createSVGPoint();
        if (e.type === 'touchend' && e.changedTouches) {
          point.x = e.changedTouches[0].clientX;
          point.y = e.changedTouches[0].clientY;
        } else {
          point.x = e.clientX;
          point.y = e.clientY;
        }
        
        const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
        
        // Nutze Vega-Lite's View-API um Datenpunkt zu finden
        if (chartView && chartView.scene) {
          const hitTest = chartView.scene().items.find(item => {
            // Vereinfachte Hit-Test: Prüfe ob Punkt in der Nähe ist
            return item.mark && item.mark.marktype === 'symbol';
          });
          
          if (hitTest && hitTest.datum) {
            console.log('Found datum:', hitTest.datum);
            e.preventDefault();
            e.stopPropagation();
            showMobileAlbumCard(hitTest.datum);
          }
        }
      };
      
      svg.addEventListener('click', handleInteraction);
      svg.addEventListener('touchend', handleInteraction, { passive: false });
    }
    
    // Verhindere auch mousemove Events auf Mobile (falls sie durchkommen)
    if (chartView && typeof chartView.addEventListener === 'function') {
      chartView.addEventListener('mousemove', (event, item) => {
        if (isMobile()) {
          // Entferne alle Tooltips die trotzdem erscheinen
          const tooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
          tooltips.forEach(t => t.remove());
        }
      });
    }
  }, 500); // Warte 500ms bis Chart gerendert ist
}
