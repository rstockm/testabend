#!/usr/bin/env python3
"""
Test-Skript zum Prüfen der Dateinamen-Matching-Funktion
"""

import json
import re
import os
from pathlib import Path

def sanitize_filename(text):
    """Erstellt einen sicheren Dateinamen aus Band/Album-Namen"""
    # Entferne Sonderzeichen und ersetze durch Unterstriche
    text = re.sub(r'[<>:"/\\|?*]', '', text)
    text = re.sub(r'\s+', '_', text)
    text = text.strip('_')
    return text[:100]

def get_cover_filename(band, album, year=None):
    """Generiert Dateinamen für Album-Cover"""
    band_safe = sanitize_filename(band)
    album_safe = sanitize_filename(album)
    filename = f"{band_safe}_{album_safe}"
    
    # Wenn Jahr angegeben, füge es hinzu (für Duplikate)
    if year:
        filename = f"{filename}_{year}"
    
    return f"{filename}.jpg"

def find_cover_file(band, album, covers_dir):
    """Findet Cover-Datei für Band/Album"""
    band_safe = sanitize_filename(band)
    album_safe = sanitize_filename(album)
    
    # Versuche verschiedene Varianten
    patterns = [
        f"{band_safe}_{album_safe}.jpg",
        f"{band_safe}_{album_safe}_*.jpg",  # Mit Jahr-Suffix
    ]
    
    covers_path = Path(covers_dir)
    if not covers_path.exists():
        return None
    
    # Exakte Suche
    exact_match = covers_path / f"{band_safe}_{album_safe}.jpg"
    if exact_match.exists():
        return str(exact_match)
    
    # Suche mit Wildcard (für Duplikate mit Jahr)
    import glob
    pattern = str(covers_path / f"{band_safe}_{album_safe}_*.jpg")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]  # Nimm das erste Match
    
    return None

def test_matching():
    """Testet die Matching-Funktion"""
    print("🔍 Teste Dateinamen-Matching")
    print("=" * 60)
    
    # Lade JSON
    json_path = Path("../public/data/alben.json")
    with open(json_path, 'r', encoding='utf-8') as f:
        albums = json.load(f)
    
    # Lade vorhandene Cover
    covers_dir = Path("../public/images/covers")
    existing_files = set()
    if covers_dir.exists():
        for f in covers_dir.glob("*.jpg"):
            existing_files.add(f.stem)  # Ohne .jpg
    
    print(f"📊 JSON-Alben: {len(albums)}")
    print(f"📁 Vorhandene Cover: {len(existing_files)}")
    print()
    
    # Teste Matching
    matched = 0
    not_matched = []
    
    for album in albums:
        band = album.get('Band', '').strip()
        album_name = album.get('Album', '').strip()
        if not band or not album_name:
            continue
        
        filename_base = f"{sanitize_filename(band)}_{sanitize_filename(album_name)}"
        
        # Prüfe exakte Übereinstimmung
        if filename_base in existing_files:
            matched += 1
        else:
            # Prüfe ob es eine Variante mit Jahr gibt
            year = album.get('Jahr')
            if year:
                filename_with_year = f"{filename_base}_{year}"
                if filename_with_year in existing_files:
                    matched += 1
                    continue
            
            not_matched.append((band, album_name, filename_base))
    
    print(f"✅ Erfolgreich gematcht: {matched}/{len(existing_files)}")
    print(f"❌ Nicht gematcht: {len(not_matched)}")
    print()
    
    if not_matched:
        print("Nicht gematchte Alben (erste 10):")
        for band, album, filename in not_matched[:10]:
            print(f"  \"{band}\" - \"{album}\"")
            print(f"    Erwartet: {filename}.jpg")
            print()
    
    # Prüfe auf Duplikate im JSON
    print("\n" + "=" * 60)
    print("Duplikat-Prüfung:")
    filename_to_albums = {}
    for album in albums:
        band = album.get('Band', '').strip()
        album_name = album.get('Album', '').strip()
        if not band or not album_name:
            continue
        
        filename = f"{sanitize_filename(band)}_{sanitize_filename(album_name)}"
        if filename not in filename_to_albums:
            filename_to_albums[filename] = []
        filename_to_albums[filename].append(album)
    
    duplicates = {k: v for k, v in filename_to_albums.items() if len(v) > 1}
    print(f"⚠️  Duplikate gefunden: {len(duplicates)}")
    
    if duplicates:
        print("\nDuplikate (gleicher Band+Album Name):")
        for filename, album_list in list(duplicates.items())[:5]:
            print(f"\n{filename}.jpg ({len(album_list)}x):")
            for album in album_list:
                print(f"  - Jahr: {album.get('Jahr')}, Platz: {album.get('Platz')}")

if __name__ == '__main__':
    test_matching()

