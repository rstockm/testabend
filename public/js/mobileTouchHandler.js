/**
 * Mobile Touch-Handler für Chart-Interaktionen
 * Ersetzt Hover-Effekte durch explizite Touch-Events
 */
import { isMobile } from './utils.js';
import { showMobileAlbumCard, setAlbumDataForSwipe } from './mobileAlbumCard.js';

/**
 * Visueller Debug-Modus (zeigt Events auf dem Bildschirm)
 */
let debugMode = false; // Deaktiviert
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
 * @param {Object} chartView - Vega-Lite Chart View
 * @param {HTMLElement} chartEl - Chart Container Element
 * @param {Array} albumData - Optionale Album-Daten für Swipe-Funktionalität
 */
export function setupMobileTouchHandlers(chartView, chartEl, albumData = null) {
  console.log('[MobileTouchHandler] setupMobileTouchHandlers called', { 
    isMobile: isMobile(), 
    hasChartView: !!chartView, 
    hasChartEl: !!chartEl,
    albumDataLength: albumData?.length 
  });
  
  // Setze Album-Daten für Swipe-Funktionalität
  if (albumData) {
    setAlbumDataForSwipe(albumData);
    console.log('[MobileTouchHandler] Album data set for swipe:', albumData.length, 'albums');
  }
  if (!isMobile()) {
    console.log('[MobileTouchHandler] Not mobile, returning');
    return; // Nur auf Mobile
  }
  
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
    console.log('[MobileTouchHandler] Starting setup timeout, will try to find SVG/Canvas');
    setTimeout(() => {
      console.log('[MobileTouchHandler] Setup timeout fired, starting trySetup');
      try {
        let attempts = 0;
        const maxAttempts = 20; // Erhöht von 10 auf 20
        
        const trySetup = () => {
          attempts++;
          console.log(`[MobileTouchHandler] Attempt ${attempts} to find SVG/Canvas`);
          
          // Suche SVG direkt oder in verschachtelten Elementen
          let svg = chartEl.querySelector('svg');
          console.log(`[MobileTouchHandler] Direct SVG search:`, !!svg);
          
          // Falls nicht gefunden, suche auch in allen Kindern
          if (!svg && chartEl.children.length > 0) {
            console.log(`[MobileTouchHandler] Searching in ${chartEl.children.length} children`);
            for (const child of chartEl.children) {
              svg = child.querySelector('svg') || (child.tagName === 'SVG' ? child : null);
              if (svg) {
                console.log(`[MobileTouchHandler] SVG found in child:`, child.tagName, child.className);
                break;
              }
            }
          }
          
          // Prüfe auch auf Canvas (Fallback, sollte nicht mehr vorkommen mit SVG-Renderer)
          const canvas = chartEl.querySelector('canvas');
          console.log(`[MobileTouchHandler] Canvas search:`, !!canvas);
          
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
              console.log(`[MobileTouchHandler] Waiting for SVG/Canvas... (${attempts}/${maxAttempts})`);
              showDebugMessage(`Waiting for SVG/Canvas... (${attempts}/${maxAttempts})`, '#ffaa00');
              setTimeout(trySetup, 200);
              return;
            } else {
              console.error('[MobileTouchHandler] ERROR: SVG/Canvas not found after multiple attempts');
              console.error('[MobileTouchHandler] ChartEl:', chartEl?.tagName, 'children:', chartEl?.children.length);
              if (chartEl && chartEl.children.length > 0) {
                Array.from(chartEl.children).forEach((child, i) => {
                  console.error(`[MobileTouchHandler] Child ${i}:`, child.tagName, child.className);
                });
              }
              showDebugMessage('ERROR: SVG/Canvas not found after multiple attempts', '#ff0000');
              showDebugMessage(`ChartEl: ${chartEl ? chartEl.tagName : 'null'}, children: ${chartEl ? chartEl.children.length : 0}`, '#ff0000');
              return;
            }
          }
          
          // Canvas gefunden (Fallback - sollte nicht mehr vorkommen)
          if (!svg && canvas) {
            console.log('[MobileTouchHandler] Canvas found instead of SVG, using Canvas fallback');
            showDebugMessage('WARNING: Canvas found instead of SVG!', '#ffaa00');
            showDebugMessage('Using Vega-Lite event API for Canvas...', '#4a9dd4');
            // Für Canvas nutzen wir die Vega-Lite Event API
            if (chartView && typeof chartView.addEventListener === 'function') {
              console.log('[MobileTouchHandler] Registering Canvas event listeners');
              
              chartView.addEventListener('click', (event, item) => {
                console.log('[MobileTouchHandler] Canvas click event:', { item: !!item, datum: !!(item?.datum), band: item?.datum?.Band });
                if (item && item.datum && item.datum.Band && item.datum.Album) {
                  event.preventDefault();
                  event.stopPropagation();
                  console.log('[MobileTouchHandler] Showing card from Canvas click:', item.datum.Band, '-', item.datum.Album);
                  showMobileAlbumCard(item.datum);
                }
              });
              
              chartView.addEventListener('touchstart', (event, item) => {
                console.log('[MobileTouchHandler] Canvas touchstart event:', { item: !!item, datum: !!(item?.datum), band: item?.datum?.Band });
                if (item && item.datum && item.datum.Band && item.datum.Album) {
                  event.preventDefault();
                  event.stopPropagation();
                  console.log('[MobileTouchHandler] Showing card from Canvas touchstart:', item.datum.Band, '-', item.datum.Album);
                  showMobileAlbumCard(item.datum);
                }
              });
              
              console.log('[MobileTouchHandler] Canvas event listeners added');
              showDebugMessage('Canvas event listeners added', '#90EE90');
            }
            
            // Direkte Touch-Events auf Canvas für bessere Zuverlässigkeit
            console.log('[MobileTouchHandler] Adding direct touch handlers to Canvas');
            let touchStartTime = 0;
            let touchStartPos = null;
            
            canvas.addEventListener('touchstart', (e) => {
              touchStartTime = Date.now();
              touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              console.log('[MobileTouchHandler] Canvas direct touchstart at:', touchStartPos);
            }, { passive: true });
            
            canvas.addEventListener('touchend', (e) => {
              if (!touchStartPos) return;
              
              const touchEndPos = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
              const deltaX = Math.abs(touchEndPos.x - touchStartPos.x);
              const deltaY = Math.abs(touchEndPos.y - touchStartPos.y);
              const deltaTime = Date.now() - touchStartTime;
              
              // Nur wenn Bewegung minimal (Tap, kein Swipe)
              if (deltaX < 10 && deltaY < 10 && deltaTime < 300) {
                console.log('[MobileTouchHandler] Canvas tap detected, querying Vega-Lite for datum');
                // Frage Vega-Lite nach Datum an dieser Position
                if (chartView && chartView.signal) {
                  // Versuche Daten über Vega-Lite API zu bekommen
                  const x = touchStartPos.x - canvas.getBoundingClientRect().left;
                  const y = touchStartPos.y - canvas.getBoundingClientRect().top;
                  
                  // Verwende Vega-Lite's pick-Methode falls verfügbar
                  if (chartView.scene && chartView.scene().pick) {
                    const picked = chartView.scene().pick({ x, y });
                    if (picked && picked.datum && picked.datum.Band && picked.datum.Album) {
                      console.log('[MobileTouchHandler] Datum found via pick:', picked.datum);
                      e.preventDefault();
                      e.stopPropagation();
                      showMobileAlbumCard(picked.datum);
                    }
                  }
                }
              }
              
              touchStartPos = null;
            }, { passive: false });
            
            // Auch Tooltip-Observer für Canvas starten (Fallback)
            console.log('[MobileTouchHandler] Setting up tooltip observer for Canvas fallback');
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
                      console.log('[MobileTouchHandler] Tooltip created (Canvas fallback), extracting data...');
                      const data = extractDataFromTooltip(tooltip);
                      console.log('[MobileTouchHandler] Extracted data:', data);
                      
                      if (data.Band && data.Album && (data.Jahr != null || data.Note != null)) {
                        lastTooltipData = data;
                        console.log('[MobileTouchHandler] Valid tooltip data, will show card:', data);
                        
                        clearTimeout(tooltipTimeout);
                        tooltipTimeout = setTimeout(() => {
                          if (lastTooltipData && lastTooltipData.Band && lastTooltipData.Album) {
                            console.log('[MobileTouchHandler] Showing card from tooltip (Canvas):', lastTooltipData);
                            showMobileAlbumCard(lastTooltipData);
                            lastTooltipData = null;
                          }
                        }, 50); // Kürzeres Timeout für schnelleres Feedback
                      } else {
                        console.log('[MobileTouchHandler] Tooltip data incomplete:', data);
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
            console.log('[MobileTouchHandler] Tooltip observer started for Canvas');
            
            return;
          }
          
          console.log(`[MobileTouchHandler] SVG found after ${attempts} attempts!`);
          showDebugMessage(`SVG found after ${attempts} attempts!`, '#90EE90');
          
          // Ansatz 1: Nutze Vega-Lite's Event-API (wie scatterKeyboardNav)
          if (chartView && typeof chartView.addEventListener === 'function') {
            console.log('[MobileTouchHandler] chartView.addEventListener is available, registering listeners');
            showDebugMessage('Using Vega-Lite addEventListener', '#4a9dd4');
            console.log('[MobileTouchHandler] Registering Vega-Lite event listeners');
            
            // Click-Events (funktionieren auch auf Touch)
            chartView.addEventListener('click', (event, item) => {
              console.log('[MobileTouchHandler] Vega click event:', { item: !!item, datum: !!(item?.datum), band: item?.datum?.Band });
              showDebugMessage(`Vega click: item=${!!item}, datum=${!!(item?.datum)}`, '#ff6b35');
              // Nur anzeigen, wenn wirklich ein Datum vorhanden ist (Punkt getroffen)
              if (item && item.datum && item.datum.Band && item.datum.Album) {
                event.preventDefault();
                event.stopPropagation();
                console.log('[MobileTouchHandler] Showing card for:', item.datum.Band, '-', item.datum.Album);
                showDebugMessage(`Showing card: ${item.datum.Band} - ${item.datum.Album}`, '#90EE90');
                try {
                  showMobileAlbumCard(item.datum);
                  showDebugMessage('showMobileAlbumCard called successfully', '#90EE90');
                } catch (error) {
                  console.error('[MobileTouchHandler] Error calling showMobileAlbumCard:', error);
                  showDebugMessage(`ERROR calling showMobileAlbumCard: ${error.message}`, '#ff0000');
                }
              } else {
                console.log('[MobileTouchHandler] Vega click but no valid datum:', { item: !!item, datum: !!(item?.datum) });
                showDebugMessage('Vega click but no valid datum (not on a point)', '#ffaa00');
              }
            });
            
            // Auch touchstart direkt abfangen (falls click nicht funktioniert)
            chartView.addEventListener('touchstart', (event, item) => {
              console.log('[MobileTouchHandler] Vega touchstart event:', { item: !!item, datum: !!(item?.datum), band: item?.datum?.Band });
              showDebugMessage(`Vega touchstart: item=${!!item}, datum=${!!(item?.datum)}`, '#ff6b35');
              // Nur anzeigen, wenn wirklich ein Datum vorhanden ist (Punkt getroffen)
              if (item && item.datum && item.datum.Band && item.datum.Album) {
                event.preventDefault();
                event.stopPropagation();
                console.log('[MobileTouchHandler] Showing card from touchstart for:', item.datum.Band, '-', item.datum.Album);
                showDebugMessage(`Showing card from touchstart: ${item.datum.Band}`, '#90EE90');
                try {
                  showMobileAlbumCard(item.datum);
                } catch (error) {
                  console.error('[MobileTouchHandler] Error calling showMobileAlbumCard:', error);
                  showDebugMessage(`ERROR calling showMobileAlbumCard: ${error.message}`, '#ff0000');
                }
              } else {
                console.log('[MobileTouchHandler] Vega touchstart but no valid datum:', { item: !!item, datum: !!(item?.datum) });
                showDebugMessage('Vega touchstart but no valid datum (not on a point)', '#ffaa00');
              }
            });
            
            console.log('[MobileTouchHandler] Event listeners registered successfully');
            
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
            console.error('[MobileTouchHandler] ERROR: chartView.addEventListener not available');
            console.error('[MobileTouchHandler] chartView:', chartView);
            console.error('[MobileTouchHandler] chartView.addEventListener:', typeof chartView?.addEventListener);
            showDebugMessage('ERROR: chartView.addEventListener not available', '#ff0000');
          }
          
          // Ansatz 2: Beobachte Tooltip-Erstellung und extrahiere Daten (funktioniert auch ohne SVG)
          console.log('[MobileTouchHandler] Setting up tooltip observer as fallback');
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
                    console.log('[MobileTouchHandler] Tooltip created, extracting data...');
                    showDebugMessage('Tooltip created!', '#ff6b35');
                    
                    // Extrahiere Daten aus Tooltip
                    const data = extractDataFromTooltip(tooltip);
                    console.log('[MobileTouchHandler] Extracted data:', data);
                    
                    // Nur Card anzeigen, wenn vollständige Daten vorhanden sind
                    if (data.Band && data.Album && (data.Jahr != null || data.Note != null)) {
                      lastTooltipData = data;
                      console.log('[MobileTouchHandler] Valid tooltip data, will show card:', data);
                      showDebugMessage(`Tooltip data: ${data.Band} - ${data.Album}`, '#90EE90');
                      
                      // Verzögere die Karten-Anzeige etwas, falls mehrere Tooltips kommen
                      clearTimeout(tooltipTimeout);
                      tooltipTimeout = setTimeout(() => {
                        if (lastTooltipData && lastTooltipData.Band && lastTooltipData.Album) {
                          console.log('[MobileTouchHandler] Showing card from tooltip:', lastTooltipData);
                          showDebugMessage(`Showing card from tooltip: ${lastTooltipData.Band}`, '#90EE90');
                          showMobileAlbumCard(lastTooltipData);
                          lastTooltipData = null;
                        }
                      }, 100);
                    } else {
                      console.log('[MobileTouchHandler] Tooltip data incomplete:', data);
                      showDebugMessage('Tooltip created but no valid data extracted', '#ffaa00');
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
          console.log('[MobileTouchHandler] Tooltip observer started');
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
