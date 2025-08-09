import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { oneSignalService } from '@/services/oneSignalService';
import Constants from 'expo-constants';

function AppContent() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    // Initialize OneSignal
    // Enable verbose logging for debugging (remove in production)
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    
    // Initialize with your OneSignal App ID from Constants
    const oneSignalAppId = Constants.expoConfig?.extra?.oneSignalAppId;
    if (oneSignalAppId && oneSignalAppId !== 'YOUR_ONESIGNAL_APP_ID') {
      OneSignal.initialize(oneSignalAppId);
      
      // Request push notification permissions
      OneSignal.Notifications.requestPermission(false);
      
      // Setup OneSignal event listeners
      const cleanup = oneSignalService.setupEventListeners();
      
      return cleanup;
    } else {
      console.warn('OneSignal App ID not configured. Please set ONESIGNAL_APP_ID in app.json extra section.');
    }
  }, []);

  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
