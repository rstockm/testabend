/**
 * Mobile Touch-Handler für Chart-Interaktionen
 * Ersetzt Hover-Effekte durch explizite Touch-Events
 */
import { isMobile } from './utils.js';
import { showMobileAlbumCard } from './mobileAlbumCard.js';

/**
 * Extrahiert Daten aus einem Vega-Lite Tooltip
 */
function extractDataFromTooltip(tooltip) {
  const data = {};
  const rows = tooltip.querySelectorAll('tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      const value = cells[1].textContent.trim();
      
      if (key === 'band') data.Band = value;
      else if (key === 'album') data.Album = value;
      else if (key === 'jahr' || key === 'year') data.Jahr = parseInt(value) || null;
      else if (key === 'platz') data.Platz = parseInt(value) || null;
      else if (key === 'note') data.Note = parseFloat(value.replace(',', '.')) || null;
    }
  });
  
  return data;
}

/**
 * Richtet Mobile Touch-Handler für einen Chart ein
 */
export function setupMobileTouchHandlers(chartView, chartEl) {
  if (!isMobile()) return; // Nur auf Mobile
  
  console.log('Setting up mobile touch handlers', chartView, chartEl);
  
  // Verhindere Standard-Tooltips auf Mobile (werden trotzdem erstellt, aber versteckt)
  const style = document.createElement('style');
  style.id = 'mobile-tooltip-disable';
  style.textContent = `
    @media (max-width: 767px) {
      .vg-tooltip, .vega-tooltip {
        display: none !important;
        visibility: hidden !important;
      }
    }
  `;
  
  if (!document.getElementById('mobile-tooltip-disable')) {
    document.head.appendChild(style);
  }
  
  // Warte bis Chart vollständig gerendert ist
  setTimeout(() => {
    const svg = chartEl.querySelector('svg');
    if (!svg) {
      console.warn('SVG not found');
      return;
    }
    
    // Ansatz 1: Nutze Vega-Lite's Event-API (wie scatterKeyboardNav)
    if (chartView && typeof chartView.addEventListener === 'function') {
      console.log('Using Vega-Lite addEventListener');
      
      // Click-Events (funktionieren auch auf Touch)
      chartView.addEventListener('click', (event, item) => {
        console.log('Vega click event:', event, item);
        if (item && item.datum) {
          event.preventDefault();
          event.stopPropagation();
          console.log('Showing card for datum:', item.datum);
          showMobileAlbumCard(item.datum);
        }
      });
      
      // Auch mousemove abfangen (falls Touch als Mouse-Event durchkommt)
      chartView.addEventListener('mousemove', (event, item) => {
        if (item && item.datum) {
          // Verhindere Tooltip-Anzeige
          const tooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
          tooltips.forEach(t => t.remove());
        }
      });
    }
    
    // Ansatz 2: Beobachte Tooltip-Erstellung und extrahiere Daten
    // Vega-Lite erstellt Tooltips auch bei Touch, wir fangen sie ab
    let tooltipObserver = null;
    let lastTooltipData = null;
    let tooltipTimeout = null;
    
    const handleTooltipCreation = (mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tooltip = node.classList?.contains('vg-tooltip') || node.classList?.contains('vega-tooltip')
              ? node
              : node.querySelector?.('.vg-tooltip, .vega-tooltip');
            
            if (tooltip) {
              console.log('Tooltip created:', tooltip);
              
              // Extrahiere Daten aus Tooltip
              const data = extractDataFromTooltip(tooltip);
              if (data.Band && data.Album) {
                lastTooltipData = data;
                
                // Verzögere die Karten-Anzeige etwas, falls mehrere Tooltips kommen
                clearTimeout(tooltipTimeout);
                tooltipTimeout = setTimeout(() => {
                  if (lastTooltipData) {
                    console.log('Showing card from tooltip:', lastTooltipData);
                    showMobileAlbumCard(lastTooltipData);
                    lastTooltipData = null;
                  }
                }, 100);
              }
              
              // Entferne Tooltip sofort
              tooltip.remove();
            }
          }
        });
      });
    };
    
    tooltipObserver = new MutationObserver(handleTooltipCreation);
    tooltipObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Ansatz 3: Direkte SVG-Events als Fallback
    const handleSVGClick = (e) => {
      console.log('SVG click/touch:', e.type);
      
      // Wenn Vega-Lite Events nicht funktionieren, versuche Hit-Test
      if (!lastTooltipData) {
        const point = svg.createSVGPoint();
        if (e.type === 'touchend' && e.changedTouches) {
          point.x = e.changedTouches[0].clientX;
          point.y = e.changedTouches[0].clientY;
        } else {
          point.x = e.clientX;
          point.y = e.clientY;
        }
        
        const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
        console.log('SVG point:', svgPoint);
        
        // Versuche Hit-Test mit Vega-Lite's scene API
        try {
          if (chartView && chartView.scene) {
            const scene = chartView.scene();
            if (scene && scene.items) {
              console.log('Scene items:', scene.items.length);
              
              let closestItem = null;
              let minDistance = Infinity;
              
              scene.items.forEach(item => {
                if (item.mark && item.mark.marktype === 'symbol' && item.bounds) {
                  const bounds = item.bounds;
                  const centerX = (bounds.x1 + bounds.x2) / 2;
                  const centerY = (bounds.y1 + bounds.y2) / 2;
                  const distance = Math.sqrt(
                    Math.pow(svgPoint.x - centerX, 2) + Math.pow(svgPoint.y - centerY, 2)
                  );
                  
                  const withinBounds = svgPoint.x >= bounds.x1 && svgPoint.x <= bounds.x2 &&
                                       svgPoint.y >= bounds.y1 && svgPoint.y <= bounds.y2;
                  
                  if (withinBounds || distance < 100) { // Größere Toleranz
                    if (distance < minDistance) {
                      minDistance = distance;
                      closestItem = item;
                    }
                  }
                }
              });
              
              if (closestItem && closestItem.datum) {
                console.log('Found datum via hit test:', closestItem.datum);
                e.preventDefault();
                e.stopPropagation();
                showMobileAlbumCard(closestItem.datum);
              }
            }
          }
        } catch (error) {
          console.error('Hit test error:', error);
        }
      }
    };
    
    svg.addEventListener('click', handleSVGClick);
    svg.addEventListener('touchend', handleSVGClick, { passive: false });
    
    // Cleanup-Funktion (falls nötig)
    return () => {
      if (tooltipObserver) {
        tooltipObserver.disconnect();
      }
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }
    };
  }, 500); // Warte 500ms bis Chart gerendert ist
}
