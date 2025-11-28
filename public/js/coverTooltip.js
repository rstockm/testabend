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
 * Prüft, ob ein Cover-Bild existiert (lazy loading)
 * Versucht zuerst mit Jahr, dann ohne Jahr
 */
async function checkCoverExists(band, album, year = null) {
  // Versuche zuerst mit Jahr (falls vorhanden)
  if (year) {
    const filenameWithYear = getCoverFilename(band, album, year);
    const coverPathWithYear = `images/covers/${filenameWithYear}`;
    
    try {
      const response = await fetch(coverPathWithYear, { method: 'HEAD', cache: 'no-cache' });
      if (response.ok) {
        return { exists: true, filename: filenameWithYear };
      }
    } catch {
      // Weiter zu Fallback ohne Jahr
    }
  }
  
  // Fallback: Versuche ohne Jahr
  const filenameWithoutYear = getCoverFilename(band, album, null);
  const coverPathWithoutYear = `images/covers/${filenameWithoutYear}`;
  
  try {
    const response = await fetch(coverPathWithoutYear, { method: 'HEAD', cache: 'no-cache' });
    if (response.ok) {
      return { exists: true, filename: filenameWithoutYear };
    }
  } catch {
    // Cover nicht gefunden
  }
  
  return { exists: false, filename: null };
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
 * Fügt Cover-Bild zu einem Tooltip hinzu
 */
async function addCoverToTooltip(tooltipElement) {
  // Extrahiere IMMER die aktuellen Daten (können sich bei Album-Wechsel ändern)
  const data = extractTooltipData(tooltipElement);
  
  if (!data.band || !data.album) {
    return; // Keine Band/Album-Daten vorhanden
  }
  
  // Erstelle Cache-Key basierend auf Album-Daten
  const cacheKey = `${data.band}|${data.album}|${data.year || ''}`;
  
  // Prüfe Cache zuerst
  let coverUrl = coverUrlCache.get(cacheKey);
  
  // Wenn null im Cache, bedeutet das "bereits geprüft, nicht vorhanden"
  if (coverUrl === undefined) {
    // Prüfe asynchron, ob Cover existiert (mit Fallback ohne Jahr)
    const result = await checkCoverExists(data.band, data.album, data.year);
    
    if (!result.exists || !result.filename) {
      coverUrlCache.set(cacheKey, null); // Cache als "nicht vorhanden"
      return; // Cover nicht vorhanden
    }
    
    coverUrl = `images/covers/${result.filename}`;
    coverUrlCache.set(cacheKey, coverUrl);
  } else if (coverUrl === null) {
    // Bereits geprüft, nicht vorhanden
    return;
  }
  
  // Prüfe ob bereits das richtige Cover vorhanden ist
  const existingCover = tooltipElement.querySelector('.tooltip-cover-container');
  if (existingCover) {
    const existingImg = existingCover.querySelector('img');
    if (existingImg && existingImg.src === coverUrl) {
      return; // Richtiges Cover bereits vorhanden
    }
    // Falsches Cover vorhanden - entferne es
    existingCover.remove();
  }
  
  // Erstelle Cover-Container
  const coverContainer = document.createElement('div');
  coverContainer.className = 'tooltip-cover-container';
  
  const coverImage = document.createElement('img');
  coverImage.src = coverUrl;
  coverImage.alt = `${data.band} - ${data.album}`;
  coverImage.className = 'tooltip-cover-image';
  coverImage.loading = 'lazy';
  
  // Fehlerbehandlung für fehlgeschlagene Bildladung
  coverImage.onerror = () => {
    coverContainer.remove();
    coverUrlCache.set(cacheKey, null); // Markiere als nicht vorhanden
  };
  
  coverContainer.appendChild(coverImage);
  
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
  
  const contentObserver = new MutationObserver(() => {
    // Prüfe ob Cover vorhanden ist und ob es das richtige ist
    const existingCover = tooltipElement.querySelector('.tooltip-cover-container');
    const data = extractTooltipData(tooltipElement);
    
    if (!data.band || !data.album) {
      return; // Keine Daten, nichts zu tun
    }
    
    const cacheKey = `${data.band}|${data.album}|${data.year || ''}`;
    const expectedCoverUrl = coverUrlCache.get(cacheKey);
    
    // Wenn Cover nicht vorhanden oder falsches Cover vorhanden
    if (!existingCover || (expectedCoverUrl && existingCover.querySelector('img')?.src !== expectedCoverUrl)) {
      // Füge Cover sofort wieder hinzu (ohne Debounce für sofortige Reaktion)
      // Verwende requestAnimationFrame für optimale Performance
      requestAnimationFrame(() => {
        addCoverToTooltip(tooltipElement);
      });
    }
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
