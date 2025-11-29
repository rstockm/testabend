/**
 * Mobile Album-Karte für Touch-Interaktionen
 * Zeigt Album-Informationen als modale Karte statt flüchtiger Tooltips
 */
import { isMobile, getCoversBasePath, getCoverImagePath } from './utils.js';

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
  // Verwende robuste Pfad-Funktion
  const coversBase = getCoversBasePath();
  
  console.log('[MobileAlbumCard] Checking cover exists:', band, album, year);
  console.log('[MobileAlbumCard] Using base path:', coversBase);
  
  if (year) {
    const filenameWithYear = getCoverFilename(band, album, year);
    const coverPathWithYear = getCoverImagePath(filenameWithYear);
    console.log('[MobileAlbumCard] Trying cover with year:', coverPathWithYear);
    
    try {
      const response = await fetch(coverPathWithYear, { method: 'HEAD', cache: 'no-cache' });
      console.log('[MobileAlbumCard] Cover check response (with year):', response.status, response.ok);
      if (response.ok) {
        console.log('[MobileAlbumCard] Cover found with year:', filenameWithYear);
        return { exists: true, filename: filenameWithYear };
      }
    } catch (error) {
      console.log('[MobileAlbumCard] Cover check failed (with year):', coverPathWithYear, error);
      // Weiter zu Fallback ohne Jahr
    }
  }
  
  const filenameWithoutYear = getCoverFilename(band, album, null);
  const coverPathWithoutYear = getCoverImagePath(filenameWithoutYear);
  console.log('[MobileAlbumCard] Trying cover without year:', coverPathWithoutYear);
  
  try {
    const response = await fetch(coverPathWithoutYear, { method: 'HEAD', cache: 'no-cache' });
    console.log('[MobileAlbumCard] Cover check response (without year):', response.status, response.ok);
    if (response.ok) {
      console.log('[MobileAlbumCard] Cover found without year:', filenameWithoutYear);
      return { exists: true, filename: filenameWithoutYear };
    }
  } catch (error) {
    console.log('[MobileAlbumCard] Cover check failed (without year):', coverPathWithoutYear, error);
    // Cover nicht gefunden
  }
  
  console.log('[MobileAlbumCard] Cover not found for:', band, album, year);
  return { exists: false, filename: null };
}

let currentCard = null;

/**
 * Zeigt modale Album-Karte auf Mobile
 */
export function showMobileAlbumCard(datum) {
  if (!isMobile() || !datum) return;
  
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
    padding: 20px !important;
    margin: 0 !important;
    background: rgba(0, 0, 0, 0.85) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
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
    width: 90% !important;
    max-width: 420px !important;
    max-height: 80vh !important;
    display: flex !important;
    flex-direction: column !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6) !important;
    border: 1px solid #404040 !important;
    overflow: hidden !important;
    position: relative !important;
    margin: 0 auto !important;
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
  
  // Verhindere Body-Scroll
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  
  currentCard = overlay;
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
      coverImage.src = coverUrl;
      coverImage.alt = `${band} - ${album}`;
      coverImage.className = 'mobile-album-card-cover';
      coverImage.loading = 'eager';
      coverImage.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        display: block !important;
        object-fit: cover !important;
      `;
      coverImage.onerror = () => {
        console.error('[MobileAlbumCard] Cover image failed to load:', coverUrl);
        coverContainer.remove();
      };
      coverImage.onload = () => {
        console.log('[MobileAlbumCard] Cover image loaded:', coverUrl);
      };
      
      coverContainer.appendChild(coverImage);
      content.insertBefore(coverContainer, info);
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
