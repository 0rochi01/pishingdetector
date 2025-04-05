import * as SMS from 'expo-sms';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import PhishingDetectionService from './PhishingDetectionService';
import NotificationService from './NotificationService';
import HistoryService from './HistoryService';
import SettingsService from './SettingsService';
import PermissionService from './PermissionService';

interface SmsMessage {
  body: string;
  address: string;
  date: number;
  type?: string;
}

interface DetectionDetails {
  threatType?: string;
  platformType?: string;
  threatEntryType?: string;
  sender?: string;
}

class SmsMonitorService {
  private static instance: SmsMonitorService;
  private isMonitoring: boolean = false;
  private lastCheckTime: number = 0;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_MESSAGES = 100; // Limite de mensagens por verificação
  private eventEmitter: NativeEventEmitter | null = null;
  private eventSubscriptions: { remove: () => void }[] = [];

  private constructor() {
    // Configurar escuta de eventos
    if (Platform.OS === 'android') {
      const { SmsModule } = NativeModules;
      if (SmsModule) {
        this.eventEmitter = new NativeEventEmitter(SmsModule);
      }
    }
  }

  static getInstance(): SmsMonitorService {
    if (!SmsMonitorService.instance) {
      SmsMonitorService.instance = new SmsMonitorService();
    }
    return SmsMonitorService.instance;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    try {
      const settings = await SettingsService.getInstance().getSettings();
      if (!settings.isMonitoringEnabled) {
        console.log('Monitoramento de SMS desativado nas configurações');
        return;
      }

      // Verificar permissões
      const permissionService = PermissionService.getInstance();
      const hasPermission = await permissionService.requestSmsPermission();
      
      if (!hasPermission) {
        throw new Error('Permissão de SMS não concedida');
      }

      // Iniciar monitoramento em tempo real para Android
      if (Platform.OS === 'android') {
        const { SmsModule } = NativeModules;
        if (SmsModule && this.eventEmitter) {
          // Iniciar monitoramento em tempo real
          await SmsModule.startRealTimeMonitoring();
          
          // Configurar listeners de eventos
          this.configureEventListeners();
          
          console.log('Monitoramento em tempo real de SMS iniciado');
        } else {
          console.log('Módulo SMS não disponível, usando verificação periódica');
          this.startPeriodicCheck();
        }
      } else {
        // iOS usa apenas verificação periódica
        this.startPeriodicCheck();
      }

      // Processar SMS existentes não verificados
      await this.checkRecentMessages();

      // Marcar como monitorando
      this.isMonitoring = true;
      this.lastCheckTime = Date.now();
      
      console.log('Monitoramento de SMS iniciado');
    } catch (error) {
      console.error('Erro ao iniciar monitoramento de SMS:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    try {
      this.isMonitoring = false;
      
      // Remover listeners de eventos
      this.removeEventListeners();
      
      // Parar monitoramento em tempo real no Android
      if (Platform.OS === 'android') {
        const { SmsModule } = NativeModules;
        if (SmsModule) {
          await SmsModule.stopRealTimeMonitoring();
        }
      }
      
      console.log('Monitoramento de SMS parado');
    } catch (error) {
      console.error('Erro ao parar monitoramento de SMS:', error);
      throw error;
    }
  }

  private configureEventListeners(): void {
    if (!this.eventEmitter) return;
    
    // Limpar qualquer listener anterior
    this.removeEventListeners();
    
    // Configurar listener para SMS recebidos
    const smsReceivedSubscription = this.eventEmitter.addListener(
      'sms_received',
      this.handleSmsReceived.bind(this)
    );
    
    // Configurar listener para detecção de phishing
    const phishingDetectedSubscription = this.eventEmitter.addListener(
      'phishing_detected',
      this.handlePhishingDetected.bind(this)
    );
    
    // Armazenar referências para limpar depois
    this.eventSubscriptions = [
      smsReceivedSubscription,
      phishingDetectedSubscription
    ];
  }
  
  private removeEventListeners(): void {
    // Remover todos os listeners
    for (const subscription of this.eventSubscriptions) {
      subscription.remove();
    }
    this.eventSubscriptions = [];
  }
  
  private async handleSmsReceived(message: SmsMessage): Promise<void> {
    try {
      console.log('SMS recebido:', message.address);
      
      // Processar a mensagem
      await this.processMessage(message);
    } catch (error) {
      console.error('Erro ao processar SMS recebido:', error);
    }
  }
  
  private async handlePhishingDetected(data: {
    content: string;
    sender: string;
    confidence: number;
    source: string;
  }): Promise<void> {
    try {
      console.log('Phishing detectado em SMS:', data.sender);
      
      // Registrar no histórico
      const details: DetectionDetails = {
        sender: data.sender
      };

      await HistoryService.getInstance().addEntry({
        content: data.content,
        isPhishing: true,
        confidence: data.confidence,
        source: 'SMS Monitor (Real-time)',
        details
      });

      // Enviar notificação
      const settings = await SettingsService.getInstance().getSettings();
      if (settings.notificationEnabled) {
        await NotificationService.getInstance().sendNotification({
          title: '⚠️ Alerta de Phishing',
          body: 'Uma mensagem SMS suspeita foi detectada',
          data: { content: data.content, sender: data.sender, confidence: data.confidence },
          sound: settings.soundEnabled,
          vibrate: settings.vibrationEnabled,
        });
      }
    } catch (error) {
      console.error('Erro ao processar detecção de phishing:', error);
    }
  }

  private startPeriodicCheck() {
    if (!this.isMonitoring) return;

    setTimeout(async () => {
      if (this.isMonitoring) {
        await this.checkRecentMessages();
        this.startPeriodicCheck();
      }
    }, this.CHECK_INTERVAL);
  }

  private async checkRecentMessages(): Promise<void> {
    try {
      const now = Date.now();
      const messages = await this.getRecentMessages(this.lastCheckTime);
      this.lastCheckTime = now;

      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('Erro ao verificar mensagens recentes:', error);
    }
  }

  private async processMessage(message: SmsMessage): Promise<void> {
    try {
      const detectionResult = await PhishingDetectionService.getInstance().detectPhishing(message.body);

      if (detectionResult.isPhishing) {
        // Registrar no histórico
        const details: DetectionDetails = {
          ...detectionResult.details,
          sender: message.address
        };

        await HistoryService.getInstance().addEntry({
          content: message.body,
          isPhishing: true,
          confidence: detectionResult.confidence,
          source: 'SMS Monitor',
          details
        });

        // Enviar notificação
        const settings = await SettingsService.getInstance().getSettings();
        if (settings.notificationEnabled) {
          await NotificationService.getInstance().sendNotification({
            title: '⚠️ Alerta de Phishing',
            body: 'Uma mensagem SMS suspeita foi detectada',
            data: { message, detectionResult },
            sound: settings.soundEnabled,
            vibrate: settings.vibrationEnabled,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem SMS:', error);
    }
  }

  private async getRecentMessages(since: number): Promise<SmsMessage[]> {
    try {
      if (Platform.OS === 'android') {
        // Usar módulo nativo para Android
        const { SmsModule } = NativeModules;
        if (!SmsModule) {
          throw new Error('Módulo SMS não disponível');
        }

        const messages = await SmsModule.getRecentMessages(since, this.MAX_MESSAGES);
        return Array.isArray(messages) ? messages : [];
      } else {
        // iOS usa o módulo expo-sms
        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
          throw new Error('Serviço de SMS não disponível');
        }

        // iOS tem restrições mais rigorosas para acesso a SMS
        return [];
      }
    } catch (error) {
      console.error('Erro ao obter mensagens SMS recentes:', error);
      return [];
    }
  }

  async getUnreadMessages(): Promise<SmsMessage[]> {
    try {
      if (Platform.OS === 'android') {
        const { SmsModule } = NativeModules;
        if (!SmsModule) {
          throw new Error('Módulo SMS não disponível');
        }

        const messages = await SmsModule.getUnreadMessages();
        return Array.isArray(messages) ? messages : [];
      }
      return [];
    } catch (error) {
      console.error('Erro ao obter mensagens não lidas:', error);
      return [];
    }
  }

  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const { SmsModule } = NativeModules;
        if (!SmsModule) {
          throw new Error('Módulo SMS não disponível');
        }

        return await SmsModule.markMessageAsRead(messageId);
      }
      return false;
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
      return false;
    }
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

export default SmsMonitorService; 