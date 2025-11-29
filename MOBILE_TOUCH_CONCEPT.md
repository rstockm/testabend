# Mobile Touch-Interaktionen Konzept

## Problemstellung

**Aktueller Zustand:**
- Hover-Effekte funktionieren auf Mobile nicht zuverlässig
- Vega-Lite Tooltips basieren auf `mousemove` Events
- Tooltips verschwinden automatisch oder erscheinen gar nicht
- Keine Möglichkeit, Album-Informationen stabil zu betrachten
- Chart-Punkte sind auf Mobile nicht anklickbar/touchbar

**Anforderungen:**
- Stabile, explizite Interaktionen (keine flüchtigen Hover-Effekte)
- Album-Informationen als modale Karten, mittig positioniert
- Explizites Schließen per X-Button
- Nichts soll verrutschen oder unerwartet verschwinden
- Touch-freundliche Größen (min. 44x44px Touch-Targets)

## Lösungskonzept

### 1. Touch-Event-Handler statt Mouse-Events

**Für Chart-Punkte (Band-Series & Scatter):**
- `touchstart` Event auf Chart-Canvas/SVG abfangen
- Vega-Lite `click` Events nutzen (funktionieren auch auf Touch)
- Verhindere Standard-Tooltip-Verhalten auf Mobile
- Zeige stattdessen modale Album-Karte

**Implementierung:**
```javascript
// In renderers.js oder neuer mobileTouchHandler.js
function setupMobileTouchHandlers(chartView, chartEl) {
  if (!isMobile()) return; // Nur auf Mobile
  
  // Verhindere Standard-Vega-Tooltips auf Mobile
  chartView.addEventListener('click', (event, item) => {
    if (item && item.datum) {
      event.preventDefault();
      event.stopPropagation();
      showMobileAlbumCard(item.datum);
    }
  });
  
  // Verhindere Tooltip-Anzeige bei Touch
  const tooltips = chartEl.querySelectorAll('.vg-tooltip, .vega-tooltip');
  tooltips.forEach(t => t.style.display = 'none');
}
```

### 2. Modale Album-Karte (Mobile)

**Design:**
- Vollbild-Overlay mit halbtransparentem Hintergrund
- Karte mittig positioniert (max. 90% Breite, max. 80% Höhe)
- Scrollbarer Inhalt falls nötig
- X-Button oben rechts zum Schließen
- Touch-freundliche Größen

**Struktur:**
```html
<div class="mobile-album-card-overlay">
  <div class="mobile-album-card">
    <button class="mobile-album-card-close">×</button>
    <div class="mobile-album-card-content">
      <!-- Cover-Bild (falls vorhanden) -->
      <img class="mobile-album-card-cover" src="...">
      <!-- Album-Informationen -->
      <div class="mobile-album-card-info">
        <h3>Band - Album</h3>
        <table>
          <tr><td>Jahr:</td><td>2020</td></tr>
          <tr><td>Note:</td><td>3.5</td></tr>
          <tr><td>Platz:</td><td>42</td></tr>
        </table>
      </div>
    </div>
  </div>
</div>
```

**CSS:**
```css
.mobile-album-card-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.mobile-album-card-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.mobile-album-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  max-width: 90%;
  max-height: 80vh;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  transform: scale(0.9);
  transition: transform 0.3s ease;
}

.mobile-album-card-overlay.active .mobile-album-card {
  transform: scale(1);
}

.mobile-album-card-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-primary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-album-card-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.mobile-album-card-cover {
  width: 100%;
  max-width: 300px;
  margin: 0 auto 20px;
  border-radius: 8px;
  display: block;
}

.mobile-album-card-info h3 {
  margin: 0 0 16px 0;
  font-size: 20px;
  text-align: center;
}

.mobile-album-card-info table {
  width: 100%;
  border-collapse: collapse;
}

.mobile-album-card-info td {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.mobile-album-card-info td:first-child {
  font-weight: 600;
  color: var(--text-secondary);
  width: 30%;
}
```

### 3. JavaScript-Implementierung

**Neue Datei: `mobileAlbumCard.js`**
```javascript
import { isMobile } from './utils.js';
import { extractTooltipData } from './coverTooltip.js'; // Wiederverwendung

let currentCard = null;

export function showMobileAlbumCard(datum) {
  if (!isMobile()) return; // Nur auf Mobile
  
  // Entferne bestehende Karte falls vorhanden
  if (currentCard) {
    closeMobileAlbumCard();
  }
  
  // Erstelle Overlay
  const overlay = document.createElement('div');
  overlay.className = 'mobile-album-card-overlay';
  
  // Erstelle Karte
  const card = document.createElement('div');
  card.className = 'mobile-album-card';
  
  // Close-Button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-album-card-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.addEventListener('click', closeMobileAlbumCard);
  
  // Content
  const content = document.createElement('div');
  content.className = 'mobile-album-card-content';
  
  // Cover-Bild (falls vorhanden)
  // TODO: Lade Cover asynchron
  
  // Info-Tabelle
  const info = document.createElement('div');
  info.className = 'mobile-album-card-info';
  
  const title = document.createElement('h3');
  title.textContent = `${datum.Band} - ${datum.Album}`;
  info.appendChild(title);
  
  const table = document.createElement('table');
  const rows = [
    { key: 'Jahr', value: datum.Jahr },
    { key: 'Note', value: datum.Note },
    { key: 'Platz', value: datum.Platz || '-' }
  ];
  
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const tdKey = document.createElement('td');
    tdKey.textContent = row.key + ':';
    const tdValue = document.createElement('td');
    tdValue.textContent = row.value;
    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  });
  
  info.appendChild(table);
  content.appendChild(info);
  
  card.appendChild(closeBtn);
  card.appendChild(content);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  currentCard = overlay;
  
  // Aktiviere Overlay (für Animation)
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  
  // Schließen bei Klick außerhalb
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMobileAlbumCard();
    }
  });
}

export function closeMobileAlbumCard() {
  if (currentCard) {
    currentCard.classList.remove('active');
    setTimeout(() => {
      currentCard.remove();
      currentCard = null;
    }, 300); // Warte auf Animation
  }
}

// ESC-Taste zum Schließen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentCard) {
    closeMobileAlbumCard();
  }
});
```

### 4. Integration in bestehende Renderer

**In `renderers.js`:**
```javascript
import { setupMobileTouchHandlers } from './mobileTouchHandler.js';

export async function renderBandsSeries(...) {
  // ... bestehender Code ...
  
  const view = await vegaEmbed(chartEl, spec, options);
  
  // Mobile Touch-Handler einrichten
  if (isMobile()) {
    setupMobileTouchHandlers(view, chartEl);
  }
  
  return view;
}
```

**Neue Datei: `mobileTouchHandler.js`:**
```javascript
import { isMobile } from './utils.js';
import { showMobileAlbumCard } from './mobileAlbumCard.js';

export function setupMobileTouchHandlers(chartView, chartEl) {
  if (!isMobile()) return;
  
  // Verhindere Standard-Tooltips auf Mobile
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 767px) {
      .vg-tooltip, .vega-tooltip {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Nutze Click-Events (funktionieren auch auf Touch)
  chartView.addEventListener('click', (event, item) => {
    if (item && item.datum) {
      event.preventDefault();
      event.stopPropagation();
      showMobileAlbumCard(item.datum);
    }
  });
}
```

### 5. Scatter-Plot Anpassungen

**Für Scatter-Plot:**
- Gleiche modale Karte verwenden
- Info-Box auf Mobile verstecken
- Touch-Events auf Punkte statt Hover

**In `scatterKeyboardNav.js`:**
```javascript
export function setupScatterKeyboardNav(data, view, chartEl) {
  // ... bestehender Code ...
  
  if (isMobile()) {
    // Mobile: Nutze Click-Events statt Hover
    view.addEventListener('click', (event, item) => {
      if (item && item.datum) {
        showMobileAlbumCard(item.datum);
      }
    });
  } else {
    // Desktop: Bestehende Hover-Logik
    trackHoveredPoint();
  }
}
```

## Implementierungsreihenfolge

1. **Phase 1: Basis-Infrastruktur**
   - `mobileAlbumCard.js` erstellen
   - CSS für modale Karte in `mobile.css`
   - Basis-Funktionalität testen

2. **Phase 2: Chart-Integration**
   - `mobileTouchHandler.js` erstellen
   - In `renderBandsSeries` integrieren
   - Tooltip-Verhinderung auf Mobile

3. **Phase 3: Scatter-Plot**
   - Mobile-Handler in `scatterKeyboardNav.js`
   - Info-Box auf Mobile verstecken

4. **Phase 4: Cover-Bilder**
   - Asynchrones Laden in `mobileAlbumCard.js`
   - Wiederverwendung von `coverTooltip.js` Logik

5. **Phase 5: Testing & Feinschliff**
   - Verschiedene Bildschirmgrößen testen
   - Animationen optimieren
   - Touch-Targets prüfen

## Vorteile dieses Ansatzes

✅ **Stabile Interaktionen:** Explizite Touch-Events, keine flüchtigen Hover-Effekte
✅ **Klarer Fokus:** Modale Karte zwingt zur bewussten Aktion
✅ **Kein Verrutschen:** Feste Positionierung, nichts bewegt sich unerwartet
✅ **Touch-optimiert:** Große Buttons, klare Gesten
✅ **Wiederverwendbar:** Gleiche Karte für alle Chart-Typen
✅ **Accessible:** ESC-Taste, ARIA-Labels, Keyboard-Navigation

## Offene Fragen

- Soll die Karte auch auf Tablet (768px-1024px) erscheinen?
- Sollen mehrere Karten gleichzeitig möglich sein?
- Soll es eine "Vorherige/Nächste"-Navigation geben?
