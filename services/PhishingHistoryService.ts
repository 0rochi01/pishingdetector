import AsyncStorage from '@react-native-async-storage/async-storage';

// Definição da interface usada em PhishingDetectionService
export interface PhishingDetectionResult {
  isPhishing: boolean;
  confidence: number;
  details?: {
    suspiciousWords?: string[];
    suspiciousUrls?: string[];
    requestsSensitiveData?: boolean;
    createsUrgency?: boolean;
    reason?: string;
    [key: string]: any;
  };
  explanation?: string;
}

export interface HistoryEntry {
  content: string;
  result: PhishingDetectionResult;
  timestamp: number;
  source: string;
}

class PhishingHistoryService {
  private static instance: PhishingHistoryService;
  private readonly HISTORY_KEY = '@phishing_detector:history';
  private readonly MAX_ENTRIES = 100;
  private history: HistoryEntry[] = [];
  private isLoaded: boolean = false;

  private constructor() {
    this.loadHistory();
  }

  static getInstance(): PhishingHistoryService {
    if (!PhishingHistoryService.instance) {
      PhishingHistoryService.instance = new PhishingHistoryService();
    }
    return PhishingHistoryService.instance;
  }

  async addToHistory(content: string, result: PhishingDetectionResult) {
    // Certifique-se de que o histórico está carregado
    if (!this.isLoaded) {
      await this.loadHistory();
    }

    // Criar nova entrada
    const entry: HistoryEntry = {
      content: content,
      result: result,
      timestamp: Date.now(),
      source: result.details?.source || 'app'
    };

    // Adicionar ao histórico
    this.history.unshift(entry); // Adicionar ao início
    
    // Limitar o tamanho do histórico
    if (this.history.length > this.MAX_ENTRIES) {
      this.history = this.history.slice(0, this.MAX_ENTRIES);
    }

    // Salvar histórico atualizado
    this.saveHistory();
  }

  async getHistory(): Promise<HistoryEntry[]> {
    if (!this.isLoaded) {
      await this.loadHistory();
    }
    return this.history;
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await AsyncStorage.removeItem(this.HISTORY_KEY);
    this.isLoaded = true;
  }

  async getPhishingStats(): Promise<{
    totalAnalyzed: number;
    phishingDetected: number;
    lastWeekDetected: number;
  }> {
    if (!this.isLoaded) {
      await this.loadHistory();
    }

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000; // 7 dias em milissegundos
    
    let phishingDetected = 0;
    let lastWeekDetected = 0;

    for (const entry of this.history) {
      if (entry.result.isPhishing) {
        phishingDetected++;
        
        if (entry.timestamp >= oneWeekAgo) {
          lastWeekDetected++;
        }
      }
    }

    return {
      totalAnalyzed: this.history.length,
      phishingDetected,
      lastWeekDetected
    };
  }

  private async loadHistory() {
    try {
      const historyJson = await AsyncStorage.getItem(this.HISTORY_KEY);
      
      if (historyJson) {
        this.history = JSON.parse(historyJson);
      } else {
        this.history = [];
      }
      
      this.isLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar histórico de phishing:', error);
      this.history = [];
      this.isLoaded = true;
    }
  }

  private async saveHistory() {
    try {
      await AsyncStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Erro ao salvar histórico de phishing:', error);
    }
  }
}

export default PhishingHistoryService; 