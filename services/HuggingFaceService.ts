import axios from 'axios';
import { PhishingAnalysisResult } from './types';

// Configuração da API HuggingFace
const HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models";
const HUGGINGFACE_API_KEY = ""; // Token gratuito para testes
const HUGGINGFACE_MODEL = "facebook/bart-large"; // Modelo gratuito adequado para classificação de texto

// Interface para resultados da análise
export interface HuggingFaceAnalysisResult {
  isPhishing: boolean;
  confidence: number;
  explanation: string;
  suspiciousWords?: string[];
  suspiciousUrls?: string[];
  details?: {
    suspiciousWords?: string[];
    suspiciousUrls?: string[];
  };
}

// Interface para o serviço
export interface PhishingDetectionService {
  analyzeContent(content: string): Promise<HuggingFaceAnalysisResult>;
  getExplanation(content: string, isPhishing: boolean, confidence: number): Promise<string>;
}

// Implementação do serviço
export class HuggingFaceService implements PhishingDetectionService {
  constructor() {
    console.log('HuggingFaceService inicializado para detecção de phishing');
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`
    };
  }

  async analyzeContent(content: string): Promise<HuggingFaceAnalysisResult> {
    // Verificação preliminar: mensagens muito curtas ou vazias
    if (!content || content.trim().length < 15) {
      console.log('Conteúdo muito curto, pulando análise da API...');
      return {
        isPhishing: false,
        confidence: 0.9,
        explanation: 'Conteúdo muito curto para análise',
        suspiciousWords: [],
        suspiciousUrls: [],
        details: {
          suspiciousWords: [],
          suspiciousUrls: []
        }
      };
    }
    
    // Para notificações do sistema ou mensagens claramente seguras, evitar chamar API
    if (this.isSafeSystemMessage(content)) {
      console.log('Mensagem de sistema segura detectada, pulando análise da API...');
      return {
        isPhishing: false,
        confidence: 0.95,
        explanation: 'Mensagem de sistema ou notificação segura',
        suspiciousWords: [],
        suspiciousUrls: [],
        details: {
          suspiciousWords: [],
          suspiciousUrls: []
        }
      };
    }

    try {
      console.log('Enviando requisição para a API HuggingFace...');
      
      // Usando Zero-Shot Classification
      const response = await axios.post(
        `${HUGGINGFACE_API_URL}/facebook/bart-large-mnli`,
        {
          inputs: content,
          parameters: {
            candidate_labels: ["phishing", "legitimate"]
          }
        },
        { headers: this.getHeaders(), timeout: 10000 }
      );

      if (response.data && response.data.labels && response.data.scores) {
        // Extrair resultados de classificação
        const phishingIndex = response.data.labels.indexOf("phishing");
        const legitimateIndex = response.data.labels.indexOf("legitimate");
        
        let isPhishing = false;
        let confidence = 0.5;
        
        if (phishingIndex !== -1 && legitimateIndex !== -1) {
          const phishingScore = response.data.scores[phishingIndex];
          const legitimateScore = response.data.scores[legitimateIndex];
          
          isPhishing = phishingScore > legitimateScore;
          confidence = isPhishing ? phishingScore : legitimateScore;
        }
        
        // Extrair palavras e URLs suspeitos localmente
        const suspiciousWords = this.extractSuspiciousWords(content);
        const suspiciousUrls = this.extractUrls(content);
        
        return {
          isPhishing: isPhishing,
          confidence: confidence,
          explanation: isPhishing 
            ? "Esta mensagem foi classificada como possível phishing pela análise de conteúdo" 
            : "Esta mensagem parece ser legítima",
          suspiciousWords: suspiciousWords,
          suspiciousUrls: suspiciousUrls,
          details: {
            suspiciousWords: suspiciousWords,
            suspiciousUrls: suspiciousUrls
          }
        };
      }
      
      throw new Error('Formato de resposta inesperado da API HuggingFace');
    } catch (error: unknown) {
      // Verifica se é um erro de Axios
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`Erro na requisição HuggingFace: Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
          console.error('Sem resposta do servidor HuggingFace. Verifique sua conexão com a internet:', error.message);
        } else {
          console.error('Erro ao configurar requisição HuggingFace:', error.message);
        }
      } else {
        console.error('Erro na análise de phishing com HuggingFace:', error);
      }
      
      // Em caso de erro na API, realizar análise local básica
      console.log('Utilizando análise local como fallback...');
      const isPhishing = this.basicPhishingCheck(content);
      const suspiciousWords = this.extractSuspiciousWords(content);
      const suspiciousUrls = this.extractUrls(content);
      
      return {
        isPhishing: isPhishing,
        confidence: isPhishing ? 0.6 : 0.2,
        explanation: 'Análise baseada em verificações locais básicas devido a erro na API.',
        suspiciousWords: suspiciousWords,
        suspiciousUrls: suspiciousUrls,
        details: {
          suspiciousWords: suspiciousWords,
          suspiciousUrls: suspiciousUrls
        }
      };
    }
  }

  async getExplanation(content: string, isPhishing: boolean, confidence: number): Promise<string> {
    try {
      console.log('Solicitando explicação à API HuggingFace...');
      
      const prompt = `Analise o seguinte texto que foi classificado como ${isPhishing ? 'phishing' : 'legítimo'} com confiança de ${Math.round(confidence * 100)}%:
      
      "${content.substring(0, 500)}${content.length > 500 ? '...' : ''}"
      
      Explique em 2-3 frases curtas por que este texto ${isPhishing ? 'parece ser phishing' : 'parece ser legítimo'}.`;
      
      const response = await axios.post(
        `${HUGGINGFACE_API_URL}/gpt2`,
        {
          inputs: prompt,
          parameters: {
            max_length: 150,
            temperature: 0.3
          }
        },
        { headers: this.getHeaders(), timeout: 5000 }
      );

      if (response.data && typeof response.data[0].generated_text === 'string') {
        // Extrair apenas a parte relevante da resposta
        let explanation = response.data[0].generated_text.replace(prompt, '').trim();
        
        // Limitar tamanho
        if (explanation.length > 200) {
          explanation = explanation.substring(0, 200) + '...';
        }
        
        return explanation;
      }
      
      throw new Error('Formato de resposta inesperado da API HuggingFace');
    } catch (error: unknown) {
      console.log('Erro ao obter explicação, retornando explicação padrão...');
      
      // Explicação padrão em caso de erro
      if (isPhishing) {
        return 'Este conteúdo apresenta características típicas de tentativas de phishing, como solicitação de dados sensíveis, urgência, ou links suspeitos.';
      } else {
        return 'Este conteúdo não apresenta os sinais típicos de phishing, como urgência excessiva ou solicitação de informações confidenciais.';
      }
    }
  }

  // Verifica se é uma mensagem de sistema ou notificação claramente segura
  private isSafeSystemMessage(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Lista de padrões de notificações seguras comuns
    const safePatterns = [
      'bateria',
      'atualização disponível',
      'conectado',
      'backup concluído',
      'sincronização completada',
      'novo aplicativo instalado',
      'clima',
      'temperatura',
      'proteção ativa',
      'monitorando',
      'verificação concluída',
      'lembrando',
      'lembre-se',
      'alarme'
    ];
    
    // Se o conteúdo contém padrões típicos de mensagens do sistema
    for (const pattern of safePatterns) {
      if (lowerContent.includes(pattern)) {
        return true;
      }
    }
    
    // Mensagens de aplicativos conhecidos sem links suspeitos
    const knownApps = [
      'google',
      'microsoft',
      'whatsapp',
      'instagram',
      'facebook',
      'calendário',
      'relógio',
      'alarme',
      'app store',
      'play store'
    ];
    
    // Verifica por apps conhecidos sem URLs ou solicitações
    for (const app of knownApps) {
      if (lowerContent.includes(app) && 
          !lowerContent.includes('senha') && 
          !lowerContent.includes('login') && 
          !lowerContent.includes('clique') && 
          !lowerContent.includes('http')) {
        return true;
      }
    }
    
    return false;
  }

  // Métodos auxiliares para análise local em caso de falha da API
  private basicPhishingCheck(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Palavras suspeitas em português
    const suspiciousWords = [
      'senha', 'credenciais', 'login', 'conta', 'banco', 'cartão', 
      'atualizar', 'verificar', 'confirmar', 'urgente', 'imediato',
      'suspensão', 'bloqueio', 'clique', 'link', 'limitado',
      'prêmio', 'ganhou', 'grátis', 'vencimento', 'pagamento'
    ];
    
    // Contagem de palavras suspeitas
    let suspiciousCount = 0;
    for (const word of suspiciousWords) {
      if (lowerContent.includes(word)) {
        suspiciousCount++;
      }
    }
    
    // Verificar padrões de URL
    const hasUrls = /https?:\/\/[^\s]+/.test(content);
    const hasSuspiciousUrlPatterns = /(bit\.ly|tinyurl|goo\.gl|encurtador|clique aqui|acesse agora)/i.test(content);
    
    // Verificar solicitação de informações sensíveis
    const requestsSensitiveInfo = 
      lowerContent.includes('cpf') || 
      lowerContent.includes('senha') || 
      lowerContent.includes('cartão de crédito') || 
      lowerContent.includes('código de segurança');
    
    // Verificar senso de urgência
    const createsUrgency = 
      lowerContent.includes('urgente') || 
      lowerContent.includes('imediato') || 
      lowerContent.includes('agora') ||
      lowerContent.includes('rápido') ||
      lowerContent.includes('última chance');
    
    // Determinar se é phishing com base nos sinais encontrados
    return (suspiciousCount >= 3) || 
           (hasUrls && hasSuspiciousUrlPatterns) ||
           (requestsSensitiveInfo && hasUrls) ||
           (createsUrgency && (requestsSensitiveInfo || hasSuspiciousUrlPatterns));
  }
  
  private extractSuspiciousWords(content: string): string[] {
    const lowerContent = content.toLowerCase();
    const result: string[] = [];
    
    // Lista de palavras/frases suspeitas em português
    const suspiciousTerms = [
      'senha', 'credenciais', 'login', 'conta', 'banco', 'cartão', 
      'atualizar', 'verificar', 'confirmar', 'urgente', 'imediato',
      'suspensão', 'bloqueio', 'clique', 'link', 'limitado',
      'prêmio', 'ganhou', 'grátis', 'vencimento', 'pagamento',
      'cpf', 'dados pessoais', 'código de segurança', 'pix',
      'transferência', 'validar', 'verificação', 'restrito',
      'exclusivo', 'oferta', 'promoção', 'restrito', 'acesso'
    ];
    
    // Procurar cada termo no conteúdo
    for (const term of suspiciousTerms) {
      if (lowerContent.includes(term)) {
        result.push(term);
      }
    }
    
    return result;
  }
  
  private extractUrls(content: string): string[] {
    // Expressão regular para encontrar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlRegex);
    
    return matches || [];
  }
}

// Instância singleton
export const huggingFaceService = new HuggingFaceService();
export default huggingFaceService; 