/**
 * Mobile Touch-Handler für Chart-Interaktionen
 * Ersetzt Hover-Effekte durch explizite Touch-Events
 */
import { isMobile } from './utils.js';
import { showMobileAlbumCard } from './mobileAlbumCard.js';

/**
 * Visueller Debug-Modus (zeigt Events auf dem Bildschirm)
 */
let debugMode = false; // Deaktiviert für Produktion
let debugOverlay = null;

function showDebugMessage(message, color = '#ff6b35') {
  if (!debugMode) return;
  
  try {
    if (!debugOverlay) {
      debugOverlay = document.createElement('div');
      debugOverlay.style.cssText = `
        position: fixed;
        top: 100px;
        left: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 12px;
        font-family: monospace;
        z-index: 10000;
        max-height: 200px;
        overflow-y: auto;
        pointer-events: none;
      `;
      document.body.appendChild(debugOverlay);
    }
    
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.style.color = color;
    logEntry.textContent = `[${time}] ${message}`;
    debugOverlay.appendChild(logEntry);
    
    // Behalte nur die letzten 10 Einträge
    while (debugOverlay.children.length > 10) {
      debugOverlay.removeChild(debugOverlay.firstChild);
    }
    
    // Scroll nach unten
    debugOverlay.scrollTop = debugOverlay.scrollHeight;
  } catch (error) {
    console.error('Debug message error:', error);
  }
}

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
  
  try {
    showDebugMessage('Setting up mobile touch handlers', '#4a9dd4');
    
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
      showDebugMessage('Tooltip-disable style added', '#90EE90');
    }
    
    // Warte bis Chart vollständig gerendert ist - mehrere Versuche
    setTimeout(() => {
      try {
        let attempts = 0;
        const maxAttempts = 20; // Erhöht von 10 auf 20
        
        const trySetup = () => {
          attempts++;
          // Suche SVG direkt oder in verschachtelten Elementen
          let svg = chartEl.querySelector('svg');
          
          // Falls nicht gefunden, suche auch in allen Kindern
          if (!svg && chartEl.children.length > 0) {
            for (const child of chartEl.children) {
              svg = child.querySelector('svg') || (child.tagName === 'SVG' ? child : null);
              if (svg) break;
            }
          }
          
          // Prüfe auch auf Canvas (Fallback, sollte nicht mehr vorkommen mit SVG-Renderer)
          const canvas = chartEl.querySelector('canvas');
          
          if (!svg && !canvas) {
            // Detaillierte Debug-Info über Chart-Struktur (nur beim ersten Versuch)
            if (attempts === 1) {
              showDebugMessage(`ChartEl: ${chartEl ? chartEl.tagName : 'null'}`, '#888');
              showDebugMessage(`Children: ${chartEl ? chartEl.children.length : 0}`, '#888');
              if (chartEl && chartEl.children.length > 0) {
                Array.from(chartEl.children).forEach((child, i) => {
                  showDebugMessage(`Child ${i}: ${child.tagName}, classes: ${child.className}`, '#888');
                  const childSvg = child.querySelector('svg');
                  const childCanvas = child.querySelector('canvas');
                  if (childSvg) {
                    showDebugMessage(`  -> SVG found in child ${i}!`, '#90EE90');
                  }
                  if (childCanvas) {
                    showDebugMessage(`  -> Canvas found in child ${i}!`, '#ffaa00');
                  }
                });
              }
            }
            
            if (attempts < maxAttempts) {
              showDebugMessage(`Waiting for SVG/Canvas... (${attempts}/${maxAttempts})`, '#ffaa00');
              setTimeout(trySetup, 200);
              return;
            } else {
              showDebugMessage('ERROR: SVG/Canvas not found after multiple attempts', '#ff0000');
              showDebugMessage(`ChartEl: ${chartEl ? chartEl.tagName : 'null'}, children: ${chartEl ? chartEl.children.length : 0}`, '#ff0000');
              return;
            }
          }
          
          // Canvas gefunden (Fallback - sollte nicht mehr vorkommen)
          if (!svg && canvas) {
            showDebugMessage('WARNING: Canvas found instead of SVG!', '#ffaa00');
            showDebugMessage('Using Vega-Lite event API for Canvas...', '#4a9dd4');
            // Für Canvas nutzen wir nur die Vega-Lite Event API
            if (chartView && typeof chartView.addEventListener === 'function') {
              chartView.addEventListener('click', (event, item) => {
                if (item && item.datum) {
                  event.preventDefault();
                  event.stopPropagation();
                  showMobileAlbumCard(item.datum);
                }
              });
              showDebugMessage('Canvas event listeners added', '#90EE90');
            }
            return;
          }
          
          showDebugMessage(`SVG found after ${attempts} attempts!`, '#90EE90');
          
          // Ansatz 1: Nutze Vega-Lite's Event-API (wie scatterKeyboardNav)
          if (chartView && typeof chartView.addEventListener === 'function') {
            showDebugMessage('Using Vega-Lite addEventListener', '#4a9dd4');
            
            // Click-Events (funktionieren auch auf Touch)
            chartView.addEventListener('click', (event, item) => {
              showDebugMessage(`Vega click: item=${!!item}, datum=${!!(item?.datum)}`, '#ff6b35');
              if (item && item.datum) {
                event.preventDefault();
                event.stopPropagation();
                showDebugMessage(`Showing card: ${item.datum.Band} - ${item.datum.Album}`, '#90EE90');
                showMobileAlbumCard(item.datum);
              } else {
                showDebugMessage('Vega click but no datum', '#ffaa00');
              }
            });
            
            // Auch mousemove abfangen (falls Touch als Mouse-Event durchkommt)
            chartView.addEventListener('mousemove', (event, item) => {
              if (item && item.datum) {
                showDebugMessage(`Vega mousemove: ${item.datum.Band}`, '#888');
                // Verhindere Tooltip-Anzeige
                const tooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
                tooltips.forEach(t => t.remove());
              }
            });
          } else {
            showDebugMessage('ERROR: chartView.addEventListener not available', '#ff0000');
          }
          
          // Ansatz 2: Beobachte Tooltip-Erstellung und extrahiere Daten
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
                    showDebugMessage('Tooltip created!', '#ff6b35');
                    
                    // Extrahiere Daten aus Tooltip
                    const data = extractDataFromTooltip(tooltip);
                    if (data.Band && data.Album) {
                      lastTooltipData = data;
                      showDebugMessage(`Tooltip data: ${data.Band} - ${data.Album}`, '#90EE90');
                      
                      // Verzögere die Karten-Anzeige etwas, falls mehrere Tooltips kommen
                      clearTimeout(tooltipTimeout);
                      tooltipTimeout = setTimeout(() => {
                        if (lastTooltipData) {
                          showDebugMessage(`Showing card from tooltip: ${lastTooltipData.Band}`, '#90EE90');
                          showMobileAlbumCard(lastTooltipData);
                          lastTooltipData = null;
                        }
                      }, 100);
                    } else {
                      showDebugMessage('Tooltip created but no data extracted', '#ffaa00');
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
          showDebugMessage('Tooltip observer started', '#4a9dd4');
          
          // Ansatz 3: Direkte SVG-Events nur für Debugging
          // Die Vega-Lite Event API (Ansatz 1) und Tooltip-Observer (Ansatz 2) sollten ausreichen
          svg.addEventListener('touchstart', (e) => {
            showDebugMessage(`Touch start: ${e.touches.length} touches`, '#4a9dd4');
          }, { passive: true });
          
          svg.addEventListener('click', (e) => {
            showDebugMessage(`SVG click at (${e.clientX}, ${e.clientY})`, '#888');
            // Die Vega-Lite Event API sollte das bereits abfangen
            // Falls nicht, wird der Tooltip-Observer greifen
          });
          
          showDebugMessage('SVG event listeners added (debugging only)', '#90EE90');
        };
        
        // Starte Setup-Versuch
        trySetup();
      } catch (error) {
        showDebugMessage(`FATAL ERROR in setup: ${error.message}`, '#ff0000');
        console.error('Mobile touch handler setup error:', error);
      }
    }, 100);
  } catch (error) {
    console.error('Mobile touch handler fatal error:', error);
  }
}
