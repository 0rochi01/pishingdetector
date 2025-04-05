// Exportações diretas dos serviços
export { default as grokApiService } from './GrokApiService';
export { default as huggingFaceService } from './HuggingFaceService';

// Exportar instâncias das classes que já exportam singletons
export { default as notificationMonitorService } from './NotificationMonitorService';
export { default as backgroundTaskService } from './BackgroundTaskService';
export { default as phishingAlertService } from './PhishingAlertService';

// Importações e singletons para todos os serviços
import GrokApiService from './GrokApiService';
import GrokChatService from './GrokChatService';
import { HuggingFaceService } from './HuggingFaceService';
import PhishingDetectionService from './PhishingDetectionService';
import PhishingHistoryService from './PhishingHistoryService';
import NotificationService from './NotificationService';
import { NotificationMonitorService } from './NotificationMonitorService';
import { PhishingAlertService } from './PhishingAlertService';
import SmsMonitorService from './SmsMonitorService';
import { EmailMonitorService } from './EmailMonitorService';
import BackgroundTaskService from './BackgroundTaskService';
import VoiceTranscriptionService from './VoiceTranscriptionService';
import SettingsService from './SettingsService';
import HistoryService from './HistoryService';

// Exportar tipos essenciais
export * from './types';

// Exportar interfaces específicas dos serviços
export type { DeepSeekAnalysisResult } from './DeepSeekService';
export type { MonitorableMessage, NotificationMonitorCallbacks } from './NotificationMonitorService';

// Exportar classes dos serviços
export {
  GrokApiService,
  GrokChatService,
  HuggingFaceService,
  PhishingDetectionService,
  PhishingHistoryService,
  NotificationService,
  NotificationMonitorService,
  PhishingAlertService,
  SmsMonitorService,
  EmailMonitorService,
  BackgroundTaskService,
  VoiceTranscriptionService,
  SettingsService,
  HistoryService
};

// Instâncias singleton para acesso direto
// Estes são criados aqui para evitar ciclos de dependência
const phishingDetectionService = PhishingDetectionService.getInstance();
const phishingHistoryService = PhishingHistoryService.getInstance();
const grokChatService = GrokChatService.getInstance();
const notificationService = NotificationService.getInstance();
const smsMonitorService = SmsMonitorService.getInstance();
const emailMonitorService = EmailMonitorService.getInstance();
const voiceTranscriptionService = VoiceTranscriptionService.getInstance();
const settingsService = SettingsService.getInstance();
const historyService = HistoryService.getInstance();

export {
  phishingDetectionService,
  phishingHistoryService,
  grokChatService,
  notificationService,
  smsMonitorService,
  emailMonitorService,
  voiceTranscriptionService,
  settingsService,
  historyService
}; 