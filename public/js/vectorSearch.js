/**
 * Vector Search - Ähnlichkeitssuche mit Cosine Similarity
 */

/**
 * Berechnet Cosine Similarity zwischen zwei Vektoren
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vektoren müssen gleiche Länge haben: ${vecA.length} vs ${vecB.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }
  
  return dotProduct / denominator;
}

/**
 * Sucht die Top-K ähnlichsten Alben zu einem Query-Embedding
 */
export function findSimilarAlbums(queryEmbedding, albumEmbeddings, topK = 10, minSimilarity = 0.3) {
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.warn('Ungültiges Query-Embedding');
    return [];
  }
  
  if (!albumEmbeddings || albumEmbeddings.length === 0) {
    console.warn('Keine Album-Embeddings verfügbar');
    return [];
  }
  
  // Berechne Similarity für alle Alben
  const similarities = albumEmbeddings.map(item => {
    try {
      const similarity = cosineSimilarity(queryEmbedding, item.embedding);
      return {
        album: item.album,
        similarity: similarity,
        index: item.index
      };
    } catch (error) {
      console.warn('Fehler bei Similarity-Berechnung:', error);
      return null;
    }
  }).filter(item => item !== null);
  
  // Sortiere nach Similarity (höchste zuerst)
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Filtere sehr niedrige Similarities
  const filtered = similarities.filter(item => item.similarity >= minSimilarity);
  
  // Top-K zurückgeben
  return filtered.slice(0, topK);
}

/**
 * Kombiniert exakte Suche mit semantischer Suche
 */
export function hybridSearch(query, queryEmbedding, albumEmbeddings, albumData, topK = 15) {
  const results = [];
  const seenIndices = new Set();
  
  // 1. Exakte Suche (Band/Album-Name)
  const queryLower = query.toLowerCase();
  albumData.forEach((album, idx) => {
    const bandMatch = album.Band && album.Band.toLowerCase().includes(queryLower);
    const albumMatch = album.Album && album.Album.toLowerCase().includes(queryLower);
    
    if (bandMatch || albumMatch) {
      results.push({
        album: album,
        similarity: 1.0, // Exakte Matches bekommen höchste Similarity
        index: idx,
        matchType: 'exact'
      });
      seenIndices.add(idx);
    }
  });
  
  // 2. Semantische Suche (nur für nicht-exakte Matches)
  if (queryEmbedding && albumEmbeddings) {
    const semanticResults = findSimilarAlbums(queryEmbedding, albumEmbeddings, topK * 2, 0.4);
    
    semanticResults.forEach(item => {
      if (!seenIndices.has(item.index)) {
        results.push({
          ...item,
          matchType: 'semantic'
        });
        seenIndices.add(item.index);
      }
    });
  }
  
  // Sortiere: Exakte Matches zuerst, dann nach Similarity
  results.sort((a, b) => {
    if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
    if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
    return b.similarity - a.similarity;
  });
  
  return results.slice(0, topK);
}
