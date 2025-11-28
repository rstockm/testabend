# Album-Cover Downloader

Skript zum automatischen Herunterladen und Optimieren von Album-Covern für alle Alben im Datensatz.

## Installation

1. Installiere die benötigten Python-Pakete:
```bash
pip install -r requirements_covers.txt
```

Oder einzeln:
```bash
pip install requests Pillow
```

## Verwendung

```bash
cd scripts
python3 download_album_covers.py
```

Das Skript:
- Liest alle Alben aus `public/data/alben.json`
- Sucht für jedes Album das Cover über die iTunes API
- Lädt das Cover herunter und optimiert es auf 300×300px
- Speichert es als JPEG in `public/images/covers/`

## Konfiguration

Im Skript können folgende Parameter angepasst werden:

- `TARGET_SIZE = (300, 300)` - Zielgröße für Thumbnails
- `QUALITY = 85` - JPEG-Qualität (0-100)
- `DELAY = 0.1` - Verzögerung zwischen API-Aufrufen (Sekunden)

## Ausgabe

- **Verzeichnis**: `public/images/covers/`
- **Dateinamen**: `Band_Album.jpg` (URL-safe)
- **Format**: JPEG, optimiert
- **Größe**: ~30 KB pro Bild
- **Gesamt**: ~100-150 MB für alle 3634 Alben

## Features

- ✅ Automatisches Überspringen bereits vorhandener Bilder
- ✅ Fortschrittsanzeige
- ✅ Fehlerbehandlung
- ✅ Statistiken am Ende
- ✅ Kein API-Key erforderlich (iTunes API)

## Hinweise

- Das Skript benötigt eine Internetverbindung
- Die iTunes API hat Rate Limits, daher die Verzögerung zwischen Aufrufen
- Bei ~3600 Alben dauert der Download ca. 6-10 Minuten
- Fehlgeschlagene Downloads können später erneut versucht werden (überspringt vorhandene Dateien)

