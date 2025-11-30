/**
 * Mobile Album-Karte für Touch-Interaktionen
 * Zeigt Album-Informationen als modale Karte statt flüchtiger Tooltips
 */
import { isMobile, getCoverImagePath } from './utils.js';

// Exportiere Cover-Funktionen aus coverTooltip.js für Wiederverwendung
// Wir müssen diese Funktionen hier duplizieren oder importieren
// Da sie nicht exportiert sind, kopieren wir die Logik

/**
 * Generiert Dateinamen für Album-Cover
 */
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

/**
 * Prüft, ob ein Cover-Bild existiert
 */
async function checkCoverExists(band, album, year = null) {
  console.log('[MobileAlbumCard] Checking cover exists:', band, album, year);
  
  // Teste zuerst mit Jahr (falls vorhanden)
  if (year) {
    const filenameWithYear = getCoverFilename(band, album, year);
    const pathWithYear = getCoverImagePath(filenameWithYear);
    console.log('[MobileAlbumCard] Trying cover with year:', filenameWithYear, '->', pathWithYear);
    
    try {
      const response = await fetch(pathWithYear, { method: 'HEAD', cache: 'no-cache' });
      console.log('[MobileAlbumCard] Cover check response (with year):', pathWithYear, 'status:', response.status, 'ok:', response.ok);
      if (response.ok) {
        console.log('[MobileAlbumCard] ✅ Cover found with year:', filenameWithYear);
        return { exists: true, filename: filenameWithYear };
      } else {
        console.log('[MobileAlbumCard] ❌ Cover not found (with year), status:', response.status);
      }
    } catch (error) {
      console.error('[MobileAlbumCard] ❌ Cover check failed (with year):', pathWithYear, error);
    }
  }
  
  // Fallback: Versuche ohne Jahr
  const filenameWithoutYear = getCoverFilename(band, album, null);
  const pathWithoutYear = getCoverImagePath(filenameWithoutYear);
  console.log('[MobileAlbumCard] Trying cover without year:', filenameWithoutYear, '->', pathWithoutYear);
  
  try {
    const response = await fetch(pathWithoutYear, { method: 'HEAD', cache: 'no-cache' });
    console.log('[MobileAlbumCard] Cover check response (without year):', pathWithoutYear, 'status:', response.status, 'ok:', response.ok);
    if (response.ok) {
      console.log('[MobileAlbumCard] ✅ Cover found without year:', filenameWithoutYear);
      return { exists: true, filename: filenameWithoutYear };
    } else {
      console.log('[MobileAlbumCard] ❌ Cover not found (without year), status:', response.status);
    }
  } catch (error) {
    console.error('[MobileAlbumCard] ❌ Cover check failed (without year):', pathWithoutYear, error);
  }
  
  console.log('[MobileAlbumCard] ❌ Cover not found for:', band, album, year);
  return { exists: false, filename: null };
}

let currentCard = null;
let currentAlbumIndex = 0;
let currentBandAlbums = []; // Alle Alben der aktuellen Band
let allData = null; // Gesamte Album-Daten für Band-Filterung

/**
 * Setzt die Album-Daten für die Swipe-Funktionalität
 * Sollte vom Router aufgerufen werden, wenn die Daten geladen sind
 */
export function setAlbumDataForSwipe(data) {
  allData = data;
}

/**
 * Zeigt modale Album-Karte auf Mobile
 */
export function showMobileAlbumCard(datum, albumData = null) {
  if (!isMobile() || !datum) return;
  
  // Wenn albumData übergeben wurde, verwende es, sonst verwende allData
  const dataSource = albumData || allData;
  
  // Filtere alle Alben der aktuellen Band und sortiere nach Jahr
  if (dataSource && datum.Band) {
    currentBandAlbums = dataSource
      .filter(d => d.Band === datum.Band)
      .sort((a, b) => (a.Jahr || 0) - (b.Jahr || 0)); // Sortiere nach Jahr aufsteigend
    
    // Finde Index des aktuellen Albums
    currentAlbumIndex = currentBandAlbums.findIndex(
      d => d.Band === datum.Band && d.Album === datum.Album && d.Jahr === datum.Jahr
    );
    
    if (currentAlbumIndex === -1) {
      currentAlbumIndex = 0; // Fallback falls nicht gefunden
    }
  } else {
    // Fallback: Nur aktuelles Album
    currentBandAlbums = [datum];
    currentAlbumIndex = 0;
  }
  
  closeMobileAlbumCard(true);
  
  const overlay = document.createElement('div');
  overlay.className = 'mobile-album-card-overlay';
  
  // Explizite Inline-Styles als Fallback für Browser ohne CSS-Unterstützung
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100vh !important;
    min-height: 100dvh !important;
    padding: 0 !important;
    margin: 0 !important;
    background: rgba(0, 0, 0, 0.85) !important;
    display: flex !important;
    align-items: flex-start !important;
    justify-content: center !important;
    padding-top: 10vh !important;
    padding-top: 10dvh !important;
    padding-left: 5vw !important;
    padding-right: 5vw !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    z-index: 99999 !important;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateZ(0);
  `;
  
  const card = document.createElement('div');
  card.className = 'mobile-album-card';
  card.style.cssText = `
    background: #1e1e1e !important;
    color: #f5f5f5 !important;
    border-radius: 16px !important;
    width: 100% !important;
    max-width: 420px !important;
    max-height: calc(90vh - 10vh) !important;
    max-height: calc(90dvh - 10dvh) !important;
    display: flex !important;
    flex-direction: column !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6) !important;
    border: 1px solid #404040 !important;
    overflow: hidden !important;
    position: relative !important;
    margin: 0 !important;
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-album-card-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.style.cssText = `
    position: absolute !important;
    top: 12px !important;
    right: 12px !important;
    width: 44px !important;
    height: 44px !important;
    background: #2a2a2a !important;
    border: 1px solid #404040 !important;
    border-radius: 50% !important;
    color: #f5f5f5 !important;
    font-size: 24px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    z-index: 10 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 !important;
  `;
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMobileAlbumCard();
  });
  
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  content.style.cssText = `
    padding: 20px !important;
    overflow-y: auto !important;
    flex: 1 !important;
    background: transparent !important;
    color: #f5f5f5 !important;
  `;
  
  const info = document.createElement('div');
  info.className = 'mobile-album-card-info';
  
  const title = document.createElement('h3');
  title.textContent = `${datum.Band} - ${datum.Album}`;
  title.style.cssText = `
    margin: 0 0 20px 0 !important;
    font-size: 20px !important;
    text-align: center !important;
    color: #f5f5f5 !important;
    font-weight: 600 !important;
  `;
  info.appendChild(title);
  
  const table = document.createElement('table');
  table.style.cssText = `
    width: 100% !important;
    border-collapse: collapse !important;
  `;
  const rows = [
    { key: 'Jahr', value: datum.Jahr || '-' },
    { key: 'Note', value: datum.Note != null ? datum.Note.toFixed(1) : '-' },
    { key: 'Platz', value: datum.Platz != null ? datum.Platz : '-' }
  ];
  
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.style.cssText = `
      border-bottom: 1px solid #404040 !important;
    `;
    const tdKey = document.createElement('td');
    tdKey.textContent = row.key + ':';
    tdKey.style.cssText = `
      padding: 12px 12px 12px 0 !important;
      color: #d4d4d4 !important;
      font-weight: 600 !important;
      width: 30% !important;
    `;
    const tdValue = document.createElement('td');
    tdValue.textContent = row.value;
    tdValue.style.cssText = `
      padding: 12px 0 !important;
      color: #f5f5f5 !important;
      text-align: left !important;
    `;
    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  });
  
  info.appendChild(table);
  content.appendChild(info);
  
  loadCoverImage(datum.Band, datum.Album, datum.Jahr, content, info);
  
  card.appendChild(closeBtn);
  card.appendChild(content);
  overlay.appendChild(card);
  
  // Stelle sicher, dass Overlay direkt an body angehängt wird
  document.body.appendChild(overlay);
  
  // Force reflow und dann aktivieren
  overlay.offsetHeight; // Force reflow
  requestAnimationFrame(() => {
    overlay.classList.add('active');
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMobileAlbumCard();
    }
  });
  
  // Swipe-Gesten für Album-Navigation hinzufügen (nur wenn mehrere Alben vorhanden)
  if (currentBandAlbums.length > 1) {
    setupSwipeGestures(card, overlay);
    // Visueller Hinweis für Swipe-Funktionalität
    addSwipeIndicator(card);
  }
  
  // Verhindere Body-Scroll
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  
  currentCard = overlay;
}

/**
 * Erstellt eine neue Karte mit Album-Daten (für Animation)
 */
function createCardContent(datum, overlay) {
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  content.style.cssText = `
    padding: 20px !important;
    overflow-y: auto !important;
    flex: 1 !important;
    background: transparent !important;
    color: #f5f5f5 !important;
  `;
  
  const info = document.createElement('div');
  info.className = 'mobile-album-card-info';
  
  const title = document.createElement('h3');
  title.textContent = `${datum.Band} - ${datum.Album}`;
  title.style.cssText = `
    margin: 0 0 20px 0 !important;
    font-size: 20px !important;
    text-align: center !important;
    color: #f5f5f5 !important;
    font-weight: 600 !important;
  `;
  info.appendChild(title);
  
  const table = document.createElement('table');
  table.style.cssText = `
    width: 100% !important;
    border-collapse: collapse !important;
  `;
  const rows = [
    { key: 'Jahr', value: datum.Jahr || '-' },
    { key: 'Note', value: datum.Note != null ? datum.Note.toFixed(1) : '-' },
    { key: 'Platz', value: datum.Platz != null ? datum.Platz : '-' }
  ];
  
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.style.cssText = `
      border-bottom: 1px solid #404040 !important;
    `;
    const tdKey = document.createElement('td');
    tdKey.textContent = row.key + ':';
    tdKey.style.cssText = `
      padding: 12px 12px 12px 0 !important;
      color: #d4d4d4 !important;
      font-weight: 600 !important;
      width: 30% !important;
    `;
    const tdValue = document.createElement('td');
    tdValue.textContent = row.value;
    tdValue.style.cssText = `
      padding: 12px 0 !important;
      color: #f5f5f5 !important;
      text-align: left !important;
    `;
    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  });
  
  info.appendChild(table);
  content.appendChild(info);
  
  return content;
}

/**
 * Aktualisiert die Karte mit neuen Album-Daten (ohne Animation)
 */
function updateCardContent(datum, card, overlay) {
  const content = card.querySelector('.mobile-album-card-content');
  if (!content) return;
  
  // Entferne altes Cover
  const oldCover = content.querySelector('.mobile-album-card-cover-container');
  if (oldCover) oldCover.remove();
  
  // Aktualisiere Titel
  const title = content.querySelector('h3');
  if (title) {
    title.textContent = `${datum.Band} - ${datum.Album}`;
  }
  
  // Aktualisiere Tabelle
  const table = content.querySelector('table');
  if (table) {
    const rows = table.querySelectorAll('tr');
    if (rows.length >= 3) {
      // Jahr
      rows[0].querySelector('td:last-child').textContent = datum.Jahr || '-';
      // Note
      rows[1].querySelector('td:last-child').textContent = datum.Note != null ? datum.Note.toFixed(1) : '-';
      // Platz
      rows[2].querySelector('td:last-child').textContent = datum.Platz != null ? datum.Platz : '-';
    }
  }
  
  // Lade neues Cover
  const info = content.querySelector('.mobile-album-card-info');
  if (info) {
    loadCoverImage(datum.Band, datum.Album, datum.Jahr, content, info);
  }
}

/**
 * Navigiert zum nächsten/vorherigen Album mit flüssiger Animation
 */
function navigateToAlbum(direction) {
  if (currentBandAlbums.length <= 1) return;
  
  const overlay = currentCard;
  const oldCard = overlay?.querySelector('.mobile-album-card');
  if (!oldCard || !overlay) return;
  
  // Berechne neuen Index
  let newIndex;
  if (direction === 'next') {
    newIndex = (currentAlbumIndex + 1) % currentBandAlbums.length;
  } else {
    newIndex = (currentAlbumIndex - 1 + currentBandAlbums.length) % currentBandAlbums.length;
  }
  
  const newDatum = currentBandAlbums[newIndex];
  if (!newDatum) return;
  
  // Erstelle neue Karte im Hintergrund
  const newCard = oldCard.cloneNode(false);
  newCard.className = 'mobile-album-card';
  newCard.style.cssText = oldCard.style.cssText;
  
  // Kopiere Close-Button
  const oldCloseBtn = oldCard.querySelector('.mobile-album-card-close');
  if (oldCloseBtn) {
    const newCloseBtn = oldCloseBtn.cloneNode(true);
    newCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMobileAlbumCard();
    });
    newCard.appendChild(newCloseBtn);
  }
  
  // Erstelle neuen Content
  const newContent = createCardContent(newDatum, overlay);
  newCard.appendChild(newContent);
  
  // Positioniere neue Karte außerhalb des Sichtbereichs
  const cardWidth = oldCard.offsetWidth || 420;
  const startX = direction === 'next' ? cardWidth : -cardWidth;
  newCard.style.transform = `translateX(${startX}px)`;
  newCard.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
  newCard.style.position = 'absolute';
  newCard.style.top = '0';
  newCard.style.left = '0';
  newCard.style.right = '0';
  newCard.style.margin = '0 auto';
  
  // Füge neue Karte zum Overlay hinzu
  overlay.appendChild(newCard);
  
  // Lade Cover für neue Karte
  const info = newContent.querySelector('.mobile-album-card-info');
  if (info) {
    loadCoverImage(newDatum.Band, newDatum.Album, newDatum.Jahr, newContent, info);
  }
  
  // Starte Animation: beide Karten gleichzeitig bewegen
  requestAnimationFrame(() => {
    // Alte Karte rausschieben
    const endXOld = direction === 'next' ? -cardWidth : cardWidth;
    oldCard.style.transform = `translateX(${endXOld}px)`;
    oldCard.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
    
    // Neue Karte reinschieben
    newCard.style.transform = 'translateX(0)';
    
    // Nach Animation: alte Karte entfernen, neue Karte als aktuelle setzen
    setTimeout(() => {
      oldCard.remove();
      newCard.style.position = 'relative';
      newCard.style.transform = '';
      newCard.style.transition = '';
      
      // Aktualisiere Index
      currentAlbumIndex = newIndex;
      
      // Swipe-Gesten für neue Karte einrichten
      if (currentBandAlbums.length > 1) {
        setupSwipeGestures(newCard, overlay);
      }
    }, 300);
  });
}

/**
 * Fügt visuellen Swipe-Indikator hinzu
 */
function addSwipeIndicator(card) {
  const indicator = document.createElement('div');
  indicator.className = 'mobile-album-card-swipe-indicator';
  indicator.style.cssText = `
    position: absolute !important;
    bottom: 12px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    display: flex !important;
    gap: 6px !important;
    z-index: 5 !important;
    opacity: 0.6 !important;
  `;
  
  const dot1 = document.createElement('div');
  dot1.style.cssText = `
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    background: #f5f5f5 !important;
  `;
  
  const dot2 = document.createElement('div');
  dot2.style.cssText = `
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    background: #f5f5f5 !important;
  `;
  
  indicator.appendChild(dot1);
  indicator.appendChild(dot2);
  card.appendChild(indicator);
  
  // Entferne Indikator nach 3 Sekunden
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.transition = 'opacity 0.5s ease';
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 500);
    }
  }, 3000);
}

/**
 * Richtet Swipe-Gesten für die Album-Karte ein
 */
function setupSwipeGestures(card, overlay) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let isSwiping = false;
  const minSwipeDistance = 50; // Mindestdistanz für Swipe in Pixeln
  
  card.addEventListener('touchstart', (e) => {
    // Ignoriere Swipe wenn auf Close-Button geklickt wird
    if (e.target.closest('.mobile-album-card-close')) {
      return;
    }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
  }, { passive: true });
  
  card.addEventListener('touchmove', (e) => {
    if (!touchStartX || !touchStartY) return;
    
    touchEndX = e.touches[0].clientX;
    touchEndY = e.touches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = Math.abs(touchEndY - touchStartY);
    
    // Prüfe ob horizontale Bewegung größer als vertikale (Swipe-Geste)
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
      isSwiping = true;
      // Verhindere Scrollen während Swipe
      e.preventDefault();
      
      // Visuelles Feedback: Karte während Swipe leicht verschieben
      const maxDelta = Math.min(Math.abs(deltaX), 100); // Max 100px Verschiebung
      const translateX = deltaX > 0 ? maxDelta : -maxDelta;
      card.style.transform = `translateX(${translateX}px)`;
      card.style.transition = 'none'; // Keine Transition während Swipe
    }
  }, { passive: false });
  
  card.addEventListener('touchend', (e) => {
    // Reset visuelle Verschiebung
    card.style.transform = '';
    card.style.transition = '';
    
    if (!touchStartX || !touchStartY || !isSwiping) {
      touchStartX = 0;
      touchStartY = 0;
      return;
    }
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = Math.abs(touchEndY - touchStartY);
    
    // Nur als Swipe behandeln, wenn horizontale Bewegung größer als vertikale
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe nach rechts -> vorheriges Album
        navigateToAlbum('prev');
      } else {
        // Swipe nach links -> nächstes Album
        navigateToAlbum('next');
      }
    }
    
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    isSwiping = false;
  }, { passive: true });
}

/**
 * Lädt Cover-Bild asynchron und fügt es ein
 */
async function loadCoverImage(band, album, year, content, info) {
  try {
    const result = await checkCoverExists(band, album, year);
    
    if (result.exists && result.filename) {
      const coverUrl = getCoverImagePath(result.filename);
      
      const coverContainer = document.createElement('div');
      coverContainer.className = 'mobile-album-card-cover-container';
      coverContainer.style.cssText = `
        width: 100% !important;
        max-width: 300px !important;
        margin: 0 auto 20px !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        border: 2px solid #404040 !important;
        background: #2a2a2a !important;
        display: block !important;
        aspect-ratio: 1 !important;
      `;
      
      const coverImage = document.createElement('img');
      coverImage.alt = `${band} - ${album}`;
      coverImage.className = 'mobile-album-card-cover';
      coverImage.loading = 'eager';
      coverImage.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        display: block !important;
        object-fit: cover !important;
      `;
      
      // Setze Handler BEVOR src gesetzt wird
      coverImage.onload = () => {
        console.log('[MobileAlbumCard] ✅ Cover image loaded successfully:', coverUrl);
      };
      
      coverImage.onerror = (e) => {
        console.error('[MobileAlbumCard] ❌ Cover image failed to load:', coverUrl);
        console.error('[MobileAlbumCard] Error details:', e);
        console.error('[MobileAlbumCard] Image naturalWidth:', coverImage.naturalWidth, 'naturalHeight:', coverImage.naturalHeight);
        console.error('[MobileAlbumCard] Image complete:', coverImage.complete);
        console.error('[MobileAlbumCard] Image src:', coverImage.src);
        
        // Versuche zu prüfen, was tatsächlich geladen wurde
        fetch(coverUrl, { method: 'GET', cache: 'no-cache' })
          .then(response => {
            console.error('[MobileAlbumCard] GET response status:', response.status);
            console.error('[MobileAlbumCard] GET response Content-Type:', response.headers.get('Content-Type'));
            return response.text();
          })
          .then(text => {
            console.error('[MobileAlbumCard] Response preview (first 200 chars):', text.substring(0, 200));
            if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
              console.error('[MobileAlbumCard] ⚠️ Bild wird als HTML serviert! Das ist das Problem.');
            }
          })
          .catch(err => console.error('[MobileAlbumCard] Fetch error:', err));
        
        coverContainer.remove();
      };
      
      // Hänge Container ZUERST an DOM, dann setze src (damit onload/onerror funktionieren)
      coverContainer.appendChild(coverImage);
      content.insertBefore(coverContainer, info);
      
      // Setze src NACH dem Anhängen an DOM
      console.log('[MobileAlbumCard] Setting image src:', coverUrl);
      coverImage.src = coverUrl;
    }
  } catch (error) {
    console.error('[MobileAlbumCard] Cover konnte nicht geladen werden:', error);
  }
}

/**
 * Schließt die modale Album-Karte
 */
export function closeMobileAlbumCard(immediate = false) {
  if (!currentCard) return;
  
  const overlay = currentCard;
  const removeOverlay = () => {
    // Entferne Overlay komplett aus DOM
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    // Stelle sicher, dass Body-Scroll wieder aktiviert ist
    document.body.style.overflow = '';
    if (currentCard === overlay) {
      currentCard = null;
    }
  };
  
  if (immediate) {
    removeOverlay();
    return;
  }
  
  // Fade-out Animation
  overlay.classList.remove('active');
  overlay.style.opacity = '0';
  overlay.style.visibility = 'hidden';
  overlay.style.pointerEvents = 'none';
  
  setTimeout(removeOverlay, 250); // Etwas länger als CSS transition
}

// ESC-Taste zum Schließen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentCard) {
    closeMobileAlbumCard();
  }
});
