/**
 * Chat-Komponente
 */
import { VALIDATION_MODEL, loadSystemPrompt, OPENROUTER_CONFIG } from './chatConfig.js';
import { InMemoryVectorStore } from './vectorStore.js';
import { RAGService } from './ragService.js';

// Schnelles, leichtgewichtiges Modell für Schritt 1 (Generierung + Begrüßung)
const GENERATION_MODEL_ID = 'meta-llama/llama-3.1-8b-instruct';

export class Chat {
  constructor(containerEl, albumData = null, apiKey = null) {
    this.containerEl = containerEl;
    this.messages = [];
    this.isLoading = false;
    this.apiKey = apiKey;
    // Verwende für den ersten Antwortschritt explizit das schnelle Llama-3.1-8B-Modell
    this.model = GENERATION_MODEL_ID;
    console.log('Chat: Modell initialisiert:', this.model);
    this.albumData = albumData;
    this.vectorStore = null;
    this.ragService = null;
    this.embeddingsLoaded = false;
    
    // Verfügbare Bands aus albumData extrahieren
    this.availableBands = new Set();
    if (albumData && albumData.length > 0) {
      albumData.forEach(entry => {
        if (entry.Band) {
          this.availableBands.add(entry.Band);
        }
      });
    }
    
    // Stoppwortliste initialisieren
    this.stopwords = new Set();
    this.loadStopwords();
    
    // Chatverlauf aus localStorage laden
    this.loadMessagesFromStorage();
    
    // RAG initialisieren, falls Daten vorhanden
    // API-Key wird serverseitig vom Proxy verwendet
    if (albumData && albumData.length > 0) {
      this.initializeRAG(null); // Key wird nicht mehr benötigt
    }
  }
  
  /**
   * Stoppwortliste laden
   */
  async loadStopwords() {
    try {
      const response = await fetch('data/stopwords.txt');
      if (response.ok) {
        const text = await response.text();
        const words = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));
        
        this.stopwords = new Set(words.map(word => word.toLowerCase()));
        console.log(`Stoppwortliste geladen: ${this.stopwords.size} Einträge`);
      }
    } catch (error) {
      console.warn('Fehler beim Laden der Stoppwortliste:', error);
      this.stopwords = new Set();
    }
  }
  
  /**
   * Chatverlauf aus localStorage laden
   */
  loadMessagesFromStorage() {
    try {
      const stored = localStorage.getItem('chat-messages');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Prüfe ob es ein Array ist und Nachrichten enthält
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Konvertiere Timestamps zurück zu Date-Objekten
          this.messages = parsed.map(msg => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
          console.log(`Chatverlauf geladen: ${this.messages.length} Nachrichten`);
        }
      }
    } catch (error) {
      console.warn('Fehler beim Laden des Chatverlaufs:', error);
      this.messages = [];
    }
  }
  
  /**
   * Chatverlauf in localStorage speichern
   */
  saveMessagesToStorage() {
    try {
      // Speichere nur die Nachrichten (ohne komplexe Objekte)
      const messagesToSave = this.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? msg.timestamp.toISOString() : new Date().toISOString()
      }));
      localStorage.setItem('chat-messages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.warn('Fehler beim Speichern des Chatverlaufs:', error);
    }
  }
  
  /**
   * Initialisiert RAG-Service und lädt Embeddings
   */
  async initializeRAG(apiKey) {
    try {
      // API-Key wird nicht mehr benötigt (Proxy verwendet serverseitigen Key)
      this.apiKey = null; // Legacy-Support, wird nicht mehr verwendet
      
      // Vector Store erstellen
      this.vectorStore = new InMemoryVectorStore();
      
      // RAG Service erstellen (API-Key wird nicht mehr benötigt)
      this.ragService = new RAGService(null, this.vectorStore, this.albumData);
      
      // Embeddings aus JSON-Datei laden
      console.log('Lade Album-Embeddings...');
      const count = await this.vectorStore.loadFromJSON('data/embeddings.json');
      console.log(`✅ ${count} Embeddings geladen`);
      
      this.embeddingsLoaded = true;
    } catch (error) {
      console.error('Fehler beim Initialisieren von RAG:', error);
      console.warn('RAG wird deaktiviert, Chat funktioniert ohne semantische Suche');
      this.ragService = null;
      this.embeddingsLoaded = false;
    }
  }
  
  /**
   * Chat-UI rendern
   */
  render() {
    this.containerEl.innerHTML = '';
    // Container sollte chat-page Klasse haben
    if (!this.containerEl.classList.contains('chat-page')) {
      this.containerEl.className = 'chat-page';
    }
    
    // Messages Container (scrollbarer Bereich)
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'chat-messages-container';
    
    // Innerer Messages-Bereich
    const messagesArea = document.createElement('div');
    messagesArea.className = 'chat-messages';
    messagesArea.id = 'chat-messages';
    
    messagesContainer.appendChild(messagesArea);
    
    // Input Container (fixed am unteren Rand)
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chat-input-container';
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'chat-input-wrapper';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'chat-input';
    textarea.className = 'chat-input';
    textarea.placeholder = 'Nachricht eingeben...';
    textarea.rows = 1;
    textarea.setAttribute('maxlength', '4000');
    
    // Auto-Resize für Textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    
    // Enter zum Senden (Shift+Enter für neue Zeile)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    const sendButton = document.createElement('button');
    sendButton.id = 'chat-send-button';
    sendButton.className = 'chat-send-button';
    sendButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    sendButton.setAttribute('aria-label', 'Nachricht senden');
    sendButton.addEventListener('click', () => this.sendMessage());
    
    const resetButton = document.createElement('button');
    resetButton.id = 'chat-reset-button';
    resetButton.className = 'chat-reset-button';
    resetButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';
    resetButton.setAttribute('aria-label', 'Chat zurücksetzen');
    resetButton.setAttribute('title', 'Chat zurücksetzen');
    resetButton.addEventListener('click', () => {
      if (confirm('Möchtest du den Chat wirklich zurücksetzen? Der gesamte Verlauf wird gelöscht.')) {
        this.clear();
      }
    });
    
    inputWrapper.appendChild(textarea);
    inputWrapper.appendChild(resetButton);
    inputWrapper.appendChild(sendButton);
    inputContainer.appendChild(inputWrapper);
    
    // Struktur: chat-page > chat-messages-container (scrollbar) + chat-input-container (fixed)
    this.containerEl.appendChild(messagesContainer);
    this.containerEl.appendChild(inputContainer);
    
    // Willkommensnachricht nur hinzufügen, wenn noch keine Nachrichten vorhanden sind
    // Oder wenn nur eine Begrüßungsnachricht vorhanden ist (beim Neuladen)
    if (this.messages.length === 0) {
      this.generateWelcomeMessage();
    } else if (this.messages.length === 1 && this.messages[0].role === 'assistant') {
      // Nur eine Assistant-Nachricht = wahrscheinlich alte Begrüßung, neu generieren
      this.messages = [];
      this.saveMessagesToStorage();
      this.generateWelcomeMessage();
    } else {
      // Nachrichten rendern, wenn bereits welche vorhanden sind
      this.renderMessages();
    }
    
    // Focus auf Input
    textarea.focus();
    
    // Keyboard-Handling für Mobile
    this.setupKeyboardHandling();
    
    // Initialer Scroll nach unten
    setTimeout(() => this.scrollToBottom(), 100);
  }
  
  /**
   * Keyboard-Handling für Mobile
   */
  setupKeyboardHandling() {
    const textarea = document.getElementById('chat-input');
    if (!textarea) return;
    
    // iOS Safari: Verhindere Viewport-Resize beim Keyboard
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      // Speichere original content
      const originalContent = viewport.content;
      
      textarea.addEventListener('focus', () => {
        // Verhindere Auto-Zoom auf iOS
        viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
        // Scroll zum Ende wenn Keyboard öffnet
        setTimeout(() => this.scrollToBottom(true), 300);
      });
      
      textarea.addEventListener('blur', () => {
        // Stelle original zurück
        viewport.content = originalContent;
      });
    }
  }
  
  /**
   * LLM-generierte Begrüßungsnachricht erstellen
   */
  async generateWelcomeMessage() {
    // Zeige Loading-Indikator
    this.setLoading(true);
    
    try {
      const baseWelcome = 'Willkommen beim EU-Testteam. Ein Besuch lohnt sich ja immer, wo können wir denn helfen?';
      
      // Erstelle eine einfache LLM-Anfrage für eine Variation
      const prompt = `Erstelle eine freundliche, natürliche Variation des folgenden Begrüßungstextes. Die Variation soll den gleichen Inhalt und Ton haben, aber anders formuliert sein. Antworte NUR mit der Variation, ohne zusätzliche Erklärungen.\n\nOriginal: "${baseWelcome}"`;
      
      const response = await this.callOpenRouterAPIForWelcome(prompt);
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('Fehler beim Generieren der Begrüßung:', error);
      // Fallback zur Originalnachricht
      this.addMessage('assistant', 'Willkommen beim EU-Testteam. Ein Besuch lohnt sich ja immer, wo können wir denn helfen?');
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * OpenRouter API für Begrüßungsnachricht aufrufen (ohne RAG)
   */
  async callOpenRouterAPIForWelcome(prompt) {
    // System-Prompt laden
    // API-Key wird serverseitig vom Proxy verwendet
    const systemPrompt = await loadSystemPrompt();
    
    // Einfache Nachrichten-Struktur für Begrüßung
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    // Begrüßung: explizit schnelles Llama-3.1-8B-Modell verwenden
    const welcomeModel = GENERATION_MODEL_ID;
    console.log('API: Verwende Begrüßungsmodell (Schritt 1):', welcomeModel);
    
    const requestBody = {
      model: welcomeModel,
      messages: apiMessages,
      ...OPENROUTER_CONFIG.requestConfig
    };
    
    // Nutze Proxy (API-Key wird serverseitig hinzugefügt)
    const response = await fetch(OPENROUTER_CONFIG.proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Fehler: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Ungültige API-Antwort');
    }
    
    return data.choices[0].message.content.trim();
  }
  
  /**
   * Nachricht hinzufügen
   */
  addMessage(role, content) {
    this.messages.push({ role, content, timestamp: new Date() });
    this.saveMessagesToStorage();
    this.renderMessages();
  }
  
  /**
   * Normalisiert einen String: entfernt Akzente und konvertiert zu lowercase
   * Beispiel: "Beyoncé" -> "beyonce", "Café" -> "cafe"
   */
  normalizeString(str) {
    return str
      .toLowerCase()
      .normalize('NFD') // Zerlegt Akzente (é -> e + ́)
      .replace(/[\u0300-\u036f]/g, ''); // Entfernt Diakritika
  }
  
  /**
   * Bandnamen aus Text extrahieren
   */
  extractMentionedBands(text) {
    if (!text || !this.availableBands || this.availableBands.size === 0) {
      return [];
    }
    
    const mentionedBands = [];
    const textNormalized = this.normalizeString(text);
    
    // Prüfe jeden verfügbaren Bandnamen
    for (const band of this.availableBands) {
      const bandNormalized = this.normalizeString(band);
      
      // Überspringe Bands aus der Stoppwortliste
      if (this.stopwords && this.stopwords.has(bandNormalized)) {
        continue;
      }
      
      // Suche nach dem Bandnamen im Text (case-insensitive, akzent-agnostisch)
      // Verhindere Teilstring-Matches (z.B. "The" sollte nicht "The Beatles" matchen)
      const regex = new RegExp(`\\b${this.escapeRegex(bandNormalized)}\\b`, 'i');
      if (regex.test(textNormalized)) {
        mentionedBands.push(band);
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
   * URL für Zeitreihe Band-Ansicht erstellen
   */
  buildBandTimeSeriesURL(bands) {
    if (!bands || bands.length === 0) return null;
    
    // URL-encode Bandnamen
    const encodedBands = bands.map(band => encodeURIComponent(band)).join(',');
    return `#band?b=${encodedBands}`;
  }
  
  /**
   * Nachrichten rendern
   */
  renderMessages() {
    const messagesArea = document.getElementById('chat-messages');
    if (!messagesArea) return;
    
    messagesArea.innerHTML = '';
    
    this.messages.forEach((msg) => {
      const messageEl = document.createElement('div');
      messageEl.className = `chat-message chat-message-${msg.role}`;
      
      const contentEl = document.createElement('div');
      contentEl.className = 'chat-message-content';
      
      // Text-Inhalt setzen
      const textNode = document.createTextNode(msg.content);
      contentEl.appendChild(textNode);
      
      // Links nur für Assistant-Nachrichten hinzufügen
      if (msg.role === 'assistant') {
        const mentionedBands = this.extractMentionedBands(msg.content);
        
        // Links hinzufügen, wenn Bands gefunden wurden
        if (mentionedBands.length > 0) {
        const linkContainer = document.createElement('div');
        linkContainer.style.marginTop = '12px';
        linkContainer.style.paddingTop = '12px';
        linkContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
        
        const linkLabel = document.createTextNode('Zeitreihe: ');
        linkContainer.appendChild(linkLabel);
        
        // Erstelle einen Link mit allen erwähnten Bands
        const link = document.createElement('a');
        link.href = this.buildBandTimeSeriesURL(mentionedBands);
        link.textContent = mentionedBands.join(', ');
        link.style.color = 'var(--accent-blue)';
        link.style.textDecoration = 'none';
        link.style.marginLeft = '4px';
        link.style.cursor = 'pointer';
        
        link.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = link.getAttribute('href').substring(1);
        });
        
          linkContainer.appendChild(link);
          contentEl.appendChild(linkContainer);
        }
      }
      
    messageEl.appendChild(contentEl);
    messagesArea.appendChild(messageEl);
    });
    
    // Scroll nach unten - mit kleinen Delay für Rendering
    this.scrollToBottom();
  }
  
  /**
   * Scroll zum Ende der Nachrichten
   */
  scrollToBottom(smooth = false) {
    const messagesContainer = this.containerEl.querySelector('.chat-messages-container');
    if (!messagesContainer) return;
    
    // Verwende requestAnimationFrame für zuverlässiges Scrollen
    requestAnimationFrame(() => {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
  }
  
  /**
   * Nachricht senden
   */
  async sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message || this.isLoading) return;
    
    // User-Nachricht hinzufügen
    this.addMessage('user', message);
    
    // Input leeren und zurücksetzen
    input.value = '';
    input.style.height = 'auto';
    
    // Loading-Indikator
    this.setLoading(true);
    
    try {
      // RAG: Relevante Alben finden und als Kontext hinzufügen
      let enrichedQuery = message;
      if (this.ragService && this.embeddingsLoaded) {
        try {
          enrichedQuery = await this.ragService.enrichQueryWithContext(message, 15, true);
          console.log('RAG: Query mit Kontext erweitert');
          console.log('RAG: Erweiterte Query (erste 500 Zeichen):', enrichedQuery.substring(0, 500));
        } catch (ragError) {
          console.warn('RAG-Fehler, verwende originale Query:', ragError);
          // Fallback: Verwende originale Query
        }
      } else {
        console.warn('RAG nicht verfügbar:', {
          ragService: !!this.ragService,
          embeddingsLoaded: this.embeddingsLoaded
        });
      }
      
      // OpenRouter API aufrufen (erste Antwort)
      let response = await this.callOpenRouterAPI(enrichedQuery);
      
      // Post-Processing: Bands validieren und Antwort korrigieren falls nötig
      if (this.ragService && this.embeddingsLoaded) {
        try {
          const correctedResponse = await this.validateAndCorrectResponse(response, message);
          if (correctedResponse !== response) {
            console.log('RAG: Antwort wurde korrigiert');
            console.log('RAG: Original:', response.substring(0, 200));
            console.log('RAG: Korrigiert:', correctedResponse.substring(0, 200));
            response = correctedResponse;
          } else {
            console.log('RAG: Antwort ist konsistent, keine Korrektur nötig');
          }
        } catch (validationError) {
          console.warn('RAG: Validierungsfehler, verwende originale Antwort:', validationError);
          // Fallback: Verwende originale Antwort
        }
      }
      
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
      console.error('Fehler-Details:', error.message, error.stack);
      const errorMessage = error.message || 'Unbekannter Fehler';
      this.addMessage('assistant', `Entschuldigung, es ist ein Fehler aufgetreten: ${errorMessage}. Bitte versuche es erneut.`);
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * OpenRouter API aufrufen
   */
  async callOpenRouterAPI(userMessage) {
    // System-Prompt laden
    // API-Key wird serverseitig vom Proxy verwendet
    const systemPrompt = await loadSystemPrompt();
    
    // Prüfe ob userMessage RAG-Kontext enthält
    const hasRAGContext = userMessage.includes('KRITISCH WICHTIG: EXAKTE DATEN') || userMessage.includes('KONKRETE ALBENDATEN') || userMessage.includes('RELEVANTE ALBENDATEN');
    let finalSystemPrompt = systemPrompt;
    let finalUserMessage = userMessage;
    let ragContext = null; // Außerhalb des if-Blocks deklarieren
    
    // Wenn RAG-Kontext vorhanden, extrahiere ihn und füge ihn prominent zum System-Prompt hinzu
    if (hasRAGContext) {
      // Suche nach dem RAG-Kontext-Block - verschiedene Formate möglich
      
      // Format 1: Neues Tabellenformat mit "KRITISCH WICHTIG: EXAKTE DATEN"
      const newTableFormatMatch = userMessage.match(/⚠️⚠️⚠️ KRITISCH WICHTIG: EXAKTE DATEN[\s\S]*?⚠️⚠️⚠️ ENDE DER KRITISCHEN DATEN ⚠️⚠️⚠️[\s\S]*?Es gibt KEINE Ausnahmen[\s\S]*?(?=\n\n|$)/);
      if (newTableFormatMatch) {
        ragContext = newTableFormatMatch[0];
        finalUserMessage = userMessage.replace(/⚠️⚠️⚠️ KRITISCH WICHTIG: EXAKTE DATEN[\s\S]*/, '').trim();
      } else {
        // Format 2: Alte strukturierte Version mit "KONKRETE ALBENDATEN"
        const oldFormatMatch = userMessage.match(/=== KONKRETE ALBENDATEN MIT NOTEN ===[\s\S]*?=== ENDE DER ALBENDATEN ===[\s\S]*?WICHTIG:[\s\S]*?(?=\n\n|$)/);
        if (oldFormatMatch) {
          ragContext = oldFormatMatch[0];
          finalUserMessage = userMessage.replace(/=== KONKRETE ALBENDATEN MIT NOTEN ===[\s\S]*/, '').trim();
        } else {
          // Format 3: Sehr alte Version mit "RELEVANTE ALBENDATEN"
          const veryOldFormatMatch = userMessage.match(/RELEVANTE ALBENDATEN:[\s\S]*/);
          if (veryOldFormatMatch) {
            ragContext = veryOldFormatMatch[0];
            finalUserMessage = userMessage.replace(/RELEVANTE ALBENDATEN:[\s\S]*/, '').trim();
          }
        }
      }
      
      if (ragContext) {
        // Füge RAG-Kontext SEHR prominent am Anfang des System-Prompts hinzu
        // WICHTIG: Erinnere auch an das Notensystem!
        finalSystemPrompt = `🚨🚨🚨 KRITISCH WICHTIG: EXAKTE ALBENDATEN 🚨🚨🚨\n\n${ragContext}\n\n🚨🚨🚨 ENDE DER KRITISCHEN DATEN 🚨🚨🚨\n\n---\n\n${systemPrompt}\n\n---\n\n🚨🚨🚨 ABSOLUT KRITISCH - NOCHMAL ZUR ERINNERUNG 🚨🚨🚨\n\nDie oben genannten Albendaten sind FAKTISCHE DATEN aus einer Datenbank.\n\nDU MUSST DIE EXAKTEN NOTEN AUS DER TABELLE VERWENDEN!\n\nVERBOTEN:\n- Zahlen erfinden oder schätzen\n- Andere Zahlen als die in der Tabelle verwenden\n- Zu sagen, dass du keine Daten hast (die Daten sind dir gegeben!)\n- Zahlen zu "runden" oder zu "korrigieren"\n- Zahlen aus dem Gedächtnis zu verwenden\n- Wenn ein Album in der Tabelle steht, aber du eine andere Zahl verwendest\n\nERLAUBT:\n- NUR die exakten Noten aus der Tabelle verwenden\n- Die Zahlen GENAU so wiedergeben wie sie in der Tabelle stehen\n- Wenn ein Album in der Tabelle steht, MUSST du die Note aus der Tabelle verwenden\n\nWICHTIG: Die Noten sind NICHT Schulnoten (1-6)! Sie gehen von 0-5, wobei 3+ gut ist.\nEine Note von 3.5 ist GUT, nicht "befriedigend". Eine Note von 2.8 ist SCHLECHT, nicht "ausreichend".\n\nKRITISCH: Interpretiere die Zahlen KORREKT! Höhere Zahlen = bessere Bewertung.\nWenn ein Album 3.19 hat und ein früheres 3.05, dann ist 3.19 BESSER.\nAnalysiere Entwicklungen immer basierend auf den tatsächlichen Zahlen - wenn die Zahlen steigen, ist das eine Verbesserung, nicht ein Verlust!\n\n🚨 FINALE ERINNERUNG: Wenn du über ein Album sprichst, das in der Tabelle steht, dann verwende GENAU die Note aus der Tabelle. Es gibt KEINE Ausnahmen. Die Zahlen in der Tabelle sind die EINZIGEN korrekten Zahlen.`;
        
        console.log('RAG: Kontext in System-Prompt integriert');
        console.log('RAG: User-Message ohne Kontext:', finalUserMessage);
        console.log('RAG: System-Prompt Länge:', finalSystemPrompt.length);
        console.log('RAG: Kontext-Länge:', ragContext.length);
      } else {
        console.warn('RAG: Kontext gefunden, aber konnte nicht extrahiert werden');
      }
    }
    
    // Nachrichten für API vorbereiten
    const apiMessages = [
      { role: 'system', content: finalSystemPrompt }
    ];
    
    // Füge alle bisherigen Messages hinzu (außer der letzten User-Message)
    for (let i = 0; i < this.messages.length - 1; i++) {
      const msg = this.messages[i];
      apiMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // Füge die finale User-Message hinzu
    // Wenn RAG-Kontext vorhanden, füge eine kurze Erinnerung hinzu
    let finalUserMessageWithReminder = finalUserMessage;
    if (ragContext) {
      try {
        // Extrahiere die wichtigsten Alben aus dem RAG-Kontext für eine kurze Erinnerung
        // Unterstütze sowohl === als auch ** Format
        const albumMatches = ragContext.match(/\| ([^|]+) \| "([^"]+)" \| (\d+) \| ===([\d.]+)=== \|/g) || 
                            ragContext.match(/\| ([^|]+) \| "([^"]+)" \| (\d+) \| \*\*([\d.]+)\*\* \|/g);
        if (albumMatches && albumMatches.length > 0) {
          finalUserMessageWithReminder += '\n\n🚨🚨🚨 KRITISCHE ERINNERUNG 🚨🚨🚨\n';
          finalUserMessageWithReminder += 'Verwende GENAU die Noten aus der Tabelle oben. Die Zahlen sind:\n';
          const notesList = albumMatches.slice(0, 8).map(match => {
            // Versuche beide Formate
            let parts = match.match(/\| ([^|]+) \| "([^"]+)" \| (\d+) \| ===([\d.]+)=== \|/);
            if (!parts) {
              parts = match.match(/\| ([^|]+) \| "([^"]+)" \| (\d+) \| \*\*([\d.]+)\*\* \|/);
            }
            if (parts && parts.length >= 5) {
              return `  - "${parts[2]}" = ${parts[4]}`;
            }
            return '';
          }).filter(Boolean).join('\n');
          finalUserMessageWithReminder += notesList;
          if (albumMatches.length > 8) {
            finalUserMessageWithReminder += `\n  ... und ${albumMatches.length - 8} weitere Alben`;
          }
          finalUserMessageWithReminder += '\n\n🚨 VERWENDE NUR DIESE ZAHLEN! KEINE ANDEREN! 🚨';
        }
      } catch (error) {
        console.warn('Fehler beim Extrahieren der Album-Erinnerung:', error);
        // Ignoriere Fehler und verwende originale Message
      }
    }
    
    apiMessages.push({
      role: 'user',
      content: finalUserMessageWithReminder
    });
    
    // Debug: Zeige was an API gesendet wird
    const generationModel = GENERATION_MODEL_ID;
    console.log('API: Sende Nachricht an OpenRouter');
    console.log('API: System-Prompt Länge:', finalSystemPrompt.length);
    console.log('API: System-Prompt (erste 500 Zeichen):', finalSystemPrompt.substring(0, 500));
    console.log('API: User-Message Länge:', finalUserMessage.length);
    console.log('API: User-Message:', finalUserMessage);
    console.log('API: Verwende Generierungsmodell (Schritt 1):', generationModel);
    
    const requestBody = {
      model: generationModel,
      messages: apiMessages,
      ...OPENROUTER_CONFIG.requestConfig
    };
    
    // Nutze Proxy (API-Key wird serverseitig hinzugefügt)
    const response = await fetch(OPENROUTER_CONFIG.proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Fehler: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('API: Antwort erhalten:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices?.[0]?.message
    });
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('API: Ungültige Antwort-Struktur:', data);
      throw new Error('Ungültige API-Antwort');
    }
    
    const content = data.choices[0].message.content.trim();
    console.log('API: Antwort-Content Länge:', content.length);
    console.log('API: Antwort-Content (erste 200 Zeichen):', content.substring(0, 200));
    
    return content;
  }
  
  /**
   * API-Key setzen
   */
  async setApiKey(apiKey) {
    // Legacy-Methode: API-Key wird jetzt serverseitig vom Proxy verwendet
    // Diese Methode bleibt für Kompatibilität, macht aber nichts mehr
    console.log('setApiKey aufgerufen, aber API-Key wird serverseitig vom Proxy verwendet');
  }
  
  /**
   * Modell ändern
   */
  setModel(modelId) {
    this.model = modelId;
  }
  
  /**
   * Loading-Status setzen
   */
  setLoading(loading) {
    this.isLoading = loading;
    const sendButton = document.getElementById('chat-send-button');
    const input = document.getElementById('chat-input');
    
    if (sendButton) {
      sendButton.disabled = loading;
      sendButton.classList.toggle('loading', loading);
    }
    
    if (input) {
      input.disabled = loading;
    }
    
    if (loading) {
      const messagesArea = document.getElementById('chat-messages');
      if (messagesArea) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'chat-message chat-message-assistant chat-loading';
        loadingEl.id = 'chat-loading-indicator';
        loadingEl.innerHTML = '<div class="chat-message-content"><span class="chat-typing-indicator"><span></span><span></span><span></span></span></div>';
        messagesArea.appendChild(loadingEl);
        this.scrollToBottom();
      }
    } else {
      const loadingEl = document.getElementById('chat-loading-indicator');
      if (loadingEl) {
        loadingEl.remove();
      }
    }
  }
  
  /**
   * Antwort validieren und korrigieren mit LLM
   */
  async validateAndCorrectResponse(llmResponse, originalQuery) {
    // Bands aus LLM-Antwort extrahieren
    const mentionedBands = this.extractMentionedBands(llmResponse);
    
    if (mentionedBands.length === 0) {
      console.log('RAG: Keine Bands in Antwort gefunden, keine Validierung nötig');
      return llmResponse;
    }
    
    console.log('RAG: Validierung für Bands:', mentionedBands);
    
    // Für jede erwähnte Band RAG-Daten suchen
    const bandDataMap = new Map();
    
    for (const bandName of mentionedBands) {
      // Suche alle Alben dieser Band
      const bandAlbums = this.albumData.filter(album => 
        album.Band && album.Band.toLowerCase() === bandName.toLowerCase()
      );
      
      if (bandAlbums.length > 0) {
        // Sortiere nach Jahr
        const sortedAlbums = [...bandAlbums].sort((a, b) => (a.Jahr || 0) - (b.Jahr || 0));
        
        // Berechne Trend
        const firstNote = sortedAlbums[0].Note;
        const lastNote = sortedAlbums[sortedAlbums.length - 1].Note;
        const trend = lastNote > firstNote + 0.1 ? 'rising' : 
                     lastNote < firstNote - 0.1 ? 'falling' : 'stable';
        
        bandDataMap.set(bandName, {
          albums: sortedAlbums,
          firstNote,
          lastNote,
          trend,
          count: sortedAlbums.length
        });
        
        console.log(`RAG: Daten für ${bandName}:`, {
          count: sortedAlbums.length,
          firstNote,
          lastNote,
          trend
        });
      } else {
        console.log(`RAG: Keine Daten für ${bandName}`);
        bandDataMap.set(bandName, null);
      }
    }
    
    // Wenn keine Daten gefunden wurden, keine Korrektur nötig
    const bandsWithData = Array.from(bandDataMap.entries()).filter(([_, data]) => data !== null);
    if (bandsWithData.length === 0) {
      console.log('RAG: Keine Daten für erwähnte Bands gefunden');
      return llmResponse;
    }
    
    // Erstelle Validierungs-Prompt für LLM
    const validationPrompt = this.buildValidationPrompt(llmResponse, originalQuery, bandsWithData);
    
    // LLM-basierte Validierung durchführen
    const correctedResponse = await this.callOpenRouterAPIForValidation(validationPrompt);
    
    return correctedResponse;
  }
  
  /**
   * Validierungs-Prompt erstellen
   */
  buildValidationPrompt(llmResponse, originalQuery, bandsWithData) {
    let prompt = 'Du hast gerade eine Antwort auf folgende Frage gegeben:\n\n';
    prompt += `"${originalQuery}"\n\n`;
    prompt += 'Deine Antwort enthielt Aussagen über Bands, für die ich jetzt die tatsächlichen Testteam-Daten geprüft habe:\n\n';
    
    bandsWithData.forEach(([bandName, data]) => {
      prompt += `=== ${bandName} ===\n`;
      prompt += `Anzahl Alben: ${data.count}\n`;
      prompt += `Erste Note (${data.albums[0].Jahr}): ${data.firstNote.toFixed(2)}\n`;
      prompt += `Letzte Note (${data.albums[data.albums.length - 1].Jahr}): ${data.lastNote.toFixed(2)}\n`;
      prompt += `Trend: ${data.trend === 'rising' ? 'Steigend (Verbesserung)' : data.trend === 'falling' ? 'Fallend (Absturz)' : 'Stabil'}\n`;
      prompt += '\nAlle Alben:\n';
      data.albums.forEach(album => {
        prompt += `  - "${album.Album}" (${album.Jahr}): ${album.Note.toFixed(2)}\n`;
      });
      prompt += '\n';
    });
    
    prompt += '=== AUFGABE ===\n\n';
    prompt += 'Gib jetzt eine vollständige, natürliche Antwort auf die ursprüngliche Frage:\n';
    prompt += '1. Verwende IMMER die exakten Zahlen aus den Daten oben.\n';
    prompt += '2. Wenn die Daten eine bestimmte Entwicklung zeigen (z.B. Absturz oder Verbesserung), beschreibe das basierend auf den tatsächlichen Zahlen.\n';
    prompt += '3. Die Antwort soll natürlich klingen und direkt auf die Frage eingehen.\n';
    prompt += '4. Verwende NICHT Formulierungen wie "Eigentlich dachte ich..." oder "Ich muss korrigieren..." - schreibe die Antwort so, als wäre es deine erste und einzige Antwort.\n';
    prompt += '5. Die Testteam-Daten sind die Quelle - verwende sie direkt und selbstbewusst.\n\n';
    prompt += 'Antworte NUR mit der vollständigen Antwort auf die ursprüngliche Frage, ohne zusätzliche Erklärungen oder Verweise auf vorherige Antworten.';
    
    return prompt;
  }
  
  /**
   * LLM-API für Validierung aufrufen
   */
  async callOpenRouterAPIForValidation(validationPrompt) {
    // API-Key wird serverseitig vom Proxy verwendet
    const systemPrompt = await loadSystemPrompt();
    
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: validationPrompt }
    ];
    
    const requestBody = {
      model: VALIDATION_MODEL.id,
      messages: apiMessages,
      ...OPENROUTER_CONFIG.requestConfig,
      temperature: 0.3 // Niedrigere Temperature für präzisere Validierung
    };
    
    console.log('RAG: Validiere Antwort mit LLM');
    
    // Nutze Proxy (API-Key wird serverseitig hinzugefügt)
    const response = await fetch(OPENROUTER_CONFIG.proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Fehler: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Ungültige API-Antwort');
    }
    
    return data.choices[0].message.content.trim();
  }
  
  /**
   * Chat zurücksetzen
   */
  clear() {
    this.messages = [];
    localStorage.removeItem('chat-messages');
    this.renderMessages();
    this.addMessage('assistant', 'Chat zurückgesetzt. Wie kann ich dir helfen?');
  }
}
