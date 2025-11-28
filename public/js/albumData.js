/**
 * Albendaten-Aufbereitung für LLM-Kontext
 */

/**
 * Erstellt eine strukturierte Zusammenfassung der Albendaten für das LLM
 */
export function prepareAlbumDataForLLM(data) {
  if (!data || data.length === 0) {
    return 'Keine Albendaten verfügbar.';
  }
  
  // Statistiken berechnen
  const bands = new Set();
  const albumsByBand = new Map();
  const albumsByYear = new Map();
  const notes = [];
  
  data.forEach(entry => {
    if (entry.Band && entry.Album && entry.Note != null) {
      bands.add(entry.Band);
      
      if (!albumsByBand.has(entry.Band)) {
        albumsByBand.set(entry.Band, []);
      }
      albumsByBand.get(entry.Band).push({
        Album: entry.Album,
        Jahr: entry.Jahr,
        Note: entry.Note
      });
      
      if (entry.Jahr) {
        if (!albumsByYear.has(entry.Jahr)) {
          albumsByYear.set(entry.Jahr, []);
        }
        albumsByYear.get(entry.Jahr).push({
          Band: entry.Band,
          Album: entry.Album,
          Note: entry.Note
        });
      }
      
      notes.push(entry.Note);
    }
  });
  
  // Statistiken berechnen
  const avgNote = notes.length > 0 
    ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2)
    : '0';
  const minNote = notes.length > 0 ? Math.min(...notes).toFixed(2) : '0';
  const maxNote = notes.length > 0 ? Math.max(...notes).toFixed(2) : '0';
  
  const yearRange = Array.from(albumsByYear.keys()).sort((a, b) => a - b);
  const minYear = yearRange.length > 0 ? yearRange[0] : null;
  const maxYear = yearRange.length > 0 ? yearRange[yearRange.length - 1] : null;
  
  // Top-Bands nach Durchschnittsnote
  const bandStats = Array.from(bands).map(band => {
    const bandAlbums = albumsByBand.get(band) || [];
    const bandNotes = bandAlbums.map(a => a.Note).filter(n => n != null);
    const avgBandNote = bandNotes.length > 0
      ? (bandNotes.reduce((a, b) => a + b, 0) / bandNotes.length).toFixed(2)
      : '0';
    return {
      Band: band,
      AnzahlAlben: bandAlbums.length,
      Durchschnittsnote: parseFloat(avgBandNote),
      BesteNote: bandNotes.length > 0 ? Math.max(...bandNotes).toFixed(2) : '0',
      SchlechtesteNote: bandNotes.length > 0 ? Math.min(...bandNotes).toFixed(2) : '0',
      Alben: bandAlbums.sort((a, b) => (b.Jahr || 0) - (a.Jahr || 0))
    };
  }).sort((a, b) => b.Durchschnittsnote - a.Durchschnittsnote);
  
  // Top-Alben nach Note
  const allAlbums = [];
  albumsByBand.forEach((albums, band) => {
    albums.forEach(album => {
      allAlbums.push({ ...album, Band: band });
    });
  });
  const topAlbums = allAlbums
    .sort((a, b) => b.Note - a.Note)
    .slice(0, 20);
  
  // Formatierung für LLM
  let dataSummary = `VERFÜGBARE ALBENDATEN:\n\n`;
  dataSummary += `Gesamtstatistik:\n`;
  dataSummary += `- Anzahl Alben: ${data.length}\n`;
  dataSummary += `- Anzahl Bands: ${bands.size}\n`;
  dataSummary += `- Jahr-Spanne: ${minYear || 'N/A'} - ${maxYear || 'N/A'}\n`;
  dataSummary += `- Durchschnittsnote: ${avgNote}\n`;
  dataSummary += `- Niedrigste Note: ${minNote}\n`;
  dataSummary += `- Höchste Note: ${maxNote}\n\n`;
  
  dataSummary += `TOP 10 BANDS (nach Durchschnittsnote):\n`;
  bandStats.slice(0, 10).forEach((stat, idx) => {
    dataSummary += `${idx + 1}. ${stat.Band}: ${stat.AnzahlAlben} Alben, Ø ${stat.Durchschnittsnote} (Beste: ${stat.BesteNote}, Schlechteste: ${stat.SchlechtesteNote})\n`;
  });
  dataSummary += `\n`;
  
  dataSummary += `TOP 20 ALBEN (nach Note):\n`;
  topAlbums.forEach((album, idx) => {
    dataSummary += `${idx + 1}. ${album.Band} - "${album.Album}" (${album.Jahr || 'N/A'}): ${album.Note.toFixed(2)}\n`;
  });
  dataSummary += `\n`;
  
  dataSummary += `ALLE BANDS MIT ALBEN:\n`;
  bandStats.forEach(stat => {
    dataSummary += `\n${stat.Band} (${stat.AnzahlAlben} Alben, Ø ${stat.Durchschnittsnote}):\n`;
    stat.Alben.forEach(album => {
      dataSummary += `  - "${album.Album}" (${album.Jahr || 'N/A'}): ${album.Note.toFixed(2)}\n`;
    });
  });
  
  return dataSummary;
}

/**
 * Erstellt eine kompakte Version für den System-Prompt
 */
export function createCompactAlbumSummary(data) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const bands = new Set();
  const albumsByBand = new Map();
  const notes = [];
  
  data.forEach(entry => {
    if (entry.Band && entry.Album && entry.Note != null) {
      bands.add(entry.Band);
      if (!albumsByBand.has(entry.Band)) {
        albumsByBand.set(entry.Band, []);
      }
      albumsByBand.get(entry.Band).push({
        Album: entry.Album,
        Jahr: entry.Jahr,
        Note: entry.Note
      });
      notes.push(entry.Note);
    }
  });
  
  const avgNote = notes.length > 0 
    ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2)
    : '0';
  
  const bandStats = Array.from(bands).map(band => {
    const bandAlbums = albumsByBand.get(band) || [];
    const bandNotes = bandAlbums.map(a => a.Note).filter(n => n != null);
    const avgBandNote = bandNotes.length > 0
      ? (bandNotes.reduce((a, b) => a + b, 0) / bandNotes.length).toFixed(2)
      : '0';
    return {
      Band: band,
      AnzahlAlben: bandAlbums.length,
      Durchschnittsnote: parseFloat(avgBandNote),
      Alben: bandAlbums.sort((a, b) => (b.Jahr || 0) - (a.Jahr || 0))
    };
  }).sort((a, b) => b.Durchschnittsnote - a.Durchschnittsnote);
  
  let summary = `\n\nVERFÜGBARE ALBENDATEN (${data.length} Alben, ${bands.size} Bands, Ø ${avgNote}):\n`;
  
  // Top 15 Bands mit ihren Alben
  bandStats.slice(0, 15).forEach(stat => {
    summary += `\n${stat.Band} (${stat.AnzahlAlben} Alben, Ø ${stat.Durchschnittsnote}): `;
    const albumList = stat.Alben.map(a => `"${a.Album}" (${a.Jahr || '?'}, ${a.Note.toFixed(2)})`).join(', ');
    summary += albumList;
  });
  
  if (bandStats.length > 15) {
    summary += `\n\n... und ${bandStats.length - 15} weitere Bands.`;
  }
  
  return summary;
}

/**
 * Sucht relevante Alben basierend auf einem Suchbegriff
 */
export function findRelevantAlbums(data, searchTerm) {
  if (!searchTerm || !data) return [];
  
  const term = searchTerm.toLowerCase();
  const results = [];
  
  data.forEach(entry => {
    if (entry.Band && entry.Album) {
      const bandMatch = entry.Band.toLowerCase().includes(term);
      const albumMatch = entry.Album.toLowerCase().includes(term);
      
      if (bandMatch || albumMatch) {
        results.push(entry);
      }
    }
  });
  
  return results.slice(0, 10); // Maximal 10 Ergebnisse
}
