#!/usr/bin/env node
/**
 * Script zum Generieren von Embeddings für alle Alben
 * 
 * Usage:
 *   node scripts/generate_embeddings.js [--api-key YOUR_KEY] [--output public/data/embeddings.json]
 * 
 * Oder mit Umgebungsvariable:
 *   OPENROUTER_API_KEY=your_key node scripts/generate_embeddings.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfiguration
const DEFAULT_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_OUTPUT = path.join(__dirname, '../public/data/embeddings.json');
const DEFAULT_INPUT = path.join(__dirname, '../public/data/alben.json');
const EMBEDDING_MODEL = 'text-embedding-3-small'; // Günstiger als ada-002
const BATCH_SIZE = 100; // OpenRouter erlaubt Batches

/**
 * Erstellt einen Text-String für ein Album (für Embedding)
 */
export function createAlbumText(album) {
  return `${album.Band} - ${album.Album} (${album.Jahr || 'Unbekannt'}) - Note: ${album.Note}`;
}

/**
 * Generiert Embeddings für einen Batch von Alben
 */
async function generateBatchEmbeddings(batch, apiKey) {
  const texts = batch.map(createAlbumText);
  
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/testabend',
      'X-Title': 'Album Embeddings Generator'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(`API Fehler: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.data.map((item, idx) => ({
    album: batch[idx],
    embedding: item.embedding,
    index: batch[idx].index || idx
  }));
}

/**
 * Hauptfunktion: Generiert Embeddings für alle Alben
 */
export async function generateAllEmbeddings(albums, apiKey, outputPath) {
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
 * Hauptfunktion
 */
async function main() {
  // Parse Command-Line Arguments
  const args = process.argv.slice(2);
  let apiKey = DEFAULT_API_KEY;
  let outputPath = DEFAULT_OUTPUT;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(args[i + 1]);
      i++;
    }
  }
  
  // Validierung
  if (!apiKey) {
    console.error('❌ Fehler: OpenRouter API Key fehlt!');
    console.error('   Nutze: --api-key YOUR_KEY');
    console.error('   Oder: OPENROUTER_API_KEY=your_key node scripts/generate_embeddings.js');
    process.exit(1);
  }
  
  if (!fs.existsSync(DEFAULT_INPUT)) {
    console.error(`❌ Fehler: Eingabedatei nicht gefunden: ${DEFAULT_INPUT}`);
    process.exit(1);
  }
  
  // Lade Alben-Daten
  console.log(`📂 Lade Alben-Daten aus ${DEFAULT_INPUT}...`);
  const albumsData = JSON.parse(fs.readFileSync(DEFAULT_INPUT, 'utf-8'));
  console.log(`✅ ${albumsData.length} Alben geladen\n`);
  
  // Generiere Embeddings
  try {
    await generateAllEmbeddings(albumsData, apiKey, outputPath);
    console.log('🎉 Embedding-Generierung erfolgreich abgeschlossen!');
  } catch (error) {
    console.error('\n❌ Fehler bei der Embedding-Generierung:', error.message);
    process.exit(1);
  }
}

// Starte Script
main().catch(error => {
  console.error('Unerwarteter Fehler:', error);
  process.exit(1);
});
