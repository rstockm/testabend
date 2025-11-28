/**
 * Konfiguration und Konstanten für die Anwendung
 */
export const CONFIG = {
  // Chart-Dimensionen
  CHART: {
    OVERVIEW_HEIGHT: 420,
    BANDS_HEIGHT: 580,
    SCATTER_WIDTH: 800,
    SCATTER_HEIGHT: 520,
    SCATTER_PADDING: { left: 60, right: 20, top: 10, bottom: 50 }
  },
  
  // Domain-Grenzen
  DOMAIN: {
    MIN_YEAR: 1998,
    MAX_YEAR: 2024,
    MIN_NOTE_DEFAULT: 2,
    MAX_NOTE_DEFAULT: 4,
    MIN_NOTE_FLOOR: 0,
    MAX_NOTE_CEILING: 5
  },
  
  // Opacity-Werte
  OPACITY: {
    LINE_DEFAULT: 0.7,
    LINE_WITH_REGRESSION: 0.32,
    REGRESSION_LINE: 0.8,
    POINT: 0.4
  },
  
  // Regression
  REGRESSION: {
    MIN_POINTS: 3,
    DEGREE: 2,
    SINGULARITY_THRESHOLD: 1e-10
  },
  
  // UI
  UI: {
    POINT_SIZE: 120,
    REGRESSION_STROKE_WIDTH: 4,
    REGRESSION_STROKE_DASH: [4, 4],
    TITLE_FONT_SIZE: 11,
    TITLE_OFFSET: -14
  },
  
  // Farben
  COLORS: {
    POINT: '#4a9dd4',
    MAX_LINE: '#90EE90',
    MIN_LINE: '#FF6B6B'
  }
};

/**
 * Vega-Lite Dark Theme Konfiguration
 */
export function getDarkThemeConfig() {
  return {
    background: "transparent",
    title: { color: "#f5f5f5", font: "system-ui, sans-serif" },
    axis: {
      domainColor: "#525252",
      gridColor: "#404040",
      tickColor: "#525252",
      labelColor: "#d4d4d4",
      titleColor: "#e5e5e5"
    },
    legend: {
      labelColor: "#d4d4d4",
      titleColor: "#e5e5e5"
    },
    view: {
      stroke: "transparent"
    },
    tooltip: {
      color: "#f5f5f5",
      fill: "#1e1e1e",
      stroke: "#404040",
      strokeWidth: 1,
      cornerRadius: 12,
      padding: 16,
      font: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      fontSize: 17,
      fontStyle: "normal",
      fontWeight: "normal"
    }
  };
}

/**
 * Band-Farbpalette
 */
export function getBandPalette() {
  const basePalette = (window.vega && vega.scheme) 
    ? vega.scheme('category10') 
    : ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
  // Erste Farbe heller machen: #1f77b4 -> ~20% heller
  const lighterBlue = '#4a9dd4';
  return [lighterBlue, ...basePalette.slice(1)];
}
