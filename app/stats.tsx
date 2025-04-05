import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

import { notificationMonitorService, MonitorableMessage } from '@/services';

// Tipo para o histórico com resultado da análise
type HistoryItem = MonitorableMessage & {
  result?: {
    classification: 'red' | 'yellow' | 'green';
    confidence: number;
    detectedAt: string;
  }
};

export default function StatsScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    red: 0,
    yellow: 0,
    green: 0,
    notificationCount: 0,
    smsCount: 0,
    emailCount: 0,
  });
  const [filter, setFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [loading, setLoading] = useState(true);

  // Carrega o histórico ao montar o componente
  useEffect(() => {
    loadHistory();
  }, []);

  // Carrega o histórico do armazenamento local
  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Caminho do arquivo de histórico
      const historyPath = `${FileSystem.documentDirectory}phishing_detector/analysis_history.json`;
      
      // Verifica se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(historyPath);
      
      if (fileInfo.exists) {
        // Lê o conteúdo do arquivo
        const content = await FileSystem.readAsStringAsync(historyPath);
        const loadedHistory = JSON.parse(content) as HistoryItem[];
        
        // Ordena por data (mais recente primeiro)
        const sortedHistory = loadedHistory.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setHistory(sortedHistory);
        
        // Calcula as estatísticas
        calculateStats(sortedHistory);
      } else {
        // Se não existe, cria um histórico simulado para fins de demonstração
        const demoHistory = createDemoHistory();
        setHistory(demoHistory);
        calculateStats(demoHistory);
        
        // Salva o histórico de demonstração
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}phishing_detector`, 
          { intermediates: true }
        );
        
        await FileSystem.writeAsStringAsync(
          historyPath,
          JSON.stringify(demoHistory)
        );
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      // Em caso de erro, usa dados de demonstração
      const demoHistory = createDemoHistory();
      setHistory(demoHistory);
      calculateStats(demoHistory);
    } finally {
      setLoading(false);
    }
  };
  
  // Cria histórico de demonstração
  const createDemoHistory = (): HistoryItem[] => {
    const now = new Date();
    
    return [
      {
        id: 'demo-1',
        source: 'notification',
        sender: 'Banco Demo',
        content: 'Seu cartão foi bloqueado. Acesse: linkfalso.com.br para desbloquear',
        timestamp: new Date(now.getTime() - 1000 * 60 * 30), // 30 minutos atrás
        read: true,
        result: {
          classification: 'red',
          confidence: 0.98,
          detectedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString()
        }
      },
      {
        id: 'demo-2',
        source: 'sms',
        sender: '+5511999992222',
        content: 'Olá, você ganhou um vale presente. Verifique aqui: bit.ly/a1b2c3',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 horas atrás
        read: true,
        result: {
          classification: 'yellow',
          confidence: 0.72,
          detectedAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString()
        }
      },
      {
        id: 'demo-3',
        source: 'email',
        sender: 'newsletter@empresa.com',
        content: 'Newsletter semanal: as últimas novidades do mundo da tecnologia',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5), // 5 horas atrás
        read: true,
        result: {
          classification: 'green',
          confidence: 0.05,
          detectedAt: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString()
        }
      },
      {
        id: 'demo-4',
        source: 'notification',
        sender: 'Promoções',
        content: 'URGENTE: Sua conta será excluída se não fizer login em 24h!',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 dia atrás
        read: true,
        result: {
          classification: 'yellow',
          confidence: 0.65,
          detectedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString()
        }
      },
      {
        id: 'demo-5',
        source: 'sms',
        sender: '+5511999993333',
        content: 'Confirme o código 123456 para seu acesso ao aplicativo.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 36), // 1.5 dias atrás
        read: true,
        result: {
          classification: 'green',
          confidence: 0.08,
          detectedAt: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString()
        }
      }
    ];
  };
  
  // Calcula estatísticas a partir do histórico
  const calculateStats = (items: HistoryItem[]) => {
    const stats = {
      total: items.length,
      red: 0,
      yellow: 0,
      green: 0,
      notificationCount: 0,
      smsCount: 0,
      emailCount: 0,
    };
    
    items.forEach(item => {
      // Conta por classificação
      if (item.result) {
        if (item.result.classification === 'red') stats.red++;
        else if (item.result.classification === 'yellow') stats.yellow++;
        else if (item.result.classification === 'green') stats.green++;
      }
      
      // Conta por fonte
      if (item.source === 'notification') stats.notificationCount++;
      else if (item.source === 'sms') stats.smsCount++;
      else if (item.source === 'email') stats.emailCount++;
    });
    
    setStats(stats);
  };
  
  // Filtra o histórico de acordo com a classificação selecionada
  const getFilteredHistory = () => {
    if (filter === 'all') return history;
    
    return history.filter(item => 
      item.result && item.result.classification === filter
    );
  };
  
  // Renderiza um item do histórico
  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
    // Define cores e ícones de acordo com a classificação
    let statusColor = '#4CAF50';
    let statusIcon = 'shield-checkmark';
    let statusText = 'Seguro';
    
    if (item.result) {
      if (item.result.classification === 'red') {
        statusColor = '#F44336';
        statusIcon = 'alert-circle';
        statusText = 'Perigoso';
      } else if (item.result.classification === 'yellow') {
        statusColor = '#FFC107';
        statusIcon = 'warning';
        statusText = 'Suspeito';
      }
    }
    
    // Define ícone da fonte
    let sourceIcon = 'notifications';
    if (item.source === 'sms') sourceIcon = 'chatbubbles';
    else if (item.source === 'email') sourceIcon = 'mail';
    
    return (
      <ThemedView style={styles.historyItem}>
        <View style={styles.historyHeader}>
          <View style={styles.sourceContainer}>
            <Ionicons name={sourceIcon} size={18} color="#666" style={styles.sourceIcon} />
            <ThemedText style={styles.sender}>{item.sender}</ThemedText>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Ionicons name={statusIcon} size={14} color="white" />
            <ThemedText style={styles.statusText}>{statusText}</ThemedText>
          </View>
        </View>
        
        <ThemedText style={styles.messageContent} numberOfLines={2}>
          {item.content}
        </ThemedText>
        
        <View style={styles.historyFooter}>
          <ThemedText style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleString()}
          </ThemedText>
          
          {item.result && (
            <ThemedText style={styles.confidence}>
              Confiança: {Math.round(item.result.confidence * 100)}%
            </ThemedText>
          )}
        </View>
      </ThemedView>
    );
  };
  
  // Renderiza a lista de filtros
  const renderFilters = () => {
    return (
      <View style={styles.filtersContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'all' ? styles.activeFilter : {}]}
          onPress={() => setFilter('all')}
        >
          <ThemedText style={filter === 'all' ? styles.activeFilterText : {}}>Todos</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'red' ? styles.activeFilter : {}, { backgroundColor: '#FEE8E7' }]}
          onPress={() => setFilter('red')}
        >
          <Ionicons name="alert-circle" size={16} color="#F44336" />
          <ThemedText style={[styles.filterText, filter === 'red' ? styles.activeFilterText : {}]}>Perigosos</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'yellow' ? styles.activeFilter : {}, { backgroundColor: '#FFF8E1' }]}
          onPress={() => setFilter('yellow')}
        >
          <Ionicons name="warning" size={16} color="#FFC107" />
          <ThemedText style={[styles.filterText, filter === 'yellow' ? styles.activeFilterText : {}]}>Suspeitos</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'green' ? styles.activeFilter : {}, { backgroundColor: '#E8F5E9' }]}
          onPress={() => setFilter('green')}
        >
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <ThemedText style={[styles.filterText, filter === 'green' ? styles.activeFilterText : {}]}>Seguros</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.pageTitle}>Estatísticas de Segurança</ThemedText>
      
      {/* Seção de estatísticas */}
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.statsContainer}>
          <ThemedView style={styles.statRow}>
            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statValue}>{stats.total}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Analisado</ThemedText>
            </ThemedView>
            
            <ThemedView style={styles.statCard}>
              <View style={styles.statThreatContainer}>
                <View style={[styles.statThreat, {backgroundColor: '#F44336'}]}>
                  <ThemedText style={styles.statThreatValue}>{stats.red}</ThemedText>
                </View>
                <View style={[styles.statThreat, {backgroundColor: '#FFC107'}]}>
                  <ThemedText style={styles.statThreatValue}>{stats.yellow}</ThemedText>
                </View>
                <View style={[styles.statThreat, {backgroundColor: '#4CAF50'}]}>
                  <ThemedText style={styles.statThreatValue}>{stats.green}</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.statLabel}>Detecções</ThemedText>
            </ThemedView>
          </ThemedView>
          
          <ThemedView style={styles.statRow}>
            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statValue}>
                {stats.total > 0 ? `${Math.round((stats.red + stats.yellow) / stats.total * 100)}%` : '0%'}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Taxa de Ameaças</ThemedText>
            </ThemedView>
            
            <ThemedView style={styles.statCard}>
              <View style={styles.sourceStats}>
                <View style={styles.sourceStatItem}>
                  <Ionicons name="notifications" size={16} color="#4A90E2" />
                  <ThemedText style={styles.sourceStatValue}>{stats.notificationCount}</ThemedText>
                </View>
                <View style={styles.sourceStatItem}>
                  <Ionicons name="chatbubbles" size={16} color="#4A90E2" />
                  <ThemedText style={styles.sourceStatValue}>{stats.smsCount}</ThemedText>
                </View>
                <View style={styles.sourceStatItem}>
                  <Ionicons name="mail" size={16} color="#4A90E2" />
                  <ThemedText style={styles.sourceStatValue}>{stats.emailCount}</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.statLabel}>Por Fonte</ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
        
        {/* Filtros de histórico */}
        <ThemedView style={styles.historyContainer}>
          <ThemedText type="subtitle">Histórico de Análises</ThemedText>
          {renderFilters()}
          
          {/* Lista de histórico */}
          {loading ? (
            <ThemedText style={styles.loadingText}>Carregando histórico...</ThemedText>
          ) : (
            getFilteredHistory().length > 0 ? (
              <FlatList
                data={getFilteredHistory()}
                renderItem={renderHistoryItem}
                keyExtractor={item => item.id}
                style={styles.historyList}
                scrollEnabled={false} // Desativa o scroll da lista pois já estamos em um ScrollView
              />
            ) : (
              <ThemedText style={styles.emptyText}>Nenhuma análise encontrada para o filtro atual.</ThemedText>
            )
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  pageTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statThreatContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statThreat: {
    width: 30,
    height: 30,
    borderRadius: 15,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statThreatValue: {
    color: 'white',
    fontWeight: 'bold',
  },
  sourceStats: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  sourceStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 4,
  },
  sourceStatValue: {
    marginLeft: 4,
    fontWeight: 'bold',
  },
  historyContainer: {
    marginBottom: 20,
  },
  filtersContainer: {
    flexDirection: 'row',
    marginVertical: 12,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  activeFilter: {
    backgroundColor: '#4A90E2',
  },
  filterText: {
    marginLeft: 4,
  },
  activeFilterText: {
    color: 'white',
    fontWeight: 'bold',
  },
  historyList: {
    marginTop: 8,
  },
  historyItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceIcon: {
    marginRight: 6,
  },
  sender: {
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  messageContent: {
    fontSize: 14,
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  confidence: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
}); 