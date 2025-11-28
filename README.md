# Testabend

Dashboard für Album-Bewertungen mit interaktiven Charts und RAG-Chatbot.

## Features

- 📊 Interaktive Charts (Vega-Lite)
- 🎵 Album-Bewertungen visualisieren
- 🤖 RAG-Chatbot mit OpenRouter API
- 📱 Mobile-optimiert
- 🔍 Semantische Suche über Album-Embeddings

## Setup

### Lokale Entwicklung

```bash
# Python HTTP-Server starten
cd public
python3 -m http.server 8000
```

### Deployment auf Cloudron LAMP

Siehe [DEPLOY_CLOUDRON.md](DEPLOY_CLOUDRON.md) für Details.

**Kurzfassung:**
1. LAMP-App in Cloudron installieren
2. Repo klonen: `cd /app/data/public && git clone https://github.com/rstockm/testabend.git .`
3. `.htaccess` erstellen: `cp .htaccess.example .htaccess` und API-Key eintragen
4. Fertig!

## Tech Stack

- Vanilla JavaScript (ES6 Modules)
- Vega-Lite für Charts
- PHP Proxy für OpenRouter API
- Apache/LAMP für Hosting

## Struktur

```
public/
├── index.html          # Haupt-HTML
├── js/                 # JavaScript-Module
├── data/               # JSON-Daten (Alben, Embeddings)
├── images/covers/      # Album-Cover (nicht im Repo)
├── prompts/            # System-Prompts für Chatbot
└── api-proxy.php       # PHP-Proxy für OpenRouter API
```

## License

ISC
