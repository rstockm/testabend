/**
 * Routing-Logik
 */
import { parseHash, updateHash, setActiveNav, isMobile } from './utils.js';
import { renderOverview, renderBandsSeries, renderScatterAll } from './renderers.js';
import { buildBandPanel, buildTagBar, createToggle, buildScatterZoomControls, buildThresholdsLegend, buildMobileBandToolbar, buildMobileBandModal, buildMobileSettingsModal } from './controls.js';
import { Chat } from './chat.js';
import { cleanupScatterKeyboardNav } from './scatterKeyboardNav.js';

/**
 * Router-Klasse
 */
export class Router {
  constructor(data, bands, chartEl, controlsEl) {
    this.data = data;
    this.bands = bands;
    this.chartEl = chartEl;
    this.controlsEl = controlsEl;
    this.chat = null; // Chat-Instanz wird persistent gehalten
    this.mobileModal = null;
    this.mobileSettingsModal = null;
  }
  
  /**
   * Route verarbeiten
   */
  async route() {
    const { route, params } = parseHash();
    setActiveNav(route);
    
    // Cleanup Keyboard-Navigation wenn View wechselt
    cleanupScatterKeyboardNav();
    
    this.controlsEl.innerHTML = '';
    this.chartEl.innerHTML = '';
    this.resetBandLayout();
    
    const scatterContainer = document.getElementById('scatter-container');
    if (scatterContainer) {
      scatterContainer.remove();
    }
    
    const headerControls = document.getElementById('header-controls');
    headerControls.innerHTML = '';
    
    switch (route) {
      case 'overview':
        await this.handleOverview();
        break;
      case 'band':
        await this.handleBand(params, headerControls);
        break;
      case 'scatter':
        await this.handleScatter();
        break;
      case 'testteam':
        await this.handleTestteam();
        break;
      default:
        await this.handleOverview();
    }
  }
  
  /**
   * Overview-Route
   */
  async handleOverview() {
    await renderOverview(this.data, this.chartEl);
  }
  
  /**
   * Band-Route
   */
  async handleBand(params, headerControls) {
    const showTitles = params.titles !== 'false';
    const sortBy = params.sort === 'count' ? 'count' : 'alphabetical';
    const showRegression = params.regression === 'true';
    const showThresholds = params.thresholds !== 'false'; // Standard: an
    const isMobileView = isMobile();
    
    // Header-Controls erstellen (Desktop)
    this.createBandHeaderControls(params, showTitles, sortBy, showRegression, showThresholds, headerControls);
    
    // Ausgewählte Bands parsen
    const selected = this.parseSelectedBands(params.b);
    
    // Layout erstellen
    const mainEl = document.querySelector('main');
    const layout = document.createElement('div');
    layout.className = 'layout-band';
    layout.id = 'band-layout';
    
    // 1. Desktop Band Panel (Links)
    const panel = buildBandPanel(
      this.bands, 
      [...selected], 
      (sel) => this.updateBandHash(sel, showTitles, sortBy, showRegression, showThresholds),
      this.data, 
      sortBy
    );
    
    // 2. Mobile-spezifische Komponenten nur erstellen, wenn wirklich benötigt
    let mobileToolbar = null;
    if (isMobileView) {
      const mobileModal = buildMobileBandModal(
        this.bands,
        [...selected],
        (sel) => this.updateBandHash(sel, showTitles, sortBy, showRegression, showThresholds),
        () => mobileModal.classList.remove('active'), // Close Handler
        this.data,
        sortBy
      );
      document.body.appendChild(mobileModal);
      this.mobileModal = mobileModal;
      
      const settingsModal = buildMobileSettingsModal({
        showTitles,
        sortBy,
        showRegression,
        showThresholds,
        onApply: (nextState) => {
          this.updateBandHash(
            selected,
            nextState.showTitles,
            nextState.sortBy,
            nextState.showRegression,
            nextState.showThresholds
          );
        }
      });
      document.body.appendChild(settingsModal.modal);
      this.mobileSettingsModal = settingsModal.modal;
      
      mobileToolbar = buildMobileBandToolbar(
        selected,
        (bandToRemove) => {
          const next = selected.filter(b => b !== bandToRemove);
          this.updateBandHash(next, showTitles, sortBy, showRegression, showThresholds);
        },
        () => mobileModal.classList.add('active'),
        () => settingsModal.open()
      );
    } else {
      this.mobileModal = null;
      if (this.mobileSettingsModal) {
        this.mobileSettingsModal.remove();
        this.mobileSettingsModal = null;
      }
    }
    
    // 4. Desktop Tags + Chart Container (Rechts)
    const right = document.createElement('div');
    right.className = 'band-content-area';
    const tags = buildTagBar(
      selected, 
      (bandToRemove) => {
        const next = selected.filter(b => b !== bandToRemove);
        this.updateBandHash(next, showTitles, sortBy, showRegression, showThresholds);
      }
    );
    
    const controlsRow = document.createElement('div');
    controlsRow.className = 'band-controls-row';
    
    // Schwellen-Legende hinzufügen, wenn aktiviert
    if (showThresholds) {
      const legend = buildThresholdsLegend();
      controlsRow.appendChild(legend);
    }
    
    controlsRow.appendChild(tags);
    right.appendChild(controlsRow);
    
    // 5. Chart Container (Mobil: Scroll-Wrapper)
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'mobile-chart-container';
    
    const scrollArea = document.createElement('div');
    scrollArea.className = 'mobile-chart-scroll-area';
    scrollArea.appendChild(this.chartEl);
    
    chartWrapper.appendChild(scrollArea);
    right.appendChild(chartWrapper);
    
    // Layout zusammenbauen
    if (mobileToolbar) {
      layout.appendChild(mobileToolbar);
    }
    
    if (!isMobileView) {
      layout.appendChild(panel);
    }
    
    layout.appendChild(right);
    
    this.controlsEl.style.display = 'none';
    mainEl.appendChild(layout);
    
    if (selected.length === 0) {
      this.chartEl.innerHTML = '<p style="padding: 40px; text-align: center; color: #a3a3a3;">Bitte wähle eine oder mehrere Bands aus.</p>';
    } else {
      await renderBandsSeries(this.data, selected, this.chartEl, showTitles, showRegression, showThresholds);
    }
  }
  
  /**
   * Scatter-Route
   */
  async handleScatter() {
    this.controlsEl.innerHTML = '';
    this.chartEl.innerHTML = '';
    this.controlsEl.style.display = 'none';
    
    const mainEl = document.querySelector('main');
    if (!mainEl.contains(this.chartEl)) {
      mainEl.appendChild(this.chartEl);
    }
    
    const scatterContainer = document.createElement('div');
    scatterContainer.style.cssText = 'display: flex; gap: 16px; align-items: flex-start; width: 100%;';
    scatterContainer.id = 'scatter-container';
    
    if (mainEl.contains(this.chartEl)) {
      mainEl.removeChild(this.chartEl);
    }
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'flex: 1;';
    chartWrapper.appendChild(this.chartEl);
    scatterContainer.appendChild(chartWrapper);
    
    let currentZoomY = null;
    const zoomControls = buildScatterZoomControls(this.data, async (zoom) => {
      currentZoomY = zoom.y;
      await renderScatterAll(this.data, this.chartEl, zoom.y);
    });
    
    if (zoomControls) {
      scatterContainer.appendChild(zoomControls);
    }
    
    mainEl.appendChild(scatterContainer);
    await renderScatterAll(this.data, this.chartEl, currentZoomY);
  }
  
  /**
   * Header-Controls für Band-Route erstellen
   */
  createBandHeaderControls(params, showTitles, sortBy, showRegression, showThresholds, headerControls) {
    // Albentitel Toggle
    const titleToggle = createToggle('Albentitel', showTitles, () => {
      const selected = this.parseSelectedBands(params.b);
      const q = this.buildBandQuery(selected, !showTitles, sortBy, showRegression, showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(titleToggle);
    
    // Sortierung Toggle
    const sortToggle = createToggle('Nach Anzahl', sortBy === 'count', () => {
      const selected = this.parseSelectedBands(params.b);
      const newSortBy = sortBy === 'count' ? 'alphabetical' : 'count';
      const q = this.buildBandQuery(selected, showTitles, newSortBy, showRegression, showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(sortToggle);
    
    // Regression Toggle
    const regressionToggle = createToggle('Regression', showRegression, () => {
      const selected = this.parseSelectedBands(params.b);
      const q = this.buildBandQuery(selected, showTitles, sortBy, !showRegression, showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(regressionToggle);
    
    // Schwellen Toggle
    const thresholdsToggle = createToggle('Schwellen', showThresholds, () => {
      const selected = this.parseSelectedBands(params.b);
      const q = this.buildBandQuery(selected, showTitles, sortBy, showRegression, !showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(thresholdsToggle);
  }
  
  /**
   * Ausgewählte Bands aus Parametern parsen
   */
  parseSelectedBands(bandParam) {
    const selected = [];
    if (bandParam) {
      // URL-Decode für Parameter (falls nicht schon durch utils geschehen)
      // Hinweis: utils.parseHash decoded bereits die Values.
      // Hier splitten wir nur den Komma-separierten String.
      const parts = bandParam.split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (this.bands.includes(p)) {
          selected.push(p);
        }
      }
    }
    return selected;
  }
  
  /**
   * Query-Parameter für Band-Route bauen
   */
  buildBandQuery(selected, showTitles, sortBy, showRegression, showThresholds = true) {
    const q = {};
    if (selected && selected.length > 0) {
      q.b = selected.join(',');
    }
    if (showTitles === false) {
      q.titles = 'false';
    }
    if (sortBy === 'count') {
      q.sort = 'count';
    }
    if (showRegression === true) {
      q.regression = 'true';
    }
    if (showThresholds === false) {
      q.thresholds = 'false';
    }
    return q;
  }
  
  /**
   * Hash für Band-Route aktualisieren
   */
  updateBandHash(selected, showTitles, sortBy, showRegression, showThresholds = true) {
    const q = this.buildBandQuery(selected, showTitles, sortBy, showRegression, showThresholds);
    updateHash('band', q);
  }
  
  /**
   * Testteam-Route
   */
  async handleTestteam() {
    this.controlsEl.innerHTML = '';
    this.chartEl.innerHTML = '';
    this.resetBandLayout();
    
    const scatterContainer = document.getElementById('scatter-container');
    if (scatterContainer) {
      scatterContainer.remove();
    }
    
    // Chat-Container erstellen oder wiederherstellen
    let chatContainer = document.getElementById('chat-container');
    if (!chatContainer) {
      const mainEl = document.querySelector('main');
      chatContainer = document.createElement('div');
      chatContainer.id = 'chat-container';
      chatContainer.className = 'chat-page';
      mainEl.appendChild(chatContainer);
    }
    
    // API-Key
    // Chat initialisieren oder wiederherstellen (mit persistentem Verlauf)
    // API-Key wird serverseitig vom Proxy verwendet
    if (!this.chat) {
      this.chat = new Chat(chatContainer, this.data, null);
    } else {
      // Container aktualisieren, falls sich geändert hat
      this.chat.containerEl = chatContainer;
    }
    this.chat.render();
  }
  
  /**
   * Band-Layout zurücksetzen
   */
  resetBandLayout() {
    const layout = document.getElementById('band-layout');
    const mainEl = document.querySelector('main');
    if (layout) {
      mainEl.appendChild(this.chartEl);
      layout.remove();
    }
    this.controlsEl.style.display = '';
    
    // Mobile Modal entfernen, falls vorhanden
    if (this.mobileModal) {
      this.mobileModal.remove();
      this.mobileModal = null;
    }
    if (this.mobileSettingsModal) {
      this.mobileSettingsModal.remove();
      this.mobileSettingsModal = null;
    }
    
    // Chat-Container entfernen falls vorhanden
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.remove();
    }
  }
}
