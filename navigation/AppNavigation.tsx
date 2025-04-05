import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Importar telas
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SecurityAssistantScreen from '../screens/SecurityAssistantScreen';
import DetectionResultScreen from '../screens/DetectionResultScreen';

// Tipos para navegação
export type RootStackParamList = {
  MainTabs: undefined;
  DetectionResult: { 
    result: any; 
    message: string;
  };
  SecurityAssistant: { 
    initialQuestion?: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Scan: undefined;
  History: undefined;
  Settings: undefined;
  Assistant: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

// Navegação principal com tabs
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = '';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Scan') {
            iconName = focused ? 'scan' : 'scan-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'Assistant') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Início' }}
      />
      <Tab.Screen 
        name="Scan" 
        component={ScanScreen} 
        options={{ title: 'Verificar' }}
      />
      <Tab.Screen 
        name="Assistant" 
        component={SecurityAssistantScreen} 
        options={{ 
          title: 'Assistente',
          headerShown: false
        }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen} 
        options={{ title: 'Histórico' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Configurações' }}
      />
    </Tab.Navigator>
  );
};

// Navegação principal com stack
const AppNavigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="DetectionResult" 
          component={DetectionResultScreen}
          options={{ title: 'Resultado da Verificação' }}
        />
        <Stack.Screen 
          name="SecurityAssistant" 
          component={SecurityAssistantScreen}
          options={{ title: 'Assistente de Segurança' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigation; 