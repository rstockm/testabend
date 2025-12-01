/**
 * Keyboard-Navigation für Scatter-Plot
 */

let keyboardNavInstance = null;

/**
 * Keyboard-Navigation für Scatter-Plot einrichten
 */
export function setupScatterKeyboardNav(data, view, chartEl) {
  // Cleanup vorherige Instanz falls vorhanden
  cleanupScatterKeyboardNav();
  
  // TODO: Keyboard-Navigation implementieren
  keyboardNavInstance = {
    data,
    view,
    chartEl
  };
}

/**
 * Keyboard-Navigation aufräumen
 */
export function cleanupScatterKeyboardNav() {
  if (keyboardNavInstance) {
    keyboardNavInstance = null;
  }
}
