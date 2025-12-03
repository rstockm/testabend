import { updateScatterHighlight } from './scatterHighlight.js';
import { isMobile } from './utils.js';

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
      <tr><td class="key">Note</td><td class="value">${datum.Note != null ? datum.Note : '-'}</td></tr>
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
  
  // Prüfe, ob diese Anfrage noch aktuell ist
  if (requestId !== currentCoverRequestId) {
    console.log('[scatterInfoBox] Request outdated, skipping:', requestId, 'current:', currentCoverRequestId);
    return;
  }
  
  // Prüfe erneut, ob infoBox noch existiert
  if (!infoBox || !infoBox.parentNode) {
    console.log('[scatterInfoBox] InfoBox removed, skipping');
    return;
  }
  
  // Importiere getCoverUrls dynamisch (ist async in coverTooltip.js)
  const { getCoverUrls } = await import('./coverTooltip.js');
  const coverUrls = await getCoverUrls(datum.Band, datum.Album, datum.Jahr);
  
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
  
  const coverImage = document.createElement('img');
  coverImage.alt = `${datum.Band} - ${datum.Album}`;
  coverImage.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  `;
  
  // Robuste Logik: Versuche primary, dann fallback
  coverImage.onload = () => {
    if (coverContainer.parentNode && requestId === currentCoverRequestId) {
      console.log('[scatterInfoBox] Cover image loaded successfully');
    } else {
      coverContainer.remove();
    }
  };
  
  coverImage.onerror = () => {
    // Versuche Fallback-URL
    if (coverUrls.fallback && coverImage.src !== coverUrls.fallback) {
      console.log('[scatterInfoBox] Primary cover failed, trying fallback:', coverUrls.fallback);
      coverImage.src = coverUrls.fallback;
    } else {
      console.log('[scatterInfoBox] Cover image failed to load');
      if (coverContainer.parentNode) {
        coverContainer.remove();
      }
    }
  };
  
  coverContainer.appendChild(coverImage);
  
  // Prüfe nochmal, ob Request noch aktuell ist, bevor Container angehängt wird
  if (requestId !== currentCoverRequestId || !infoBox || !infoBox.parentNode) {
    console.log('[scatterInfoBox] Request outdated before append, skipping');
    return;
  }
  
  // Setze src NACH dem Anhängen an Container
  coverImage.src = coverUrls.primary;
  
  infoBox.appendChild(coverContainer);
}
