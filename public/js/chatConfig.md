# OpenRouter Modell-Empfehlung

## Empfohlenes Modell: **Claude 3.5 Sonnet**

**Modell-ID:** `anthropic/claude-3.5-sonnet`

### Warum dieses Modell?

1. **Intellektuell anspruchsvolle Unterhaltung**
   - Exzellente Fähigkeiten für komplexe Gespräche
   - Gutes Verständnis für Nuancen und Kontext
   - Kann tiefgehende Diskussionen führen

2. **Popkultur-Verständnis**
   - Sehr gutes Wissen über Musik, Filme, Literatur
   - Versteht zeitgenössische Referenzen
   - Kann kulturelle Kontexte einordnen

3. **Meta-Prompt-Orientierung**
   - Hält sich sehr gut an System-Prompts
   - Folgt Anweisungen präzise
   - Gute Konsistenz im Verhalten

4. **Preis-Leistungs-Verhältnis**
   - Etwa $3/Million Input-Tokens
   - Etwa $15/Million Output-Tokens
   - Für anspruchsvolle Anwendungen sehr guter Wert

### Alternative Modelle

#### **Mixtral 8x22B** (Gute Balance)
- **ID:** `mistralai/mixtral-8x22b-instruct`
- **Vorteile:** Günstiger als Claude, sehr gute Qualität
- **Nachteile:** Etwas weniger konsistent bei komplexen Themen
- **Preis:** ~$0.5-1/M tokens

#### **Llama 3.1 70B** (Budget-Option)
- **ID:** `meta-llama/llama-3.1-70b-instruct`
- **Vorteile:** Sehr günstig oder kostenlos
- **Nachteile:** Qualität etwas niedriger als Claude/Mixtral
- **Preis:** ~$0.1-0.5/M tokens oder kostenlos

### Konfiguration

Die Standard-Konfiguration verwendet Claude 3.5 Sonnet. Du kannst das Modell in `chatConfig.js` ändern oder zur Laufzeit wechseln.

### API-Key Setup

1. Erstelle einen Account auf https://openrouter.ai
2. Generiere einen API-Key
3. Setze den Key in der Chat-Komponente (siehe `router.js`)
