/**
 * Mobile Album-Karte: Öffnet beim Touch auf einen Chart-Punkt eine Karte mit Album-Infos
 * Unterstützt Swipe-Gesten zum Navigieren zwischen Alben derselben Band
 */

import { isMobile } from './utils.js';
import { getBasePath } from './utils.js';

/**
 * Erstellt eine mobile Album-Karte
 */
function createMobileAlbumCard() {
  const card = document.createElement('div');
  card.className = 'mobile-album-card';
  card.style.display = 'none';
  
  const overlay = document.createElement('div');
  overlay.className = 'mobile-album-card-overlay';
  
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-album-card-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  
  const coverContainer = document.createElement('div');
  coverContainer.className = 'mobile-album-card-cover';
  
  const coverImg = document.createElement('img');
  coverImg.className = 'mobile-album-card-cover-img';
  coverImg.alt = 'Album Cover';
  coverContainer.appendChild(coverImg);
  
  const infoContainer = document.createElement('div');
  infoContainer.className = 'mobile-album-card-info';
  
  const title = document.createElement('h2');
  title.className = 'mobile-album-card-title';
  
  const band = document.createElement('p');
  band.className = 'mobile-album-card-band';
  
  const details = document.createElement('div');
  details.className = 'mobile-album-card-details';
  
  infoContainer.appendChild(title);
  infoContainer.appendChild(band);
  infoContainer.appendChild(details);
  
  content.appendChild(closeBtn);
  content.appendChild(coverContainer);
  content.appendChild(infoContainer);
  
  card.appendChild(overlay);
  card.appendChild(content);
  
  document.body.appendChild(card);
  
  return { card, coverImg, title, band, details, overlay, closeBtn };
}

/**
 * Lädt Cover-Bild
 */
async function loadCoverImage(imgElement, band, album, year) {
  const basePath = getBasePath();
  const basePrefix = basePath ? `${basePath}/` : '';
  
  function sanitizeFilename(text) {
    if (!text) return '';
    return String(text)
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100);
  }
  
  function getCoverFilename(band, album, year = null) {
    const bandSafe = sanitizeFilename(band);
    const albumSafe = sanitizeFilename(album);
    if (year) {
      return `${bandSafe}_${albumSafe}_${year}.jpg`;
    }
    return `${bandSafe}_${albumSafe}.jpg`;
  }
  
  const filenameWithYear = getCoverFilename(band, album, year);
  const filenameWithoutYear = getCoverFilename(band, album, null);
  const coverPathWithYear = `${basePrefix}images/covers/${filenameWithYear}`;
  const coverPathWithoutYear = `${basePrefix}images/covers/${filenameWithoutYear}`;
  
  // Versuche zuerst mit Jahr, dann ohne Jahr
  imgElement.src = coverPathWithYear;
  imgElement.onerror = () => {
    if (coverPathWithoutYear !== coverPathWithYear) {
      imgElement.src = coverPathWithoutYear;
      imgElement.onerror = () => {
        imgElement.style.display = 'none';
      };
    } else {
      imgElement.style.display = 'none';
    }
  };
  imgElement.onload = () => {
    imgElement.style.display = 'block';
  };
}

/**
 * Zeigt Album-Details in der Karte an
 */
function showAlbumDetails(cardElements, albumData) {
  const { coverImg, title, band, details } = cardElements;
  
  title.textContent = albumData.Album || 'Unbekanntes Album';
  band.textContent = albumData.Band || 'Unbekannte Band';
  
  details.innerHTML = '';
  
  const detailItems = [
    { label: 'Jahr', value: albumData.Jahr },
    { label: 'Note', value: albumData.Note },
    { label: 'Platz', value: albumData.Platz }
  ];
  
  detailItems.forEach(item => {
    if (item.value != null) {
      const detailRow = document.createElement('div');
      detailRow.className = 'mobile-album-card-detail-row';
      
      const label = document.createElement('span');
      label.className = 'mobile-album-card-detail-label';
      label.textContent = item.label + ':';
      
      const value = document.createElement('span');
      value.className = 'mobile-album-card-detail-value';
      value.textContent = item.value;
      
      detailRow.appendChild(label);
      detailRow.appendChild(value);
      details.appendChild(detailRow);
    }
  });
  
  loadCoverImage(coverImg, albumData.Band, albumData.Album, albumData.Jahr);
}

/**
 * Setup Touch-Handler für Chart-Punkte
 */
export function setupMobileAlbumCard(view, data, selectedBands) {
  if (!isMobile()) {
    return; // Nur auf Mobile
  }
  
  const cardElements = createMobileAlbumCard();
  const { card, overlay, closeBtn } = cardElements;
  
  let currentAlbumIndex = -1;
  let currentAlbums = [];
  
  // Schließen-Button
  closeBtn.addEventListener('click', () => {
    card.style.display = 'none';
  });
  
  // Overlay-Klick schließt Karte
  overlay.addEventListener('click', () => {
    card.style.display = 'none';
  });
  
  // Swipe-Gesten für Navigation
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;
  
  card.addEventListener('touchstart', (e) => {
    if (e.target === overlay || e.target === closeBtn) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  });
  
  card.addEventListener('touchmove', (e) => {
    if (e.target === overlay || e.target === closeBtn) return;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    if (deltaX > 10 || deltaY > 10) {
      touchMoved = true;
    }
  });
  
  card.addEventListener('touchend', (e) => {
    if (e.target === overlay || e.target === closeBtn) return;
    if (!touchMoved) return;
    
    const touch = e.changedTouches[0];
    if (!touch) return;
    
    const deltaX = touch.clientX - touchStartX;
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // Nur horizontale Swipes berücksichtigen
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > deltaY * 1.5) {
      if (deltaX > 0 && currentAlbumIndex > 0) {
        // Swipe nach rechts = vorheriges Album
        currentAlbumIndex--;
        showAlbumDetails(cardElements, currentAlbums[currentAlbumIndex]);
      } else if (deltaX < 0 && currentAlbumIndex < currentAlbums.length - 1) {
        // Swipe nach links = nächstes Album
        currentAlbumIndex++;
        showAlbumDetails(cardElements, currentAlbums[currentAlbumIndex]);
      }
    }
  });
  
  function openAlbumCard(datum) {
    // Finde alle Alben dieser Band
    currentAlbums = data.filter(d => 
      d.Band === datum.Band && 
      selectedBands.includes(d.Band)
    ).sort((a, b) => {
      // Sortiere nach Jahr, dann nach Platz
      if (a.Jahr !== b.Jahr) return (a.Jahr || 0) - (b.Jahr || 0);
      return (a.Platz || 0) - (b.Platz || 0);
    });
    
    // Finde Index des aktuellen Albums
    currentAlbumIndex = currentAlbums.findIndex(a => 
      a.Band === datum.Band && 
      a.Album === datum.Album && 
      a.Jahr === datum.Jahr
    );
    
    if (currentAlbumIndex === -1) {
      currentAlbumIndex = 0;
    }
    
    // Zeige Karte
    showAlbumDetails(cardElements, currentAlbums[currentAlbumIndex]);
    card.style.display = 'flex';
  }
  
  // Abfangen von Tooltip-Events: Wenn ein Tooltip angezeigt wird, öffne die Karte
  // Vega-Lite zeigt Tooltips bei Hover/Click auf Punkte
  const tooltipObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tooltip = node.classList?.contains('vg-tooltip') || node.classList?.contains('vega-tooltip')
            ? node
            : node.querySelector?.('.vg-tooltip, .vega-tooltip');
          
          if (tooltip) {
            // Extrahiere Daten aus dem Tooltip
            const rows = tooltip.querySelectorAll('tr');
            const datum = {};
            
            rows.forEach((row) => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 2) {
                const key = cells[0].textContent.trim().toLowerCase();
                const value = cells[1].textContent.trim();
                
                if (key === 'band') datum.Band = value;
                else if (key === 'album') datum.Album = value;
                else if (key === 'jahr' || key === 'year') datum.Jahr = parseInt(value) || null;
                else if (key === 'platz') datum.Platz = parseInt(value) || null;
                else if (key === 'note') datum.Note = parseFloat(value) || null;
              }
            });
            
            if (datum.Band && datum.Album) {
              // Verhindere Standard-Tooltip auf Mobile
              tooltip.style.display = 'none';
              // Öffne Karte
              openAlbumCard(datum);
            }
          }
        }
      });
    });
  });
  
  // Beobachte Tooltip-Container
  const chartContainer = view.container();
  if (chartContainer) {
    tooltipObserver.observe(chartContainer, {
      childList: true,
      subtree: true
    });
  }
  
  // Alternative: Direkter Click-Handler auf SVG-Punkte
  // Warte bis Chart gerendert ist
  setTimeout(() => {
    const svg = chartContainer?.querySelector('svg');
    if (svg) {
      // Finde alle Punkt-Elemente (circle)
      const points = svg.querySelectorAll('circle.mark-symbol');
      points.forEach(point => {
        point.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Versuche Daten aus dem nächsten Tooltip zu extrahieren
          // Oder verwende die Tooltip-Observer-Logik oben
        });
      });
    }
  }, 500);
}

