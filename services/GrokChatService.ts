import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class GrokChatService {
  private static instance: GrokChatService;
  private readonly CHAT_HISTORY_KEY = '@phishing_detector:chat_history';
  private readonly API_URL = 'https://api.x.ai/v1/chat/completions';
  private readonly API_TOKEN = 'xai-9fOa8EaaRAld0KTZlKBmdsIZGUFymL9UAhal8n2eauwxJqwUykzlFOxbKFiMTeKp4sn2XO8JgtgziXA2';
  private readonly MODEL = 'grok-2-latest';
  
  private history: Map<string, ChatMessage[]> = new Map();
  
  private constructor() {
    this.loadChatHistory();
  }
  
  static getInstance(): GrokChatService {
    if (!GrokChatService.instance) {
      GrokChatService.instance = new GrokChatService();
    }
    return GrokChatService.instance;
  }
  
  async sendMessage(sessionId: string, message: string): Promise<ChatMessage> {
    try {
      // Obter ou inicializar histórico da sessão
      if (!this.history.has(sessionId)) {
        // Inicializar com mensagem do sistema
        this.history.set(sessionId, [
          {
            role: 'system',
            content: 'Você é um assistente de segurança especializado em proteção contra phishing, fraudes online e segurança digital. Forneça orientações detalhadas, mas concisas, sobre como identificar e se proteger contra ameaças digitais. Use linguagem simples e exemplos práticos. Suas respostas devem ser em português brasileiro. Evite dar informações que possam ser usadas para atividades maliciosas.'
          }
        ]);
      }
      
      const messages = this.history.get(sessionId)!;
      
      // Adicionar mensagem do usuário ao histórico
      const userMessage: ChatMessage = { role: 'user', content: message };
      messages.push(userMessage);
      
      // Preparar mensagens para envio à API, limitando a 10 mensagens para controle de tokens
      const recentMessages = messages.slice(-10);
      
      // Fazer requisição à API
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_TOKEN}`
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: recentMessages,
          stream: false,
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} - ${await response.text()}`);
      }
      
      const data = await response.json();
      
      // Obter resposta do assistente
      const assistantResponse = data.choices[0].message;
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantResponse.content
      };
      
      // Adicionar resposta ao histórico
      messages.push(assistantMessage);
      
      // Salvar histórico
      await this.saveChatHistory();
      
      return assistantMessage;
    } catch (error) {
      console.error('Erro ao enviar mensagem para o Grok:', error);
      
      // Em caso de erro, retornar uma mensagem de fallback
      const fallbackMessage: ChatMessage = {
        role: 'assistant',
        content: 'Desculpe, estou enfrentando dificuldades técnicas no momento. Por favor, tente novamente mais tarde ou verifique sua conexão com a internet.'
      };
      
      // Adicionar mensagem de fallback ao histórico
      const messages = this.history.get(sessionId) || [];
      messages.push(fallbackMessage);
      this.history.set(sessionId, messages);
      
      return fallbackMessage;
    }
  }
  
  async getDetectionExplanation(content: string, isPhishing: boolean, confidenceScore: number): Promise<string> {
    try {
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: 'Você é um especialista em segurança cibernética, analisando resultados de detecção de phishing. Forneça uma explicação breve, em até 3 parágrafos, sobre por que o conteúdo foi identificado como suspeito ou seguro. Use linguagem simples e didática. Responda em português brasileiro.'
      };
      
      const userPrompt: ChatMessage = {
        role: 'user',
        content: `Analise o seguinte conteúdo:\n\n"${content}"\n\nNosso sistema ${isPhishing ? 'identificou' : 'não identificou'} este conteúdo como phishing com ${Math.round(confidenceScore * 100)}% de confiança. Explique por que isso aconteceu e o que o usuário deve observar.`
      };
      
      // Fazer requisição à API
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_TOKEN}`
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [systemPrompt, userPrompt],
          stream: false,
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} - ${await response.text()}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Erro ao obter explicação do Grok:', error);
      
      // Em caso de erro, retornar uma explicação padrão
      if (isPhishing) {
        return 'Este conteúdo apresenta características comuns de tentativas de phishing, como linguagem urgente, solicitação de dados sensíveis ou links suspeitos. Sempre verifique a legitimidade do remetente antes de fornecer informações pessoais ou clicar em links.';
      } else {
        return 'Este conteúdo não apresenta as características típicas de phishing, como urgência excessiva, solicitação de dados sensíveis ou links suspeitos. No entanto, sempre mantenha cautela ao interagir com mensagens digitais.';
      }
    }
  }
  
  getChatHistory(sessionId: string): ChatMessage[] {
    return this.history.get(sessionId) || [];
  }
  
  async clearChatHistory(sessionId: string): Promise<void> {
    if (this.history.has(sessionId)) {
      // Manter apenas a mensagem do sistema
      const systemMessage = this.history.get(sessionId)![0];
      this.history.set(sessionId, [systemMessage]);
      await this.saveChatHistory();
    }
  }
  
  private async saveChatHistory(): Promise<void> {
    try {
      const historyObj: Record<string, ChatMessage[]> = {};
      
      // Converter Map para objeto
      for (const [sessionId, messages] of this.history.entries()) {
        historyObj[sessionId] = messages;
      }
      
      await AsyncStorage.setItem(this.CHAT_HISTORY_KEY, JSON.stringify(historyObj));
    } catch (error) {
      console.error('Erro ao salvar histórico de chat:', error);
    }
  }
  
  private async loadChatHistory(): Promise<void> {
    try {
      const historyJson = await AsyncStorage.getItem(this.CHAT_HISTORY_KEY);
      
      if (historyJson) {
        const historyObj = JSON.parse(historyJson);
        
        // Converter objeto para Map
        for (const sessionId in historyObj) {
          this.history.set(sessionId, historyObj[sessionId]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de chat:', error);
    }
  }
}

export type { ChatMessage };
export default GrokChatService; 