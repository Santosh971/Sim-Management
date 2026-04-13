import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import syncService from './src/services/SyncService';

export default function App() {
  // Initialize background sync service
  React.useEffect(() => {
    const initSync = async () => {
      try {
        await syncService.initialize();
        console.log('Sync service initialized');
      } catch (error) {
        console.error('Failed to initialize sync service:', error);
      }
    };

    initSync();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}