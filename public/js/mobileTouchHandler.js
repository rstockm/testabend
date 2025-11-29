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
    const svg = chartEl.querySelector('svg');
    if (!svg || !chartView) {
      console.warn('Chart not ready for mobile handlers');
      return;
    }
    
    // Nutze Vega-Lite's View-API für Hit-Testing
    // Vega-Lite bietet eine `scene()` Methode für Hit-Testing
    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Berechne Koordinaten relativ zum SVG
      const point = svg.createSVGPoint();
      if (e.type === 'touchend' && e.changedTouches) {
        point.x = e.changedTouches[0].clientX;
        point.y = e.changedTouches[0].clientY;
      } else {
        point.x = e.clientX;
        point.y = e.clientY;
      }
      
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
      
      // Nutze Vega-Lite's Hit-Test API
      try {
        // Vega-Lite View hat eine `scene()` Methode die Items zurückgibt
        const scene = chartView.scene();
        if (scene) {
          // Finde alle Items an dieser Position
          const items = scene.items || [];
          
          // Finde den nächstgelegenen Punkt (symbol mark)
          let closestItem = null;
          let minDistance = Infinity;
          
          items.forEach(item => {
            if (item.mark && item.mark.marktype === 'symbol' && item.bounds) {
              const bounds = item.bounds;
              const centerX = (bounds.x1 + bounds.x2) / 2;
              const centerY = (bounds.y1 + bounds.y2) / 2;
              const distance = Math.sqrt(
                Math.pow(svgPoint.x - centerX, 2) + Math.pow(svgPoint.y - centerY, 2)
              );
              
              // Prüfe ob innerhalb der Bounds oder sehr nah dran
              const withinBounds = svgPoint.x >= bounds.x1 && svgPoint.x <= bounds.x2 &&
                                   svgPoint.y >= bounds.y1 && svgPoint.y <= bounds.y2;
              
              if (withinBounds || distance < 50) { // 50px Toleranz
                if (distance < minDistance) {
                  minDistance = distance;
                  closestItem = item;
                }
              }
            }
          });
          
          if (closestItem && closestItem.datum) {
            console.log('Found datum:', closestItem.datum);
            showMobileAlbumCard(closestItem.datum);
          } else {
            console.log('No datum found at', svgPoint);
          }
        }
      } catch (error) {
        console.error('Error in hit test:', error);
      }
    };
    
    // Event-Listener hinzufügen
    svg.addEventListener('click', handleClick);
    svg.addEventListener('touchend', handleClick, { passive: false });
    
    // Verhindere Tooltips auf Mobile
    const removeTooltips = () => {
      const tooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
      tooltips.forEach(t => t.remove());
    };
    
    // Observer für Tooltip-Erstellung
    const observer = new MutationObserver(removeTooltips);
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Auch bei mousemove entfernen (falls durchkommt)
    svg.addEventListener('mousemove', removeTooltips);
  }, 500); // Warte 500ms bis Chart gerendert ist
}
