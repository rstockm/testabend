# Deployment-Hinweise: Testabend

## Architektur-Übersicht

### Lokale Entwicklung
- **Webserver**: Python HTTP Server (`python -m http.server 8000`)
- **Base-Path**: `/` (Root)
- **Cover-Images**: `public/images/covers/` (im Git-Repo **NICHT** enthalten)

### Cloudron Live-Server (testabend.wolkenbar.de)
- **Webserver**: Apache (LAMP Stack)
- **Base-Path**: `/` (Root, aber mit `.htaccess` SPA-Routing)
- **Cover-Images**: `/app/data/public/images/covers/` (manuell gepflegt, **NICHT** aus Git)
- **.htaccess**: Enthält API-Key und SPA-Routing, manuell gepflegt

## Cover-Images: Wichtige Besonderheiten

### ⚠️ KRITISCH: Cover-Bilder sind NICHT im Git-Repo

**Grund**: Urheberrecht – die Cover-Bilder dürfen nicht öffentlich im Repository liegen.

**Konsequenz**:
- Cover-Bilder müssen **manuell** auf den Server kopiert werden
- Der Ordner `/app/data/public/images/covers/` existiert nur auf dem Server
- Das `deploy.sh`-Script schließt `images/` explizit aus

**Pfade**:
```
Lokal (nicht committet):  public/images/covers/*.jpg
Server:                   /app/data/public/images/covers/*.jpg
```

## Deployment-Workflow

### 1. Code-Änderungen lokal testen
```bash
# Im Projekt-Root
python -m http.server 8000
# Öffne http://localhost:8000
```

### 2. Code committen und pushen
```bash
git add .
git commit -m "feat: deine Änderung"
git push origin main
```

### 3. Auf Cloudron deployen
```bash
# SSH zum Cloudron-Server
ssh cloudron@testabend.wolkenbar.de

# Im Server-Verzeichnis
cd /app/data/public
bash deploy.sh
```

### 4. Seite testen
- Öffne `https://testabend.wolkenbar.de`
- **WICHTIG**: Hard-Reload im Browser (Cmd+Shift+R / Ctrl+F5)
- Teste Cover-Anzeige in der Jahre-View

## Asset-Pfade: Robuste Lösung

### Problem
Cover-Pfade müssen sowohl lokal als auch auf dem Server funktionieren, ohne dass relative Pfade vom SPA-Routing abgefangen werden.

### Lösung: Absolute Pfade mit `getBasePath()`

Die Funktion `getBasePath()` in `utils.js` gibt **immer** einen absoluten Pfad zurück:
- Lokal: `/` → Cover-URL: `/images/covers/Band_Album.jpg`
- Server: `/` → Cover-URL: `/images/covers/Band_Album.jpg`
- Server mit Subdirectory: `/subdir` → Cover-URL: `/subdir/images/covers/Band_Album.jpg`

**Wichtig**: Alle Cover-URLs beginnen mit `/`, nie mit `images/` (relativ).

### .htaccess SPA-Routing

Die `.htaccess` auf dem Server sorgt dafür, dass:
1. Existierende Dateien direkt ausgeliefert werden (`RewriteCond %{REQUEST_FILENAME} !-f`)
2. Nicht-existierende Pfade auf `index.html` umgeleitet werden (SPA-Fallback)

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

**Konsequenz**: Cover-URLs mit `/images/covers/...` werden direkt ausgeliefert, da die Dateien existieren.

## Dateien, die NICHT über Git deployed werden

Diese Dateien sind auf dem Server manuell gepflegt und werden vom `deploy.sh`-Script **nicht** überschrieben:

1. **`.htaccess`**
   - Enthält OpenRouter API-Key
   - Enthält SPA-Routing
   - Wird bei Deployment ausgeschlossen

2. **`images/` (kompletter Ordner)**
   - Enthält Cover-Bilder (Urheberrecht)
   - Wird bei Deployment ausgeschlossen
   - Muss manuell auf den Server kopiert werden

3. **`data/embeddings.json`**
   - Zu groß für Git (~50MB)
   - Wird bei Deployment ausgeschlossen
   - Muss manuell auf den Server kopiert werden

## Testing-Hinweise

### Lokales Testen
- Cover-Bilder müssen in `public/images/covers/` liegen (nicht committet)
- Server starten: `python -m http.server 8000`
- Öffne `http://localhost:8000`

### Server-Testen
- **ERST** `deploy.sh` ausführen, **DANN** testen
- Hard-Reload im Browser (Browser-Cache!)
- Console prüfen: Keine 404-Fehler für `/images/covers/...`

### Debug-Checkliste bei Cover-Problemen

1. **Cover-Dateien vorhanden?**
   ```bash
   ls -la /app/data/public/images/covers/ | head
   ```

2. **Pfade in Network-Tab prüfen**
   - Öffne DevTools → Network
   - Filtere nach "images"
   - Prüfe ob Pfade mit `/images/covers/...` beginnen (NICHT `images/covers/...`)

3. **getBasePath() testen**
   ```javascript
   // In Browser-Console
   import('./js/utils.js').then(m => console.log('Base:', m.getBasePath()));
   // Sollte '/' ausgeben (nicht '')
   ```

4. **Status-Codes prüfen**
   - HEAD-Requests: sollten 200 sein
   - GET-Requests: sollten 200 sein
   - Wenn 404: Dateien fehlen auf Server
   - Wenn HTML statt JPG: Pfade werden von .htaccess abgefangen (falscher Pfad)

## Häufige Probleme und Lösungen

### Problem: Cover nicht sichtbar auf Server, aber lokal schon
**Ursache**: Cover-Dateien fehlen auf dem Server  
**Lösung**: Cover-Dateien manuell auf Server kopieren nach `/app/data/public/images/covers/`

### Problem: Cover-URLs geben HTML statt JPG zurück
**Ursache**: Relative Pfade werden von .htaccess auf index.html umgeleitet  
**Lösung**: `getBasePath()` muss `/` zurückgeben, nicht `` (leerer String)

### Problem: Änderungen nicht sichtbar nach Deployment
**Ursache**: Browser-Cache oder Server-Cache  
**Lösung**: 
1. Hard-Reload im Browser (Cmd+Shift+R)
2. Prüfe, ob `deploy.sh` ohne Fehler durchgelaufen ist
3. Prüfe `git log` auf dem Server: `cd /app/data/public && git log -1`

### Problem: .htaccess wurde überschrieben
**Ursache**: Jemand hat `deploy.sh` modifiziert  
**Lösung**: 
1. API-Key neu in `.htaccess` eintragen
2. Prüfe, dass `deploy.sh` `./htaccess` excludiert

## Memory/Notizen für AI-Assistenten

- Cover-Images liegen **nicht** im Git-Repo (Urheberrecht)
- Cover-Images werden manuell auf Server gepflegt: `/app/data/public/images/covers/`
- `deploy.sh` excludiert: `.htaccess`, `images/`, `data/embeddings.json`
- Testing auf Server nur nach `deploy.sh`
- Interner Browser: Hard-Reload oft buggy, manuell auslösen lassen
- `.htaccess` enthält API-Key → kann nicht über Git aktualisiert werden
- Alle Asset-Pfade müssen absolut sein (mit führendem `/`)

