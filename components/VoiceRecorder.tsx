import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text,
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Animated,
  Easing,
  Platform
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

// Tipos de propriedades do componente
interface VoiceRecorderProps {
  onSendAudio: (audioUri: string) => void;
  onVoiceProcessingStart: () => void;
  onVoiceProcessingEnd: () => void;
  style?: object;
}

/**
 * Componente para gravação de voz
 */
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendAudio,
  onVoiceProcessingStart,
  onVoiceProcessingEnd,
  style
}) => {
  // Estados do componente
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'stopped' | 'recording' | 'recorded'>('stopped');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Refs para animação
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  
  // Ref para o intervalo de duração
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Limpar recursos ao desmontar componente
  useEffect(() => {
    return () => {
      // Limpar gravação
      stopRecording();
      
      // Limpar som
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
      
      // Limpar intervalo
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);
  
  // Iniciar animação de pulso durante gravação
  useEffect(() => {
    if (recordingStatus === 'recording') {
      startPulseAnimation();
    } else {
      pulseAnim.setValue(1);
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true
      }).stop();
    }
  }, [recordingStatus]);
  
  // Iniciar animação de pulso
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  };
  
  // Solicitar permissões de áudio
  const requestPermissions = async (): Promise<boolean> => {
    try {
      console.log('Solicitando permissões de áudio...');
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Para enviar mensagens de voz, é necessário permitir o acesso ao microfone.'
        );
        return false;
      }
      
      // Configurar áudio para gravação
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      Alert.alert('Erro', 'Não foi possível acessar o microfone.');
      return false;
    }
  };
  
  // Iniciar gravação
  const startRecording = async () => {
    try {
      // Verifica permissões primeiro
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;
      
      // Limpa recursos existentes
      if (recording) {
        await stopRecording();
      }
      
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      setAudioUri(null);
      setDuration(0);
      setRecordingStatus('recording');
      
      // Anima botão de gravação
      Animated.timing(recordButtonScale, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Cria nova gravação
      console.log('Iniciando gravação...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      
      // Inicia contador de duração
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      
      durationInterval.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
      setRecordingStatus('stopped');
    }
  };
  
  // Parar gravação
  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      console.log('Parando gravação...');
      
      // Restaurar escala do botão
      Animated.timing(recordButtonScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Parar contador
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      
      // Parar gravação e obter URI
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      setRecording(null);
      setRecordingStatus('recorded');
      
      if (uri) {
        setAudioUri(uri);
        // Cria objeto de som para reprodução
        loadSound(uri);
      }
      
    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      setRecordingStatus('stopped');
      setRecording(null);
    }
  };
  
  // Cancelar gravação
  const cancelRecording = async () => {
    try {
      console.log('Cancelando gravação...');
      
      // Restaurar escala do botão
      Animated.timing(recordButtonScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Parar contador
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      
      // Parar e descartar gravação
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      
      // Limpar som
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      setAudioUri(null);
      setDuration(0);
      setRecordingStatus('stopped');
      
    } catch (error) {
      console.error('Erro ao cancelar gravação:', error);
      setRecordingStatus('stopped');
    }
  };
  
  // Reproduzir gravação
  const playRecording = async () => {
    try {
      if (!audioUri || isPlaying) return;
      
      // Se já temos o som carregado
      if (sound) {
        console.log('Reproduzindo áudio...');
        setIsPlaying(true);
        
        // Reinicia posição
        await sound.setPositionAsync(0);
        
        // Reproduz
        await sound.playAsync();
      } else {
        // Carrega o som novamente
        await loadSound(audioUri);
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      setIsPlaying(false);
    }
  };
  
  // Carregar som para reprodução
  const loadSound = async (uri: string) => {
    try {
      console.log('Carregando áudio para reprodução:', uri);
      
      // Descarrega qualquer som existente
      if (sound) {
        await sound.unloadAsync();
      }
      
      // Carrega novo som
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      
    } catch (error) {
      console.error('Erro ao carregar áudio:', error);
    }
  };
  
  // Atualização de status de reprodução
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  };
  
  // Enviar áudio gravado
  const sendAudio = async () => {
    try {
      if (!audioUri) {
        Alert.alert('Erro', 'Nenhum áudio gravado para enviar.');
        return;
      }
      
      console.log('Enviando áudio:', audioUri);
      
      // Notifica início do processamento
      onVoiceProcessingStart();
      
      // Passa URI para processamento
      onSendAudio(audioUri);
      
      // Limpa estado após envio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      setAudioUri(null);
      setDuration(0);
      setRecordingStatus('stopped');
      
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      onVoiceProcessingEnd(); // Garante que o callback de fim seja chamado mesmo com erro
      Alert.alert('Erro', 'Não foi possível enviar o áudio.');
    }
  };
  
  // Formatar duração em MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Renderizar indicador de gravação
  const renderRecordingIndicator = () => {
    if (recordingStatus !== 'recording') return null;
    
    return (
      <View style={styles.recordingIndicator}>
        <Animated.View 
          style={[
            styles.recordingDot,
            { transform: [{ scale: pulseAnim }] }
          ]} 
        />
        <Text style={styles.recordingText}>
          Gravando {formatDuration(duration)}
        </Text>
      </View>
    );
  };
  
  // Renderizar controles pós-gravação
  const renderRecordedControls = () => {
    if (recordingStatus !== 'recorded') return null;
    
    return (
      <View style={styles.recordedControls}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={playRecording}
          disabled={isPlaying}
        >
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={24} 
            color="#FFF" 
          />
          <Text style={styles.controlText}>
            {isPlaying ? 'Pausando' : 'Reproduzir'} ({formatDuration(duration)})
          </Text>
        </TouchableOpacity>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={cancelRecording}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={sendAudio}
          >
            <Ionicons name="send" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <View style={[styles.container, style]}>
      {renderRecordingIndicator()}
      {renderRecordedControls()}
      
      {recordingStatus === 'stopped' && (
        <Animated.View 
          style={{ 
            transform: [{ scale: recordButtonScale }] 
          }}
        >
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
          >
            <Ionicons name="mic" size={28} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {recordingStatus === 'recording' && (
        <TouchableOpacity
          style={[styles.recordButton, styles.stopButton]}
          onPress={stopRecording}
        >
          <Ionicons name="stop" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2E71E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stopButton: {
    backgroundColor: '#E53935',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
    marginRight: 8,
  },
  recordingText: {
    color: '#E53935',
    fontWeight: '500',
  },
  recordedControls: {
    width: '100%',
    marginBottom: 10,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#673AB7',
    padding: 10,
    borderRadius: 20,
    marginBottom: 10,
    justifyContent: 'center',
  },
  controlText: {
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  sendButton: {
    backgroundColor: '#4CAF50',
  },
});

export default VoiceRecorder; 