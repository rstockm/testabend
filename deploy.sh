#!/bin/bash
# Deployment-Script für Cloudron LAMP Server
# Aktualisiert alle Dateien aus dem Git-Repo, behält lokale Dateien (.htaccess, Bilder, embeddings.json)

set -e  # Exit on error

cd /app/data/public || exit 1

echo "🔄 Aktualisiere Testabend..."

# Git Pull
git -c safe.directory=/app/data/public fetch origin
git -c safe.directory=/app/data/public reset --hard origin/main

# Alle Dateien aus public/ ins Root kopieren (außer ausgeschlossene)
echo "📦 Kopiere Dateien aus public/..."

# Erstelle temporäres Verzeichnis für die Dateien aus dem Repo
TMP_DIR=$(mktemp -d)
git -c safe.directory=/app/data/public archive HEAD public/ | tar -x -C "$TMP_DIR"

# Kopiere alle Dateien aus public/ ins Root, aber überschreibe nicht:
# - .htaccess (enthält API-Key)
# - images/ (Urheberrecht)
# - data/embeddings.json (zu groß)

# Kopiere Dateien, die nicht ausgeschlossen sind
rsync -av --exclude='.htaccess' \
      --exclude='images/' \
      --exclude='data/embeddings.json' \
      "$TMP_DIR/public/" ./

# Aufräumen
rm -rf "$TMP_DIR"

echo "✅ Deployment abgeschlossen!"
echo ""
echo "Hinweis: Folgende Dateien wurden NICHT überschrieben (lokal behalten):"
echo "  - .htaccess (API-Key)"
echo "  - images/ (Album-Cover)"
echo "  - data/embeddings.json (zu groß)"

