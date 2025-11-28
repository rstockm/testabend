/**
 * Vector Store für Album-Embeddings
 * Unterstützt In-Memory und IndexedDB
 */

/**
 * In-Memory Vector Store
 */
export class InMemoryVectorStore {
  constructor() {
    this.embeddings = [];
    this.initialized = false;
  }
  
  /**
   * Fügt ein Embedding hinzu
   */
  add(album, embedding, index) {
    this.embeddings.push({
      album,
      embedding,
      index
    });
  }
  
  /**
   * Gibt alle Embeddings zurück
   */
  getAll() {
    return this.embeddings;
  }
  
  /**
   * Lädt Embeddings aus JSON-Datei
   */
  async loadFromJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Fehler beim Laden: ${response.status}`);
      }
      const data = await response.json();
      this.embeddings = data;
      this.initialized = true;
      return this.embeddings.length;
    } catch (error) {
      console.error('Fehler beim Laden der Embeddings:', error);
      throw error;
    }
  }
  
  /**
   * Prüft, ob Store initialisiert ist
   */
  isInitialized() {
    return this.initialized && this.embeddings.length > 0;
  }
  
  /**
   * Gibt Anzahl der Embeddings zurück
   */
  size() {
    return this.embeddings.length;
  }
}

/**
 * IndexedDB Vector Store (für persistente Speicherung)
 */
export class IndexedDBVectorStore {
  constructor(dbName = 'albumEmbeddings', storeName = 'embeddings') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.initialized = false;
  }
  
  /**
   * Initialisiert IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'index' });
          store.createIndex('band', 'album.Band', { unique: false });
          store.createIndex('year', 'album.Jahr', { unique: false });
        }
      };
    });
  }
  
  /**
   * Speichert Embeddings in IndexedDB
   */
  async saveEmbeddings(embeddings) {
    if (!this.db) {
      await this.init();
    }
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    // Lösche alte Daten
    await store.clear();
    
    // Speichere neue Daten
    for (const item of embeddings) {
      await store.put(item);
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        this.initialized = true;
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Lädt alle Embeddings aus IndexedDB
   */
  async getAll() {
    if (!this.db) {
      await this.init();
    }
    
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        this.initialized = true;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Prüft, ob Store initialisiert ist
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Gibt Anzahl der Embeddings zurück
   */
  async size() {
    const embeddings = await this.getAll();
    return embeddings.length;
  }
}
