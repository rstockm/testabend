/**
 * Chat-Konfiguration für OpenRouter
 */

/**
 * Empfohlene Modelle für verschiedene Anwendungsfälle
 */
export const RECOMMENDED_MODELS = {
  // Bestes Modell: Höchste Präzision für RAG-Daten
  // Claude 3 Opus ist das präziseste verfügbare Modell von Anthropic über OpenRouter
  // Sehr gut darin, strukturierte Daten exakt zu verwenden
  ULTRA: {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Höchste Präzision, beste RAG-Datenverarbeitung, sehr präzise mit strukturierten Daten',
    provider: 'Anthropic',
    contextWindow: 200000,
    // Geschätzte Kosten: ~$15/M input, ~$75/M output tokens
    costLevel: 'ultra'
  },
  
  // Beste Balance: Preis-Leistung für anspruchsvolle Unterhaltung
  // GPT-5.1 bietet ausgezeichnete Qualität für anspruchsvolle Gespräche
  // und versteht Popkultur sehr gut.
  PREMIUM: {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    description: 'Beste Qualität für anspruchsvolle Unterhaltung, ausgezeichnetes Popkultur-Verständnis',
    provider: 'OpenAI',
    contextWindow: 200000,
    // Geschätzte Kosten: Variiert je nach Modell
    costLevel: 'premium'
  },
  
  // Gute Balance: Sehr gute Qualität zu moderaten Preisen
  // Mixtral 8x22B bietet hervorragende Leistung für den Preis
  BALANCED: {
    id: 'mistralai/mixtral-8x22b-instruct',
    name: 'Mixtral 8x22B',
    description: 'Ausgezeichnete Balance zwischen Preis und Leistung, sehr gut für Unterhaltung',
    provider: 'Mistral AI',
    contextWindow: 65536,
    // Geschätzte Kosten: ~$0.5-1/M tokens (günstiger als Claude)
    costLevel: 'balanced'
  },
  
  // Budget-Option: Gute Qualität zu niedrigem Preis
  // Llama 3.1 70B ist kostenlos oder sehr günstig und bietet solide Leistung
  BUDGET: {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    description: 'Sehr günstig, gute Qualität für Unterhaltung und Popkultur',
    provider: 'Meta',
    contextWindow: 128000,
    // Geschätzte Kosten: ~$0.1-0.5/M tokens oder kostenlos
    costLevel: 'budget'
  },
  
  // Gemini 2.5 Flash: Schnelles, effizientes Modell für Validierung
  GEMINI: {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Schnelles, effizientes Modell von Google, gut für Validierung',
    provider: 'Google',
    contextWindow: 1000000,
    // Geschätzte Kosten: Sehr günstig, ähnlich wie Flash-Modelle
    costLevel: 'balanced'
  }
};

/**
 * Standard-Modell für den Chat:
 * Schnellere, günstigere Option (z.B. für den ersten Antwortschritt)
 */
export const DEFAULT_MODEL = RECOMMENDED_MODELS.BALANCED;

/**
 * Validierungs-Modell:
 * Teureres, präziseres Modell für den zweiten Kontrollschritt
 */
export const VALIDATION_MODEL = RECOMMENDED_MODELS.GEMINI;

/**
 * System-Prompt für den Chatbot
 * Wird aus der Markdown-Datei geladen
 */
let SYSTEM_PROMPT_CACHE = null;

/**
 * System-Prompt laden
 * RAG fügt Album-Daten dynamisch hinzu, daher keine statische Zusammenfassung mehr nötig
 */
export async function loadSystemPrompt() {
  // Lade Markdown-Prompt nur einmal
  if (!SYSTEM_PROMPT_CACHE) {
    try {
      const response = await fetch('prompts/system-prompt.md');
      if (!response.ok) {
        throw new Error('System-Prompt konnte nicht geladen werden');
      }
      const markdown = await response.text();
      // Entferne Markdown-Formatierung für den Prompt
      SYSTEM_PROMPT_CACHE = markdown
        .split('\n')
        .map(line => {
          // Überschriften entfernen
          if (line.match(/^#+\s/)) return '';
          // Fett-Formatierung entfernen, aber Text behalten
          line = line.replace(/\*\*(.*?)\*\*/g, '$1');
          // Listen-Markierungen entfernen, aber Text behalten
          line = line.replace(/^-\s+/, '');
          return line.trim();
        })
        .filter(line => line.length > 0) // Leere Zeilen entfernen
        .join('\n')
        .replace(/\n{3,}/g, '\n\n') // Mehrfache Leerzeilen reduzieren
        .trim();
    } catch (error) {
      console.error('Fehler beim Laden des System-Prompts:', error);
      // Fallback-Prompt
      SYSTEM_PROMPT_CACHE = 'Du bist ein hilfreicher, freundlicher und intellektuell anspruchsvoller Assistent. Antworte immer auf Deutsch, sei hilfreich und respektvoll.';
    }
  }
  
  return SYSTEM_PROMPT_CACHE;
}

/**
 * System-Prompt (für synchrone Verwendung - lädt Fallback)
 */
export const SYSTEM_PROMPT = 'Du bist ein hilfreicher, freundlicher und intellektuell anspruchsvoller Assistent im Testteam-Bereich. Antworte immer auf Deutsch, sei hilfreich und respektvoll.';

/**
 * OpenRouter API Konfiguration
 */
export const OPENROUTER_CONFIG = {
  // Proxy-Endpoint (API-Key wird serverseitig hinzugefügt)
  proxyEndpoint: 'api-proxy.php',
  
  // Legacy: Direkter OpenRouter-Zugriff (falls Proxy nicht verfügbar)
  baseURL: 'https://openrouter.ai/api/v1',
  chatEndpoint: '/chat/completions',
  
  // Standard-Headers (werden nicht mehr für Authorization genutzt)
  headers: {
    'Content-Type': 'application/json'
  },
  
  // Request-Konfiguration
  requestConfig: {
    temperature: 0.7, // Balance zwischen Kreativität und Konsistenz
    max_tokens: 2000, // Maximale Antwortlänge
    top_p: 0.9,
    frequency_penalty: 0.1,
    presence_penalty: 0.1
  }
};
