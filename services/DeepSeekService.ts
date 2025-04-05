import axios from 'axios';
import { PhishingAnalysisResult } from './types';

// Configurações da API DeepSeek
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = "sk-b11d16b5644048d1bf490b73783fa5a1";
const DEEPSEEK_MODEL = "deepseek-lite"; // Modelo mais leve e potencialmente gratuito

// Configuração de fallback
const USAR_ANALISE_LOCAL_SE_ERRO = true;
const MAX_TENTATIVAS_API = 1;
const INTERVALO_ENTRE_TENTATIVAS = 2000; // 2 segundos

// Resultado da análise de phishing pelo DeepSeek
export interface DeepSeekAnalysisResult {
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

// Interface para o serviço de detecção de phishing
export interface PhishingDetectionService {
  analyzeContent(content: string): Promise<DeepSeekAnalysisResult>;
  getExplanation(content: string, isPhishing: boolean, confidence: number): Promise<string>;
}

// Implementação do serviço de detecção de phishing usando DeepSeek
export class DeepSeekService implements PhishingDetectionService {
  constructor() {
    console.log('DeepSeekService inicializado para detecção rápida de phishing');
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    };
  }

  async analyzeContent(content: string): Promise<DeepSeekAnalysisResult> {
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
      const systemPrompt = `Você é um detector de phishing especializado e super eficiente. 
      Analise o texto fornecido e determine se contém phishing. 
      Responda APENAS com um JSON no formato:
      {
        "isPhishing": boolean,
        "confidence": number, // 0.0-1.0
        "explanation": "explicação curta",
        "suspiciousWords": ["palavra1", "palavra2"],
        "suspiciousUrls": ["url1", "url2"]
      }`;

      console.log('Enviando requisição para a API DeepSeek...');
      
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: content }
          ],
          max_tokens: 800,
          temperature: 0.2
        },
        { headers: this.getHeaders(), timeout: 5000 }
      );

      if (response.data && response.data.choices && response.data.choices[0]?.message?.content) {
        const responseText = response.data.choices[0].message.content;
        
        try {
          // Extrair o JSON da resposta
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            return {
              isPhishing: result.isPhishing === true,
              confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
              explanation: result.explanation || 'Sem explicação fornecida',
              suspiciousWords: Array.isArray(result.suspiciousWords) ? result.suspiciousWords : [],
              suspiciousUrls: Array.isArray(result.suspiciousUrls) ? result.suspiciousUrls : [],
              details: {
                suspiciousWords: Array.isArray(result.details?.suspiciousWords) ? result.details.suspiciousWords : [],
                suspiciousUrls: Array.isArray(result.details?.suspiciousUrls) ? result.details.suspiciousUrls : []
              }
            };
          }
        } catch (parseError) {
          console.error('Erro ao analisar resposta JSON do DeepSeek:', parseError);
        }
        
        // Fallback: verificar palavras-chave na resposta
        const isPhishing = responseText.toLowerCase().includes('phishing') || 
                          responseText.toLowerCase().includes('suspicious') ||
                          responseText.toLowerCase().includes('fraudulent');
        
        return {
          isPhishing: isPhishing,
          confidence: isPhishing ? 0.7 : 0.3,
          explanation: responseText,
          suspiciousWords: [],
          suspiciousUrls: [],
          details: {
            suspiciousWords: [],
            suspiciousUrls: []
          }
        };
      }
      
      throw new Error('Formato de resposta inesperado da API DeepSeek');
    } catch (error: unknown) {
      // Verifica se é um erro de Axios
      if (axios.isAxiosError(error)) {
        // Erro 402 indica problema com pagamento ou créditos
        if (error.response?.status === 402) {
          console.error('ERRO 402: Pagamento requerido na API DeepSeek. Verifique o status da sua conta e créditos disponíveis.');
        } else if (error.response) {
          console.error(`Erro na requisição DeepSeek: Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
          console.error('Sem resposta do servidor DeepSeek. Verifique sua conexão com a internet:', error.message);
        } else {
          console.error('Erro ao configurar requisição DeepSeek:', error.message);
        }
      } else {
        console.error('Erro na análise de phishing com DeepSeek:', error);
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
      const systemPrompt = `Você é um especialista em segurança digital que analisa resultados de detecção de phishing.
      Explique brevemente (2-3 frases) por que o conteúdo foi identificado como ${isPhishing ? 'suspeito' : 'seguro'}.
      Use linguagem simples e direta.`;

      console.log('Solicitando explicação à API DeepSeek...');
      
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Texto analisado: "${content}"\nResultado: ${isPhishing ? 'PHISHING' : 'SEGURO'}\nConfiança: ${Math.round(confidence * 100)}%` }
          ],
          max_tokens: 300,
          temperature: 0.3
        },
        { headers: this.getHeaders(), timeout: 5000 }
      );

      if (response.data && response.data.choices && response.data.choices[0]?.message?.content) {
        return response.data.choices[0].message.content;
      }
      
      throw new Error('Formato de resposta inesperado da API DeepSeek');
    } catch (error: unknown) {
      // Verifica se é um erro de Axios
      if (axios.isAxiosError(error)) {
        // Erro 402 indica problema com pagamento ou créditos
        if (error.response?.status === 402) {
          console.error('ERRO 402: Pagamento requerido na API DeepSeek. Verifique o status da sua conta e créditos disponíveis.');
        } else if (error.response) {
          console.error(`Erro na requisição DeepSeek: Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
          console.error('Sem resposta do servidor DeepSeek. Verifique sua conexão com a internet:', error.message);
        } else {
          console.error('Erro ao configurar requisição DeepSeek:', error.message);
        }
      } else {
        console.error('Erro ao obter explicação do DeepSeek:', error);
      }
      
      console.log('Retornando explicação padrão devido a erro na API...');
      
      // Explicação padrão em caso de erro
      if (isPhishing) {
        return 'Este conteúdo apresenta características típicas de tentativas de phishing, como solicitação de dados sensíveis, urgência, ou links suspeitos.';
      } else {
        return 'Este conteúdo não apresenta os sinais típicos de phishing, como urgência excessiva ou solicitação de informações confidenciais.';
      }
    }
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
    
    const suspiciousWords = [
      'senha', 'credenciais', 'login', 'conta', 'banco', 'cartão', 
      'atualizar', 'verificar', 'confirmar', 'urgente', 'imediato',
      'suspensão', 'bloqueio', 'clique', 'link', 'limitado',
      'prêmio', 'ganhou', 'grátis', 'vencimento', 'pagamento',
      'cpf', 'código', 'validar', 'expirar'
    ];
    
    for (const word of suspiciousWords) {
      if (lowerContent.includes(word)) {
        result.push(word);
      }
    }
    
    return result;
  }
  
  private extractUrls(content: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlRegex);
    return matches || [];
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
}

// Instância singleton
export const deepSeekService = new DeepSeekService();
export default deepSeekService; 