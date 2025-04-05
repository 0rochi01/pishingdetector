import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Permissions from 'expo-permissions';
import * as SMS from 'expo-sms';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

import grokApiService from './GrokApiService';
import huggingFaceService, { HuggingFaceAnalysisResult } from './HuggingFaceService';
import { PhishingAnalysisResult } from './types';

// Intervalo de escaneamento (em ms)
const SCAN_INTERVAL = 30000; // 30 segundos

// Tipo para representar uma notificação ou mensagem a ser analisada
export type MonitorableMessage = {
  id: string;
  source: 'notification' | 'sms' | 'email';
  sender: string;
  content: string;
  timestamp: Date;
  read: boolean;
};

// Tipo para callbacks do serviço de monitoramento
export type NotificationMonitorCallbacks = {
  onDetectPhishing?: (result: PhishingAnalysisResult, message: MonitorableMessage) => void;
  onError?: (error: Error, message?: MonitorableMessage) => void;
  onPermissionDenied?: (service: 'notification' | 'sms' | 'email') => void;
};

// Interface para o serviço de monitoramento
export interface NotificationMonitorServiceInterface {
  requestPermissions(): Promise<{
    notifications: boolean;
    sms: boolean;
    email: boolean;
  }>;
  startMonitoring(): Promise<void>;
  stopMonitoring(): void;
  setCallbacks(callbacks: NotificationMonitorCallbacks): void;
  analyzeMessage(message: MonitorableMessage): Promise<PhishingAnalysisResult>;
  scanMessagesAndEmails(): Promise<void>;
  handleNotificationReceived(notification: Notifications.Notification): Promise<void>;
}

// Implementação do serviço de monitoramento
export class NotificationMonitorService implements NotificationMonitorServiceInterface {
  private isMonitoring: boolean = false;
  private callbacks: NotificationMonitorCallbacks = {};
  private notificationSubscription: any = null;
  private scanInterval: NodeJS.Timeout | null = null;
  private pendingAnalysis: Set<string> = new Set(); // Para evitar análise duplicada
  private lastScanTimestamp: number = 0; // Timestamp da última verificação
  private notificationHistory: MonitorableMessage[] = [];
  
  // Configura os callbacks
  public setCallbacks(callbacks: NotificationMonitorCallbacks): void {
    this.callbacks = callbacks;
  }
  
  // Solicita todas as permissões necessárias
  public async requestPermissions(): Promise<{
    notifications: boolean;
    sms: boolean;
    email: boolean;
  }> {
    const results = {
      notifications: false,
      sms: false,
      email: false
    };
    
    // Solicita permissão para notificações com opções mais avançadas
    try {
      await Notifications.setNotificationCategoryAsync('phishing', [
        {
          identifier: 'block',
          buttonTitle: 'Bloquear',
          options: {
            isDestructive: true,
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'analyze',
          buttonTitle: 'Analisar',
          options: {
            isDestructive: false,
            opensAppToForeground: true,
          },
        },
      ]);
      
      // Solicita permissões com configurações específicas
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
          provideAppNotificationSettings: true,
        },
      });
      
      results.notifications = notificationStatus === 'granted';
      
      if (!results.notifications && this.callbacks.onPermissionDenied) {
        this.callbacks.onPermissionDenied('notification');
      }
    } catch (error) {
      console.error('Erro ao solicitar permissões de notificação:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
    
    // Verifica e solicita acesso a SMS (quando possível)
    try {
      const isSMSAvailable = await SMS.isAvailableAsync();
      results.sms = isSMSAvailable;
      
      if (isSMSAvailable && Platform.OS === 'android') {
        // No Android, você pode precisar verificar ou solicitar permissões adicionais
        this.requestAndroidSMSPermission();
      }
      
      if (!results.sms && this.callbacks.onPermissionDenied) {
        this.callbacks.onPermissionDenied('sms');
      }
    } catch (error) {
      results.sms = false;
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error('Falha ao verificar disponibilidade de SMS'));
      }
    }
    
    // Verifica e solicita acesso a email
    try {
      const isEmailAvailable = await MailComposer.isAvailableAsync();
      results.email = isEmailAvailable;
      
      if (!results.email && this.callbacks.onPermissionDenied) {
        this.callbacks.onPermissionDenied('email');
      }
    } catch (error) {
      results.email = false;
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error('Falha ao verificar disponibilidade de email'));
      }
    }
    
    // Tenta acessar diretório de armazenamento (para logs e cache)
    try {
      const dir = `${FileSystem.documentDirectory}phishing_detector`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch (error) {
      console.error('Erro ao configurar diretório de armazenamento:', error);
    }
    
    return results;
  }
  
  // Solicita permissão para ler SMS no Android (função simulada - exigiria código nativo)
  private async requestAndroidSMSPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    // No ambiente real, isso exigiria um módulo nativo para solicitar permissão
    // Aqui, simulamos essa solicitação com uma mensagem no console
    console.log('Solicitando permissão para ler SMS no Android');
    
    return true;
  }
  
  // Inicia o monitoramento
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    try {
      // Configuração avançada para receber notificações mesmo quando o app está em background
      await Notifications.setNotificationChannelAsync('phishing_alerts', {
        name: 'Alertas de Phishing',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      
      // Configura o recebimento de notificações mesmo em background
      await Notifications.registerTaskAsync('BACKGROUND_NOTIFICATION_TASK');
      
      // Configura o tratamento de notificações recebidas
      this.notificationSubscription = Notifications.addNotificationReceivedListener(
        this.handleNotificationReceived.bind(this)
      );
      
      // Configura escaneamento periódico
      this.scanInterval = setInterval(this.scanMessagesAndEmails.bind(this), SCAN_INTERVAL);
      
      // Realiza um scan inicial
      this.scanMessagesAndEmails();
      
      this.isMonitoring = true;
      
      // Registra início do monitoramento
      await this.logMonitoringStatus(true);
    } catch (error) {
      console.error('Erro ao iniciar monitoramento:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
      throw error;
    }
  }
  
  // Para o monitoramento
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    if (this.notificationSubscription) {
      Notifications.removeNotificationSubscription(this.notificationSubscription);
      this.notificationSubscription = null;
    }
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    this.isMonitoring = false;
    
    // Registra parada do monitoramento
    this.logMonitoringStatus(false).catch(error => {
      console.error('Erro ao registrar parada de monitoramento:', error);
    });
  }
  
  // Analisa uma mensagem usando o serviço HuggingFace para detecção rápida
  public async analyzeMessage(message: MonitorableMessage): Promise<PhishingAnalysisResult> {
    try {
      // Verifica se esta mensagem já está sendo analisada
      if (this.pendingAnalysis.has(message.id)) {
        throw new Error('Mensagem já está em análise');
      }
      
      // Marca como pendente
      this.pendingAnalysis.add(message.id);
      
      try {
        // Adiciona à história de notificações
        this.notificationHistory.push(message);
        
        // Limita o histórico para as últimas 100 mensagens
        if (this.notificationHistory.length > 100) {
          this.notificationHistory = this.notificationHistory.slice(-100);
        }
        
        // Salva histórico no armazenamento
        await this.saveNotificationHistory();
        
        // Utiliza o HuggingFace para análise rápida
        const hfResult: HuggingFaceAnalysisResult = await huggingFaceService.analyzeContent(message.content);
        
        // Mapeia o resultado do HuggingFace para o formato PhishingAnalysisResult
        const result: PhishingAnalysisResult = {
          classification: hfResult.isPhishing ? 'red' : 'green',
          confidence: hfResult.confidence,
          explanation: hfResult.explanation || '',
          detectedThreats: {
            suspiciousLinks: hfResult.suspiciousUrls || [],
            sensitiveDataRequests: [],
            urgentLanguage: [],
            otherThreats: hfResult.suspiciousWords || []
          },
          suggestedActions: hfResult.isPhishing ? 
            ['Não clique em links suspeitos', 'Não responda a esta mensagem', 'Reporte como spam'] : 
            []
        };
        
        // Se não for seguro, notifica via callback
        if (result.classification !== 'green' && this.callbacks.onDetectPhishing) {
          this.callbacks.onDetectPhishing(result, message);
        }
        
        return result;
      } finally {
        // Remover da lista de pendentes mesmo em caso de erro
        this.pendingAnalysis.delete(message.id);
      }
    } catch (error) {
      console.error('Erro ao analisar mensagem:', error);
      
      // Criar um resultado padrão para erro
      const fallbackResult: PhishingAnalysisResult = {
        classification: 'yellow',
        confidence: 0.5,
        explanation: 'Erro ao analisar a mensagem. Tenha cuidado ao interagir com este conteúdo.',
        detectedThreats: {
          suspiciousLinks: [],
          sensitiveDataRequests: [],
          urgentLanguage: [],
          otherThreats: []
        },
        suggestedActions: ['Verifique novamente mais tarde']
      };
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error, message);
      }
      
      return fallbackResult;
    }
  }
  
  // Manipula notificações recebidas
  public async handleNotificationReceived(notification: Notifications.Notification): Promise<void> {
    try {
      const { title, body, data } = notification.request.content;
      
      if (!body) return;
      
      console.log('Notificação recebida:', { title, body, data });
      
      const message: MonitorableMessage = {
        id: notification.request.identifier,
        source: 'notification',
        sender: title || 'Desconhecido',
        content: body,
        timestamp: new Date(),
        read: false
      };
      
      await this.analyzeMessage(message);
    } catch (error) {
      console.error('Erro ao processar notificação recebida:', error);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }
  
  // Escaneia mensagens e emails
  public async scanMessagesAndEmails(): Promise<void> {
    const currentTime = Date.now();
    this.lastScanTimestamp = currentTime;
    
    try {
      // Registro de escaneamento no log
      console.log(`Escaneamento iniciado: ${new Date().toISOString()}`);
      
      // Em um app real, estas chamadas acessariam APIs nativas mais profundas
      if (Platform.OS === 'android') {
        await this.scanAndroidSMS();
      }
      
      // Escaneia emails
      await this.scanEmails();
      
      console.log(`Escaneamento concluído: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Erro durante o escaneamento periódico:', error);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }
  
  // Scaneia SMS no Android (simulado, exigiria um módulo nativo)
  private async scanAndroidSMS(): Promise<void> {
    if (Platform.OS !== 'android') return;
    
    try {
      console.log('Escaneando SMS no Android...');
      
      // No ambiente real, implementaria uma ponte nativa para o ContentResolver do Android
      // para acessar os SMS mais recentes através da URI "content://sms/inbox"
      
      // Simulação para demonstração - em um app real, isso seria substituído
      // pela lógica real de acesso aos SMS via módulo nativo
      this.simulateSMSReading();
    } catch (error) {
      console.error('Erro ao escanear SMS:', error);
      throw error;
    }
  }
  
  // Simula a leitura de SMS para demonstração
  private simulateSMSReading(): void {
    // Em um ambiente real, isso teria uma implementação nativa
    // Aqui apenas simulamos o processo
    
    // A implementação real usaria algo como:
    /*
    NativeModules.SMSReader.getRecentMessages(10, (error, messages) => {
      if (error) {
        console.error('Erro ao ler SMS:', error);
        return;
      }
      
      messages.forEach(async (sms) => {
        // Processar cada SMS
        const message: MonitorableMessage = {
          id: `sms-${sms.id}`,
          source: 'sms',
          sender: sms.address,
          content: sms.body,
          timestamp: new Date(sms.date),
          read: sms.read === 1
        };
        
        await this.analyzeMessage(message);
      });
    });
    */
  }
  
  // Scaneia emails (simulado, exigiria um módulo nativo ou integração com APIs)
  private async scanEmails(): Promise<void> {
    try {
      console.log('Escaneando emails...');
      
      // No ambiente real, isso poderia ser implementado de várias formas:
      // 1. Módulo nativo para acessar emails via APIs do sistema (mais difícil)
      // 2. Integração com APIs externas como Gmail API (exige autenticação OAuth)
      // 3. Backend próprio que receba emails e os encaminhe ao app (mais seguro)
      
      // A simulação seria semelhante à dos SMS
      this.simulateEmailReading();
    } catch (error) {
      console.error('Erro ao escanear emails:', error);
      throw error;
    }
  }
  
  // Simula a leitura de emails para demonstração
  private simulateEmailReading(): void {
    // Em um ambiente real, isso teria uma implementação completa
    // Aqui apenas simulamos o processo
    
    // A implementação real usaria algo como:
    /*
    NativeModules.EmailReader.getRecentEmails(10, (error, emails) => {
      if (error) {
        console.error('Erro ao ler emails:', error);
        return;
      }
      
      emails.forEach(async (email) => {
        // Processar cada email
        const message: MonitorableMessage = {
          id: `email-${email.id}`,
          source: 'email',
          sender: email.from,
          content: email.subject + '\n\n' + email.body,
          timestamp: new Date(email.date),
          read: email.read
        };
        
        await this.analyzeMessage(message);
      });
    });
    */
  }
  
  // Salva histórico de notificações
  private async saveNotificationHistory(): Promise<void> {
    try {
      const historyPath = `${FileSystem.documentDirectory}phishing_detector/history.json`;
      await FileSystem.writeAsStringAsync(
        historyPath, 
        JSON.stringify(this.notificationHistory),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Erro ao salvar histórico de notificações:', error);
    }
  }
  
  // Carrega histórico de notificações
  private async loadNotificationHistory(): Promise<void> {
    try {
      const historyPath = `${FileSystem.documentDirectory}phishing_detector/history.json`;
      const fileInfo = await FileSystem.getInfoAsync(historyPath);
      
      if (!fileInfo.exists) {
        return;
      }
      
      const content = await FileSystem.readAsStringAsync(historyPath, { 
        encoding: FileSystem.EncodingType.UTF8 
      });
      
      const history = JSON.parse(content) as MonitorableMessage[];
      
      // Converte strings de data para objetos Date
      this.notificationHistory = history.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Erro ao carregar histórico de notificações:', error);
    }
  }
  
  // Registra status de monitoramento
  private async logMonitoringStatus(isActive: boolean): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action: isActive ? 'start' : 'stop',
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
          deviceName: Constants.deviceName,
          appVersion: Constants.expoConfig?.version || '1.0.0'
        }
      };
      
      const logPath = `${FileSystem.documentDirectory}phishing_detector/monitoring_log.json`;
      
      // Lê log existente ou cria novo
      let log: any[] = [];
      try {
        const fileInfo = await FileSystem.getInfoAsync(logPath);
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(logPath);
          log = JSON.parse(content);
        }
      } catch (e) {
        // Ignora erros na leitura do log existente
      }
      
      // Adiciona nova entrada
      log.push(logEntry);
      
      // Limita o tamanho do log
      if (log.length > 1000) {
        log = log.slice(-1000);
      }
      
      // Salva log atualizado
      await FileSystem.writeAsStringAsync(logPath, JSON.stringify(log));
    } catch (error) {
      console.error('Erro ao registrar status de monitoramento:', error);
    }
  }
}

// Instância singleton do serviço
export const notificationMonitorService = new NotificationMonitorService();

export default notificationMonitorService; 