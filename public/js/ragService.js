/**
 * RAG Service - Retrieval-Augmented Generation für Albendaten
 */
import { findSimilarAlbums, hybridSearch } from './vectorSearch.js';

export class RAGService {
  constructor(apiKey, vectorStore, albumData) {
    this.apiKey = apiKey;
    this.vectorStore = vectorStore;
    this.albumData = albumData;
    this.embeddingModel = 'text-embedding-3-small';
    this.queryCache = new Map(); // Cache für Query-Embeddings
  }
  
  /**
   * Erstellt Embedding für eine User-Query
   */
  async embedQuery(query) {
    // Prüfe Cache
    if (this.queryCache.has(query)) {
      return this.queryCache.get(query);
    }
    
    try {
      // Nutze Proxy (API-Key wird serverseitig hinzugefügt)
      const response = await fetch('api-proxy.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: query
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Embedding API Fehler: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      const embedding = data.data[0].embedding;
      
      // Cache speichern
      this.queryCache.set(query, embedding);
      
      return embedding;
    } catch (error) {
      console.error('Fehler beim Erstellen des Query-Embeddings:', error);
      throw error;
    }
  }
  
  /**
   * Sucht relevante Alben für eine Query (nur semantisch)
   */
  async retrieveRelevantAlbums(userQuery, topK = 15) {
    if (!this.vectorStore.isInitialized()) {
      console.warn('Vector Store nicht initialisiert');
      return [];
    }
    
    try {
      // Query-Embedding erstellen
      const queryEmbedding = await this.embedQuery(userQuery);
      
      // Album-Embeddings laden
      const albumEmbeddings = await this.vectorStore.getAll();
      
      // Ähnlichste Alben finden
      const similarAlbums = findSimilarAlbums(queryEmbedding, albumEmbeddings, topK, 0.3);
      
      return similarAlbums.map(item => ({
        ...item.album,
        similarity: item.similarity,
        matchType: 'semantic'
      }));
    } catch (error) {
      console.error('Fehler bei der Album-Retrieval:', error);
      return [];
    }
  }
  
  /**
   * Hybrid-Suche: Kombiniert exakte und semantische Suche
   */
  async hybridRetrieve(userQuery, topK = 15) {
    if (!this.vectorStore.isInitialized()) {
      console.warn('Vector Store nicht initialisiert');
      // Fallback: Nur exakte Suche
      return this.fallbackExactSearch(userQuery, topK);
    }
    
    try {
      // Query-Embedding erstellen
      const queryEmbedding = await this.embedQuery(userQuery);
      
      // Album-Embeddings laden
      const albumEmbeddings = await this.vectorStore.getAll();
      
      // Hybrid-Suche
      const results = hybridSearch(userQuery, queryEmbedding, albumEmbeddings, this.albumData, topK);
      
      return results.map(item => ({
        ...item.album,
        similarity: item.similarity,
        matchType: item.matchType
      }));
    } catch (error) {
      console.error('Fehler bei der Hybrid-Retrieval:', error);
      // Fallback: Nur exakte Suche
      return this.fallbackExactSearch(userQuery, topK);
    }
  }
  
  /**
   * Fallback: Exakte Suche ohne Embeddings
   */
  fallbackExactSearch(query, topK = 15) {
    const queryLower = query.toLowerCase();
    const results = [];
    
    this.albumData.forEach(album => {
      const bandMatch = album.Band && album.Band.toLowerCase().includes(queryLower);
      const albumMatch = album.Album && album.Album.toLowerCase().includes(queryLower);
      
      if (bandMatch || albumMatch) {
        results.push({
          ...album,
          similarity: 1.0,
          matchType: 'exact'
        });
      }
    });
    
    return results.slice(0, topK);
  }
  
  /**
   * Erweitert eine User-Query mit relevanten Albendaten als Kontext
   */
  async enrichQueryWithContext(userQuery, topK = 15, useHybrid = true) {
    let relevantAlbums;
    
    console.log('RAG: Starte Suche für Query:', userQuery);
    
    // Prüfe ob eine spezifische Band erwähnt wird
    const mentionedBands = this.findMentionedBands(userQuery);
    
    if (useHybrid) {
      relevantAlbums = await this.hybridRetrieve(userQuery, topK);
    } else {
      relevantAlbums = await this.retrieveRelevantAlbums(userQuery, topK);
    }
    
    // Wenn eine Band explizit erwähnt wird, füge ALLE Alben dieser Band hinzu
    if (mentionedBands.length > 0) {
      console.log('RAG: Band(en) explizit erwähnt:', mentionedBands);
      
      const seenAlbums = new Set();
      // Füge bereits gefundene Alben zu Set hinzu (für Duplikat-Prüfung)
      relevantAlbums.forEach(album => {
        const key = `${album.Band}|${album.Album}|${album.Jahr}`;
        seenAlbums.add(key);
      });
      
      // Für jede erwähnte Band: Füge ALLE Alben hinzu
      mentionedBands.forEach(bandName => {
        const allBandAlbums = this.albumData.filter(album => 
          album.Band && album.Band.toLowerCase() === bandName.toLowerCase()
        );
        
        allBandAlbums.forEach(album => {
          const key = `${album.Band}|${album.Album}|${album.Jahr}`;
          if (!seenAlbums.has(key)) {
            relevantAlbums.push({
              ...album,
              similarity: 1.0, // Explizite Band-Matches bekommen höchste Priorität
              matchType: 'band-explicit'
            });
            seenAlbums.add(key);
          }
        });
      });
      
      console.log('RAG: Nach Hinzufügen aller Band-Alben:', relevantAlbums.length);
    }
    
    console.log('RAG: Gefundene relevante Alben:', relevantAlbums.length);
    
    if (relevantAlbums.length === 0) {
      console.warn('RAG: Keine relevanten Alben gefunden');
      return userQuery; // Keine relevanten Alben gefunden
    }
    
    // Formatiere relevante Alben als Kontext - Tabellenformat mit strikten Validierungsanweisungen
    let context = '\n\n';
    context += '⚠️⚠️⚠️ KRITISCH WICHTIG: EXAKTE DATEN - VERWENDE GENAU DIESE ZAHLEN ⚠️⚠️⚠️\n\n';
    context += 'VERBOTEN: Zahlen erfinden, schätzen oder ändern!\n';
    context += 'ERLAUBT: Nur die exakten Zahlen aus der Tabelle verwenden!\n\n';
    
    // Sortiere nach Jahr für chronologische Reihenfolge
    const sortedAlbums = [...relevantAlbums].sort((a, b) => (a.Jahr || 0) - (b.Jahr || 0));
    
    // Tabellenformat erstellen
    context += '| Band | Album | Jahr | Platz | Note |\n';
    context += '|------|-------|------|-------|------|\n';
    
    sortedAlbums.forEach((album) => {
      const band = album.Band || 'N/A';
      const albumName = album.Album || 'N/A';
      const year = album.Jahr || 'N/A';
      const note = album.Note;
      const platz = typeof album.Platz === 'number' ? album.Platz : 'N/A';
      // Verwende === für noch stärkere Hervorhebung der Zahlen
      context += `| ${band} | "${albumName}" | ${year} | ${platz} | ===${note}=== |\n`;
    });
    
    context += '\n';
    
    // Redundante Hervorhebung: Liste alle Noten nochmal explizit auf
    context += '🚨🚨🚨 EXAKTE NOTEN - MUSS VERWENDET WERDEN 🚨🚨🚨\n';
    sortedAlbums.forEach((album) => {
      const note = album.Note;
      const platz = typeof album.Platz === 'number' ? album.Platz : 'N/A';
      context += `  🚨 "${album.Album}" von ${album.Band} (${album.Jahr || 'N/A'}): Platz ${platz}, ===${note}=== 🚨\n`;
      context += `     WICHTIG: Wenn du über "${album.Album}" sprichst, sind Platz ${platz} und die Note ${note} verbindlich!\n`;
    });
    
    context += '\n';
    
    // Beispielpaare für richtige/falsche Verwendung - mit mehreren Beispielen
    if (sortedAlbums.length > 0) {
      const firstAlbum = sortedAlbums[0];
      const exampleNote = firstAlbum.Note;
      const wrongNote1 = firstAlbum.Note + 0.3;
      const wrongNote2 = firstAlbum.Note - 0.2;
      const wrongNote3 = firstAlbum.Note + 0.5;
      
      context += '📋 BEISPIEL FÜR KORREKTE VERWENDUNG:\n';
      context += `❌ FALSCH: "${firstAlbum.Album}" erreichte eine ${wrongNote1}\n`;
      context += `❌ FALSCH: "${firstAlbum.Album}" erreichte eine ${wrongNote2}\n`;
      context += `❌ FALSCH: "${firstAlbum.Album}" erreichte eine ${wrongNote3}\n`;
      context += `✅ RICHTIG: "${firstAlbum.Album}" erreichte Platz ${typeof firstAlbum.Platz === 'number' ? firstAlbum.Platz : 'N/A'} mit Note ${exampleNote} (GENAU diese Werte aus der Tabelle!)\n\n`;
      
      // Wenn mehrere Alben vorhanden, zeige auch ein Beispiel mit dem letzten Album
      if (sortedAlbums.length > 1) {
        const lastAlbum = sortedAlbums[sortedAlbums.length - 1];
        const lastNote = lastAlbum.Note;
        const wrongLastNote = lastAlbum.Note + 0.3;
        context += `📋 WEITERES BEISPIEL:\n`;
        context += `❌ FALSCH: "${lastAlbum.Album}" erreichte eine ${wrongLastNote}\n`;
        context += `✅ RICHTIG: "${lastAlbum.Album}" erreichte Platz ${typeof lastAlbum.Platz === 'number' ? lastAlbum.Platz : 'N/A'} mit Note ${lastNote} (GENAU diese Werte aus der Tabelle!)\n\n`;
      }
    }
    
    // Füge Vergleichshinweis hinzu, wenn mehrere Alben vorhanden
    if (sortedAlbums.length > 1) {
      const notes = sortedAlbums.map(a => a.Note);
      const minNote = Math.min(...notes);
      const maxNote = Math.max(...notes);
      const firstYear = sortedAlbums[0].Jahr;
      const lastYear = sortedAlbums[sortedAlbums.length - 1].Jahr;
      
      if (lastYear > firstYear) {
        context += `📈 ENTWICKLUNG (EXAKTE ZAHLEN): Von ${firstYear} bis ${lastYear}: `;
        if (maxNote > minNote + 0.1) {
          context += `Die Noten steigen von **${minNote}** auf **${maxNote}** - das ist eine VERBESSERUNG!\n`;
        } else if (minNote > maxNote + 0.1) {
          context += `Die Noten sinken von **${maxNote}** auf **${minNote}** - das ist ein Verlust.\n`;
        } else {
          context += `Die Noten bleiben relativ stabil (**${minNote}** - **${maxNote}**).\n`;
        }
        context += '\n';
      }
    }
    
    context += '⚠️⚠️⚠️ ENDE DER KRITISCHEN DATEN ⚠️⚠️⚠️\n';
    context += '\n';
    context += '🚨🚨🚨 ABSOLUT KRITISCH - KEINE AUSNAHMEN 🚨🚨🚨\n\n';
    context += 'Diese Daten sind FAKTISCH aus der Datenbank.\n\n';
    context += 'DU MUSST DIE EXAKTEN NOTEN AUS DER TABELLE VERWENDEN!\n\n';
    context += 'VERBOTEN:\n';
    context += '- Zahlen erfinden, schätzen oder ändern\n';
    context += '- Andere Zahlen als die in der Tabelle verwenden\n';
    context += '- Zu sagen, dass du keine Daten hast (die Daten sind dir gegeben!)\n';
    context += '- Zahlen zu "runden" oder zu "korrigieren"\n';
    context += '- Zahlen aus dem Gedächtnis zu verwenden\n';
    context += '- Alben zu erwähnen, die NICHT in der Tabelle stehen\n';
    context += '- Wenn eine Band nur EIN Album in der Tabelle hat, dann existiert nur dieses eine Album!\n\n';
    context += 'ERLAUBT:\n';
    context += '- NUR die exakten Noten aus der Tabelle verwenden\n';
    context += '- Die Zahlen GENAU so wiedergeben wie sie in der Tabelle stehen\n';
    context += '- Wenn ein Album in der Tabelle steht, MUSST du die Note aus der Tabelle verwenden\n';
    context += '- NUR über Alben sprechen, die tatsächlich in der Tabelle stehen\n\n';
    context += 'BEISPIEL:\n';
    if (sortedAlbums.length > 0) {
      const exampleAlbum = sortedAlbums[0];
      const correctNote = exampleAlbum.Note;
      const correctPlatz = typeof exampleAlbum.Platz === 'number' ? exampleAlbum.Platz : 'N/A';
      context += `Wenn "${exampleAlbum.Album}" von ${exampleAlbum.Band} in der Tabelle steht mit Platz ${correctPlatz} und Note ${correctNote},\n`;
      context += `dann sind Platz ${correctPlatz} und Note ${correctNote} verbindlich – KEINE anderen Plätze, KEINE anderen Noten!\n\n`;
      
      // Wenn nur ein Album vorhanden, betone das besonders
      if (sortedAlbums.length === 1) {
        context += `🚨 WICHTIG: ${exampleAlbum.Band} hat NUR EIN Album in der Datenbank: "${exampleAlbum.Album}"!\n`;
        context += `Es gibt KEINE anderen Alben von ${exampleAlbum.Band} in der Datenbank!\n`;
        context += `Wenn du über ${exampleAlbum.Band} sprichst, erwähne NUR dieses eine Album!\n\n`;
      }
    }
    context += 'Wenn du über diese Alben sprichst, verwende GENAU die Zahlen aus der Tabelle oben.\n';
    context += 'Es gibt KEINE Ausnahmen. Die Zahlen in der Tabelle sind die EINZIGEN korrekten Zahlen.\n';
    context += 'Wenn ein Album NICHT in der Tabelle steht, dann existiert es NICHT in der Datenbank!\n';
    
    const enriched = userQuery + context;
    console.log('RAG: Kontext hinzugefügt, Gesamtlänge:', enriched.length);
    console.log('RAG: Anzahl Alben:', relevantAlbums.length);
    console.log('RAG: Erste 3 Alben:', relevantAlbums.slice(0, 3).map(a => `${a.Band} - ${a.Album}: ${a.Note}`));
    
    return enriched;
  }
  
  /**
   * Findet erwähnte Bands im Query-Text
   */
  findMentionedBands(query) {
    if (!query || !this.albumData || this.albumData.length === 0) {
      return [];
    }
    
    const mentionedBands = [];
    const queryLower = query.toLowerCase();
    
    // Erstelle Set aller verfügbaren Bands
    const availableBands = new Set();
    this.albumData.forEach(album => {
      if (album.Band) {
        availableBands.add(album.Band.toLowerCase());
      }
    });
    
    // Prüfe jeden verfügbaren Bandnamen
    for (const bandLower of availableBands) {
      // Suche nach dem Bandnamen im Text (case-insensitive, mit Word-Boundaries)
      const regex = new RegExp(`\\b${this.escapeRegex(bandLower)}\\b`, 'i');
      if (regex.test(queryLower)) {
        // Finde den originalen Bandnamen (mit korrekter Groß-/Kleinschreibung)
        const originalBand = this.albumData.find(a => 
          a.Band && a.Band.toLowerCase() === bandLower
        )?.Band;
        
        if (originalBand && !mentionedBands.includes(originalBand)) {
          mentionedBands.push(originalBand);
        }
      }
    }
    
    return mentionedBands;
  }
  
  /**
   * Regex-Sonderzeichen escapen
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Gibt Status-Informationen zurück
   */
  getStatus() {
    return {
      initialized: this.vectorStore.isInitialized(),
      embeddingsCount: this.vectorStore.size(),
      cacheSize: this.queryCache.size()
    };
  }
}
