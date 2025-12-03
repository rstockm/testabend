/**
 * Routing-Logik
 */
import { parseHash, updateHash, setActiveNav, isMobile } from './utils.js';
import { renderBandsSeries, renderScatterAll, renderYearsView } from './renderers.js';
import { buildBandPanel, buildTagBar, createToggle, buildScatterZoomControls, buildThresholdsLegend, buildMobileBandToolbar, buildMobileBandModal, buildMobileSettingsModal } from './controls.js';
import { Chat } from './chat.js';
import { cleanupScatterKeyboardNav } from './scatterKeyboardNav.js';
import { createScatterInfoBox, destroyScatterInfoBox } from './scatterInfoBox.js';

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
      case 'band':
        await this.handleBand(params, headerControls);
        break;
      case 'jahre':
        await this.handleScatter();
        break;
      case 'testteam':
        await this.handleTestteam();
        break;
      default:
        await this.handleBand({}, headerControls);
    }
  }
  
  /**
   * Band-Route
   */
  async handleBand(params, headerControls) {
    // Lade Settings: Zuerst aus URL, dann aus localStorage
    let showTitles = params.titles !== undefined ? params.titles !== 'false' : this.loadSetting('showTitles', true);
    let sortBy = params.sort !== undefined ? (params.sort === 'count' ? 'count' : 'alphabetical') : this.loadSetting('sortBy', 'alphabetical');
    let showRegression = params.regression !== undefined ? params.regression === 'true' : this.loadSetting('showRegression', false);
    let showThresholds = params.thresholds !== undefined ? params.thresholds !== 'false' : this.loadSetting('showThresholds', true);
    
    // Speichere Settings in localStorage (falls aus URL geladen)
    if (params.titles !== undefined) this.saveSetting('showTitles', showTitles);
    if (params.sort !== undefined) this.saveSetting('sortBy', sortBy);
    if (params.regression !== undefined) this.saveSetting('showRegression', showRegression);
    if (params.thresholds !== undefined) this.saveSetting('showThresholds', showThresholds);
    
    const isMobileView = isMobile();
    
    // Ausgewählte Bands parsen: Zuerst aus URL, dann aus sessionStorage
    let selected = this.parseSelectedBands(params.b);
    
    // Wenn keine Bands in URL, versuche aus sessionStorage zu laden
    if (selected.length === 0) {
      try {
        const storedBands = sessionStorage.getItem('selectedBands');
        if (storedBands) {
          selected = JSON.parse(storedBands);
        }
      } catch (e) {
        console.warn('Failed to load bands from sessionStorage:', e);
      }
    } else {
      // Bands in URL vorhanden: Speichere sie in sessionStorage
      try {
        sessionStorage.setItem('selectedBands', JSON.stringify(selected));
      } catch (e) {
        console.warn('Failed to save bands to sessionStorage:', e);
      }
    }
    
    // Aktualisiere URL mit Settings und Bands (falls Settings aus localStorage geladen wurden)
    const needsUrlUpdate = params.titles === undefined || params.sort === undefined || params.regression === undefined || params.thresholds === undefined;
    if (needsUrlUpdate || selected.length > 0) {
      const q = this.buildBandQuery(selected, showTitles, sortBy, showRegression, showThresholds);
      const newHash = `band?${new URLSearchParams(q).toString()}`;
      window.history.replaceState(null, '', `#${newHash}`);
    }
    
    // Header-Controls erstellen (Desktop)
    this.createBandHeaderControls(params, showTitles, sortBy, showRegression, showThresholds, headerControls);
    
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
          // Speichere Settings in localStorage
          this.saveSetting('showTitles', nextState.showTitles);
          this.saveSetting('sortBy', nextState.sortBy);
          this.saveSetting('showRegression', nextState.showRegression);
          this.saveSetting('showThresholds', nextState.showThresholds);
          
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
    scatterContainer.style.cssText = 'display: flex; gap: 16px; align-items: flex-start; width: 100%; justify-content: space-between;';
    scatterContainer.id = 'scatter-container';
    
    if (mainEl.contains(this.chartEl)) {
      mainEl.removeChild(this.chartEl);
    }
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;'; // min-width: 0 für korrektes Flexbox-Verhalten, overflow: hidden verhindert Überlauf
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
    
    // Container ZUERST zum DOM hinzufügen, damit Info-Box den Container finden kann
    mainEl.appendChild(scatterContainer);
    
    // Erstelle Info-Box NACH dem Hinzufügen zum DOM
    createScatterInfoBox('scatter-container');
    
    // Warte kurz, damit Container-Breite korrekt berechnet wird
    await new Promise(resolve => setTimeout(resolve, 0));
    
    await renderScatterAll(this.data, this.chartEl, currentZoomY);
    
    // Trigger Resize nach Rendering, damit Chart die korrekte Breite erkennt
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scatterView = document.querySelector('#scatter-container .vega-embed');
        if (scatterView && scatterView.__view__) {
          scatterView.__view__.resize();
        }
      });
    });
  }
  
  /**
   * Header-Controls für Band-Route erstellen
   */
  createBandHeaderControls(params, showTitles, sortBy, showRegression, showThresholds, headerControls) {
    // Albentitel Toggle
    const titleToggle = createToggle('Albentitel', showTitles, () => {
      const selected = this.parseSelectedBands(params.b);
      const newShowTitles = !showTitles;
      this.saveSetting('showTitles', newShowTitles);
      const q = this.buildBandQuery(selected, newShowTitles, sortBy, showRegression, showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(titleToggle);
    
    // Sortierung Toggle
    const sortToggle = createToggle('Nach Anzahl', sortBy === 'count', () => {
      const selected = this.parseSelectedBands(params.b);
      const newSortBy = sortBy === 'count' ? 'alphabetical' : 'count';
      this.saveSetting('sortBy', newSortBy);
      const q = this.buildBandQuery(selected, showTitles, newSortBy, showRegression, showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(sortToggle);
    
    // Regression Toggle
    const regressionToggle = createToggle('Regression', showRegression, () => {
      const selected = this.parseSelectedBands(params.b);
      const newShowRegression = !showRegression;
      this.saveSetting('showRegression', newShowRegression);
      const q = this.buildBandQuery(selected, showTitles, sortBy, newShowRegression, showThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(regressionToggle);
    
    // Schwellen Toggle
    const thresholdsToggle = createToggle('Schwellen', showThresholds, () => {
      const selected = this.parseSelectedBands(params.b);
      const newShowThresholds = !showThresholds;
      this.saveSetting('showThresholds', newShowThresholds);
      const q = this.buildBandQuery(selected, showTitles, sortBy, showRegression, newShowThresholds);
      updateHash('band', q);
    });
    headerControls.appendChild(thresholdsToggle);
  }
  
  /**
   * Setting aus localStorage laden
   */
  loadSetting(key, defaultValue) {
    try {
      const stored = localStorage.getItem(`bandSetting_${key}`);
      if (stored === null) return defaultValue;
      
      // Parse je nach Typ
      if (typeof defaultValue === 'boolean') {
        return stored === 'true';
      } else if (typeof defaultValue === 'string') {
        return stored;
      } else if (typeof defaultValue === 'number') {
        return Number(stored);
      }
      return defaultValue;
    } catch (e) {
      console.warn(`Failed to load setting ${key}:`, e);
      return defaultValue;
    }
  }
  
  /**
   * Setting in localStorage speichern
   */
  saveSetting(key, value) {
    try {
      localStorage.setItem(`bandSetting_${key}`, String(value));
    } catch (e) {
      console.warn(`Failed to save setting ${key}:`, e);
    }
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
    // Speichere ausgewählte Bands in sessionStorage (oder entferne wenn leer)
    try {
      if (selected && selected.length > 0) {
        sessionStorage.setItem('selectedBands', JSON.stringify(selected));
      } else {
        sessionStorage.removeItem('selectedBands');
      }
    } catch (e) {
      console.warn('Failed to save bands to sessionStorage:', e);
    }
    
    const q = this.buildBandQuery(selected, showTitles, sortBy, showRegression, showThresholds);
    updateHash('band', q);
  }
  
  /**
   * Jahre-Route (nur Mobile)
   */
  async handleJahre() {
    // Nur auf Mobile anzeigen
    if (!isMobile()) {
      // Auf Desktop zu Band umleiten
      updateHash('band', {});
      return;
    }
    
    this.controlsEl.innerHTML = '';
    this.chartEl.innerHTML = '';
    this.resetBandLayout();
    
    const scatterContainer = document.getElementById('scatter-container');
    if (scatterContainer) {
      scatterContainer.remove();
    }
    
    destroyScatterInfoBox();
    
    const mainEl = document.querySelector('main');
    if (!mainEl.contains(this.chartEl)) {
      mainEl.appendChild(this.chartEl);
    }
    
    await renderYearsView(this.data, this.chartEl);
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
