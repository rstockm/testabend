# Cache-Verwaltung für Entwicklung

## Problem
Während der Entwicklung werden CSS/JS-Änderungen oft nicht sofort sichtbar, besonders auf Mobile-Geräten ohne Hard Reload.

## Lösung 1: Entwicklungs-.htaccess verwenden (Empfohlen)

**Auf dem LAMP-Server:**

1. Kopiere die Entwicklungs-Version der .htaccess:
```bash
cp public/.htaccess.dev public/.htaccess
```

2. Füge deinen OpenRouter API-Key in die .htaccess ein (falls noch nicht geschehen)

3. Die .htaccess.dev setzt folgende Header:
   - `Cache-Control: no-cache, no-store, must-revalidate` für CSS/JS/HTML/JSON
   - `Pragma: no-cache`
   - `Expires: 0`

**Vorteil:** Funktioniert serverseitig, alle Browser respektieren es automatisch.

## Lösung 2: Für Produktion zurückwechseln

**Wenn du fertig mit der Entwicklung bist:**

```bash
cp public/.htaccess.example public/.htaccess
```

Dann die Cache-Zeiten in der .htaccess anpassen (z.B. 1 Monat für CSS/JS).

## Lösung 3: Browser-Cache manuell leeren (Mobile)

**iOS Safari:**
- Einstellungen → Safari → Verlauf und Websitedaten löschen

**Android Chrome:**
- Einstellungen → Datenschutz → Browserdaten löschen → Cached Images and Files

**Alternative:** Im Browser DevTools (falls verfügbar) "Disable cache" aktivieren.

## Lösung 4: Cache-Busting (Optional, für hartnäckige Fälle)

Falls die .htaccess-Lösung nicht ausreicht, können CSS/JS-Dateien mit Query-Parametern geladen werden:

```html
<link rel="stylesheet" href="styles.css?v=<?php echo time(); ?>">
```

Dies erfordert jedoch PHP oder Server-Side Rendering.

## Empfehlung

**Für Entwicklung:** Verwende `.htaccess.dev` → Kopiere zu `.htaccess`
**Für Produktion:** Verwende `.htaccess.example` → Kopiere zu `.htaccess` und passe Cache-Zeiten an

Die Meta-Tags im HTML (`index.html`) unterstützen zusätzlich die Cache-Verhinderung im Browser.

