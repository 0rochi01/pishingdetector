import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GrokChatService from './GrokChatService';
import PhishingHistoryService, { PhishingDetectionResult } from './PhishingHistoryService';
import huggingFaceService from './HuggingFaceService';

const { PhishingDetectionModule, PhishingNativeModule } = NativeModules;

export interface PhishingDetectionResult {
    isPhishing: boolean;
    confidence: number;
    details?: {
        suspiciousWords?: string[];
        suspiciousUrls?: string[];
        requestsSensitiveData?: boolean;
        createsUrgency?: boolean;
        reason?: string;
        [key: string]: any;
    };
    explanation?: string;
}

class PhishingDetectionService {
    private static instance: PhishingDetectionService;
    private readonly CACHE_KEY = '@phishing_detector:detection_cache';
    private readonly MAX_CACHE_SIZE = 100;
    private cache: Map<string, {result: PhishingDetectionResult, timestamp: number}> = new Map();
    private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas
    private grokChatService: GrokChatService;
    private historyService: PhishingHistoryService;

    private constructor() {
        this.loadCache();
        this.grokChatService = GrokChatService.getInstance();
        this.historyService = PhishingHistoryService.getInstance();
        console.log('PhishingDetectionService inicializado');
    }

    static getInstance(): PhishingDetectionService {
        if (!PhishingDetectionService.instance) {
            PhishingDetectionService.instance = new PhishingDetectionService();
        }
        return PhishingDetectionService.instance;
    }

    async detectPhishing(content: string): Promise<PhishingDetectionResult> {
        try {
            console.log('Detectando phishing usando HuggingFace...');
            
            // Análise rápida usando HuggingFace
            const result = await huggingFaceService.analyzeContent(content);
            
            // Criar objeto compatível com PhishingDetectionResult
            const phishingResult: PhishingDetectionResult = {
                isPhishing: result.isPhishing,
                confidence: result.confidence,
                details: {
                    suspiciousWords: result.suspiciousWords || [],
                    suspiciousUrls: result.suspiciousUrls || [],
                    source: 'huggingface'
                },
                explanation: result.explanation
            };
            
            // Adiciona ao histórico
            await this.historyService.addToHistory(content, phishingResult);
            
            console.log('Resultado HuggingFace:', result.isPhishing ? 'PHISHING' : 'SEGURO', `(${Math.round(result.confidence * 100)}%)`);
            
            return phishingResult;
        } catch (error) {
            console.error('Erro ao detectar phishing com HuggingFace:', error);
            
            // Tenta com o módulo nativo como fallback
            try {
                console.log('Tentando detecção com módulo nativo como fallback...');
                
                const nativeResult = await this.checkNativeModule(content);
                
                // Adiciona ao histórico
                await this.historyService.addToHistory(content, nativeResult);
                
                return nativeResult;
            } catch (nativeError) {
                console.error('Erro na detecção nativa:', nativeError);
                
                // Última opção: verificação básica
                const basicResult = this.basicPhishingCheck(content);
                
                // Adiciona ao histórico
                await this.historyService.addToHistory(content, basicResult);
                
                return basicResult;
            }
        }
    }

    async checkUrl(url: string): Promise<PhishingDetectionResult> {
        try {
            if (!PhishingNativeModule) {
                throw new Error('Módulo nativo não disponível');
            }
            
            console.log('Verificando URL com módulo nativo:', url);
            
            const result = await PhishingNativeModule.checkUrl(url);
            return result;
        } catch (error) {
            console.error('Erro ao verificar URL:', error);
            
            // Fallback para uma verificação básica
            const basicResult = this.basicPhishingCheck(url);
            return basicResult;
        }
    }

    // Método para consultar o assistente de segurança diretamente
    async askSecurityAssistant(sessionId: string, question: string): Promise<string> {
        try {
            const response = await this.grokChatService.sendMessage(sessionId, question);
            return response.content;
        } catch (error) {
            console.error('Erro ao consultar assistente de segurança:', error);
            return 'Desculpe, não foi possível obter uma resposta do assistente de segurança no momento.';
        }
    }

    // Obter histórico de chat com o assistente
    getChatHistory(sessionId: string) {
        return this.grokChatService.getChatHistory(sessionId);
    }

    // Limpar histórico de chat
    async clearChatHistory(sessionId: string): Promise<void> {
        return this.grokChatService.clearChatHistory(sessionId);
    }

    private detectPhishingOffline(content: string): PhishingDetectionResult {
        const lowerContent = content.toLowerCase();
        let confidence = 0;
        const details: PhishingDetectionResult['details'] = {
            source: 'JS_OFFLINE_DETECTION'
        };

        // Lista de palavras suspeitas em português
        const suspiciousWords = [
            'senha', 'credenciais', 'cartão', 'crédito', 'débito', 'banco', 'segurança',
            'verificação', 'confirmar', 'urgente', 'suspensão', 'bloqueio', 'fraude',
            'clique', 'link', 'oferta', 'prêmio', 'ganhou', 'grátis', 'promoção',
            'transferência', 'pix', 'boleto', 'conta', 'atualizar', 'vencimento'
        ];

        // Detectar palavras suspeitas
        const foundWords: string[] = [];
        for (const word of suspiciousWords) {
            if (lowerContent.includes(word)) {
                foundWords.push(word);
                confidence += 0.05;
            }
        }

        if (foundWords.length > 0) {
            details.suspiciousWords = foundWords;
        }

        // Detectar URLs suspeitas
        const urlRegex = /(https?:\/\/|www\.)[^\s]+/g;
        const urls = content.match(urlRegex) || [];
        const suspiciousUrls: string[] = [];

        for (const url of urls) {
            if (this.isUrlSuspicious(url)) {
                suspiciousUrls.push(url);
                confidence += 0.1;
            }
        }

        if (suspiciousUrls.length > 0) {
            details.suspiciousUrls = suspiciousUrls;
        }

        // Detectar solicitação de dados sensíveis
        if (
            lowerContent.includes('senha') ||
            lowerContent.includes('código') ||
            lowerContent.includes('login') ||
            lowerContent.includes('cpf') ||
            lowerContent.includes('cartão') ||
            lowerContent.includes('atualizar dados') ||
            lowerContent.includes('confirme seus dados')
        ) {
            confidence += 0.25;
            details.requestsSensitiveData = true;
        }

        // Detectar padrões de urgência
        if (
            lowerContent.includes('urgente') ||
            lowerContent.includes('imediato') ||
            lowerContent.includes('limitado') ||
            lowerContent.includes('bloqueado') ||
            lowerContent.includes('suspenso')
        ) {
            confidence += 0.15;
            details.createsUrgency = true;
        }

        // Limitar confiança a 1.0
        confidence = Math.min(confidence, 1.0);

        // Determinar resultado final
        const isPhishing = confidence >= 0.6;

        return {
            isPhishing,
            confidence,
            details
        };
    }

    private isUrlSuspicious(url: string): boolean {
        const lowerUrl = url.toLowerCase();
        
        // Domínios/TLDs suspeitos
        const suspiciousDomains = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz'];
        const hasSuspiciousDomain = suspiciousDomains.some(domain => lowerUrl.includes(domain));
        
        // Encurtadores de URL
        const urlShorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 'is.gd', 't.co'];
        const isShortener = urlShorteners.some(shortener => lowerUrl.includes(shortener));
        
        // Palavras suspeitas na URL
        const suspiciousUrlWords = ['login', 'account', 'secure', 'banking', 'verify', 'password'];
        const hasSuspiciousWord = suspiciousUrlWords.some(word => lowerUrl.includes(word));
        
        // Muitos números ou caracteres especiais
        const hasExcessiveSpecialChars = (url.match(/[0-9@#$%]/g) || []).length > 8;
        
        return hasSuspiciousDomain || isShortener || (hasSuspiciousWord && hasExcessiveSpecialChars);
    }

    private generateCacheKey(content: string): string {
        // Simplificado para fins de demonstração
        return content.substring(0, 100).trim();
    }

    private pruneCache(): void {
        if (this.cache.size <= this.MAX_CACHE_SIZE) {
            return;
        }

        // Ordenar por timestamp e remover os mais antigos
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remover os mais antigos
        const toRemove = entries.length - this.MAX_CACHE_SIZE;
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }

    private async saveCache(): Promise<void> {
        try {
            const cacheData = JSON.stringify(Array.from(this.cache.entries()));
            await AsyncStorage.setItem(this.CACHE_KEY, cacheData);
        } catch (error) {
            console.error('Erro ao salvar cache de detecção:', error);
        }
    }

    private async loadCache(): Promise<void> {
        try {
            const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
            if (cacheData) {
                const entries = JSON.parse(cacheData);
                this.cache = new Map(entries);

                // Limpar entradas expiradas
                const now = Date.now();
                for (const [key, { timestamp }] of this.cache.entries()) {
                    if (now - timestamp > this.CACHE_EXPIRY) {
                        this.cache.delete(key);
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar cache de detecção:', error);
        }
    }

    async clearCache(): Promise<void> {
        this.cache.clear();
        try {
            await AsyncStorage.removeItem(this.CACHE_KEY);
        } catch (error) {
            console.error('Erro ao limpar cache de detecção:', error);
        }
    }

    // Métodos auxiliares para análises básicas (fallback)
    private basicPhishingCheck(content: string): PhishingDetectionResult {
        console.log('Realizando verificação básica de phishing');
        
        const lowerContent = content.toLowerCase();
        
        // Palavras-chave suspeitas
        const suspiciousTerms = [
            'senha', 'login', 'conta', 'banco', 'cartão', 'crédito', 
            'verificar', 'atualizar', 'confirmar', 'urgente', 'clique',
            'ganhou', 'prêmio', 'oferta', 'limitado', 'exclusivo'
        ];
        
        // Contagem de termos suspeitos
        let suspiciousCount = 0;
        const foundSuspiciousWords: string[] = [];
        
        for (const term of suspiciousTerms) {
            if (lowerContent.includes(term)) {
                suspiciousCount++;
                foundSuspiciousWords.push(term);
            }
        }
        
        // Extrai URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlRegex) || [];
        
        // Checks
        const hasSuspiciousUrls = /(bit\.ly|tinyurl|goo\.gl)/i.test(content);
        const asksForSensitiveInfo = lowerContent.includes('senha') || 
                                    lowerContent.includes('login') || 
                                    lowerContent.includes('codigo');
        const hasUrgency = lowerContent.includes('urgente') || 
                          lowerContent.includes('agora') || 
                          lowerContent.includes('imediatamente');
        
        // Determina se é phishing
        const isPhishing = (suspiciousCount >= 3) || 
                         (hasSuspiciousUrls && asksForSensitiveInfo) ||
                         (hasUrgency && asksForSensitiveInfo && urls.length > 0);
        
        // Calcula confiança
        let confidence = 0.5;
        if (suspiciousCount >= 5) confidence = 0.85;
        else if (suspiciousCount >= 3) confidence = 0.7;
        else if (suspiciousCount >= 1) confidence = 0.5;
        else confidence = 0.3;
        
        // Ajusta confiança com base em outros fatores
        if (hasSuspiciousUrls && asksForSensitiveInfo) confidence = Math.min(0.9, confidence + 0.2);
        if (hasUrgency && asksForSensitiveInfo) confidence = Math.min(0.9, confidence + 0.15);
        
        return {
            isPhishing,
            confidence,
            details: {
                suspiciousWords: foundSuspiciousWords,
                suspiciousUrls: urls
            },
            explanation: isPhishing 
                ? 'Verificação básica detectou possível phishing com combinação de palavras-chave suspeitas e padrões de URL'
                : 'Verificação básica não encontrou indicadores fortes de phishing'
        };
    }

    async getExplanation(content: string, isPhishing: boolean, confidence: number): Promise<string> {
        try {
            return await huggingFaceService.getExplanation(content, isPhishing, confidence);
        } catch (error) {
            console.error('Erro ao obter explicação de phishing:', error);
            
            if (isPhishing) {
                return 'Este conteúdo contém características típicas de phishing, como solicitação de dados sensíveis, urgência ou links suspeitos.';
            } else {
                return 'Este conteúdo parece legítimo e não apresenta os típicos sinais de alerta de phishing.';
            }
        }
    }

    // Verifica usando módulo nativo
    private async checkNativeModule(content: string): Promise<PhishingDetectionResult> {
        if (!PhishingNativeModule) {
            throw new Error('Módulo nativo não disponível');
        }
        
        console.log('Verificando conteúdo com módulo nativo');
        
        try {
            const result = await PhishingNativeModule.detectPhishing(content);
            return result;
        } catch (error) {
            throw new Error(`Erro no módulo nativo: ${error}`);
        }
    }
}

export default PhishingDetectionService; 