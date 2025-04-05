import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Battery from 'expo-battery';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

interface AppSettings {
  isMonitoringEnabled: boolean;
  notificationEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoStart: boolean;
  batteryOptimization: boolean;
  backgroundScanInterval: number;
  lastExportDate?: number;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  isMonitoringEnabled: true,
  notificationEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoStart: true,
  batteryOptimization: true,
  backgroundScanInterval: 15, // minutos
  theme: 'system',
  language: 'pt-BR'
};

const SETTINGS_KEY = '@phishing_detector:settings';

class SettingsService {
  private static instance: SettingsService;
  private settings: AppSettings = DEFAULT_SETTINGS;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }

      // Configurar otimização de bateria
      if (this.settings.batteryOptimization) {
        await this.configureBatteryOptimization();
      }

      // Configurar tarefas em segundo plano
      if (this.settings.isMonitoringEnabled) {
        await this.configureBackgroundTasks();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Erro ao inicializar configurações:', error);
      throw error;
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return { ...this.settings };
  }

  async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));

      // Atualizar configurações relacionadas
      if (newSettings.batteryOptimization !== undefined) {
        await this.configureBatteryOptimization();
      }

      if (newSettings.isMonitoringEnabled !== undefined) {
        await this.configureBackgroundTasks();
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      throw error;
    }
  }

  async resetSettings(): Promise<void> {
    try {
      this.settings = { ...DEFAULT_SETTINGS };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      await this.configureBatteryOptimization();
      await this.configureBackgroundTasks();
    } catch (error) {
      console.error('Erro ao resetar configurações:', error);
      throw error;
    }
  }

  private async configureBatteryOptimization(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        const batteryState = await Battery.getBatteryStateAsync();
        if (batteryState === Battery.BatteryState.UNPLUGGED) {
          // Implementar lógica de otimização de bateria para Android
          // Por exemplo, reduzir frequência de verificações
          this.settings.backgroundScanInterval = 30;
        } else {
          this.settings.backgroundScanInterval = 15;
        }
      }
    } catch (error) {
      console.error('Erro ao configurar otimização de bateria:', error);
    }
  }

  private async configureBackgroundTasks(): Promise<void> {
    try {
      if (this.settings.isMonitoringEnabled) {
        // Registrar tarefa de verificação em segundo plano
        await BackgroundFetch.registerTaskAsync('PHISHING_CHECK', {
          minimumInterval: this.settings.backgroundScanInterval * 60, // converter para segundos
          stopOnTerminate: false,
          startOnBoot: this.settings.autoStart,
        });
      } else {
        // Cancelar tarefa de verificação
        await BackgroundFetch.unregisterTaskAsync('PHISHING_CHECK');
      }
    } catch (error) {
      console.error('Erro ao configurar tarefas em segundo plano:', error);
    }
  }

  async exportSettings(): Promise<string> {
    try {
      const settings = await this.getSettings();
      return JSON.stringify(settings, null, 2);
    } catch (error) {
      console.error('Erro ao exportar configurações:', error);
      throw error;
    }
  }

  async importSettings(settingsJson: string): Promise<void> {
    try {
      const importedSettings = JSON.parse(settingsJson);
      await this.updateSettings(importedSettings);
    } catch (error) {
      console.error('Erro ao importar configurações:', error);
      throw error;
    }
  }
}

export default SettingsService; 