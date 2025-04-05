import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import SecurityAssistantChat from '../components/SecurityAssistantChat';

interface SecurityAssistantScreenProps {
  route?: {
    params?: {
      initialQuestion?: string;
    };
  };
}

const SecurityAssistantScreen: React.FC<SecurityAssistantScreenProps> = ({ route }) => {
  const initialQuestion = route?.params?.initialQuestion;
  
  return (
    <SafeAreaView style={styles.container}>
      <SecurityAssistantChat initialQuestion={initialQuestion} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default SecurityAssistantScreen; 