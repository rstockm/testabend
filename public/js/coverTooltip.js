/**
 * Custom Tooltip-Handler für Album-Cover-Anzeige
 * Lädt Cover-Bilder lazy beim Hover
 */

/**
 * Generiert Dateinamen für Album-Cover (identisch zur Python-Version)
 */
function sanitizeFilename(text) {
  if (!text) return '';
  return String(text)
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100);
}

/**
 * Generiert den erwarteten Dateinamen für ein Album-Cover
 */
function getCoverFilename(band, album, year = null) {
  const bandSafe = sanitizeFilename(band);
  const albumSafe = sanitizeFilename(album);
  
  if (year) {
    return `${bandSafe}_${albumSafe}_${year}.jpg`;
  }
  return `${bandSafe}_${albumSafe}.jpg`;
}

/**
 * Generiert Cover-URLs (mit/ohne Jahr) - verwendet gleiche Logik wie Jahresliste
 * WICHTIG: Cover-Images haben ein Jahr im Dateinamen NUR wenn es Duplikate gibt
 * Versuche ZUERST mit Jahr (spezifischer), dann ohne Jahr als Fallback
 */
async function getCoverUrls(band, album, year) {
  // Importiere getBasePath dynamisch
  const { getBasePath } = await import('./utils.js');
  const basePath = getBasePath();
  // WICHTIG: Verwende relative Pfade (wie in Jahresliste)
  // basePath ist '' für Root, daher wird basePrefix zu ''
  // Relative Pfade funktionieren im Browser automatisch
  const basePrefix = basePath ? `${basePath}/` : '';
  
  // WICHTIG: Cover-Images haben ein Jahr im Dateinamen NUR wenn es Duplikate gibt
  // Versuche ZUERST mit Jahr (spezifischer), dann ohne Jahr als Fallback
  const filenameWithoutYear = getCoverFilename(band, album, null);
  const coverPathWithoutYear = `${basePrefix}images/covers/${filenameWithoutYear}`;
  
  if (year) {
    const filenameWithYear = getCoverFilename(band, album, year);
    const coverPathWithYear = `${basePrefix}images/covers/${filenameWithYear}`;
    // Versuche zuerst mit Jahr (falls Duplikat), dann ohne Jahr
    return { primary: coverPathWithYear, fallback: coverPathWithoutYear };
  }
  
  return { primary: coverPathWithoutYear, fallback: null };
}

/**
 * Passt die Tooltip-Position an, wenn er zu weit rechts ist
 */
function adjustTooltipPosition(tooltipElement) {
  if (!tooltipElement || !tooltipElement.parentElement) {
    return;
  }
  
  // Warte kurz, damit das Tooltip vollständig gerendert ist
  requestAnimationFrame(() => {
    const rect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;
    
    // Prüfe ob Tooltip rechts aus dem Viewport ragt
    if (rect.right > viewportWidth - padding) {
      // Berechne die Verschiebung nach links
      const overflow = rect.right - (viewportWidth - padding);
      // Vega-Lite verwendet normalerweise 'left' in Pixel
      const currentLeft = parseFloat(tooltipElement.style.left) || rect.left;
      
      // Verschiebe nach links
      tooltipElement.style.left = `${currentLeft - overflow}px`;
    }
    
    // Prüfe ob Tooltip links aus dem Viewport ragt
    if (rect.left < padding) {
      tooltipElement.style.left = `${padding}px`;
    }
    
    // Prüfe vertikale Position
    if (rect.top < padding) {
      tooltipElement.style.top = `${padding}px`;
    } else if (rect.bottom > viewportHeight - padding) {
      const bottomOverflow = rect.bottom - (viewportHeight - padding);
      const currentTop = parseFloat(tooltipElement.style.top) || rect.top;
      tooltipElement.style.top = `${currentTop - bottomOverflow}px`;
    }
  });
}

/**
 * Extrahiert Band/Album-Daten aus einem Tooltip-Element
 */
function extractTooltipData(tooltipElement) {
  const data = {};
  
  // Suche nach Tabellenzeilen im Tooltip
  // Vega-Lite verwendet sowohl 'tr' direkt als auch verschachtelt in 'tbody'
  const rows = tooltipElement.querySelectorAll('tr');
  
  if (rows.length === 0) {
    return data;
  }
  
  rows.forEach((row) => {
    // Versuche verschiedene Selektoren für Key/Value-Zellen
    let keyCell = row.querySelector('td.key');
    let valueCell = row.querySelector('td.value');
    
    // Fallback: Wenn keine .key/.value Klassen, versuche erste/zweite td
    if (!keyCell || !valueCell) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        keyCell = cells[0];
        valueCell = cells[1];
      }
    }
    
    if (keyCell && valueCell) {
      const key = keyCell.textContent.trim().toLowerCase();
      const value = valueCell.textContent.trim();
      
      if (key === 'band') data.band = value;
      else if (key === 'album') data.album = value;
      else if (key === 'jahr' || key === 'year') data.year = parseInt(value) || null;
      else if (key === 'platz') data.platz = value;
      else if (key === 'note') data.note = value;
    }
  });
  
  return data;
}

/**
 * Cache für bereits geprüfte Cover-URLs pro Album/Band-Kombination
 */
const coverUrlCache = new Map(); // Key: "Band|Album|Year", Value: coverUrl oder null

/**
 * Debounce-Timer für Observer-Callbacks
 */
const observerDebounceTimers = new WeakMap();

/**
 * Fügt Cover-Bild zu einem Tooltip hinzu
 */
// Flag um Endlosschleifen zu verhindern
const processingTooltips = new WeakSet();

async function addCoverToTooltip(tooltipElement) {
  // Extrahiere IMMER die aktuellen Daten (können sich bei Album-Wechsel ändern)
  const data = extractTooltipData(tooltipElement);
  
  if (!data.band || !data.album) {
    return; // Keine Band/Album-Daten vorhanden
  }
  
  // Erstelle Cache-Key basierend auf Album-Daten
  const cacheKey = `${data.band}|${data.album}|${data.year || ''}`;
  
  // Prüfe Cache zuerst
  let coverUrls = coverUrlCache.get(cacheKey);
  
  // Wenn null im Cache, bedeutet das "bereits geprüft, nicht vorhanden"
  if (coverUrls === undefined) {
    // Generiere Cover-URLs (mit/ohne Jahr)
    coverUrls = await getCoverUrls(data.band, data.album, data.year);
    coverUrlCache.set(cacheKey, coverUrls);
  } else if (coverUrls === null) {
    // Bereits geprüft, nicht vorhanden
    return;
  }
  
  // Prüfe ob bereits das richtige Cover vorhanden ist
  const existingCover = tooltipElement.querySelector('.tooltip-cover-container');
  if (existingCover) {
    const existingCacheKey = existingCover.dataset.cacheKey;
    const existingImg = existingCover.querySelector('img');
    // Prüfe ob das Cover für diese Band/Album-Kombination bereits vorhanden ist
    if (existingCacheKey === cacheKey && existingImg && existingImg.src) {
      // Prüfe ob das Bild erfolgreich geladen wurde
      if (existingImg.complete && existingImg.naturalWidth > 0) {
        return; // Richtiges Cover bereits vorhanden und geladen
      }
      // Bild lädt noch oder ist fehlgeschlagen - warte nicht, entferne und lade neu
      existingCover.remove();
    } else {
      // Falsches Cover vorhanden - entferne es
      existingCover.remove();
    }
  }
  
  // Erstelle Cover-Container
  const coverContainer = document.createElement('div');
  coverContainer.className = 'tooltip-cover-container';
  coverContainer.dataset.cacheKey = cacheKey; // Speichere Cache-Key für spätere Prüfung
  
  const coverImage = document.createElement('img');
  coverImage.alt = `${data.band} - ${data.album}`;
  coverImage.className = 'tooltip-cover-image';
  coverImage.loading = 'lazy';
  
  // Lade Cover direkt mit onerror-Handler (wie in Jahresliste)
  if (coverUrls && coverUrls.primary) {
    // Versuche zuerst primary (mit Jahr, falls vorhanden)
    coverImage.src = coverUrls.primary;
    coverImage.onerror = () => {
      // Fallback: Versuche ohne Jahr (falls vorhanden)
      if (coverUrls.fallback) {
        coverImage.src = coverUrls.fallback;
        coverImage.onerror = () => {
          // Beide Varianten fehlgeschlagen - entferne Cover
          coverContainer.remove();
          coverUrlCache.set(cacheKey, null); // Markiere als nicht vorhanden
        };
        coverImage.onload = () => {
          // Bild geladen - passe Tooltip-Position an
          adjustTooltipPosition(tooltipElement);
        };
      } else {
        // Kein Fallback verfügbar - entferne Cover
        coverContainer.remove();
        coverUrlCache.set(cacheKey, null); // Markiere als nicht vorhanden
      }
    };
    coverImage.onload = () => {
      // Bild geladen - passe Tooltip-Position an
      adjustTooltipPosition(tooltipElement);
    };
    
    // WICHTIG: Füge Bild zum Container hinzu NACH dem Setzen von src (wie in Jahresliste)
    coverContainer.appendChild(coverImage);
  } else {
    // Keine Cover-URLs gefunden
    coverContainer.remove();
    coverUrlCache.set(cacheKey, null);
    return; // Keine DOM-Manipulation nötig, Flag wurde noch nicht gesetzt
  }
  
  // Wenn wir hier sind, wurde das Cover-Container erstellt, aber noch nicht zum DOM hinzugefügt
  // Die DOM-Manipulation passiert im try-Block weiter unten
  
  // Verhindere Endlosschleife: Wenn bereits in Bearbeitung, überspringe
  if (processingTooltips.has(tooltipElement)) {
    return;
  }
  
  // Markiere als in Bearbeitung (nur während DOM-Manipulation)
  processingTooltips.add(tooltipElement);
  
  // Temporär Observer deaktivieren während DOM-Manipulation
  const contentObserver = tooltipObservers.get(tooltipElement);
  if (contentObserver) {
    contentObserver.disconnect();
  }
  
  try {
    // Wrappe Tooltip-Inhalt - robuste Methode die auch bei Updates funktioniert
    const table = tooltipElement.querySelector('table');
    if (table) {
      // Prüfe ob bereits ein Wrapper existiert
      let wrapper = tooltipElement.querySelector('.tooltip-with-cover');
      let contentDiv = tooltipElement.querySelector('.tooltip-content');
      
      if (!wrapper) {
        // Erstelle neuen Wrapper
        wrapper = document.createElement('div');
        wrapper.className = 'tooltip-with-cover';
        
        contentDiv = document.createElement('div');
        contentDiv.className = 'tooltip-content';
        
        // Verschiebe bestehenden Inhalt in contentDiv
        const children = Array.from(tooltipElement.childNodes);
        children.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE && !child.classList?.contains('tooltip-cover-container')) {
            contentDiv.appendChild(child);
          } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            contentDiv.appendChild(child);
          }
        });
        
        // Füge Cover und Content hinzu
        wrapper.appendChild(coverContainer);
        wrapper.appendChild(contentDiv);
        
        // Ersetze alle Kinder durch Wrapper
        tooltipElement.innerHTML = '';
        tooltipElement.appendChild(wrapper);
      } else {
        // Wrapper existiert bereits, füge nur Cover hinzu falls fehlt
        const existingCoverInWrapper = wrapper.querySelector('.tooltip-cover-container');
        if (!existingCoverInWrapper) {
          wrapper.insertBefore(coverContainer, wrapper.firstChild);
        }
      }
    } else {
      // Fallback: Cover einfach vorne hinzufügen
      tooltipElement.insertBefore(coverContainer, tooltipElement.firstChild);
    }
    
    // Passe Tooltip-Position an, wenn er zu weit rechts ist
    adjustTooltipPosition(tooltipElement);
  } finally {
    // Observer wieder aktivieren
    if (contentObserver) {
      contentObserver.observe(tooltipElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false
      });
    }
    // Flag zurücksetzen nach DOM-Manipulation
    processingTooltips.delete(tooltipElement);
  }
}

/**
 * Setup MutationObserver für Tooltip-Änderungen
 */
let tooltipObserver = null;
let tooltipObservers = new WeakMap(); // Speichert Observer für einzelne Tooltips

function setupTooltipObserver() {
  if (tooltipObserver) {
    return; // Bereits eingerichtet
  }
  
  tooltipObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Prüfe ob das Node selbst ein Tooltip ist
          if (node.classList?.contains('vg-tooltip') || node.classList?.contains('vega-tooltip')) {
            setupTooltipContentObserver(node);
            // Warte länger, damit Tooltip vollständig gerendert ist
            setTimeout(() => {
              addCoverToTooltip(node);
            }, 100);
          }
          
          // Prüfe auch verschachtelte Tooltips (auch wenn das Node selbst keins ist)
          const allTooltips = node.querySelectorAll?.('.vg-tooltip, .vega-tooltip');
          if (allTooltips && allTooltips.length > 0) {
            allTooltips.forEach(t => {
              setupTooltipContentObserver(t);
              setTimeout(() => {
                addCoverToTooltip(t);
              }, 100);
            });
          }
        }
      });
    });
  });
  
  // Beobachte das gesamte Dokument
  tooltipObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Richtet einen Observer für ein einzelnes Tooltip ein, der auf Inhaltsänderungen reagiert
 */
function setupTooltipContentObserver(tooltipElement) {
  // Wenn bereits ein Observer für dieses Tooltip existiert, nicht erneut einrichten
  if (tooltipObservers.has(tooltipElement)) {
    return;
  }
  
  const contentObserver = new MutationObserver((mutations) => {
    // Überspringe wenn bereits in Bearbeitung
    if (processingTooltips.has(tooltipElement)) {
      return;
    }
    
    // Ignoriere Änderungen innerhalb des Cover-Containers (z.B. Bildladen)
    const hasNonCoverChanges = mutations.some(mutation => {
      // Prüfe ob die Änderung außerhalb des Cover-Containers ist
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const isInCoverContainer = node.closest?.('.tooltip-cover-container');
          if (!isInCoverContainer) {
            return true; // Änderung außerhalb des Cover-Containers
          }
        }
      }
      return false;
    });
    
    // Wenn nur Änderungen im Cover-Container, ignoriere
    if (!hasNonCoverChanges && mutations.length > 0) {
      return;
    }
    
    // Prüfe sofort die aktuellen Daten
    const data = extractTooltipData(tooltipElement);
    if (!data.band || !data.album) {
      return; // Keine Daten, nichts zu tun
    }
    
    const cacheKey = `${data.band}|${data.album}|${data.year || ''}`;
    const existingCover = tooltipElement.querySelector('.tooltip-cover-container');
    
    // Prüfe ob bereits das richtige Cover vorhanden ist (mit Cache-Key)
    if (existingCover) {
      const existingCacheKey = existingCover.dataset.cacheKey;
      const existingImg = existingCover.querySelector('img');
      // Wenn das Cover für diese Daten bereits vorhanden ist und geladen wurde, nichts tun
      if (existingCacheKey === cacheKey && existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
        return; // Richtiges Cover bereits vorhanden und geladen
      }
      
      // Wenn sich die Daten geändert haben (anderes Album), lade sofort das neue Cover
      if (existingCacheKey !== cacheKey) {
        // Daten haben sich geändert - lade sofort
        addCoverToTooltip(tooltipElement);
        // Passe Position nach dem Laden an
        setTimeout(() => adjustTooltipPosition(tooltipElement), 50);
        return;
      }
    }
    
    // Wenn kein Cover vorhanden, lade sofort
    if (!existingCover) {
      addCoverToTooltip(tooltipElement);
      return;
    }
    
    // Für wiederholte Mutationen mit denselben Daten: Debouncing
    const existingTimer = observerDebounceTimers.get(tooltipElement);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Setze Timer für Debouncing (nur für wiederholte Mutationen)
    const timer = setTimeout(() => {
      // Prüfe nochmal, ob Cover korrekt ist
      const currentCover = tooltipElement.querySelector('.tooltip-cover-container');
      const currentData = extractTooltipData(tooltipElement);
      if (!currentData.band || !currentData.album) {
        return;
      }
      const currentCacheKey = `${currentData.band}|${currentData.album}|${currentData.year || ''}`;
      
      if (currentCover) {
        const currentCacheKeyAttr = currentCover.dataset.cacheKey;
        const currentImg = currentCover.querySelector('img');
        if (currentCacheKeyAttr === currentCacheKey && currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
          return; // Cover ist korrekt
        }
      }
      
      // Cover fehlt oder ist falsch - lade
      addCoverToTooltip(tooltipElement);
    }, 100);
    
    observerDebounceTimers.set(tooltipElement, timer);
  });
  
  // Beobachte Änderungen im Tooltip-Inhalt, aber ignoriere Attribute-Änderungen
  contentObserver.observe(tooltipElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false // Ignoriere Attribut-Änderungen (verursachen zu viele Events)
  });
  
  tooltipObservers.set(tooltipElement, contentObserver);
}

/**
 * Initialisiert den Cover-Tooltip-Handler
 */
export function setupCoverTooltipHandler() {
  // Setup Observer wenn DOM bereit ist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTooltipObserver);
  } else {
    setupTooltipObserver();
  }
  
  // Auch nach Chart-Rendering nochmal versuchen
  setTimeout(setupTooltipObserver, 500);
}
