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
  
  // Nutze Click-Events (funktionieren auch auf Touch)
  chartView.addEventListener('click', (event, item) => {
    if (item && item.datum) {
      event.preventDefault();
      event.stopPropagation();
      showMobileAlbumCard(item.datum);
    }
  });
  
  // Verhindere auch mousemove Events auf Mobile (falls sie durchkommen)
  chartView.addEventListener('mousemove', (event, item) => {
    if (isMobile()) {
      // Entferne alle Tooltips die trotzdem erscheinen
      const tooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
      tooltips.forEach(t => t.remove());
    }
  });
}

