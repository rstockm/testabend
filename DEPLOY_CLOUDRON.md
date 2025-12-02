# Deployment auf Cloudron

## Empfehlung: LAMP Server für iterative Entwicklung

**Für iterative Entwicklung empfehle ich den LAMP Server Ansatz**, da:
- ✅ Direkter File-Upload per SFTP/SSH möglich
- ✅ Schnelle Iterationen (Datei hochladen → sofort sichtbar)
- ✅ Einfaches Debugging (direkter Zugriff auf Dateien)
- ✅ Git-Deployment möglich (z.B. via Git-Hook)

**Cloudron App** ist besser für:
- ✅ Produktive Umgebungen mit stabilen Releases
- ✅ Automatische Backups und Updates
- ✅ Bessere Cloudron-Integration

## Ansatz 1: LAMP Server (Empfohlen für Entwicklung)

Siehe Abschnitt "LAMP Server Setup" weiter unten.

## Ansatz 2: Cloudron App (Für Produktion)

Siehe Abschnitt "Cloudron App Setup" weiter unten.

---

## Benötigte Dateien

Für das Deployment auf Cloudron benötigst du folgende Dateien/Ordner:

### ✅ Benötigt (aus `public/` Ordner):

```
public/
├── index.html
├── styles.css
├── mobile.css
├── js/
│   ├── albumData.js
│   ├── chat.js
│   ├── chatConfig.js
│   ├── config.js
│   ├── controls.js
│   ├── coverTooltip.js
│   ├── main.js
│   ├── mobileNav.js
│   ├── ragService.js
│   ├── regression.js
│   ├── renderers.js
│   ├── router.js
│   ├── scatterHighlight.js
│   ├── scatterInfoBox.js
│   ├── scatterKeyboardNav.js
│   ├── utils.js
│   ├── vectorSearch.js
│   └── vectorStore.js
├── data/
│   ├── alben.json
│   ├── embeddings.json
│   └── stopwords.txt
├── images/
│   └── covers/
│       └── [alle .jpg Dateien]
└── prompts/
    └── system-prompt.md
```

### ✅ Benötigt (Root):

```
app.json          # Cloudron-Manifest
icon.png          # App-Icon (128x128px oder größer)
```

### ❌ Nicht benötigt:

- `scripts/` - Nur für lokale Entwicklung
- `Ergebnisse.xlsx`, `Ergebnisse_update.xlsx` - Nur Quell-Daten
- `package.json` - Optional (nur wenn Embeddings regeneriert werden sollen)
- Alle `.md` Dokumentationsdateien (außer `system-prompt.md`)

## Deployment-Schritte

### 1. Vorbereitung

1. Erstelle ein Icon (`icon.png`, mindestens 128x128px) und platziere es im Root-Verzeichnis
2. Stelle sicher, dass alle Dateien im `public/` Ordner vorhanden sind
3. Prüfe, dass `app.json` korrekt konfiguriert ist

### 2. Cloudron App erstellen

1. Gehe zu deinem Cloudron-Dashboard
2. Klicke auf "Install App" → "Custom App"
3. Lade die Dateien hoch:
   - `app.json`
   - `icon.png`
   - Den gesamten `public/` Ordner

### 3. Konfiguration

Die App läuft als statische Website mit einem Python HTTP-Server.

**Wichtig:**
- Die App benötigt keine Datenbank
- Die App benötigt keine Umgebungsvariablen (außer du willst die OpenRouter API-Key konfigurieren)
- Die App läuft auf Port 8000 (konfiguriert in `app.json`)

### 4. OpenRouter API-Key konfigurieren (für Chat-Bot)

**Wichtig:** Der API-Key wird serverseitig über `.htaccess` gespeichert (Cloudron-Empfehlung).

1. Kopiere `.htaccess.example` zu `.htaccess`:
   ```bash
   cd /app/data/public
   cp .htaccess.example .htaccess
   ```

2. Bearbeite `.htaccess` und füge deinen OpenRouter API-Key ein:
   ```apache
   SetEnv OPENROUTER_API_KEY "dein-echter-api-key-hier"
   ```

3. Die App nutzt automatisch den PHP-Proxy (`api-proxy.php`), der den Key serverseitig verwendet.
   **Kein Login nötig** - der Key wird nie an den Client gesendet!

### 5. Nach dem Deployment

1. Die App sollte unter `https://deine-domain.cloudron.me` erreichbar sein
2. Prüfe, ob alle Assets geladen werden (Charts, Bilder, etc.)
3. Teste die mobile Ansicht

## Troubleshooting

### Charts werden nicht angezeigt
- Prüfe die Browser-Konsole auf Fehler
- Stelle sicher, dass `alben.json` und `embeddings.json` vorhanden sind
- Prüfe die Netzwerk-Tab auf fehlgeschlagene Requests

### Bilder werden nicht geladen
- Stelle sicher, dass der `images/covers/` Ordner vollständig hochgeladen wurde
- Prüfe die Dateinamen (müssen mit den Daten in `alben.json` übereinstimmen)

### Chat funktioniert nicht
- Prüfe, ob `.htaccess` existiert und den `OPENROUTER_API_KEY` enthält
- Prüfe, ob `api-proxy.php` vorhanden ist
- Prüfe die Browser-Konsole auf Fehler
- Prüfe die PHP-Logs: `tail -f /app/data/logs/error.log`
- Stelle sicher, dass `embeddings.json` vorhanden ist
- Teste den Proxy direkt: `curl -X POST https://deine-domain/api-proxy.php -H "Content-Type: application/json" -d '{"model":"test","messages":[]}'`

## Alternative: Nginx statt Python Server

Falls du lieber Nginx statt Python HTTP-Server nutzen möchtest, kannst du `app.json` anpassen:

```json
{
  "scripts": {
    "start": "nginx -g 'daemon off;'"
  }
}
```

Und eine `nginx.conf` erstellen:

```nginx
server {
    listen 8000;
    server_name _;
    root /app/public;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|json|txt|md)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Dateigröße

- `alben.json`: ~500KB - 1MB (je nach Datenmenge)
- `embeddings.json`: ~10-50MB (je nach Anzahl der Alben)
- `images/covers/`: ~100-500MB (je nach Anzahl und Qualität der Bilder)

**Gesamt:** ~200-600MB (ohne Bilder), ~500MB-1GB (mit Bildern)

---

## LAMP Server Setup (Empfohlen für iterative Entwicklung)

### Vorteile für Entwicklung:
- ✅ Direkter File-Upload per SFTP/SSH
- ✅ Schnelle Iterationen (Datei hochladen → sofort sichtbar)
- ✅ Einfaches Debugging (direkter Zugriff auf Dateien)
- ✅ Git-Deployment möglich
- ✅ Cloudron-Integration (Backups, Updates)

### Setup-Schritte:

#### 1. LAMP App in Cloudron installieren

1. Gehe zu Cloudron Dashboard
2. "App Store" → Suche nach "LAMP"
3. Installiere die LAMP-App (z.B. "LAMP (PHP 7.4)" oder neuer)
4. Wähle eine Subdomain (z.B. `alben-dashboard.deine-domain.cloudron.me`)
5. Notiere dir die Zugangsdaten:
   - **SFTP-Zugang**: Im Cloudron Dashboard unter "SFTP Access" der LAMP-App
   - **Web-Terminal**: Im Cloudron Dashboard verfügbar
   - **Dateimanager**: Direkt im Cloudron Dashboard

**Wichtig**: Die LAMP-App ist primär für PHP gedacht, funktioniert aber auch perfekt für statische Websites (HTML/JS/CSS).

#### 2. Dateien hochladen

**Wichtig**: In der Cloudron LAMP-App werden Dateien in `/app/data/public/` hochgeladen (nicht `/app/public/`).

**Option A: SFTP (empfohlen für iterative Entwicklung)**

```bash
# Mit FileZilla, Cyberduck oder Terminal
# SFTP-Zugangsdaten aus Cloudron Dashboard → LAMP App → SFTP Access
sftp cloudron@deine-domain.cloudron.me
cd /app/data/public
# Lade alle Dateien aus dem public/ Ordner hoch
```

**Option B: Cloudron Dateimanager (einfachste Methode)**

1. Gehe zu Cloudron Dashboard → LAMP App
2. Klicke auf "File Manager"
3. Navigiere zu `/app/data/public/`
4. Lade Dateien per Drag & Drop hoch

**Option C: Git-Deployment (Empfohlen für iterative Entwicklung)**

**Einmaliges Setup:**
```bash
# Auf Cloudron Server via Web-Terminal:
cd /app/data/public
# Falls index.php vorhanden, entfernen:
rm index.php
# Repo klonen:
git clone https://github.com/dein-user/alben-dashboard.git .
```

**Updates (nach jedem Push zu GitHub):**
```bash
# Auf Cloudron Server via Web-Terminal:
cd /app/data/public
git pull
```

**Oder von lokal (SSH Einzeiler):**
```bash
ssh cloudron@deine-domain.de "cd /app/data/public && git pull"
```

**Wichtig:**
- `.htaccess` mit API-Key wird nicht ins Repo gepusht (ist in `.gitignore`)
- Bilder (`public/images/covers/`) werden nicht ins Repo gepusht (Urheberrecht)
- Nach dem ersten `git clone` musst du `.htaccess` manuell erstellen (siehe Schritt 4)

**Option D: rsync (für schnelle Syncs)**

```bash
# Verwende SFTP-Zugangsdaten aus Cloudron Dashboard
rsync -avz --exclude 'node_modules' \
  --exclude '.git' \
  public/ cloudron@deine-domain.cloudron.me:/app/data/public/
```

#### 3. Apache-Konfiguration anpassen

Die Cloudron LAMP-App verwendet Apache. Du kannst die Konfiguration anpassen:

**Option A: `.htaccess` Datei** (einfachste Methode)

Kopiere die Beispiel-Datei und passe sie an:
```bash
cd /app/data/public
cp .htaccess.example .htaccess
nano .htaccess  # Füge deinen OpenRouter API-Key ein
```

Die `.htaccess` enthält bereits:

```apache
# Fallback auf index.html für SPA-Routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Caching für statische Assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType application/json "access plus 1 day"
</IfModule>

# Gzip-Kompression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

**Option B: Apache-Konfiguration direkt** (für erweiterte Anpassungen)

Bearbeite `/app/data/apache/app.conf`:

```apache
<VirtualHost *:8000>
    DocumentRoot /app/data/public
    
    <Directory /app/data/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Nach Änderungen an `app.conf`: App in Cloudron Dashboard neu starten.

#### 4. Workflow für iterative Entwicklung

**Schneller Workflow:**

```bash
# Lokal entwickeln
# Dann Dateien hochladen:
rsync -avz --exclude 'node_modules' \
  --exclude '.git' \
  public/ cloudron@deine-domain.cloudron.me:/app/data/public/

# Oder einzelne Datei:
scp public/js/router.js cloudron@deine-domain.cloudron.me:/app/data/public/js/
```

**Mit Git (empfohlen für Team):**

```bash
# Lokal:
git add .
git commit -m "Update mobile CSS"
git push

# Auf Server (via Web-Terminal oder SSH):
# Gehe zu Cloudron Dashboard → LAMP App → Terminal
cd /app/data/public
git pull
```

#### 5. OpenRouter API-Key konfigurieren

**Option A: Umgebungsvariable (empfohlen)**

In Cloudron App Settings → Environment Variables:
```
OPENROUTER_API_KEY=dein-key
```

Dann in `public/js/chatConfig.js` anpassen:
```javascript
// Lade aus Umgebungsvariable (falls verfügbar)
const apiKey = process.env.OPENROUTER_API_KEY || localStorage.getItem('openrouter_api_key');
```

**Option B: Direkt in `chatConfig.js`** (weniger sicher, aber einfacher für Entwicklung)

#### 6. Debugging

**Logs ansehen:**
- Via Cloudron Dashboard → LAMP App → Logs
- Oder via Terminal: `tail -f /app/data/logs/error.log`

**Dateien direkt bearbeiten:**
- Via Cloudron Dashboard → LAMP App → File Manager
- Oder via Terminal: `nano /app/data/public/js/router.js`
- Oder mit VS Code Remote SSH Extension (SFTP-Zugang nutzen)

### Vorteile dieses Ansatzes:

1. **Schnelle Iterationen**: Datei hochladen → sofort testen
2. **Einfaches Debugging**: Direkter Zugriff auf Dateien
3. **Flexibilität**: Kann jederzeit Dateien ändern ohne Container-Build
4. **Git-Integration**: Automatische Deployments möglich

### Nachteile:

- Weniger Cloudron-Integration (keine automatischen Backups)
- Manuelles Backup-Management nötig
- Weniger isoliert (aber für statische Apps unkritisch)

---

## Cloudron App Setup (Für Produktion)

### Vorteile für Produktion:
- ✅ Automatische Backups
- ✅ Bessere Cloudron-Integration
- ✅ Isolierte Container-Umgebung
- ✅ Einfache Updates über Cloudron UI

### Setup-Schritte:

Siehe Abschnitt "Deployment-Schritte" oben.

### Workflow für Updates:

1. Änderungen lokal machen
2. `public/` Ordner packen
3. ZIP in Cloudron hochladen
4. App wird neu deployed

**Nachteil**: Jedes Update erfordert vollständiges Deployment (langsamer für iterative Entwicklung)
