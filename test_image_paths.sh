#!/bin/bash
# Test-Script um herauszufinden, wo die Bilder auf dem Server liegen

DOMAIN="testabend.wolkenbar.de"

echo "Testing image paths on $DOMAIN..."
echo ""

# Test 1: Direkter Pfad /images/covers/
echo "1. Testing /images/covers/ (HEAD request):"
curl -I "https://$DOMAIN/images/covers/" 2>&1 | head -5
echo ""

# Test 2: Test mit einem echten Bildnamen aus dem Screenshot
echo "2. Testing /images/covers/A-ha_Analogue.jpg (HEAD request):"
curl -I "https://$DOMAIN/images/covers/A-ha_Analogue.jpg" 2>&1 | head -10
echo ""

echo "2b. Testing /images/covers/A-ha_Foot_Of_The_Mountain.jpg (HEAD request):"
curl -I "https://$DOMAIN/images/covers/A-ha_Foot_Of_The_Mountain.jpg" 2>&1 | head -10
echo ""

# Test 3: Liste der Dateien im Verzeichnis (falls Directory Listing aktiviert ist)
echo "3. Testing directory listing /images/covers/:"
curl -s "https://$DOMAIN/images/covers/" | head -20
echo ""

# Test 4: Root-Verzeichnis
echo "4. Testing root /:"
curl -I "https://$DOMAIN/" 2>&1 | head -5
echo ""

# Test 5: Verschiedene mögliche Pfade
echo "5. Testing alternative paths:"
for path in "/public/images/covers/" "/app/images/covers/" "./images/covers/"; do
  echo "  Testing: $path"
  curl -I "https://$DOMAIN$path" 2>&1 | head -3
  echo ""
done

echo ""
echo "Done. Check the responses above to see which path works."
