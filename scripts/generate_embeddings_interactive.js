#!/usr/bin/env node
/**
 * Interaktives Script zum Generieren von Embeddings
 * Fragt nach API-Key, falls nicht als Parameter übergeben
 */

import { createInterface } from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OUTPUT = path.join(__dirname, '../public/data/embeddings.json');
const DEFAULT_INPUT = path.join(__dirname, '../public/data/alben.json');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100;

/**
 * Erstellt einen Text-String für ein Album (für Embedding)
 */
function createAlbumText(album) {
  return `${album.Band} - ${album.Album} (${album.Jahr || 'Unbekannt'}) - Note: ${album.Note}`;
}

/**
 * Generiert Embeddings für einen Batch von Alben
 */
async function generateBatchEmbeddings(batch, apiKey) {
  const texts = batch.map(createAlbumText);
  
  const postData = JSON.stringify({
    model: EMBEDDING_MODEL,
    input: texts
  });
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/embeddings',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'HTTP-Referer': 'https://github.com/testabend',
        'X-Title': 'Album Embeddings Generator'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const error = JSON.parse(data);
            reject(new Error(`API Fehler: ${error.error?.message || `HTTP ${res.statusCode}`}`));
          } catch (e) {
            reject(new Error(`API Fehler: HTTP ${res.statusCode}`));
          }
          return;
        }
        
        try {
          const jsonData = JSON.parse(data);
          const result = jsonData.data.map((item, idx) => ({
            album: batch[idx],
            embedding: item.embedding,
            index: batch[idx].index || idx
          }));
          resolve(result);
        } catch (e) {
          reject(new Error(`JSON Parse Fehler: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request Fehler: ${error.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Hauptfunktion: Generiert Embeddings für alle Alben
 */
async function generateAllEmbeddings(albums, apiKey, outputPath) {
  console.log(`\n🚀 Starte Embedding-Generierung für ${albums.length} Alben...`);
  console.log(`📊 Modell: ${EMBEDDING_MODEL}`);
  console.log(`📦 Batch-Größe: ${BATCH_SIZE}\n`);
  
  const allEmbeddings = [];
  const totalBatches = Math.ceil(albums.length / BATCH_SIZE);
  
  // Füge Index zu jedem Album hinzu
  const albumsWithIndex = albums.map((album, idx) => ({ ...album, index: idx }));
  
  for (let i = 0; i < albums.length; i += BATCH_SIZE) {
    const batch = albumsWithIndex.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      console.log(`📝 Batch ${batchNum}/${totalBatches} (Alben ${i + 1}-${Math.min(i + BATCH_SIZE, albums.length)})...`);
      
      const batchEmbeddings = await generateBatchEmbeddings(batch, apiKey);
      allEmbeddings.push(...batchEmbeddings);
      
      console.log(`✅ Batch ${batchNum} abgeschlossen (${allEmbeddings.length}/${albums.length} Embeddings)\n`);
      
      // Rate limiting: Kurze Pause zwischen Batches
      if (i + BATCH_SIZE < albums.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Fehler in Batch ${batchNum}:`, error.message);
      throw error;
    }
  }
  
  // Sortiere nach Index
  allEmbeddings.sort((a, b) => a.index - b.index);
  
  // Speichere als JSON
  console.log(`💾 Speichere Embeddings nach ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(allEmbeddings, null, 2));
  
  const fileSize = fs.statSync(outputPath).size;
  console.log(`✅ Embeddings gespeichert! (${(fileSize / 1024 / 1024).toFixed(2)} MB)\n`);
  
  return allEmbeddings;
}

/**
 * Fragt nach API-Key
 */
function askForAPIKey() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('🔑 Bitte gib deinen OpenRouter API Key ein: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log('🎵 Album Embeddings Generator\n');
  
  // Prüfe ob Key als Parameter übergeben wurde
  let apiKey = process.env.OPENROUTER_API_KEY || '';
  
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    }
  }
  
  // Wenn kein Key vorhanden, frage interaktiv
  if (!apiKey) {
    apiKey = await askForAPIKey();
  }
  
  if (!apiKey) {
    console.error('❌ Kein API Key angegeben. Abgebrochen.');
    process.exit(1);
  }
  
  // Prüfe ob Eingabedatei existiert
  if (!fs.existsSync(DEFAULT_INPUT)) {
    console.error(`❌ Eingabedatei nicht gefunden: ${DEFAULT_INPUT}`);
    process.exit(1);
  }
  
  // Lade Alben-Daten
  console.log(`📂 Lade Alben-Daten aus ${DEFAULT_INPUT}...`);
  const albumsData = JSON.parse(fs.readFileSync(DEFAULT_INPUT, 'utf-8'));
  console.log(`✅ ${albumsData.length} Alben geladen\n`);
  
  // Generiere Embeddings
  try {
    await generateAllEmbeddings(albumsData, apiKey, DEFAULT_OUTPUT);
    console.log('🎉 Embedding-Generierung erfolgreich abgeschlossen!');
    console.log(`\n📁 Embeddings gespeichert in: ${DEFAULT_OUTPUT}`);
  } catch (error) {
    console.error('\n❌ Fehler bei der Embedding-Generierung:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unerwarteter Fehler:', error);
  process.exit(1);
});
