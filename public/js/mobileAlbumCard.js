/**
 * Mobile Album-Karte für Touch-Interaktionen
 * Zeigt Album-Informationen als modale Karte statt flüchtiger Tooltips
 */
import { isMobile } from './utils.js';

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
  // Verwende absoluten Pfad vom Root
  const coversBase = '/images/covers/';
  
  console.log('[MobileAlbumCard] Checking cover exists:', band, album, year);
  
  if (year) {
    const filenameWithYear = getCoverFilename(band, album, year);
    const coverPathWithYear = coversBase + filenameWithYear;
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
  const coverPathWithoutYear = coversBase + filenameWithoutYear;
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
  console.log('[MobileAlbumCard] showMobileAlbumCard called', datum);
  
  if (!isMobile()) {
    console.log('[MobileAlbumCard] Not mobile, returning');
    return; // Nur auf Mobile
  }
  
  console.log('[MobileAlbumCard] Creating card for', datum.Band, '-', datum.Album);
  
  // Entferne bestehende Karte sofort (ohne Animation)
  if (currentCard) {
    console.log('[MobileAlbumCard] Removing existing card');
    currentCard.remove();
    currentCard = null;
    document.body.style.overflow = '';
  }
  
  // Verwende natives <dialog> Element für besseren Mobile-Support
  let overlay = document.getElementById('mobile-album-card-dialog');
  
  if (!overlay) {
    overlay = document.createElement('dialog');
    overlay.id = 'mobile-album-card-dialog';
    overlay.className = 'mobile-album-card-overlay';
    // Explizite Styles für Dialog direkt setzen
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 20px !important;
      border: none !important;
      background: rgba(0, 0, 0, 0.8) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 9999 !important;
    `;
    document.body.appendChild(overlay);
    console.log('[MobileAlbumCard] Dialog element created');
  } else {
    // Entferne alten Inhalt falls vorhanden
    overlay.innerHTML = '';
    console.log('[MobileAlbumCard] Reusing existing dialog');
  }
  
  // Erstelle Karte
  const card = document.createElement('div');
  card.className = 'mobile-album-card';
  // Explizite Styles direkt setzen (für Android-Browser-Kompatibilität)
  card.style.cssText = `
    background: #1e1e1e !important;
    color: #f5f5f5 !important;
    border-radius: 12px !important;
    max-width: 90%;
    max-height: 80vh;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    position: relative;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
  `;
  
  // Close-Button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-album-card-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.addEventListener('click', closeMobileAlbumCard);
  
  // Content
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  content.style.cssText = `
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    -webkit-overflow-scrolling: touch;
    background: transparent !important;
    color: #f5f5f5 !important;
  `;
  
  // Info-Bereich
  const info = document.createElement('div');
  info.className = 'mobile-album-card-info';
  
  const title = document.createElement('h3');
  title.textContent = `${datum.Band} - ${datum.Album}`;
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 20px;
    text-align: center;
    color: #f5f5f5 !important;
    font-weight: 600;
  `;
  info.appendChild(title);
  
  const table = document.createElement('table');
  const rows = [
    { key: 'Jahr', value: datum.Jahr || '-' },
    { key: 'Note', value: datum.Note != null ? datum.Note.toFixed(1) : '-' },
    { key: 'Platz', value: datum.Platz != null ? datum.Platz : '-' }
  ];
  
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const tdKey = document.createElement('td');
    tdKey.textContent = row.key + ':';
    tdKey.style.cssText = `
      padding: 12px 12px 12px 0;
      color: #d4d4d4 !important;
      font-weight: 600;
      width: 30%;
    `;
    const tdValue = document.createElement('td');
    tdValue.textContent = row.value;
    tdValue.style.cssText = `
      padding: 12px 0;
      color: #f5f5f5 !important;
      text-align: left;
    `;
    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  });
  
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
  `;
  
  info.appendChild(table);
  
  // Cover-Bild SOFORT laden (vor dem Einfügen in content)
  // Erstelle Platzhalter für Cover
  const coverPlaceholder = document.createElement('div');
  coverPlaceholder.id = 'cover-placeholder';
  content.appendChild(coverPlaceholder);
  
  content.appendChild(info);
  
  // Cover-Bild asynchron laden
  loadCoverImage(datum.Band, datum.Album, datum.Jahr, content, coverPlaceholder);
  
  card.appendChild(closeBtn);
  card.appendChild(content);
  overlay.appendChild(card);
  
  console.log('[MobileAlbumCard] Card appended to dialog');
  
  currentCard = overlay;
  
  // Zeige Dialog mit nativer API (robust auf Mobile)
  requestAnimationFrame(() => {
    console.log('[MobileAlbumCard] Showing dialog');
    try {
      overlay.showModal(); // Native Dialog API
      console.log('[MobileAlbumCard] Dialog shown successfully');
    } catch (error) {
      console.error('[MobileAlbumCard] Error showing dialog:', error);
      // Fallback: Manuell anzeigen
      overlay.classList.add('active');
      overlay.style.display = 'flex';
    }
  });
  
  // Schließen bei Klick außerhalb
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMobileAlbumCard();
    }
  });
  
  // Verhindere Scrollen im Hintergrund
  document.body.style.overflow = 'hidden';
}

/**
 * Lädt Cover-Bild asynchron und fügt es ein
 */
async function loadCoverImage(band, album, year, content, info) {
  console.log('[MobileAlbumCard] Loading cover for:', band, album, year);
  
  try {
    const result = await checkCoverExists(band, album, year);
    console.log('[MobileAlbumCard] Cover check result:', result);
    
    if (result.exists && result.filename) {
      // Verwende absoluten Pfad vom Root
      const coverUrl = `/images/covers/${result.filename}`;
      console.log('[MobileAlbumCard] Cover URL:', coverUrl);
      
      const coverContainer = document.createElement('div');
      coverContainer.className = 'mobile-album-card-cover-container';
      // Explizite Styles für Sichtbarkeit - mit expliziten Farben
      coverContainer.style.cssText = `
        width: 100%;
        max-width: 300px;
        margin: 0 auto 20px;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid #404040;
        background: #2a2a2a;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      `;
      
      const coverImage = document.createElement('img');
      coverImage.src = coverUrl;
      coverImage.alt = `${band} - ${album}`;
      coverImage.className = 'mobile-album-card-cover';
      coverImage.loading = 'eager';
      // Explizite Styles für Sichtbarkeit
      coverImage.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      `;
      
      // Test: Füge einen roten Border hinzu, um zu sehen, ob das Bild geladen wird
      console.log('[MobileAlbumCard] Creating cover image with src:', coverUrl);
      
      // Besseres Error-Handling
      coverImage.onerror = (e) => {
        console.error('[MobileAlbumCard] Cover image failed to load:', coverUrl);
        console.error('[MobileAlbumCard] Error details:', e);
        console.error('[MobileAlbumCard] Image element:', coverImage);
        console.error('[MobileAlbumCard] Image src:', coverImage.src);
        coverContainer.remove();
      };
      
      coverImage.onload = () => {
        console.log('[MobileAlbumCard] Cover image loaded successfully:', coverUrl);
        console.log('[MobileAlbumCard] Image dimensions:', coverImage.width, 'x', coverImage.height);
      };
      
      coverContainer.appendChild(coverImage);
      
      // Ersetze Platzhalter mit Cover-Container
      if (content && coverPlaceholder && content.contains(coverPlaceholder)) {
        coverPlaceholder.replaceWith(coverContainer);
        console.log('[MobileAlbumCard] Cover container replaced placeholder');
      } else {
        // Fallback: Einfach am Anfang einfügen
        if (content.firstChild) {
          content.insertBefore(coverContainer, content.firstChild);
        } else {
          content.appendChild(coverContainer);
        }
        console.log('[MobileAlbumCard] Cover container inserted (fallback)');
      }
      
      console.log('[MobileAlbumCard] Cover container inserted, content children:', content.children.length);
      console.log('[MobileAlbumCard] Cover image src:', coverImage.src);
      console.log('[MobileAlbumCard] Cover container visible:', window.getComputedStyle(coverContainer).display);
    } else {
      console.log('[MobileAlbumCard] Cover not found for:', band, album, year);
    }
  } catch (error) {
    // Cover konnte nicht geladen werden, ignorieren
    console.error('[MobileAlbumCard] Error loading cover:', error);
  }
}

/**
 * Schließt die modale Album-Karte
 */
export function closeMobileAlbumCard() {
  if (currentCard) {
    try {
      // Native Dialog API verwenden
      if (currentCard.close) {
        currentCard.close();
      } else {
        currentCard.classList.remove('active');
        currentCard.style.display = 'none';
      }
    } catch (error) {
      console.error('[MobileAlbumCard] Error closing dialog:', error);
      currentCard.classList.remove('active');
      currentCard.style.display = 'none';
    }
    
    // Erlaube Scrollen wieder
    document.body.style.overflow = '';
    
    // Optional: Dialog-Inhalt löschen nach Animation
    setTimeout(() => {
      if (currentCard && currentCard.innerHTML) {
        currentCard.innerHTML = '';
      }
      currentCard = null;
    }, 300);
  }
}

// ESC-Taste zum Schließen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentCard) {
    closeMobileAlbumCard();
  }
});
