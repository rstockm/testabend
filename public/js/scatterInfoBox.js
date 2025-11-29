import { updateScatterHighlight } from './scatterHighlight.js';
import { isMobile, getCoverImagePath } from './utils.js';

let infoBox = null;
let currentCoverRequestId = 0;
const PLACEHOLDER_HTML = `
    <div style="color: var(--text-muted); text-align: center; padding: 40px 0;">
      Bewege die Maus über einen Punkt oder nutze die Pfeiltasten
    </div>
  `;

/**
 * Erstellt oder ersetzt die feste Info-Box rechts neben dem Scatter-Chart.
 */
export function createScatterInfoBox(containerId = 'scatter-container') {
  // Auf Mobile keine Info-Box erstellen
  if (isMobile()) return null;
  
  const scatterContainer = document.getElementById(containerId);
  if (!scatterContainer) return null;
  
  destroyScatterInfoBox();
  
  infoBox = document.createElement('div');
  infoBox.className = 'scatter-info-box';
  infoBox.style.cssText = `
    width: 350px;
    min-height: 200px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;
  infoBox.innerHTML = PLACEHOLDER_HTML;
  
  scatterContainer.appendChild(infoBox);
  updateScatterHighlight(null);
  return infoBox;
}

/**
 * Aktualisiert die Info-Box-Inhalte für das angegebene Datum.
 */
export function updateScatterInfoBox(datum) {
  if (!infoBox) return;
  
  if (!datum) {
    infoBox.innerHTML = PLACEHOLDER_HTML;
    updateScatterHighlight(null);
    return;
  }
  
  // Entferne altes Cover falls vorhanden
  const oldCover = infoBox.querySelector('.scatter-info-cover');
  if (oldCover) {
    oldCover.remove();
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'scatter-info-content';
  contentDiv.innerHTML = `
    <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
      <tr><td class="key">Band</td><td class="value">${datum.Band}</td></tr>
      <tr><td class="key">Album</td><td class="value">${datum.Album}</td></tr>
      <tr><td class="key">Jahr</td><td class="value">${datum.Jahr}</td></tr>
      <tr><td class="key">Platz</td><td class="value">${datum.Platz}</td></tr>
      <tr><td class="key">Note</td><td class="value">${datum.Note}</td></tr>
    </table>
  `;
  
  infoBox.innerHTML = '';
  infoBox.appendChild(contentDiv);
  
  const requestId = ++currentCoverRequestId;
  addCoverToInfoBox(datum, requestId);
  updateScatterHighlight(datum);
}

/**
 * Entfernt die Info-Box vollständig.
 */
export function destroyScatterInfoBox() {
  if (infoBox && infoBox.parentNode) {
    infoBox.parentNode.removeChild(infoBox);
  }
  infoBox = null;
  updateScatterHighlight(null);
}

async function addCoverToInfoBox(datum, requestId) {
  if (!infoBox) return;
  
  const coverContainer = document.createElement('div');
  coverContainer.className = 'scatter-info-cover';
  coverContainer.style.cssText = `
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--border-color);
    background: var(--bg-tertiary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    margin-top: 16px;
  `;
  
  const result = await findCover(datum);
  if (!result) return;
  if (requestId !== currentCoverRequestId) {
    return; // Eine neuere Anfrage hat bereits die Info-Box aktualisiert
  }
  
  const coverImage = document.createElement('img');
  const coverPath = getCoverImagePath(result);
  coverImage.src = coverPath;
  coverImage.alt = `${datum.Band} - ${datum.Album}`;
  console.log('[scatterInfoBox] Loading cover image:', coverPath, 'for', datum.Band, '-', datum.Album);
  coverImage.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  `;
  coverImage.onerror = (e) => {
    console.error('[scatterInfoBox] Cover image failed to load:', coverPath, e);
    coverContainer.remove();
  };
  coverImage.onload = () => {
    console.log('[scatterInfoBox] Cover image loaded successfully:', coverPath);
  };
  
  coverContainer.appendChild(coverImage);
  infoBox.appendChild(coverContainer);
}

async function findCover(datum) {
  if (!datum) return null;
  
  const filenameWithYear = getCoverFilename(datum.Band, datum.Album, datum.Jahr);
  if (await coverExists(filenameWithYear)) {
    return filenameWithYear;
  }
  
  const filenameWithoutYear = getCoverFilename(datum.Band, datum.Album);
  if (await coverExists(filenameWithoutYear)) {
    return filenameWithoutYear;
  }
  
  return null;
}

async function coverExists(filename) {
  if (!filename) return false;
  const path = getCoverImagePath(filename);
  console.log('[scatterInfoBox] Checking cover exists:', filename, '->', path);
  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-cache' });
    const exists = response.ok;
    console.log('[scatterInfoBox] Cover exists check result:', path, '->', exists, 'status:', response.status);
    return exists;
  } catch (error) {
    console.error('[scatterInfoBox] Cover exists check failed:', path, error);
    return false;
  }
}

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
