/**
 * UI-Control-Builder
 */
import { getBandPalette } from './config.js';

/**
 * Schwellen-Legende erstellen
 */
export function buildThresholdsLegend() {
  const legend = document.createElement('div');
  legend.className = 'thresholds-legend';
  
  const thresholds = [
    { value: 2.5, label: 'Schrottgrenze', color: '#cc4444' },
    { value: 2.75, label: 'Deepwater Horizon', color: '#ccaa44' },
    { value: 3.0, label: 'Kraftklub', color: '#44cc66' }
  ];
  
  thresholds.forEach(threshold => {
    const item = document.createElement('div');
    item.className = 'threshold-legend-item';
    
    const line = document.createElement('div');
    line.className = 'threshold-legend-line';
    line.style.backgroundColor = threshold.color;
    
    const label = document.createElement('span');
    label.className = 'threshold-legend-label';
    label.textContent = threshold.label;
    
    item.appendChild(line);
    item.appendChild(label);
    legend.appendChild(item);
  });
  
  return legend;
}

/**
 * Tag-Bar für ausgewählte Bands erstellen
 */
export function buildTagBar(selectedBands, onRemove) {
  const bar = document.createElement('div');
  bar.className = 'tags';
  const palette = getBandPalette();
  
  for (const b of selectedBands) {
    const t = document.createElement('span');
    t.className = 'tag';
    
    const dot = document.createElement('span');
    const idx = selectedBands.indexOf(b);
    const color = palette[idx % palette.length];
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.background = color;
    dot.style.display = 'inline-block';
    
    const txt = document.createElement('span');
    txt.textContent = b;
    
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Entfernen');
    btn.textContent = '×';
    btn.addEventListener('click', () => onRemove(b));
    
    t.appendChild(dot);
    t.appendChild(txt);
    t.appendChild(btn);
    bar.appendChild(t);
  }
  
  return bar;
}

/**
 * Mobile Band Toolbar erstellen (Tags + Actions)
 */
export function buildMobileBandToolbar(selectedBands, onRemove, onAddClick, onSettingsClick) {
  const toolbar = document.createElement('div');
  toolbar.className = 'mobile-band-toolbar';
  
  // Tags Scroll-Container
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'mobile-tags-scroll-container';
  
  const palette = getBandPalette();
  
  if (selectedBands.length > 0) {
    selectedBands.forEach(b => {
      const t = document.createElement('span');
      t.className = 'tag';
      
      const dot = document.createElement('span');
      const idx = selectedBands.indexOf(b);
      const color = palette[idx % palette.length];
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.background = color;
      dot.style.display = 'inline-block';
      
      const txt = document.createElement('span');
      txt.textContent = b;
      
      const btn = document.createElement('button');
      btn.textContent = '×';
      btn.addEventListener('click', () => onRemove(b));
      
      t.appendChild(dot);
      t.appendChild(txt);
      t.appendChild(btn);
      tagsContainer.appendChild(t);
    });
  }
  
  // Actions Row
  const actionsRow = document.createElement('div');
  actionsRow.className = 'mobile-controls-row';
  
  const addButton = document.createElement('button');
  addButton.className = 'mobile-action-button';
  addButton.innerHTML = '<span>+</span> Bands';
  addButton.addEventListener('click', onAddClick);
  
  const settingsButton = document.createElement('button');
  settingsButton.className = 'mobile-action-button';
  settingsButton.innerHTML = '<span>⚙</span> Optionen';
  settingsButton.addEventListener('click', onSettingsClick);
  
  actionsRow.appendChild(addButton);
  actionsRow.appendChild(settingsButton);
  
  toolbar.appendChild(tagsContainer);
  toolbar.appendChild(actionsRow);
  
  return toolbar;
}

/**
 * Mobile Band Modal erstellen
 */
export function buildMobileBandModal(allBands, selectedBands, onSelectChange, onClose, data, sortBy = 'alphabetical') {
  const modal = document.createElement('div');
  modal.className = 'mobile-band-modal';
  
  // Lokale Kopie der Auswahl - wird erst beim "Fertig"-Button übernommen
  const localSelectedBands = [...selectedBands];
  
  const header = document.createElement('div');
  header.className = 'mobile-modal-header';
  
  const title = document.createElement('h3');
  title.className = 'mobile-modal-title';
  title.textContent = 'Bands auswählen';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-modal-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.addEventListener('click', onClose);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  const content = document.createElement('div');
  content.className = 'mobile-modal-content';
  
  // Verwende bestehende Logik für Band-Liste, aber ohne Wrapper
  // Da buildBandPanel einen Wrapper zurückgibt, extrahieren wir den Inhalt oder bauen ihn neu
  // Besser: Neu bauen für Flexibilität
  
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search mobile-search-wrapper';
  searchWrap.style.marginBottom = '16px';
  searchWrap.style.position = 'relative';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Band suchen...';
  input.className = 'mobile-search-input';
  
  // X-Button zum Löschen
  const clearBtn = document.createElement('button');
  clearBtn.className = 'mobile-search-clear';
  clearBtn.innerHTML = '×';
  clearBtn.setAttribute('aria-label', 'Suche löschen');
  clearBtn.style.display = 'none';
  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    renderList('');
    updateClearButton();
  });
  
  // Clear-Button Sichtbarkeit aktualisieren
  function updateClearButton() {
    clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
  }
  
  input.addEventListener('input', () => {
    renderList(input.value);
    updateClearButton();
  });
  
  searchWrap.appendChild(input);
  searchWrap.appendChild(clearBtn);
  
  const list = document.createElement('ul');
  list.className = 'band-list';
  
  content.appendChild(searchWrap);
  content.appendChild(list);
  
  // Footer hinzufügen
  const footer = document.createElement('div');
  footer.className = 'mobile-modal-footer';
  
  const doneBtn = document.createElement('button');
  doneBtn.className = 'mobile-modal-done-btn';
  doneBtn.textContent = 'Fertig';
  doneBtn.addEventListener('click', () => {
    // Erst beim "Fertig"-Button die Auswahl übernehmen und Hash ändern
    onSelectChange([...localSelectedBands]);
    onClose();
  });
  
  footer.appendChild(doneBtn);
  
  // Album-Anzahl pro Band berechnen
  const albumCounts = new Map();
  if (data) {
    data.forEach(d => {
      if (d.Band) {
        albumCounts.set(d.Band, (albumCounts.get(d.Band) || 0) + 1);
      }
    });
  }
  
  const maxCount = albumCounts.size > 0 ? Math.max(...Array.from(albumCounts.values())) : 1;
  
  function renderList(filterText) {
    list.innerHTML = '';
    const norm = (filterText || '').toLowerCase();
    let filteredBands = allBands.filter(b => !norm || b.toLowerCase().includes(norm));
    
    // Sortiere Bands
    if (sortBy === 'count') {
      filteredBands = filteredBands.sort((a, b) => {
        const countA = albumCounts.get(a) || 0;
        const countB = albumCounts.get(b) || 0;
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
      });
    } else {
      filteredBands = filteredBands.sort((a, b) => a.localeCompare(b));
    }
    
    const items = filteredBands.map(b => {
      const li = document.createElement('li');
      li.className = 'band-item' + (localSelectedBands.includes(b) ? ' selected' : '');
      li.style.padding = '12px 8px'; // Größere Touch-Targets
      li.style.cursor = 'pointer'; // Zeige dass es klickbar ist
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'band-name';
      nameSpan.textContent = b;
      
      const count = albumCounts.get(b) || 0;
      const visualWrapper = document.createElement('div');
      visualWrapper.className = 'band-visual';
      
      const bar = document.createElement('div');
      bar.className = 'band-count-bar';
      const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
      bar.style.width = width + '%';
      
      visualWrapper.appendChild(bar);
      li.appendChild(nameSpan);
      li.appendChild(visualWrapper);
      li.dataset.band = b;
      
      return li;
    });
    
    for (const li of items) list.appendChild(li);
  }
  
  renderList('');
  
  // Event-Listener für Mehrfachauswahl von Bands
  list.addEventListener('click', (e) => {
    // Verhindere Event-Propagation
    e.stopPropagation();
    e.preventDefault();
    
    const li = e.target.closest('.band-item');
    if (!li) return;
    
    const b = li.dataset.band;
    if (!b) return;
    
    // Toggle: Wenn bereits ausgewählt, entfernen; sonst hinzufügen
    const idx = localSelectedBands.indexOf(b);
    if (idx >= 0) {
      localSelectedBands.splice(idx, 1);
    } else {
      localSelectedBands.push(b);
    }
    
    // Liste neu rendern um selected-State zu aktualisieren (OHNE Hash-Änderung)
    renderList(input.value);
  });
  
  modal.appendChild(header);
  modal.appendChild(content);
  modal.appendChild(footer);
  
  return modal;
}

/**
 * Mobile Settings Modal erstellen
 */
export function buildMobileSettingsModal({ showTitles, sortBy, showRegression, showThresholds, onApply, onClose }) {
  const modal = document.createElement('div');
  modal.className = 'mobile-band-modal mobile-settings-modal';
  
  const state = {
    showTitles,
    sortBy,
    showRegression,
    showThresholds
  };
  
  const header = document.createElement('div');
  header.className = 'mobile-modal-header';
  
  const title = document.createElement('h3');
  title.className = 'mobile-modal-title';
  title.textContent = 'Optionen';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-modal-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  const content = document.createElement('div');
  content.className = 'mobile-modal-content';
  
  const list = document.createElement('div');
  list.className = 'mobile-settings-list';
  
  const addToggle = (label, checked, handler) => {
    const toggle = createToggle(label, checked, (event) => {
      handler(Boolean(event?.target?.checked));
    });
    toggle.classList.add('mobile-settings-toggle');
    list.appendChild(toggle);
  };
  
  addToggle('Albentitel', state.showTitles, (value) => {
    state.showTitles = value;
  });
  
  addToggle('Nach Anzahl', state.sortBy === 'count', (value) => {
    state.sortBy = value ? 'count' : 'alphabetical';
  });
  
  addToggle('Regression', state.showRegression, (value) => {
    state.showRegression = value;
  });
  
  addToggle('Schwellen', state.showThresholds, (value) => {
    state.showThresholds = value;
  });
  
  content.appendChild(list);
  
  const footer = document.createElement('div');
  footer.className = 'mobile-modal-footer';
  
  const applyBtn = document.createElement('button');
  applyBtn.className = 'mobile-modal-done-btn';
  applyBtn.textContent = 'Übernehmen';
  
  footer.appendChild(applyBtn);
  
  const closeModal = () => {
    modal.classList.remove('active');
    if (typeof onClose === 'function') {
      onClose();
    }
  };
  
  const openModal = () => {
    modal.classList.add('active');
  };
  
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  
  applyBtn.addEventListener('click', () => {
    if (typeof onApply === 'function') {
      onApply({ ...state });
    }
    closeModal();
  });
  
  modal.appendChild(header);
  modal.appendChild(content);
  modal.appendChild(footer);
  
  return {
    modal,
    open: openModal,
    close: closeModal
  };
}

/**
 * Band-Panel erstellen
 */
export function buildBandPanel(allBands, selectedBands, onSelectChange, data, sortBy = 'alphabetical') {
  const panel = document.createElement('div');
  panel.className = 'band-panel';
  
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Band suchen...';
  searchWrap.appendChild(input);
  
  const list = document.createElement('ul');
  list.className = 'band-list';
  panel.appendChild(searchWrap);
  panel.appendChild(list);
  
  // Album-Anzahl pro Band berechnen
  const albumCounts = new Map();
  if (data) {
    data.forEach(d => {
      if (d.Band) {
        albumCounts.set(d.Band, (albumCounts.get(d.Band) || 0) + 1);
      }
    });
  }
  
  const maxCount = albumCounts.size > 0 
    ? Math.max(...Array.from(albumCounts.values())) 
    : 1;
  
  function renderList(filterText) {
    // Scroll-Position speichern
    const scrollTop = list.scrollTop;
    
    list.innerHTML = '';
    const norm = (filterText || '').toLowerCase();
    let filteredBands = allBands.filter(b => !norm || b.toLowerCase().includes(norm));
    
    // Sortiere Bands
    if (sortBy === 'count') {
      filteredBands = filteredBands.sort((a, b) => {
        const countA = albumCounts.get(a) || 0;
        const countB = albumCounts.get(b) || 0;
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
      });
    } else {
      filteredBands = filteredBands.sort((a, b) => a.localeCompare(b));
    }
    
    const items = filteredBands.map(b => {
      const li = document.createElement('li');
      li.className = 'band-item' + (selectedBands.includes(b) ? ' selected' : '');
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'band-name';
      nameSpan.textContent = b;
      
      const count = albumCounts.get(b) || 0;
      const visualWrapper = document.createElement('div');
      visualWrapper.className = 'band-visual';
      
      const bar = document.createElement('div');
      bar.className = 'band-count-bar';
      const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
      bar.style.width = width + '%';
      
      visualWrapper.appendChild(bar);
      li.appendChild(nameSpan);
      li.appendChild(visualWrapper);
      li.dataset.band = b;
      
      return li;
    });
    
    for (const li of items) list.appendChild(li);
    
    // Scroll-Position wiederherstellen
    list.scrollTop = scrollTop;
  }
  
  renderList('');
  input.addEventListener('input', () => renderList(input.value));
  
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.band-item');
    if (!li) return;
    
    const b = li.dataset.band;
    const idx = selectedBands.indexOf(b);
    if (idx >= 0) {
      selectedBands.splice(idx, 1);
    } else {
      selectedBands.push(b);
    }
    onSelectChange([...selectedBands]);
    renderList(input.value);
  });
  
  return panel;
}

/**
 * Toggle-Switch erstellen
 */
export function createToggle(label, checked, onChange) {
  const container = document.createElement('div');
  container.className = 'title-toggle-container';
  
  const labelEl = document.createElement('span');
  labelEl.className = 'title-toggle-label';
  labelEl.textContent = label;
  
  const toggleWrapper = document.createElement('label');
  toggleWrapper.className = 'toggle-switch';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.addEventListener('change', onChange);
  
  const slider = document.createElement('span');
  slider.className = 'toggle-slider';
  
  toggleWrapper.appendChild(checkbox);
  toggleWrapper.appendChild(slider);
  
  labelEl.addEventListener('click', () => {
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
  });
  
  container.appendChild(labelEl);
  container.appendChild(toggleWrapper);
  
  return container;
}

/**
 * Scatter-Zoom-Controls erstellen
 */
export function buildScatterZoomControls(data, onZoomChange) {
  const filtered = data.filter(d => 
    d.Jahr != null && d.Note != null && !isNaN(d.Jahr) && !isNaN(d.Note)
  );
  
  if (filtered.length === 0) return null;
  
  const notes = filtered.map(d => Number(d.Note)).filter(v => !isNaN(v));
  const fullMinNote = notes.length ? Math.min(...notes) : 0;
  const fullMaxNote = notes.length ? Math.max(...notes) : 5;
  
  const container = document.createElement('div');
  container.className = 'scatter-zoom-controls';
  container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 8px 4px; background: transparent; align-items: center; width: 38px; justify-content: center; height: 100%; flex-shrink: 0; margin-left: auto;';
  
  const sliderWrapper = document.createElement('div');
  sliderWrapper.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 400px; width: 30px; position: relative; margin: 0 auto;';
  
  const yMinSlider = document.createElement('input');
  yMinSlider.type = 'range';
  yMinSlider.min = Math.floor(fullMinNote * 100);
  yMinSlider.max = Math.ceil(fullMaxNote * 100);
  yMinSlider.value = Math.floor(fullMinNote * 100);
  yMinSlider.step = 1;
  yMinSlider.className = 'vertical-slider';
  yMinSlider.style.cssText = 'position: absolute; transform: rotate(-90deg); width: 400px; height: 6px; margin: 0; left: -197px; top: 197px;';
  
  const getYValues = () => {
    const sliderValue = Number(yMinSlider.value) / 100;
    return { min: sliderValue, max: fullMaxNote };
  };
  
  const updateY = () => {
    const { min, max } = getYValues();
    onZoomChange({ y: { min, max } });
  };
  
  yMinSlider.addEventListener('input', updateY);
  
  sliderWrapper.appendChild(yMinSlider);
  container.appendChild(sliderWrapper);
  
  return container;
}
