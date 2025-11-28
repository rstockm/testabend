import { createScatterInfoBox, updateScatterInfoBox, destroyScatterInfoBox } from './scatterInfoBox.js';
import { setupScatterHighlight, teardownScatterHighlight } from './scatterHighlight.js';

/**
 * Keyboard-Navigation für Scatter-Chart
 * Ermöglicht Navigation zwischen Punkten mit Pfeiltasten
 */

let scatterData = null;
let sortedByNote = null; // Nach Note sortiert (für Links/Rechts)
let sortedByYear = null; // Nach Jahr, dann Note sortiert (für Rauf/Runter)
let currentIndex = -1;
let currentYearIndex = -1;
let currentYear = null;
let chartView = null;
let chartElement = null;

/**
 * Initialisiert Keyboard-Navigation für Scatter-Chart
 */
export function setupScatterKeyboardNav(data, view, chartEl) {
  scatterData = data;
  chartView = view;
  chartElement = chartEl;
  setupScatterHighlight(view);
  
  // Erstelle feste Info-Box rechts neben dem Chart
  createScatterInfoBox();
  
  // Sortiere Daten nach Note (Y-Koordinate) für Links/Rechts-Navigation
  sortedByNote = [...data]
    .filter(d => d.Jahr != null && d.Note != null && !isNaN(d.Jahr) && !isNaN(d.Note))
    .sort((a, b) => {
      // Sortiere nach Note (absteigend), dann nach Jahr
      const noteDiff = Number(b.Note) - Number(a.Note);
      if (noteDiff !== 0) return noteDiff;
      return Number(b.Jahr) - Number(a.Jahr);
    });
  
  // Sortiere Daten nach Jahr, dann Note für Rauf/Runter-Navigation
  sortedByYear = [...data]
    .filter(d => d.Jahr != null && d.Note != null && !isNaN(d.Jahr) && !isNaN(d.Note))
    .sort((a, b) => {
      // Sortiere nach Jahr (aufsteigend), dann nach Note (absteigend)
      const yearDiff = Number(a.Jahr) - Number(b.Jahr);
      if (yearDiff !== 0) return yearDiff;
      return Number(b.Note) - Number(a.Note);
    });
  
  // Tracke aktuellen Hover-Punkt
  trackHoveredPoint();
  
  // Keyboard-Event-Listener hinzufügen
  setupKeyboardListener();
}

/**
 * Trackt den aktuell gehoverten Punkt
 */
function trackHoveredPoint() {
  if (!chartView || !chartElement) return;
  
  // Vega-Lite signalisiert Hover-Events über die View-API
  chartView.addEventListener('mousemove', (event, item) => {
    if (item && item.datum) {
      const datum = item.datum;
      
      // Entferne alle Vega-Lite Tooltips (wir nutzen unsere Info-Box)
      const existingTooltips = document.querySelectorAll('.vg-tooltip, .vega-tooltip');
      existingTooltips.forEach(t => t.remove());
      
      // Aktualisiere Info-Box
      updateScatterInfoBox(datum);
      
      // Finde Index in beiden sortierten Arrays
      const noteIndex = sortedByNote.findIndex(d => 
        d.Band === datum.Band && 
        d.Album === datum.Album && 
        d.Jahr === datum.Jahr &&
        Math.abs(Number(d.Note) - Number(datum.Note)) < 0.001
      );
      if (noteIndex !== -1) {
        currentIndex = noteIndex;
      }
      
      // Finde Index im Jahr-sortierten Array
      const yearIndex = sortedByYear.findIndex(d => 
        d.Band === datum.Band && 
        d.Album === datum.Album && 
        d.Jahr === datum.Jahr &&
        Math.abs(Number(d.Note) - Number(datum.Note)) < 0.001
      );
      if (yearIndex !== -1) {
        currentYearIndex = yearIndex;
        currentYear = Number(datum.Jahr);
      }
    }
  });
  
  // Kein Observer mehr nötig - wir nutzen die feste Info-Box
  // Tooltips werden automatisch entfernt durch mousemove Event
  
  // Index bleibt erhalten wenn Maus das Chart verlässt (kein zusätzlicher Handler nötig)
}

/**
 * Richtet Keyboard-Event-Listener ein
 */
function setupKeyboardListener() {
  // Entferne vorherigen Listener falls vorhanden
  document.removeEventListener('keydown', handleKeyboardNavigation);
  
  // Füge neuen Listener hinzu
  document.addEventListener('keydown', handleKeyboardNavigation);
}

/**
 * Behandelt Keyboard-Navigation
 */
function handleKeyboardNavigation(event) {
  // Nur aktiv wenn Scatter-View aktiv ist
  if (!scatterData || !sortedByNote || !sortedByYear || sortedByNote.length === 0) return;
  
  // Prüfe ob wir im Scatter-View sind
  const isScatterView = window.location.hash.startsWith('#scatter');
  if (!isScatterView) return;
  
  // Nur Pfeiltasten behandeln
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  
  // Verhindere Standard-Scrolling nur wenn ein Input-Feld nicht fokussiert ist
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    return; // Lass Input-Felder normal funktionieren
  }
  
  event.preventDefault();
  
  let datum = null;
  
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    // Rauf/Runter: Navigation innerhalb des Jahres
    if (currentYearIndex === -1 || currentYear === null) {
      // Starte beim ersten Album des ersten Jahres
      currentYearIndex = 0;
      currentYear = sortedByYear[0].Jahr;
    }
    
    // Finde alle Alben im aktuellen Jahr
    const albumsInYear = sortedByYear.filter(d => Number(d.Jahr) === currentYear);
    const currentIndexInYear = albumsInYear.findIndex(d => {
      const currentDatum = sortedByYear[currentYearIndex];
      return d.Band === currentDatum.Band && d.Album === currentDatum.Album;
    });
    
    if (event.key === 'ArrowUp') {
      // Zum Album darüber im selben Jahr (höhere Note)
      if (currentIndexInYear > 0) {
        const prevDatum = albumsInYear[currentIndexInYear - 1];
        const newIndex = sortedByYear.findIndex(d => 
          d.Band === prevDatum.Band && 
          d.Album === prevDatum.Album && 
          d.Jahr === prevDatum.Jahr
        );
        if (newIndex !== -1) {
          currentYearIndex = newIndex;
          datum = prevDatum;
        }
      }
    } else if (event.key === 'ArrowDown') {
      // Zum Album darunter im selben Jahr (niedrigere Note)
      if (currentIndexInYear < albumsInYear.length - 1) {
        const nextDatum = albumsInYear[currentIndexInYear + 1];
        const newIndex = sortedByYear.findIndex(d => 
          d.Band === nextDatum.Band && 
          d.Album === nextDatum.Album && 
          d.Jahr === nextDatum.Jahr
        );
        if (newIndex !== -1) {
          currentYearIndex = newIndex;
          datum = nextDatum;
        }
      }
    }
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    // Links/Rechts: Navigation nach Note (höher/niedriger)
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    if (event.key === 'ArrowLeft') {
      // Zum Album mit höherer Note
      if (currentIndex > 0) {
        currentIndex--;
        datum = sortedByNote[currentIndex];
        // Update auch Jahr-Index
        const yearIndex = sortedByYear.findIndex(d => 
          d.Band === datum.Band && 
          d.Album === datum.Album && 
          d.Jahr === datum.Jahr
        );
        if (yearIndex !== -1) {
          currentYearIndex = yearIndex;
          currentYear = datum.Jahr;
        }
      }
    } else if (event.key === 'ArrowRight') {
      // Zum Album mit niedrigerer Note
      if (currentIndex < sortedByNote.length - 1) {
        currentIndex++;
        datum = sortedByNote[currentIndex];
        // Update auch Jahr-Index
        const yearIndex = sortedByYear.findIndex(d => 
          d.Band === datum.Band && 
          d.Album === datum.Album && 
          d.Jahr === datum.Jahr
        );
        if (yearIndex !== -1) {
          currentYearIndex = yearIndex;
          currentYear = datum.Jahr;
        }
      }
    }
  }
  
  // Zeige Tooltip für aktuellen Punkt
  if (datum) {
    showTooltipForDatum(datum);
  }
}

/**
 * Zeigt Tooltip für gegebenes Datum
 */
function showTooltipForDatum(datum) {
  if (!datum) return;

  updateScatterInfoBox(datum);
}

/**
 * Entfernt Keyboard-Navigation
 */
export function cleanupScatterKeyboardNav() {
  document.removeEventListener('keydown', handleKeyboardNavigation);

  destroyScatterInfoBox();
  teardownScatterHighlight();
  
  scatterData = null;
  sortedByNote = null;
  sortedByYear = null;
  currentIndex = -1;
  currentYearIndex = -1;
  currentYear = null;
  chartView = null;
  chartElement = null;
}
