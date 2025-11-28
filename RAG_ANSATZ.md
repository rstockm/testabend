# RAG-Ansatz für Albendaten-Integration

## Übersicht

**RAG (Retrieval-Augmented Generation)** kombiniert semantische Suche mit LLM-Generierung:
1. Alben werden in Vektoren (Embeddings) umgewandelt
2. User-Query wird ebenfalls eingebettet
3. Ähnlichste Alben werden gefunden (Cosine Similarity)
4. Diese werden als Kontext an das LLM übergeben

## Architektur

```
┌─────────────────┐
│  User Query     │
│  "Taylor Swift" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Query Embedding                │
│  (OpenAI/OpenRouter Embeddings) │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Vector Search                  │
│  (Cosine Similarity)           │
│  Finde Top-K ähnliche Alben    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Top-K Alben als Kontext       │
│  + System Prompt                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  LLM (Claude 3.5 Sonnet)       │
│  Generiert Antwort mit         │
│  präzisen Datenreferenzen      │
└─────────────────────────────────┘
```

## Implementierungs-Schritte

### Phase 1: Embedding-Generation (Einmalig)

**Ziel**: Alle 3.634 Alben in Vektoren umwandeln und speichern

```javascript
// albumEmbeddings.js

/**
 * Erstellt einen Text-String für ein Album (für Embedding)
 */
function createAlbumText(album) {
  return `${album.Band} - ${album.Album} (${album.Jahr || 'Unbekannt'}) - Note: ${album.Note}`;
}

/**
 * Generiert Embeddings für alle Alben
 */
async function generateAlbumEmbeddings(albums, apiKey) {
  const embeddings = [];
  const batchSize = 100; // OpenRouter erlaubt Batches
  
  for (let i = 0; i < albums.length; i += batchSize) {
    const batch = albums.slice(i, i + batchSize);
    const texts = batch.map(createAlbumText);
    
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002', // oder 'text-embedding-3-small'
        input: texts
      })
    });
    
    const data = await response.json();
    const batchEmbeddings = data.data.map((item, idx) => ({
      album: batch[idx],
      embedding: item.embedding,
      index: i + idx
    }));
    
    embeddings.push(...batchEmbeddings);
    
    // Progress-Logging
    console.log(`Embeddings generiert: ${embeddings.length}/${albums.length}`);
  }
  
  return embeddings;
}
```

### Phase 2: Vektorspeicherung

**Option A: IndexedDB (Browser)**
```javascript
// vectorStore.js

const DB_NAME = 'albumEmbeddings';
const STORE_NAME = 'embeddings';

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'index' });
        store.createIndex('band', 'album.Band', { unique: false });
        store.createIndex('year', 'album.Jahr', { unique: false });
      }
    };
  });
}

async function saveEmbeddings(embeddings) {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  for (const item of embeddings) {
    await store.put(item);
  }
  
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadEmbeddings() {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**Option B: In-Memory (Einfacher, aber RAM-intensiv)**
```javascript
// vectorStore.js (In-Memory)

class InMemoryVectorStore {
  constructor() {
    this.embeddings = [];
  }
  
  add(album, embedding) {
    this.embeddings.push({
      album,
      embedding,
      index: this.embeddings.length
    });
  }
  
  getAll() {
    return this.embeddings;
  }
  
  // Für große Datenmengen: Lazy Loading
  async loadFromJSON(url) {
    const response = await fetch(url);
    const data = await response.json();
    this.embeddings = data;
  }
  
  saveToJSON() {
    return JSON.stringify(this.embeddings);
  }
}
```

### Phase 3: Ähnlichkeitssuche

```javascript
// vectorSearch.js

/**
 * Berechnet Cosine Similarity zwischen zwei Vektoren
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vektoren müssen gleiche Länge haben');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Sucht die Top-K ähnlichsten Alben zu einem Query-Embedding
 */
function findSimilarAlbums(queryEmbedding, albumEmbeddings, topK = 10) {
  const similarities = albumEmbeddings.map(item => ({
    album: item.album,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
    index: item.index
  }));
  
  // Sortiere nach Similarity (höchste zuerst)
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Filtere sehr niedrige Similarities (< 0.3)
  const filtered = similarities.filter(item => item.similarity > 0.3);
  
  return filtered.slice(0, topK);
}
```

### Phase 4: Query-Embedding & Retrieval

```javascript
// ragService.js

class RAGService {
  constructor(apiKey, vectorStore) {
    this.apiKey = apiKey;
    this.vectorStore = vectorStore;
    this.embeddingModel = 'text-embedding-ada-002'; // oder 'text-embedding-3-small'
  }
  
  /**
   * Erstellt Embedding für eine User-Query
   */
  async embedQuery(query) {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: query
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  /**
   * Sucht relevante Alben für eine Query
   */
  async retrieveRelevantAlbums(userQuery, topK = 10) {
    // 1. Query-Embedding erstellen
    const queryEmbedding = await this.embedQuery(userQuery);
    
    // 2. Alle Album-Embeddings laden
    const albumEmbeddings = await this.vectorStore.getAll();
    
    // 3. Ähnlichste Alben finden
    const similarAlbums = findSimilarAlbums(queryEmbedding, albumEmbeddings, topK);
    
    return similarAlbums.map(item => ({
      ...item.album,
      similarity: item.similarity
    }));
  }
  
  /**
   * Erweitert eine User-Query mit relevanten Albendaten
   */
  async enrichQueryWithContext(userQuery) {
    const relevantAlbums = await this.retrieveRelevantAlbums(userQuery, 15);
    
    if (relevantAlbums.length === 0) {
      return userQuery; // Keine relevanten Alben gefunden
    }
    
    // Formatiere relevante Alben als Kontext
    let context = '\n\nRELEVANTE ALBENDATEN:\n';
    relevantAlbums.forEach((album, idx) => {
      context += `${idx + 1}. ${album.Band} - "${album.Album}" (${album.Jahr || 'N/A'}): Note ${album.Note.toFixed(2)}`;
      if (album.similarity) {
        context += ` [Relevanz: ${(album.similarity * 100).toFixed(1)}%]`;
      }
      context += '\n';
    });
    
    return userQuery + context;
  }
}
```

### Phase 5: Integration in Chat

```javascript
// chat.js (angepasst)

import { RAGService } from './ragService.js';
import { InMemoryVectorStore } from './vectorStore.js';

export class Chat {
  constructor(containerEl, albumData = null, apiKey = null) {
    this.containerEl = containerEl;
    this.messages = [];
    this.isLoading = false;
    this.apiKey = apiKey;
    this.model = DEFAULT_MODEL.id;
    this.albumData = albumData;
    
    // RAG-Service initialisieren
    if (albumData && apiKey) {
      this.vectorStore = new InMemoryVectorStore();
      this.ragService = new RAGService(apiKey, this.vectorStore);
      
      // Embeddings laden oder generieren
      this.initializeEmbeddings();
    }
  }
  
  /**
   * Lädt oder generiert Embeddings für alle Alben
   */
  async initializeEmbeddings() {
    // Prüfe, ob Embeddings bereits existieren (z.B. in IndexedDB oder als JSON)
    const cachedEmbeddings = await this.loadCachedEmbeddings();
    
    if (cachedEmbeddings && cachedEmbeddings.length === this.albumData.length) {
      // Embeddings bereits vorhanden
      this.vectorStore.embeddings = cachedEmbeddings;
      console.log('Embeddings aus Cache geladen');
    } else {
      // Embeddings generieren (einmalig)
      console.log('Generiere Embeddings für alle Alben...');
      const embeddings = await generateAlbumEmbeddings(this.albumData, this.apiKey);
      this.vectorStore.embeddings = embeddings;
      
      // Cache speichern
      await this.saveCachedEmbeddings(embeddings);
      console.log('Embeddings generiert und gespeichert');
    }
  }
  
  /**
   * Sendet Nachricht mit RAG-Enrichment
   */
  async sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const userMessage = input.value.trim();
    if (!userMessage || this.isLoading) return;
    
    // User-Nachricht hinzufügen
    this.addMessage('user', userMessage);
    
    input.value = '';
    input.style.height = 'auto';
    this.setLoading(true);
    
    try {
      // RAG: Relevante Alben finden und als Kontext hinzufügen
      let enrichedQuery = userMessage;
      if (this.ragService) {
        enrichedQuery = await this.ragService.enrichQueryWithContext(userMessage);
      }
      
      // API-Aufruf mit erweitertem Kontext
      const response = await this.callOpenRouterAPI(enrichedQuery);
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('Fehler:', error);
      this.addMessage('assistant', 'Entschuldigung, es ist ein Fehler aufgetreten.');
    } finally {
      this.setLoading(false);
    }
  }
}
```

## Kosten-Analyse

### Embedding-Generation (Einmalig)
- **3.634 Alben** × **~0.0001$ pro 1K Tokens** = **~$0.36** (einmalig)
- Oder: **text-embedding-3-small**: **~$0.02** (einmalig)

### Pro Query
- **1 Query-Embedding**: **~$0.0001**
- **Vector Search**: **Kostenlos** (lokal im Browser)
- **LLM-Request**: **Unverändert**

### Gesamtkosten
- **Setup**: ~$0.36 einmalig
- **Pro Chat**: +$0.0001 pro Query (vernachlässigbar)

## Vorteile

✅ **Semantische Suche**: Findet auch ähnliche Alben (nicht nur exakte Matches)
✅ **Skalierbar**: Funktioniert auch bei sehr großen Datenmengen
✅ **Effizient**: Nur relevante Daten im Kontext
✅ **Flexibel**: Kann verschiedene Suchstrategien kombinieren

## Nachteile

⚠️ **Initiale Kosten**: Embedding-Generation einmalig nötig
⚠️ **Komplexität**: Erfordert Embedding-API
⚠️ **Latenz**: Query-Embedding benötigt API-Call (~100-200ms)
⚠️ **Exakte Matches**: Kann exakte Matches verpassen (z.B. "Taylor Swift" findet auch ähnliche Pop-Artists)

## Optimierungen

### 1. Hybrid-Suche
```javascript
// Kombiniere semantische Suche mit exakter Suche
async function hybridSearch(query, albumData) {
  // 1. Exakte Suche (Band/Album-Name)
  const exactMatches = findExactMatches(query, albumData);
  
  // 2. Semantische Suche
  const semanticMatches = await this.ragService.retrieveRelevantAlbums(query);
  
  // 3. Kombiniere und dedupliziere
  return combineResults(exactMatches, semanticMatches);
}
```

### 2. Caching
```javascript
// Cache häufig gesuchte Queries
const queryCache = new Map();

async function cachedEmbedQuery(query) {
  if (queryCache.has(query)) {
    return queryCache.get(query);
  }
  
  const embedding = await this.embedQuery(query);
  queryCache.set(query, embedding);
  return embedding;
}
```

### 3. Batch-Embedding
```javascript
// Mehrere Queries gleichzeitig embedden
async function embedMultipleQueries(queries) {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    body: JSON.stringify({
      model: this.embeddingModel,
      input: queries // Array von Queries
    })
  });
  
  return response.json();
}
```

## Implementierungs-Reihenfolge

1. **Phase 1**: Embedding-Generation Script (einmalig ausführen)
2. **Phase 2**: Vector Store (IndexedDB oder In-Memory)
3. **Phase 3**: Similarity Search implementieren
4. **Phase 4**: RAG-Service integrieren
5. **Phase 5**: In Chat-Komponente einbinden

## Alternative: Pre-computed Embeddings

Statt Embeddings zur Laufzeit zu generieren, können sie auch **vorab berechnet** werden:

```javascript
// embeddings.json (vorgefertigt)
[
  {
    "album": { "Band": "Taylor Swift", "Album": "1989", "Jahr": 2014, "Note": 3.85 },
    "embedding": [0.123, 0.456, ...], // 1536-dim Vektor
    "index": 0
  },
  ...
]

// Beim Laden der App:
await vectorStore.loadFromJSON('data/embeddings.json');
```

**Vorteil**: Keine API-Calls beim Setup, sofort verfügbar
**Nachteil**: Datei wird größer (~5-10 MB für 3.634 Alben)
