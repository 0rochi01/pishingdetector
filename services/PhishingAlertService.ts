import { Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

import { PhishingAnalysisResult } from './GrokApiService';
import { MonitorableMessage } from './NotificationMonitorService';

// Interface para o serviço de alerta
export interface PhishingAlertServiceInterface {
  alertUser(result: PhishingAnalysisResult, message: MonitorableMessage): Promise<void>;
  blockSender(message: MonitorableMessage): Promise<boolean>;
  addToSafeList(sender: string): void;
  addToWatchList(sender: string): void;
  addToBlockList(sender: string): void;
  getSafeList(): string[];
  getWatchList(): string[];
  getBlockList(): string[];
}

// Implementação do serviço de alerta
export class PhishingAlertService implements PhishingAlertServiceInterface {
  private safeList: Set<string> = new Set();
  private watchList: Set<string> = new Set();
  private blockList: Set<string> = new Set();
  private alertSound: Audio.Sound | null = null;
  
  constructor() {
    this.loadSound();
  }
  
  // Carrega o som de alerta
  private async loadSound(): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/alert.mp3')
      );
      this.alertSound = sound;
    } catch (error) {
      console.error('Erro ao carregar som de alerta:', error);
    }
  }
  
  // Alerta o usuário com base na classificação
  public async alertUser(result: PhishingAnalysisResult, message: MonitorableMessage): Promise<void> {
    switch (result.classification) {
      case 'red':
        await this.alertRedThreat(result, message);
        break;
      case 'yellow':
        await this.alertYellowWarning(result, message);
        break;
      case 'green':
        // Nenhuma ação necessária para mensagens seguras
        break;
    }
  }
  
  // Alerta para ameaças vermelhas (alto risco)
  private async alertRedThreat(result: PhishingAnalysisResult, message: MonitorableMessage): Promise<void> {
    // Vibração forte e contínua
    if (Platform.OS === 'ios') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (error) {
        console.error('Erro ao usar haptics:', error);
      }
    } else {
      Vibration.vibrate([500, 300, 500, 300]);
    }
    
    // Som de alerta
    if (this.alertSound) {
      try {
        await this.alertSound.setVolumeAsync(1.0);
        await this.alertSound.playAsync();
      } catch (error) {
        console.error('Erro ao reproduzir som de alerta:', error);
      }
    }
    
    // Bloqueia o remetente automaticamente
    await this.blockSender(message);
    
    // Em uma implementação real, aqui você poderia:
    // 1. Mostrar uma notificação de sistema crítica
    // 2. Enviar dados para um servidor central para análise adicional
    // 3. Salvar o evento em um log de segurança local
    console.log('Alerta vermelho emitido:', message.sender);
  }
  
  // Alerta para avisos amarelos (risco moderado)
  private async alertYellowWarning(result: PhishingAnalysisResult, message: MonitorableMessage): Promise<void> {
    // Vibração suave
    if (Platform.OS === 'ios') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (error) {
        console.error('Erro ao usar haptics:', error);
      }
    } else {
      Vibration.vibrate(300);
    }
    
    // Som de alerta em volume mais baixo
    if (this.alertSound) {
      try {
        await this.alertSound.setVolumeAsync(0.5);
        await this.alertSound.playAsync();
      } catch (error) {
        console.error('Erro ao reproduzir som de alerta:', error);
      }
    }
    
    // Adiciona o remetente à lista de observação
    this.addToWatchList(message.sender);
    
    // Em uma implementação real, aqui você poderia:
    // 1. Mostrar uma notificação de sistema de nível médio
    // 2. Sugerir ao usuário revisar a mensagem com cuidado
    console.log('Alerta amarelo emitido:', message.sender);
  }
  
  // Bloqueia um remetente
  public async blockSender(message: MonitorableMessage): Promise<boolean> {
    try {
      this.addToBlockList(message.sender);
      
      // Em uma implementação real, aqui você interagiria com as APIs do sistema
      // para bloquear notificações deste remetente
      console.log(`Remetente bloqueado: ${message.sender}`);
      
      return true;
    } catch (error) {
      console.error('Erro ao bloquear remetente:', error);
      return false;
    }
  }
  
  // Adiciona um remetente à lista segura
  public addToSafeList(sender: string): void {
    this.safeList.add(sender);
    this.watchList.delete(sender);
    this.blockList.delete(sender);
  }
  
  // Adiciona um remetente à lista de observação
  public addToWatchList(sender: string): void {
    if (!this.safeList.has(sender) && !this.blockList.has(sender)) {
      this.watchList.add(sender);
    }
  }
  
  // Adiciona um remetente à lista de bloqueio
  public addToBlockList(sender: string): void {
    this.blockList.add(sender);
    this.safeList.delete(sender);
    this.watchList.delete(sender);
  }
  
  // Obtém a lista segura
  public getSafeList(): string[] {
    return Array.from(this.safeList);
  }
  
  // Obtém a lista de observação
  public getWatchList(): string[] {
    return Array.from(this.watchList);
  }
  
  // Obtém a lista de bloqueio
  public getBlockList(): string[] {
    return Array.from(this.blockList);
  }
}

// Instância singleton do serviço
export const phishingAlertService = new PhishingAlertService();

export default phishingAlertService; 