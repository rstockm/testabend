/**
 * Chart-Rendering-Funktionen
 */
import { CONFIG, getDarkThemeConfig, getBandPalette } from './config.js';
import { generateYearRange, calculateYDomain, calculateMinMaxPerYear, isMobile, simplifyYearLabels, uniqueSorted } from './utils.js';
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
    width: "container",
    height: CONFIG.CHART.SCATTER_HEIGHT,
    padding: { left: 40, right: 20, top: 10, bottom: 50 }, // Reduziertes linkes Padding
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
    setupCoverTooltipHandler();
    
    // Setup Keyboard-Navigation
    if (result && result.view) {
      setupScatterKeyboardNav(filtered, result.view, chartEl);
      
      // Trigger Resize nach kurzer Verzögerung, damit Container-Breite korrekt erkannt wird
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (result.view && typeof result.view.resize === 'function') {
            result.view.resize();
          }
        });
      });
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
  
  const result = await vegaEmbed(chartEl, spec, { actions: false });
  
  // Mobile vs Desktop: Unterschiedliche Handler
  if (isMobile()) {
    // Mobile: Touch-Handler für Album-Karte
    console.log('[renderBandsSeries] Mobile detected, will setup touch handlers');
    setTimeout(() => {
      console.log('[renderBandsSeries] Timeout fired, checking result.view...', {
        hasResult: !!result,
        hasView: !!(result?.view),
        chartElId: chartEl?.id,
        dataLength: data?.length,
        allPointsLength: allPoints?.length
      });
      if (result && result.view) {
        console.log('[renderBandsSeries] Calling setupMobileTouchHandlers...');
        setupMobileTouchHandlers(result.view, chartEl, data, allPoints); // Swipe-Daten + sichtbare Punkte
      } else {
        console.error('[renderBandsSeries] Cannot setup touch handlers: missing result or view');
        const indicator = document.getElementById('mobile-touch-indicator');
        if (indicator) indicator.textContent = 'ERROR: No view';
      }
    }, 300);
  } else {
    // Desktop: Standard Tooltip-Handler
    setupCoverTooltipHandler();
  }
  
  return result;
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
  // Mobile: Größere Punkte für bessere Touch-Erkennung
  const pointSize = isMobile() ? CONFIG.UI.POINT_SIZE * 2 : CONFIG.UI.POINT_SIZE;
  return {
    data: { values: allPoints },
    mark: { type: "point", size: pointSize, filled: true, cursor: "pointer" },
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

/**
 * Jahre-View rendern (nur Mobile)
 */
export async function renderYearsView(data, containerEl) {
  // Importiere parseHash und updateHash für URL-Parameter
  const { parseHash, updateHash } = await import('./utils.js');
  
  // Debug-Panel erstellen (immer sichtbar für Debugging)
  const isChromeMobile = /(Chrome|CriOS)/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent);
  const isCriOS = /CriOS/i.test(navigator.userAgent);
  let debugPanel = null;
  let debugLogs = [];
  let debugPanelVisible = false;
  let chromeStylesInjected = false;
  
  function ensureChromeMobileStyles() {
    if (!isCriOS || chromeStylesInjected) return;
    if (document.getElementById('chrome-mobile-inline-styles')) {
      chromeStylesInjected = true;
      return;
    }
    chromeStylesInjected = true;
    const style = document.createElement('style');
    style.id = 'chrome-mobile-inline-styles';
    style.textContent = `
      .year-selector {
        padding: 16px !important;
        background: var(--bg-secondary) !important;
        border-bottom: 1px solid var(--border-color) !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        flex-shrink: 0 !important;
      }
      .year-select {
        flex: 1 !important;
        padding: 14px 16px !important;
        padding-right: 44px !important;
        background: var(--bg-tertiary) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 12px !important;
        color: var(--text-primary) !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        font-family: inherit !important;
        cursor: pointer !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35) !important;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='%23d4d4d4' d='M7 10L2 5h10z'/%3E%3C/svg%3E") !important;
        background-repeat: no-repeat !important;
        background-position: right 18px center !important;
        background-size: 14px !important;
      }
      .year-select:focus {
        outline: none !important;
        border-color: var(--accent-blue) !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25), 0 6px 14px rgba(0, 0, 0, 0.4) !important;
      }
      .year-select option {
        background: var(--bg-tertiary) !important;
        color: var(--text-primary) !important;
      }
      .years-album-item {
        display: flex !important;
        gap: 16px !important;
        padding: 16px !important;
        margin-bottom: 12px !important;
        background: var(--bg-secondary) !important;
        border-radius: 12px !important;
        border: 1px solid var(--border-color) !important;
        transition: background-color 0.2s ease, border-color 0.2s ease !important;
      }
      .years-album-item:active {
        background: var(--bg-tertiary) !important;
      }
      .years-album-cover {
        flex-shrink: 0 !important;
        width: 100px !important;
        height: 100px !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        background: var(--bg-tertiary) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .years-album-cover-img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
      }
      .years-album-info {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        min-width: 0 !important;
      }
      .years-album-title {
        font-size: 18px !important;
        font-weight: 600 !important;
        color: var(--text-primary) !important;
        line-height: 1.3 !important;
        word-break: break-word !important;
      }
      .years-album-band {
        font-size: 16px !important;
        color: #c4d9ed !important;
        text-decoration: none !important;
      }
      .years-album-details {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        margin-top: auto !important;
        font-size: 14px !important;
        color: var(--text-secondary) !important;
      }
      .years-album-note,
      .years-album-platz {
        font-weight: 500 !important;
      }
      .mobile-band-modal {
        display: none !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background-color: var(--bg-primary) !important;
        z-index: 2000 !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      .mobile-band-modal.active {
        display: flex !important;
      }
      .mobile-modal-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 12px 16px !important;
        background-color: var(--bg-secondary) !important;
        border-bottom: 1px solid var(--border-color) !important;
      }
      .mobile-modal-title {
        font-size: 18px !important;
        font-weight: 600 !important;
        margin: 0 !important;
        color: var(--text-primary) !important;
      }
      .mobile-modal-close {
        background: none !important;
        border: none !important;
        color: var(--text-primary) !important;
        font-size: 26px !important;
        padding: 8px !important;
        cursor: pointer !important;
        line-height: 1 !important;
      }
      .mobile-modal-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 24px 20px 32px !important;
        background: var(--bg-primary) !important;
      }
      .mobile-modal-footer {
        padding: 12px 16px 24px !important;
        background: var(--bg-primary) !important;
        border-top: 1px solid var(--border-color) !important;
        display: flex !important;
        justify-content: flex-end !important;
      }
      .mobile-modal-done-btn {
        padding: 12px 24px !important;
        border-radius: 12px !important;
        font-weight: 600 !important;
        font-size: 16px !important;
        cursor: pointer !important;
        width: 100% !important;
        max-width: 320px !important;
        background: var(--accent-blue) !important;
        color: #fff !important;
        border: none !important;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35) !important;
      }
      .mobile-settings-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 24px !important;
        padding-bottom: 32px !important;
      }
      .mobile-settings-toggle {
        padding: 4px 0 16px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .mobile-settings-toggle:last-child {
        border-bottom: none !important;
      }
      .mobile-settings-toggle .title-toggle-container {
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 24px !important;
      }
      .mobile-settings-toggle .title-toggle-label {
        font-size: 18px !important;
        color: var(--text-primary) !important;
        flex: 1 !important;
        font-weight: 500 !important;
        line-height: 1.4 !important;
      }
      .toggle-switch {
        position: relative !important;
        display: inline-block !important;
        width: 64px !important;
        height: 34px !important;
      }
      .toggle-switch input {
        opacity: 0 !important;
        width: 0 !important;
        height: 0 !important;
      }
      .toggle-slider {
        position: absolute !important;
        cursor: pointer !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background-color: #1f1f1f !important;
        transition: 0.3s !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
      }
      .toggle-slider:before {
        position: absolute !important;
        content: '' !important;
        height: 26px !important;
        width: 26px !important;
        left: 4px !important;
        bottom: 3px !important;
        background-color: white !important;
        transition: 0.3s !important;
        border-radius: 50% !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35) !important;
      }
      .toggle-switch input:checked + .toggle-slider {
        background-color: var(--accent-blue) !important;
      }
      .toggle-switch input:checked + .toggle-slider:before {
        transform: translateX(30px) !important;
      }
    `;
    document.head.appendChild(style);
    console.log('[YearsView] Injected Chrome iOS styles');
  }
  
  // Erstelle Debug-Panel immer (nicht nur Chrome Mobile)
  debugPanel = document.createElement('div');
  debugPanel.id = 'years-view-debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    background: rgba(0, 0, 0, 0.95);
    color: #0f0;
    font-family: monospace;
    font-size: 11px;
    padding: 12px;
    border: 3px solid #0f0;
    border-radius: 6px;
    z-index: 999999;
    overflow-y: auto;
    word-break: break-all;
    display: none;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.5);
  `;
  debugPanel.innerHTML = '<div style="font-weight: bold; margin-bottom: 8px; font-size: 14px; color: #0ff;">DEBUG LOGS (tap to toggle)</div><div id="debug-log-content" style="line-height: 1.4;"></div>';
  debugPanel.addEventListener('click', (e) => {
    if (e.target === debugPanel || e.target.closest('#debug-log-content')) {
      // Ignoriere Klicks auf Content
      return;
    }
    debugPanelVisible = !debugPanelVisible;
    debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
  });
  document.body.appendChild(debugPanel);
  
  // Toggle-Button erstellen (versteckt, Code bleibt erhalten)
  const debugToggle = document.createElement('button');
  debugToggle.id = 'debug-toggle-btn';
  debugToggle.textContent = 'DEBUG';
  debugToggle.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 60px;
    height: 40px;
    background: rgba(0, 255, 0, 0.8);
    color: #000;
    font-weight: bold;
    font-size: 12px;
    border: 2px solid #0f0;
    border-radius: 6px;
    z-index: 1000000;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 255, 0, 0.6);
    display: none;
  `;
  debugToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    debugPanelVisible = !debugPanelVisible;
    debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
    debugToggle.textContent = debugPanelVisible ? 'HIDE' : 'DEBUG';
  });
  document.body.appendChild(debugToggle);
  
  ensureChromeMobileStyles();
  
  // Debug-Log-Funktion
  window.debugLog = function(...args) {
    const logEntry = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const timestamp = new Date().toLocaleTimeString();
    debugLogs.push(`[${timestamp}] ${logEntry}`);
    if (debugLogs.length > 100) debugLogs.shift(); // Max 100 Einträge
    const logContent = document.getElementById('debug-log-content');
    if (logContent) {
      logContent.innerHTML = debugLogs.slice(-30).join('<br>'); // Zeige letzte 30
      // Auto-scroll nach unten
      logContent.scrollTop = logContent.scrollHeight;
    }
    console.log(...args); // Auch in Console
  };
  
  // Initial-Log
  debugLog('Debug panel initialized. User-Agent:', navigator.userAgent);
  debugLog('Is Chrome Mobile:', isChromeMobile);
  
  // Alle verfügbaren Jahre extrahieren und sortieren
  const yearsSorted = uniqueSorted(data.map(d => d.Jahr).filter(y => y != null));
  const years = [...yearsSorted]; // Kopie für Navigation (aufsteigend)
  const yearsDescending = [...yearsSorted].reverse(); // Absteigend für Select
  
  if (years.length === 0) {
    containerEl.innerHTML = '<p style="padding: 40px; text-align: center; color: #a3a3a3;">Keine Daten verfügbar.</p>';
    return;
  }
  
  // Funktion zum Speichern von Jahr und Position (nur sessionStorage, keine URL)
  function saveYearAndPositionToStorage(year, scrollTop = 0) {
    try {
      sessionStorage.setItem('yearsViewYear', String(year));
      sessionStorage.setItem('yearsViewScrollTop', String(scrollTop));
    } catch (e) {
      console.warn('[YearsView] Failed to save year and position to storage:', e);
    }
  }
  
  // Funktion zum Speichern von Jahr und Position (mit URL-Update)
  function saveYearAndPosition(year, scrollTop = 0, updateUrl = true) {
    try {
      // Speichere in sessionStorage
      saveYearAndPositionToStorage(year, scrollTop);
      
      // Aktualisiere URL-Parameter nur wenn gewünscht (nicht beim Scrollen)
      if (updateUrl) {
        const { params } = parseHash();
        const newParams = { ...params };
        if (year) {
          newParams.y = String(year);
          // Scroll-Position nicht in URL speichern (nur Jahr)
          delete newParams.s;
        }
        updateHash('jahre', newParams);
      }
    } catch (e) {
      console.warn('[YearsView] Failed to save year and position:', e);
    }
  }
  
  // Funktion zum Laden von Jahr und Position
  function loadYearAndPosition() {
    let year = null;
    let scrollTop = 0;
    
    // Versuche zuerst aus URL-Parametern
    const { params } = parseHash();
    if (params.y) {
      const urlYear = parseInt(params.y);
      if (years.includes(urlYear)) {
        year = urlYear;
      }
    }
    if (params.s) {
      scrollTop = parseInt(params.s) || 0;
    }
    
    // Falls nicht in URL, versuche aus sessionStorage
    if (!year) {
      try {
        const storedYear = sessionStorage.getItem('yearsViewYear');
        if (storedYear) {
          const parsedYear = parseInt(storedYear);
          if (years.includes(parsedYear)) {
            year = parsedYear;
          }
        }
      } catch (e) {
        console.warn('[YearsView] Failed to load year from sessionStorage:', e);
      }
    }
    
    if (!year) {
      // Fallback: Neuestes Jahr
      year = years[years.length - 1];
    }
    
    // Scroll-Position aus sessionStorage (immer, wenn nicht in URL)
    // WICHTIG: Auch wenn Jahr aus URL kommt, lade Scroll-Position aus sessionStorage
    if (!params.s) {
      try {
        const storedScrollTop = sessionStorage.getItem('yearsViewScrollTop');
        if (storedScrollTop) {
          const parsedScrollTop = parseInt(storedScrollTop) || 0;
          // Nur verwenden wenn gespeichertes Jahr mit geladenem Jahr übereinstimmt
          const storedYear = sessionStorage.getItem('yearsViewYear');
          if (storedYear && parseInt(storedYear) === year) {
            scrollTop = parsedScrollTop;
          }
        }
      } catch (e) {
        console.warn('[YearsView] Failed to load scroll position from sessionStorage:', e);
      }
    }
    
    return { year, scrollTop };
  }
  
  // Lade gespeichertes Jahr und Position
  const { year: savedYear, scrollTop: savedScrollTop } = loadYearAndPosition();
  
  // Container für Jahre-View erstellen
  const yearsView = document.createElement('div');
  yearsView.className = 'years-view';
  
  // Jahr-Selektor erstellen
  const yearSelector = document.createElement('div');
  yearSelector.className = 'year-selector';
  
  const selectorLabel = document.createElement('label');
  selectorLabel.textContent = 'Jahr:';
  selectorLabel.className = 'year-selector-label';
  
  const select = document.createElement('select');
  select.className = 'year-select';
  
  // Jahre in Select hinzufügen (absteigend)
  yearsDescending.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    select.appendChild(option);
  });
  
  // Setze gespeichertes Jahr im Select
  select.value = savedYear;
  
  yearSelector.appendChild(selectorLabel);
  yearSelector.appendChild(select);
  
  // Multi-Container Struktur erstellen
  const viewContainer = document.createElement('div');
  viewContainer.className = 'years-view-container';
  
  const viewport = document.createElement('div');
  viewport.className = 'years-viewport';
  // WICHTIG: Setze Transform explizit beim Erstellen (für Chrome Mobile)
  viewport.style.transform = 'translateX(-33.33%)';
  viewport.style.webkitTransform = 'translateX(-33.33%)';
  
  // Funktion zum Setzen der Container-Breiten (für Chrome Mobile Kompatibilität)
  function setContainerWidths() {
    try {
      if (!viewContainer || !prevContainer || !currContainer || !nextContainer || !viewport) {
        debugLog('[DIAGNOSE] setContainerWidths: Missing elements', {
          viewContainer: !!viewContainer,
          prevContainer: !!prevContainer,
          currContainer: !!currContainer,
          nextContainer: !!nextContainer,
          viewport: !!viewport
        });
        return;
      }
      
      const containerWidth = viewContainer.clientWidth;
      if (containerWidth === 0) {
        debugLog('[DIAGNOSE] setContainerWidths: containerWidth is 0, retrying...');
        return;
      }
      
      // Erzwinge Flex-Layout auch bei Browsern mit Bugs
      viewport.style.display = '-webkit-box';
      viewport.style.display = '-webkit-flex';
      viewport.style.display = 'flex';
      viewport.style.flexDirection = 'row';
      viewport.style.flexWrap = 'nowrap';
      viewport.style.alignItems = 'stretch';
      viewport.style.justifyContent = 'flex-start';
      viewport.style.webkitBoxOrient = 'horizontal';
      viewport.style.webkitBoxAlign = 'stretch';
      
      const applyContainerFlex = (container) => {
        container.style.display = 'block';
        container.style.flexShrink = '0';
        container.style.flexGrow = '0';
      };
      applyContainerFlex(prevContainer);
      applyContainerFlex(currContainer);
      applyContainerFlex(nextContainer);
      
      const containerWidthPx = `${containerWidth}px`;
      prevContainer.style.width = containerWidthPx;
      prevContainer.style.minWidth = containerWidthPx;
      prevContainer.style.maxWidth = containerWidthPx;
      prevContainer.style.flex = `0 0 ${containerWidthPx}`;
      currContainer.style.width = containerWidthPx;
      currContainer.style.minWidth = containerWidthPx;
      currContainer.style.maxWidth = containerWidthPx;
      currContainer.style.flex = `0 0 ${containerWidthPx}`;
      nextContainer.style.width = containerWidthPx;
      nextContainer.style.minWidth = containerWidthPx;
      nextContainer.style.maxWidth = containerWidthPx;
      nextContainer.style.flex = `0 0 ${containerWidthPx}`;
      viewport.style.width = `${containerWidth * 3}px`;
      
      const viewportStyles = window.getComputedStyle(viewport);
      const prevOffset = prevContainer.offsetLeft;
      const currOffset = currContainer.offsetLeft;
      const nextOffset = nextContainer.offsetLeft;
      
      debugLog('[DIAGNOSE] Set container widths:', {
        containerWidth,
        viewportWidth: containerWidth * 3,
        prevWidth: prevContainer.style.width,
        currWidth: currContainer.style.width,
        nextWidth: nextContainer.style.width,
        viewportDisplay: viewportStyles.display,
        viewportWebkitBoxOrient: viewport.style.webkitBoxOrient,
        prevOffset,
        currOffset,
        nextOffset
      });
    } catch (e) {
      debugLog('[DIAGNOSE] setContainerWidths ERROR:', e.message);
      console.error('[YearsView] setContainerWidths error:', e);
    }
  }
  
  // Drei Jahr-Container erstellen (müssen let sein, da sie in rotateContainers neu zugewiesen werden)
  let prevContainer = document.createElement('div');
  prevContainer.className = 'year-container prev';
  let prevList = document.createElement('div');
  prevList.className = 'years-album-list';
  prevContainer.appendChild(prevList);
  
  let currContainer = document.createElement('div');
  currContainer.className = 'year-container curr';
  let currList = document.createElement('div');
  currList.className = 'years-album-list';
  currContainer.appendChild(currList);
  
  let nextContainer = document.createElement('div');
  nextContainer.className = 'year-container next';
  let nextList = document.createElement('div');
  nextList.className = 'years-album-list';
  nextContainer.appendChild(nextList);
  
  viewport.appendChild(prevContainer);
  viewport.appendChild(currContainer);
  viewport.appendChild(nextContainer);
  
  viewContainer.appendChild(viewport);
  
  yearsView.appendChild(yearSelector);
  yearsView.appendChild(viewContainer);
  
  containerEl.innerHTML = '';
  containerEl.appendChild(yearsView);
  
  // Setze Container-Breiten nach DOM-Insertion
  requestAnimationFrame(() => {
    setContainerWidths();
    // Auch nach kurzer Verzögerung nochmal (falls Layout noch nicht berechnet)
    setTimeout(() => {
      setContainerWidths();
      // Nochmal nach längerer Verzögerung für Chrome Mobile
      setTimeout(setContainerWidths, 200);
    }, 100);
  });
  
  // Multi-Container State
  let currentYearIndex = years.indexOf(savedYear);
  if (currentYearIndex === -1) {
    currentYearIndex = years.length - 1; // Fallback: Neuestes Jahr
  }
  let currentYear = years[currentYearIndex];
  let savedScrollPosition = savedScrollTop; // Speichere für später
  
  console.log('[YearsView] Setup complete, currentYear:', currentYear, 'currentYearIndex:', currentYearIndex, 'years:', years);
  const CHUNK_SIZE = 10;
  
  // State für jeden Container
  const containerStates = {
    prev: { year: null, yearIndex: -1, albums: [], loadedStart: 0, loadedEnd: 0, scrollTop: 0, observer: null, topSentinel: null, bottomSentinel: null },
    curr: { year: null, yearIndex: -1, albums: [], loadedStart: 0, loadedEnd: 0, scrollTop: 0, observer: null, topSentinel: null, bottomSentinel: null },
    next: { year: null, yearIndex: -1, albums: [], loadedStart: 0, loadedEnd: 0, scrollTop: 0, observer: null, topSentinel: null, bottomSentinel: null }
  };
  
  // Viewport State
  let viewportOffset = 0; // 0 = curr, -33.33 = prev, +33.33 = next
  let isShifting = false;
  let transitionTimeout = null;
  
  // Swipe-Gesten State (auf Viewport-Ebene)
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isScrolling = false;
  let touchMoved = false;
  let currentSwipeOffset = 0;
  const SWIPE_THRESHOLD = 50;
  const SWIPE_MAX_VERTICAL = 50;
  const SWIPE_MAX_TIME = 500;
  
  
  // Funktion zum Laden der Cover-URL (verwendet die gleiche Logik wie coverTooltip.js)
  function sanitizeFilename(text) {
    if (!text) return '';
    return String(text)
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100);
  }
  
  function getCoverFilename(band, album, year = null) {
    const bandSafe = sanitizeFilename(band);
    const albumSafe = sanitizeFilename(album);
    if (year) {
      return `${bandSafe}_${albumSafe}_${year}.jpg`;
    }
    return `${bandSafe}_${albumSafe}.jpg`;
  }
  
  async function getCoverUrl(band, album, year) {
    // Importiere getBasePath dynamisch
    const { getBasePath } = await import('./utils.js');
    const basePath = getBasePath();
    const basePrefix = basePath ? `${basePath}/` : '';
    
    // WICHTIG: Cover-Images haben ein Jahr im Dateinamen NUR wenn es Duplikate gibt
    // Versuche ZUERST mit Jahr (spezifischer), dann ohne Jahr als Fallback
    const filenameWithoutYear = getCoverFilename(band, album, null);
    const coverPathWithoutYear = `${basePrefix}images/covers/${filenameWithoutYear}`;
    
    if (year) {
      const filenameWithYear = getCoverFilename(band, album, year);
      const coverPathWithYear = `${basePrefix}images/covers/${filenameWithYear}`;
      // Versuche zuerst mit Jahr (falls Duplikat), dann ohne Jahr
      return { primary: coverPathWithYear, fallback: coverPathWithoutYear };
    }
    
    return { primary: coverPathWithoutYear, fallback: null };
  }
  
  // Funktion zum Erstellen eines Album-Items
  async function createAlbumItem(album) {
    const item = document.createElement('div');
    item.className = 'years-album-item';
    item.dataset.platz = album.Platz; // Speichere Platz für späteren Zugriff
    
    // Cover-Container (links)
    const coverContainer = document.createElement('div');
    coverContainer.className = 'years-album-cover';
    
    const coverImg = document.createElement('img');
    coverImg.className = 'years-album-cover-img';
    coverImg.alt = `${album.Band} - ${album.Album}`;
    coverImg.loading = 'lazy';
    
    // Cover-URL laden - versuche beide Varianten (mit/ohne Jahr)
    const coverUrls = await getCoverUrl(album.Band, album.Album, album.Jahr);
    if (coverUrls && coverUrls.primary) {
      // Versuche zuerst primary (ohne Jahr)
      coverImg.src = coverUrls.primary;
      coverImg.onerror = () => {
        // Fallback: Versuche mit Jahr (falls vorhanden)
        if (coverUrls.fallback) {
          coverImg.src = coverUrls.fallback;
          coverImg.onerror = () => {
            // Beide Varianten fehlgeschlagen - verstecke Cover
            coverContainer.style.display = 'none';
          };
        } else {
          // Kein Fallback verfügbar - verstecke Cover
          coverContainer.style.display = 'none';
        }
      };
    } else {
      // Keine Cover-URLs gefunden
      coverContainer.style.display = 'none';
    }
    
    coverContainer.appendChild(coverImg);
    
    // Info-Container (rechts)
    const infoContainer = document.createElement('div');
    infoContainer.className = 'years-album-info';
    
    const albumTitle = document.createElement('div');
    albumTitle.className = 'years-album-title';
    albumTitle.textContent = album.Album;
    
    const bandName = document.createElement('a');
    bandName.className = 'years-album-band';
    bandName.textContent = album.Band;
    bandName.href = `#band?b=${encodeURIComponent(album.Band)}`;
    bandName.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Speichere aktuelle Position BEVOR Navigation (nur sessionStorage, keine URL)
      saveYearAndPositionToStorage(currentYear, currContainer.scrollTop);
      
      // Sammle bestehende Bands: Zuerst aus URL, dann aus sessionStorage
      const currentHash = window.location.hash;
      const hashMatch = currentHash.match(/^#band\?/);
      let existingBands = [];
      
      if (hashMatch) {
        // Bereits auf Zeitreihen-Ansicht: Lade Bands aus URL
        const params = new URLSearchParams(currentHash.split('?')[1] || '');
        existingBands = params.get('b') ? params.get('b').split(',').map(b => b.trim()) : [];
      }
      
      // Wenn keine Bands in URL, versuche aus sessionStorage zu laden
      if (existingBands.length === 0) {
        try {
          const storedBands = sessionStorage.getItem('selectedBands');
          if (storedBands) {
            existingBands = JSON.parse(storedBands);
          }
        } catch (e) {
          console.warn('Failed to load bands from sessionStorage:', e);
        }
      }
      
      // Füge Band hinzu, wenn noch nicht vorhanden
      if (!existingBands.includes(album.Band)) {
        existingBands.push(album.Band);
      }
      
      // Navigiere zur Zeitreihen-Ansicht mit allen Bands
      window.location.hash = `band?b=${existingBands.map(b => encodeURIComponent(b)).join(',')}`;
    });
    
    const details = document.createElement('div');
    details.className = 'years-album-details';
    
    const noteSpan = document.createElement('span');
    noteSpan.className = 'years-album-note';
    noteSpan.textContent = `Note: ${album.Note}`;
    
    const platzSpan = document.createElement('span');
    platzSpan.className = 'years-album-platz';
    platzSpan.textContent = `Platz: ${album.Platz}`;
    
    details.appendChild(noteSpan);
    details.appendChild(platzSpan);
    
    infoContainer.appendChild(albumTitle);
    infoContainer.appendChild(bandName);
    infoContainer.appendChild(details);
    
    item.appendChild(coverContainer);
    item.appendChild(infoContainer);
    
    return item;
  }
  
  // Funktion zum Laden eines Jahres in einen Container
  async function loadYearIntoContainer(containerKey, year, targetPlatz = null) {
    console.log('[YearsView] loadYearIntoContainer:', containerKey, year, 'targetPlatz:', targetPlatz);
    const state = containerStates[containerKey];
    const container = containerKey === 'prev' ? prevContainer : containerKey === 'curr' ? currContainer : nextContainer;
    const list = containerKey === 'prev' ? prevList : containerKey === 'curr' ? currList : nextList;
    
    // DIAGNOSE: Prüfe Container-Referenzen
    const diagInfo = {
      containerKey,
      year,
      containerExists: !!container,
      listExists: !!list,
      containerClassName: container?.className,
      listClassName: list?.className,
      containerParent: container?.parentElement?.className,
      prevContainerYear: containerStates.prev?.year,
      currContainerYear: containerStates.curr?.year,
      nextContainerYear: containerStates.next?.year,
      prevContainerRef: prevContainer === container,
      currContainerRef: currContainer === container,
      nextContainerRef: nextContainer === container
    };
    debugLog('[DIAGNOSE] Container references:', JSON.stringify(diagInfo, null, 2));
    console.log('[YearsView] DIAGNOSE - Container references:', diagInfo);
    
    if (!container || !list) {
      console.error('[YearsView] Container or list not found for:', containerKey, {
        prevContainer: !!prevContainer,
        currContainer: !!currContainer,
        nextContainer: !!nextContainer,
        prevList: !!prevList,
        currList: !!currList,
        nextList: !!nextList
      });
      return;
    }
    
    // Alben für das Jahr filtern und sortieren
    const albums = data
      .filter(d => d.Jahr === year && d.Platz != null)
      .sort((a, b) => a.Platz - b.Platz);
    
    // DIAGNOSE: Prüfe gefilterte Alben
    const sampleAlbums = albums.slice(0, 3).map(a => ({ Band: a.Band, Album: a.Album, Jahr: a.Jahr, Platz: a.Platz }));
    debugLog(`[DIAGNOSE] Found ${albums.length} albums for year ${year}`);
    debugLog('[DIAGNOSE] Sample albums:', JSON.stringify(sampleAlbums, null, 2));
    console.log('[YearsView] Found', albums.length, 'albums for year', year);
    console.log('[YearsView] DIAGNOSE - Sample albums:', sampleAlbums);
    console.log('[YearsView] First 5 albums Platz:', albums.slice(0, 5).map(a => a.Platz));
    
    // DIAGNOSE: Prüfe ob falsche Jahre in den Daten sind
    const wrongYearAlbums = albums.filter(a => a.Jahr !== year);
    if (wrongYearAlbums.length > 0) {
      const errorInfo = {
        expectedYear: year,
        wrongAlbums: wrongYearAlbums.slice(0, 3).map(a => ({ Jahr: a.Jahr, Band: a.Band, Album: a.Album }))
      };
      debugLog('[DIAGNOSE] ERROR: Wrong year albums!', JSON.stringify(errorInfo, null, 2));
      console.error('[YearsView] DIAGNOSE - ERROR: Found albums with wrong year!', errorInfo);
    }
    
    state.year = year;
    state.yearIndex = years.indexOf(year);
    state.albums = albums;
    
    // Leere Liste
    list.innerHTML = '';
    state.loadedStart = 0;
    state.loadedEnd = 0;
    
    // Bestimme Ziel-Index basierend auf Platz
    let startIndex = 0;
    let endIndex = Math.min(CHUNK_SIZE * 2, albums.length);
    let targetIndex = null;
    
    if (targetPlatz !== null) {
      targetIndex = albums.findIndex(a => a.Platz === targetPlatz);
      if (targetIndex !== -1) {
        const VIEWPORT_SIZE = 15;
        startIndex = Math.max(0, targetIndex - Math.floor(VIEWPORT_SIZE / 2));
        endIndex = Math.min(albums.length, targetIndex + Math.ceil(VIEWPORT_SIZE / 2));
        console.log('[YearsView] Target index:', targetIndex, 'loading range:', startIndex, '-', endIndex);
      }
    }
    
    state.loadedStart = startIndex;
    state.loadedEnd = endIndex;
    
    // Lade initialen Bereich
    const chunk = albums.slice(startIndex, endIndex);
    console.log('[YearsView] Loading chunk of', chunk.length, 'albums');
    console.log('[YearsView] Chunk Platz range:', chunk[0]?.Platz, '-', chunk[chunk.length - 1]?.Platz);
    
    // Stelle sicher, dass Chunk nach Platz sortiert ist
    const sortedChunk = [...chunk].sort((a, b) => a.Platz - b.Platz);
    
    // DIAGNOSE: Prüfe welche Alben tatsächlich gerendert werden
    const renderInfo = {
      containerKey,
      year,
      chunkLength: sortedChunk.length,
      renderedAlbums: sortedChunk.slice(0, 3).map(a => ({ Jahr: a.Jahr, Band: a.Band, Album: a.Album, Platz: a.Platz }))
    };
    debugLog('[DIAGNOSE] Rendering albums:', JSON.stringify(renderInfo, null, 2));
    console.log('[YearsView] DIAGNOSE - Rendering albums:', renderInfo);
    
    for (const album of sortedChunk) {
      const item = await createAlbumItem(album);
      list.appendChild(item);
    }
    
    // DIAGNOSE: Prüfe gerenderte Items im DOM
    const renderedItems = list.querySelectorAll('.years-album-item');
    if (renderedItems.length > 0) {
      const firstItem = renderedItems[0];
      const firstItemData = firstItem.dataset;
      
      // Prüfe auch die tatsächlichen Text-Inhalte der gerenderten Items
      const visibleAlbums = Array.from(renderedItems).slice(0, 5).map(item => {
        const bandEl = item.querySelector('.years-album-band');
        const titleEl = item.querySelector('.years-album-title');
        return {
          platz: item.dataset.platz,
          band: bandEl?.textContent || 'N/A',
          album: titleEl?.textContent || 'N/A',
          containerKey: containerKey,
          expectedYear: year
        };
      });
      
      const renderedInfo = {
        containerKey,
        year,
        firstItemPlatz: firstItemData.platz,
        totalItems: renderedItems.length,
        listParent: list.parentElement?.className,
        visibleAlbums: visibleAlbums
      };
      debugLog('[DIAGNOSE] First rendered item:', JSON.stringify(renderedInfo, null, 2));
      console.log('[YearsView] DIAGNOSE - First rendered item:', renderedInfo);
    }
    
    // Setup Lazy Loading für diesen Container
    setupContainerLazyLoading(containerKey);
    
    // Scroll-Position setzen wenn targetPlatz gegeben
    if (targetPlatz !== null && targetIndex !== null && targetIndex >= startIndex && targetIndex < endIndex) {
      requestAnimationFrame(() => {
        const items = Array.from(list.querySelectorAll('.years-album-item'));
        const targetItem = items.find(item => parseInt(item.dataset.platz) === targetPlatz);
        if (targetItem) {
          targetItem.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      });
    }
    
    console.log('[YearsView] loadYearIntoContainer complete for', containerKey);
  }
  
  // Funktion zum Setup von Lazy Loading für einen Container
  function setupContainerLazyLoading(containerKey) {
    const state = containerStates[containerKey];
    const container = containerKey === 'prev' ? prevContainer : containerKey === 'curr' ? currContainer : nextContainer;
    const list = containerKey === 'prev' ? prevList : containerKey === 'curr' ? currList : nextList;
    
    // Alten Observer trennen
    if (state.observer) {
      state.observer.disconnect();
    }
    
    // Entferne alte Sentinels
    if (state.topSentinel && state.topSentinel.parentNode) {
      state.topSentinel.remove();
    }
    if (state.bottomSentinel && state.bottomSentinel.parentNode) {
      state.bottomSentinel.remove();
    }
    
    // Neuer Observer
    state.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        
        if (entry.target === state.topSentinel) {
          loadChunkUpForContainer(containerKey);
        } else if (entry.target === state.bottomSentinel) {
          loadChunkDownForContainer(containerKey);
        }
      });
    }, {
      root: container,
      rootMargin: '200px'
    });
    
    // Update Sentinels
    updateContainerSentinels(containerKey);
  }
  
  // Funktion zum Aktualisieren der Sentinels für einen Container
  function updateContainerSentinels(containerKey) {
    const state = containerStates[containerKey];
    const list = containerKey === 'prev' ? prevList : containerKey === 'curr' ? currList : nextList;
    
    // Entferne alte Sentinels
    if (state.topSentinel && state.topSentinel.parentNode) {
      state.topSentinel.remove();
    }
    if (state.bottomSentinel && state.bottomSentinel.parentNode) {
      state.bottomSentinel.remove();
    }
    
    // Top-Sentinel
    if (state.loadedStart > 0) {
      state.topSentinel = document.createElement('div');
      state.topSentinel.className = 'lazy-load-sentinel';
      state.topSentinel.style.height = '1px';
      state.topSentinel.style.width = '100%';
      if (list.firstElementChild) {
        list.insertBefore(state.topSentinel, list.firstElementChild);
      } else {
        list.appendChild(state.topSentinel);
      }
      if (state.observer) {
        state.observer.observe(state.topSentinel);
      }
    }
    
    // Bottom-Sentinel
    if (state.loadedEnd < state.albums.length) {
      state.bottomSentinel = document.createElement('div');
      state.bottomSentinel.className = 'lazy-load-sentinel';
      state.bottomSentinel.style.height = '1px';
      state.bottomSentinel.style.width = '100%';
      list.appendChild(state.bottomSentinel);
      if (state.observer) {
        state.observer.observe(state.bottomSentinel);
      }
    }
  }
  
  // Funktion zum Synchronisieren der prev/next Container basierend auf curr Container Position
  async function syncAdjacentContainers() {
    // Nur synchronisieren wenn curr Container geladen ist
    if (!containerStates.curr.year || containerStates.curr.albums.length === 0) {
      return;
    }
    
    // Finde das sichtbare Album im curr Container (basierend auf Scroll-Position)
    const currItems = Array.from(currList.querySelectorAll('.years-album-item'));
    if (currItems.length === 0) return;
    
    const currContainerRect = currContainer.getBoundingClientRect();
    const viewportTop = currContainer.scrollTop;
    const viewportHeight = currContainerRect.height;
    const viewportCenter = viewportTop + viewportHeight / 2;
    
    // Finde das Album, das am nächsten zur Viewport-Mitte ist
    let visibleItem = null;
    let minDistance = Infinity;
    let visibleItemOffset = 0; // Offset vom Viewport-Top
    
    for (const item of currItems) {
      const rect = item.getBoundingClientRect();
      const itemTop = currContainer.scrollTop + (rect.top - currContainerRect.top);
      const itemHeight = rect.height;
      const itemCenter = itemTop + itemHeight / 2;
      const distance = Math.abs(itemCenter - viewportCenter);
      
      if (distance < minDistance) {
        minDistance = distance;
        visibleItem = item;
        visibleItemOffset = itemTop - viewportTop; // Offset vom Viewport-Top
      }
    }
    
    if (!visibleItem) return;
    
    const targetPlatz = parseInt(visibleItem.dataset.platz);
    if (!targetPlatz) return;
    
    // Synchronisiere prev Container mit exakter Scroll-Position
    if (containerStates.prev.year && containerStates.prev.albums.length > 0) {
      await syncContainerToPlatz('prev', targetPlatz, visibleItemOffset);
    }
    
    // Synchronisiere next Container mit exakter Scroll-Position
    if (containerStates.next.year && containerStates.next.albums.length > 0) {
      await syncContainerToPlatz('next', targetPlatz, visibleItemOffset);
    }
  }
  
  // Funktion zum Synchronisieren eines Containers auf einen bestimmten Platz
  async function syncContainerToPlatz(containerKey, targetPlatz, offsetFromTop = 0) {
    const state = containerStates[containerKey];
    const list = containerKey === 'prev' ? prevList : containerKey === 'curr' ? currList : nextList;
    const container = containerKey === 'prev' ? prevContainer : containerKey === 'curr' ? currContainer : nextContainer;
    
    // Finde Index des Albums mit diesem Platz
    const targetIndex = state.albums.findIndex(a => a.Platz === targetPlatz);
    if (targetIndex === -1) return;
    
    // Prüfe ob der Bereich bereits geladen ist
    const VIEWPORT_SIZE = 15;
    const targetStart = Math.max(0, targetIndex - Math.floor(VIEWPORT_SIZE / 2));
    const targetEnd = Math.min(state.albums.length, targetIndex + Math.ceil(VIEWPORT_SIZE / 2));
    
    // Lade fehlende Chunks oben
    while (state.loadedStart > targetStart) {
      const chunkStart = Math.max(0, state.loadedStart - CHUNK_SIZE);
      const chunk = state.albums.slice(chunkStart, state.loadedStart);
      const sortedChunk = [...chunk].sort((a, b) => a.Platz - b.Platz);
      
      const fragment = document.createDocumentFragment();
      for (const album of sortedChunk) {
        const item = await createAlbumItem(album);
        fragment.appendChild(item);
      }
      
      if (list.firstElementChild) {
        list.insertBefore(fragment, list.firstElementChild);
      } else {
        list.appendChild(fragment);
      }
      
      state.loadedStart = chunkStart;
    }
    
    // Lade fehlende Chunks unten
    while (state.loadedEnd < targetEnd) {
      const chunkEnd = Math.min(state.albums.length, state.loadedEnd + CHUNK_SIZE);
      const chunk = state.albums.slice(state.loadedEnd, chunkEnd);
      const sortedChunk = [...chunk].sort((a, b) => a.Platz - b.Platz);
      
      for (const album of sortedChunk) {
        const item = await createAlbumItem(album);
        list.appendChild(item);
      }
      
      state.loadedEnd = chunkEnd;
    }
    
    // Setze Scroll-Position auf das Ziel-Album mit exaktem Offset
    requestAnimationFrame(() => {
      const items = Array.from(list.querySelectorAll('.years-album-item'));
      const targetItem = items.find(item => parseInt(item.dataset.platz) === targetPlatz);
      if (targetItem) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();
        const itemTop = container.scrollTop + (itemRect.top - containerRect.top);
        
        // Setze Scroll-Position so, dass das Item an der gleichen Position wie im curr Container ist
        container.scrollTop = itemTop - offsetFromTop;
      }
    });
    
    // Update Sentinels
    updateContainerSentinels(containerKey);
  }
  
  // Funktion zum Laden nach unten für einen Container
  async function loadChunkDownForContainer(containerKey) {
    const state = containerStates[containerKey];
    const list = containerKey === 'prev' ? prevList : containerKey === 'curr' ? currList : nextList;
    
    if (state.loadedEnd >= state.albums.length) {
      return;
    }
    
    const endIndex = Math.min(state.loadedEnd + CHUNK_SIZE, state.albums.length);
    const chunk = state.albums.slice(state.loadedEnd, endIndex);
    
    // Stelle sicher, dass Chunk nach Platz sortiert ist
    const sortedChunk = [...chunk].sort((a, b) => a.Platz - b.Platz);
    
    for (const album of sortedChunk) {
      const item = await createAlbumItem(album);
      list.appendChild(item);
    }
    
    state.loadedEnd = endIndex;
    updateContainerSentinels(containerKey);
    
    // Synchronisiere andere Container wenn curr Container geladen wurde
    if (containerKey === 'curr') {
      await syncAdjacentContainers();
    }
  }
  
  // Funktion zum Laden nach oben für einen Container
  async function loadChunkUpForContainer(containerKey) {
    const state = containerStates[containerKey];
    const container = containerKey === 'prev' ? prevContainer : containerKey === 'curr' ? currContainer : nextContainer;
    const list = containerKey === 'prev' ? prevList : containerKey === 'curr' ? currList : nextList;
    
    if (state.loadedStart <= 0) {
      return;
    }
    
    const startIndex = Math.max(state.loadedStart - CHUNK_SIZE, 0);
    const chunk = state.albums.slice(startIndex, state.loadedStart);
    
    // Stelle sicher, dass Chunk nach Platz sortiert ist
    const sortedChunk = [...chunk].sort((a, b) => a.Platz - b.Platz);
    
    // Speichere Scroll-Position
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    
    // Füge Items am Anfang ein
    const fragment = document.createDocumentFragment();
    for (const album of sortedChunk) {
      const item = await createAlbumItem(album);
      fragment.appendChild(item);
    }
    
    if (list.firstElementChild) {
      list.insertBefore(fragment, list.firstElementChild);
    } else {
      list.appendChild(fragment);
    }
    
    // Warte auf Layout-Update
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Stelle Scroll-Position wieder her
    const newScrollHeight = container.scrollHeight;
    const heightDiff = newScrollHeight - scrollHeight;
    container.scrollTop = scrollTop + heightDiff;
    
    state.loadedStart = startIndex;
    updateContainerSentinels(containerKey);
    
    // Synchronisiere andere Container wenn curr Container geladen wurde
    if (containerKey === 'curr') {
      await syncAdjacentContainers();
    }
  }
  
  
  // Funktion zum Verschieben des Viewports
  function shiftViewport(direction, animated = true) {
    if (isShifting) return;
    
    // Prüfe Grenzen
    if (direction < 0 && currentYearIndex <= 0) {
      // Zurück zum aktuellen Jahr
      viewport.classList.remove('shifting');
      viewport.style.transform = `translateX(-33.33%)`;
      viewportOffset = 0;
      return;
    }
    if (direction > 0 && currentYearIndex >= years.length - 1) {
      // Zurück zum aktuellen Jahr
      viewport.classList.remove('shifting');
      viewport.style.transform = `translateX(-33.33%)`;
      viewportOffset = 0;
      return;
    }
    
    isShifting = true;
    if (transitionTimeout) {
      clearTimeout(transitionTimeout);
      transitionTimeout = null;
    }
    
    // WICHTIG: Aktualisiere Jahr-Index und Select SOFORT beim Swipe-Start
    const newYearIndex = currentYearIndex + direction;
    const newYear = years[newYearIndex];
    currentYearIndex = newYearIndex;
    currentYear = newYear;
    select.value = newYear;
    
    // Speichere Jahr und Scroll-Position
    saveYearAndPosition(newYear, currContainer.scrollTop);
    console.log('[YearsView] Year updated immediately:', newYear, 'index:', newYearIndex);
    
    if (animated) {
      // Berechne Ziel-Position
      const targetOffset = direction * 33.33;
      const targetTransform = `translateX(${-33.33 + targetOffset}%)`;
      console.log('[YearsView] Setting transform to:', targetTransform, 'direction:', direction);
      
      // WICHTIG: Entferne shifting-Klasse für Transition, dann setze Transform
      viewport.classList.remove('shifting');
      
      // Warte einen Frame damit die Klasse entfernt wird
      requestAnimationFrame(() => {
        viewport.style.transform = targetTransform;
        console.log('[YearsView] Transform applied');
        
        // Nach Animation Container rotieren und Viewport zurücksetzen (OHNE Transition)
        const onTransitionEnd = (e) => {
          // Prüfe ob es die richtige Transition ist (transform)
          if (e.target !== viewport || e.propertyName !== 'transform') return;
          
          console.log('[YearsView] Transition ended, rotating containers and resetting viewport');
          viewport.removeEventListener('transitionend', onTransitionEnd);
          if (transitionTimeout) {
            clearTimeout(transitionTimeout);
            transitionTimeout = null;
          }
          
          // Rotiere Container (OHNE Viewport zurücksetzen, da wir das gleich machen)
          rotateContainers(direction, false);
          
          // Viewport OHNE Transition zurücksetzen (Container wurden bereits rotiert)
          viewportOffset = 0;
          viewport.style.transition = 'none';
          viewport.style.transform = `translateX(-33.33%)`;
          requestAnimationFrame(() => {
            viewport.style.transition = '';
            console.log('[YearsView] Viewport reset to -33.33%, transition restored');
          });
          
          isShifting = false;
        };
        
        viewport.addEventListener('transitionend', onTransitionEnd, { once: true });
        
        // Fallback: Falls Transition nicht feuert (z.B. wenn bereits am Ziel)
        transitionTimeout = setTimeout(() => {
          if (isShifting) {
            console.log('[YearsView] Transition timeout, rotating containers and resetting viewport');
            viewport.removeEventListener('transitionend', onTransitionEnd);
            
            // Rotiere Container
            rotateContainers(direction, false);
            
            // Viewport OHNE Transition zurücksetzen
            viewportOffset = 0;
            viewport.style.transition = 'none';
            viewport.style.transform = `translateX(-33.33%)`;
            requestAnimationFrame(() => {
              viewport.style.transition = '';
            });
            
            isShifting = false;
          }
          transitionTimeout = null;
        }, 500);
      });
    } else {
      // Keine Animation: Container rotieren und Viewport sofort zurücksetzen
      rotateContainers(direction, false);
      viewportOffset = 0;
      viewport.style.transition = 'none';
      viewport.style.transform = `translateX(-33.33%)`;
      requestAnimationFrame(() => {
        viewport.style.transition = '';
      });
      isShifting = false;
    }
  }
  
  // Funktion zum Rotieren der Container (prev → curr → next)
  async function rotateContainers(direction, resetViewport = true) {
    if (direction === 0) return;
    
    console.log('[YearsView] rotateContainers called, direction:', direction, 'currentYearIndex:', currentYearIndex, 'resetViewport:', resetViewport);
    
    // Speichere Scroll-Position des aktuellen Containers BEVOR Rotation
    const oldCurrScrollTop = currContainer.scrollTop;
    const oldCurrItems = Array.from(currList.querySelectorAll('.years-album-item'));
    const visibleItem = oldCurrItems.find(item => {
      const rect = item.getBoundingClientRect();
      const containerRect = currContainer.getBoundingClientRect();
      return rect.top >= containerRect.top && rect.top <= containerRect.bottom;
    });
    const targetPlatz = visibleItem ? parseInt(visibleItem.dataset.platz) : null;
    console.log('[YearsView] Target platz:', targetPlatz, 'old scrollTop:', oldCurrScrollTop);
    
    // WICHTIG: Jahr-Index wurde bereits in shiftViewport aktualisiert, nicht nochmal ändern
    console.log('[YearsView] Current year:', currentYear, 'index:', currentYearIndex);
    
    // Rotiere Container-States und DOM-Referenzen
    if (direction > 0) {
      // Nach rechts: zum nächsten Jahr
      // curr → prev, next → curr, neues Jahr → next
      const tempState = { ...containerStates.prev };
      containerStates.prev = { ...containerStates.curr };
      containerStates.curr = { ...containerStates.next };
      containerStates.next = tempState;
      
      // DOM-Referenzen rotieren
      const oldPrev = prevContainer;
      const oldCurr = currContainer;
      const oldNext = nextContainer;
      
      // Neue Referenzen: curr wird prev, next wird curr, prev wird next
      prevContainer = oldCurr;
      prevList = prevContainer.querySelector('.years-album-list');
      currContainer = oldNext;
      currList = currContainer.querySelector('.years-album-list');
      nextContainer = oldPrev;
      nextList = nextContainer.querySelector('.years-album-list');
      
      // DIAGNOSE: Prüfe Referenzen nach Rotation
      const rotationInfo = {
        prevContainerYear: containerStates.prev?.year,
        currContainerYear: containerStates.curr?.year,
        nextContainerYear: containerStates.next?.year,
        prevListFound: !!prevList,
        currListFound: !!currList,
        nextListFound: !!nextList,
        prevContainerClass: prevContainer?.className,
        currContainerClass: currContainer?.className,
        nextContainerClass: nextContainer?.className
      };
      debugLog('[DIAGNOSE] After rotation (right):', JSON.stringify(rotationInfo, null, 2));
      console.log('[YearsView] DIAGNOSE - After rotation (right):', rotationInfo);
      
      // Klassen aktualisieren
      prevContainer.className = 'year-container prev';
      currContainer.className = 'year-container curr';
      nextContainer.className = 'year-container next';
      
      // Scroll-Position basierend auf targetPlatz setzen
      if (targetPlatz !== null) {
        requestAnimationFrame(() => {
          const items = Array.from(currList.querySelectorAll('.years-album-item'));
          const targetItem = items.find(item => parseInt(item.dataset.platz) === targetPlatz);
          if (targetItem) {
            targetItem.scrollIntoView({ behavior: 'auto', block: 'center' });
          } else {
            // Fallback: alte Scroll-Position
            currContainer.scrollTop = oldCurrScrollTop;
          }
        });
      } else {
        requestAnimationFrame(() => {
          currContainer.scrollTop = oldCurrScrollTop;
        });
      }
      
      // Nächstes Jahr laden (im Hintergrund)
      if (currentYearIndex + 1 < years.length) {
        const nextYear = years[currentYearIndex + 1];
        loadYearIntoContainer('next', nextYear, targetPlatz);
      } else {
        // Leere next-Container wenn kein nächstes Jahr
        nextList.innerHTML = '';
        containerStates.next = { year: null, yearIndex: -1, albums: [], loadedStart: 0, loadedEnd: 0, scrollTop: 0, observer: null, topSentinel: null, bottomSentinel: null };
      }
    } else {
      // Nach links: zum vorherigen Jahr
      // curr → next, prev → curr, neues Jahr → prev
      const tempState = { ...containerStates.next };
      containerStates.next = { ...containerStates.curr };
      containerStates.curr = { ...containerStates.prev };
      containerStates.prev = tempState;
      
      // DOM-Referenzen rotieren
      const oldPrev = prevContainer;
      const oldCurr = currContainer;
      const oldNext = nextContainer;
      
      // Neue Referenzen: curr wird next, prev wird curr, next wird prev
      prevContainer = oldNext;
      prevList = prevContainer.querySelector('.years-album-list');
      currContainer = oldPrev;
      currList = currContainer.querySelector('.years-album-list');
      nextContainer = oldCurr;
      nextList = nextContainer.querySelector('.years-album-list');
      
      // DIAGNOSE: Prüfe Referenzen nach Rotation
      const rotationInfoLeft = {
        prevContainerYear: containerStates.prev?.year,
        currContainerYear: containerStates.curr?.year,
        nextContainerYear: containerStates.next?.year,
        prevListFound: !!prevList,
        currListFound: !!currList,
        nextListFound: !!nextList,
        prevContainerClass: prevContainer?.className,
        currContainerClass: currContainer?.className,
        nextContainerClass: nextContainer?.className
      };
      debugLog('[DIAGNOSE] After rotation (left):', JSON.stringify(rotationInfoLeft, null, 2));
      console.log('[YearsView] DIAGNOSE - After rotation (left):', rotationInfoLeft);
      
      // Klassen aktualisieren
      prevContainer.className = 'year-container prev';
      currContainer.className = 'year-container curr';
      nextContainer.className = 'year-container next';
      
      // Scroll-Position basierend auf targetPlatz setzen
      if (targetPlatz !== null) {
        requestAnimationFrame(() => {
          const items = Array.from(currList.querySelectorAll('.years-album-item'));
          const targetItem = items.find(item => parseInt(item.dataset.platz) === targetPlatz);
          if (targetItem) {
            targetItem.scrollIntoView({ behavior: 'auto', block: 'center' });
          } else {
            // Fallback: alte Scroll-Position
            currContainer.scrollTop = oldCurrScrollTop;
          }
        });
      } else {
        requestAnimationFrame(() => {
          currContainer.scrollTop = oldCurrScrollTop;
        });
      }
      
      // Vorheriges Jahr laden (im Hintergrund)
      if (currentYearIndex - 1 >= 0) {
        const prevYear = years[currentYearIndex - 1];
        loadYearIntoContainer('prev', prevYear, targetPlatz);
      } else {
        // Leere prev-Container wenn kein vorheriges Jahr
        prevList.innerHTML = '';
        containerStates.prev = { year: null, yearIndex: -1, albums: [], loadedStart: 0, loadedEnd: 0, scrollTop: 0, observer: null, topSentinel: null, bottomSentinel: null };
      }
    }
    
    // DOM-Reihenfolge anpassen, damit prev/curr/next im Viewport stimmen
    viewport.replaceChildren(prevContainer, currContainer, nextContainer);
    
    // WICHTIG: Setze Container-Breiten nach Rotation neu (für Chrome Mobile)
    requestAnimationFrame(() => {
      setContainerWidths();
    });
    
    // Viewport zurücksetzen NUR wenn gewünscht (nicht während Transition)
    if (resetViewport) {
      viewportOffset = 0;
      viewport.classList.remove('shifting');
      viewport.style.transition = 'none';
      viewport.style.transform = `translateX(-33.33%)`;
      requestAnimationFrame(() => {
        viewport.style.transition = '';
        console.log('[YearsView] Viewport reset to -33.33%, transition restored');
      });
    } else {
      // Viewport ist bereits am Ziel (während Transition), nur Offset zurücksetzen
      viewportOffset = 0;
      console.log('[YearsView] Viewport already at target position, no reset needed');
    }
    
    // WICHTIG: Observer nach Rotation neu initialisieren, da Container-Referenzen sich geändert haben
    // Nur für Container, die bereits geladen sind (year !== null)
    if (containerStates.prev.year !== null) {
      setupContainerLazyLoading('prev');
    }
    if (containerStates.curr.year !== null) {
      setupContainerLazyLoading('curr');
    }
    if (containerStates.next.year !== null) {
      setupContainerLazyLoading('next');
    }
  }
  
  // Setup Swipe-Gesten auf Viewport-Ebene
  function setupViewportSwipeGestures() {
    viewContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (isShifting) return; // Verhindere Swipe während Transition
      
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isScrolling = false;
      touchMoved = false;
      currentSwipeOffset = 0;
    }, { passive: true });
    
    viewContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      if (isShifting) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);
      
      touchMoved = true;
      
      // Prüfe ob vertikales Scrollen
      if (deltaY > SWIPE_MAX_VERTICAL && deltaY > Math.abs(deltaX) * 1.5) {
        isScrolling = true;
        return;
      }
      
      // Horizontales Swipe
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
        
        // Berechne Viewport-Offset (in Prozent)
        const containerWidth = viewContainer.clientWidth;
        const offsetPercent = (deltaX / containerWidth) * 100;
        currentSwipeOffset = offsetPercent;
        
        // Begrenze Swipe
        const maxOffset = 33.33;
        const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, offsetPercent));
        
        // Verschiebe Viewport während Swipe
        viewport.style.transform = `translateX(${-33.33 + clampedOffset}%)`;
        viewport.classList.add('shifting');
      }
    }, { passive: false });
    
    viewContainer.addEventListener('touchend', (e) => {
      if (!touchMoved || isScrolling || isShifting) {
        viewport.classList.remove('shifting');
        viewport.style.transform = `translateX(${-33.33 + viewportOffset}%)`;
        return;
      }
      
      const touch = e.changedTouches[0];
      if (!touch) return;
      
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);
      const deltaTime = Date.now() - touchStartTime;
      
      // Prüfe ob es ein Swipe ist
      if (deltaTime > SWIPE_MAX_TIME) {
        viewport.classList.remove('shifting');
        viewport.style.transform = `translateX(${-33.33 + viewportOffset}%)`;
        return;
      }
      
      if (deltaY > SWIPE_MAX_VERTICAL && deltaY > Math.abs(deltaX) * 1.5) {
        viewport.classList.remove('shifting');
        viewport.style.transform = `translateX(${-33.33 + viewportOffset}%)`;
        return;
      }
      
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
        viewport.classList.remove('shifting');
        viewport.style.transform = `translateX(${-33.33 + viewportOffset}%)`;
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      // Bestimme Richtung
      const direction = deltaX > 0 ? -1 : 1;
      
      // Prüfe ob Swipe stark genug für Jahr-Wechsel
      const containerWidth = viewContainer.clientWidth;
      const swipePercent = (Math.abs(deltaX) / containerWidth) * 100;
      
      if (swipePercent > 20 || Math.abs(currentSwipeOffset) > 15) {
        // Jahr wechseln - WICHTIG: Rotiere Container SOFORT, dann Viewport zurücksetzen
        viewport.classList.remove('shifting');
        
        // Prüfe Grenzen
        const newYearIndex = currentYearIndex + direction;
        if (newYearIndex < 0 || newYearIndex >= years.length) {
          // Zurück zum aktuellen Jahr wenn Grenze erreicht
          viewport.style.transform = `translateX(-33.33%)`;
          viewportOffset = 0;
          return;
        }
        
        // Aktualisiere Jahr SOFORT
        const newYear = years[newYearIndex];
        currentYearIndex = newYearIndex;
        currentYear = newYear;
        select.value = newYear;
        console.log('[YearsView] Year updated immediately:', newYear, 'index:', newYearIndex);
        
        // Speichere Jahr und Scroll-Position
        saveYearAndPosition(newYear, currContainer.scrollTop);
        
        // Rotiere Container SOFORT (ohne Viewport-Reset)
        rotateContainers(direction, false);
        
        // Viewport OHNE Transition zurücksetzen (Container wurden bereits rotiert)
        viewportOffset = 0;
        viewport.style.transition = 'none';
        viewport.style.transform = `translateX(-33.33%)`;
        requestAnimationFrame(() => {
          viewport.style.transition = '';
          console.log('[YearsView] Viewport reset to -33.33% after container rotation');
        });
      } else {
        // Zurück zum aktuellen Jahr
        viewport.classList.remove('shifting');
        viewport.style.transform = `translateX(-33.33%)`;
        viewportOffset = 0;
        console.log('[YearsView] Swipe cancelled, returning to current year');
      }
    }, { passive: false });
    
    viewContainer.addEventListener('touchcancel', () => {
      viewport.classList.remove('shifting');
      viewport.style.transform = `translateX(-33.33%)`;
      viewportOffset = 0;
      touchMoved = false;
      isScrolling = false;
      currentSwipeOffset = 0;
    }, { passive: true });
  }
  
  // Initialisierung
  async function initialize() {
    console.log('[YearsView] Initializing, currentYear:', currentYear, 'currentYearIndex:', currentYearIndex, 'savedScrollPosition:', savedScrollPosition);
    
    // DIAGNOSE: Prüfe initiale Container-Referenzen
    const initInfo = {
      prevContainerExists: !!prevContainer,
      currContainerExists: !!currContainer,
      nextContainerExists: !!nextContainer,
      prevListExists: !!prevList,
      currListExists: !!currList,
      nextListExists: !!nextList,
      viewportTransform: viewport.style.transform,
      viewportComputedStyle: window.getComputedStyle(viewport).transform,
      userAgent: navigator.userAgent
    };
    debugLog('[DIAGNOSE] Initial container state:', JSON.stringify(initInfo, null, 2));
    console.log('[YearsView] DIAGNOSE - Initial container state:', initInfo);
    
    // Lade aktuelles Jahr
    await loadYearIntoContainer('curr', currentYear);
    console.log('[YearsView] Loaded curr year:', currentYear);
    
    // DIAGNOSE: Prüfe was tatsächlich im curr-Container angezeigt wird
    setTimeout(() => {
      const currItems = currList.querySelectorAll('.years-album-item');
      if (currItems.length > 0) {
        const visibleCurrAlbums = Array.from(currItems).slice(0, 5).map(item => {
          const bandEl = item.querySelector('.years-album-band');
          const titleEl = item.querySelector('.years-album-title');
          return {
            platz: item.dataset.platz,
            band: bandEl?.textContent || 'N/A',
            album: titleEl?.textContent || 'N/A'
          };
        });
        const viewportRect = viewport.getBoundingClientRect();
        const prevRect = prevContainer.getBoundingClientRect();
        const currRect = currContainer.getBoundingClientRect();
        const nextRect = nextContainer.getBoundingClientRect();
        const viewportComputed = window.getComputedStyle(viewport);
        const viewContainerRect = viewContainer.getBoundingClientRect();
        
        debugLog('[DIAGNOSE] Initial layout check:', JSON.stringify({
          expectedYear: currentYear,
          containerYear: containerStates.curr?.year,
          visibleAlbums: visibleCurrAlbums,
          viewportTransform: viewport.style.transform,
          viewportComputedTransform: viewportComputed.transform,
          viewportWidth: viewportRect.width,
          viewportLeft: viewportRect.left,
          viewContainerWidth: viewContainerRect.width,
          viewContainerLeft: viewContainerRect.left,
          prevContainerLeft: prevRect.left,
          prevContainerWidth: prevRect.width,
          currContainerLeft: currRect.left,
          currContainerWidth: currRect.width,
          nextContainerLeft: nextRect.left,
          nextContainerWidth: nextRect.width,
          viewportOffset: viewportOffset,
          userAgent: navigator.userAgent
        }, null, 2));
      }
    }, 500);
    
    // Stelle Scroll-Position wieder her (nach mehreren Verzögerungen, damit alle Items geladen sind)
    if (savedScrollPosition > 0) {
      // Warte auf DOM-Rendering und Lazy Loading
      setTimeout(() => {
        currContainer.scrollTop = savedScrollPosition;
        console.log('[YearsView] Restored scroll position (first attempt):', savedScrollPosition);
        
        // Zweiter Versuch nach längerer Verzögerung (falls Lazy Loading noch läuft)
        setTimeout(() => {
          currContainer.scrollTop = savedScrollPosition;
          console.log('[YearsView] Restored scroll position (second attempt):', savedScrollPosition);
        }, 500);
      }, 200);
    }
    
    // Lade vorheriges Jahr (falls vorhanden)
    if (currentYearIndex > 0) {
      const prevYear = years[currentYearIndex - 1];
      await loadYearIntoContainer('prev', prevYear);
      console.log('[YearsView] Loaded prev year:', prevYear);
    }
    
    // Lade nächstes Jahr (falls vorhanden)
    if (currentYearIndex < years.length - 1) {
      const nextYear = years[currentYearIndex + 1];
      await loadYearIntoContainer('next', nextYear);
      console.log('[YearsView] Loaded next year:', nextYear);
    }
    
    // Setup Swipe-Gesten
    setupViewportSwipeGestures();
    console.log('[YearsView] Swipe gestures setup complete');
    
    // Scroll-Listener für Synchronisation der prev/next Container
    let syncTimeout = null;
    currContainer.addEventListener('scroll', () => {
      // Debounce: Synchronisiere nur alle 150ms (schneller für bessere Sync)
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(async () => {
        await syncAdjacentContainers();
      }, 150);
    }, { passive: true });
    
    // Event Listener für Select
    select.addEventListener('change', async (e) => {
      const newYear = parseInt(e.target.value);
      const newIndex = years.indexOf(newYear);
      const direction = newIndex - currentYearIndex;
      
      console.log('[YearsView] Select changed:', newYear, 'direction:', direction);
      
      if (direction !== 0) {
        // Speichere alte Position (nur sessionStorage)
        saveYearAndPositionToStorage(currentYear, currContainer.scrollTop);
        
        // Lade direkt ohne Animation
        currentYearIndex = newIndex;
        currentYear = newYear;
        await loadYearIntoContainer('curr', newYear);
        
        // Stelle Scroll-Position wieder her (falls gespeichert)
        const { scrollTop: restoredScrollTop } = loadYearAndPosition();
        if (restoredScrollTop > 0) {
          setTimeout(() => {
            currContainer.scrollTop = restoredScrollTop;
          }, 100);
        }
        
        // Speichere neues Jahr (mit URL-Update)
        saveYearAndPosition(newYear, 0, true); // Reset scroll wenn Jahr gewechselt
        
        // Lade Nachbarn
        if (newIndex > 0) {
          await loadYearIntoContainer('prev', years[newIndex - 1]);
        }
        if (newIndex < years.length - 1) {
          await loadYearIntoContainer('next', years[newIndex + 1]);
        }
      }
    });
    
    // Speichere Position beim Scrollen (debounced, nur sessionStorage, keine URL)
    let scrollSaveTimeout = null;
    currContainer.addEventListener('scroll', () => {
      clearTimeout(scrollSaveTimeout);
      scrollSaveTimeout = setTimeout(() => {
        saveYearAndPositionToStorage(currentYear, currContainer.scrollTop);
      }, 1000); // Längeres Debounce für weniger Speicherungen
    }, { passive: true });
    
    // Speichere Position beim Verlassen der View (nur sessionStorage)
    window.addEventListener('beforeunload', () => {
      saveYearAndPositionToStorage(currentYear, currContainer.scrollTop);
    });
    
    // Speichere Position bei Hash-Change (wenn zu anderer Route navigiert wird)
    window.addEventListener('hashchange', () => {
      const { route } = parseHash();
      if (route !== 'jahre') {
        saveYearAndPositionToStorage(currentYear, currContainer.scrollTop);
      }
    });
  }
  
  // Starte Initialisierung
  await initialize();
  console.log('[YearsView] Initialization complete');
}
