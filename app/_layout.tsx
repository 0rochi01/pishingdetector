import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen
          name="chat"
          options={{
            title: 'Análise de Phishing',
            headerRight: () => (
              <FontAwesome
                name="gear"
                size={24}
                color="#4A90E2"
                style={{ marginRight: 15 }}
                onPress={() => {
                  router.push('/settings');
                }}
              />
            ),
          }}
        />
        <Stack.Screen 
          name="stats" 
          options={{ 
            title: 'Estatísticas',
            headerRight: () => (
              <FontAwesome
                name="gear"
                size={24}
                color="#4A90E2"
                style={{ marginRight: 15 }}
                onPress={() => {
                  router.push('/settings');
                }}
              />
            ),
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            title: 'Configurações',
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
