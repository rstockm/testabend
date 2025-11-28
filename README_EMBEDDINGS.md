# Embeddings-Generierung

## Übersicht

Die Album-Embeddings werden **einmalig vorab generiert** und als JSON-Datei gespeichert. Diese Datei wird dann vom Browser geladen.

## Schritt 1: Embeddings generieren

### Voraussetzungen
- Node.js installiert
- OpenRouter API Key

### Ausführung

```bash
# Mit Umgebungsvariable
OPENROUTER_API_KEY=dein-api-key node scripts/generate_embeddings.js

# Oder mit Parameter
node scripts/generate_embeddings.js --api-key dein-api-key

# Optional: Anderes Ausgabeverzeichnis
node scripts/generate_embeddings.js --api-key dein-api-key --output public/data/embeddings.json
```

### Was passiert?
1. Lädt `public/data/alben.json` (3.634 Alben)
2. Generiert Embeddings in Batches von 100
3. Speichert als `public/data/embeddings.json` (~5-10 MB)
4. Dauer: ~2-3 Minuten
5. Kosten: ~$0.02 (text-embedding-3-small)

### Ausgabe
```
🚀 Starte Embedding-Generierung für 3634 Alben...
📊 Modell: text-embedding-3-small
📦 Batch-Größe: 100

📝 Batch 1/37 (Alben 1-100)...
✅ Batch 1 abgeschlossen (100/3634 Embeddings)

...

💾 Speichere Embeddings nach public/data/embeddings.json...
✅ Embeddings gespeichert! (8.45 MB)

🎉 Embedding-Generierung erfolgreich abgeschlossen!
```

## Schritt 2: Embeddings verwenden

Die Embeddings werden automatisch beim Laden der Chat-Seite geladen:

1. Browser lädt `data/embeddings.json`
2. Vector Store wird initialisiert
3. RAG-Service ist bereit für semantische Suche

## Troubleshooting

### Fehler: "Embeddings-Datei nicht gefunden"
- Stelle sicher, dass `public/data/embeddings.json` existiert
- Führe das Generierungs-Script aus

### Fehler: "API Key fehlt"
- Setze `OPENROUTER_API_KEY` Umgebungsvariable
- Oder nutze `--api-key` Parameter

### Embeddings zu alt?
- Lösche `public/data/embeddings.json`
- Führe das Script erneut aus

## Dateigröße

- **Eingabe**: `alben.json` (~0.34 MB)
- **Ausgabe**: `embeddings.json` (~5-10 MB)
- **Grund**: Jedes Album hat einen 1536-dimensionalen Vektor

## Performance

- **Ladezeit**: ~1-2 Sekunden (abhängig von Netzwerk)
- **Speicher**: ~10 MB RAM im Browser
- **Suche**: <10ms (lokal im Browser)
