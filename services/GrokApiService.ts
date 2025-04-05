// Serviço para integração com a API do Grok para detecção de phishing

import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

// Configurações da API do Grok
const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_TOKEN = "xai-9fOa8EaaRAld0KTZlKBmdsIZGUFymL9UAhal8n2eauwxJqwUykzlFOxbKFiMTeKp4sn2XO8JgtgziXA2";
const GROK_MODEL = "grok-2-latest";

// Interface para resultados da análise de phishing
export interface PhishingAnalysisResult {
  isPhishing: boolean;
  confidence: number;
  explanation: string;
  suspiciousWords?: string[];
  suspiciousUrls?: string[];
}

// Interface para o serviço de API do Grok
export interface GrokApiServiceInterface {
  analyzeMessage(message: string): Promise<PhishingAnalysisResult>;
  answerSecurityQuestion(question: string): Promise<string>;
  sendMessage(userMessage: string, systemPrompt?: string): Promise<string>;
}

// Classe de implementação do serviço de API do Grok
export class GrokApiService implements GrokApiServiceInterface {
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor() {
    this.apiKey = GROK_TOKEN;
    this.apiUrl = GROK_API_URL;
    this.model = GROK_MODEL;
    
    console.log(`GrokAPIService inicializado com URL: ${this.apiUrl}, Modelo: ${this.model}`);
  }

  // Método para construir cabeçalhos de requisição
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json',
    };
  }

  // Analisa uma mensagem para detectar phishing
  async analyzeMessage(message: string): Promise<PhishingAnalysisResult> {
    try {
      const systemPrompt = `Você é um analisador de segurança especializado em detectar phishing. 
      Analise o texto fornecido e identifique se contém tentativas de phishing ou fraude. 
      Retorne sua análise no formato JSON com os seguintes campos:
      {
        "isPhishing": boolean,
        "confidence": number (0-1),
        "explanation": string,
        "suspiciousWords": string[],
        "suspiciousUrls": string[]
      }`;

      const response = await this.sendMessage(message, systemPrompt);
      
      try {
        // Tenta extrair o JSON da resposta
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                          response.match(/\{[\s\S]*?\}/);
        
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const result = JSON.parse(jsonStr);
          
          return {
            isPhishing: result.isPhishing,
            confidence: result.confidence || 0,
            explanation: result.explanation || 'Sem explicação disponível',
            suspiciousWords: result.suspiciousWords || [],
            suspiciousUrls: result.suspiciousUrls || []
          };
        }
      } catch (parseError: unknown) {
        console.error('Erro ao analisar resposta JSON:', parseError);
      }

      // Fallback para análise simples se o parsing falhar
      const isPhishing = response.toLowerCase().includes('phishing') || 
                        response.toLowerCase().includes('suspeito') ||
                        response.toLowerCase().includes('fraude');
      
      return {
        isPhishing: isPhishing,
        confidence: isPhishing ? 0.5 : 0.1,
        explanation: response,
        suspiciousWords: [],
        suspiciousUrls: []
      };
    } catch (error: unknown) {
      console.error('Erro ao analisar mensagem:', error);
      throw error;
    }
  }

  // Responde a uma pergunta de segurança
  async answerSecurityQuestion(question: string): Promise<string> {
    try {
      const systemPrompt = `Você é um assistente de segurança digital especializado em educar usuários sobre phishing, 
      fraudes online e boas práticas de segurança. Forneça respostas concisas, educativas e práticas.`;
      
      return await this.sendMessage(question, systemPrompt);
    } catch (error: unknown) {
      console.error('Erro ao responder pergunta de segurança:', error);
      return 'Desculpe, não foi possível processar sua pergunta neste momento. Por favor, tente novamente mais tarde.';
    }
  }

  // Envia uma mensagem para a API do Grok
  async sendMessage(userMessage: string, systemPrompt: string = ''): Promise<string> {
    try {
      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'Você é um assistente útil e amigável. Responda de forma sucinta e clara.'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      };

      console.log(`Enviando requisição para ${this.apiUrl} com modelo ${this.model}`);
      
      const response = await axios.post(this.apiUrl, requestData, {
        headers: this.getHeaders(),
        timeout: 15000
      });

      if (response.data && response.data.choices && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      } else {
        console.error('Formato de resposta inesperado:', response.data);
        throw new Error('Formato de resposta inesperado da API');
      }
    } catch (error: unknown) {
      console.error('Erro ao enviar mensagem para a API do Grok:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Detalhes da resposta de erro:', error.response.data);
      }
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao consultar API do Grok: ${errorMessage}`);
    }
  }
}

// Instância singleton do serviço
export const grokApiService = new GrokApiService();

export default grokApiService;
