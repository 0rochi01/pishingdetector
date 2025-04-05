/**
 * Tipos de serviços para o Detector de Phishing
 */

// Para o serviço da API Grok
export interface PhishingAnalysisResult {
  // Classification pode ser red (alto risco), yellow (médio risco), ou green (baixo risco)
  classification: 'red' | 'yellow' | 'green';
  
  // Explicação do resultado da análise
  explanation: string;
  
  // Nível de confiança da análise (0-1)
  confidence: number;
  
  // Ameaças detectadas (opcional)
  detectedThreats?: {
    suspiciousLinks?: string[];
    sensitiveDataRequests?: string[];
    urgentLanguage?: string[];
    otherThreats?: string[];
  };
  
  // Ações sugeridas (opcional)
  suggestedActions?: string[];
}

// Para o serviço de monitoramento de notificações
export interface MonitorableMessage {
  id: string;
  source: 'notification' | 'sms' | 'email';
  title?: string;
  content: string;
  sender?: string;
  timestamp: Date;
}

// Callbacks para o serviço de monitoramento
export interface MonitorCallbacks {
  onDetectPhishing: (message: MonitorableMessage, result: PhishingAnalysisResult) => void;
  onError: (error: Error) => void;
  onPermissionDenied: (type: 'notifications' | 'sms' | 'email') => void;
}

// Permissões para o serviço de monitoramento
export interface MonitorPermissions {
  notifications: boolean;
  sms: boolean;
  email: boolean;
}

// Tipos para o PhishingAlertService
export type ThreatLevel = 'high' | 'medium' | 'low'; 