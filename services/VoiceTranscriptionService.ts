import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

class VoiceTranscriptionService {
  private static instance: VoiceTranscriptionService;
  private cache: Map<string, string> = new Map();
  private readonly API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  private readonly API_ENDPOINTS = [
    'https://speech.googleapis.com/v1/speech:recognize',
    'https://speech.googleapis.com/v1p1beta1/speech:recognize'
  ];

  private constructor() {}

  static getInstance(): VoiceTranscriptionService {
    if (!VoiceTranscriptionService.instance) {
      VoiceTranscriptionService.instance = new VoiceTranscriptionService();
    }
    return VoiceTranscriptionService.instance;
  }

  async transcribeAudio(audioUri: string): Promise<string> {
    try {
      // Verificar cache
      if (this.cache.has(audioUri)) {
        return this.cache.get(audioUri)!;
      }

      // Ler o arquivo de áudio
      const audioData = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Configurar a requisição
      const requestData = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'pt-BR',
          enableAutomaticPunctuation: true,
          model: 'default',
          useEnhanced: true
        },
        audio: {
          content: audioData
        }
      };

      // Tentar diferentes endpoints
      let transcription = '';
      for (const endpoint of this.API_ENDPOINTS) {
        try {
          const response = await axios.post(
            `${endpoint}?key=${this.API_KEY}`,
            requestData,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.results && response.data.results[0]) {
            transcription = response.data.results[0].alternatives[0].transcript;
            break;
          }
        } catch (error) {
          console.warn(`Falha no endpoint ${endpoint}:`, error);
          continue;
        }
      }

      if (!transcription) {
        throw new Error('Não foi possível transcrever o áudio');
      }

      // Armazenar no cache
      this.cache.set(audioUri, transcription);

      return transcription;
    } catch (error) {
      console.error('Erro na transcrição:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export default VoiceTranscriptionService; 