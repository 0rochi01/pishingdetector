import React from 'react';
import { SafeAreaView, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DetectionResultCard from '../components/DetectionResultCard';
import { RootStackParamList } from '../navigation/AppNavigation';
import { PhishingDetectionResult } from '../services/PhishingDetectionService';

type DetectionResultScreenProps = {
  route: {
    params: {
      result: PhishingDetectionResult;
      message: string;
    };
  };
};

const DetectionResultScreen: React.FC<DetectionResultScreenProps> = ({ route }) => {
  const { result, message } = route.params;
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  
  const handleAskAssistant = () => {
    // Preparar pergunta inicial baseada no resultado
    const initialQuestion = result.isPhishing
      ? `Detectei uma possível mensagem de phishing. A mensagem diz: "${message.substring(0, 100)}...". Como me proteger?`
      : `Como posso me manter seguro contra phishing e fraudes online?`;
      
    // Navegar para a tela do assistente com a pergunta inicial
    navigation.navigate('SecurityAssistant', { initialQuestion });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DetectionResultCard 
          result={result} 
          message={message}
          onAskAssistant={handleAskAssistant}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    padding: 8,
  },
});

export default DetectionResultScreen; 