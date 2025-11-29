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
  
  if (year) {
    const filenameWithYear = getCoverFilename(band, album, year);
    const coverPathWithYear = coversBase + filenameWithYear;
    
    try {
      const response = await fetch(coverPathWithYear, { method: 'HEAD', cache: 'no-cache' });
      if (response.ok) {
        return { exists: true, filename: filenameWithYear };
      }
    } catch (error) {
      console.debug('Cover check failed (with year):', coverPathWithYear, error);
      // Weiter zu Fallback ohne Jahr
    }
  }
  
  const filenameWithoutYear = getCoverFilename(band, album, null);
  const coverPathWithoutYear = coversBase + filenameWithoutYear;
  
  try {
    const response = await fetch(coverPathWithoutYear, { method: 'HEAD', cache: 'no-cache' });
    if (response.ok) {
      return { exists: true, filename: filenameWithoutYear };
    }
  } catch (error) {
    console.debug('Cover check failed (without year):', coverPathWithoutYear, error);
    // Cover nicht gefunden
  }
  
  return { exists: false, filename: null };
}

let currentCard = null;

/**
 * Zeigt modale Album-Karte auf Mobile
 */
export function showMobileAlbumCard(datum) {
  if (!isMobile()) return; // Nur auf Mobile
  
  // Entferne bestehende Karte falls vorhanden
  if (currentCard) {
    closeMobileAlbumCard();
  }
  
  // Erstelle Overlay
  const overlay = document.createElement('div');
  overlay.className = 'mobile-album-card-overlay';
  
  // Erstelle Karte
  const card = document.createElement('div');
  card.className = 'mobile-album-card';
  
  // Close-Button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-album-card-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.addEventListener('click', closeMobileAlbumCard);
  
  // Content
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  
  // Info-Bereich
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
  
  // Cover-Bild asynchron laden
  loadCoverImage(datum.Band, datum.Album, datum.Jahr, content, info);
  
  card.appendChild(closeBtn);
  card.appendChild(content);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  currentCard = overlay;
  
  // Aktiviere Overlay (für Animation)
  requestAnimationFrame(() => {
    overlay.classList.add('active');
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
  try {
    const result = await checkCoverExists(band, album, year);
    
    if (result.exists && result.filename) {
      // Verwende absoluten Pfad vom Root
      const coverUrl = `/images/covers/${result.filename}`;
      
      const coverContainer = document.createElement('div');
      coverContainer.className = 'mobile-album-card-cover-container';
      
      const coverImage = document.createElement('img');
      coverImage.src = coverUrl;
      coverImage.alt = `${band} - ${album}`;
      coverImage.className = 'mobile-album-card-cover';
      coverImage.loading = 'lazy';
      
      coverImage.onerror = () => {
        coverContainer.remove();
      };
      
      coverContainer.appendChild(coverImage);
      content.insertBefore(coverContainer, info);
    }
  } catch (error) {
    // Cover konnte nicht geladen werden, ignorieren
    console.debug('Cover konnte nicht geladen werden:', error);
  }
}

/**
 * Schließt die modale Album-Karte
 */
export function closeMobileAlbumCard() {
  if (currentCard) {
    currentCard.classList.remove('active');
    setTimeout(() => {
      currentCard.remove();
      currentCard = null;
      // Erlaube Scrollen wieder
      document.body.style.overflow = '';
    }, 300); // Warte auf Animation
  }
}

// ESC-Taste zum Schließen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentCard) {
    closeMobileAlbumCard();
  }
});
