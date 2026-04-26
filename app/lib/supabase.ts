import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Custom storage adapter using Expo SecureStore for sensitive token handling.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Defensive initialization: Don't throw at module level
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Helper to ensure supabase is initialized before use.
 */
export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not initialized. Please check your EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }
  return supabase;
}

/**
 * Perform anonymous sign-in.
 * 
 * @returns {Promise<{data: any, error: any}>} Authentication data or error.
 */
export const signInAnonymously = async () => {
  if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) console.error('Error signing in anonymously:', error.message);
  return { data, error };
};
