/**
 * Chart-Rendering-Funktionen
 */
import { CONFIG, getDarkThemeConfig, getBandPalette } from './config.js';
import { generateYearRange, calculateYDomain, calculateMinMaxPerYear, isMobile, simplifyYearLabels } from './utils.js';
import { polynomialRegression, generateRegressionPoints } from './regression.js';
import { setupCoverTooltipHandler } from './coverTooltip.js';
import { setupScatterKeyboardNav } from './scatterKeyboardNav.js';
import { setupMobileTouchHandlers } from './mobileTouchHandler.js';

/**
 * Overview-Chart rendern
 */
export async function renderOverview(data, chartEl) {
  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    description: "Anzahl Alben pro Jahr",
    data: { values: data },
    config: getDarkThemeConfig(),
    mark: "bar",
    width: "container",
    height: CONFIG.CHART.OVERVIEW_HEIGHT,
    encoding: {
      x: { field: "Jahr", type: "ordinal", sort: "ascending", axis: { labelAngle: 0 } },
      y: { aggregate: "count", type: "quantitative", title: "Anzahl Alben" },
      tooltip: [
        { aggregate: "count", type: "quantitative", title: "Anzahl" },
        { field: "Jahr", type: "ordinal" }
      ]
    }
  };
  await vegaEmbed(chartEl, spec, { actions: false });
  setupCoverTooltipHandler();
}

/**
 * Scatter-Chart rendern
 */
export async function renderScatterAll(data, chartEl, zoomY = null) {
  // Filtere Daten
  const filtered = data.filter(d => 
    d.Jahr != null && d.Note != null && !isNaN(d.Jahr) && !isNaN(d.Note)
  );
  
  if (filtered.length === 0) {
    chartEl.innerHTML = '<p style="padding: 40px; text-align: center; color: #a3a3a3;">Keine Daten verfügbar.</p>';
    return;
  }
  
  // Berechne Domain-Grenzen
  const notes = filtered.map(d => Number(d.Note)).filter(v => !isNaN(v));
  const jahre = filtered.map(d => Number(d.Jahr)).filter(v => !isNaN(v));
  const fullMinJahr = jahre.length ? Math.min(...jahre) : CONFIG.DOMAIN.MIN_YEAR;
  const fullMaxJahr = CONFIG.DOMAIN.MAX_YEAR;
  
  let domainMinY = CONFIG.DOMAIN.MIN_NOTE_DEFAULT;
  let domainMaxY = CONFIG.DOMAIN.MAX_NOTE_DEFAULT;
  
  if (zoomY) {
    domainMinY = zoomY.min;
    domainMaxY = zoomY.max;
  } else {
    const domain = calculateYDomain(notes);
    domainMinY = domain.min;
    domainMaxY = domain.max;
  }
  
  // Min/Max pro Jahr berechnen
  const minMaxData = calculateMinMaxPerYear(filtered);
  
  // X-Achse Konfiguration
  const xAxisConfig = zoomY ? {
    format: "d",
    labelBaseline: "top",
    labelOffset: 8,
    orient: "top",
    labelAngle: 0
  } : {
    format: "d",
    labelAngle: 0
  };
  
  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    description: "Alle Wertungen aller Jahre",
    config: getDarkThemeConfig(),
    width: CONFIG.CHART.SCATTER_WIDTH,
    height: CONFIG.CHART.SCATTER_HEIGHT,
    padding: CONFIG.CHART.SCATTER_PADDING,
    datasets: {
      highlightSelection: []
    },
    layer: [
      {
        data: { values: filtered },
        mark: { 
          type: "point", 
          size: 80, 
          filled: true, 
          opacity: CONFIG.OPACITY.POINT, 
          color: CONFIG.COLORS.POINT 
        },
        encoding: {
          x: { 
            field: "Jahr", 
            type: "quantitative", 
            title: "Jahr", 
            scale: { domain: [fullMinJahr, fullMaxJahr], zero: false }, 
            axis: xAxisConfig 
          },
          y: { 
            field: "Note", 
            type: "quantitative", 
            title: "Note", 
            scale: { domain: [domainMinY, domainMaxY] } 
          }
          // Tooltip entfernt - wir nutzen die feste Info-Box rechts
        }
      },
      {
        data: { name: "highlightSelection" },
        encoding: {
          x: { 
            field: "Jahr", 
            type: "quantitative", 
            scale: { domain: [fullMinJahr, fullMaxJahr], zero: false },
            axis: xAxisConfig 
          },
          y: { 
            field: "Note", 
            type: "quantitative", 
            scale: { domain: [domainMinY, domainMaxY] },
            axis: {
              title: "Note",
              format: xAxisConfig.format,
              labelAngle: xAxisConfig.labelAngle ?? 0
            }
          }
        },
        layer: [
          {
            mark: { 
              type: "point",
              size: 600,
              filled: true,
              color: "rgba(255, 107, 53, 0.35)",
              opacity: 1
            }
          },
          {
            mark: { 
              type: "point",
              size: 200,
              filled: true,
              color: "#ff6b35",
              opacity: 1,
              stroke: "#ffffff",
              strokeWidth: 2
            }
          }
        ]
      },
      {
        data: { values: minMaxData },
        mark: { type: "line", color: CONFIG.COLORS.MAX_LINE, strokeWidth: 2 },
        encoding: {
          x: { 
            field: "Jahr", 
            type: "quantitative", 
            scale: { domain: [fullMinJahr, fullMaxJahr], zero: false }, 
            axis: xAxisConfig 
          },
          y: { 
            field: "MaxNote", 
            type: "quantitative", 
            scale: { domain: [domainMinY, domainMaxY] } 
          },
          tooltip: [
            { field: "Jahr", type: "quantitative", title: "Jahr" },
            { field: "MaxNote", type: "quantitative", title: "Höchste Note" }
          ]
        }
      },
      {
        data: { values: minMaxData },
        mark: { type: "line", color: CONFIG.COLORS.MIN_LINE, strokeWidth: 2 },
        encoding: {
          x: { 
            field: "Jahr", 
            type: "quantitative", 
            scale: { domain: [fullMinJahr, fullMaxJahr], zero: false }, 
            axis: xAxisConfig 
          },
          y: { 
            field: "MinNote", 
            type: "quantitative", 
            scale: { domain: [domainMinY, domainMaxY] } 
          },
          tooltip: [
            { field: "Jahr", type: "quantitative", title: "Jahr" },
            { field: "MinNote", type: "quantitative", title: "Niedrigste Note" }
          ]
        }
      }
    ]
  };
  
  chartEl.innerHTML = '';
  try {
    const result = await vegaEmbed(chartEl, spec, { actions: false });
    
    // Mobile Touch-Handler einrichten
    if (isMobile() && result && result.view) {
      setupMobileTouchHandlers(result.view, chartEl);
    } else {
      // Desktop: Standard Tooltip-Handler und Keyboard-Navigation
      setupCoverTooltipHandler();
      if (result && result.view) {
        setupScatterKeyboardNav(filtered, result.view, chartEl);
      }
    }
  } catch (e) {
    chartEl.innerHTML = '<p style="padding: 40px; text-align: center; color: #ff6b6b;">Fehler beim Rendering: ' + e.message + '</p>';
    throw e;
  }
}

/**
 * Band-Serien-Chart rendern
 */
export async function renderBandsSeries(data, selectedBands, chartEl, showTitles = true, showRegression = false, showThresholds = true) {
  if (!selectedBands || selectedBands.length === 0) return;
  
  // Jahr-Bereich bestimmen
  const subsetYears = data
    .filter(d => selectedBands.includes(d.Band) && d.Jahr != null)
    .map(d => d.Jahr);
  
  const minY = subsetYears.length ? Math.min(...subsetYears) : null;
  const maxY = subsetYears.length ? Math.max(...subsetYears) : null;
  const rangeYears = generateYearRange(minY, maxY);
  
  // Mobile: Jahresskala vereinfachen (nur jedes N-te Jahr für Labels)
  const mobile = isMobile();
  const yearLabelStep = mobile ? (rangeYears.length > 15 ? 5 : rangeYears.length > 10 ? 3 : 1) : 1;
  const yearLabelsForAxis = mobile ? simplifyYearLabels(rangeYears, yearLabelStep) : rangeYears;
  
  // Daten sammeln
  const { bestPoints, allPoints } = collectBandData(data, selectedBands, rangeYears);
  
  // Domain berechnen
  const notes = allPoints.map(d => d.Note).filter(v => v != null);
  const domain = calculateYDomain(notes);
  const domainMinY = domain.min;
  const domainMaxY = domain.max;
  
  const palette = getBandPalette();
  const lineOpacity = showRegression 
    ? CONFIG.OPACITY.LINE_WITH_REGRESSION 
    : CONFIG.OPACITY.LINE_DEFAULT;
  
  // Layer aufbauen
  const layers = [];
  
  // Schwellenlinien zuerst (Hintergrund) - nur wenn aktiviert
  if (showThresholds) {
    const thresholdLayers = createThresholdLinesLayer(rangeYears, domainMinY, domainMaxY);
    // Füge Schwellenlinien hinzu (kann ein einzelner Layer oder ein Array sein)
    if (thresholdLayers) {
      if (Array.isArray(thresholdLayers)) {
        layers.push(...thresholdLayers);
      } else if (thresholdLayers.layer) {
        // Verschachtelter Layer - entpacke ihn
        layers.push(...thresholdLayers.layer);
      } else {
        layers.push(thresholdLayers);
      }
    }
  }
  
  // Dann Daten-Layer (mit vereinfachter Jahresskala für Mobile)
  layers.push(
    createLineLayer(bestPoints, rangeYears, domainMinY, domainMaxY, selectedBands, palette, lineOpacity, yearLabelsForAxis),
    createPointLayer(allPoints, rangeYears, domainMinY, domainMaxY, selectedBands, palette)
  );
  
  // Regression-Layer hinzufügen
  if (showRegression) {
    const regressionLayers = createRegressionLayers(
      bestPoints, 
      selectedBands, 
      rangeYears, 
      domainMinY, 
      domainMaxY, 
      palette
    );
    if (regressionLayers.length > 0) {
      layers.splice(1, 0, ...regressionLayers);
    }
  }
  
  // Titel-Layer hinzufügen
  if (showTitles) {
    layers.push(createTitleLayer(allPoints, rangeYears, domainMinY, domainMaxY, selectedBands, palette));
  }
  
  // Breite bestimmen: Auf Mobile explizit berechnen, da "container" in Flexbox oft fehlschlägt
  let chartWidth = "container";
  if (isMobile()) {
    // Viewport-Breite minus Padding (ca. 20px)
    // Wir nehmen window.innerWidth, da chartEl.clientWidth manchmal noch 0 ist
    chartWidth = Math.max(300, window.innerWidth - 24); 
  }

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    description: "Zeitreihe für Band/Bands",
    config: getDarkThemeConfig(),
    width: chartWidth,
    height: CONFIG.CHART.BANDS_HEIGHT,
    layer: layers
  };
  
  const view = await vegaEmbed(chartEl, spec, { actions: false });
  
  // Mobile Touch-Handler einrichten
  if (isMobile() && view) {
    setupMobileTouchHandlers(view, chartEl);
  } else {
    // Desktop: Standard Tooltip-Handler
    setupCoverTooltipHandler();
  }
  
  return view;
}

/**
 * Band-Daten sammeln
 */
function collectBandData(data, selectedBands, rangeYears) {
  const allAlbumsByBandYear = new Map();
  const bestByBandYear = new Map();
  
  for (const d of data) {
    if (!selectedBands.includes(d.Band)) continue;
    if (d.Jahr == null || d.Note == null) continue;
    
    const key = d.Band + '|' + d.Jahr;
    if (!allAlbumsByBandYear.has(key)) {
      allAlbumsByBandYear.set(key, []);
    }
    allAlbumsByBandYear.get(key).push({ note: d.Note, album: d.Album || '', platz: d.Platz });
    
    const prev = bestByBandYear.get(key);
    if (prev == null || d.Note > prev.note) {
      bestByBandYear.set(key, { note: d.Note, album: d.Album || '', platz: d.Platz });
    }
  }
  
  const bestPoints = [];
  const allPoints = [];
  
  for (const band of selectedBands) {
    for (const y of rangeYears) {
      const v = bestByBandYear.get(band + '|' + y);
      if (v) {
        bestPoints.push({ Jahr: y, Band: band, Note: v.note, Album: v.album, Platz: v.platz });
      }
      
      const albums = allAlbumsByBandYear.get(band + '|' + y) || [];
      for (const album of albums) {
        allPoints.push({ Jahr: y, Band: band, Note: album.note, Album: album.album, Platz: album.platz });
      }
    }
  }
  
  return { bestPoints, allPoints };
}

/**
 * Schwellenlinien-Layer erstellen (Hintergrund)
 */
function createThresholdLinesLayer(rangeYears, domainMinY, domainMaxY) {
  const thresholds = [
    { 
      value: 2.5, 
      color: '#cc4444', 
      label: 'Schrottgrenze', 
      opacity: 0.25, 
      gradients: [
        { direction: 'down', toValue: domainMinY, color: '#cc4444' }
      ]
    },
    { 
      value: 2.75, 
      color: '#ccaa44', 
      label: 'Deepwater Horizon', 
      opacity: 0.25, 
      gradients: [
        { direction: 'down', toValue: 2.5, color: '#cc8844' } // Orange nach unten
      ]
    },
    { 
      value: 3.0, 
      color: '#44cc66', 
      label: 'Kraftklub', 
      opacity: 0.25, 
      gradients: [
        { direction: 'up', toValue: domainMaxY, color: '#44cc66' }, // Grün nach oben
        { direction: 'down', toValue: 2.75, color: '#ccaa44' } // Gelb nach unten
      ]
    }
  ];
  
  // Filtere Schwellen, die im Domain-Bereich liegen
  const visibleThresholds = thresholds.filter(t => t.value >= domainMinY && t.value <= domainMaxY);
  
  if (visibleThresholds.length === 0) {
    return null;
  }
  
  const thresholdLayers = [];
  
  // Erstelle Layer für jede Schwellenlinie
  visibleThresholds.forEach(threshold => {
    const lineData = rangeYears.map(year => ({
      Jahr: year,
      Note: threshold.value
    }));
    
    // Erstelle Gradient-Layer für alle definierten Gradienten
    if (threshold.gradients && threshold.gradients.length > 0) {
      const gradientSteps = 5;
      
      threshold.gradients.forEach(gradient => {
        const fromValue = threshold.value;
        const toValue = Math.max(domainMinY, Math.min(domainMaxY, gradient.toValue));
        
        // Für Gelb und Orange: 20% weniger Transparenz (kräftiger)
        const isYellowOrOrange = gradient.color === '#ccaa44' || gradient.color === '#cc8844';
        const startOpacity = isYellowOrOrange ? 0.12 : 0.1; // 20% mehr Opacity
        const opacityStep = isYellowOrOrange ? 0.0192 : 0.016; // 20% mehr Opacity
        
        if (gradient.direction === 'down' && toValue < fromValue) {
          // Gradient nach unten
          const range = fromValue - toValue;
          const stepSize = range / gradientSteps;
          
          for (let i = 0; i < gradientSteps; i++) {
            const topY = fromValue - (i * stepSize);
            const bottomY = fromValue - ((i + 1) * stepSize);
            const opacity = startOpacity - (i * opacityStep);
            
            if (bottomY < toValue) break;
            
            const areaData = rangeYears.map(year => ({
              Jahr: year,
              NoteTop: topY,
              NoteBottom: Math.max(bottomY, toValue)
            }));
            
            thresholdLayers.push({
              data: { values: areaData },
              mark: {
                type: "area",
                opacity: opacity,
                fill: gradient.color,
                interpolate: "linear"
              },
              encoding: {
                x: {
                  field: "Jahr",
                  type: "ordinal",
                  sort: "ascending",
                  scale: { domain: rangeYears }
                },
                y: {
                  field: "NoteTop",
                  type: "quantitative",
                  scale: { domainMin: domainMinY, domainMax: domainMaxY }
                },
                y2: {
                  field: "NoteBottom",
                  type: "quantitative"
                }
              }
            });
          }
        } else if (gradient.direction === 'up' && toValue > fromValue) {
          // Gradient nach oben
          const range = toValue - fromValue;
          const stepSize = range / gradientSteps;
          
          // Für Gelb und Orange: 20% weniger Transparenz (kräftiger)
          const isYellowOrOrange = gradient.color === '#ccaa44' || gradient.color === '#cc8844';
          const startOpacityUp = isYellowOrOrange ? 0.12 : 0.1; // 20% mehr Opacity
          const opacityStepUp = isYellowOrOrange ? 0.0192 : 0.016; // 20% mehr Opacity
          
          for (let i = 0; i < gradientSteps; i++) {
            const bottomY = fromValue + (i * stepSize);
            const topY = fromValue + ((i + 1) * stepSize);
            const opacity = startOpacityUp - (i * opacityStepUp);
            
            if (topY > toValue) break;
            
            const areaData = rangeYears.map(year => ({
              Jahr: year,
              NoteTop: Math.min(topY, toValue),
              NoteBottom: bottomY
            }));
            
            thresholdLayers.push({
              data: { values: areaData },
              mark: {
                type: "area",
                opacity: opacity,
                fill: gradient.color,
                interpolate: "linear"
              },
              encoding: {
                x: {
                  field: "Jahr",
                  type: "ordinal",
                  sort: "ascending",
                  scale: { domain: rangeYears }
                },
                y: {
                  field: "NoteTop",
                  type: "quantitative",
                  scale: { domainMin: domainMinY, domainMax: domainMaxY }
                },
                y2: {
                  field: "NoteBottom",
                  type: "quantitative"
                }
              }
            });
          }
        }
      });
    }
    
    // Linien-Layer (immer oben, damit sie hervorsticht)
    const hasGradient = threshold.gradients && threshold.gradients.length > 0;
    thresholdLayers.push({
      data: { values: lineData },
      mark: {
        type: "line",
        strokeWidth: hasGradient ? 2 : 1.5, // Etwas dicker wenn Gradient vorhanden
        opacity: hasGradient ? 0.4 : threshold.opacity, // Etwas stärker wenn Gradient
        stroke: threshold.color
      },
      encoding: {
        x: {
          field: "Jahr",
          type: "ordinal",
          sort: "ascending",
          scale: { domain: rangeYears }
        },
        y: {
          field: "Note",
          type: "quantitative",
          scale: { domainMin: domainMinY, domainMax: domainMaxY }
        }
      }
    });
  });
  
  // Gib Array von Layern zurück (wird oben entpackt)
  return thresholdLayers.length > 0 ? thresholdLayers : null;
}

/**
 * Linien-Layer erstellen
 */
function createLineLayer(bestPoints, rangeYears, domainMinY, domainMaxY, selectedBands, palette, opacity, yearLabels = null) {
  // Mobile: Vereinfachte Labels für X-Achse
  const axisConfig = {
    labelAngle: 0,
    grid: true,
    gridColor: "#252525"
  };
  
  // Wenn yearLabels angegeben ist (Mobile), nur diese Jahre als Labels anzeigen
  if (yearLabels && yearLabels.length < rangeYears.length) {
    axisConfig.values = yearLabels;
    // Labels können schräg sein wenn viele Jahre
    if (yearLabels.length > 8) {
      axisConfig.labelAngle = -45;
      axisConfig.labelBaseline = "top";
    }
  }
  
  return {
    data: { values: bestPoints },
    mark: { type: "line", opacity },
    encoding: {
      x: { 
        field: "Jahr", 
        type: "ordinal", 
        sort: "ascending", 
        axis: axisConfig, 
        scale: { domain: rangeYears } // Domain bleibt alle Jahre, nur Labels werden gefiltert
      },
      y: { 
        field: "Note", 
        type: "quantitative", 
        title: "Note", 
        scale: { domainMin: domainMinY, domainMax: domainMaxY }, 
        axis: { gridColor: "#252525" } 
      },
      tooltip: [
        { field: "Band", type: "nominal" },
        { field: "Jahr", type: "ordinal" },
        { field: "Album", type: "nominal" },
        { field: "Platz", type: "quantitative" },
        { field: "Note", type: "quantitative" }
      ],
      color: { 
        field: "Band", 
        type: "nominal", 
        legend: null, 
        scale: { range: palette, domain: selectedBands } 
      }
    }
  };
}

/**
 * Punkte-Layer erstellen
 */
function createPointLayer(allPoints, rangeYears, domainMinY, domainMaxY, selectedBands, palette) {
  return {
    data: { values: allPoints },
    mark: { type: "point", size: CONFIG.UI.POINT_SIZE, filled: true, cursor: "pointer" },
    encoding: {
      x: { 
        field: "Jahr", 
        type: "ordinal", 
        sort: "ascending", 
        scale: { domain: rangeYears } 
      },
      y: { 
        field: "Note", 
        type: "quantitative", 
        scale: { domainMin: domainMinY, domainMax: domainMaxY } 
      },
      color: { 
        field: "Band", 
        type: "nominal", 
        legend: null, 
        scale: { range: palette, domain: selectedBands } 
      },
      tooltip: [
        { field: "Band", type: "nominal", title: "Band" },
        { field: "Album", type: "nominal", title: "Album" },
        { field: "Jahr", type: "ordinal", title: "Jahr" },
        { field: "Platz", type: "quantitative", title: "Platz" },
        { field: "Note", type: "quantitative", title: "Note" }
      ]
    }
  };
}

/**
 * Regression-Layer erstellen
 */
function createRegressionLayers(bestPoints, selectedBands, rangeYears, domainMinY, domainMaxY, palette) {
  const regressionLayers = [];
  
  for (const band of selectedBands) {
    const bandPoints = bestPoints.filter(p => p.Band === band);
    if (bandPoints.length < CONFIG.REGRESSION.MIN_POINTS) continue;
    
    const coeffs = polynomialRegression(bandPoints);
    if (!coeffs) continue;
    
    const bandColor = palette[selectedBands.indexOf(band) % palette.length];
    const bandYears = bandPoints.map(p => Number(p.Jahr)).sort((a, b) => a - b);
    const firstYear = bandYears[0];
    const lastYear = bandYears[bandYears.length - 1];
    
    const regressionPoints = generateRegressionPoints(
      coeffs, 
      rangeYears, 
      firstYear, 
      lastYear, 
      domainMinY, 
      domainMaxY
    );
    
    if (regressionPoints.length > 0) {
      // Band-Information zu jedem Punkt hinzufügen
      regressionPoints.forEach(p => p.Band = band);
      
      regressionLayers.push({
        data: { values: regressionPoints },
        mark: { 
          type: "line", 
          strokeWidth: CONFIG.UI.REGRESSION_STROKE_WIDTH, 
          opacity: CONFIG.OPACITY.REGRESSION_LINE, 
          strokeDash: CONFIG.UI.REGRESSION_STROKE_DASH 
        },
        encoding: {
          x: { 
            field: "Jahr", 
            type: "ordinal", 
            sort: "ascending", 
            scale: { domain: rangeYears } 
          },
          y: { 
            field: "Note", 
            type: "quantitative", 
            scale: { domainMin: domainMinY, domainMax: domainMaxY } 
          },
          color: { value: bandColor }
        }
      });
    }
  }
  
  return regressionLayers;
}

/**
 * Titel-Layer erstellen
 */
function createTitleLayer(allPoints, rangeYears, domainMinY, domainMaxY, selectedBands, palette) {
  return {
    data: { values: allPoints },
    mark: { 
      type: "text", 
      dy: CONFIG.UI.TITLE_OFFSET, 
      fontSize: CONFIG.UI.TITLE_FONT_SIZE, 
      fontWeight: "bold" 
    },
    zindex: 1,
    encoding: {
      x: { 
        field: "Jahr", 
        type: "ordinal", 
        sort: "ascending", 
        scale: { domain: rangeYears } 
      },
      y: { 
        field: "Note", 
        type: "quantitative", 
        scale: { domainMin: domainMinY, domainMax: domainMaxY } 
      },
      text: { field: "Album", type: "nominal" },
      color: { 
        field: "Band", 
        type: "nominal", 
        legend: null, 
        scale: { range: palette, domain: selectedBands } 
      }
    }
  };
}
