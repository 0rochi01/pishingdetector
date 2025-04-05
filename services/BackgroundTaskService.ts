import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import PhishingDetectionService from './PhishingDetectionService';
import NotificationService from './NotificationService';
import HistoryService from './HistoryService';
import SettingsService from './SettingsService';
import { notificationMonitorService } from './NotificationMonitorService';

// Constantes para identificar tarefas em background
export const BACKGROUND_FETCH_TASK = 'background-phishing-detection';
export const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';
export const FOREGROUND_SERVICE_NOTIFICATION_ID = 'phishing-detection-service';

// Intervalo de verificação em segundo plano (milissegundos)
// 15 minutos (900.000ms) - valor mínimo permitido para iOS
const BACKGROUND_FETCH_INTERVAL = 900; 

// Intervalos adaptáveis baseados no nível de bateria
const HIGH_BATTERY_INTERVAL = 900; // 15 minutos
const MEDIUM_BATTERY_INTERVAL = 1800; // 30 minutos
const LOW_BATTERY_INTERVAL = 3600; // 60 minutos

// Níveis de bateria para adaptação
const BATTERY_LEVEL_LOW = 0.2; // 20%
const BATTERY_LEVEL_MEDIUM = 0.5; // 50%

interface BackgroundTaskResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Serviço para gerenciar tarefas em segundo plano
 */
class BackgroundTaskService {
  private static instance: BackgroundTaskService;
  private isRegistered: boolean = false;
  private foregroundServiceActive: boolean = false;
  private isActive: boolean = false;
  private batteryOptimizationEnabled: boolean = true;
  
  private constructor() {
    this.defineBackgroundTasks();
  }
  
  static getInstance(): BackgroundTaskService {
    if (!BackgroundTaskService.instance) {
      BackgroundTaskService.instance = new BackgroundTaskService();
    }
    return BackgroundTaskService.instance;
  }
  
  /**
   * Define as tarefas que serão executadas em background
   */
  private defineBackgroundTasks(): void {
    // Tarefa principal de escaneamento periódico
    if (!TaskManager.isTaskDefined(BACKGROUND_FETCH_TASK)) {
      TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
        try {
          console.log(`[BackgroundTask] Executando verificação em segundo plano: ${new Date().toISOString()}`);
          
          // Executa o escaneamento
          await notificationMonitorService.scanMessagesAndEmails();
          
          // Ajusta o intervalo com base no nível de bateria
          await this.adjustBackgroundFetchInterval();
          
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          console.error('[BackgroundTask] Erro na verificação em segundo plano:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
    }
    
    // Tarefa para processar notificações em background
    if (!TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) {
      TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
        if (error) {
          console.error('[BackgroundTask] Erro ao processar notificação em background:', error);
          return;
        }
        
        try {
          console.log('[BackgroundTask] Notificação recebida em background');
          
          // Extrai a notificação dos dados
          const { notification } = data as { notification: Notifications.Notification };
          
          // Processa a notificação usando o serviço existente
          await notificationMonitorService.handleNotificationReceived(notification);
        } catch (error) {
          console.error('[BackgroundTask] Erro ao processar notificação:', error);
        }
      });
    }
  }
  
  /**
   * Registra todas as tarefas em segundo plano
   * @returns Promise<boolean> Sucesso do registro
   */
  public async registerBackgroundTasks(): Promise<boolean> {
    try {
      if (this.isRegistered) {
        console.log('[BackgroundTask] Tarefas já registradas, pulando registro');
        return true;
      }
      
      // Determina o intervalo baseado no nível de bateria atual
      const interval = await this.getOptimalInterval();
      
      console.log(`[BackgroundTask] Registrando tarefa de verificação em segundo plano com intervalo de ${interval} segundos`);
      
      // Registra a tarefa de verificação periódica
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: interval, // Em segundos
        stopOnTerminate: false, // Continua após o app ser fechado
        startOnBoot: true // Inicia após reinicialização do dispositivo
      });
      
      // Registra a tarefa de notificação em segundo plano
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      
      // Inicia serviço em primeiro plano para Android
      if (Platform.OS === 'android') {
        await this.startForegroundService();
      }
      
      this.isRegistered = true;
      
      console.log('[BackgroundTask] Todas as tarefas em segundo plano registradas com sucesso');
      return true;
    } catch (error) {
      console.error('[BackgroundTask] Erro ao registrar tarefas em segundo plano:', error);
      return false;
    }
  }
  
  /**
   * Cancela todas as tarefas em segundo plano
   */
  public async unregisterBackgroundTasks(): Promise<void> {
    try {
      console.log('[BackgroundTask] Desregistrando tarefas em segundo plano');
      
      // Cancela a tarefa de verificação periódica
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      
      // Cancela a tarefa de notificação em segundo plano
      await Notifications.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      
      // Para serviço em primeiro plano para Android
      if (Platform.OS === 'android' && this.foregroundServiceActive) {
        await this.stopForegroundService();
      }
      
      this.isRegistered = false;
      
      console.log('[BackgroundTask] Todas as tarefas em segundo plano foram desregistradas');
    } catch (error) {
      console.error('[BackgroundTask] Erro ao desregistrar tarefas em segundo plano:', error);
    }
  }
  
  /**
   * Inicia um serviço em primeiro plano no Android
   * Isso mantém o app rodando mesmo que o usuário o feche
   */
  private async startForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') return;
    
    try {
      // Configura o canal de notificação para o serviço
      await Notifications.setNotificationChannelAsync(FOREGROUND_SERVICE_NOTIFICATION_ID, {
        name: 'Serviço de Detecção de Phishing',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 0, 0, 0],
        lightColor: '#4A90E2',
      });
      
      // Exibe a notificação persistente
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Proteção de Phishing Ativa',
          body: 'Monitorando notificações e mensagens em segundo plano',
          data: { type: 'foreground_service' },
        },
        trigger: null, // Notificação imediata
      });
      
      this.foregroundServiceActive = true;
      
      console.log('[BackgroundTask] Serviço em primeiro plano iniciado com sucesso');
    } catch (error) {
      console.error('[BackgroundTask] Erro ao iniciar serviço em primeiro plano:', error);
    }
  }
  
  /**
   * Para o serviço em primeiro plano no Android
   */
  private async stopForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') return;
    
    try {
      // Remove a notificação persistente
      await Notifications.dismissAllNotificationsAsync();
      
      this.foregroundServiceActive = false;
      
      console.log('[BackgroundTask] Serviço em primeiro plano parado com sucesso');
    } catch (error) {
      console.error('[BackgroundTask] Erro ao parar serviço em primeiro plano:', error);
    }
  }
  
  /**
   * Obtém o intervalo ideal baseado no nível de bateria
   */
  private async getOptimalInterval(): Promise<number> {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      
      if (batteryLevel <= BATTERY_LEVEL_LOW) {
        return LOW_BATTERY_INTERVAL;
      } else if (batteryLevel <= BATTERY_LEVEL_MEDIUM) {
        return MEDIUM_BATTERY_INTERVAL;
      } else {
        return HIGH_BATTERY_INTERVAL;
      }
    } catch (error) {
      console.warn('[BackgroundTask] Erro ao verificar nível de bateria:', error);
      return HIGH_BATTERY_INTERVAL; // Usa o intervalo padrão em caso de erro
    }
  }
  
  /**
   * Ajusta o intervalo de verificação com base no nível atual de bateria
   */
  private async adjustBackgroundFetchInterval(): Promise<void> {
    try {
      const interval = await this.getOptimalInterval();
      
      // Atualiza o intervalo
      await BackgroundFetch.setMinimumIntervalAsync(interval);
      
      console.log(`[BackgroundTask] Intervalo ajustado para ${interval} segundos baseado no nível de bateria`);
    } catch (error) {
      console.error('[BackgroundTask] Erro ao ajustar intervalo:', error);
    }
  }

  async startMonitoring(): Promise<void> {
    try {
      await this.registerBackgroundTasks();
      this.isActive = true;
      console.log('Background monitoring started');
    } catch (error) {
      console.error('Failed to start background monitoring:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    try {
      await this.unregisterBackgroundTasks();
      this.isActive = false;
      console.log('Background monitoring stopped');
    } catch (error) {
      console.error('Failed to stop background monitoring:', error);
      throw error;
    }
  }

  async updateBatteryOptimization(optimize: boolean): Promise<void> {
    try {
      this.batteryOptimizationEnabled = optimize;
      
      // Se o monitoramento estiver ativo, reinicia para aplicar a nova configuração
      if (this.isActive) {
        await this.stopMonitoring();
        await this.startMonitoring();
      }
      
      console.log(`Battery optimization ${optimize ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update battery optimization settings:', error);
      throw error;
    }
  }

  private async executeBackgroundCheck(): Promise<BackgroundTaskResult> {
    try {
      const settings = await SettingsService.getInstance().getSettings();
      if (!settings.isMonitoringEnabled) {
        return { success: true, data: { message: 'Monitoramento desativado' } };
      }

      // Obter mensagens recentes
      const recentMessages = await this.getRecentMessages();
      
      // Verificar cada mensagem
      const results = await Promise.all(
        recentMessages.map(async (message) => {
          const detectionResult = await PhishingDetectionService.getInstance().detectPhishing(message);
          
          if (detectionResult.isPhishing) {
            // Enviar notificação
            await NotificationService.getInstance().sendNotification({
              title: '⚠️ Alerta de Phishing',
              body: 'Uma mensagem suspeita foi detectada',
              data: { message, detectionResult },
              sound: settings.soundEnabled,
              vibrate: settings.vibrationEnabled,
            });

            // Registrar no histórico
            await HistoryService.getInstance().addEntry({
              content: message,
              isPhishing: true,
              confidence: detectionResult.confidence,
              source: 'Background Check',
              details: detectionResult.details
            });
          }

          return detectionResult;
        })
      );

      return {
        success: true,
        data: {
          checkedMessages: recentMessages.length,
          phishingDetected: results.filter(r => r.isPhishing).length
        }
      };
    } catch (error) {
      console.error('Erro na verificação em segundo plano:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  private async getRecentMessages(): Promise<string[]> {
    // Implementar lógica para obter mensagens recentes
    // Por exemplo, do histórico de SMS, emails ou notificações
    return [];
  }

  async isTaskRegistered(): Promise<boolean> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status === BackgroundFetch.BackgroundFetchStatus.Available;
    } catch (error) {
      console.error('Erro ao verificar status da tarefa:', error);
      return false;
    }
  }

  async getTaskStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
    try {
      return await BackgroundFetch.getStatusAsync();
    } catch (error) {
      console.error('Erro ao obter status da tarefa:', error);
      return null;
    }
  }
}

// Instância singleton do serviço
export const backgroundTaskService = BackgroundTaskService.getInstance();

export default backgroundTaskService; 