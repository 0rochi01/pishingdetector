import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsService from './SettingsService';

// Interface simplificada apenas para uso interno
interface Settings {
  enableNotifications?: boolean;
  enableVibration?: boolean;
}

class NotificationService {
  private static instance: NotificationService;
  private readonly STORAGE_KEY = '@phishing_detector:notification_token';
  private isInitialized: boolean = false;
  private settingsService: SettingsService;
  
  private constructor() {
    this.settingsService = SettingsService.getInstance();
    this.setupNotifications();
  }
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
  
  private async setupNotifications() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('phishing-alerts', {
        name: 'Alertas de Phishing',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    // Configurar como as notificações são mostradas quando o app está aberto
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    
    this.isInitialized = true;
  }
  
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Notificações não são suportadas em emuladores');
      return false;
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permissão para notificações não concedida');
      return false;
    }
    
    return true;
  }
  
  async sendNotification(title: string, body: string, data: object = {}) {
    if (!this.isInitialized) {
      await this.setupNotifications();
    }
    
    const settings = await this.settingsService.getSettings() as unknown as Settings;
    
    // Verificações de segurança para propriedades opcionais
    const enableNotifications = settings?.enableNotifications ?? true;
    const enableVibration = settings?.enableVibration ?? true;
    
    if (!enableNotifications) {
      console.log('Notificações desativadas nas configurações');
      return;
    }
    
    // Vibrar se ativado nas configurações
    if (enableVibration && Platform.OS === 'android') {
      try {
        Vibration.vibrate([0, 250, 250, 250]);
      } catch (error) {
        console.error('Erro ao vibrar dispositivo:', error);
      }
    }
    
    // Enviar notificação
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Mostra imediatamente
    });
  }
  
  async clearNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export default NotificationService; 