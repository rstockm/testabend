# Technische Ansätze für vollständigen Datenzugriff im LLM-Chat

## Problemstellung
- **~25.000+ Alben** in der Datenbank
- LLM benötigt Zugriff auf **alle Daten** (nicht nur Zusammenfassung)
- Noten müssen präzise referenziert werden können
- Kontext-Window-Limitierung bei LLMs (Claude 3.5 Sonnet: 200k Tokens)

## Ansatz 1: Alle Daten im System-Prompt (Direkt)

### Beschreibung
Komplette JSON-Daten als strukturierter Text im System-Prompt einbetten.

### Vorteile
- ✅ Einfachste Implementierung
- ✅ LLM hat sofort Zugriff auf alle Daten
- ✅ Keine zusätzlichen API-Calls nötig
- ✅ Funktioniert mit jedem LLM

### Nachteile
- ❌ Sehr hohe Token-Kosten bei jedem Request (~25k+ Tokens nur für Daten)
- ❌ System-Prompt wird sehr lang
- ❌ Kann Context-Window-Limit erreichen
- ❌ Langsamere Verarbeitung durch LLM

### Token-Schätzung
- ~25.000 Alben × ~50 Tokens/Album = ~1.25M Tokens
- **Zu groß für direkten Ansatz!**

---

## Ansatz 2: Function Calling / Tool Use (Empfohlen)

### Beschreibung
LLM kann gezielt Funktionen aufrufen, um Daten abzufragen:
- `searchAlbums(band, album, year, minNote, maxNote)`
- `getBandStats(band)`
- `getTopAlbums(limit, year)`
- `compareBands(band1, band2)`

### Vorteile
- ✅ Sehr effizient - nur relevante Daten werden geladen
- ✅ Geringe Token-Kosten
- ✅ LLM entscheidet selbst, welche Daten benötigt werden
- ✅ Skalierbar für große Datenmengen
- ✅ Präzise Datenabfragen möglich

### Nachteile
- ⚠️ Erfordert Function Calling Support (Claude 3.5 Sonnet unterstützt das)
- ⚠️ Etwas komplexere Implementierung
- ⚠️ Mehrere API-Roundtrips möglich

### Implementierung
```javascript
// LLM kann diese Funktionen aufrufen:
{
  "name": "searchAlbums",
  "description": "Suche Alben nach Band, Album, Jahr oder Notenbereich",
  "parameters": {
    "band": "string (optional)",
    "album": "string (optional)", 
    "year": "number (optional)",
    "minNote": "number (optional)",
    "maxNote": "number (optional)"
  }
}
```

---

## Ansatz 3: RAG mit Embeddings (Semantische Suche)

### Beschreibung
- Alben werden in Vektoren umgewandelt (Embeddings)
- User-Query wird ebenfalls eingebettet
- Ähnlichste Alben werden gefunden und als Kontext mitgegeben

### Vorteile
- ✅ Findet auch semantisch ähnliche Alben (nicht nur exakte Matches)
- ✅ Effizient bei großen Datenmengen
- ✅ Nur relevante Daten im Kontext

### Nachteile
- ❌ Erfordert Embedding-Modell (z.B. OpenAI Embeddings API)
- ❌ Komplexere Architektur
- ❌ Zusätzliche Kosten für Embeddings
- ❌ Kann exakte Matches verpassen

### Implementierung
- Embeddings für alle Alben vorberechnen
- Bei User-Query: Embedding erstellen → Vektorsuche → Top-K Alben als Kontext

---

## Ansatz 4: Hybrid-Ansatz (Kompakt + On-Demand)

### Beschreibung
- Kompakte Übersicht im System-Prompt (Top-Bands, Statistiken)
- Bei Bedarf: Gezielte Datenabfrage über Function Calling
- Oder: Relevante Alben automatisch suchen und als Kontext hinzufügen

### Vorteile
- ✅ Balance zwischen Übersicht und Detail
- ✅ Geringere Token-Kosten als vollständige Daten
- ✅ Flexibel erweiterbar

### Nachteile
- ⚠️ Kann relevante Daten verpassen
- ⚠️ Suchlogik muss gut implementiert sein

---

## Ansatz 5: Externe Datenbank (IndexedDB)

### Beschreibung
- Daten in Browser-IndexedDB speichern
- LLM fragt über Function Calling gezielt ab
- Lokale Suche ohne Server

### Vorteile
- ✅ Sehr schnell (lokale Suche)
- ✅ Keine zusätzlichen API-Calls für Daten
- ✅ Daten bleiben im Browser

### Nachteile
- ⚠️ Erfordert IndexedDB-Setup
- ⚠️ Function Calling notwendig
- ⚠️ Komplexere Architektur

---

## Empfehlung: **Ansatz 2 (Function Calling)**

### Warum?
1. **Effizienz**: Nur relevante Daten werden geladen
2. **Kosten**: Minimale Token-Kosten
3. **Präzision**: LLM kann gezielt nach spezifischen Daten suchen
4. **Skalierbarkeit**: Funktioniert auch bei sehr großen Datenmengen
5. **Claude 3.5 Sonnet unterstützt Function Calling nativ**

### Implementierungs-Plan

1. **Function Definitions** definieren:
   ```javascript
   const functions = [
     {
       name: "searchAlbums",
       description: "Suche Alben nach verschiedenen Kriterien",
       parameters: {
         type: "object",
         properties: {
           band: { type: "string", description: "Band-Name (teilweise oder vollständig)" },
           album: { type: "string", description: "Album-Name (teilweise oder vollständig)" },
           year: { type: "number", description: "Erscheinungsjahr" },
           minNote: { type: "number", description: "Mindestnote" },
           maxNote: { type: "number", description: "Maximalnote" },
           limit: { type: "number", description: "Maximale Anzahl Ergebnisse", default: 50 }
         }
       }
     },
     {
       name: "getBandStats",
       description: "Hole Statistiken für eine bestimmte Band",
       parameters: {
         type: "object",
         properties: {
           band: { type: "string", required: true }
         }
       }
     },
     {
       name: "getTopAlbums",
       description: "Hole die besten Alben nach Note",
       parameters: {
         type: "object",
         properties: {
           limit: { type: "number", default: 20 },
           year: { type: "number", description: "Optional: Filter nach Jahr" }
         }
       }
     }
   ];
   ```

2. **Function Implementations**:
   ```javascript
   async function executeFunction(name, args) {
     switch(name) {
       case "searchAlbums":
         return searchAlbumsInData(data, args);
       case "getBandStats":
         return getBandStatistics(data, args.band);
       case "getTopAlbums":
         return getTopAlbumsByNote(data, args.limit, args.year);
     }
   }
   ```

3. **API-Request mit Function Calling**:
   ```javascript
   const response = await fetch(OPENROUTER_API, {
     method: 'POST',
     body: JSON.stringify({
       model: 'anthropic/claude-3.5-sonnet',
       messages: [...],
       tools: functions, // Function definitions
       tool_choice: "auto" // LLM entscheidet selbst
     })
   });
   ```

4. **Function Response Handling**:
   ```javascript
   const response = await apiResponse.json();
   if (response.choices[0].message.tool_calls) {
     // LLM möchte Funktionen aufrufen
     for (const toolCall of response.choices[0].message.tool_calls) {
       const result = await executeFunction(toolCall.function.name, JSON.parse(toolCall.function.arguments));
       // Result zurück an LLM senden
     }
   }
   ```

---

## Alternative: Vereinfachter Ansatz ohne Function Calling

Falls Function Calling zu komplex ist, kann man auch:

1. **Alle Daten komprimiert im System-Prompt** (strukturiert, nicht als JSON)
2. **Intelligente Suche vor dem API-Call**: Relevante Alben finden und als Kontext hinzufügen
3. **Chunking**: Daten in logische Gruppen aufteilen (z.B. nach Jahr oder Band)

### Beispiel für komprimierte Daten:
```
TAYLOR SWIFT: 
- "1989" (2014): 3.85
- "Reputation" (2017): 3.72
- "Lover" (2019): 3.68
...
```

Statt:
```json
{"Band": "Taylor Swift", "Album": "1989", "Jahr": 2014, "Note": 3.85}
```

---

## Entscheidung

**Empfehlung: Function Calling (Ansatz 2)**
- Beste Balance zwischen Funktionalität und Komplexität
- Effizient und kostengünstig
- LLM kann gezielt Daten abfragen
- Unterstützt durch Claude 3.5 Sonnet

**Fallback: Hybrid-Ansatz (Ansatz 4)**
- Wenn Function Calling nicht funktioniert
- Kompakte Übersicht + intelligente Suche
- Einfacher zu implementieren
