import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, ActivityIndicator } from 'react-native';
import { PhishingAnalysisResult } from '../services/GrokApiService';
import grokApiService from '../services/GrokApiService';

const styles = StyleSheet.create({
  analysisContainer: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 16,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  explanationText: {
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 8,
  },
  detailTitle: {
    fontWeight: 'bold',
  },
  detailContent: {
    marginLeft: 8,
  },
  confidenceText: {
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
});

const SecurityAssistantChat: React.FC = () => {
  const [analysisResults, setAnalysisResults] = useState<PhishingAnalysisResult[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const analyzeMessage = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await grokApiService.analyzeMessage(inputText);
      setAnalysisResults(prev => [result, ...prev]);
      setInputText('');
    } catch (error: any) {
      console.error('Erro ao analisar mensagem:', error);
      
      // Criar um resultado de erro para exibir ao usuário
      const errorResult: PhishingAnalysisResult = {
        isPhishing: false,
        confidence: 0,
        explanation: `Erro ao analisar a mensagem: ${error.message || 'Erro desconhecido'}. Por favor, tente novamente mais tarde.`,
        suspiciousWords: [],
        suspiciousUrls: []
      };
      
      setAnalysisResults(prev => [errorResult, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPhishingAnalysis = (analysis: PhishingAnalysisResult) => {
    if (!analysis) return null;

    // Determinar cor com base no resultado da análise
    const getStatusColor = () => {
      if (analysis.isPhishing) {
        return analysis.confidence > 0.7 ? 'red' : 'orange';
      }
      return 'green';
    };

    const statusColor = getStatusColor();
    
    return (
      <View style={styles.analysisContainer}>
        <View style={styles.analysisHeader}>
          <Text style={styles.analysisTitle}>Análise de Segurança</Text>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        </View>
        
        <Text style={styles.explanationText}>{analysis.explanation}</Text>
        
        {analysis.suspiciousWords && analysis.suspiciousWords.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Palavras suspeitas:</Text>
            <Text style={styles.detailContent}>{analysis.suspiciousWords.join(', ')}</Text>
          </View>
        )}
        
        {analysis.suspiciousUrls && analysis.suspiciousUrls.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>URLs suspeitos:</Text>
            <Text style={styles.detailContent}>{analysis.suspiciousUrls.join(', ')}</Text>
          </View>
        )}
        
        <Text style={styles.confidenceText}>
          Confiança: {Math.round(analysis.confidence * 100)}%
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Digite uma mensagem para analisar..."
          multiline
        />
        <Button
          title="Analisar"
          onPress={analyzeMessage}
          disabled={isLoading || !inputText.trim()}
        />
      </View>
      
      {isLoading && <ActivityIndicator size="large" color="#0066cc" />}
      
      {analysisResults.map((result, index) => (
        <React.Fragment key={`analysis-${index}`}>
          {renderPhishingAnalysis(result)}
        </React.Fragment>
      ))}
    </View>
  );
};

export default SecurityAssistantChat; 