/**
 * Verwaltung des Highlight-Datasets innerhalb des Vega-Charts.
 * Stellt sicher, dass das orange Highlight immer über das Chart gerendert wird.
 */

let chartView = null;
const vegaGlobal = typeof window !== 'undefined' ? window.vega : null;

/**
 * Initialisiert Highlight-Verwaltung für die übergebene View.
 */
export function setupScatterHighlight(view) {
  chartView = view;
  updateScatterHighlight(null);
}

/**
 * Aktualisiert das Highlight-Dataset mit dem übergebenen Datum.
 */
export function updateScatterHighlight(datum) {
  if (!chartView || !vegaGlobal || typeof vegaGlobal.changeset !== 'function') return;
  
  try {
    const changeSet = vegaGlobal.changeset().remove(() => true);
    
    if (datum) {
      const year = Number(datum.Jahr);
      const note = Number(datum.Note);
      if (!Number.isNaN(year) && !Number.isNaN(note)) {
        changeSet.insert({
          Jahr: year,
          Note: note,
          Band: datum.Band || '',
          Album: datum.Album || '',
          Platz: datum.Platz ?? null
        });
      }
    }
    
    chartView.change('highlightSelection', changeSet).run();
  } catch (error) {
    console.warn('[ScatterHighlight] Highlight-Update fehlgeschlagen', error);
  }
}

/**
 * Entfernt Highlight und gibt Ressourcen frei.
 */
export function teardownScatterHighlight() {
  updateScatterHighlight(null);
  chartView = null;
}


