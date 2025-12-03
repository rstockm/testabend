/**
 * Utility-Funktionen
 */

/**
 * Logging-Hilfsfunktion
 */
export function log(msg) {
  console.log(typeof msg === 'string' ? msg : JSON.stringify(msg));
}

/**
 * Eindeutige, sortierte Werte aus Array extrahieren
 */
export function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Daten normalisieren
 */
export function normalizeData(data) {
  return data.map(d => ({
    Platz: d.Platz != null ? parseInt(d.Platz, 10) : null,
    Jahr: d.Jahr != null ? parseInt(d.Jahr, 10) : null,
    Band: d.Band != null ? String(d.Band) : '',
    Album: d.Album != null ? String(d.Album) : '',
    Note: d.Note != null ? parseFloat(String(d.Note).replace(',', '.')) : null
  })).filter(d => d.Jahr != null && d.Band && d.Album);
}

/**
 * Domain-Grenzen für Y-Achse berechnen
 */
export function calculateYDomain(notes, minDefault = 2, maxDefault = 4) {
  if (!notes || notes.length === 0) {
    return { min: minDefault, max: maxDefault };
  }
  
  const validNotes = notes.filter(v => v != null && !isNaN(v));
  if (validNotes.length === 0) {
    return { min: minDefault, max: maxDefault };
  }
  
  const minNote = Math.min(...validNotes);
  const maxNote = Math.max(...validNotes);
  
  // Untere Grenze: Wenn kein Album unter 2.3 liegt, beginne bei 2.3
  // Sonst verwende das tatsächliche Minimum (gerundet auf 0.1)
  const min = (minNote < 2.3) 
    ? Math.max(0, Math.floor(minNote * 10) / 10) 
    : 2.3;
  
  // Obere Grenze: Wenn kein Album über 3.8 liegt, enden bei 3.8
  // Sonst verwende das tatsächliche Maximum (gerundet auf 0.1, max 5)
  const max = (maxNote > 3.8)
    ? Math.min(5, Math.ceil(maxNote * 10) / 10)
    : 3.8;
  
  return { min, max };
}

/**
 * Jahr-Bereich generieren
 */
export function generateYearRange(minYear, maxYear) {
  const range = [];
  if (minYear != null && maxYear != null) {
    for (let y = minYear; y <= maxYear; y++) {
      range.push(y);
    }
  }
  return range;
}

/**
 * Prüft ob wir auf einem mobilen Gerät sind
 */
export function isMobile() {
  return window.innerWidth <= 767;
}

/**
 * Vereinfacht die Jahresskala für Mobile (nur jedes N-te Jahr anzeigen)
 * @param {number[]} years - Array aller Jahre
 * @param {number} step - Schrittweite (z.B. 5 = jedes 5. Jahr)
 * @returns {number[]} - Gefilterte Jahre für Labels
 */
export function simplifyYearLabels(years, step = 5) {
  if (!years || years.length === 0) return [];
  if (years.length <= 10) return years; // Bei wenigen Jahren alle anzeigen
  
  const filtered = [];
  for (let i = 0; i < years.length; i += step) {
    filtered.push(years[i]);
  }
  
  // Stelle sicher, dass das letzte Jahr immer dabei ist
  const lastYear = years[years.length - 1];
  if (filtered[filtered.length - 1] !== lastYear) {
    filtered.push(lastYear);
  }
  
  return filtered;
}

/**
 * Hash-Parameter parsen
 */
export function parseHash() {
  const hash = (location.hash || '#band').slice(1);
  const [route, query] = hash.split('?');
  const params = {};
  
  if (query) {
    for (const part of query.split('&')) {
      const [k, v] = part.split('=');
      if (k && v) {
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
  }
  
  return { route: route || 'band', params };
}

/**
 * Hash aktualisieren
 */
export function updateHash(route, params) {
  const q = params && Object.keys(params).length > 0
    ? '?' + Object.entries(params)
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&')
    : '';
  location.hash = '#' + route + q;
}

/**
 * Aktive Navigation setzen
 */
export function setActiveNav(route) {
  // Aktualisiere Tab-Indikator ZUERST (vor dem Setzen der active-Klasse)
  updateMobileTabIndicator(route);
  
  // Dann setze active-Klassen
  ['band', 'scatter', 'testteam', 'jahre'].forEach(r => {
    // Desktop Navigation
    const el = document.getElementById('nav-' + r);
    if (el) el.classList.toggle('active', r === route);
    // Mobile Navigation
    const mobileEl = document.getElementById('nav-' + r + '-mobile');
    if (mobileEl) mobileEl.classList.toggle('active', r === route);
  });
}

/**
 * Aktualisiert die Position des Mobile-Tab-Indikators mit Animation
 */
function updateMobileTabIndicator(route) {
  const indicator = document.getElementById('mobile-tab-indicator');
  const tabsContainer = document.querySelector('.mobile-nav-tabs');
  
  if (!indicator || !tabsContainer) return;
  
  // Finde den Ziel-Tab (auch wenn noch nicht aktiv)
  const targetTab = document.getElementById('nav-' + route + '-mobile');
  if (!targetTab) {
    // Falls Tab nicht gefunden, verstecke Indikator
    indicator.style.opacity = '0';
    return;
  }
  
  // Verwende requestAnimationFrame um sicherzustellen, dass Layout berechnet ist
  // aber setze die Werte synchron, damit die Animation sofort startet
  requestAnimationFrame(() => {
    // Berechne Position und Größe des Ziel-Tabs
    const containerRect = tabsContainer.getBoundingClientRect();
    const tabRect = targetTab.getBoundingClientRect();
    
    const left = tabRect.left - containerRect.left;
    const width = tabRect.width;
    
    // Setze Position und Breite mit Transition (Animation startet sofort)
    indicator.style.opacity = '1';
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.width = `${width}px`;
  });
}

/**
 * Initialisiert den Tab-Indikator beim ersten Laden
 */
export function initMobileTabIndicator() {
  const { route } = parseHash();
  // Kleine Verzögerung, damit Layout berechnet ist
  setTimeout(() => {
    updateMobileTabIndicator(route);
  }, 100);
}

/**
 * Daten nach Jahr gruppieren
 */
export function groupByYear(data) {
  const groups = {};
  data.forEach(d => {
    const j = Number(d.Jahr);
    const n = Number(d.Note);
    if (!isNaN(j) && !isNaN(n)) {
      if (!groups[j]) {
        groups[j] = [];
      }
      groups[j].push(n);
    }
  });
  return groups;
}

/**
 * Min/Max-Daten pro Jahr berechnen
 */
export function calculateMinMaxPerYear(data) {
  const jahrGroups = groupByYear(data);
  return Object.keys(jahrGroups)
    .map(j => ({
      Jahr: Number(j),
      MinNote: Math.min(...jahrGroups[j]),
      MaxNote: Math.max(...jahrGroups[j])
    }))
    .sort((a, b) => a.Jahr - b.Jahr);
}

/**
 * Formatiert eine Note ohne Rundung - zeigt alle verfügbaren Nachkommastellen
 */
export function formatNote(note) {
  if (note == null || isNaN(note)) {
    return String(note);
  }
  // Konvertiere zu String ohne Rundung - JavaScript zeigt automatisch alle Dezimalstellen
  return String(Number(note));
}

/**
 * Ermittelt den Base-Pfad für Assets (z.B. Bilder)
 * Funktioniert sowohl lokal als auch auf Cloudron-Servern mit Unterverzeichnissen
 * 
 * WICHTIG: Gibt einen LEEREN String für Root zurück (wie vorher)
 * - Root: '' (leerer String) → relative Pfade funktionieren
 * - Subdirectory: '/subdir' → absolute Pfade mit Prefix
 */
export function getBasePath() {
  // Prüfe ob ein <base> Tag vorhanden ist
  const baseTag = document.querySelector('base[href]');
  if (baseTag) {
    const baseHref = baseTag.getAttribute('href');
    // Parse URL falls absolut
    try {
      const url = new URL(baseHref, window.location.origin);
      const path = url.pathname;
      // Entferne trailing slash falls vorhanden
      return path.endsWith('/') ? path.slice(0, -1) : path;
    } catch {
      // Falls relative URL, verwende direkt
      return baseHref.endsWith('/') ? baseHref.slice(0, -1) : baseHref;
    }
  }
  
  // Fallback: Ermittle Base-Pfad aus window.location.pathname
  const pathname = window.location.pathname;
  
  // Wenn wir im Root sind (z.B. "/" oder "/index.html")
  // WICHTIG: Gib LEEREN String zurück (nicht '/'), damit relative Pfade funktionieren
  if (pathname === '/' || pathname === '/index.html' || pathname === '') {
    return '';
  }
  
  // Entferne den Dateinamen (z.B. index.html) falls vorhanden
  let basePath = pathname;
  if (basePath.endsWith('.html') || basePath.endsWith('/')) {
    const parts = basePath.split('/').filter(p => p);
    // Entferne den letzten Teil (Dateiname)
    if (parts.length > 0 && parts[parts.length - 1].endsWith('.html')) {
      parts.pop();
    }
    basePath = parts.length > 0 ? '/' + parts.join('/') : '';
  }
  
  // Entferne trailing slash falls vorhanden
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}
