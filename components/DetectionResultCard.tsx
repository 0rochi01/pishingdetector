import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Card, Badge } from '@rneui/themed';
import { LinearProgress } from '@rneui/base';
import { Ionicons } from '@expo/vector-icons';
import { PhishingDetectionResult } from '../services/PhishingDetectionService';

interface DetectionResultCardProps {
  result: PhishingDetectionResult;
  message: string;
  onAskAssistant?: () => void;
}

const DetectionResultCard: React.FC<DetectionResultCardProps> = ({ 
  result, 
  message, 
  onAskAssistant 
}) => {
  const { isPhishing, confidence, details, explanation } = result;
  
  // Determinar cor com base no resultado
  const getColor = () => {
    if (isPhishing) {
      return '#FF3B30'; // Vermelho para phishing detectado
    } else {
      return '#34C759'; // Verde para conteúdo seguro
    }
  };
  
  // Determinar ícone com base no resultado
  const getIcon = () => {
    if (isPhishing) {
      return 'warning-outline';
    } else {
      return 'shield-checkmark-outline';
    }
  };
  
  // Formatar confiança em porcentagem
  const formatConfidence = () => {
    return `${Math.round(confidence * 100)}%`;
  };
  
  // Verificar se foi usado Grok API
  const isGrokResult = details?.source === 'GROK_API';
  
  return (
    <Card containerStyle={styles.card}>
      <View style={styles.headerContainer}>
        <View style={[styles.iconContainer, { backgroundColor: getColor() }]}>
          <Ionicons name={getIcon()} size={24} color="white" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>
            {isPhishing ? 'Phishing Detectado' : 'Conteúdo Seguro'}
          </Text>
          <Text style={styles.subtitle}>
            Confiança: {formatConfidence()}
          </Text>
        </View>
        {isGrokResult && (
          <Badge
            value="Grok AI"
            status="primary"
            containerStyle={styles.grokBadge}
          />
        )}
      </View>
      
      <LinearProgress
        color={getColor()}
        value={confidence}
        style={styles.progressBar}
        variant="determinate"
      />
      
      {explanation && (
        <View style={styles.explanationContainer}>
          <Text style={styles.explanationTitle}>Análise do Assistente:</Text>
          <Text style={styles.explanationText}>{explanation}</Text>
        </View>
      )}
      
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>Detalhes da Análise:</Text>
        
        {details?.suspiciousWords && details.suspiciousWords.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Palavras suspeitas:</Text>
            <Text style={styles.detailValue}>
              {details.suspiciousWords.join(', ')}
            </Text>
          </View>
        )}
        
        {details?.suspiciousUrls && details.suspiciousUrls.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>URLs suspeitos:</Text>
            <Text style={styles.detailValue}>
              {details.suspiciousUrls.join(', ')}
            </Text>
          </View>
        )}
        
        {details?.requestsSensitiveData && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Solicita dados sensíveis</Text>
          </View>
        )}
        
        {details?.createsUrgency && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cria senso de urgência</Text>
          </View>
        )}
        
        {details?.source && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Origem da detecção:</Text>
            <Text style={styles.detailValue}>{details.source}</Text>
          </View>
        )}
      </View>
      
      <Card.Divider />
      
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Conteúdo analisado:</Text>
        <Text numberOfLines={5} style={styles.messageText}>
          {message}
        </Text>
      </View>
      
      {onAskAssistant && (
        <TouchableOpacity 
          style={styles.askAssistantButton}
          onPress={onAskAssistant}
        >
          <Ionicons name="chatbox-ellipses-outline" size={18} color="white" />
          <Text style={styles.askAssistantText}>
            Perguntar ao Assistente de Segurança
          </Text>
        </TouchableOpacity>
      )}
      
      {isGrokResult && (
        <View style={styles.grokWatermark}>
          <Text style={styles.watermarkText}>Powered by Grok AI</Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    marginBottom: 15,
    height: 8,
    borderRadius: 4,
  },
  explanationContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#0066cc',
  },
  explanationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  detailsContainer: {
    marginBottom: 15,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  detailLabel: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  detailValue: {
    flex: 1,
  },
  messageContainer: {
    marginTop: 5,
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
  },
  askAssistantButton: {
    flexDirection: 'row',
    backgroundColor: '#0066cc',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  askAssistantText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  grokBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  grokWatermark: {
    position: 'absolute',
    bottom: 5,
    right: 10,
    opacity: 0.5,
  },
  watermarkText: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default DetectionResultCard; 