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
  if (!isMobile() || !datum) return;
  
  closeMobileAlbumCard(true);
  
  const overlay = document.createElement('div');
  overlay.className = 'mobile-album-card-overlay';
  
  const card = document.createElement('div');
  card.className = 'mobile-album-card';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-album-card-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMobileAlbumCard();
  });
  
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  
  const info = document.createElement('div');
  info.className = 'mobile-album-card-info';
  
  const title = document.createElement('h3');
  title.textContent = `${datum.Band} - ${datum.Album}`;
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
    const tdValue = document.createElement('td');
    tdValue.textContent = row.value;
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
  document.body.appendChild(overlay);
  
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMobileAlbumCard();
    }
  });
  
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
      const coverUrl = `/images/covers/${result.filename}`;
      
      const coverContainer = document.createElement('div');
      coverContainer.className = 'mobile-album-card-cover-container';
      
      const coverImage = document.createElement('img');
      coverImage.src = coverUrl;
      coverImage.alt = `${band} - ${album}`;
      coverImage.className = 'mobile-album-card-cover';
      coverImage.loading = 'eager';
      coverImage.onerror = () => coverContainer.remove();
      
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
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (currentCard === overlay) {
      currentCard = null;
    }
    document.body.style.overflow = '';
  };
  
  if (immediate) {
    removeOverlay();
    return;
  }
  
  overlay.classList.remove('active');
  setTimeout(removeOverlay, 200);
}

// ESC-Taste zum Schließen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentCard) {
    closeMobileAlbumCard();
  }
});
