import { Image, StyleSheet, Platform, TextInput, TouchableOpacity, ScrollView, Switch, Alert, View, Text } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';

// Importação dos serviços
import { 
  grokApiService, 
  notificationMonitorService, 
  phishingAlertService,
  backgroundTaskService,
  PhishingAnalysisResult,
  MonitorableMessage
} from '@/services';

// Importar o componente VoiceRecorder
import VoiceRecorder from '@/components/VoiceRecorder';
import { voiceTranscriptionService } from '@/services';

// Verifica se a plataforma é web
const isWeb = Platform.OS === 'web';

export default function HomeScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<{text: string, isUser: boolean}[]>([
    {text: 'Olá! Sou seu assistente de segurança contra phishing. Como posso ajudar?', isUser: false}
  ]);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [notificationText, setNotificationText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    safe: 0,
    warnings: 0,
    threats: 0
  });
  const chatScrollViewRef = useRef<ScrollView>(null);
  const statusColor = isMonitoringActive ? '#4CAF50' : '#FFA000';

  // Adicionar estados para processamento de voz
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  // Configurações iniciais
  useEffect(() => {
    // Configurar callbacks do serviço de monitoramento
    setupMonitoringCallbacks();
    
    // Solicitar permissões iniciais
    requestInitialPermissions();
    
    // Cleanup ao desmontar o componente
    return () => {
      if (isMonitoringActive) {
        notificationMonitorService.stopMonitoring();
      }
    };
  }, []);

  // Efetua rolagem automática do chat para o final quando há novas mensagens
  useEffect(() => {
    if (chatScrollViewRef.current) {
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages]);

  // Configura callbacks para o serviço de monitoramento
  const setupMonitoringCallbacks = () => {
    notificationMonitorService.setCallbacks({
      onDetectPhishing: handlePhishingDetected,
      onError: handleMonitoringError,
      onPermissionDenied: handlePermissionDenied
    });
  };

  // Solicita permissões iniciais
  const requestInitialPermissions = async () => {
    try {
      const permissions = await notificationMonitorService.requestPermissions();
      
      if (!permissions.notifications) {
        addBotMessage('Permissão para monitorar notificações não concedida. O monitoramento automático não funcionará corretamente.');
      }
      
      let permissionStatus = 'Permissões concedidas: ';
      let hasPermissions = false;
      
      if (permissions.notifications) {
        permissionStatus += 'Notificações ';
        hasPermissions = true;
      }
      
      if (permissions.sms) {
        permissionStatus += 'SMS ';
        hasPermissions = true;
      }
      
      if (permissions.email) {
        permissionStatus += 'Email ';
        hasPermissions = true;
      }
      
      if (hasPermissions) {
        addBotMessage(permissionStatus);
      }
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      addBotMessage('Erro ao solicitar permissões. Tente novamente ou verifique as configurações do seu dispositivo.');
    }
  };

  // Manipula detecção de phishing
  const handlePhishingDetected = async (result: PhishingAnalysisResult, message: MonitorableMessage) => {
    // Atualiza estatísticas
    updateStats(result.classification);
    
    // Envia alerta para o usuário
    await phishingAlertService.alertUser(result, message);
    
    // Adiciona mensagem ao chat
    let alertMessage = '';
    
    if (result.classification === 'red') {
      alertMessage = `⚠️ AMEAÇA DETECTADA ⚠️\n\nUma mensagem de "${message.sender}" foi classificada como alto risco!\n\nO remetente foi bloqueado automaticamente.\n\nDetalhes: ${result.explanation}`;
      
      // Recomendações de ações
      if (result.suggestedActions && result.suggestedActions.length > 0) {
        alertMessage += '\n\nRecomendações:\n• ' + result.suggestedActions.join('\n• ');
      }
      
      // Detalhes das ameaças
      if (result.detectedThreats) {
        if (result.detectedThreats.suspiciousLinks && result.detectedThreats.suspiciousLinks.length > 0) {
          alertMessage += '\n\nLinks suspeitos detectados:\n• ' + result.detectedThreats.suspiciousLinks.join('\n• ');
        }
        
        if (result.detectedThreats.sensitiveDataRequests && result.detectedThreats.sensitiveDataRequests.length > 0) {
          alertMessage += '\n\nSolicitações de dados sensíveis:\n• ' + result.detectedThreats.sensitiveDataRequests.join('\n• ');
        }
      }
    } else if (result.classification === 'yellow') {
      alertMessage = `⚠️ ALERTA DE SEGURANÇA ⚠️\n\nUma mensagem de "${message.sender}" foi marcada como suspeita.\n\nRecomendamos cautela.\n\nDetalhes: ${result.explanation}`;
      
      // Adiciona recomendações se disponíveis
      if (result.suggestedActions && result.suggestedActions.length > 0) {
        alertMessage += '\n\nRecomendações:\n• ' + result.suggestedActions.join('\n• ');
      }
    }
    
    if (alertMessage) {
      addBotMessage(alertMessage);
    }
  };

  // Manipula erros de monitoramento
  const handleMonitoringError = (error: Error) => {
    console.error('Erro no monitoramento:', error);
    addBotMessage(`Erro no sistema de monitoramento: ${error.message}`);
  };

  // Manipula negação de permissão
  const handlePermissionDenied = (service: 'notification' | 'sms' | 'email') => {
    addBotMessage(`Permissão negada: ${service}. Algumas funcionalidades podem não estar disponíveis.`);
  };

  // Atualiza as estatísticas
  const updateStats = (classification: 'red' | 'yellow' | 'green') => {
    setStats(prev => {
      if (classification === 'red') {
        return { ...prev, threats: prev.threats + 1 };
      } else if (classification === 'yellow') {
        return { ...prev, warnings: prev.warnings + 1 };
      } else {
        return { ...prev, safe: prev.safe + 1 };
      }
    });
  };

  // Adiciona mensagem do bot ao chat
  const addBotMessage = (text: string) => {
    setChatMessages(prev => [...prev, {text, isUser: false}]);
  };

  // Manipula a mensagem de voz enviada pelo componente de gravação 
  const handleVoiceMessage = async (audioUri: string) => {
    try {
      setIsVoiceProcessing(true);
      
      // Transcricão do áudio
      console.log("Processando áudio gravado:", audioUri);
      const result = await voiceTranscriptionService.transcribeAudio(audioUri);
      
      if (result.success && result.text) {
        // Adiciona a transcrição como uma mensagem do usuário
        setChatMessages(prev => [...prev, {
          text: result.text, 
          isUser: true
        }]);
        
        // Processa como uma mensagem normal
        await processMessage(result.text);
      } else {
        // Erro na transcrição
        Alert.alert(
          "Erro na transcrição", 
          result.error || "Não foi possível processar o áudio. Tente novamente."
        );
      }
    } catch (error) {
      console.error("Erro ao processar mensagem de voz:", error);
      Alert.alert(
        "Erro", 
        "Ocorreu um problema ao processar sua mensagem de voz."
      );
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  // Adicionar método para processar mensagem do chat
  const processMessage = async (userQuestion: string) => {
    try {
      // Adiciona mensagem de espera
      addBotMessage('Processando sua pergunta...');
      
      // Chama a API do Grok para responder a pergunta
      const response = await grokApiService.answerSecurityQuestion(userQuestion);
      
      // Remove a mensagem de espera e adiciona a resposta real
      setChatMessages(prev => {
        const newMessages = [...prev];
        newMessages.pop(); // Remove a mensagem "Processando sua pergunta..."
        return [...newMessages, {text: response, isUser: false}];
      });
    } catch (error) {
      console.error('Erro ao obter resposta:', error);
      
      // Remove a mensagem de espera e adiciona mensagem de erro
      setChatMessages(prev => {
        const newMessages = [...prev];
        newMessages.pop(); // Remove a mensagem "Processando sua pergunta..."
        return [...newMessages, {
          text: `Desculpe, tive um problema ao processar sua pergunta: ${(error as Error).message}`,
          isUser: false
        }];
      });
    }
  };

  // Modificar o método sendMessage
  const sendMessage = async () => {
    if (message.trim() === '' || isProcessing) return;
    
    // Adiciona mensagem do usuário ao chat
    setChatMessages(prev => [...prev, {text: message, isUser: true}]);
    
    const userQuestion = message;
    setMessage('');
    setIsProcessing(true);

    try {
      await processMessage(userQuestion);
    } finally {
      setIsProcessing(false);
    }
  };

  // Ativa/desativa o monitoramento
  const toggleMonitoring = async () => {
    try {
      if (!isMonitoringActive) {
        // Solicita permissões novamente antes de ativar
        const permissions = await notificationMonitorService.requestPermissions();
        
        if (!permissions.notifications) {
          Alert.alert(
            'Permissão Necessária',
            'Para monitorar notificações, é necessário conceder permissão. Por favor, habilite nas configurações do dispositivo.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Inicia o monitoramento
        await notificationMonitorService.startMonitoring();

        // Registra as tarefas em segundo plano para continuar monitorando mesmo quando o app estiver fechado
        const backgroundTasksRegistered = await backgroundTaskService.registerBackgroundTasks();
        if (backgroundTasksRegistered) {
          addBotMessage('Monitoramento em segundo plano configurado. A proteção continuará ativa mesmo quando o aplicativo estiver fechado.');
        }
        setIsMonitoringActive(true);
        
        addBotMessage('Sistema de monitoramento de phishing ativado! Estou analisando suas notificações em tempo real.');
      } else {
        // Para o monitoramento
        notificationMonitorService.stopMonitoring();

        // Cancela as tarefas em segundo plano
        await backgroundTaskService.unregisterBackgroundTasks();
        setIsMonitoringActive(false);
        
        addBotMessage('Sistema de monitoramento de phishing desativado.');
      }
    } catch (error) {
      console.error('Erro ao alternar monitoramento:', error);
      addBotMessage(`Erro ao ${isMonitoringActive ? 'desativar' : 'ativar'} monitoramento: ${(error as Error).message}`);
    }
  };

  // Analisa uma notificação manualmente
  const analyzeNotification = async () => {
    if (notificationText.trim() === '' || isProcessing) return;
    
    setIsProcessing(true);
    
    // Cria objeto de mensagem
    const message: MonitorableMessage = {
      id: `manual-${Date.now()}`,
      source: 'notification',
      sender: 'Análise Manual',
      content: notificationText,
      timestamp: new Date(),
      read: false
    };
    
    // Adiciona mensagem ao chat indicando que está analisando
    addBotMessage(`Analisando: "${notificationText.substring(0, 50)}${notificationText.length > 50 ? '...' : ''}"`);
    
    try {
      // Analisa a mensagem usando a API
      const result = await notificationMonitorService.analyzeMessage(message);
      
      // Atualiza estatísticas
      updateStats(result.classification);
      
      // Formata o resultado
      let resultMessage = '';
      let detailsMessage = '';
      
      // Adiciona detalhes específicos com base na classificação
      if (result.detectedThreats) {
        if (result.detectedThreats.suspiciousLinks && result.detectedThreats.suspiciousLinks.length > 0) {
          detailsMessage += '\n\nLinks suspeitos:\n• ' + result.detectedThreats.suspiciousLinks.join('\n• ');
        }
        
        if (result.detectedThreats.sensitiveDataRequests && result.detectedThreats.sensitiveDataRequests.length > 0) {
          detailsMessage += '\n\nSolicitações de dados sensíveis:\n• ' + result.detectedThreats.sensitiveDataRequests.join('\n• ');
        }
        
        if (result.detectedThreats.urgentLanguage && result.detectedThreats.urgentLanguage.length > 0) {
          detailsMessage += '\n\nLinguagem urgente/ameaçadora:\n• ' + result.detectedThreats.urgentLanguage.join('\n• ');
        }
      }
      
      // Adiciona recomendações
      let recommendationsMessage = '';
      if (result.suggestedActions && result.suggestedActions.length > 0) {
        recommendationsMessage = '\n\nRecomendações:\n• ' + result.suggestedActions.join('\n• ');
      }
      
      switch (result.classification) {
        case 'red':
          resultMessage = `🚨 CLASSIFICAÇÃO: VERMELHO (PERIGO) - Confiança: ${(result.confidence * 100).toFixed(1)}%\n\n${result.explanation}${detailsMessage}${recommendationsMessage}\n\nAções: O remetente seria bloqueado em modo automático.`;
          break;
        case 'yellow':
          resultMessage = `⚠️ CLASSIFICAÇÃO: AMARELO (ATENÇÃO) - Confiança: ${(result.confidence * 100).toFixed(1)}%\n\n${result.explanation}${detailsMessage}${recommendationsMessage}\n\nRecomendação: Tenha cuidado com esta mensagem e não compartilhe informações sensíveis.`;
          break;
        case 'green':
          resultMessage = `✅ CLASSIFICAÇÃO: VERDE (SEGURO) - Confiança: ${(result.confidence * 100).toFixed(1)}%\n\n${result.explanation}\n\nEsta mensagem parece segura.`;
          break;
      }
      
      // Adiciona resultado ao chat
      addBotMessage(resultMessage);
    } catch (error) {
      console.error('Erro ao analisar notificação:', error);
      addBotMessage(`Erro ao analisar mensagem: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
      setNotificationText('');
    }
  };

  // Navegação para tela de chat
  const navigateToChat = () => {
    try {
      // Tenta navegar para a rota correta
      router.push("../chat");
    } catch (error) {
      console.error('Erro na navegação:', error);
    }
  };

  // Navegação para tela de estatísticas
  const navigateToStats = () => {
    try {
      // Tenta navegar para a rota correta
      router.push("../stats");
    } catch (error) {
      console.error('Erro na navegação:', error);
    }
  };

  // Navegação para tela de configurações
  const navigateToSettings = () => {
    try {
      // Tenta navegar para a rota correta
      router.push("../settings");
    } catch (error) {
      console.error('Erro na navegação:', error);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#4A90E2', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Detector de Phishing</ThemedText>
      </ThemedView>

      {/* Monitor Automático Toggle */}
      <ThemedView style={styles.monitorContainer}>
        <ThemedView style={styles.card}>
          <ThemedView style={styles.monitorHeader}>
            <ThemedText type="subtitle">Proteção Automática</ThemedText>
            <Switch
              value={isMonitoringActive}
              onValueChange={toggleMonitoring}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isMonitoringActive ? '#4A90E2' : '#f4f3f4'}
              disabled={isProcessing}
            />
          </ThemedView>
          
          <ThemedText>
            {isMonitoringActive 
              ? "Monitorando notificações, SMS e emails. O sistema alertará sobre ameaças detectadas." 
              : "Ative o monitoramento para detectar phishing em tempo real."}
          </ThemedText>
          
          <TouchableOpacity 
            style={[
              styles.analyzeButton, 
              {
                marginTop: 12, 
                backgroundColor: isMonitoringActive ? '#F44336' : '#4A90E2',
                opacity: isProcessing ? 0.7 : 1
              }
            ]}
            onPress={toggleMonitoring}
            disabled={isProcessing}
          >
            <ThemedText style={styles.buttonText}>
              {isMonitoringActive ? "Parar Monitoramento" : "Iniciar Antiphishing"}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      {/* Chat Bot Section */}
      <ThemedView style={styles.chatSection}>
        <ThemedText type="subtitle">Assistente de Segurança</ThemedText>
        
        <ThemedView style={styles.chatContainer}>
          <ScrollView 
            ref={chatScrollViewRef}
            style={styles.chatMessages}
          >
            {chatMessages.map((chat, index) => (
              <ThemedView 
                key={index} 
                style={[
                  styles.chatBubble, 
                  chat.isUser ? styles.userBubble : styles.botBubble
                ]}
              >
                <ThemedText style={chat.isUser ? styles.userText : styles.botText}>
                  {chat.text}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>
          
          <ThemedView style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Faça uma pergunta..."
              value={message}
              onChangeText={setMessage}
              placeholderTextColor="#888"
              onSubmitEditing={sendMessage}
              editable={!isProcessing && !isVoiceProcessing}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (isProcessing || isVoiceProcessing || message.trim() === '') ? {opacity: 0.7} : {}]} 
              onPress={sendMessage}
              disabled={isProcessing || isVoiceProcessing || message.trim() === ''}
            >
              <Ionicons name="send" size={24} color="white" />
            </TouchableOpacity>
            
            {/* Componente de gravação de voz */}
            <VoiceRecorder
              onSendAudio={handleVoiceMessage}
              onVoiceProcessingStart={() => setIsVoiceProcessing(true)}
              onVoiceProcessingEnd={() => setIsVoiceProcessing(false)}
              style={{marginLeft: 4}}
            />
          </ThemedView>
        </ThemedView>
      </ThemedView>

      {/* Manual Analysis Section */}
      <ThemedView style={styles.cardContainer}>
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Análise Manual</ThemedText>
          
          <ThemedView style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Cole aqui o conteúdo da mensagem..."
              multiline
              numberOfLines={6}
              value={notificationText}
              onChangeText={setNotificationText}
              placeholderTextColor="#888"
              editable={!isProcessing}
            />
          </ThemedView>

          <TouchableOpacity 
            style={[styles.analyzeButton, isProcessing ? {opacity: 0.7} : {}]} 
            onPress={analyzeNotification}
            disabled={isProcessing}
          >
            <ThemedText style={styles.buttonText}>
              {isProcessing ? "Analisando..." : "Analisar"}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.statusSection}>
        <ThemedText type="subtitle">Status de Segurança</ThemedText>
        
        <ThemedView style={styles.statusContainer}>
          <ThemedView style={styles.statusRow}>
            <ThemedView style={[styles.statusIndicator, styles.safeIndicator]}>
              <Ionicons name="shield-checkmark" size={24} color="white" />
            </ThemedView>
            <ThemedText>Mensagens Seguras: {stats.safe}</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.statusRow}>
            <ThemedView style={[styles.statusIndicator, styles.warningIndicator]}>
              <Ionicons name="warning" size={24} color="white" />
            </ThemedView>
            <ThemedText>Alertas: {stats.warnings}</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.statusRow}>
            <ThemedView style={[styles.statusIndicator, styles.dangerIndicator]}>
              <Ionicons name="alert-circle" size={24} color="white" />
            </ThemedView>
            <ThemedText>Ameaças Detectadas: {stats.threats}</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle">Como Funciona</ThemedText>
        <ThemedText>
          Nosso sistema usa a API do Grok para identificar tentativas de phishing em tempo real.
          
          • Verde: Mensagem segura
          • Amarelo: Requer atenção, possível risco
          • Vermelho: Alto risco, ações automáticas de proteção
          
          O sistema monitora notificações, SMS e emails em busca de ameaças, e quando detectadas, alerta o usuário e toma as medidas apropriadas automaticamente.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle">Proteção em Segundo Plano</ThemedText>
        <ThemedView style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={24} color="#4CAF50" style={styles.infoIcon} />
          <ThemedText>
            Quando ativado, o detector de phishing continuará protegendo você mesmo quando o aplicativo estiver fechado.
          </ThemedText>
        </ThemedView>
        
        {Platform.OS === 'android' && (
          <ThemedView style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#4A90E2" style={styles.infoIcon} />
            <ThemedText>
              No Android, você verá uma notificação persistente enquanto a proteção estiver ativa. Isto é necessário para garantir que o sistema continue funcionando em segundo plano.
            </ThemedText>
          </ThemedView>
        )}
        
        {Platform.OS === 'ios' && (
          <ThemedView style={styles.infoCard}>
            <Ionicons name="alert-circle" size={24} color="#FFC107" style={styles.infoIcon} />
            <ThemedText>
              No iOS, o sistema realizará verificações periódicas em segundo plano. As verificações em tempo real só ocorrem com o aplicativo aberto.
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      <ThemedView style={styles.cardsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.chatButton]}
          onPress={navigateToChat}
        >
          <Ionicons name="chatbubbles-outline" size={24} color="#FFF" />
          <Text style={styles.actionButtonText}>Conversar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.statsButton]}
          onPress={navigateToStats}
        >
          <Ionicons name="bar-chart-outline" size={24} color="#FFF" />
          <Text style={styles.actionButtonText}>Estatísticas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.settingsButton]}
          onPress={navigateToSettings}
        >
          <Ionicons name="settings-outline" size={24} color="#FFF" />
          <Text style={styles.actionButtonText}>Configurações</Text>
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={styles.tipCard}>
        <ThemedText type="subtitle" style={styles.tipTitle}>
          Dica de Segurança
        </ThemedText>
        <ThemedText style={styles.tipText}>
          Nunca compartilhe senhas ou códigos de verificação, mesmo que a mensagem pareça ser de uma empresa confiável.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  monitorContainer: {
    marginBottom: 20,
  },
  monitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardContainer: {
    marginBottom: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#fff',
    margin: 4,
  },
  navCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  inputContainer: {
    marginVertical: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  analyzeButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  statusSection: {
    marginBottom: 20,
  },
  statusContainer: {
    marginTop: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  safeIndicator: {
    backgroundColor: '#4CAF50',
  },
  warningIndicator: {
    backgroundColor: '#FFC107',
  },
  dangerIndicator: {
    backgroundColor: '#F44336',
  },
  infoSection: {
    marginBottom: 20,
  },
  chatSection: {
    marginBottom: 20,
  },
  chatContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chatMessages: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f0f0f0',
  },
  chatBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E88E5',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#546E7A',
  },
  userText: {
    color: '#ffffff',
  },
  botText: {
    color: '#ffffff',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    padding: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  infoIcon: {
    marginRight: 10,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    textAlign: 'center',
  },
  tipCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipText: {
    textAlign: 'center',
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  chatButton: {
    backgroundColor: '#4A90E2',
  },
  statsButton: {
    backgroundColor: '#FFA000',
  },
  settingsButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
