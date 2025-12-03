# Cover-Bilder auf Cloudron-Server hochladen

## Problem
Die Cover-Bilder werden auf https://testabend.wolkenbar.de nicht angezeigt, weil die Dateien auf dem Server fehlen.

## Diagnose
```bash
curl -I "https://testabend.wolkenbar.de/images/covers/Vampire_Weekend_Only_God_Was_Above_Us_2024.jpg"
```

Ausgabe zeigt:
- `content-type: text/html` (statt `image/jpeg`)
- `content-length: 2555` (HTML der index.html)

→ Die Dateien existieren nicht, `.htaccess` leitet auf `index.html` um.

## Lösung: Cover-Bilder auf Server kopieren

### Option 1: rsync (schnell für viele Dateien)

```bash
# Von deinem lokalen Rechner (im Projekt-Root):
rsync -avz --progress public/images/covers/ cloudron@testabend.wolkenbar.de:/app/data/public/images/covers/

# Erklärung:
# -a: Archive-Modus (behält Berechtigungen)
# -v: Verbose (zeigt Dateien an)
# -z: Komprimiert beim Transfer
# --progress: Zeigt Fortschritt
```

### Option 2: scp (einfacher, für kleinere Mengen)

```bash
# Von deinem lokalen Rechner (im Projekt-Root):
scp -r public/images/covers/* cloudron@testabend.wolkenbar.de:/app/data/public/images/covers/
```

### Option 3: Manuell per SFTP

1. Verbinde dich per SFTP zu `testabend.wolkenbar.de`
2. Navigiere zu `/app/data/public/images/`
3. Erstelle den Ordner `covers/` falls nicht vorhanden
4. Lade alle Dateien aus `public/images/covers/` hoch

## Berechtigungen prüfen (auf dem Server)

Nach dem Upload auf dem Server prüfen:

```bash
ssh cloudron@testabend.wolkenbar.de

# Prüfe ob Dateien da sind
ls -lh /app/data/public/images/covers/ | head -20

# Sollte zeigen:
# -rw-r--r-- 1 cloudron cloudron  45K Nov 15 10:23 Vampire_Weekend_Only_God_Was_Above_Us_2024.jpg
# -rw-r--r-- 1 cloudron cloudron  52K Nov 15 10:23 The_Cure_Songs_Of_A_Lost_World_2024.jpg
# ...

# Prüfe Berechtigungen (sollten lesbar sein)
ls -la /app/data/public/images/covers/ | grep "\.jpg$" | head -5

# Falls Berechtigungen falsch sind:
chmod 644 /app/data/public/images/covers/*.jpg
chown cloudron:cloudron /app/data/public/images/covers/*.jpg
```

## Test nach Upload

```bash
# Von deinem lokalen Rechner:
curl -I "https://testabend.wolkenbar.de/images/covers/Vampire_Weekend_Only_God_Was_Above_Us_2024.jpg"

# Sollte zeigen:
# HTTP/2 200
# content-type: image/jpeg
# content-length: 45000 (oder ähnlich, je nach Dateigröße)
```

## Automatisierung für die Zukunft

Füge zum `deploy.sh`-Script eine Warnung hinzu:

```bash
#!/bin/bash
# ...
echo "✅ Deployment abgeschlossen!"
echo ""
echo "⚠️  WICHTIG: Cover-Bilder müssen manuell hochgeladen werden!"
echo "    rsync -avz public/images/covers/ cloudron@testabend.wolkenbar.de:/app/data/public/images/covers/"
```

## Häufige Probleme

### Problem: "Permission denied" beim Upload
**Lösung**: Prüfe SSH-Key oder Passwort für `cloudron@testabend.wolkenbar.de`

### Problem: Dateien hochgeladen, aber immer noch nicht sichtbar
**Lösung**: 
1. Hard-Reload im Browser (Cmd+Shift+R)
2. Prüfe Berechtigungen: `ls -la /app/data/public/images/covers/`
3. Prüfe ob Dateien wirklich da sind: `file /app/data/public/images/covers/*.jpg | head -5`

### Problem: Nur manche Cover werden angezeigt
**Lösung**: 
- Prüfe ob alle Dateien hochgeladen wurden
- Prüfe Dateinamen (Groß-/Kleinschreibung, Sonderzeichen)
- Vergleiche lokale und Server-Dateien: `ls public/images/covers/ | wc -l` vs. `ssh cloudron@testabend.wolkenbar.de "ls /app/data/public/images/covers/ | wc -l"`

## Warum sind Cover-Bilder nicht im Git?

**Urheberrecht**: Die Album-Cover sind urheberrechtlich geschützt und dürfen nicht öffentlich in einem Git-Repository liegen.

**Konsequenz**: 
- Cover-Bilder müssen manuell verwaltet werden
- Lokale Entwicklung: Bilder in `public/images/covers/` (im `.gitignore`)
- Server: Bilder in `/app/data/public/images/covers/` (manuell hochgeladen)
