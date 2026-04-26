import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import 'react-native-reanimated';
import "../global.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { signInAnonymously } from '../lib/supabase';
import { SQLiteProvider } from 'expo-sqlite';
import { DATABASE_NAME, onDatabaseInit } from '../lib/db';

import { useColorScheme } from '@/components/useColorScheme';

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

/**
 * Root Layout of the Expo application.
 * Includes a global error catcher to prevent silent startup crashes.
 */
export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        if (loaded) {
          // Attempt anonymous sign-in but don't let it crash the app if offline
          try {
            await signInAnonymously();
          } catch (e) {
            console.warn('Supabase init failed, continuing in offline mode');
          }
          setIsReady(true);
        }
      } catch (e) {
        setInitError(e instanceof Error ? e.message : String(e));
      } finally {
        if (loaded || fontError) {
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }
    prepare();
  }, [loaded, fontError]);

  // If there's a critical initialization error, show it on screen instead of crashing
  if (initError || fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#D4AF37', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Startup Error</Text>
        <Text style={{ color: '#FFF', textAlign: 'center' }}>{initError || fontError?.message}</Text>
      </View>
    );
  }

  if (!loaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={onDatabaseInit}>
          <RootLayoutNav />
        </SQLiteProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
