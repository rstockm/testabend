#!/usr/bin/env python3
"""
Skript zum Herunterladen und Optimieren von Album-Covern
Verwendet die iTunes Search API (kein API-Key erforderlich)
Robuste Version mit Retry-Logik und Progress-Speicherung
"""

import json
import os
import requests
from PIL import Image
import io
import time
import re
import sys
from pathlib import Path
from collections import defaultdict

# Stelle sicher, dass stdout nicht gepuffert wird für Echtzeit-Ausgabe
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

# Konfiguration
ALBEN_JSON = '../public/data/alben.json'
OUTPUT_DIR = '../public/images/covers'
PROGRESS_FILE = '../public/images/covers/.progress.json'
TARGET_SIZE = (300, 300)  # Zielgröße für Thumbnails
QUALITY = 85  # JPEG-Qualität (0-100)
DELAY = 0.5  # Verzögerung zwischen API-Aufrufen (Sekunden)

# Spotify API Konfiguration (Client Credentials Flow)
# 1. Versucht zuerst Umgebungsvariablen (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)
# 2. Fällt dann auf die Datei scripts/spotify_config.json zurück
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID') or None
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET') or None
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search'

_spotify_access_token = None
_spotify_token_expires_at = 0  # UNIX-Zeitpunkt


def _load_spotify_config_from_file():
    """Lädt Client-ID und Secret aus scripts/spotify_config.json, falls nicht per ENV gesetzt."""
    global SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

    # Wenn bereits gesetzt (z.B. via ENV), nichts tun
    if SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET:
        return

    try:
        cfg_path = Path(__file__).with_name("spotify_config.json")
        if not cfg_path.exists():
            return
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
        SPOTIFY_CLIENT_ID = SPOTIFY_CLIENT_ID or data.get("client_id")
        SPOTIFY_CLIENT_SECRET = SPOTIFY_CLIENT_SECRET or data.get("client_secret")
    except Exception:
        # Bei Fehlern einfach still zurückfallen – get_spotify_access_token gibt dann eine klare Fehlermeldung aus.
        return

def sanitize_filename(text):
    """Erstellt einen sicheren Dateinamen aus Band/Album-Namen"""
    text = re.sub(r'[<>:"/\\|?*]', '', text)
    text = re.sub(r'\s+', '_', text)
    text = text.strip('_')
    return text[:100]

def get_spotify_access_token(force_refresh: bool = False) -> str | None:
    """Holt ein Spotify Access Token via Client Credentials Flow und cached es."""
    global _spotify_access_token, _spotify_token_expires_at, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

    # Stelle sicher, dass wir ggf. aus spotify_config.json geladen haben
    _load_spotify_config_from_file()

    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        print("❌ SPOTIFY_CLIENT_ID oder SPOTIFY_CLIENT_SECRET nicht gesetzt.")
        print("   Bitte entweder Umgebungsvariablen setzen ODER die Datei scripts/spotify_config.json ausfüllen.")
        return None

    now = time.time()
    if not force_refresh and _spotify_access_token and now < _spotify_token_expires_at - 60:
        return _spotify_access_token

    try:
        resp = requests.post(
            SPOTIFY_TOKEN_URL,
            data={'grant_type': 'client_credentials'},
            auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ Spotify Token-Request fehlgeschlagen (Status {resp.status_code})")
            return None
        data = resp.json()
        _spotify_access_token = data.get('access_token')
        expires_in = data.get('expires_in', 3600)
        _spotify_token_expires_at = now + expires_in
        return _spotify_access_token
    except Exception as e:
        print(f"❌ Fehler beim Abrufen des Spotify Tokens: {e}")
        return None


def get_cover_url(band, album):
    """Ruft die Spotify API auf und gibt die Cover-URL zurück (oder None)."""
    token = get_spotify_access_token()
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    # Suchstrategien: zuerst präzise Query, dann lockerer
    search_queries = [
        f'album:"{album}" artist:"{band}"',
        f'{band} {album}',
        album,
    ]

    band_lower = band.lower()
    album_lower = album.lower()

    for query in search_queries:
        try:
            resp = requests.get(
                SPOTIFY_SEARCH_URL,
                headers=headers,
                params={"q": query, "type": "album", "limit": 5},
                timeout=10
            )

            # Token evtl. abgelaufen
            if resp.status_code == 401:
                token = get_spotify_access_token(force_refresh=True)
                if not token:
                    return None
                headers["Authorization"] = f"Bearer {token}"
                continue

            if resp.status_code != 200:
                # 429 oder andere Fehler: einfach nächste Query versuchen
                continue

            data = resp.json()
            albums = data.get("albums", {}).get("items", [])
            if not albums:
                continue

            best_match = None

            for item in albums:
                artist_names = ", ".join(a.get("name", "") for a in item.get("artists", []))
                album_name = item.get("name", "")
                artist_lower = artist_names.lower()
                album_name_lower = album_name.lower()

                # Bestes Match: Band- und Albumname kommen beide vor
                if band_lower in artist_lower and album_lower in album_name_lower:
                    best_match = item
                    break
                # Fallback: Albumname passt
                if album_lower in album_name_lower and best_match is None:
                    best_match = item

            if not best_match:
                best_match = albums[0]

            images = best_match.get("images") or []
            if not images:
                continue

            # Spotify liefert mehrere Größen, wir nehmen das mittlere Bild, sonst das erste
            cover_url = None
            if len(images) >= 2:
                cover_url = images[1].get("url")
            if not cover_url:
                cover_url = images[0].get("url")

            return cover_url

        except Exception:
            # Bei Fehlern einfach nächste Query probieren
            continue

    return None

def download_and_optimize_image(url, output_path, retry_count=0):
    """Lädt ein Bild herunter und optimiert es"""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        
        img = Image.open(io.BytesIO(response.content))
        
        if img.mode in ('RGBA', 'LA', 'P'):
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = rgb_img
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        img.thumbnail(TARGET_SIZE, Image.Resampling.LANCZOS)
        img.save(output_path, 'JPEG', quality=QUALITY, optimize=True)
        
        return True
    except Exception:
        if retry_count < MAX_RETRIES:
            time.sleep(2 * (retry_count + 1))
            return download_and_optimize_image(url, output_path, retry_count + 1)
        return False

def save_progress(progress_data):
    """Speichert Fortschritt in Datei"""
    try:
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(progress_data, f, indent=2)
    except Exception:
        pass

def load_progress():
    """Lädt gespeicherten Fortschritt"""
    try:
        if os.path.exists(PROGRESS_FILE):
            with open(PROGRESS_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return None

def print_progress_bar(current, total, downloaded, skipped, failed, bar_length=40):
    """Druckt eine Fortschrittsleiste"""
    percent = current / total if total > 0 else 0
    filled = int(bar_length * percent)
    bar = '█' * filled + '░' * (bar_length - filled)
    percent_str = f"{percent * 100:.1f}%"
    
    sys.stdout.write(f'\r[{bar}] {percent_str} | {current}/{total} | ✅{downloaded} ⏭️{skipped} ❌{failed}')
    sys.stdout.flush()

def main():
    """Hauptfunktion"""
    print("🎵 Album-Cover Downloader (Robuste Version)")
    print("=" * 70)
    
    # Lade Alben-Daten
    print(f"📂 Lade Alben-Daten aus {ALBEN_JSON}...")
    try:
        with open(ALBEN_JSON, 'r', encoding='utf-8') as f:
            albums = json.load(f)
    except Exception as e:
        print(f"❌ Fehler beim Laden der Alben-Daten: {e}")
        return
    
    print(f"✅ {len(albums)} Alben geladen\n")
    
    # Erstelle Ausgabeverzeichnis
    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    print(f"📁 Ausgabeverzeichnis: {output_path.absolute()}\n")
    
    # Sammle alle Alben und identifiziere Duplikate
    albums_by_key = defaultdict(list)
    for album in albums:
        band = album.get('Band', '').strip()
        album_name = album.get('Album', '').strip()
        if band and album_name:
            key = (band, album_name)
            albums_by_key[key].append(album)
    
    # Erstelle Liste mit Duplikat-Handling
    albums_to_process = []
    for (band, album_name), album_list in albums_by_key.items():
        if len(album_list) > 1:
            for album in album_list:
                albums_to_process.append({
                    'band': band,
                    'album': album_name,
                    'year': album.get('Jahr'),
                    'data': album
                })
        else:
            albums_to_process.append({
                'band': band,
                'album': album_name,
                'year': None,
                'data': album_list[0]
            })
    
    total = len(albums_to_process)
    print(f"📊 {total} Alben zum Verarbeiten gefunden")
    print(f"   (inkl. {sum(1 for k, v in albums_by_key.items() if len(v) > 1)} Duplikate mit Jahr-Suffix)\n")
    
    # Lade gespeicherten Fortschritt
    progress_data = load_progress()
    start_idx = 0
    if progress_data:
        start_idx = progress_data.get('last_index', 0)
        print(f"📥 Fortschritt geladen: Bei Album {start_idx}/{total} fortgesetzt\n")
    
    print("🚀 Starte Download...\n")
    
    # Statistiken
    downloaded = progress_data.get('downloaded', 0) if progress_data else 0
    skipped = progress_data.get('skipped', 0) if progress_data else 0
    failed = progress_data.get('failed', 0) if progress_data else 0
    start_time = time.time()
    last_save = time.time()
    
    # Verarbeite jedes Album
    for idx, album_info in enumerate(albums_to_process[start_idx:], start_idx + 1):
        band = album_info['band']
        album_name = album_info['album']
        year = album_info['year']
        
        # Erstelle Dateinamen
        band_safe = sanitize_filename(band)
        album_safe = sanitize_filename(album_name)
        
        if year:
            filename = f"{band_safe}_{album_safe}_{year}.jpg"
        else:
            filename = f"{band_safe}_{album_safe}.jpg"
        
        filepath = output_path / filename
        
        # Überspringe wenn bereits vorhanden
        if filepath.exists():
            skipped += 1
            print_progress_bar(idx, total, downloaded, skipped, failed)
            # Speichere Fortschritt alle 10 Alben
            if idx % 10 == 0:
                save_progress({
                    'last_index': idx,
                    'downloaded': downloaded,
                    'skipped': skipped,
                    'failed': failed
                })
            continue
        
        # Hole Cover-URL
        cover_url = get_cover_url(band, album_name)
        
        if not cover_url:
            failed += 1
            print_progress_bar(idx, total, downloaded, skipped, failed)
            time.sleep(DELAY)
            # Speichere Fortschritt alle 10 Alben
            if idx % 10 == 0:
                save_progress({
                    'last_index': idx,
                    'downloaded': downloaded,
                    'skipped': skipped,
                    'failed': failed
                })
            continue
        
        # Lade und optimiere Bild
        if download_and_optimize_image(cover_url, filepath):
            downloaded += 1
        else:
            failed += 1
        
        # Fortschrittsanzeige
        print_progress_bar(idx, total, downloaded, skipped, failed)
        
        # Verzögerung zwischen API-Aufrufen
        time.sleep(DELAY)
        
        # Speichere Fortschritt regelmäßig
        if idx % 10 == 0 or (time.time() - last_save) > 60:
            save_progress({
                'last_index': idx,
                'downloaded': downloaded,
                'skipped': skipped,
                'failed': failed
            })
            last_save = time.time()
        
        # Detaillierte Ausgabe alle 100 Alben
        if idx % 100 == 0:
            elapsed = time.time() - start_time
            rate = idx / elapsed if elapsed > 0 else 0
            remaining = (total - idx) / rate if rate > 0 else 0
            print()
            print(f"   ⏱️  Geschwindigkeit: {rate:.1f} Alben/s | Geschätzte verbleibende Zeit: {remaining/60:.1f} min")
            print_progress_bar(idx, total, downloaded, skipped, failed)
    
    # Neue Zeile nach Progress Bar
    print()
    
    # Finale Statistiken
    elapsed_time = time.time() - start_time
    print("\n" + "=" * 70)
    print("✅ Download abgeschlossen!")
    print(f"📊 Statistiken:")
    print(f"   ✅ Erfolgreich: {downloaded}")
    print(f"   ⏭️  Übersprungen: {skipped}")
    print(f"   ❌ Fehlgeschlagen: {failed}")
    print(f"   📁 Gesamt: {total}")
    print(f"   ⏱️  Dauer: {elapsed_time/60:.1f} Minuten")
    
    # Berechne Speicherbedarf
    total_size = sum(f.stat().st_size for f in output_path.glob('*.jpg')) / (1024 * 1024)
    print(f"\n💾 Gesamter Speicherbedarf: {total_size:.1f} MB")
    print(f"📁 Verzeichnis: {output_path.absolute()}")
    
    # Lösche Progress-Datei nach erfolgreichem Abschluss
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Download unterbrochen. Fortschritt wurde gespeichert.")
        print("   Beim nächsten Start wird automatisch fortgesetzt.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Unerwarteter Fehler: {e}")
        print("   Fortschritt wurde gespeichert.")
        sys.exit(1)
