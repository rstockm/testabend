/**
 * Hauptanwendungslogik
 */
import { log, normalizeData, uniqueSorted } from './utils.js';
import { Router } from './router.js';
import { setupCoverTooltipHandler } from './coverTooltip.js';
import { setupMobileNavigation } from './mobileNav.js';

/**
 * Hauptfunktion
 */
export async function main() {
  try {
    // DOM-Elemente
    const controlsEl = document.getElementById('controls');
    const chartEl = document.getElementById('chart');
    
    if (!controlsEl || !chartEl) {
      log('Fehler: DOM-Elemente nicht gefunden');
      return;
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
      location.hash = '#band';
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
