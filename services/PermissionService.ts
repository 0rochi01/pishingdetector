import { Platform, PermissionsAndroid, Linking } from 'react-native';
import * as SMS from 'expo-sms';
import * as MailComposer from 'expo-mail-composer';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PermissionStatus {
  sms: boolean;
  email: boolean;
  notifications: boolean;
  storage: boolean;
  ignoreBatteryOptimization: boolean;
}

class PermissionService {
  private static instance: PermissionService;
  private readonly STORAGE_KEY = '@phishing_detector:permissions';
  private permissions: PermissionStatus = {
    sms: false,
    email: false,
    notifications: false,
    storage: false,
    ignoreBatteryOptimization: false
  };

  private constructor() {}

  static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  async initialize(): Promise<void> {
    try {
      const savedPermissions = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (savedPermissions) {
        this.permissions = JSON.parse(savedPermissions);
      }
      
      // Verificar permissões atuais
      await this.checkAllPermissions();
    } catch (error) {
      console.error('Erro ao inicializar permissões:', error);
    }
  }

  async requestSmsPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          // Android 13+ requer permissão específica para SMS
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          
          const granted = 
            results[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;
            
          this.permissions.sms = granted;
          
          if (!granted) {
            // Se permissões foram negadas permanentemente, abrir configurações do app
            if (results[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
                results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              await this.openAppSettings();
            }
          }
        } else {
          // Android 12 e anteriores
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            {
              title: 'Permissão de SMS',
              message: 'O aplicativo precisa acessar seus SMS para detectar phishing',
              buttonNeutral: 'Perguntar depois',
              buttonNegative: 'Cancelar',
              buttonPositive: 'OK',
            }
          );

          this.permissions.sms = granted === PermissionsAndroid.RESULTS.GRANTED;
          
          if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            await this.openAppSettings();
          }
        }
      } else {
        const isAvailable = await SMS.isAvailableAsync();
        this.permissions.sms = isAvailable;
      }

      await this.savePermissions();
      return this.permissions.sms;
    } catch (error) {
      console.error('Erro ao solicitar permissão de SMS:', error);
      return false;
    }
  }

  async requestEmailPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          // Android 13+
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          
          const granted = 
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
            
          this.permissions.email = granted;
          
          if (!granted) {
            // Se permissões foram negadas permanentemente, abrir configurações do app
            if (results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
                results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
                results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              await this.openAppSettings();
            }
          }
        } else {
          // Android 12 e anteriores usam READ_EXTERNAL_STORAGE
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'Permissão de Email',
              message: 'O aplicativo precisa acessar seus emails para detectar phishing',
              buttonNeutral: 'Perguntar depois',
              buttonNegative: 'Cancelar',
              buttonPositive: 'OK',
            }
          );

          this.permissions.email = granted === PermissionsAndroid.RESULTS.GRANTED;
          
          if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            await this.openAppSettings();
          }
        }
      } else {
        const isAvailable = await MailComposer.isAvailableAsync();
        this.permissions.email = isAvailable;
      }

      await this.savePermissions();
      return this.permissions.email;
    } catch (error) {
      console.error('Erro ao solicitar permissão de email:', error);
      return false;
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      this.permissions.notifications = finalStatus === 'granted';
      
      if (finalStatus !== 'granted' && Platform.OS === 'android') {
        // Em Android, abrir as configurações de notificação
        await this.openNotificationSettings();
      }
      
      await this.savePermissions();
      return this.permissions.notifications;
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificações:', error);
      return false;
    }
  }

  async requestStoragePermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          // Android 13+
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          
          const granted = 
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
            
          this.permissions.storage = granted;
        } else if (Platform.Version >= 29) {
          // Android 10-12
          const readPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'Permissão de Armazenamento',
              message: 'O aplicativo precisa acessar o armazenamento para salvar dados',
              buttonNeutral: 'Perguntar depois',
              buttonNegative: 'Cancelar',
              buttonPositive: 'OK',
            }
          );

          this.permissions.storage = readPermission === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // Android 9 e anteriores
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          
          const granted = 
            results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
            
          this.permissions.storage = granted;
        }
      } else {
        // iOS não requer permissão explícita para armazenamento
        this.permissions.storage = true;
      }

      await this.savePermissions();
      return this.permissions.storage;
    } catch (error) {
      console.error('Erro ao solicitar permissão de armazenamento:', error);
      return false;
    }
  }

  async requestBatteryOptimizationExemption(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Abrir configurações de otimização de bateria
        if (Platform.Version >= 23) { // Android 6.0+
          await IntentLauncher.startActivityAsync(
            'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
            { data: `package:${Application.applicationId}` }
          );
          
          // Note que não podemos verificar programaticamente se a permissão foi concedida
          // Vamos assumir que foi concedida
          this.permissions.ignoreBatteryOptimization = true;
          await this.savePermissions();
        }
      }
      
      return this.permissions.ignoreBatteryOptimization;
    } catch (error) {
      console.error('Erro ao solicitar isenção de otimização de bateria:', error);
      return false;
    }
  }

  async openAppSettings(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync(
          'android.settings.APPLICATION_DETAILS_SETTINGS',
          { data: `package:${Application.applicationId}` }
        );
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Erro ao abrir configurações do app:', error);
    }
  }

  async openNotificationSettings(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 26) { // Android 8.0+
          await IntentLauncher.startActivityAsync(
            'android.settings.APP_NOTIFICATION_SETTINGS',
            { data: `package:${Application.applicationId}` }
          );
        } else {
          await this.openAppSettings();
        }
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Erro ao abrir configurações de notificação:', error);
    }
  }

  async checkAllPermissions(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        // Verificar permissões SMS
        if (Platform.Version >= 33) {
          const smsPermissions = [
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
          ];
          
          const smsResults = await PermissionsAndroid.requestMultiple(smsPermissions);
          
          this.permissions.sms = 
            smsResults[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
            smsResults[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          this.permissions.sms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
        }
        
        // Verificar permissões de armazenamento
        if (Platform.Version >= 33) {
          const mediaPermissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          ];
          
          const mediaResults = await PermissionsAndroid.requestMultiple(mediaPermissions);
          
          this.permissions.storage = 
            mediaResults[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED &&
            mediaResults[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED &&
            mediaResults[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
          
          // Para email, usamos as mesmas permissões de mídia
          this.permissions.email = this.permissions.storage;
        } else {
          this.permissions.storage = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          this.permissions.email = this.permissions.storage;
        }
      } else {
        // iOS
        const smsAvailable = await SMS.isAvailableAsync();
        this.permissions.sms = smsAvailable;
        
        const emailAvailable = await MailComposer.isAvailableAsync();
        this.permissions.email = emailAvailable;
        
        this.permissions.storage = true; // iOS não requer permissão para armazenamento
      }
      
      // Verificar permissões de notificação (cross-platform)
      const { status } = await Notifications.getPermissionsAsync();
      this.permissions.notifications = status === 'granted';
      
      // Salvar o estado atual das permissões
      await this.savePermissions();
      
      return { ...this.permissions };
    } catch (error) {
      console.error('Erro ao verificar todas as permissões:', error);
      return { ...this.permissions };
    }
  }

  private async savePermissions(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.permissions));
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
    }
  }
}

export default PermissionService; 