/**
 * Mobile Touch-Handler für Chart-Interaktionen
 * Ersetzt Hover-Effekte durch explizite Touch-Events
 */
import { isMobile } from './utils.js';
import { showMobileAlbumCard, setAlbumDataForSwipe } from './mobileAlbumCard.js';

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
 * @param {Object} chartView - Vega-Lite Chart View
 * @param {HTMLElement} chartEl - Chart Container Element
 * @param {Array} albumData - Optionale Album-Daten für Swipe-Funktionalität
 */
export function setupMobileTouchHandlers(chartView, chartEl, albumData = null) {
  // Setze Album-Daten für Swipe-Funktionalität
  if (albumData) {
    setAlbumDataForSwipe(albumData);
  }
  if (!isMobile()) return; // Nur auf Mobile
  
  try {
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
      try {
        let attempts = 0;
        const maxAttempts = 20;
        
        const trySetup = () => {
          attempts++;
          let svg = chartEl.querySelector('svg');
          
          // Falls nicht gefunden, suche auch in allen Kindern
          if (!svg && chartEl.children.length > 0) {
            for (const child of chartEl.children) {
              svg = child.querySelector('svg') || (child.tagName === 'SVG' ? child : null);
              if (svg) break;
            }
          }
          
          if (!svg) {
            if (attempts < maxAttempts) {
              setTimeout(trySetup, 200);
              return;
            } else {
              console.warn('[MobileTouchHandler] SVG not found after multiple attempts');
              return;
            }
          }
          
          // Nutze Vega-Lite's Event-API
          if (chartView && typeof chartView.addEventListener === 'function') {
            // Click-Events (funktionieren auch auf Touch)
            chartView.addEventListener('click', (event, item) => {
              // Nur anzeigen, wenn wirklich ein Datum vorhanden ist (Punkt getroffen)
              if (item && item.datum && item.datum.Band && item.datum.Album) {
                event.preventDefault();
                event.stopPropagation();
                try {
                  showMobileAlbumCard(item.datum);
                } catch (error) {
                  console.error('[MobileTouchHandler] Error calling showMobileAlbumCard:', error);
                }
              }
            });
            
            // Auch touchstart direkt abfangen (falls click nicht funktioniert)
            chartView.addEventListener('touchstart', (event, item) => {
              // Nur anzeigen, wenn wirklich ein Datum vorhanden ist (Punkt getroffen)
              if (item && item.datum && item.datum.Band && item.datum.Album) {
                event.preventDefault();
                event.stopPropagation();
                try {
                  showMobileAlbumCard(item.datum);
                } catch (error) {
                  console.error('[MobileTouchHandler] Error calling showMobileAlbumCard:', error);
                }
              }
            });
          }
          
          // Fallback: Beobachte Tooltip-Erstellung und extrahiere Daten
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
                    // Extrahiere Daten aus Tooltip
                    const data = extractDataFromTooltip(tooltip);
                    
                    // Nur Card anzeigen, wenn vollständige Daten vorhanden sind
                    if (data.Band && data.Album && (data.Jahr != null || data.Note != null)) {
                      lastTooltipData = data;
                      
                      // Verzögere die Karten-Anzeige etwas, falls mehrere Tooltips kommen
                      clearTimeout(tooltipTimeout);
                      tooltipTimeout = setTimeout(() => {
                        if (lastTooltipData && lastTooltipData.Band && lastTooltipData.Album) {
                          showMobileAlbumCard(lastTooltipData);
                          lastTooltipData = null;
                        }
                      }, 100);
                    } else {
                      // Entferne Tooltip ohne Card anzuzeigen
                      tooltip.remove();
                    }
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
        };
        
        // Starte Setup-Versuch
        trySetup();
      } catch (error) {
        console.error('[MobileTouchHandler] Setup error:', error);
      }
    }, 100);
  } catch (error) {
    console.error('[MobileTouchHandler] Fatal error:', error);
  }
}

