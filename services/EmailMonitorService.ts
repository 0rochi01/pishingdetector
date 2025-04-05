import { NativeModules } from 'react-native';
import PhishingDetectionService from './PhishingDetectionService';
import NotificationService from './NotificationService';
import HistoryService from './HistoryService';
import SettingsService from './SettingsService';

const { EmailModule } = NativeModules;

interface EmailMessage {
    subject: string;
    body: string;
    sender: string;
    recipients: string[];
    cc: string[];
    bcc: string[];
    date: number;
    read: boolean;
    type: 'received' | 'sent' | 'unread';
    attachments: string[];
}

export class EmailMonitorService {
    private static instance: EmailMonitorService;
    private isMonitoring: boolean = false;
    private lastCheckTime: number = 0;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly phishingService: PhishingDetectionService;
    private readonly notificationService: NotificationService;
    private readonly historyService: HistoryService;
    private readonly settingsService: SettingsService;

    private constructor() {
        this.phishingService = PhishingDetectionService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.historyService = HistoryService.getInstance();
        this.settingsService = SettingsService.getInstance();
    }

    public static getInstance(): EmailMonitorService {
        if (!EmailMonitorService.instance) {
            EmailMonitorService.instance = new EmailMonitorService();
        }
        return EmailMonitorService.instance;
    }

    public async startMonitoring(): Promise<void> {
        try {
            const settings = await this.settingsService.getSettings();
            if (!settings.isMonitoringEnabled) {
                console.log('Monitoramento desativado nas configurações');
                return;
            }

            if (this.isMonitoring) {
                console.log('Monitoramento de email já está ativo');
                return;
            }

            this.isMonitoring = true;
            this.lastCheckTime = Date.now();
            
            // Iniciar verificação periódica
            await this.startPeriodicCheck();
            
            console.log('Monitoramento de email iniciado');
        } catch (error) {
            console.error('Erro ao iniciar monitoramento de email:', error);
            throw error;
        }
    }

    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = null;
        }

        console.log('Monitoramento de email parado');
    }

    private async startPeriodicCheck(): Promise<void> {
        if (!this.isMonitoring) {
            return;
        }

        try {
            await this.checkRecentEmails();
        } catch (error) {
            console.error('Erro na verificação periódica de emails:', error);
        }

        // Agendar próxima verificação
        const settings = await this.settingsService.getSettings();
        this.checkInterval = setTimeout(
            () => this.startPeriodicCheck(),
            settings.backgroundScanInterval * 60 * 1000
        );
    }

    private async checkRecentEmails(): Promise<void> {
        try {
            const emails = await EmailModule.getRecentEmails(this.lastCheckTime, 50);
            this.lastCheckTime = Date.now();

            for (const email of emails) {
                await this.processEmail(email);
            }
        } catch (error) {
            console.error('Erro ao verificar emails recentes:', error);
            throw error;
        }
    }

    private async processEmail(email: EmailMessage): Promise<void> {
        try {
            const result = await this.phishingService.detectPhishing(email.body);
            
            if (result.isPhishing) {
                const details = {
                    platformType: 'email',
                    threatEntryType: 'content',
                    sender: email.sender
                };

                // Registrar no histórico
                await this.historyService.addEntry({
                    content: email.body,
                    source: 'email',
                    isPhishing: true,
                    confidence: result.confidence,
                    details
                });

                // Enviar notificação
                await this.notificationService.sendNotification(
                    'Email de Phishing Detectado',
                    `Email suspeito de ${email.sender}`,
                    {
                        type: 'email',
                        content: email.body,
                        details
                    }
                );
            }
        } catch (error) {
            console.error('Erro ao processar email:', error);
        }
    }

    public async getUnreadEmails(): Promise<EmailMessage[]> {
        try {
            return await EmailModule.getUnreadEmails();
        } catch (error) {
            console.error('Erro ao obter emails não lidos:', error);
            throw error;
        }
    }

    public async markEmailAsRead(emailId: string): Promise<boolean> {
        try {
            return await EmailModule.markEmailAsRead(emailId);
        } catch (error) {
            console.error('Erro ao marcar email como lido:', error);
            throw error;
        }
    }

    public isActive(): boolean {
        return this.isMonitoring;
    }
} 