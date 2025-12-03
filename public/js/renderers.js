/**
 * Chart-Rendering-Funktionen
 */
import { CONFIG, getDarkThemeConfig, getBandPalette } from './config.js';
import { generateYearRange, calculateYDomain, calculateMinMaxPerYear, isMobile, simplifyYearLabels, uniqueSorted } from './utils.js';
import { polynomialRegression, generateRegressionPoints } from './regression.js';
import { setupCoverTooltipHandler } from './coverTooltip.js';
import { setupScatterKeyboardNav } from './scatterKeyboardNav.js';

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
    setupCoverTooltipHandler();
    
    // Setup Keyboard-Navigation
    if (result && result.view) {
      setupScatterKeyboardNav(filtered, result.view, chartEl);
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
  
  await vegaEmbed(chartEl, spec, { actions: false });
  setupCoverTooltipHandler();
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

/**
 * Jahre-View rendern (nur Mobile)
 */
export async function renderYearsView(data, containerEl) {
  // Alle verfügbaren Jahre extrahieren und sortieren
  const yearsSorted = uniqueSorted(data.map(d => d.Jahr).filter(y => y != null));
  const years = [...yearsSorted]; // Kopie für Navigation (aufsteigend)
  const yearsDescending = [...yearsSorted].reverse(); // Absteigend für Select
  
  if (years.length === 0) {
    containerEl.innerHTML = '<p style="padding: 40px; text-align: center; color: #a3a3a3;">Keine Daten verfügbar.</p>';
    return;
  }
  
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
  
  yearSelector.appendChild(selectorLabel);
  yearSelector.appendChild(select);
  
  // Multi-Container Struktur erstellen
  const viewContainer = document.createElement('div');
  viewContainer.className = 'years-view-container';
  
  const viewport = document.createElement('div');
  viewport.className = 'years-viewport';
  
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
  
  // Multi-Container State
  let currentYearIndex = years.indexOf(parseInt(select.value));
  if (currentYearIndex === -1) {
    currentYearIndex = 0; // Fallback falls Jahr nicht gefunden
  }
  let currentYear = years[currentYearIndex];
  
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
    
    const bandName = document.createElement('div');
    bandName.className = 'years-album-band';
    bandName.textContent = album.Band;
    
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
    
    if (!container || !list) {
      console.error('[YearsView] Container or list not found for:', containerKey);
      return;
    }
    
    // Alben für das Jahr filtern und sortieren
    const albums = data
      .filter(d => d.Jahr === year && d.Platz != null)
      .sort((a, b) => a.Platz - b.Platz);
    
    console.log('[YearsView] Found', albums.length, 'albums for year', year);
    console.log('[YearsView] First 5 albums Platz:', albums.slice(0, 5).map(a => a.Platz));
    
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
    
    for (const album of sortedChunk) {
      const item = await createAlbumItem(album);
      list.appendChild(item);
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
    const currContainerRect = currContainer.getBoundingClientRect();
    const viewportTop = currContainerRect.top + currContainer.scrollTop;
    const viewportBottom = viewportTop + currContainerRect.height;
    
    // Finde das Album, das am nächsten zur Viewport-Mitte ist
    let visibleItem = null;
    let minDistance = Infinity;
    const viewportCenter = viewportTop + (viewportBottom - viewportTop) / 2;
    
    for (const item of currItems) {
      const rect = item.getBoundingClientRect();
      const itemTop = currContainer.scrollTop + (rect.top - currContainerRect.top);
      const itemCenter = itemTop + rect.height / 2;
      const distance = Math.abs(itemCenter - viewportCenter);
      
      if (distance < minDistance) {
        minDistance = distance;
        visibleItem = item;
      }
    }
    
    if (!visibleItem) return;
    
    const targetPlatz = parseInt(visibleItem.dataset.platz);
    if (!targetPlatz) return;
    
    // Synchronisiere prev Container
    if (containerStates.prev.year && containerStates.prev.albums.length > 0) {
      await syncContainerToPlatz('prev', targetPlatz);
    }
    
    // Synchronisiere next Container
    if (containerStates.next.year && containerStates.next.albums.length > 0) {
      await syncContainerToPlatz('next', targetPlatz);
    }
  }
  
  // Funktion zum Synchronisieren eines Containers auf einen bestimmten Platz
  async function syncContainerToPlatz(containerKey, targetPlatz) {
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
    
    // Setze Scroll-Position auf das Ziel-Album
    requestAnimationFrame(() => {
      const items = Array.from(list.querySelectorAll('.years-album-item'));
      const targetItem = items.find(item => parseInt(item.dataset.platz) === targetPlatz);
      if (targetItem) {
        targetItem.scrollIntoView({ behavior: 'auto', block: 'center' });
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
        // Jahr wechseln - WICHTIG: Entferne shifting-Klasse BEVOR shiftViewport aufgerufen wird
        viewport.classList.remove('shifting');
        shiftViewport(direction, true);
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
    console.log('[YearsView] Initializing, currentYear:', currentYear, 'currentYearIndex:', currentYearIndex);
    
    // Lade aktuelles Jahr
    await loadYearIntoContainer('curr', currentYear);
    console.log('[YearsView] Loaded curr year:', currentYear);
    
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
      // Debounce: Synchronisiere nur alle 300ms
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(async () => {
        await syncAdjacentContainers();
      }, 300);
    }, { passive: true });
    
    // Event Listener für Select
    select.addEventListener('change', async (e) => {
      const newYear = parseInt(e.target.value);
      const newIndex = years.indexOf(newYear);
      const direction = newIndex - currentYearIndex;
      
      console.log('[YearsView] Select changed:', newYear, 'direction:', direction);
      
      if (direction !== 0) {
        // Lade direkt ohne Animation
        currentYearIndex = newIndex;
        currentYear = newYear;
        await loadYearIntoContainer('curr', newYear);
        
        // Lade Nachbarn
        if (newIndex > 0) {
          await loadYearIntoContainer('prev', years[newIndex - 1]);
        }
        if (newIndex < years.length - 1) {
          await loadYearIntoContainer('next', years[newIndex + 1]);
        }
      }
    });
  }
  
  // Starte Initialisierung
  await initialize();
  console.log('[YearsView] Initialization complete');
}
