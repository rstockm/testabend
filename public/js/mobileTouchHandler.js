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
// Indikator wird direkt im HTML erstellt, hier nur Referenz holen

export function setupMobileTouchHandlers(chartView, chartEl, albumData = null, visiblePoints = null) {
  // Update Indikator sofort
  const indicator = document.getElementById('mobile-touch-indicator');
  if (indicator) {
    indicator.textContent = 'Setup Called';
    indicator.style.display = 'block';
    console.log('[MobileTouchHandler] Indicator updated: Setup Called');
  } else {
    console.error('[MobileTouchHandler] Indicator not found!');
  }
  
  console.log('[MobileTouchHandler] setupMobileTouchHandlers called', { 
    isMobile: isMobile(), 
    hasChartView: !!chartView, 
    hasChartEl: !!chartEl,
    chartElId: chartEl?.id,
    chartElTag: chartEl?.tagName,
    albumDataLength: albumData?.length,
    visiblePointsLength: visiblePoints?.length
  });
  
  // Setze Album-Daten für Swipe-Funktionalität
  if (albumData) {
    setAlbumDataForSwipe(albumData);
    console.log('[MobileTouchHandler] Album data set for swipe:', albumData.length, 'albums');
  }
  if (!isMobile()) {
    console.log('[MobileTouchHandler] Not mobile, returning');
    if (indicator) indicator.textContent = 'Not Mobile';
    return; // Nur auf Mobile
  }
  
  if (indicator) indicator.textContent = 'Mobile: Setting up...';
  
  const tapPoints = Array.isArray(visiblePoints) && visiblePoints.length > 0
    ? visiblePoints
    : [];
  
  console.log('[MobileTouchHandler] tapPoints count:', tapPoints.length);
  
  // Entfernt: Globaler Test-Handler blockiert möglicherweise die Events
  // Die Events werden jetzt direkt auf dem Chart-Container abgefangen
  
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
                      console.log('[MobileTouchHandler] Tooltip created, extracting data...');
                      const data = extractDataFromTooltip(tooltip);
                      console.log('[MobileTouchHandler] Extracted data:', data);
                      
                      if (data.Band && data.Album && (data.Jahr != null || data.Note != null)) {
                        lastTooltipData = data;
                        console.log('[MobileTouchHandler] Valid tooltip data, will show card:', data);
                        
                        // Sofort anzeigen, kein Timeout (Tooltip wird sowieso versteckt)
                        clearTimeout(tooltipTimeout);
                        tooltipTimeout = setTimeout(() => {
                          if (lastTooltipData && lastTooltipData.Band && lastTooltipData.Album) {
                            console.log('[MobileTouchHandler] Showing card from tooltip:', lastTooltipData);
                            showMobileAlbumCard(lastTooltipData);
                            lastTooltipData = null;
                          }
                        }, 10); // Sehr kurzes Timeout für sofortiges Feedback
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
          
          // Mobile: Nutze Container-Listener für nearest-point Logik
          // Diese werden IMMER ausgelöst, auch wenn kein Punkt direkt getroffen wurde
          // Verwende chartEl statt svg für bessere iOS-Kompatibilität
          console.log('[MobileTouchHandler] Setting up nearest-point tap handler...', {
            hasChartEl: !!chartEl,
            hasSvg: !!svg,
            hasChartView: !!chartView,
            tapPointsCount: tapPoints.length
          });
          
          const nearestTapHandler = setupNearestPointTap(chartEl, svg, chartView, tapPoints, albumData);
          if (nearestTapHandler) {
            showDebugMessage('Nearest-tap handler aktiviert', '#90EE90');
            console.log('[MobileTouchHandler] ✅ Nearest-tap handler successfully registered');
            
            // Test: Füge einen einfachen Click-Handler hinzu, um zu prüfen ob Events ankommen
            const testHandler = (e) => {
              console.log('[MobileTouchHandler] TEST: Event received!', e.type);
              alert(`Event received: ${e.type}`); // Alert als letzter Ausweg
            };
            chartEl.addEventListener('touchstart', testHandler, { capture: true });
            console.log('[MobileTouchHandler] Test handler registered on chartEl');
          } else {
            showDebugMessage('Nearest-tap handler nicht aktiv (zu wenige Punkte?)', '#ffaa00');
            console.warn('[MobileTouchHandler] ❌ Could not setup nearest-point tap handler');
          }
          
          // Verhindere Tooltip-Anzeige auf Mobile
          if (chartView && typeof chartView.addEventListener === 'function') {
            chartView.addEventListener('mousemove', (event, item) => {
              // Verhindere Tooltip-Anzeige
              const tooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
              tooltips.forEach(t => t.remove());
            });
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
                      
                      // Sehr kurzes Timeout für sofortiges Feedback
                      clearTimeout(tooltipTimeout);
                      tooltipTimeout = setTimeout(() => {
                        if (lastTooltipData && lastTooltipData.Band && lastTooltipData.Album) {
                          console.log('[MobileTouchHandler] Showing card from tooltip:', lastTooltipData);
                          showDebugMessage(`Showing card from tooltip: ${lastTooltipData.Band}`, '#90EE90');
                          showMobileAlbumCard(lastTooltipData);
                          lastTooltipData = null;
                        }
                      }, 10); // Sehr kurzes Timeout für sofortiges Feedback
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
          console.log('[MobileTouchHandler] Tooltip observer started (fallback only)');
          showDebugMessage('Tooltip observer started (fallback)', '#4a9dd4');
          
          // Die direkten SVG-Listener aus setupNearestPointTap sind bereits aktiv
          // Keine zusätzlichen Debug-Listener nötig, da diese mit den nearest-point Listenern kollidieren könnten
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

/**
 * Aktiviert die nearest-point Logik auf dem gesamten Chart
 */
function setupNearestPointTap(chartEl, svg, chartView, candidatePoints, albumData) {
  if (!chartEl || !svg || !chartView || !Array.isArray(candidatePoints) || candidatePoints.length === 0) {
    console.warn('[MobileTouchHandler] setupNearestPointTap: Missing required parameters', {
      hasChartEl: !!chartEl,
      hasSvg: !!svg,
      hasChartView: !!chartView,
      pointsCount: candidatePoints?.length
    });
    return null;
  }
  
  const points = candidatePoints
    .map(point => {
      const jahr = Number(point.Jahr);
      const note = Number(point.Note);
      if (Number.isNaN(jahr) || Number.isNaN(note)) return null;
      return { datum: point, jahr, note };
    })
    .filter(Boolean);
  
  if (points.length === 0) {
    console.warn('[MobileTouchHandler] No valid points after filtering');
    return null;
  }
  
  console.log('[MobileTouchHandler] Setting up nearest-point tap with', points.length, 'points');
  
  let lastTouchInfo = null;
  let touchStartPos = null;
  let touchStartTime = 0;
  
  const findNearestDatum = (x, y) => {
    if (points.length === 0) {
      console.warn('[MobileTouchHandler] No points available for nearest search');
      return null;
    }
    
    let nearest = null;
    let minDist = Infinity;
    let xScale;
    let yScale;
    try {
      xScale = chartView.scale('x');
      yScale = chartView.scale('y');
    } catch (error) {
      console.warn('[MobileTouchHandler] scale lookup failed:', error);
      // Fallback: Nimm einfach den ersten Punkt wenn Skalen nicht verfügbar
      return points.length > 0 ? points[0].datum : null;
    }
    
    if (typeof xScale !== 'function' || typeof yScale !== 'function') {
      console.warn('[MobileTouchHandler] Scales not available, using first point as fallback');
      return points.length > 0 ? points[0].datum : null;
    }
    
    // Finde IMMER den nächstgelegenen Punkt, egal wie weit entfernt
    let validPointsFound = 0;
    for (const point of points) {
      const sx = xScale(point.jahr);
      const sy = yScale(point.note);
      if (sx == null || sy == null || Number.isNaN(sx) || Number.isNaN(sy)) {
        console.log('[MobileTouchHandler] Skipping point with invalid coords:', point.datum);
        continue;
      }
      validPointsFound++;
      const dx = sx - x;
      const dy = sy - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = point.datum;
      }
    }
    
    if (nearest) {
      const actualDist = Math.sqrt(minDist);
      console.log('[MobileTouchHandler] Nearest point found:', {
        band: nearest.Band,
        album: nearest.Album,
        distance: actualDist.toFixed(1),
        validPoints: validPointsFound,
        tapX: x,
        tapY: y
      });
    } else if (validPointsFound === 0) {
      console.warn('[MobileTouchHandler] No valid points with screen coordinates found', {
        pointsCount: points.length,
        xScaleType: typeof xScale,
        yScaleType: typeof yScale
      });
    }
    
    // GARANTIERE dass immer ein Punkt zurückgegeben wird, wenn Punkte vorhanden sind
    // Falls nearest null ist, nimm einfach den ersten verfügbaren Punkt
    if (!nearest && points.length > 0) {
      console.log('[MobileTouchHandler] ⚠️ No nearest found via distance, using first point as fallback');
      nearest = points[0].datum;
      console.log('[MobileTouchHandler] Fallback point:', nearest.Band, nearest.Album);
    }
    
    if (!nearest) {
      console.error('[MobileTouchHandler] ❌ CRITICAL: No point returned despite having', points.length, 'points');
    }
    
    return nearest;
  };
  
  const showDatumCard = (datum) => {
    if (!datum || !datum.Band || !datum.Album) {
      return false;
    }
    try {
      showMobileAlbumCard(datum, albumData);
      return true;
    } catch (error) {
      console.error('[MobileTouchHandler] showMobileAlbumCard failed:', error);
      return false;
    }
  };
  
  const handleTap = (event, directDatum = null) => {
    if (directDatum && directDatum.Band && directDatum.Album) {
      console.log('[MobileTouchHandler] Using direct datum:', directDatum.Band, directDatum.Album);
      return showDatumCard(directDatum);
    }
    
    const pointer = getPointerFromEvent(event);
    if (!pointer) {
      console.log('[MobileTouchHandler] No pointer found in event');
      return false;
    }
    
    // Verwende SVG-Bounding-Rect für Koordinatenberechnung
    const rect = svg.getBoundingClientRect();
    const relX = pointer.clientX - rect.left;
    const relY = pointer.clientY - rect.top;
    
    console.log('[MobileTouchHandler] Tap at relative coords:', { relX, relY, pointsCount: points.length });
    
    const nearest = findNearestDatum(relX, relY);
    if (nearest) {
      console.log('[MobileTouchHandler] ✅ Nearest point found:', nearest.Band, nearest.Album);
      showTouchIndicator(`✅ ${nearest.Band}`);
      return showDatumCard(nearest);
    }
    console.error('[MobileTouchHandler] ❌ No nearest point found despite having points', {
      relX,
      relY,
      pointsCount: points.length,
      svgRect: svg.getBoundingClientRect()
    });
    showTouchIndicator('❌ No point found');
    return false;
  };
  
  // Verwende Indikator aus HTML (wird dort erstellt)
  let touchIndicatorTimeout = null;
  
  const showTouchIndicator = (message) => {
    const indicator = document.getElementById('mobile-touch-indicator');
    if (indicator) {
      indicator.textContent = message;
      indicator.style.display = 'block';
      clearTimeout(touchIndicatorTimeout);
      touchIndicatorTimeout = setTimeout(() => {
        const ind = document.getElementById('mobile-touch-indicator');
        if (ind) {
          ind.textContent = 'Ready';
        }
      }, 2000);
    }
    console.log('[MobileTouchHandler] Indicator:', message);
  };
  
  // Initialisiere Indikator
  const indicator = document.getElementById('mobile-touch-indicator');
  if (indicator) {
    indicator.textContent = 'Touch Handler Ready';
    indicator.style.display = 'block';
    console.log('[MobileTouchHandler] Touch indicator initialized');
  } else {
    console.warn('[MobileTouchHandler] Touch indicator not found in HTML');
  }
  
  // iOS-kompatible Touch-Handler - verwende Capture-Phase für frühe Abfangung
  const onTouchStart = (event) => {
    // Prüfe ob Event innerhalb des Charts ist
    const rect = chartEl.getBoundingClientRect();
    const touch = event.touches?.[0];
    if (!touch) return;
    
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    
    if (touchX < rect.left || touchX > rect.right || touchY < rect.top || touchY > rect.bottom) {
      return; // Touch außerhalb des Charts
    }
    
    touchStartPos = {
      x: touchX,
      y: touchY
    };
    touchStartTime = Date.now();
    
    showTouchIndicator(`Touch Start: ${touchX.toFixed(0)}, ${touchY.toFixed(0)}`);
    console.log('[MobileTouchHandler] touchstart CAPTURED on container', touchStartPos);
  };
  
  const onTouchEnd = (event) => {
    if (!touchStartPos) {
      console.log('[MobileTouchHandler] touchend but no touchStartPos');
      return;
    }
    
    const touch = event.changedTouches?.[0];
    if (!touch) {
      console.log('[MobileTouchHandler] touchend but no changedTouches');
      touchStartPos = null;
      return;
    }
    
    const touchEndPos = {
      x: touch.clientX,
      y: touch.clientY
    };
    
    // Prüfe ob es ein Tap war (kein Swipe)
    const deltaX = Math.abs(touchEndPos.x - touchStartPos.x);
    const deltaY = Math.abs(touchEndPos.y - touchStartPos.y);
    const deltaTime = Date.now() - touchStartTime;
    
    showTouchIndicator(`Touch End: Δ${deltaX.toFixed(0)},${deltaY.toFixed(0)} ${deltaTime}ms`);
    
    // Maximal 20px Bewegung und 300ms für Tap
    if (deltaX > 20 || deltaY > 20 || deltaTime > 300) {
      console.log('[MobileTouchHandler] Ignoring swipe', { deltaX, deltaY, deltaTime });
      touchStartPos = null;
      return;
    }
    
    console.log('[MobileTouchHandler] touchend CAPTURED on container (tap detected)', { 
      touches: event.changedTouches?.length,
      pointsCount: points.length,
      deltaX,
      deltaY,
      deltaTime,
      pos: touchEndPos,
      chartRect: chartEl.getBoundingClientRect(),
      svgRect: svg.getBoundingClientRect()
    });
    
    // Erstelle ein synthetisches Event mit den Touch-Koordinaten
    const syntheticEvent = {
      clientX: touchEndPos.x,
      clientY: touchEndPos.y,
      changedTouches: event.changedTouches,
      touches: event.touches,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation()
    };
    
    console.log('[MobileTouchHandler] Calling handleTap with synthetic event...');
    const handled = handleTap(syntheticEvent);
    console.log('[MobileTouchHandler] handleTap result:', handled);
    
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      lastTouchInfo = { time: Date.now(), x: touchEndPos.x, y: touchEndPos.y };
      showTouchIndicator('✅ Album gefunden!');
      showDebugMessage('Touch erfolgreich verarbeitet', '#90EE90');
    } else {
      showTouchIndicator('❌ Kein Album gefunden');
      showDebugMessage('Touch ohne Treffer', '#ffaa00');
      console.error('[MobileTouchHandler] handleTap returned false - no album card shown');
    }
    
    touchStartPos = null;
  };
  
  const onClick = (event) => {
    // Ignoriere Ghost-Clicks nach Touch
    if (lastTouchInfo) {
      const deltaTime = Date.now() - lastTouchInfo.time;
      const deltaX = Math.abs(event.clientX - lastTouchInfo.x);
      const deltaY = Math.abs(event.clientY - lastTouchInfo.y);
      if (deltaTime < 400 && deltaX < 6 && deltaY < 6) {
        console.log('[MobileTouchHandler] Ignoring ghost click after touch');
        return;
      }
    }
    
    console.log('[MobileTouchHandler] click event CAPTURED on container', { pointsCount: points.length });
    const handled = handleTap(event);
    console.log('[MobileTouchHandler] handleTap result:', handled);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      showTouchIndicator('✅ Click Album');
      showDebugMessage('Click erfolgreich verarbeitet', '#90EE90');
    }
  };
  
  // Registriere Events in CAPTURE-Phase (true als 3. Parameter) für frühe Abfangung
  // Auf Container UND SVG für maximale Abdeckung
  chartEl.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  chartEl.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
  chartEl.addEventListener('click', onClick, { passive: false, capture: true });
  
  // Auch auf SVG registrieren als Backup
  svg.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  svg.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
  svg.addEventListener('click', onClick, { passive: false, capture: true });
  
  console.log('[MobileTouchHandler] Container listeners registered', { 
    pointsCount: points.length,
    chartElTag: chartEl.tagName,
    chartElId: chartEl.id
  });
  
  return handleTap;
}

function getPointerFromEvent(event) {
  if (!event) return null;
  if (event.changedTouches && event.changedTouches.length > 0) {
    return event.changedTouches[0];
  }
  if (event.touches && event.touches.length > 0) {
    return event.touches[0];
  }
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return event;
  }
  return null;
}
