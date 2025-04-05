import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface HistoryEntry {
  id: string;
  content: string;
  isPhishing: boolean;
  confidence: number;
  timestamp: number;
  source: string;
  details?: {
    threatType?: string;
    platformType?: string;
    threatEntryType?: string;
  };
}

class HistoryService {
  private static instance: HistoryService;
  private readonly STORAGE_KEY = '@phishing_detector:history';
  private readonly MAX_ENTRIES = 1000;

  private constructor() {}

  static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  async addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const history = await this.getHistory();
      const newEntry: HistoryEntry = {
        ...entry,
        id: this.generateId(),
        timestamp: Date.now()
      };

      // Adiciona a nova entrada no início do array
      history.unshift(newEntry);

      // Limita o tamanho do histórico
      if (history.length > this.MAX_ENTRIES) {
        history.length = this.MAX_ENTRIES;
      }

      await this.saveHistory(history);
    } catch (error) {
      console.error('Erro ao adicionar entrada no histórico:', error);
      throw error;
    }
  }

  async getHistory(): Promise<HistoryEntry[]> {
    try {
      const historyJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('Erro ao obter histórico:', error);
      return [];
    }
  }

  async getFilteredHistory(filter: {
    isPhishing?: boolean;
    startDate?: number;
    endDate?: number;
    source?: string;
  }): Promise<HistoryEntry[]> {
    try {
      const history = await this.getHistory();
      return history.filter(entry => {
        if (filter.isPhishing !== undefined && entry.isPhishing !== filter.isPhishing) {
          return false;
        }
        if (filter.startDate && entry.timestamp < filter.startDate) {
          return false;
        }
        if (filter.endDate && entry.timestamp > filter.endDate) {
          return false;
        }
        if (filter.source && entry.source !== filter.source) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('Erro ao filtrar histórico:', error);
      return [];
    }
  }

  async getStatistics(): Promise<{
    total: number;
    phishing: number;
    safe: number;
    sources: Record<string, number>;
    confidence: {
      average: number;
      min: number;
      max: number;
    };
  }> {
    try {
      const history = await this.getHistory();
      const statistics = {
        total: history.length,
        phishing: 0,
        safe: 0,
        sources: {} as Record<string, number>,
        confidence: {
          average: 0,
          min: 1,
          max: 0
        }
      };

      let totalConfidence = 0;

      history.forEach(entry => {
        if (entry.isPhishing) {
          statistics.phishing++;
        } else {
          statistics.safe++;
        }

        statistics.sources[entry.source] = (statistics.sources[entry.source] || 0) + 1;
        totalConfidence += entry.confidence;

        if (entry.confidence < statistics.confidence.min) {
          statistics.confidence.min = entry.confidence;
        }
        if (entry.confidence > statistics.confidence.max) {
          statistics.confidence.max = entry.confidence;
        }
      });

      statistics.confidence.average = history.length > 0 ? totalConfidence / history.length : 0;

      return statistics;
    } catch (error) {
      console.error('Erro ao calcular estatísticas:', error);
      throw error;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      throw error;
    }
  }

  async exportHistory(): Promise<string> {
    try {
      const history = await this.getHistory();
      const historyJson = JSON.stringify(history, null, 2);
      return historyJson;
    } catch (error) {
      console.error('Erro ao exportar histórico:', error);
      throw error;
    }
  }

  private async saveHistory(history: HistoryEntry[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export default HistoryService; 