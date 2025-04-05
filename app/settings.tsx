import React, { useState, useEffect } from 'react';
import { StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { backgroundTaskService } from '@/services';

// Interface para as configurações
interface AppSettings {
  autoStartMonitoring: boolean;
  showNotifications: boolean;
  saveScanHistory: boolean;
  optimizeBattery: boolean;
  checkOnBoot: boolean;
  scanIntervalMinutes: number;
  sensitivityLevel: 'high' | 'medium' | 'low';
}

// Valores padrão
const defaultSettings: AppSettings = {
  autoStartMonitoring: true,
  showNotifications: true,
  saveScanHistory: true,
  optimizeBattery: true,
  checkOnBoot: true,
  scanIntervalMinutes: 15,
  sensitivityLevel: 'medium',
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [appInfo, setAppInfo] = useState({
    version: '1.0.0',
    buildNumber: '1',
    installDate: new Date(),
  });
  
  // Carrega as configurações ao montar o componente
  useEffect(() => {
    loadSettings();
    loadAppInfo();
  }, []);
  
  // Carrega informações do aplicativo
  const loadAppInfo = async () => {
    try {
      const version = Constants.expoConfig?.version || '1.0.0';
      const buildNumber = Constants.expoConfig?.android?.versionCode?.toString() || '1';
      
      let installDate = new Date();
      if (Platform.OS === 'android') {
        try {
          const installTimeString = await Application.getInstallationTimeAsync();
          installDate = new Date(installTimeString);
        } catch (error) {
          console.error('Erro ao obter data de instalação:', error);
        }
      }
      
      setAppInfo({
        version,
        buildNumber,
        installDate,
      });
    } catch (error) {
      console.error('Erro ao obter informações do aplicativo:', error);
    }
  };
  
  // Carrega as configurações do armazenamento local
  const loadSettings = async () => {
    try {
      const settingsPath = `${FileSystem.documentDirectory}phishing_detector/settings.json`;
      const fileInfo = await FileSystem.getInfoAsync(settingsPath);
      
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(settingsPath);
        const savedSettings = JSON.parse(content) as AppSettings;
        setSettings(savedSettings);
      } else {
        // Se não existe, usa os valores padrão e salva
        await saveSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };
  
  // Salva as configurações no armazenamento local
  const saveSettings = async (newSettings: AppSettings) => {
    try {
      const settingsPath = `${FileSystem.documentDirectory}phishing_detector/settings.json`;
      
      // Cria o diretório se não existir
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}phishing_detector`, 
        { intermediates: true }
      );
      
      // Salva as configurações
      await FileSystem.writeAsStringAsync(
        settingsPath,
        JSON.stringify(newSettings)
      );
      
      // Atualiza o estado
      setSettings(newSettings);
      
      // Se a configuração de otimização de bateria mudou, atualiza o serviço em segundo plano
      if (newSettings.optimizeBattery !== settings.optimizeBattery) {
        await backgroundTaskService.updateBatteryOptimization(newSettings.optimizeBattery);
      }
      
      console.log('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações.');
    }
  };
  
  // Atualiza uma configuração específica
  const updateSetting = (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };
  
  // Exporta logs do aplicativo
  const exportLogs = async () => {
    try {
      const logPath = `${FileSystem.documentDirectory}phishing_detector/monitoring_log.json`;
      const fileInfo = await FileSystem.getInfoAsync(logPath);
      
      if (!fileInfo.exists) {
        Alert.alert('Logs não encontrados', 'Nenhum log de monitoramento foi encontrado para exportar.');
        return;
      }
      
      // Verifica se o compartilhamento está disponível
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Compartilhamento não disponível', 'O recurso de compartilhamento não está disponível neste dispositivo.');
        return;
      }
      
      // Compartilha o arquivo
      await Sharing.shareAsync(logPath, {
        mimeType: 'application/json',
        dialogTitle: 'Exportar Logs de Monitoramento',
      });
    } catch (error) {
      console.error('Erro ao exportar logs:', error);
      Alert.alert('Erro', 'Não foi possível exportar os logs.');
    }
  };
  
  // Limpa todos os dados
  const clearAllData = () => {
    Alert.alert(
      'Limpar Todos os Dados',
      'Tem certeza que deseja apagar todos os dados do aplicativo? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Limpar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const dirPath = `${FileSystem.documentDirectory}phishing_detector`;
              await FileSystem.deleteAsync(dirPath, { idempotent: true });
              
              // Recarrega as configurações padrão
              setSettings(defaultSettings);
              await saveSettings(defaultSettings);
              
              Alert.alert('Sucesso', 'Todos os dados foram apagados com sucesso.');
            } catch (error) {
              console.error('Erro ao limpar dados:', error);
              Alert.alert('Erro', 'Não foi possível limpar todos os dados.');
            }
          }
        }
      ]
    );
  };
  
  // Renderiza os seletores de intervalo de escaneamento
  const renderScanIntervalOptions = () => {
    const intervals = [5, 15, 30, 60];
    
    return (
      <ThemedView style={styles.intervalOptions}>
        {intervals.map(minutes => (
          <TouchableOpacity
            key={minutes}
            style={[
              styles.intervalOption,
              settings.scanIntervalMinutes === minutes && styles.selectedInterval
            ]}
            onPress={() => updateSetting('scanIntervalMinutes', minutes)}
          >
            <ThemedText style={settings.scanIntervalMinutes === minutes ? styles.selectedIntervalText : {}}>
              {minutes} min
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>
    );
  };
  
  // Renderiza os seletores de nível de sensibilidade
  const renderSensitivityOptions = () => {
    const options = [
      { value: 'low', label: 'Baixa', icon: 'shield-outline' },
      { value: 'medium', label: 'Média', icon: 'shield-half-outline' },
      { value: 'high', label: 'Alta', icon: 'shield' },
    ];
    
    return (
      <ThemedView style={styles.sensitivityOptions}>
        {options.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.sensitivityOption,
              settings.sensitivityLevel === option.value && styles.selectedSensitivity
            ]}
            onPress={() => updateSetting('sensitivityLevel', option.value)}
          >
            <Ionicons 
              name={option.icon as any} 
              size={24} 
              color={settings.sensitivityLevel === option.value ? '#fff' : '#4A90E2'}
            />
            <ThemedText style={settings.sensitivityLevel === option.value ? styles.selectedSensitivityText : {}}>
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.pageTitle}>Configurações</ThemedText>
      
      <ScrollView style={styles.scrollContainer}>
        {/* Configurações de monitoramento */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Monitoramento</ThemedText>
          
          <ThemedView style={styles.settingItem}>
            <ThemedView style={styles.settingTextContainer}>
              <ThemedText style={styles.settingTitle}>Iniciar monitoramento ao abrir o app</ThemedText>
              <ThemedText style={styles.settingDescription}>Ativa automaticamente a proteção quando o aplicativo é aberto</ThemedText>
            </ThemedView>
            <Switch
              value={settings.autoStartMonitoring}
              onValueChange={(value) => updateSetting('autoStartMonitoring', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.autoStartMonitoring ? '#4A90E2' : '#f4f3f4'}
            />
          </ThemedView>
          
          <ThemedView style={styles.settingItem}>
            <ThemedView style={styles.settingTextContainer}>
              <ThemedText style={styles.settingTitle}>Exibir notificações de alerta</ThemedText>
              <ThemedText style={styles.settingDescription}>Mostra notificações quando ameaças são detectadas</ThemedText>
            </ThemedView>
            <Switch
              value={settings.showNotifications}
              onValueChange={(value) => updateSetting('showNotifications', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.showNotifications ? '#4A90E2' : '#f4f3f4'}
            />
          </ThemedView>
          
          <ThemedView style={styles.settingItem}>
            <ThemedView style={styles.settingTextContainer}>
              <ThemedText style={styles.settingTitle}>Salvar histórico de análises</ThemedText>
              <ThemedText style={styles.settingDescription}>Mantém um registro de todas as análises realizadas</ThemedText>
            </ThemedView>
            <Switch
              value={settings.saveScanHistory}
              onValueChange={(value) => updateSetting('saveScanHistory', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.saveScanHistory ? '#4A90E2' : '#f4f3f4'}
            />
          </ThemedView>
          
          <ThemedView style={styles.settingItem}>
            <ThemedView style={styles.settingTextContainer}>
              <ThemedText style={styles.settingTitle}>Otimizar para economia de bateria</ThemedText>
              <ThemedText style={styles.settingDescription}>Reduz a frequência de verificações quando a bateria está baixa</ThemedText>
            </ThemedView>
            <Switch
              value={settings.optimizeBattery}
              onValueChange={(value) => updateSetting('optimizeBattery', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.optimizeBattery ? '#4A90E2' : '#f4f3f4'}
            />
          </ThemedView>
          
          {Platform.OS === 'android' && (
            <ThemedView style={styles.settingItem}>
              <ThemedView style={styles.settingTextContainer}>
                <ThemedText style={styles.settingTitle}>Verificar ao iniciar o dispositivo</ThemedText>
                <ThemedText style={styles.settingDescription}>Inicia o monitoramento automaticamente quando o dispositivo é ligado</ThemedText>
              </ThemedView>
              <Switch
                value={settings.checkOnBoot}
                onValueChange={(value) => updateSetting('checkOnBoot', value)}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={settings.checkOnBoot ? '#4A90E2' : '#f4f3f4'}
              />
            </ThemedView>
          )}
          
          <ThemedView style={styles.settingBlock}>
            <ThemedText style={styles.settingBlockTitle}>Intervalo de escaneamento automático</ThemedText>
            <ThemedText style={styles.settingDescription}>Frequência com que o sistema verifica novas mensagens em segundo plano</ThemedText>
            {renderScanIntervalOptions()}
          </ThemedView>
          
          <ThemedView style={styles.settingBlock}>
            <ThemedText style={styles.settingBlockTitle}>Nível de sensibilidade</ThemedText>
            <ThemedText style={styles.settingDescription}>Ajusta a sensibilidade da detecção de phishing</ThemedText>
            {renderSensitivityOptions()}
          </ThemedView>
        </ThemedView>
        
        {/* Ferramentas */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Ferramentas</ThemedText>
          
          <TouchableOpacity style={styles.toolButton} onPress={exportLogs}>
            <Ionicons name="download-outline" size={24} color="#4A90E2" />
            <ThemedView style={styles.toolButtonTextContainer}>
              <ThemedText style={styles.toolButtonTitle}>Exportar Logs</ThemedText>
              <ThemedText style={styles.toolButtonDescription}>Compartilhar logs de monitoramento para análise</ThemedText>
            </ThemedView>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.toolButton} onPress={clearAllData}>
            <Ionicons name="trash-outline" size={24} color="#F44336" />
            <ThemedView style={styles.toolButtonTextContainer}>
              <ThemedText style={styles.toolButtonTitle}>Limpar Todos os Dados</ThemedText>
              <ThemedText style={styles.toolButtonDescription}>Apagar todo o histórico e redefinir configurações</ThemedText>
            </ThemedView>
          </TouchableOpacity>
        </ThemedView>
        
        {/* Informações do aplicativo */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Sobre o Aplicativo</ThemedText>
          
          <ThemedView style={styles.infoItem}>
            <ThemedText style={styles.infoLabel}>Versão</ThemedText>
            <ThemedText style={styles.infoValue}>{appInfo.version} (Build {appInfo.buildNumber})</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.infoItem}>
            <ThemedText style={styles.infoLabel}>Data de Instalação</ThemedText>
            <ThemedText style={styles.infoValue}>{appInfo.installDate.toLocaleDateString()}</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.infoItem}>
            <ThemedText style={styles.infoLabel}>Plataforma</ThemedText>
            <ThemedText style={styles.infoValue}>{Platform.OS} {Platform.Version}</ThemedText>
          </ThemedView>
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
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  settingBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingBlockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  intervalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  intervalOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  selectedInterval: {
    backgroundColor: '#4A90E2',
  },
  selectedIntervalText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sensitivityOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sensitivityOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  selectedSensitivity: {
    backgroundColor: '#4A90E2',
  },
  selectedSensitivityText: {
    color: 'white',
    fontWeight: 'bold',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    marginVertical: 8,
  },
  toolButtonTextContainer: {
    marginLeft: 12,
  },
  toolButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  toolButtonDescription: {
    fontSize: 12,
    color: '#666',
  },
  infoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 