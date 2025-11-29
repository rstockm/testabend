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
  const hash = (location.hash || '#overview').slice(1);
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
  
  return { route: route || 'overview', params };
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
  ['overview', 'band', 'scatter', 'testteam'].forEach(r => {
    // Desktop Navigation
    const el = document.getElementById('nav-' + r);
    if (el) el.classList.toggle('active', r === route);
    // Mobile Navigation
    const mobileEl = document.getElementById('nav-' + r + '-mobile');
    if (mobileEl) mobileEl.classList.toggle('active', r === route);
  });
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
 * Ermittelt den Base-Pfad für Cover-Bilder
 * Funktioniert sowohl lokal als auch auf Cloudron mit verschiedenen URL-Strukturen
 * Testet mehrere Pfade und verwendet den funktionierenden
 * @returns {Promise<string>} Base-Pfad für Cover-Bilder (z.B. "/images/covers/")
 */
let cachedCoversBasePath = null;
let pathDetectionPromise = null;

async function testCoverPath(basePath, testFilename = 'test.jpg') {
  const testPath = basePath.endsWith('/') 
    ? basePath + testFilename 
    : basePath + '/' + testFilename;
  
  try {
    const response = await fetch(testPath, { method: 'HEAD', cache: 'no-cache' });
    // Auch 404 ist OK - bedeutet nur, dass der Pfad existiert, aber das Test-Bild nicht
    // Wichtig ist, dass wir keine Netzwerk-Fehler bekommen
    return response.status !== 0; // 0 bedeutet meist CORS/Netzwerk-Fehler
  } catch (error) {
    return false;
  }
}

async function detectCoversBasePath() {
  const candidates = [];
  
  // Strategie 1: Prüfe ob ein <base> Tag existiert
  const baseTag = document.querySelector('base');
  if (baseTag && baseTag.href) {
    try {
      const baseUrl = new URL(baseTag.href);
      const basePath = baseUrl.pathname.endsWith('/') 
        ? baseUrl.pathname + 'images/covers/'
        : baseUrl.pathname + '/images/covers/';
      candidates.push(basePath);
    } catch (e) {
      console.warn('[getCoversBasePath] Invalid base tag URL:', e);
    }
  }

  // Strategie 2: Absoluter Pfad vom Root (häufigster Fall)
  candidates.push('/images/covers/');

  // Strategie 3: Relativer Pfad basierend auf window.location
  const pathname = window.location.pathname;
  
  // Wenn wir im Root sind (z.B. "/index.html" oder "/")
  if (pathname === '/' || pathname === '/index.html' || pathname.endsWith('/index.html')) {
    // Bereits als '/images/covers/' hinzugefügt
  } else {
    // Wenn wir in einem Subverzeichnis sind
    const pathParts = pathname.split('/').filter(p => p && !p.endsWith('.html'));
    if (pathParts.length > 0) {
      const baseDir = '/' + pathParts.join('/') + '/images/covers/';
      candidates.push(baseDir);
    }
  }

  // Strategie 4: Relativer Pfad vom aktuellen Verzeichnis
  const currentDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  if (currentDir && currentDir !== '/') {
    candidates.push(currentDir + 'images/covers/');
  }

  // Entferne Duplikate
  const uniqueCandidates = [...new Set(candidates)];

  console.log('[getCoversBasePath] Testing candidates:', uniqueCandidates);

  // Teste die Kandidaten (beginne mit dem wahrscheinlichsten)
  for (const candidate of uniqueCandidates) {
    // Teste mit einem bekannten Test-Bild oder einfach die Existenz des Verzeichnisses
    // Wir testen mit einem sehr unwahrscheinlichen Dateinamen - wenn wir 404 bekommen,
    // bedeutet das, dass der Pfad existiert (nur das Bild nicht)
    const isValid = await testCoverPath(candidate, '__path_test__');
    if (isValid) {
      console.log('[getCoversBasePath] Valid path found:', candidate);
      return candidate;
    }
  }

  // Fallback: Verwende den ersten Kandidaten (meist '/images/covers/')
  const fallback = uniqueCandidates[0] || '/images/covers/';
  console.warn('[getCoversBasePath] No valid path found, using fallback:', fallback);
  return fallback;
}

export async function getCoversBasePath() {
  // Cache für Performance
  if (cachedCoversBasePath !== null) {
    return cachedCoversBasePath;
  }

  // Wenn bereits eine Detection läuft, warte darauf
  if (pathDetectionPromise) {
    return pathDetectionPromise;
  }

  // Starte Detection
  pathDetectionPromise = detectCoversBasePath();
  cachedCoversBasePath = await pathDetectionPromise;
  pathDetectionPromise = null;
  
  return cachedCoversBasePath;
}

// Synchroner Fallback für sofortige Verwendung (verwendet Standard-Pfad)
export function getCoversBasePathSync() {
  if (cachedCoversBasePath !== null) {
    return cachedCoversBasePath;
  }
  
  // Verwende Standard-Pfad bis Detection abgeschlossen ist
  return '/images/covers/';
}

/**
 * Erstellt vollständigen Pfad zu einem Cover-Bild
 * Gibt mehrere mögliche Pfade zurück (für Fallback-Mechanismus)
 * @param {string} filename - Dateiname des Covers (z.B. "Band_Album.jpg")
 * @returns {string[]} Array von möglichen Pfaden (vom wahrscheinlichsten zum unwahrscheinlichsten)
 */
export function getCoverImagePaths(filename) {
  if (!filename) return [];
  const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
  
  const paths = [];
  
  // 1. Verwende gecachten Pfad (falls bereits erkannt)
  const cachedPath = getCoversBasePathSync();
  paths.push((cachedPath.endsWith('/') ? cachedPath : cachedPath + '/') + cleanFilename);
  
  // 2. Absoluter Pfad vom Root (häufigster Fall)
  paths.push('/images/covers/' + cleanFilename);
  
  // 3. Relativer Pfad basierend auf window.location
  const pathname = window.location.pathname;
  if (pathname && pathname !== '/' && !pathname.endsWith('/index.html')) {
    const pathParts = pathname.split('/').filter(p => p && !p.endsWith('.html'));
    if (pathParts.length > 0) {
      paths.push('/' + pathParts.join('/') + '/images/covers/' + cleanFilename);
    }
  }
  
  // Entferne Duplikate
  return [...new Set(paths)];
}

/**
 * Erstellt vollständigen Pfad zu einem Cover-Bild (für direkte Verwendung)
 * @param {string} filename - Dateiname des Covers (z.B. "Band_Album.jpg")
 * @returns {string} Vollständiger Pfad zum Cover (verwendet gecachten Pfad oder Fallback)
 */
export function getCoverImagePath(filename) {
  if (!filename) return '';
  const paths = getCoverImagePaths(filename);
  return paths[0]; // Verwende den ersten (wahrscheinlichsten) Pfad
}

/**
 * Erstellt vollständigen Pfad zu einem Cover-Bild (async, wartet auf Pfad-Detection)
 * @param {string} filename - Dateiname des Covers (z.B. "Band_Album.jpg")
 * @returns {Promise<string>} Vollständiger Pfad zum Cover
 */
export async function getCoverImagePathAsync(filename) {
  if (!filename) return '';
  const basePath = await getCoversBasePath();
  // Stelle sicher, dass basePath mit / endet und filename nicht mit / beginnt
  const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
  const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
  return cleanBase + cleanFilename;
}
