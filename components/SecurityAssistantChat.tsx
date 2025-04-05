import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import uuid from 'react-native-uuid';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import PhishingDetectionService from '../services/PhishingDetectionService';
import { ChatMessage } from '../services/GrokChatService';

interface SecurityAssistantChatProps {
  initialQuestion?: string;
}

const SecurityAssistantChat: React.FC<SecurityAssistantChatProps> = ({ initialQuestion }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const phishingService = PhishingDetectionService.getInstance();
  const insets = useSafeAreaInsets();
  
  useEffect(() => {
    // Configurar áudio para gravação
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: 1, // INTERRUPTION_MODE_IOS_DUCK_OTHERS
      interruptionModeAndroid: 1, // INTERRUPTION_MODE_ANDROID_DUCK_OTHERS
    });
    
    // Gerar ID de sessão único
    const id = uuid.v4().toString();
    setSessionId(id);
    
    // Carregar histórico se existir
    loadChatHistory(id);
    
    // Se há uma pergunta inicial, enviá-la
    if (initialQuestion) {
      sendMessage(initialQuestion);
    }
    
    // Limpar recursos ao desmontar
    return () => {
      stopSpeaking();
      stopRecording();
    };
  }, []);
  
  const loadChatHistory = async (id: string) => {
    const history = phishingService.getChatHistory(id);
    
    // Filtrar mensagem do sistema
    const userMessages = history.filter(msg => msg.role !== 'system');
    setMessages(userMessages);
  };
  
  const sendMessage = async (text: string = inputText) => {
    if (!text.trim()) return;
    
    // Parar a fala se estiver ativa
    stopSpeaking();
    
    // Adicionar mensagem do usuário à UI
    const userMessage: ChatMessage = {
      role: 'user',
      content: text
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      // Enviar para o assistente
      const response = await phishingService.askSecurityAssistant(sessionId, text);
      
      // Adicionar resposta à UI
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Falar a resposta em voz alta
      speakResponse(response);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Mostrar mensagem de erro
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const speakResponse = async (text: string) => {
    try {
      // Verifica se o texto não está vazio
      if (!text.trim()) return;
      
      // Parar qualquer fala anterior
      stopSpeaking();
      
      // Iniciar a fala com a resposta do assistente
      setIsSpeaking(true);
      
      // Configurar opções de fala para português
      await Speech.speak(text, {
        language: 'pt-BR',
        rate: 0.9,
        pitch: 1.0,
        onDone: () => {
          setIsSpeaking(false);
        },
        onError: (error) => {
          console.error('Erro ao reproduzir fala:', error);
          setIsSpeaking(false);
        }
      });
    } catch (error) {
      console.error('Erro ao iniciar fala:', error);
      setIsSpeaking(false);
    }
  };
  
  const stopSpeaking = async () => {
    try {
      if (isSpeaking) {
        await Speech.stop();
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Erro ao parar fala:', error);
      setIsSpeaking(false);
    }
  };
  
  const startRecording = async () => {
    try {
      // Verificar permissões
      const { granted } = await Audio.requestPermissionsAsync();
      
      if (!granted) {
        Alert.alert(
          'Permissão necessária', 
          'É preciso permissão para gravar áudio para usar esta função.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Parar qualquer gravação existente
      await stopRecording();
      
      // Fornecer feedback visual para o usuário
      setIsRecording(true);
      
      // Iniciar nova gravação
      const newRecording = new Audio.Recording();
      
      try {
        console.log('Preparando gravação...');
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        
        console.log('Iniciando gravação...');
        await newRecording.startAsync();
        setRecording(newRecording);
        console.log('Gravação iniciada com sucesso');
      } catch (prepareError) {
        console.error('Erro ao preparar/iniciar gravação:', prepareError);
        setIsRecording(false);
        
        // Usar simulação em caso de erro na gravação
        setTimeout(() => {
          simulateVoiceRecognition();
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      Alert.alert(
        'Erro no reconhecimento de voz', 
        'Não foi possível acessar o microfone. Usaremos texto de demonstração.',
        [{ text: 'OK' }]
      );
      setIsRecording(false);
      
      // Se falhar completamente, simular reconhecimento com atraso
      setTimeout(() => {
        simulateVoiceRecognition();
      }, 2000);
    }
  };
  
  const simulateVoiceRecognition = () => {
    // Array de perguntas simuladas para demonstração
    const demoQuestions = [
      "Como me proteger de golpes na internet?",
      "O que é phishing e como evitar?",
      "Como sei se um email é seguro?",
      "Posso confiar em links recebidos por SMS?",
      "O que fazer se cair em um golpe online?"
    ];
    
    // Selecionar uma pergunta aleatória
    const recognizedText = demoQuestions[Math.floor(Math.random() * demoQuestions.length)];
    
    // Definir o texto reconhecido como entrada
    setInputText(recognizedText);
    
    // Enviar mensagem após um breve atraso
    setTimeout(() => {
      sendMessage(recognizedText);
    }, 500);
  };
  
  const stopRecording = async () => {
    try {
      if (!recording) {
        setIsRecording(false);
        return;
      }
      
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (uri) {
        processAudioToText(uri);
      } else {
        // Se não tiver URI, simular reconhecimento
        simulateVoiceRecognition();
      }
    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      setIsRecording(false);
      setRecording(null);
      
      // Em caso de erro, simular reconhecimento
      simulateVoiceRecognition();
    }
  };
  
  const processAudioToText = async (audioUri: string) => {
    try {
      setIsLoading(true);
      
      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      
      if (!fileInfo.exists) {
        throw new Error('Arquivo de áudio não encontrado');
      }
      
      // Em um ambiente de produção, envie o áudio para um serviço de reconhecimento
      // Como estamos em um ambiente de teste, vamos simular o reconhecimento
      
      // Simular um atraso para processamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Em um cenário aleatório, simular falha para mostrar o tratamento de erro
      const shouldFail = Math.random() > 0.7;
      
      if (shouldFail) {
        throw new Error('Falha no reconhecimento de voz');
      }
      
      // Array de perguntas simuladas para demonstração
      const demoQuestions = [
        "Como me proteger de golpes na internet?",
        "O que é phishing e como evitar?",
        "Como sei se um email é seguro?",
        "Posso confiar em links recebidos por SMS?",
        "O que fazer se cair em um golpe online?"
      ];
      
      // Selecionar uma pergunta aleatória
      const recognizedText = demoQuestions[Math.floor(Math.random() * demoQuestions.length)];
      
      // Definir o texto reconhecido como entrada
      setInputText(recognizedText);
      
      // Enviar mensagem após um breve atraso para que o usuário veja o texto reconhecido
      setTimeout(() => {
        sendMessage(recognizedText);
      }, 500);
      
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
      Alert.alert(
        'Reconhecimento de voz',
        'Não foi possível reconhecer o áudio. Por favor, tente novamente ou digite sua pergunta.',
        [
          { text: 'OK' }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearChat = async () => {
    await phishingService.clearChatHistory(sessionId);
    // Remover mensagens da UI, exceto a mensagem do sistema
    setMessages([]);
  };
  
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    
    return (
      <View style={[
        styles.messageBubble, 
        isUser ? styles.userBubble : styles.assistantBubble
      ]}>
        <Text style={[
          styles.messageText,
          isUser ? styles.userMessageText : styles.assistantMessageText
        ]}>
          {item.content}
        </Text>
        
        {!isUser && (
          <TouchableOpacity 
            style={styles.speakButton}
            onPress={() => speakResponse(item.content)}
          >
            <Ionicons 
              name={isSpeaking ? "volume-high" : "volume-medium-outline"} 
              size={16} 
              color="#0066cc" 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assistente de Segurança</Text>
        <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#0066cc" />
          <Text style={styles.emptyStateTitle}>
            Assistente de Segurança Grok
          </Text>
          <Text style={styles.emptyStateText}>
            Olá! Estou aqui para ajudar com suas dúvidas sobre segurança digital, 
            phishing e proteção online. Como posso ajudar você hoje?
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0066cc" />
          <Text style={styles.loadingText}>
            {isRecording ? 'Ouvindo...' : 'Pensando...'}
          </Text>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Digite sua pergunta..."
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => sendMessage()}
        />
        
        <TouchableOpacity 
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons 
            name={isRecording ? "mic" : "mic-outline"} 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled
          ]} 
          onPress={() => sendMessage()}
          disabled={!inputText.trim() || isLoading}
        >
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  messageList: {
    padding: 16,
    paddingBottom: 16,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    maxWidth: '80%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    position: 'relative',
  },
  userBubble: {
    backgroundColor: '#0084ff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  assistantMessageText: {
    color: '#333',
  },
  speakButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginHorizontal: 16,
    alignSelf: 'flex-start',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#b0b0b0',
  },
  micButton: {
    backgroundColor: '#28a745',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micButtonActive: {
    backgroundColor: '#dc3545',
  },
});

export default SecurityAssistantChat; 