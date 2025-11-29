/**
 * Hauptanwendungslogik
 */
import { log, normalizeData, uniqueSorted, getCoversBasePath } from './utils.js';
import { Router } from './router.js';
import { setupCoverTooltipHandler } from './coverTooltip.js';
import { setupMobileNavigation } from './mobileNav.js';

/**
 * Setzt eine CSS-Variable mit der aktuellen Header-Höhe.
 * So können mobile Layouts dynamisch auf Änderungen reagieren.
 */
function updateHeaderHeightVar() {
  const header = document.querySelector('header');
  if (!header) {
    return;
  }
  const height = header.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--header-height-mobile', `${height}px`);
}

/**
 * Hauptfunktion
 */
export async function main() {
  try {
    // Pfad-Erkennung für Cover-Bilder initialisieren (im Hintergrund)
    // Das setzt den Cache, damit spätere Aufrufe synchron funktionieren
    getCoversBasePath().catch(err => {
      console.warn('[main] Cover path detection failed:', err);
    });
    
    // DOM-Elemente
    const controlsEl = document.getElementById('controls');
    const chartEl = document.getElementById('chart');
    
    if (!controlsEl || !chartEl) {
      log('Fehler: DOM-Elemente nicht gefunden');
      return;
    }
    
    // Header-Höhe initial setzen und bei Resize aktualisieren
    updateHeaderHeightVar();
    window.addEventListener('resize', updateHeaderHeightVar);
    
    const mainEl = document.querySelector('main');
    if (mainEl) {
      const updateMainPadding = () => {
        if (window.innerWidth <= 767) {
          mainEl.style.paddingTop = '0px';
        } else {
          mainEl.style.paddingTop = '';
        }
      };
      updateMainPadding();
      window.addEventListener('resize', updateMainPadding);
    }
    
    // Daten laden
    const resp = await fetch('data/alben.json', { cache: 'no-store' });
    const data = await resp.json();
    
    log('Daten geladen: ' + (Array.isArray(data) ? data.length : 'keine Array-Struktur'));
    
    if (!Array.isArray(data) || data.length === 0) {
      log('Keine Daten – Diagramm wird nicht gerendert.');
      return;
    }
    
    // Daten normalisieren
    const normalized = normalizeData(data);
    const bands = uniqueSorted(normalized.map(d => d.Band));
    
    // Router initialisieren
    const router = new Router(normalized, bands, chartEl, controlsEl);
    
    // Hash-Change Event Listener
    window.addEventListener('hashchange', () => router.route());
    
    // Initiale Route
    if (!location.hash) {
      location.hash = '#overview';
    }
    
    await router.route();
    
    // Initialisiere Cover-Tooltip-Handler
    setupCoverTooltipHandler();
    
    // Initialisiere Mobile Navigation (Burger-Menü)
    setupMobileNavigation();
  } catch (e) {
    console.error(e);
    log('Fehler: ' + (e && e.message ? e.message : String(e)));
  }
}

// Starte Anwendung wenn DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
